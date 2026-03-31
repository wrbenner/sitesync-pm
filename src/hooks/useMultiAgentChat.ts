import { useCallback, useEffect, useRef } from 'react'
import { useProjectId } from './useProjectId'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAgentOrchestrator } from '../stores/agentOrchestrator'
import {
  parseAgentMention,
  stripAgentMention,
  SPECIALIST_AGENTS,
  AGENT_TOOLS,
} from '../types/agents'
import type {
  AgentDomain,
  AgentConversationMessage,
  OrchestratorResponse,
  IntentClassification,
  AgentSuggestedAction,
} from '../types/agents'

// ── useMultiAgentChat ─────────────────────────────────────────
// Replaces useProjectAI with multi-agent orchestration.
// Routes messages through the agent-orchestrator edge function,
// handles @mentions for direct agent routing, and manages
// batch action approval workflows.

interface UseMultiAgentChatReturn {
  messages: AgentConversationMessage[]
  input: string
  setInput: (val: string) => void
  sendMessage: (text?: string) => Promise<void>
  isProcessing: boolean
  activeAgents: AgentDomain[]
  lastIntent: IntentClassification | null
  pendingActions: AgentSuggestedAction[]
  approveAction: (actionId: string) => Promise<void>
  rejectAction: (actionId: string) => void
  approveAllPending: () => Promise<void>
  rejectAllPending: () => void
  clearMessages: () => void
}

export function useMultiAgentChat(
  pageContext?: string,
  entityContext?: string,
): UseMultiAgentChatReturn {
  const projectId = useProjectId()
  const store = useAgentOrchestrator()
  const conversationRef = useRef<AgentConversationMessage[]>([])

  // Keep ref in sync with store
  useEffect(() => {
    conversationRef.current = store.messages
  }, [store.messages])

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? store.input).trim()
      if (!text || store.isProcessing) return

      // Parse @mention for direct routing
      const mentionedAgent = parseAgentMention(text)
      const cleanText = mentionedAgent ? stripAgentMention(text) : text

      // Add user message
      const userMsg = store.addUserMessage(text)
      store.setInput('')
      store.setProcessing(true)

      try {
        if (!isSupabaseConfigured) {
          // Prototype fallback: simulate multi-agent routing
          await simulateMultiAgentResponse(cleanText, mentionedAgent, pageContext, store)
          return
        }

        // Call the agent-orchestrator edge function
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const response = await fetch(
          `${supabaseUrl}/functions/v1/agent-orchestrator`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              message: cleanText,
              mentionedAgent,
              conversationHistory: conversationRef.current.slice(-20).map((m) => ({
                role: m.role,
                content: m.content,
                agentDomain: m.agentDomain,
              })),
              projectContext: {
                projectId,
                userId: session?.user?.id,
                page: pageContext || 'general',
                entityContext: entityContext || '',
              },
            }),
          },
        )

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('AI usage limit reached. Please try again later.')
          }
          throw new Error(`Agent orchestrator error: ${response.status}`)
        }

        const data: OrchestratorResponse = await response.json()
        store.handleOrchestratorResponse(data)
      } catch (err) {
        store.setProcessing(false)
        store.setActiveAgents([])
        store.addCoordinatorMessage(
          `I encountered an error: ${(err as Error).message}. Please try again.`,
        )
      }
    },
    [store, projectId, pageContext, entityContext],
  )

  const approveAction = useCallback(
    async (actionId: string) => {
      const batch = store.pendingBatch
      if (!batch) return
      const action = batch.actions.find((a) => a.id === actionId)
      if (!action) return

      store.approveAction(actionId)

      // Execute the approved action via edge function
      if (isSupabaseConfigured) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

          await fetch(`${supabaseUrl}/functions/v1/agent-orchestrator`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              executeAction: {
                actionId: action.id,
                tool: action.tool,
                input: action.input,
                domain: action.domain,
              },
              projectContext: { projectId },
            }),
          })
        } catch {
          // Action execution error handled by edge function audit trail
        }
      }

      store.addCoordinatorMessage(
        `Action approved: ${action.description}`,
      )
    },
    [store, projectId],
  )

  const approveAllPending = useCallback(async () => {
    const batch = store.pendingBatch
    if (!batch) return
    for (const action of batch.actions) {
      await approveAction(action.id)
    }
  }, [store, approveAction])

  const rejectAction = useCallback(
    (actionId: string) => {
      const batch = store.pendingBatch
      if (!batch) return
      const action = batch.actions.find((a) => a.id === actionId)
      store.rejectAction(actionId)
      if (action) {
        store.addCoordinatorMessage(`Action rejected: ${action.description}`)
      }
    },
    [store],
  )

  const rejectAllPending = useCallback(() => {
    store.rejectAllPending()
    store.addCoordinatorMessage('All pending actions rejected.')
  }, [store])

  return {
    messages: store.messages,
    input: store.input,
    setInput: store.setInput,
    sendMessage,
    isProcessing: store.isProcessing,
    activeAgents: store.activeAgents,
    lastIntent: store.lastIntent,
    pendingActions: store.pendingBatch?.actions ?? [],
    approveAction,
    rejectAction,
    approveAllPending,
    rejectAllPending,
    clearMessages: store.clearMessages,
  }
}

