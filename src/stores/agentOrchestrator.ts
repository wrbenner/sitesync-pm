import { create } from 'zustand'
import type {
  AgentDomain,
  AgentConversationMessage,
  AgentState,
  AgentStatus,
  BatchAction,
  ActionApprovalStatus,
  OrchestratorResponse,
  IntentClassification,
} from '../types/agents'
import { AGENT_DOMAINS, SPECIALIST_AGENTS } from '../types/agents'

// ── Agent Orchestrator Store ──────────────────────────────────
// Central state management for multi-agent conversations,
// routing, batch actions, and agent lifecycle.

interface AgentOrchestratorState {
  // Conversation
  messages: AgentConversationMessage[]
  isProcessing: boolean
  activeAgents: AgentDomain[] // Which agents are currently responding
  lastIntent: IntentClassification | null
  error: string | null

  // Agent registry
  agentStates: Record<AgentDomain, AgentState>

  // Batch actions (human in the loop)
  pendingBatch: BatchAction | null
  actionHistory: BatchAction[]

  // Input
  input: string
  setInput: (val: string) => void

  // Conversation actions
  addUserMessage: (content: string) => AgentConversationMessage
  addCoordinatorMessage: (content: string, routingInfo?: IntentClassification) => void
  addAgentMessage: (
    domain: AgentDomain,
    content: string,
    extras?: Partial<Pick<AgentConversationMessage, 'toolCalls' | 'suggestedActions' | 'entityRefs' | 'generativeBlocks' | 'handoff'>>
  ) => void
  setActiveAgents: (agents: AgentDomain[]) => void
  setProcessing: (val: boolean) => void
  setLastIntent: (intent: IntentClassification) => void
  setError: (err: string | null) => void
  clearMessages: () => void

  // Handle full orchestrator response from edge function
  handleOrchestratorResponse: (response: OrchestratorResponse) => void

  // Batch actions
  setPendingBatch: (batch: BatchAction | null) => void
  approveAction: (actionId: string) => void
  rejectAction: (actionId: string) => void
  approveAllPending: () => void
  rejectAllPending: () => void

  // Agent lifecycle
  setAgentStatus: (domain: AgentDomain, status: AgentStatus) => void
  incrementAgentActions: (domain: AgentDomain, approved: boolean) => void
}

function createInitialAgentState(domain: AgentDomain): AgentState {
  return {
    domain,
    status: 'active',
    totalActions: 0,
    approvedActions: 0,
    rejectedActions: 0,
    averageConfidence: 0,
    activeConversations: 0,
  }
}

function createInitialAgentStates(): Record<AgentDomain, AgentState> {
  const states = {} as Record<AgentDomain, AgentState>
  for (const domain of AGENT_DOMAINS) {
    states[domain] = createInitialAgentState(domain)
  }
  return states
}

