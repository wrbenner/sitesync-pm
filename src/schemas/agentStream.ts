// AG-UI Protocol: Event schemas for streaming agent state to the frontend.
// These define the contract between the agent-orchestrator edge function
// and the AgentStreamPanel UI component.

import { z } from 'zod'

// ── Base Event ───────────────────────────────────────────

const BaseEvent = z.object({
  agent_id: z.string(),
  event_id: z.string(),
  timestamp: z.string(),
  session_id: z.string(),
})

// ── Agent State ──────────────────────────────────────────

export const AgentState = z.enum([
  'initializing',
  'planning',
  'executing',
  'analyzing',
  'calculating',
  'generating',
  'awaiting_approval',
  'completed',
  'error',
])

// ── Event Types ──────────────────────────────────────────

export const StateSnapshotEvent = BaseEvent.extend({
  type: z.literal('state_snapshot'),
  data: z.object({
    state: AgentState,
    description: z.string(),
    progress: z.number().min(0).max(100).optional(),
  }),
})

export const ToolCallStartEvent = BaseEvent.extend({
  type: z.literal('tool_call_start'),
  data: z.object({
    tool_name: z.string(),
    tool_description: z.string(),
    rationale: z.string(),
    estimated_duration_ms: z.number().optional(),
  }),
})

export const ToolCallProgressEvent = BaseEvent.extend({
  type: z.literal('tool_call_progress'),
  data: z.object({
    tool_name: z.string(),
    progress: z.number().min(0).max(100),
    message: z.string(),
  }),
})

export const ToolCallEndEvent = BaseEvent.extend({
  type: z.literal('tool_call_end'),
  data: z.object({
    tool_name: z.string(),
    status: z.enum(['success', 'partial', 'error']),
    duration_ms: z.number(),
    error_message: z.string().optional(),
  }),
})

export const TextMessageEvent = BaseEvent.extend({
  type: z.literal('text_message'),
  data: z.object({
    role: z.enum(['agent', 'coordinator', 'system']),
    content: z.string(),
    streaming: z.boolean().default(false),
  }),
})

export const ApprovalRequestEvent = BaseEvent.extend({
  type: z.literal('approval_request'),
  data: z.object({
    action_id: z.string(),
    action_title: z.string(),
    action_description: z.string(),
    proposed_data: z.record(z.unknown()),
    allowed_responses: z.array(z.enum(['approve', 'reject', 'modify'])).default(['approve', 'reject']),
    timeout_seconds: z.number().optional(),
  }),
})

export const ErrorStreamEvent = BaseEvent.extend({
  type: z.literal('error'),
  data: z.object({
    severity: z.enum(['warning', 'error', 'critical']),
    message: z.string(),
    recovery_action: z.string().optional(),
  }),
})

export const SummaryEvent = BaseEvent.extend({
  type: z.literal('summary'),
  data: z.object({
    title: z.string(),
    actions_taken: z.array(z.string()),
    recommended_next_steps: z.array(z.string()),
  }),
})

// ── Discriminated Union ──────────────────────────────────

export const AgentStreamEvent = z.discriminatedUnion('type', [
  StateSnapshotEvent,
  ToolCallStartEvent,
  ToolCallProgressEvent,
  ToolCallEndEvent,
  TextMessageEvent,
  ApprovalRequestEvent,
  ErrorStreamEvent,
  SummaryEvent,
])

// ── Type Exports ─────────────────────────────────────────

export type AgentStreamEventType = z.infer<typeof AgentStreamEvent>
export type StateSnapshot = z.infer<typeof StateSnapshotEvent>
export type ToolCallStart = z.infer<typeof ToolCallStartEvent>
export type ToolCallProgress = z.infer<typeof ToolCallProgressEvent>
export type ToolCallEnd = z.infer<typeof ToolCallEndEvent>
export type TextMessage = z.infer<typeof TextMessageEvent>
export type ApprovalRequest = z.infer<typeof ApprovalRequestEvent>
export type ErrorStream = z.infer<typeof ErrorStreamEvent>
export type Summary = z.infer<typeof SummaryEvent>