// ── Prototype Fallback ────────────────────────────────────────
// Simulates multi-agent routing for demo/prototype mode
// when Supabase is not configured.

async function simulateMultiAgentResponse(
  query: string,
  mentionedAgent: AgentDomain | null,
  pageContext: string | undefined,
  store: ReturnType<typeof useAgentOrchestrator.getState>,
) {
  const lower = query.toLowerCase()

  // Determine which agents to invoke
  let targetAgents: AgentDomain[]

  if (mentionedAgent) {
    targetAgents = [mentionedAgent]
  } else {
    targetAgents = classifyIntent(lower)
  }

  const intent: IntentClassification = {
    intent: targetAgents.length > 1 ? 'multi_agent' : targetAgents.length === 1 ? 'single_agent' : 'general',
    targetAgents,
    confidence: 0.92,
    reasoning: mentionedAgent
      ? `Direct @mention of ${SPECIALIST_AGENTS[mentionedAgent].name}`
      : `Routing based on query analysis to ${targetAgents.map((a) => SPECIALIST_AGENTS[a].shortName).join(', ')}`,
    mentionedAgent: mentionedAgent ?? undefined,
  }

  store.setLastIntent(intent)

  // Show routing indicator
  if (targetAgents.length > 0) {
    store.setActiveAgents(targetAgents)
    store.addCoordinatorMessage(
      targetAgents.length === 1
        ? `Routing to ${SPECIALIST_AGENTS[targetAgents[0]].name}...`
        : `Routing to ${targetAgents.map((a) => SPECIALIST_AGENTS[a].shortName).join(', ')} agents...`,
      intent,
    )
  }

  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 600))

  // Generate responses from each agent
  for (const domain of targetAgents) {
    const response = generateAgentResponse(domain, lower, pageContext)
    store.addAgentMessage(domain, response.content, {
      toolCalls: response.toolCalls,
      suggestedActions: response.suggestedActions,
      generativeBlocks: response.generativeBlocks,
    })

    // Small stagger between agent responses for visual effect
    if (targetAgents.length > 1) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 400))
    }
  }

  // If multiple agents responded, add coordinator synthesis
  if (targetAgents.length > 1) {
    await new Promise((r) => setTimeout(r, 300))
    store.addCoordinatorMessage(generateSynthesis(targetAgents, lower))
  }

  // Collect any suggested actions into a batch
  const allActions: AgentSuggestedAction[] = []
  for (const domain of targetAgents) {
    const agentActions = generateAgentResponse(domain, lower, pageContext).suggestedActions
    if (agentActions) {
      allActions.push(...agentActions)
    }
  }

  if (allActions.length > 0) {
    store.setPendingBatch({
      id: `batch-${Date.now()}`,
      actions: allActions,
      status: 'pending',
      createdAt: new Date(),
    })
  }

  store.setProcessing(false)
  store.setActiveAgents([])
}

