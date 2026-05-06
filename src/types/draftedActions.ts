/**
 * Drafted Actions — the type substrate for "Iris that ACTS, not chats."
 *
 * Iris writes a row in `drafted_actions` instead of mutating production
 * data directly. The user reviews the draft in the Iris Inbox, approves
 * or rejects it. On approve, an executor function carries out the action
 * and audit-logs it.
 *
 * Mirrors the Postgres table created by migration
 * `20260427000010_drafted_actions.sql`. When you add a new action_type:
 *
 *   1. Add the discriminant string to `DraftedActionType`
 *   2. Add the typed payload to `DraftedActionPayloadByType`
 *   3. Add the executor function in `services/iris/executors/`
 *   4. Register the executor in `services/iris/executeAction.ts`
 *
 * Don't widen DraftedAction's payload to `unknown` — the discriminated
 * union is what makes the whole approval flow type-safe.
 */

/** Stable identifier for the kind of action Iris drafted. */
export type DraftedActionType =
  | 'rfi.draft'
  | 'daily_log.draft'
  | 'pay_app.draft'
  | 'punch_item.draft'
  | 'schedule.resequence'
  | 'submittal.transmittal_draft'

/** Lifecycle states. Mirrors the SQL CHECK constraint exactly. */
export type DraftedActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'

/**
 * A citation tells the user *why* Iris drafted this. Could be an RFI it
 * referenced, a coordinate on a drawing, a quote from a daily log, etc.
 */
export interface DraftedActionCitation {
  kind:
    | 'drawing_coordinate'
    | 'rfi_reference'
    | 'daily_log_excerpt'
    | 'photo_observation'
    | 'spec_reference'
    | 'schedule_phase'
    | 'budget_line'
    | 'change_order'
  /** Human-readable label, e.g. "Drawing E-2 @ column line 7". */
  label: string
  /** Stable identifier for the cited resource. */
  ref?: string
  /** Direct quote / extracted text from the citation. */
  snippet?: string
  /** For drawing citations: pixel/normalized coordinates. */
  drawing_id?: string
  x?: number
  y?: number
}

// ── Per-action-type payload shapes ────────────────────────────────────

export interface DraftedRfiPayload {
  title: string
  description: string
  question?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  discipline?: string
  drawing_id?: string
  spec_section?: string
  due_date?: string
  ball_in_court?: string
  assigned_to?: string
}

export interface DraftedDailyLogPayload {
  date: string
  notes: string
  weather?: { condition: string; high_temp?: number; low_temp?: number; precipitation?: string | null }
  manpower_count?: number
  trades?: Array<{ trade: string; count: number }>
  photo_ids?: string[]
}

export interface DraftedPayAppPayload {
  application_number: number
  period_to: string
  period_from: string
  total_completed_and_stored: number
  retainage: number
  amount_due: number
  line_items: Array<{
    item_no: string
    description: string
    scheduled_value: number
    work_completed_this_period: number
    materials_stored: number
    percent_complete: number
  }>
}

export interface DraftedPunchItemPayload {
  title: string
  description: string
  trade?: string
  location?: string
  drawing_id?: string
  x?: number
  y?: number
  photo_url?: string
  severity?: 'low' | 'medium' | 'high'
}

export interface DraftedScheduleResequencePayload {
  /** Phase IDs that should run in parallel instead of sequence. */
  parallelize_pairs: Array<[string, string]>
  /** Optional new finish dates for affected phases. */
  finish_overrides?: Array<{ phase_id: string; finish: string }>
  /** Computed days saved. */
  days_recovered: number
}

export interface DraftedSubmittalTransmittalPayload {
  submittal_id: string
  to_email: string[]
  cc_email?: string[]
  message: string
  include_attachments: boolean
}

/** Discriminated map of action_type → payload shape. */
export interface DraftedActionPayloadByType {
  'rfi.draft': DraftedRfiPayload
  'daily_log.draft': DraftedDailyLogPayload
  'pay_app.draft': DraftedPayAppPayload
  'punch_item.draft': DraftedPunchItemPayload
  'schedule.resequence': DraftedScheduleResequencePayload
  'submittal.transmittal_draft': DraftedSubmittalTransmittalPayload
}

// ── Row types ─────────────────────────────────────────────────────────

interface DraftedActionBase {
  id: string
  project_id: string
  title: string
  summary: string | null
  citations: DraftedActionCitation[]
  confidence: number
  status: DraftedActionStatus
  drafted_by: string
  draft_reason: string | null
  related_resource_type: string | null
  related_resource_id: string | null
  executed_resource_type: string | null
  executed_resource_id: string | null
  execution_result: Record<string, unknown> | null
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  executed_at: string | null
  created_at: string
  updated_at: string
}

/** Strongly-typed drafted action — payload narrows by action_type. */
export type DraftedAction =
  {
    [K in DraftedActionType]: DraftedActionBase & {
      action_type: K
      payload: DraftedActionPayloadByType[K]
    }
  }[DraftedActionType]

/** Helper: payload type for a given action_type. */
export type PayloadFor<T extends DraftedActionType> = DraftedActionPayloadByType[T]

// ── Insert helpers ────────────────────────────────────────────────────

/** Shape used when Iris writes a new draft. */
export type DraftedActionInsert<T extends DraftedActionType = DraftedActionType> = {
  project_id: string
  action_type: T
  title: string
  summary?: string
  payload: PayloadFor<T>
  citations?: DraftedActionCitation[]
  confidence?: number
  drafted_by: string
  draft_reason?: string
  related_resource_type?: string
  related_resource_id?: string
}

/** Shape used when the user makes a decision. */
export interface DraftedActionDecision {
  id: string
  status: Extract<DraftedActionStatus, 'approved' | 'rejected'>
  decision_note?: string
}
