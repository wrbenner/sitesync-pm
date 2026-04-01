import { useState, useCallback, useEffect, useRef } from 'react'
import { useProjectId } from './useProjectId'
import { supabase } from '../lib/supabase'
import { aiService } from '../lib/aiService'
import type { AIMessage, AIContext } from '../types/ai'

export interface ToolResult {
  tool: string
  input: Record<string, unknown>
  result: Record<string, unknown>
}

export interface PendingAction {
  id: string
  description: string
  tool: string
  input: Record<string, unknown>
}

export interface EntityRef {
  type: string
  id: string
  label: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolResults?: ToolResult[]
  pendingAction?: PendingAction
  suggestedPrompts?: string[]
  entityRefs?: EntityRef[]
  streaming?: boolean
}

interface UseProjectAIReturn {
  messages: ChatMessage[]
  input: string
  setInput: (val: string) => void
  sendMessage: () => Promise<void>
  confirmAction: (actionId: string) => Promise<void>
  cancelAction: (actionId: string) => void
  isLoading: boolean
  error: string | null
  clearMessages: () => void
}

// Parse entity references from AI response: [ENTITY:type:id:label]
function parseEntityRefs(text: string): EntityRef[] {
  const refs: EntityRef[] = []
  const regex = /\[ENTITY:(\w+):([^:]+):([^\]]+)\]/g
  let match
  while ((match = regex.exec(text)) !== null) {
    refs.push({ type: match[1], id: match[2], label: match[3] })
  }
  return refs
}

// Parse suggested follow-ups from AI response
function parseSuggestedPrompts(text: string): string[] {
  const prompts: string[] = []
  const lines = text.split('\n')
  let inFollowUp = false
  for (const line of lines) {
    if (line.toLowerCase().includes('follow up') || line.toLowerCase().includes('you might ask') || line.toLowerCase().includes('you could also')) {
      inFollowUp = true
      continue
    }
    if (inFollowUp) {
      const cleaned = line.replace(/^[\d\.\-\*•]+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/^"/, '').replace(/"$/, '').trim()
      if (cleaned.length > 10 && cleaned.length < 120) {
        prompts.push(cleaned)
      }
    }
  }
  return prompts.slice(0, 3)
}

// Parse pending action markers: [ACTION_PENDING: description]
function parsePendingAction(text: string): PendingAction | undefined {
  const match = text.match(/\[ACTION_PENDING:\s*([^\]]+)\]/)
  if (match) {
    return {
      id: `action-${Date.now()}`,
      description: match[1].trim(),
      tool: '',
      input: {},
    }
  }
  return undefined
}

function cleanContent(content: string): string {
  return content
    .replace(/\[ENTITY:\w+:[^:]+:[^\]]+\]/g, (match: string) => {
      const ref = parseEntityRefs(match)[0]
      return ref ? ref.label : match
    })
    .replace(/\[ACTION_PENDING:[^\]]+\]/g, '')
    .trim()
}

function buildAIMessages(chatMessages: ChatMessage[]): AIMessage[] {
  return chatMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }))
}

