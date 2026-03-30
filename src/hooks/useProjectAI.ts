import { useState, useCallback, useEffect, useRef } from 'react'
import { useProjectId } from './useProjectId'
import { supabase } from '../lib/supabase'

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
  // Look for numbered follow-up suggestions
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
      tool: '', // Will be filled when confirmed
      input: {},
    }
  }
  return undefined
}

export function useProjectAI(pageContext?: string, entityContext?: string): UseProjectAIReturn {
  const projectId = useProjectId()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conversationRef = useRef<ChatMessage[]>([])

  // Keep ref in sync
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

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        // Fallback for prototype mode
        const aiResponse: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: generateFallbackResponse(input.trim(), pageContext),
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, aiResponse])
        return
      }

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
        if (response.status === 429) {
          throw new Error('Daily AI usage limit reached. Please try again tomorrow.')
        }
        throw new Error(`AI service error: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const content = data.content || ''
      const toolResults = data.tool_results || []
      const entityRefs = parseEntityRefs(content)
      const suggestedPrompts = parseSuggestedPrompts(content)
      const pendingAction = parsePendingAction(content)

      // Clean entity refs and action markers from displayed content
      const cleanContent = content
        .replace(/\[ENTITY:\w+:[^:]+:[^\]]+\]/g, (match: string) => {
          const ref = parseEntityRefs(match)[0]
          return ref ? ref.label : match
        })
        .replace(/\[ACTION_PENDING:[^\]]+\]/g, '')
        .trim()

      const aiResponse: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date(),
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        entityRefs: entityRefs.length > 0 ? entityRefs : undefined,
        suggestedPrompts: suggestedPrompts.length > 0 ? suggestedPrompts : undefined,
        pendingAction,
      }

      setMessages(prev => [...prev, aiResponse])
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
    // Find the message with this pending action
    const msg = conversationRef.current.find(m => m.pendingAction?.id === actionId)
    if (!msg?.pendingAction) return

    setIsLoading(true)
    try {
      // Re-send the conversation with an explicit confirmation
      const confirmMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: `Yes, please proceed with: ${msg.pendingAction.description}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, confirmMessage])

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
          projectContext: {
            projectId,
            userId: session?.user?.id,
            page: pageContext || 'general',
          },
        }),
      })

      const data = await response.json()
      const content = data.content || 'Action completed.'
      const toolResults = data.tool_results || []

      setMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: content.replace(/\[ENTITY:\w+:[^:]+:[^\]]+\]/g, (match: string) => {
          const ref = parseEntityRefs(match)[0]
          return ref ? ref.label : match
        }).replace(/\[ACTION_PENDING:[^\]]+\]/g, ''),
        timestamp: new Date(),
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        entityRefs: parseEntityRefs(content),
      }])

      // Clear the pending action from the original message
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

// Fallback responses when no API key is configured
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
