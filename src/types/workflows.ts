/**
 * Workflow types — visual workflow builder + deterministic runner.
 *
 * A WorkflowDefinition is a versioned, immutable graph of steps. Items in
 * flight pin to the version effective at start; editing a workflow creates
 * a new version while old versions stay alive for already-in-flight items.
 *
 * Mirrors the Postgres tables created by migration
 * `20260503120000_workflow_definitions.sql`.
 */

export type WorkflowEntityType =
  | 'rfi'
  | 'submittal'
  | 'change_order'
  | 'punch_item'
  | 'pay_app'
  | 'inspection'
  | 'daily_log'

/** A step is a node in the workflow graph. Terminal steps have no transitions. */
export interface WorkflowStep {
  id: string
  name: string
  /** Roles allowed to trigger transitions OUT of this step. */
  required_role?: string[]
  /** Outgoing transitions, in priority order. First match wins. */
  transitions: WorkflowTransitionDef[]
  /** Optional: emit a notification of this severity when entering this step. */
  notify_severity?: 'info' | 'normal' | 'critical'
  /** Marks this as a terminal/end step. */
  terminal?: boolean
}

export interface WorkflowTransitionDef {
  /** When this expression evaluates true (or is omitted), take this transition. */
  when?: string
  /** Target step id. Must exist in the same workflow. */
  to: string
  /** Required role(s) to take this transition. Empty = any role. */
  required_role?: string[]
  /** Event types that match (e.g. 'submit', 'approve', 'reject'). Empty = any. */
  on_event?: string[]
}

export interface WorkflowDefinition {
  id: string
  project_id: string
  entity_type: WorkflowEntityType
  version: number
  name: string
  start_step: string
  steps: WorkflowStep[]
  created_at?: string
  archived_at?: string | null
}

// ── Runtime types ─────────────────────────────────────────────────────

export interface EntityState {
  current_step: string
  /** Free-form payload — the runner reads dotted paths off this for `when` expressions. */
  entity: Record<string, unknown>
  /** Currently-pinned definition id+version (set on workflow start). */
  pinned_definition_id: string
  pinned_version: number
}

export type WorkflowEvent =
  | { type: 'submit'; actor_user_id: string; actor_role: string; payload?: Record<string, unknown> }
  | { type: 'approve'; actor_user_id: string; actor_role: string; payload?: Record<string, unknown> }
  | { type: 'reject'; actor_user_id: string; actor_role: string; payload?: Record<string, unknown>; reason?: string }
  | { type: 'comment'; actor_user_id: string; actor_role: string; payload?: Record<string, unknown> }
  | { type: 'custom'; name: string; actor_user_id: string; actor_role: string; payload?: Record<string, unknown> }

export interface WorkflowTransition {
  /** Step the entity moved into. */
  next_step: string
  /** True if next_step.terminal === true. */
  terminal: boolean
  /** Notify severity if the entered step requested one. */
  notify_severity?: 'info' | 'normal' | 'critical'
  /** Roles required to act on the new step (for the next prompt). */
  next_required_role: string[]
  /** Audit-trail message describing why this transition fired. */
  reason: string
}

// ── Validation result ─────────────────────────────────────────────────

export interface ValidationIssue {
  level: 'error' | 'warning'
  code: string
  message: string
  step_id?: string
  transition_index?: number
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

// ── Persisted run row ─────────────────────────────────────────────────

export interface WorkflowRunHistoryEntry {
  at: string
  event: WorkflowEvent
  from_step: string
  to_step: string
  reason: string
}

export interface WorkflowRunRow {
  id: string
  workflow_definition_id: string
  entity_id: string
  current_step: string
  started_at: string
  completed_at: string | null
  history: WorkflowRunHistoryEntry[]
}
