// ────────────────────────────────────────────────────────────────────────────
// Chunker contract — Phase 3b
// ────────────────────────────────────────────────────────────────────────────
// Every chunker is a pure function: (typed source input) → Chunk[].
// No DB calls, no OpenAI calls, no network. Workers (edge fns) compose:
//   1. fetch source content from DB
//   2. extract text (PDF -> text, HTML -> text, etc.)
//   3. call chunker(text + metadata) → Chunk[]
//   4. embed each chunk
//   5. upsert into iris_kb_chunks
//
// Keeping chunkers pure means CI can unit-test them without any cloud
// dependencies, the same chunker runs in browser preview + edge fn + tests,
// and re-chunking on schema change is a single function call.

import type { KbSourceAnchor } from '../../types/retrieval'

/** What every chunker returns for each indexable segment of a source. */
export interface Chunk {
  /** Index within the source. Stable across re-runs given identical input. */
  ordinal: number
  /** The text that will be embedded + indexed. */
  text: string
  /** Per-source-type anchor for citation deep-linking. */
  source_anchor: KbSourceAnchor
  /** Per-source metadata stored in iris_kb_chunks.metadata (jsonb). */
  metadata: Record<string, unknown>
  /** Estimated token count (4 chars/token; same approximator as Phase 1a). */
  estimated_token_count: number
}

/** Inputs shared by every chunker. */
export interface ChunkerCommonInput {
  /** Identifier of the source artifact (the `source_id` column). */
  source_id: string
  /** Hash of the source content. Workers use this for re-ingest idempotency. */
  version_hash: string
}

export function approxTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

// Soft cap on per-chunk token budget. Keeps chunks under the embedding-model
// 8K input cap with headroom for prompt + tool envelope downstream.
export const CHUNK_TOKEN_CEILING = 1200
// Min chunk size — fragments below this are merged into the previous chunk
// or dropped (e.g. trailing page header).
export const CHUNK_TOKEN_FLOOR = 32
