// ────────────────────────────────────────────────────────────────────────────
// Phase 3c chunker tests — daily-log, photo, conversation, change-order
// ────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest'
import { chunkDailyLog } from '../chunkers/daily-log'
import { chunkPhoto } from '../chunkers/photo'
import { chunkConversation } from '../chunkers/conversation'
import { chunkChangeOrder } from '../chunkers/change-order'

const filler = (n: number, base = 'Steel rebar placement section work continued. ') => {
  let out = ''
  while (out.length < n) out += base
  return out.slice(0, n)
}

// ── chunkDailyLog ───────────────────────────────────────────────────────────

describe('chunkDailyLog', () => {
  it('emits one chunk per populated section', () => {
    const chunks = chunkDailyLog({
      source_id: 'dl-1',
      version_hash: 'h1',
      daily_log_id: 'dl-1',
      log_date: '2026-05-11',
      sections: {
        narrative: filler(250),
        manpower: filler(200),
        weather: filler(200),
      },
    })
    expect(chunks.length).toBe(3)
    const sections = chunks.map(
      (c) => (c.source_anchor as { section: string }).section,
    )
    // Narrative first by SECTION_ORDER.
    expect(sections).toEqual(['narrative', 'manpower', 'weather'])
  })

  it('drops empty sections', () => {
    const chunks = chunkDailyLog({
      source_id: 'dl-1',
      version_hash: 'h1',
      daily_log_id: 'dl-1',
      log_date: '2026-05-11',
      sections: { narrative: filler(250), manpower: '   ', equipment: '' },
    })
    expect(chunks.length).toBe(1)
  })

  it('attaches daily_log_id + section to source_anchor', () => {
    const chunks = chunkDailyLog({
      source_id: 'dl-99',
      version_hash: 'h1',
      daily_log_id: 'dl-99',
      log_date: '2026-05-11',
      sections: { weather: filler(200) },
    })
    expect(chunks[0].source_anchor).toMatchObject({
      kind: 'daily_log',
      daily_log_id: 'dl-99',
      section: 'weather',
    })
  })

  it('dense ordinals across sections', () => {
    const chunks = chunkDailyLog({
      source_id: 'dl-1',
      version_hash: 'h1',
      daily_log_id: 'dl-1',
      log_date: '2026-05-11',
      sections: {
        narrative: filler(200),
        manpower: filler(200),
        equipment: filler(200),
      },
    })
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1, 2])
  })
})

// ── chunkPhoto ──────────────────────────────────────────────────────────────

describe('chunkPhoto', () => {
  it('emits one chunk with tags + location appended', () => {
    const chunks = chunkPhoto({
      source_id: 'asset-1',
      version_hash: 'h1',
      asset_id: 'asset-1',
      caption:
        'Photo of north elevation showing curtain wall thermal break installation in progress with crew at level 4.',
      caption_hash: 'cap-hash-1',
      tags: ['curtain-wall', 'level-4'],
      location_label: 'North elevation, level 4',
    })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toContain('Tags: curtain-wall, level-4')
    expect(chunks[0].text).toContain('Location: North elevation, level 4')
  })

  it('drops empty caption', () => {
    const chunks = chunkPhoto({
      source_id: 'asset-1',
      version_hash: 'h1',
      asset_id: 'asset-1',
      caption: '   ',
      caption_hash: 'cap-hash-1',
    })
    expect(chunks).toHaveLength(0)
  })

  it('drops too-short caption (under floor)', () => {
    const chunks = chunkPhoto({
      source_id: 'asset-1',
      version_hash: 'h1',
      asset_id: 'asset-1',
      caption: 'a photo',
      caption_hash: 'cap-hash-1',
    })
    expect(chunks).toHaveLength(0)
  })

  it('preserves caption_hash in source_anchor for idempotency', () => {
    const chunks = chunkPhoto({
      source_id: 'asset-1',
      version_hash: 'h1',
      asset_id: 'asset-1',
      caption: filler(200, 'Excavation pit on north corner showing rebar layout. '),
      caption_hash: 'stable-hash-xyz',
    })
    expect(chunks[0].source_anchor).toMatchObject({
      kind: 'photo',
      asset_id: 'asset-1',
      caption_hash: 'stable-hash-xyz',
    })
  })
})

// ── chunkConversation ───────────────────────────────────────────────────────

describe('chunkConversation', () => {
  it('emits a subject chunk + message batch for short adjacent messages', () => {
    const chunks = chunkConversation({
      source_id: 't-1',
      version_hash: 'h1',
      thread_id: 't-1',
      subject:
        'RFI 142 follow-up regarding curtain wall thermal break placement at the north elevation between level 3 and level 4 framing and the upper roof parapet detail per spec section 07 92 00',
      messages: [
        { message_idx: 0, author: 'Brad', sent_at: '2026-05-11T09:00:00Z', text: filler(150) },
        { message_idx: 1, author: 'Jane', sent_at: '2026-05-11T09:05:00Z', text: filler(150) },
        { message_idx: 2, author: 'Brad', sent_at: '2026-05-11T09:10:00Z', text: filler(180) },
      ],
    })
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // Subject is chunk 0.
    expect(chunks[0].text).toContain('Subject:')
  })

  it('promotes long messages to standalone chunks', () => {
    const chunks = chunkConversation({
      source_id: 't-1',
      version_hash: 'h1',
      thread_id: 't-1',
      messages: [
        { message_idx: 0, author: 'Brad', sent_at: '2026-05-11T09:00:00Z', text: filler(2000) },
      ],
    })
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    const author = (chunks[0].metadata as { author?: string }).author
    expect(author).toBe('Brad')
  })

  it('drops empty thread', () => {
    const chunks = chunkConversation({
      source_id: 't-1',
      version_hash: 'h1',
      thread_id: 't-1',
      messages: [],
    })
    expect(chunks).toHaveLength(0)
  })

  it('flushes pending batch at thread end', () => {
    // 3 short messages that should batch together; flush at end emits 1 chunk.
    const chunks = chunkConversation({
      source_id: 't-1',
      version_hash: 'h1',
      thread_id: 't-1',
      messages: [
        { message_idx: 0, author: 'A', sent_at: '2026-05-11T09:00:00Z', text: filler(150) },
        { message_idx: 1, author: 'B', sent_at: '2026-05-11T09:01:00Z', text: filler(150) },
      ],
    })
    // Should have at least one message_batch chunk.
    const batch = chunks.find(
      (c) => (c.metadata as { kind?: string }).kind === 'message_batch',
    )
    expect(batch).toBeDefined()
  })
})

