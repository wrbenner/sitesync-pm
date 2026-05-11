// ────────────────────────────────────────────────────────────────────────────
// Code specialist retrieval cutover - Phase 3d
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md sec 6
//
// New retrieval path for the Code specialist that calls retrieve() (pgvector
// hybrid) instead of the in-memory kb-stub. Same decision shape as
// runCodeRetrieval() so callers can swap with zero contract changes.

import type { CodeInput } from './code'
import type { RetrievalResult } from '../kb-stub'
import { citeOrReject } from '../kb-stub'
import { retrieve } from '../retrieve'
import type { KbChunk } from '../types/retrieval'

const MIN_RETRIEVAL_SCORE = 0.1
const SPEC_SOURCE_TYPES = ['spec_section', 'contract', 'rfi'] as const

export interface CodeCutoverInput extends CodeInput {
  /** Project id is required for retrieve() - refuses to query without scope. */
  project_id: string
  /** Caller's resolved persona. Defaults to 'pm' if unknown. */
  persona?: 'pm' | 'superintendent' | 'foreman' | 'owner_rep' | 'office'
}

export interface CodeRetrievalOutcome {
  decision: 'cite' | 'reject'
  clauses: readonly RetrievalResult[]
  reason?: string
  /** Which path produced this outcome - recorded in audit log. */
  retrieval_path: 'retrieve_pgvector' | 'fallback_kb_stub'
}

/**
 * Cutover entrypoint. Replaces runCodeRetrieval for callers that have a
 * project_id available (the only kind that should be running Code in prod).
 */
export async function runCodeRetrievalViaPgvector(
  input: CodeCutoverInput,
): Promise<CodeRetrievalOutcome> {
  const persona = input.persona ?? 'pm'
  const k = input.k ?? 5

  const result = await retrieve(
    {
      text: input.question,
      project_id: input.project_id,
      persona,
    },
    {
      k,
      min_score: MIN_RETRIEVAL_SCORE,
      source_types: SPEC_SOURCE_TYPES,
      caller_tag: 'code-specialist',
    },
  )

  // Path A: pgvector retrieved something. Cite path.
  if (result.chunks.length > 0) {
    const clauses = result.chunks.map(chunkToRetrievalResult)
    return {
      decision: 'cite',
      clauses,
      retrieval_path: 'retrieve_pgvector',
    }
  }

  // Path B: empty corpus. Fall back to kb-stub so the demo + soft pilot
  // don't hit a regression while the worker pipeline backfills.
  if (result.empty_corpus) {
    const fallback = citeOrReject(input.question, input.corpus, {
      k,
      min_score: MIN_RETRIEVAL_SCORE,
    })
    return {
      decision: fallback.decision,
      clauses: fallback.clauses,
      reason: fallback.reason,
      retrieval_path: 'fallback_kb_stub',
    }
  }

  // Path C: corpus is populated but nothing scored above threshold. Reject.
  return {
    decision: 'reject',
    clauses: [],
    reason: 'pgvector retrieval returned zero candidates above the score threshold',
    retrieval_path: 'retrieve_pgvector',
  }
}

/**
 * Map a KbChunk to the legacy RetrievalResult shape so the Code specialist
 * can keep its existing cite-or-reject output contract.
 */
function chunkToRetrievalResult(chunk: KbChunk): RetrievalResult {
  let clauseId = chunk.source_id
  let section: string | undefined
  if (chunk.source_anchor.kind === 'spec_section') {
    section = chunk.source_anchor.section
    clauseId = `${chunk.source_id}#${section}`
  } else if (chunk.source_anchor.kind === 'contract') {
    section = chunk.source_anchor.clause_number
    clauseId = `${chunk.source_id}#${section ?? 'contract'}`
  }

  return {
    clause: {
      id: clauseId,
      jurisdiction: 'imported',
      code: chunk.source_type,
      section: section ?? chunk.source_type,
      title: section ?? chunk.source_type,
      body: chunk.chunk_text,
      tags: [],
    },
    score: chunk.score,
    matched_tokens: [],
  }
}
