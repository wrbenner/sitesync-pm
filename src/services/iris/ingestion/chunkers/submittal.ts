// ────────────────────────────────────────────────────────────────────────────
// Submittal chunker — Phase 3d
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// A submittal package contains: header (number, package_name, status,
// submitted_by, spec_section it satisfies), description, review history,
// and sub-items (one per product or sample). Each becomes its own chunk so
// retrieval can return "all approved submittals that satisfy spec 03 30 00"
// or "the cover-letter description for package SUB-014" cleanly.

import {
  approxTokens,
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'
import { splitByTokenBudget } from './drawing'

export interface SubmittalSubItem {
  idx: number
  product_name: string
  manufacturer?: string
  model_number?: string
  description?: string
  status?: string
}

export interface SubmittalChunkerInput extends ChunkerCommonInput {
  submittal_id: string
  package_number: string
  package_name: string
  status: string
  satisfies_spec_section?: string
  description?: string
  review_notes?: string
  sub_items: readonly SubmittalSubItem[]
}

export function chunkSubmittal(input: SubmittalChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0

  // ── Header chunk ────────────────────────────────────────────────────────
  const headerParts: string[] = [
    `Submittal ${input.package_number}: ${input.package_name}`,
    `Status: ${input.status}`,
  ]
  if (input.satisfies_spec_section) {
    headerParts.push(`Satisfies: spec section ${input.satisfies_spec_section}`)
  }
  if (input.description && input.description.trim()) {
    headerParts.push('', 'Description:', input.description.trim())
  }
  const headerText = headerParts.join('\n')
  if (approxTokens(headerText) >= CHUNK_TOKEN_FLOOR) {
    const segs = splitByTokenBudget(headerText, CHUNK_TOKEN_CEILING)
    for (const seg of segs) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: seg.text,
        source_anchor: { kind: 'submittal', submittal_id: input.submittal_id },
        metadata: {
          submittal_id: input.submittal_id,
          package_number: input.package_number,
          part: 'header',
          status: input.status,
          satisfies_spec: input.satisfies_spec_section ?? null,
        },
        estimated_token_count: seg.tokens,
      })
    }
  }

  // ── Sub-items ───────────────────────────────────────────────────────────
  for (const item of input.sub_items) {
    const lines: string[] = [
      `Item ${item.idx}: ${item.product_name}`,
    ]
    if (item.manufacturer) lines.push(`Manufacturer: ${item.manufacturer}`)
    if (item.model_number) lines.push(`Model: ${item.model_number}`)
    if (item.status) lines.push(`Status: ${item.status}`)
    if (item.description) lines.push('', item.description.trim())
    const itemText = lines.join('\n')
    const tokens = approxTokens(itemText)
    if (tokens < CHUNK_TOKEN_FLOOR) continue
    out.push({
      ordinal: ordinal++,
      text: itemText,
      source_anchor: {
        kind: 'submittal',
        submittal_id: input.submittal_id,
        package_idx: item.idx,
      },
      metadata: {
        submittal_id: input.submittal_id,
        package_number: input.package_number,
        part: 'sub_item',
        item_idx: item.idx,
        manufacturer: item.manufacturer ?? null,
      },
      estimated_token_count: tokens,
    })
  }

  // ── Review notes ────────────────────────────────────────────────────────
  if (input.review_notes && input.review_notes.trim()) {
    const segs = splitByTokenBudget(input.review_notes.trim(), CHUNK_TOKEN_CEILING)
    for (const seg of segs) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: `Review: ${seg.text}`,
        source_anchor: { kind: 'submittal', submittal_id: input.submittal_id },
        metadata: {
          submittal_id: input.submittal_id,
          package_number: input.package_number,
          part: 'review_notes',
        },
        estimated_token_count: seg.tokens,
      })
    }
  }

  return out
}
