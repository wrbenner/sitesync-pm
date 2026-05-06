/**
 * Walk-Through Mode — typed substrate.
 *
 * Mirrors the Postgres tables created by:
 *   • supabase/migrations/20260430150000_walkthrough_sessions.sql
 *   • supabase/migrations/20260430150001_walkthrough_captures.sql
 *
 * Discriminated unions follow the same pattern as src/types/draftedActions.ts —
 * keep `status` narrowable and never widen `parsed` to `unknown`. The whole
 * approval flow leans on these literal types staying tight.
 *
 * Field-naming convention: snake_case on the wire (matches Postgres),
 * with TypeScript readers using snake_case as well so we don't drift from
 * the rest of the project's database row types.
 */

// ── Lifecycle states ────────────────────────────────────────────

/** Session lifecycle. Mirrors the SQL CHECK constraint exactly. */
export type WalkthroughSessionStatus =
  | 'active'      // walk in progress; captures still landing
  | 'reviewing'   // walk ended; PM is approving / rejecting drafts
  | 'finalized'   // PM finished review and (optionally) generated the PDF

/**
 * Capture lifecycle. Each transition is a deliberate UX moment:
 *
 *   pending_transcription → audio uploaded, Whisper not back yet (~2s)
 *   pending_review        → parsed; ready for the PM to approve / reject
 *   approved              → PM approved; an actual punch_items row was created
 *   rejected              → PM rejected; nothing else happens
 *   deferred              → "decide later" — keep this in the queue
 *   failed                → transcription / parsing failed; UI prompts manual entry
 */
export type WalkthroughCaptureStatus =
  | 'pending_transcription'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'deferred'
  | 'failed'

/** Severity buckets — also re-used as the punch_items.severity literal. */
export type WalkthroughSeverity = 'low' | 'medium' | 'high' | 'critical'

// ── Parsed capture (the LLM-structured shape) ───────────────────

/**
 * What we extract from a captured transcript + photo. Lives in
 * walkthrough_captures.parsed (jsonb). Keep this narrow so the LLM can't
 * smuggle arbitrary keys past us.
 */
export interface ParsedCapture {
  /** Imperative one-liner: "Touch up scratched paint near elevator door". */
  title: string
  /** Long-form. May include the verbatim transcript snippet. */
  description: string
  /** Trade keyword extracted from transcript (lowercased). */
  trade?: string
  /** Severity inferred from keyword bank in severityClassifier.ts. */
  severity: WalkthroughSeverity
  /** Free-text room/location hint from the transcript ("east elevator lobby"). */
  location_hint?: string
  /** UUID of a subcontractor we'd auto-assign if the PM approves. */
  suggested_subcontractor_id?: string
  /**
   * Special intent flag: when true, this capture is a *correction* to
   * the previous one ("scratch that, the one I just said is wrong").
   * The UI hides this from the queue and applies it to the prior capture.
   */
  modify_previous: boolean
}

// ── Row types ───────────────────────────────────────────────────

/** A single capture during a walkthrough — one press-and-hold + photo. */
export interface WalkthroughCapture {
  id: string
  session_id: string
  project_id: string
  captured_at: string
  audio_url: string | null
  photo_url: string | null
  transcript: string | null
  transcript_confidence: number | null
  /** Null while pending_transcription. Populated once Whisper + Sonnet run. */
  parsed: ParsedCapture | null
  gps_lat: number | null
  gps_lon: number | null
  drawing_id: string | null
  drawing_x: number | null
  drawing_y: number | null
  status: WalkthroughCaptureStatus
  /** punch_items.id once status === 'approved'. Null otherwise. */
  executed_punch_item_id: string | null
  created_at: string
  updated_at: string
}

/** Owner-rep / architect attendee row in the session metadata. */
export interface WalkthroughAttendee {
  name: string
  role: string
  email?: string
}

/** Top-level walkthrough session. Holds aggregate counts + PDF reference. */
export interface WalkthroughSession {
  id: string
  project_id: string
  started_by_user: string
  started_at: string
  ended_at: string | null
  attendees: WalkthroughAttendee[]
  total_drafted: number
  total_approved: number
  total_rejected: number
  pdf_export_url: string | null
  pdf_content_hash: string | null
  status: WalkthroughSessionStatus
  created_at: string
  updated_at: string
}

// ── Insert helpers ──────────────────────────────────────────────

/** Shape used when starting a new session. */
export interface WalkthroughSessionInsert {
  project_id: string
  started_by_user: string
  attendees?: WalkthroughAttendee[]
}

/** Shape used when pushing a fresh capture during a walk. */
export interface WalkthroughCaptureInsert {
  session_id: string
  project_id: string
  audio_storage_path?: string
  photo_storage_path?: string
  gps_lat?: number
  gps_lon?: number
  // Initial status is always pending_transcription; we never let a caller
  // pick the starting state, the migration default does it.
}