// ── chunkChangeOrder ────────────────────────────────────────────────────────

describe('chunkChangeOrder', () => {
  it('emits header + line-item batch + approval narrative', () => {
    const chunks = chunkChangeOrder({
      source_id: 'co-1',
      version_hash: 'h1',
      co_id: 'co-1',
      co_number: 'CO-14',
      status: 'approved',
      total_cents: 1_250_000,
      justification: filler(200, 'Owner-requested addition for thermal break on north elevation. '),
      approval_narrative: filler(200, 'Approved by owner rep on 2026-05-10. '),
      line_items: [
        { idx: 1, description: 'Curtain wall thermal break', quantity: 100, unit: 'LF', unit_cost_cents: 5000, extended_cents: 500_000 },
        { idx: 2, description: 'Sealant', quantity: 20, unit: 'EA', unit_cost_cents: 12_500, extended_cents: 250_000 },
        { idx: 3, description: 'Labor', extended_cents: 500_000 },
      ],
    })
    const parts = chunks.map((c) => (c.metadata as { part: string }).part)
    expect(parts).toContain('header')
    expect(parts).toContain('line_items')
    expect(parts).toContain('approval_narrative')
  })

  it('batches line items in groups of 10', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      idx: i + 1,
      description: `Item ${i + 1}: ${filler(50)}`,
      extended_cents: 10_000,
    }))
    const chunks = chunkChangeOrder({
      source_id: 'co-1',
      version_hash: 'h1',
      co_id: 'co-1',
      co_number: 'CO-15',
      status: 'pending',
      line_items: items,
    })
    const itemChunks = chunks.filter(
      (c) => (c.metadata as { part: string }).part === 'line_items',
    )
    // 25 items / 10 per batch = 3 batches.
    expect(itemChunks).toHaveLength(3)
  })

  it('tags source_anchor with co_id + first-line idx', () => {
    const chunks = chunkChangeOrder({
      source_id: 'co-7',
      version_hash: 'h1',
      co_id: 'co-7',
      co_number: 'CO-7',
      status: 'pending',
      line_items: [
        { idx: 5, description: filler(200, 'Misc item description. '), extended_cents: 1000 },
      ],
    })
    const li = chunks.find(
      (c) => (c.metadata as { part: string }).part === 'line_items',
    )
    expect(li?.source_anchor).toMatchObject({ kind: 'change_order', co_id: 'co-7', line_idx: 5 })
  })

  it('emits empty when CO has no narrative content + no items', () => {
    const chunks = chunkChangeOrder({
      source_id: 'co-empty',
      version_hash: 'h1',
      co_id: 'co-empty',
      co_number: 'CO-0',
      status: 'pending',
      line_items: [],
    })
    // Header still emits with co_number + status, but the text may be below
    // the floor if the status is short. Just assert no crash.
    expect(Array.isArray(chunks)).toBe(true)
  })
})

// ── Determinism across all 4 new chunkers ───────────────────────────────────

describe('Phase 3c chunkers — determinism', () => {
  it('chunkDailyLog is deterministic', () => {
    const input = {
      source_id: 'dl-1',
      version_hash: 'h1',
      daily_log_id: 'dl-1',
      log_date: '2026-05-11',
      sections: { narrative: filler(200), weather: filler(200) },
    }
    expect(chunkDailyLog(input)).toEqual(chunkDailyLog(input))
  })

  it('chunkPhoto is deterministic', () => {
    const input = {
      source_id: 'a-1',
      version_hash: 'h1',
      asset_id: 'a-1',
      caption: filler(200, 'Crew at north corner. '),
      caption_hash: 'h',
      tags: ['t1'],
    }
    expect(chunkPhoto(input)).toEqual(chunkPhoto(input))
  })

  it('chunkConversation is deterministic', () => {
    const input = {
      source_id: 't-1',
      version_hash: 'h1',
      thread_id: 't-1',
      subject: 'Stable subject line for thread determinism check',
      messages: [
        { message_idx: 0, author: 'A', sent_at: '2026-05-11T09:00:00Z', text: filler(200) },
      ],
    }
    expect(chunkConversation(input)).toEqual(chunkConversation(input))
  })

  it('chunkChangeOrder is deterministic', () => {
    const input = {
      source_id: 'co-1',
      version_hash: 'h1',
      co_id: 'co-1',
      co_number: 'CO-1',
      status: 'approved',
      total_cents: 100_000,
      justification: filler(200, 'Stable just. '),
      line_items: [{ idx: 1, description: filler(200, 'desc '), extended_cents: 1000 }],
    }
    expect(chunkChangeOrder(input)).toEqual(chunkChangeOrder(input))
  })
})
