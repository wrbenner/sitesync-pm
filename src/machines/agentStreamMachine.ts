// Agent Stream State Machine (XState v5)
// Manages the lifecycle of a streaming agent execution session.
// States: idle → streaming → (awaiting_approval ↔ streaming) → completed | error

import { setup, assign } from 'xstate'
import type { AgentStreamEventType } from '../schemas/agentStream'

// ── Types ────────────────────────────────────────────────

export type AgentStreamState = 'idle' | 'streaming' | 'awaiting_approval' | 'completed' | 'error'

export const agentStreamMachine = setup({
  types: {
    context: {} as {
      sessionId: string
      projectId: string
      events: AgentStreamEventType[]
      currentAgentState: string
      activeApprovalId: string | null
      error: string | null
    },
    events: {} as
      | { type: 'START'; sessionId: string; projectId: string }
      | { type: 'EVENT_RECEIVED'; event: AgentStreamEventType }
      | { type: 'APPROVAL_REQUIRED'; actionId: string }
      | { type: 'APPROVE'; actionId: string }
      | { type: 'REJECT'; actionId: string; reason?: string }
      | { type: 'COMPLETE' }
      | { type: 'ERROR'; message: string }
      | { type: 'RETRY' }
      | { type: 'RESET' },
  },
}).createMachine({
  id: 'agentStream',
  initial: 'idle',
  context: {
    sessionId: '',
    projectId: '',
    events: [],
    currentAgentState: 'idle',
    activeApprovalId: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'streaming',
          actions: assign({
            sessionId: ({ event }) => event.sessionId,
            projectId: ({ event }) => event.projectId,
            events: () => [],
            currentAgentState: () => 'initializing',
            error: () => null,
          }),
        },
      },
    },

    streaming: {
      on: {
        EVENT_RECEIVED: {
          actions: assign({
            events: ({ context, event }) => [...context.events, event.event],
            currentAgentState: ({ context, event }) => {
              if (event.event.type === 'state_snapshot') {
                return event.event.data.state
              }
              return context.currentAgentState
            },
          }),
        },
        APPROVAL_REQUIRED: {
          target: 'awaiting_approval',
          actions: assign({
            activeApprovalId: ({ event }) => event.actionId,
            currentAgentState: () => 'awaiting_approval',
          }),
        },
        COMPLETE: {
          target: 'completed',
          actions: assign({
            currentAgentState: () => 'completed',
          }),
        },
        ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.message,
            currentAgentState: () => 'error',
          }),
        },
      },
    },

    awaiting_approval: {
      on: {
        APPROVE: {
          target: 'streaming',
          actions: assign({
            activeApprovalId: () => null,
            currentAgentState: () => 'executing',
          }),
        },
        REJECT: {
          target: 'streaming',
          actions: assign({
            activeApprovalId: () => null,
            currentAgentState: () => 'executing',
          }),
        },
      },
    },

    completed: {
      type: 'final',
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            events: () => [],
            currentAgentState: () => 'idle',
            activeApprovalId: () => null,
            error: () => null,
          }),
        },
      },
    },

    error: {
      on: {
        RETRY: {
          target: 'idle',
          actions: assign({
            error: () => null,
            currentAgentState: () => 'idle',
          }),
        },
        RESET: {
          target: 'idle',
          actions: assign({
            events: () => [],
            currentAgentState: () => 'idle',
            activeApprovalId: () => null,
            error: () => null,
          }),
        },
      },
    },
  },
})
