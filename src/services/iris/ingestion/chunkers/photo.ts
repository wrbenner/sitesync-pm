// ────────────────────────────────────────────────────────────────────────────
// Photo chunker — Phase 3c
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Photos are embedded via their vision-LLM caption (text), NOT the image
// pixels. The caller produces the caption upstream — this chunker just wraps
// the caption + tags into a Chunk.
//
// One chunk per photo. Caption hash carries forward so re-captioning the
// same image yields zero embed churn.

import {
  approxTokens,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'

export interface PhotoChunkerInput extends ChunkerCommonInput {
  asset_id: string
  caption: string
  caption_hash: string
  tags?: readonly string[]
  taken_at?: string
  /** Geo if exif had it; helps retrieve "north elevation photos". */
  location_label?: string
}

export function chunkPhoto(input: PhotoChunkerInput): Chunk[] {
  const captionText = (input.caption ?? '').trim()
  if (!captionText) return []

  // Append tag soup so retrieval picks up tag matches without a separate column.
  const tagSuffix =
    input.tags && input.tags.length > 0 ? `\nTags: ${input.tags.join(', ')}` : ''
  const locationSuffix = input.location_label ? `\nLocation: ${input.location_label}` : ''
  const fullText = captionText + tagSuffix + locationSuffix

  const tokens = approxTokens(fullText)
  if (tokens < CHUNK_TOKEN_FLOOR) {
    // Caption too short to be useful — drop. Worker logs this so the photo
    // gets re-captioned on the next pass.
    return []
  }

  return [
    {
      ordinal: 0,
      text: fullText,
      source_anchor: {
        kind: 'photo',
        asset_id: input.asset_id,
        caption_hash: input.caption_hash,
      },
      metadata: {
        asset_id: input.asset_id,
        caption_hash: input.caption_hash,
        tags: input.tags ?? [],
        taken_at: input.taken_at ?? null,
        location_label: input.location_label ?? null,
      },
      estimated_token_count: tokens,
    },
  ]
}
