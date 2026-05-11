// ────────────────────────────────────────────────────────────────────────────
// Specialist boundary contract — ADR-018
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md
// Phase 2 spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md
//
// Every specialist (Drafter / Money / Schedule / Code, plus future Field +
// Historian) exports a typed `SpecialistDecl`. The declaration is the
// machine-readable safety surface — CI lint enforces conformance.
//
// Rules (also enforced by lint in a follow-up CI rule):
//   1. Specialists never write to the database directly. Writes flow through
//      named executors in src/services/iris/executors/*.
//   2. `deterministicCheck` runs first, always. ok=false short-circuits the
//      LLM path.
//   3. Money math through src/types/money.ts only.
//   4. `toolAllowList` is closed. New tool requires version bump + ADR.
//   5. Every invocation appends an `iris_actions` audit row.
//   6. Latency budget enforced runtime-side; declared here.
//   7. No specialist invokes another specialist directly — go through router.

import type { IrisContext } from '../types/context'

export type SpecialistName = 'drafter' | 'money' | 'schedule' | 'code' | 'field' | 'historian'

export type LlmScope =
  | 'narrative_only' // LLM writes narrative wrapper around deterministic facts
  | 'synthesis' // LLM combines deterministic signals into a draft
  | 'generative' // LLM authors the artifact body
  | 'none' // No LLM call (Historian retrieval-only)

export type ModelTier = 'haiku' | 'sonnet' | 'opus'

export interface DeterministicResult {
  ok: boolean
  blockers?: string[]
  warnings?: string[]
}

export interface WriteScope {
  table: string
  columns: readonly string[]
  conditions?: string // human-readable RLS-style condition (lint reads this)
}

export type ToolName = string // closed per specialist; full enum lives in tools.ts

export interface LatencyBudget {
  p50: number // ms
  p95: number // ms
}

export interface SpecialistDecl<TInput = unknown> {
  name: SpecialistName
  version: string // semver. CI bump-required on contract change.

  /** Deterministic gate — never LLM-evaluated. Runs first; ok=false short-circuits. */
  deterministicCheck: (input: TInput, ctx: IrisContext) => DeterministicResult

  llmScope: LlmScope
  modelTier: ModelTier
  promptVersion: string // ratchet alongside golden re-runs

  /** Exhaustive write list. Empty = read-only. Writes flow through executors. */
  writeScope: readonly WriteScope[]

  latencyBudgetMs: LatencyBudget

  /** Fields the specialist appends to iris_actions on every invocation. */
  auditFields: readonly string[]

  /** Closed tool list. Adding a tool requires version bump + ADR. */
  toolAllowList: readonly ToolName[]
}

// At minimum every specialist's audit row carries these. Specific specialists
// add to this list via their `auditFields` declaration.
export const BASE_AUDIT_FIELDS = [
  'specialist_name',
  'version',
  'model_tier',
  'deterministic_check_passed',
  'llm_call_count',
  'llm_total_tokens',
  'latency_ms',
  'executor_invoked',
  'executor_outcome',
] as const

export type BaseAuditField = (typeof BASE_AUDIT_FIELDS)[number]

/**
 * Helper for specialist authors — assert that the `auditFields` declaration
 * includes the minimum base set. Used at module-load time in each specialist
 * file so missing fields fail loudly during import.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertAuditFieldsComplete(decl: SpecialistDecl<any>): void {
  const declared = new Set(decl.auditFields)
  const missing = BASE_AUDIT_FIELDS.filter((f) => !declared.has(f))
  if (missing.length > 0) {
    throw new Error(
      `[specialist:${decl.name}] auditFields missing required base fields: ${missing.join(', ')}`,
    )
  }
}
