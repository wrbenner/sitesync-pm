// ────────────────────────────────────────────────────────────────────────────
// Spreadsheet chunker — Phase 3d
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Spreadsheets are noisier than other artifacts — most cells aren't worth
// embedding. We chunk by:
//   - Named ranges (if the file declares them) — each becomes 1 chunk.
//   - Contiguous non-empty blocks separated by empty rows.
//
// Caller pre-parses the file (xlsx) into a list of pre-detected ranges +
// their text content. The chunker just packages them. Sheet name + A1
// range stays in source_anchor for citation deep-linking.

import {
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'
import { splitByTokenBudget } from './drawing'

export interface SpreadsheetRangeInput {
  sheet_name: string
  /** A1 notation, e.g. "A1:F30" or "Estimate!B2:D15". */
  range_a1: string
  /** Optional human-readable label if the range is named (e.g. "BudgetSummary"). */
  named_range?: string
  /** The cell values flattened to text, row by row. */
  text: string
}

export interface SpreadsheetChunkerInput extends ChunkerCommonInput {
  asset_id: string
  file_name?: string
  ranges: readonly SpreadsheetRangeInput[]
}

export function chunkSpreadsheet(input: SpreadsheetChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0

  for (const r of input.ranges) {
    if (!r.text || r.text.trim().length === 0) continue

    const label = r.named_range
      ? `${r.sheet_name}!${r.range_a1} (${r.named_range})`
      : `${r.sheet_name}!${r.range_a1}`
    const prefixed = `${label}\n${r.text.trim()}`

    const segs = splitByTokenBudget(prefixed, CHUNK_TOKEN_CEILING)
    for (const seg of segs) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: seg.text,
        source_anchor: {
          kind: 'spreadsheet',
          asset_id: input.asset_id,
          sheet_name: r.sheet_name,
          range_a1: r.range_a1,
        },
        metadata: {
          asset_id: input.asset_id,
          file_name: input.file_name ?? null,
          sheet_name: r.sheet_name,
          range_a1: r.range_a1,
          named_range: r.named_range ?? null,
        },
        estimated_token_count: seg.tokens,
      })
    }
  }

  return out
}
