// ────────────────────────────────────────────────────────────────────────────
// Drawing chunker — Phase 3b
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Input: extracted text per drawing sheet, with optional bounding-box regions
// pre-segmented (e.g. by a vision model that found a callout cluster).
// Output: one chunk per sheet (or per region within a sheet). bbox metadata
// lives in source_anchor so the citation side panel can deep-link.

import {
  approxTokens,
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'

export interface DrawingSheetInput {
  sheet: string // e.g. "A-101"
  text: string
  /** Optional sub-regions detected by upstream vision model. */
  regions?: Array<{
    bbox: [number, number, number, number]
    text: string
  }>
}

export interface DrawingChunkerInput extends ChunkerCommonInput {
  drawing_id: string
  /** All sheets in the drawing set. Caller pre-extracts text via PDF parser. */
  sheets: readonly DrawingSheetInput[]
}

export function chunkDrawing(input: DrawingChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0
  for (const sheet of input.sheets) {
    if (sheet.regions && sheet.regions.length > 0) {
      // Sub-region chunking. Each region gets its own chunk + bbox.
      for (const region of sheet.regions) {
        const tokens = approxTokens(region.text)
        if (tokens < CHUNK_TOKEN_FLOOR) continue
        out.push({
          ordinal: ordinal++,
          text: region.text,
          source_anchor: { kind: 'drawing', sheet: sheet.sheet, bbox: region.bbox },
          metadata: { drawing_id: input.drawing_id, has_bbox: true },
          estimated_token_count: tokens,
        })
      }
    } else {
      // No regions detected — chunk the whole sheet, splitting if over budget.
      const segments = splitByTokenBudget(sheet.text, CHUNK_TOKEN_CEILING)
      for (const seg of segments) {
        if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
        out.push({
          ordinal: ordinal++,
          text: seg.text,
          source_anchor: { kind: 'drawing', sheet: sheet.sheet },
          metadata: { drawing_id: input.drawing_id, has_bbox: false },
          estimated_token_count: seg.tokens,
        })
      }
    }
  }
  return out
}

/**
 * Split a long string into segments under `tokenBudget`. Splits on paragraph
 * boundaries first, then sentence, then hard chars. Greedy — packs each
 * segment as full as the budget allows.
 */
export function splitByTokenBudget(
  text: string,
  tokenBudget: number,
): Array<{ text: string; tokens: number }> {
  if (!text) return []
  const totalTokens = approxTokens(text)
  if (totalTokens <= tokenBudget) {
    return [{ text, tokens: totalTokens }]
  }
  const charBudget = tokenBudget * 4
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  const out: Array<{ text: string; tokens: number }> = []
  let buf = ''
  for (const para of paragraphs) {
    if (buf.length + para.length + 2 <= charBudget) {
      buf = buf ? `${buf}\n\n${para}` : para
    } else {
      if (buf.length > 0) {
        out.push({ text: buf, tokens: approxTokens(buf) })
        buf = ''
      }
      if (para.length <= charBudget) {
        buf = para
      } else {
        // Single paragraph over budget: split by sentence.
        const sentences = para.split(/(?<=[.!?])\s+/)
        for (const s of sentences) {
          if (buf.length + s.length + 1 <= charBudget) {
            buf = buf ? `${buf} ${s}` : s
          } else {
            if (buf.length > 0) out.push({ text: buf, tokens: approxTokens(buf) })
            // Sentence still too long: hard char-split.
            if (s.length > charBudget) {
              for (let i = 0; i < s.length; i += charBudget) {
                const slice = s.slice(i, i + charBudget)
                out.push({ text: slice, tokens: approxTokens(slice) })
              }
              buf = ''
            } else {
              buf = s
            }
          }
        }
      }
    }
  }
  if (buf.length > 0) out.push({ text: buf, tokens: approxTokens(buf) })
  return out
}
