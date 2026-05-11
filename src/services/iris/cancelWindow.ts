// ────────────────────────────────────────────────────────────────────────────
// cancelWindow — pure timing logic for the 60-second auto-execute cancel UX
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md
//
// The race condition the spec flags as Risk #5 ("cancel-arrives-at-59.9s vs
// 60.1s — the cancel must win below 60s, the executor wins above") is the
// reason the timing logic lives in a pure module. The React hook + the
// edge-fn worker both consume this module — they MUST agree on the cutoff.

export const CANCEL_WINDOW_DURATION_MS = 60_000 // 60 seconds, per spec

export type CancelWindowState =
  | { status: 'pending'; ms_remaining: number }
  | { status: 'committed' }
  | { status: 'cancelled'; reason?: string }

export interface CancelWindowInput {
  /** When the executor decision was made (ISO string or epoch ms). */
  decided_at: string | number
  /** Optional explicit cancel event timestamp. */
  cancelled_at?: string | number | null
  /** "now" passed in by the caller — allows deterministic testing. */
  now: number
}

function toEpochMs(value: string | number): number {
  return typeof value === 'number' ? value : new Date(value).getTime()
}

export function evaluateCancelWindow(input: CancelWindowInput): CancelWindowState {
  const decided = toEpochMs(input.decided_at)
  const deadline = decided + CANCEL_WINDOW_DURATION_MS

  if (input.cancelled_at != null) {
    const cancelTs = toEpochMs(input.cancelled_at)
    // Cancel wins ONLY if it strictly arrives before the 60s deadline.
    // At exactly the deadline (cancelTs === deadline) the executor commits —
    // this is the spec's tie-breaker (deterministic + executor-favoring).
    if (cancelTs < deadline) {
      return { status: 'cancelled' }
    }
    return { status: 'committed' }
  }

  if (input.now >= deadline) {
    return { status: 'committed' }
  }
  return { status: 'pending', ms_remaining: deadline - input.now }
}

/**
 * The cancel handler. Returns the state we should write to
 * `executor_runs.was_human_cancelled` given a cancel attempt at the given
 * time. Returns null if the attempt was too late (the executor already
 * committed).
 */
export function applyCancel(input: { decided_at: string | number; cancel_attempt_at: number }):
  | { applied: true; cancelled_at: number }
  | { applied: false; reason: 'past_deadline' } {
  const decided = toEpochMs(input.decided_at)
  const deadline = decided + CANCEL_WINDOW_DURATION_MS
  if (input.cancel_attempt_at < deadline) {
    return { applied: true, cancelled_at: input.cancel_attempt_at }
  }
  return { applied: false, reason: 'past_deadline' }
}
