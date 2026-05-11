// ────────────────────────────────────────────────────────────────────────────
// autoExecute — eligibility decision for the hardened-executor opt-in path
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md
//
// Pure function. Given the org's `auto_execute_opt_in` flag + the persona's
// auto_action_threshold + the executor's confidence_floor + the proposed
// confidence, returns whether the executor should live-commit (with 60s
// cancel window) OR run shadow-mode (logged, not committed).
//
// Both the React UI and the edge-fn worker call this. Single source of
// truth for the eligibility decision.

import { PERSONAS, type PersonaConfig } from './personas'
import type { ExecutorDecl } from './executors/types'
import type { PersonaSlug } from './types/context'

export type AutoExecuteDecision =
  | { mode: 'live'; cancel_window_ms: 60_000 }
  | { mode: 'shadow'; reasons: readonly string[] }

export interface AutoExecuteInput {
  /** Set on the org row. */
  org_auto_execute_opt_in: boolean
  /** Resolved persona for the user invoking this. */
  persona: PersonaSlug
  /**
   * The hardened executor's declaration. Generic position is widened to `any`
   * here so callers can pass any concrete `ExecutorDecl<TInput>` without the
   * variance mismatch TypeScript would otherwise raise on `ExecutorDecl<unknown>`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executor: ExecutorDecl<any>
  /** Specialist-provided confidence on the proposed write (0..1). */
  confidence: number
}

export function decideAutoExecute(input: AutoExecuteInput): AutoExecuteDecision {
  const reasons: string[] = []
  if (!input.org_auto_execute_opt_in) {
    reasons.push('org.auto_execute_opt_in is FALSE')
  }
  const persona: PersonaConfig = PERSONAS[input.persona]
  if (persona.auto_action_threshold >= 1.0) {
    reasons.push(`persona '${input.persona}' is never-auto (auto_action_threshold = 1.0)`)
  } else if (input.confidence < persona.auto_action_threshold) {
    reasons.push(
      `confidence ${input.confidence.toFixed(3)} below persona threshold ${persona.auto_action_threshold.toFixed(3)}`,
    )
  }
  if (input.confidence < input.executor.confidence_floor) {
    reasons.push(
      `confidence ${input.confidence.toFixed(3)} below executor floor ${input.executor.confidence_floor.toFixed(3)}`,
    )
  }
  if (reasons.length === 0) {
    return { mode: 'live', cancel_window_ms: 60_000 }
  }
  return { mode: 'shadow', reasons }
}
