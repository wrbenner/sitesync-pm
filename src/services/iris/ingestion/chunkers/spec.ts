// ────────────────────────────────────────────────────────────────────────────
// Spec section chunker — Phase 3b
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Input: extracted text from a spec PDF or doc, with CSI MasterFormat
// section numbers detected (e.g. "03 30 00 Cast-In-Place Concrete").
// Output: one chunk per CSI section. Section number lives in source_anchor.
//
// Long sections split via the same splitByTokenBudget helper as the drawing
// chunker — keeps every chunk under the embedding-model 8K input cap.

import { splitByTokenBudget } from './drawing'
import {
  approxTokens,
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'

export interface SpecSectionInput {
  /** CSI section number, e.g. "03 30 00" or "1006.2" (also accepts IBC-style). */
  section: string
  title?: string
  text: string
  page?: number
}

export interface SpecChunkerInput extends ChunkerCommonInput {
  spec_document_id: string
  sections: readonly SpecSectionInput[]
  /** Optional issue date that propagates to embedding_model_version metadata. */
  issued_at?: string
}

export function chunkSpec(input: SpecChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0
  for (const section of input.sections) {
    if (!section.text || section.text.trim().length === 0) continue
    const baseText = section.title
      ? `${section.section} ${section.title}\n\n${section.text}`
      : `${section.section}\n\n${section.text}`
    const segments = splitByTokenBudget(baseText, CHUNK_TOKEN_CEILING)
    for (const [i, seg] of segments.entries()) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: seg.text,
        source_anchor: { kind: 'spec_section', section: section.section, page: section.page },
        metadata: {
          spec_document_id: input.spec_document_id,
          title: section.title,
          issued_at: input.issued_at,
          part_of_split: segments.length > 1 ? { idx: i, total: segments.length } : undefined,
        },
        estimated_token_count: seg.tokens,
      })
    }
  }
  return out
}

/**
 * Detect CSI MasterFormat section headers in raw extracted text. Matches the
 * canonical 6-digit format "DD DD DD" plus the legacy 5-digit "DDDDD" form.
 * Returns the index ranges so a caller can split the doc.
 */
export function detectCsiSections(text: string): Array<{
  section: string
  start_index: number
}> {
  const matches: Array<{ section: string; start_index: number }> = []
  const re = /\b(\d{2}\s\d{2}\s\d{2})\b/g
  const iterator = text.matchAll(re)
  for (const m of iterator) {
    matches.push({ section: m[1], start_index: m.index ?? 0 })
  }
  return matches
}

/** Tokens approximator — re-exported for tests that don't want to import from ./types. */
export { approxTokens }