function classifyIntent(lower: string): AgentDomain[] {
  const domainKeywords: Record<AgentDomain, string[]> = {
    schedule: ['schedule', 'delay', 'timeline', 'gantt', 'task', 'critical path', 'float', 'milestone', 'look ahead', 'lookahead', 'behind', 'ahead', 'completion date'],
    cost: ['budget', 'cost', 'money', 'eac', 'evm', 'change order', 'contingency', 'cash flow', 'burn rate', 'forecast', 'spend', 'overrun', 'cpi', 'spi'],
    safety: ['safety', 'osha', 'ppe', 'hazard', 'incident', 'injury', 'jha', 'violation', 'emr', 'toolbox talk', 'unsafe'],
    quality: ['quality', 'punch', 'rework', 'deficiency', 'inspection', 'submittal', 'qc', 'qa', 'closeout'],
    compliance: ['compliance', 'insurance', 'payroll', 'davis bacon', 'prevailing wage', 'lien', 'coi', 'certification', 'certified'],
    document: ['document', 'spec', 'drawing', 'report', 'rfi', 'pdf', 'closeout', 'specification', 'cross reference'],
  }

  const matches: AgentDomain[] = []
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matches.push(domain as AgentDomain)
    }
  }

  // "How's the project doing?" → schedule + cost + safety
  if (matches.length === 0 && (lower.includes('project') && (lower.includes('doing') || lower.includes('status') || lower.includes('health') || lower.includes('overview')))) {
    return ['schedule', 'cost', 'safety']
  }

  // "What needs attention?" → schedule + quality + safety
  if (matches.length === 0 && (lower.includes('attention') || lower.includes('urgent') || lower.includes('priority'))) {
    return ['schedule', 'quality', 'safety']
  }

  return matches.length > 0 ? matches.slice(0, 3) : ['schedule'] // Default to schedule
}

