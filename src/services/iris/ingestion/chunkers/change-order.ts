// ────────────────────────────────────────────────────────────────────────────
// Change-order chunker — Phase 3c
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// A CO has 3 main parts: header (number, status, justification narrative),
// line items (cost breakdown), and approval narrative. Each is a separate
// chunk so the Money specialist can retrieve "what's in CO #14" or "all CO
// line items > $5K" cleanly.
//
// Line items are batched into one chunk per ~10 items so cost lookups
// return a coherent block, not a flood of one-row chunks.

import {
  approxTokens,
  CHUNK_TOKEN_CEILING,
  CHUNK_TOKEN_FLOOR,
  type Chunk,
  type ChunkerCommonInput,
} from './types'
import { splitByTokenBudget } from './drawing'

export interface CoLineItem {
  idx: number
  description: string
  quantity?: number | null
  unit?: string | null
  unit_cost_cents?: number | null
  extended_cents?: number | null
}

export interface ChangeOrderChunkerInput extends ChunkerCommonInput {
  co_id: string
  co_number: string
  status: string
  justification?: string
  approval_narrative?: string
  line_items: readonly CoLineItem[]
  total_cents?: number
}

const LINE_ITEM_BATCH_SIZE = 10

export function chunkChangeOrder(input: ChangeOrderChunkerInput): Chunk[] {
  const out: Chunk[] = []
  let ordinal = 0

  // ── Header chunk ────────────────────────────────────────────────────────
  const headerParts: string[] = [
    `Change Order ${input.co_number}`,
    `Status: ${input.status}`,
  ]
  if (input.total_cents != null) {
    headerParts.push(`Total: $${(input.total_cents / 100).toFixed(2)}`)
  }
  if (input.justification && input.justification.trim()) {
    headerParts.push('', 'Justification:', input.justification.trim())
  }
  const headerText = headerParts.join('\n')
  const headerTokens = approxTokens(headerText)
  if (headerTokens >= CHUNK_TOKEN_FLOOR) {
    const segs = splitByTokenBudget(headerText, CHUNK_TOKEN_CEILING)
    for (const seg of segs) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: seg.text,
        source_anchor: { kind: 'change_order', co_id: input.co_id },
        metadata: {
          co_id: input.co_id,
          co_number: input.co_number,
          part: 'header',
          status: input.status,
        },
        estimated_token_count: seg.tokens,
      })
    }
  }

  // ── Line-item batches ───────────────────────────────────────────────────
  for (let i = 0; i < input.line_items.length; i += LINE_ITEM_BATCH_SIZE) {
    const batch = input.line_items.slice(i, i + LINE_ITEM_BATCH_SIZE)
    if (batch.length === 0) continue
    const lines = batch.map((li) => {
      const qty = li.quantity != null && li.unit ? `${li.quantity} ${li.unit} ` : ''
      const unit =
        li.unit_cost_cents != null ? `@ $${(li.unit_cost_cents / 100).toFixed(2)} ` : ''
      const ext =
        li.extended_cents != null ? `= $${(li.extended_cents / 100).toFixed(2)}` : ''
      return `${li.idx}. ${li.description} ${qty}${unit}${ext}`.trim()
    })
    const text = `Line items ${batch[0].idx}–${batch[batch.length - 1].idx}:\n${lines.join('\n')}`
    const tokens = approxTokens(text)
    if (tokens < CHUNK_TOKEN_FLOOR) continue
    out.push({
      ordinal: ordinal++,
      text,
      source_anchor: {
        kind: 'change_order',
        co_id: input.co_id,
        line_idx: batch[0].idx,
      },
      metadata: {
        co_id: input.co_id,
        co_number: input.co_number,
        part: 'line_items',
        line_idx_start: batch[0].idx,
        line_idx_end: batch[batch.length - 1].idx,
      },
      estimated_token_count: tokens,
    })
  }

  // ── Approval narrative ──────────────────────────────────────────────────
  if (input.approval_narrative && input.approval_narrative.trim()) {
    const segs = splitByTokenBudget(input.approval_narrative.trim(), CHUNK_TOKEN_CEILING)
    for (const seg of segs) {
      if (seg.tokens < CHUNK_TOKEN_FLOOR) continue
      out.push({
        ordinal: ordinal++,
        text: `Approval: ${seg.text}`,
        source_anchor: { kind: 'change_order', co_id: input.co_id },
        metadata: {
          co_id: input.co_id,
          co_number: input.co_number,
          part: 'approval_narrative',
        },
        estimated_token_count: seg.tokens,
      })
    }
  }

  return out
}