export function useProjectAI(pageContext?: string, entityContext?: string): UseProjectAIReturn {
  const projectId = useProjectId()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conversationRef = useRef<ChatMessage[]>([])

  useEffect(() => { conversationRef.current = messages }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    const context: AIContext = {
      projectId,
      currentPage: pageContext,
      selectedEntities: entityContext ? [{ type: 'entity', id: entityContext }] : undefined,
    }

    try {
      // Path 1: dedicated AI endpoint (VITE_AI_ENDPOINT / VITE_AI_API_KEY)
      if (aiService.isConfigured()) {
        const streamingId = `msg-${Date.now() + 1}`
        // Optimistically add a streaming placeholder
        setMessages(prev => [...prev, {
          id: streamingId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          streaming: true,
        }])

        const allMessages = buildAIMessages([...conversationRef.current, userMessage])

        await aiService.streamChat(
          allMessages,
          context,
          (chunk) => {
            setMessages(prev => prev.map(m =>
              m.id === streamingId ? { ...m, content: m.content + chunk } : m
            ))
          }
        )

        // Finalize the streamed message
        setMessages(prev => prev.map(m => {
          if (m.id !== streamingId) return m
          const raw = m.content
          const entityRefs = parseEntityRefs(raw)
          const suggestedPrompts = parseSuggestedPrompts(raw)
          const pendingAction = parsePendingAction(raw)
          return {
            ...m,
            content: cleanContent(raw),
            streaming: false,
            entityRefs: entityRefs.length > 0 ? entityRefs : undefined,
            suggestedPrompts: suggestedPrompts.length > 0 ? suggestedPrompts : undefined,
            pendingAction,
          }
        }))
        return
      }

      // Path 2: Supabase Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (supabaseUrl) {
        const { data: { session } } = await supabase.auth.getSession()
        const allMessages = [...conversationRef.current, userMessage]

        const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            messages: allMessages.map(m => ({ role: m.role, content: m.content })),
            projectContext: {
              projectId,
              userId: session?.user?.id,
              page: pageContext || 'general',
              entityContext: entityContext || '',
            },
          }),
        })

        if (!response.ok) {
          if (response.status === 429) throw new Error('Daily AI usage limit reached. Please try again tomorrow.')
          throw new Error(`AI service error: ${response.status}`)
        }

        const data = await response.json()
        if (data.error) throw new Error(data.error)

        const content = data.content || ''
        const toolResults = data.tool_results || []
        const entityRefs = parseEntityRefs(content)
        const suggestedPrompts = parseSuggestedPrompts(content)
        const pendingAction = parsePendingAction(content)

        setMessages(prev => [...prev, {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: cleanContent(content),
          timestamp: new Date(),
          toolResults: toolResults.length > 0 ? toolResults : undefined,
          entityRefs: entityRefs.length > 0 ? entityRefs : undefined,
          suggestedPrompts: suggestedPrompts.length > 0 ? suggestedPrompts : undefined,
          pendingAction,
        }])
        return
      }

      // Path 3: Prototype fallback
      const fallback = generateFallbackWithUI(input.trim(), pageContext)
      setMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: fallback.content,
        timestamp: new Date(),
        toolResults: fallback.toolResults,
      }])
    } catch (err) {
      setError((err as Error).message)
      setMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `I encountered an error: ${(err as Error).message}. Please try again.`,
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, projectId, pageContext, entityContext])

  const confirmAction = useCallback(async (actionId: string) => {
    const msg = conversationRef.current.find(m => m.pendingAction?.id === actionId)
    if (!msg?.pendingAction) return

    setIsLoading(true)
    try {
      const confirmMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: `Yes, please proceed with: ${msg.pendingAction.description}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, confirmMessage])

      const context: AIContext = {
        projectId,
        currentPage: pageContext,
      }

      if (aiService.isConfigured()) {
        const allMessages = buildAIMessages([...conversationRef.current, confirmMessage])
        const result = await aiService.chat(allMessages, context) as AIMessage
        const content = result.content || 'Action completed.'
        setMessages(prev => [...prev, {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: cleanContent(content),
          timestamp: new Date(),
          entityRefs: parseEntityRefs(content),
        }])
      } else {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const { data: { session } } = await supabase.auth.getSession()
        const allMessages = [...conversationRef.current, confirmMessage]

        const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            messages: allMessages.map(m => ({ role: m.role, content: m.content })),
            projectContext: { projectId, userId: session?.user?.id, page: pageContext || 'general' },
          }),
        })

        const data = await response.json()
        const content = data.content || 'Action completed.'
        const toolResults = data.tool_results || []

        setMessages(prev => [...prev, {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: cleanContent(content),
          timestamp: new Date(),
          toolResults: toolResults.length > 0 ? toolResults : undefined,
          entityRefs: parseEntityRefs(content),
        }])
      }

      setMessages(prev => prev.map(m =>
        m.pendingAction?.id === actionId ? { ...m, pendingAction: undefined } : m
      ))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, pageContext])

  const cancelAction = useCallback((actionId: string) => {
    setMessages(prev => [
      ...prev.map(m => m.pendingAction?.id === actionId ? { ...m, pendingAction: undefined } : m),
      { id: `msg-${Date.now()}`, role: 'assistant' as const, content: 'Action cancelled. Let me know if you need anything else.', timestamp: new Date() },
    ])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, input, setInput, sendMessage, confirmAction, cancelAction, isLoading, error, clearMessages }
}

// Fallback with generative UI blocks for prototype mode
function generateFallbackWithUI(query: string, page?: string): { content: string; toolResults?: ToolResult[] } {
  const lower = query.toLowerCase()

  if (lower.includes('overdue') && lower.includes('rfi')) {
    return {
      content: 'Here are the overdue RFIs that need attention:',
      toolResults: [{
        tool: 'query_rfis',
        input: { overdue: true },
        result: {
          ui_type: 'data_table',
          title: 'Overdue RFIs',
          columns: [
            { key: 'number', label: 'RFI #', width: '80px' },
            { key: 'title', label: 'Subject', width: '1fr' },
            { key: 'status', label: 'Status', type: 'status', width: '110px' },
            { key: 'days', label: 'Days Open', type: 'number', width: '90px' },
            { key: 'assignee', label: 'Ball in Court', width: '140px' },
          ],
          rows: [],
          actions: [
            { label: 'Reassign', action: 'reassign_rfi', requiresPermission: 'rfis.edit' },
          ],
          total_count: 3,
        },
      }],
    }
  }

  if (lower.includes('create') && (lower.includes('punch') || lower.includes('rfi') || lower.includes('task'))) {
    const entityType = lower.includes('rfi') ? 'rfi' : lower.includes('punch') ? 'punch_item' : 'task'
    const title = lower.includes('rfi') ? 'Create New RFI' : lower.includes('punch') ? 'Create Punch Item' : 'Create Task'
    const contextMatch = query.match(/(?:for|about|regarding)\s+(.+?)(?:\.|$)/i)
    const contextText = contextMatch?.[1] || ''

    return {
      content: `I have prepared a ${entityType === 'rfi' ? 'RFI' : entityType === 'punch_item' ? 'punch item' : 'task'} form based on your request. Review the pre-filled fields and submit when ready:`,
      toolResults: [{
        tool: `create_${entityType}`,
        input: {},
        result: {
          ui_type: 'form',
          title,
          entity_type: entityType,
          fields: entityType === 'rfi' ? [
            { name: 'title', label: 'Subject', type: 'text', required: true, value: contextText || 'HVAC Conflict' },
            { name: 'description', label: 'Question', type: 'textarea', required: true, value: contextText ? `Requesting clarification on: ${contextText}` : '' },
            { name: 'priority', label: 'Priority', type: 'select', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }], value: 'high' },
            { name: 'assigned_to', label: 'Assigned To', type: 'text', placeholder: 'Name or company' },
            { name: 'due_date', label: 'Due Date', type: 'date' },
          ] : entityType === 'punch_item' ? [
            { name: 'title', label: 'Description', type: 'text', required: true, value: contextText },
            { name: 'location', label: 'Location', type: 'text', value: '' },
            { name: 'priority', label: 'Priority', type: 'select', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }], value: 'medium' },
            { name: 'assigned_to', label: 'Assigned To', type: 'text' },
          ] : [
            { name: 'title', label: 'Title', type: 'text', required: true, value: contextText },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'priority', label: 'Priority', type: 'select', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }], value: 'medium' },
            { name: 'due_date', label: 'Due Date', type: 'date' },
          ],
          submit_label: `Create ${entityType === 'rfi' ? 'RFI' : entityType === 'punch_item' ? 'Punch Item' : 'Task'}`,
        },
      }],
    }
  }

  if (lower.includes('health') || lower.includes('overview') || lower.includes('dashboard')) {
    return {
      content: 'Here is your project health overview:',
      toolResults: [{
        tool: 'get_project_health',
        input: {},
        result: {
          ui_type: 'metric_cards',
          cards: [
            { label: 'Schedule Health', value: '92%', status: 'good', change: 3, changeLabel: 'vs last week', link: '/schedule' },
            { label: 'Budget Health', value: '87%', status: 'warning', change: -2, changeLabel: 'vs last week', link: '/budget' },
            { label: 'Safety Score', value: '98%', status: 'good', change: 1, changeLabel: 'vs last week', link: '/safety' },
            { label: 'Quality Score', value: '85%', status: 'warning', change: -4, changeLabel: 'vs last week', link: '/punch-list' },
          ],
        },
      }],
    }
  }

  if (lower.includes('compare') || lower.includes('vs') || lower.includes('versus')) {
    return {
      content: 'Here is the comparison:',
      toolResults: [{
        tool: 'comparison',
        input: {},
        result: {
          ui_type: 'comparison',
          title: 'This Month vs Last Month',
          columns: ['This Month', 'Last Month'],
          rows: [
            { label: 'RFIs Opened', values: [8, 12], highlight: 'better' },
            { label: 'RFIs Closed', values: [11, 7], highlight: 'better' },
            { label: 'Avg Response Time', values: ['4.2 days', '6.1 days'], highlight: 'better' },
            { label: 'Change Orders', values: [3, 2], highlight: 'worse' },
            { label: 'CO Value', values: ['$485K', '$210K'], highlight: 'worse' },
            { label: 'Punch Items Closed', values: [28, 22], highlight: 'better' },
            { label: 'Safety Incidents', values: [0, 1], highlight: 'better' },
          ],
        },
      }],
    }
  }

  if (lower.includes('budget') && (lower.includes('breakdown') || lower.includes('chart') || lower.includes('division'))) {
    return {
      content: 'Here is the budget breakdown by division:',
      toolResults: [{
        tool: 'query_budget',
        input: { type: 'divisions' },
        result: {
          ui_type: 'chart',
          chart_type: 'bar',
          title: 'Budget by Division',
          data: [
            { division: 'Structural', budget: 8500000, spent: 7480000 },
            { division: 'MEP', budget: 12200000, spent: 8784000 },
            { division: 'Finishes', budget: 6800000, spent: 2720000 },
            { division: 'Site Work', budget: 4200000, spent: 3780000 },
            { division: 'General', budget: 5100000, spent: 3570000 },
          ],
          x_key: 'division',
          y_keys: ['budget', 'spent'],
          y_labels: ['Budget', 'Spent'],
        },
      }],
    }
  }

  return { content: generateFallbackResponse(query, page) }
}

function generateFallbackResponse(query: string, page?: string): string {
  const lower = query.toLowerCase()

  if (lower.includes('attention') || lower.includes('today')) {
    return '**Items needing your attention today:**\n\n1. 3 RFIs are overdue and need responses\n2. 2 submittals are due for review this week\n3. Steel delivery tracking 2 weeks behind schedule\n4. Budget contingency on Structural division below 5%\n\nWould you like me to dig deeper into any of these?\n\nYou might also ask:\n- "Show me the overdue RFIs"\n- "What is the budget risk assessment?"\n- "Give me a weekly status summary"'
  }

  if (lower.includes('weekly') || lower.includes('status') || lower.includes('summary')) {
    return '**Weekly Status Summary:**\n\n**Schedule:** 62% complete, tracking 4 days ahead of baseline\n**Budget:** $18.2M spent of $42.8M (42%), within contingency\n**Safety:** Zero incidents this week, 14 consecutive safe days\n**Quality:** 3 open RFIs, average response time 4.2 days\n**Workforce:** Average 187 workers/day, productivity at 108% of plan\n\nKey wins: MEP rough in completed ahead of schedule. Concrete crew efficiency at project high.\n\nKey risks: Structural steel delivery delay could impact floors 9 and 10.\n\nYou might also ask:\n- "What are the top 3 risks?"\n- "Show me the budget breakdown by division"\n- "How is the schedule trending?"'
  }

  if (lower.includes('rfi') && (lower.includes('bottleneck') || lower.includes('analysis'))) {
    return '**RFI Bottleneck Analysis:**\n\nLongest open RFIs:\n1. RFI 004: Structural connection detail (12 days open, critical priority)\n2. RFI 003: HVAC zoning strategy (8 days open, high priority)\n3. RFI 001: Interior finish specs (5 days open, high priority)\n\nCommon patterns:\n- Structural engineer responses averaging 8.5 days (target: 5 days)\n- 67% of overdue RFIs are in the structural and MEP disciplines\n- Ball in court is primarily with the design team (4 of 6 open items)\n\nRecommendation: Schedule a coordination meeting with the structural engineer to clear the backlog.\n\nYou might also ask:\n- "Create an RFI for the curtain wall detail"\n- "What RFIs are blocking work this week?"\n- "Show me RFI response time trends"'
  }

  if (lower.includes('budget') && (lower.includes('risk') || lower.includes('assessment'))) {
    return '**Budget Risk Assessment:**\n\n**Overall Status:** $18.2M spent of $42.8M budget (42%)\n\n**At Risk Divisions:**\n- Structural: 88% committed, only $320K contingency remaining\n- MEP: 72% committed, $1.1M contingency remaining\n\n**Pending Change Orders:** $485K in pending COs (3 items)\n- PCO 001: Owner requested lobby upgrade ($180K)\n- PCO 002: Field condition at foundation ($125K)\n- COR 001: Design error in curtain wall detail ($180K)\n\n**Contingency:** $3.8M total, $2.4M remaining (63%)\n\nRecommendation: The structural division needs immediate monitoring. Any additional COs will push it over budget.\n\nYou might also ask:\n- "Show me the change order pipeline"\n- "What is the cost forecast at completion?"\n- "Which divisions are tracking over budget?"'
  }

  return `I can help you with that. As your AI construction assistant, I have access to all project data.\n\nFor the ${page || 'current'} page, I can:\n- Query and analyze RFIs, submittals, tasks, budget, and schedule data\n- Create new RFIs or tasks\n- Update entity statuses\n- Generate reports and summaries\n- Identify risks and bottlenecks\n\nWhat specific information would you like?\n\nYou might ask:\n- "What needs my attention today?"\n- "Give me a weekly status summary"\n- "Show me the budget risk assessment"`
}
