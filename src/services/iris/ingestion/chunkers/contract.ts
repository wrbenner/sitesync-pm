// ────────────────────────────────────────────────────────────────────────────
// Contract chunker — Phase 3d
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Contracts (AIA A201, A101, GMP, custom) have hierarchical structure:
// Articles > Sections > Clauses. The chunker accepts pre-parsed clause-level
// input (caller's PDF parser walks the section tree) and emits one chunk
// per clause. Long clauses split via the shared budget helper but keep the
// clause_number in source_anchor so citations stay precise.

import {
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'
import { splitByTokenBudget } from './drawing'

export interface ContractClauseInput {
  /** Clause number as it appears in the document. E.g. "3.2.1" or "Article 7 §3". */
  clause_number: string
  /** Optional parent article number for hierarchy display. */
  article?: string
  /** Clause heading / title. */
  heading?: string
  /** The clause body. */
  text: string
}

export interface ContractChunkerInput extends ChunkerCommonInput {
  contract_id: string
  contract_title: string
  contract_type?: string // 'aia_a201' | 'aia_a101' | 'gmp' | 'custom'
  clauses: readonly ContractClauseInput[]
}

export function chunkContract(input: ContractChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0

  for (const clause of input.clauses) {
    if (!clause.text || clause.text.trim().length === 0) continue

    const heading = clause.heading
      ? `${clause.clause_number} ${clause.heading}`
      : clause.clause_number
    const prefixed = `${heading}\n${clause.text.trim()}`

    const segs = splitByTokenBudget(prefixed, CHUNK_TOKEN_CEILING)
    for (const seg of segs) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: seg.text,
        source_anchor: {
          kind: 'contract',
          contract_id: input.contract_id,
          clause_number: clause.clause_number,
        },
        metadata: {
          contract_id: input.contract_id,
          contract_title: input.contract_title,
          contract_type: input.contract_type ?? null,
          clause_number: clause.clause_number,
          article: clause.article ?? null,
          heading: clause.heading ?? null,
        },
        estimated_token_count: seg.tokens,
      })
    }
  }

  return out
}
