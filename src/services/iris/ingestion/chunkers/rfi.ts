// ────────────────────────────────────────────────────────────────────────────
// RFI chunker — Phase 3b
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Input: an RFI's body + ordered response thread.
// Output: one chunk for the body, one chunk per response, each with the
// response index in source_anchor so the citation panel can scroll the
// thread to the exact reply.

import { splitByTokenBudget } from './drawing'
import {
  approxTokens,
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'

export interface RfiResponseInput {
  /** 0-based index into the response thread. */
  response_idx: number
  text: string
  /** Optional author display name; goes into metadata for downstream filtering. */
  author?: string
  responded_at?: string
}

export interface RfiChunkerInput extends ChunkerCommonInput {
  rfi_id: string
  title: string
  body_text: string
  responses: readonly RfiResponseInput[]
  /** RFI status at ingest time. Lets Iris bias toward open RFIs in retrieval. */
  status?: 'open' | 'pending' | 'answered' | 'voided' | 'closed'
}

export function chunkRfi(input: RfiChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0

  // Body chunk(s). Prepend title so the embedding sees the question subject.
  const bodyText = input.title ? `${input.title}\n\n${input.body_text}` : input.body_text
  if (bodyText && bodyText.trim().length > 0) {
    const segments = splitByTokenBudget(bodyText, CHUNK_TOKEN_CEILING)
    for (const [i, seg] of segments.entries()) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: seg.text,
        source_anchor: { kind: 'rfi', rfi_id: input.rfi_id, response_idx: undefined },
        metadata: {
          rfi_id: input.rfi_id,
          part: 'body',
          status: input.status,
          part_of_split: segments.length > 1 ? { idx: i, total: segments.length } : undefined,
        },
        estimated_token_count: seg.tokens,
      })
    }
  }

  // One chunk per response.
  for (const response of input.responses) {
    if (!response.text || response.text.trim().length === 0) continue
    const text = response.author
      ? `${response.author}:\n\n${response.text}`
      : response.text
    const segments = splitByTokenBudget(text, CHUNK_TOKEN_CEILING)
    for (const [i, seg] of segments.entries()) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: seg.text,
        source_anchor: {
          kind: 'rfi',
          rfi_id: input.rfi_id,
          response_idx: response.response_idx,
        },
        metadata: {
          rfi_id: input.rfi_id,
          part: 'response',
          author: response.author,
          responded_at: response.responded_at,
          part_of_split: segments.length > 1 ? { idx: i, total: segments.length } : undefined,
        },
        estimated_token_count: seg.tokens,
      })
    }
  }

  return out
}

export { approxTokens }
