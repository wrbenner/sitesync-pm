// ────────────────────────────────────────────────────────────────────────────
// Daily-log chunker — Phase 3c
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// A daily log has 5 well-known sections (manpower, equipment, weather,
// narrative, incident). Each section becomes a separate chunk so retrieval
// can return e.g. "all weather notes from October" without bringing along
// the manpower table.

import {
  approxTokens,
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'
import { splitByTokenBudget } from './drawing'

type DailyLogSectionKey = 'manpower' | 'equipment' | 'weather' | 'narrative' | 'incident'

export interface DailyLogChunkerInput extends ChunkerCommonInput {
  daily_log_id: string
  log_date: string // ISO date
  sections: Partial<Record<DailyLogSectionKey, string>>
}

export function chunkDailyLog(input: DailyLogChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0

  const SECTION_ORDER: readonly DailyLogSectionKey[] = [
    'narrative',
    'manpower',
    'equipment',
    'weather',
    'incident',
  ]

  for (const section of SECTION_ORDER) {
    const text = input.sections[section]
    if (!text || text.trim().length === 0) continue

    const segments = splitByTokenBudget(text.trim(), CHUNK_TOKEN_CEILING)
    for (const seg of segments) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: seg.text,
        source_anchor: {
          kind: 'daily_log',
          daily_log_id: input.daily_log_id,
          section,
        },
        metadata: {
          daily_log_id: input.daily_log_id,
          section,
          log_date: input.log_date,
        },
        estimated_token_count: seg.tokens,
      })
    }
  }
  return out
}

// Re-export for callers who want the same approxTokens helper as the worker.
export { approxTokens }