function generateAgentResponse(
  domain: AgentDomain,
  query: string,
  _pageContext?: string,
): {
  content: string
  toolCalls?: AgentConversationMessage['toolCalls']
  suggestedActions?: AgentSuggestedAction[]
  generativeBlocks?: AgentConversationMessage['generativeBlocks']
} {
  const responses: Record<AgentDomain, () => ReturnType<typeof generateAgentResponse>> = {
    schedule: () => {
      if (query.includes('delay') || query.includes('behind')) {
        return {
          content:
            'I have analyzed the critical path and identified 2 active delays:\n\n' +
            '1. **MEP rough in, Floors 7 and 8** is 3 days behind due to material delivery delays from the HVAC supplier. This is consuming float on the finish sequence.\n\n' +
            '2. **Curtain wall installation, South elevation** is 1 day behind due to crew reallocation to address the Level 5 waterproofing issue.\n\n' +
            'Current float on the critical path is 4 days. If the MEP delay extends beyond Friday, we will need to consider acceleration options.',
          suggestedActions: [
            {
              id: `action-${Date.now()}-1`,
              domain: 'schedule',
              description: 'Reschedule MEP rough in start date to account for 3 day material delay',
              tool: 'suggest_reordering',
              input: { task_id: 'task-mep-roughin', delay_days: 3 },
              confidence: 88,
              impact: 'high',
              requiresApproval: true,
            },
          ],
        }
      }
      return {
        content:
          'Project is tracking **4 days ahead** of the baseline schedule at 62% complete.\n\n' +
          '**Critical path:** Foundation → Structure → MEP rough in → Finishes → Commissioning\n\n' +
          'Current phase: MEP rough in on floors 5 through 8. Structural steel complete through Level 10.\n\n' +
          'Next major milestone: **MEP substantial completion** on April 15th. We have 4 days of float remaining.',
        generativeBlocks: [
          {
            type: 'metric_cards',
            data: {
              cards: [
                { label: 'Overall Progress', value: '62%', status: 'good', change: 2, changeLabel: 'vs last week' },
                { label: 'Days Ahead/Behind', value: '+4 days', status: 'good' },
                { label: 'Critical Path Float', value: '4 days', status: 'warning' },
                { label: 'Next Milestone', value: 'Apr 15', status: 'good' },
              ],
            },
          },
        ],
      }
    },

    cost: () => {
      if (query.includes('overrun') || query.includes('over budget')) {
        return {
          content:
            'I have identified 2 divisions trending over budget:\n\n' +
            '**Structural (Division 03):** $7.48M spent of $8.5M budget (88% committed). Only $320K contingency remaining. CPI = 0.94, indicating 6% cost overrun.\n\n' +
            '**Site Work (Division 02):** $3.78M spent of $4.2M budget (90% committed). Unforeseen rock removal added $180K. CPI = 0.91.\n\n' +
            'All other divisions are tracking within budget with CPI > 1.0.',
          suggestedActions: [
            {
              id: `action-${Date.now()}-2`,
              domain: 'cost',
              description: 'Draft change order for unforeseen rock removal conditions ($180K)',
              tool: 'draft_change_order',
              input: { description: 'Unforeseen rock removal', amount: 180000, division: 'site_work' },
              confidence: 92,
              impact: 'high',
              requiresApproval: true,
            },
          ],
        }
      }
      return {
        content:
          '**Budget Health Summary:**\n\n' +
          'Total budget: **$42.8M** | Spent to date: **$18.2M** (42%)\n\n' +
          'Earned Value Analysis:\n' +
          '• CPI: **1.02** (slightly under budget overall)\n' +
          '• SPI: **1.04** (slightly ahead of schedule)\n' +
          '• EAC: **$41.9M** (projected $900K under budget)\n\n' +
          'Contingency remaining: **$2.4M of $3.8M** (63%). 3 pending change orders totaling $485K.',
        generativeBlocks: [
          {
            type: 'metric_cards',
            data: {
              cards: [
                { label: 'Budget Spent', value: '$18.2M', status: 'good', change: 0, changeLabel: '42% of $42.8M' },
                { label: 'CPI', value: '1.02', status: 'good' },
                { label: 'SPI', value: '1.04', status: 'good' },
                { label: 'EAC', value: '$41.9M', status: 'good', changeLabel: '$900K under budget' },
              ],
            },
          },
        ],
      }
    },

    safety: () => {
      if (query.includes('ppe') || query.includes('violation')) {
        return {
          content:
            'I have reviewed the safety inspection logs and photo analysis for this week:\n\n' +
            '**PPE Violations Detected: 3**\n\n' +
            '1. Missing hard hat observed on Level 7 scaffolding (photo captured Tuesday, 9:14 AM). Corrective action issued to Acme Concrete crew.\n\n' +
            '2. Improper fall protection harness attachment on Level 9 steel erection (Wednesday, 2:30 PM). Work stopped, crew re-trained on site.\n\n' +
            '3. Missing safety glasses in grinding area, Level 3 mechanical room (Thursday, 11:00 AM). Verbal warning issued.\n\n' +
            'All violations have been documented and corrective actions are tracked.',
          suggestedActions: [
            {
              id: `action-${Date.now()}-3`,
              domain: 'safety',
              description: 'Generate Job Hazard Analysis for Level 9 steel erection activities',
              tool: 'generate_jha',
              input: { location: 'Level 9', activity: 'Steel erection', trade: 'Ironworkers' },
              confidence: 95,
              impact: 'critical',
              requiresApproval: true,
            },
          ],
        }
      }
      return {
        content:
          '**Safety Status:**\n\n' +
          'Current EMR: **0.82** (below industry average of 1.0, excellent)\n\n' +
          '• Consecutive safe days: **14**\n' +
          '• Total recordable incidents: **0** this month\n' +
          '• Near misses reported: **2** (both addressed with corrective actions)\n' +
          '• Open corrective actions: **3**\n' +
          '• Safety inspections this week: **8** (all passed)\n\n' +
          'No OSHA citations. Safety training completion rate: 98%.',
        generativeBlocks: [
          {
            type: 'metric_cards',
            data: {
              cards: [
                { label: 'EMR', value: '0.82', status: 'good' },
                { label: 'Safe Days', value: '14', status: 'good', change: 14, changeLabel: 'consecutive' },
                { label: 'Incidents (MTD)', value: '0', status: 'good' },
                { label: 'Open Actions', value: '3', status: 'warning' },
              ],
            },
          },
        ],
      }
    },

    quality: () => ({
      content:
        '**Quality Status:**\n\n' +
        '• Open punch items: **47** (12 critical, 18 major, 17 minor)\n' +
        '• Submittals pending review: **8** (3 overdue)\n' +
        '• Rework rate this month: **2.1%** (target: < 3%)\n' +
        '• Failed inspections: **1** (concrete placement on Level 6, re-inspection scheduled)\n\n' +
        'Top deficiency trend: Drywall finishing quality on floors 3 through 5. 67% of punch items in that zone relate to taping and mudding. Recommend scheduling a quality walk with the finishing subcontractor.',
      suggestedActions: [
        {
          id: `action-${Date.now()}-4`,
          domain: 'quality',
          description: 'Schedule quality walk for drywall finishing on Floors 3 through 5',
          tool: 'suggest_inspection_schedule',
          input: { type: 'quality_walk', location: 'Floors 3-5', trade: 'Drywall finishing' },
          confidence: 90,
          impact: 'medium',
          requiresApproval: true,
        },
      ],
    }),

    compliance: () => ({
      content:
        '**Compliance Status:**\n\n' +
        '• Expiring COIs in next 30 days: **2** (Acme Concrete on April 12, Metro Electric on April 20)\n' +
        '• Certified payroll submissions: All current through last week\n' +
        '• Davis Bacon compliance: All wage rates verified, no discrepancies found\n' +
        '• Lien waivers: 3 outstanding from February payment cycle\n\n' +
        'Priority: Follow up on the 2 expiring insurance certificates. Work cannot proceed without current COIs.',
      suggestedActions: [
        {
          id: `action-${Date.now()}-5`,
          domain: 'compliance',
          description: 'Send COI renewal reminder to Acme Concrete (expires April 12)',
          tool: 'flag_expiring_cois',
          input: { company: 'Acme Concrete', expiry: '2026-04-12' },
          confidence: 98,
          impact: 'high',
          requiresApproval: true,
        },
      ],
    }),

    document: () => ({
      content:
        '**Document Status:**\n\n' +
        '• Total project documents: **1,847**\n' +
        '• Pending RFI responses: **6** (3 overdue)\n' +
        '• Drawing revisions this month: **12** (4 ASI, 8 shop drawing updates)\n' +
        '• Spec sections referenced in open RFIs: Divisions 03, 05, 23, 26\n\n' +
        'The most recent ASI (ASI-007) impacts the curtain wall detail at the south elevation. This cross references with RFI-004 regarding structural connections. I recommend reviewing both together.',
    }),
  }

  return responses[domain]()
}

function generateSynthesis(agents: AgentDomain[], _query: string): string {
  if (agents.length === 3 && agents.includes('schedule') && agents.includes('cost') && agents.includes('safety')) {
    return (
      '**Summary across all domains:**\n\n' +
      'The project is in good shape overall. Schedule is 4 days ahead with 62% completion. Budget is tracking $900K under with a healthy CPI of 1.02. Safety record is excellent with 14 consecutive safe days and EMR of 0.82.\n\n' +
      'Key items to watch: MEP float consumption on the critical path, structural division nearing budget cap, and 3 open corrective actions from near-miss reports. None of these are critical yet, but they warrant attention this week.'
    )
  }

  return `I have gathered insights from ${agents.map((a) => SPECIALIST_AGENTS[a].shortName).join(', ')}. Review each agent's analysis above for the full picture.`
}