export const useAgentOrchestrator = create<AgentOrchestratorState>()((set, get) => ({
  messages: [],
  isProcessing: false,
  activeAgents: [],
  lastIntent: null,
  error: null,
  agentStates: createInitialAgentStates(),
  pendingBatch: null,
  actionHistory: [],
  input: '',

  setInput: (val) => set({ input: val }),

  addUserMessage: (content) => {
    // BUG-M10 FIX: crypto.randomUUID() avoids ID collisions when multiple
    // messages are created in the same millisecond.
    const msg: AgentConversationMessage = {
      id: `msg-${crypto.randomUUID()}-user`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    set((s) => ({ messages: [...s.messages, msg] }))
    return msg
  },

  addCoordinatorMessage: (content, routingInfo) => {
    const msg: AgentConversationMessage = {
      id: `msg-${crypto.randomUUID()}-coord`,
      role: 'coordinator',
      content,
      timestamp: new Date(),
      routingInfo: routingInfo
        ? {
            intent: routingInfo.intent,
            targetAgents: routingInfo.targetAgents,
            reasoning: routingInfo.reasoning,
          }
        : undefined,
    }
    set((s) => ({ messages: [...s.messages, msg] }))
  },

  addAgentMessage: (domain, content, extras) => {
    const identity = SPECIALIST_AGENTS[domain]
    const msg: AgentConversationMessage = {
      id: `msg-${crypto.randomUUID()}-${domain}`,
      role: 'agent',
      content,
      timestamp: new Date(),
      agentDomain: domain,
      agentName: identity.name,
      ...extras,
    }
    set((s) => ({ messages: [...s.messages, msg] }))
  },

  setActiveAgents: (agents) => set({ activeAgents: agents }),
  setProcessing: (val) => set({ isProcessing: val }),
  setLastIntent: (intent) => set({ lastIntent: intent }),
  setError: (err) => set({ error: err }),

  clearMessages: () =>
    set({
      messages: [],
      activeAgents: [],
      lastIntent: null,
      pendingBatch: null,
      error: null,
    }),

  handleOrchestratorResponse: (response) => {
    const { messages: newMessages, pendingActions, metadata } = response

    set((s) => {
      const updatedMessages = [...s.messages, ...newMessages]

      // Create batch if there are pending actions
      let pendingBatch = s.pendingBatch
      if (pendingActions.length > 0) {
        pendingBatch = {
          id: `batch-${crypto.randomUUID()}`,
          actions: pendingActions,
          status: 'pending',
          createdAt: new Date(),
        }
      }

      return {
        messages: updatedMessages,
        activeAgents: [],
        isProcessing: false,
        lastIntent: metadata.intent,
        pendingBatch,
      }
    })
  },

  setPendingBatch: (batch) => set({ pendingBatch: batch }),

  approveAction: (actionId) => {
    set((s) => {
      if (!s.pendingBatch) return s
      const action = s.pendingBatch.actions.find((a) => a.id === actionId)
      if (!action) return s

      // Move to approved — actual execution happens via the hook
      const remainingActions = s.pendingBatch.actions.filter((a) => a.id !== actionId)
      const updatedBatch: BatchAction | null =
        remainingActions.length > 0
          ? { ...s.pendingBatch, actions: remainingActions }
          : null

      // Track in agent state
      const agentStates = { ...s.agentStates }
      const agentState = agentStates[action.domain]
      agentStates[action.domain] = {
        ...agentState,
        totalActions: agentState.totalActions + 1,
        approvedActions: agentState.approvedActions + 1,
        lastActivity: new Date(),
      }

      return {
        pendingBatch: updatedBatch,
        agentStates,
        actionHistory: [
          ...s.actionHistory,
          {
            id: `resolved-${crypto.randomUUID()}`,
            actions: [action],
            status: 'approved' as ActionApprovalStatus,
            createdAt: s.pendingBatch.createdAt,
            resolvedAt: new Date(),
          },
        ],
      }
    })
  },

  rejectAction: (actionId) => {
    set((s) => {
      if (!s.pendingBatch) return s
      const action = s.pendingBatch.actions.find((a) => a.id === actionId)
      if (!action) return s

      const remainingActions = s.pendingBatch.actions.filter((a) => a.id !== actionId)
      const updatedBatch: BatchAction | null =
        remainingActions.length > 0
          ? { ...s.pendingBatch, actions: remainingActions }
          : null

      const agentStates = { ...s.agentStates }
      const agentState = agentStates[action.domain]
      agentStates[action.domain] = {
        ...agentState,
        totalActions: agentState.totalActions + 1,
        rejectedActions: agentState.rejectedActions + 1,
        lastActivity: new Date(),
      }

      return { pendingBatch: updatedBatch, agentStates }
    })
  },

  approveAllPending: () => {
    const { pendingBatch } = get()
    if (!pendingBatch) return
    // BUG-H23 FIX: Copy the action IDs up front — approveAction mutates
    // pendingBatch.actions via set(), and iterating the live array would skip entries.
    const ids = pendingBatch.actions.map((a) => a.id)
    for (const id of ids) {
      get().approveAction(id)
    }
  },

  rejectAllPending: () => {
    const { pendingBatch } = get()
    if (!pendingBatch) return
    // BUG-H23 FIX: See approveAllPending above.
    const ids = pendingBatch.actions.map((a) => a.id)
    for (const id of ids) {
      get().rejectAction(id)
    }
  },

  setAgentStatus: (domain, status) => {
    set((s) => ({
      agentStates: {
        ...s.agentStates,
        [domain]: { ...s.agentStates[domain], status },
      },
    }))
  },

  incrementAgentActions: (domain, approved) => {
    set((s) => {
      const state = s.agentStates[domain]
      return {
        agentStates: {
          ...s.agentStates,
          [domain]: {
            ...state,
            totalActions: state.totalActions + 1,
            approvedActions: approved ? state.approvedActions + 1 : state.approvedActions,
            rejectedActions: approved ? state.rejectedActions : state.rejectedActions + 1,
            lastActivity: new Date(),
          },
        },
      }
    })
  },
}))
