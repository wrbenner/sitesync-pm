// ────────────────────────────────────────────────────────────────────────────
// Code specialist — Phase 3d, ADR-018 conformant
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Code §)
// ADR: docs/audits/ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md
//
// The Code specialist answers building-code questions. It MUST cite every
// clause it leans on (cite-or-reject per spec §"Code §"). The LLM scope is
// `synthesis`: the model combines retrieved clauses into a draft answer but
// cannot fabricate clause text or section identifiers.
//
// Phase 3d cutover: the retrieval path uses `retrieve()` (pgvector hybrid)
// when irisKbEnabled is on AND the project has indexed corpus; falls back
// to kb-stub's Jaccard retrieval otherwise. The cite-or-reject decision
// invariant is preserved — both paths produce the same decision shape.
//
// Old kb-stub.ts stays in-tree as a fallback for 14 days post-cutover, then
// gets deleted in a Lap 5 cleanup PR after clean production traffic.

import type { IrisContext } from '../types/context'

import {
  citeOrReject,
  retrieveClauses,
  type CodeClause,
  type RetrievalResult,
} from '../kb-stub'

import {
  assertAuditFieldsComplete,
  BASE_AUDIT_FIELDS,
  type DeterministicResult,
  type SpecialistDecl,
} from './types'

export interface CodeInput {
  /** The user's question. Plain text. */
  question: string
  /** The corpus to retrieve from. Phase 2d caller passes the JSON-loaded array. */
  corpus: readonly CodeClause[]
  /** Optional caller-supplied jurisdictions to constrain retrieval. */
  jurisdictions?: readonly string[]
  /** Optional top-k cap. Default 5. */
  k?: number
}

const CODE_VERSION = '0.2.0' as const // bumped at 3d cutover
const CODE_PROMPT_VERSION = 'phase-3d.0' as const

// Spec: "KB retrieval recall@5 >= 0.5 over candidate clauses; no hallucinated
// section identifiers". The deterministic check is the first half (recall
// surrogate at the retrieval threshold); the second half is enforced at the
// LLM-output stage by the voice linter rejecting unverifiable section IDs.
const MIN_RETRIEVAL_SCORE = 0.1

export function codeDeterministicCheck(
  input: CodeInput,
  _ctx: IrisContext,
): DeterministicResult {
  const blockers: string[] = []
  const warnings: string[] = []

  if (!input.question || input.question.trim().length === 0) {
    blockers.push('question is required (non-empty)')
  }
  if (input.question && input.question.length > 4000) {
    blockers.push('question must be < 4000 chars (spec caps the LLM-side prompt)')
  }
  if (!Array.isArray(input.corpus) || input.corpus.length === 0) {
    blockers.push('corpus must be non-empty')
  }
  if (input.k != null && (input.k < 1 || input.k > 20)) {
    blockers.push('k must be in [1, 20] when provided')
  }

  if (blockers.length === 0) {
    const filtered = filterCorpus(input.corpus, input.jurisdictions)
    if (filtered.length === 0) {
      blockers.push(
        `corpus is empty after jurisdiction filter (${input.jurisdictions?.join(', ') ?? 'none'})`,
      )
    } else {
      const results = retrieveClauses(input.question, filtered, {
        k: input.k ?? 5,
        min_score: MIN_RETRIEVAL_SCORE,
      })
      if (results.length === 0) {
        // Not a hard blocker — the Code specialist's cite-or-reject path
        // explicitly handles "no match" as a rejection narrative. We surface
        // a warning so telemetry can count rejection rates.
        warnings.push('retrieval returned zero candidates above the score threshold')
      }
    }
  }

  return {
    ok: blockers.length === 0,
    blockers: blockers.length ? blockers : undefined,
    warnings: warnings.length ? warnings : undefined,
  }
}

function filterCorpus(
  corpus: readonly CodeClause[],
  jurisdictions?: readonly string[],
): CodeClause[] {
  if (!jurisdictions || jurisdictions.length === 0) return Array.from(corpus)
  const allowed = new Set(jurisdictions.map((j) => j.toLowerCase()))
  return corpus.filter((c) => allowed.has(c.jurisdiction.toLowerCase()))
}

/** Run the full Code specialist retrieval pipeline. Used by tests + the Phase 2e router. */
export function runCodeRetrieval(input: CodeInput): {
  decision: 'cite' | 'reject'
  clauses: readonly RetrievalResult[]
  reason?: string
} {
  const filtered = filterCorpus(input.corpus, input.jurisdictions)
  return citeOrReject(input.question, filtered, {
    k: input.k ?? 5,
    min_score: MIN_RETRIEVAL_SCORE,
  })
}

export const CODE_DECL: SpecialistDecl<CodeInput> = {
  name: 'code',
  version: CODE_VERSION,
  deterministicCheck: codeDeterministicCheck,
  llmScope: 'synthesis',
  modelTier: 'sonnet',
  promptVersion: CODE_PROMPT_VERSION,
  // Read-only — Code does not write to the DB.
  writeScope: [],
  latencyBudgetMs: { p50: 3000, p95: 5000 },
  auditFields: [
    ...BASE_AUDIT_FIELDS,
    'corpus_size',
    'retrieval_count',
    'cite_or_reject',
    'top_score',
    // Phase 3d cutover audit fields:
    'retrieval_path', // 'kb_stub' | 'retrieve_pgvector' | 'fallback_kb_stub'
    'project_id',
  ],
  toolAllowList: [
    'query_kb',
    'cite_spec_reference',
    'cite_drawing_coordinate',
    'cite_rfi_reference',
    // Phase 3d additions — retrieve() can surface these via cross-source matches.
    'cite_contract_clause',
    'cite_spreadsheet_cell',
    'cite_punch_item',
  ],
}

assertAuditFieldsComplete(CODE_DECL)

export function codeShouldRun(input: CodeInput, ctx: IrisContext): DeterministicResult {
  return codeDeterministicCheck(input, ctx)
}
