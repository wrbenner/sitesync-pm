// ────────────────────────────────────────────────────────────────────────────
// Hardened-executor contract base
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Executors §)
//      docs/audits/HARDENED_EXECUTORS_SPEC_2026-05-04.md
//      docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md
//
// Every hardened executor exports an `ExecutorDecl` and a `predicate(input)`
// function. The predicate is the deterministic guard: returns `{ ok, reasons }`
// where ok=true means the executor is willing to commit. Auto-execute eligible
// only when ok=true AND confidence >= confidence_floor.

export type ExecutorName = 'rfi-routing' | 'daily-log-compilation' | 'punch-assignment'

export interface ExecutorPredicateResult {
  ok: boolean
  reasons: readonly string[]
}

export interface ExecutorDecl<TInput = unknown> {
  name: ExecutorName
  version: string
  /** Specialist this executor receives output from. */
  specialist: 'drafter' | 'money' | 'schedule' | 'code'
  /** Deterministic gate on the proposed write. */
  predicate: (input: TInput) => ExecutorPredicateResult
  /**
   * Confidence floor for auto-execute eligibility. Below this, the executor
   * runs in shadow mode (logged but not committed). Defaults match the
   * persona auto_action_threshold but the executor can override.
   */
  confidence_floor: number
  /** Blast radius: 'additive' (RFI add) or 'compensable' (with rollback). */
  blast_radius: 'additive' | 'compensable'
  /** Human-readable description used in shadow-mode review logs. */
  description: string
}
