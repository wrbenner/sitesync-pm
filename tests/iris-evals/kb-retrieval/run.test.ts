// ────────────────────────────────────────────────────────────────────────────
// kb-retrieval harness — unit tests
// ────────────────────────────────────────────────────────────────────────────
// Exercises the judge fn + percentile helper + golden-loader against a
// fake retrieve() result so we can assert the harness's math is correct
// without depending on the live staging corpus.

import { describe, expect, it } from 'vitest'
import {
  judgeOutcome,
  loadGoldens,
  percentile,
  type Golden,
} from './run'
import type { KbChunk, RetrieveResult } from '../../../src/services/iris/types/retrieval'

function makeChunk(over: Partial<KbChunk> = {}): KbChunk {
  return {
    chunk_id: 'c1',
    source_type: 'spec_section',
    source_id: 's-1',
    source_anchor: { kind: 'spec_section', section: '03 30 00' },
    chunk_text: 'Cast-in-place concrete cover requirements...',
    sensitivity: 'public_to_project',
    score: 0.9,
    ingested_at: '2026-05-11T12:00:00Z',
    metadata: {},
    ...over,
  }
}

function makeResult(chunks: KbChunk[], latency = 100, cache = false): RetrieveResult {
  return { chunks, latency_ms: latency, cache_hit: cache, empty_corpus: false }
}

const goldenSpec: Golden = {
  id: 'g-001',
  category: 'spec',
  question: 'What does spec section 03 30 00 say about concrete cover?',
  expected_source_types: ['spec_section'],
  expected_anchor_substrings: ['03 30 00', 'concrete'],
  min_score: 0.4,
}

describe('loadGoldens', () => {
  it('reads the goldens fixture', () => {
    const goldens = loadGoldens()
    expect(goldens.length).toBeGreaterThanOrEqual(20)
    for (const g of goldens) {
      expect(g.id).toMatch(/^g-/)
      expect(g.expected_source_types.length).toBeGreaterThan(0)
    }
  })

  it('every golden has unique id', () => {
    const goldens = loadGoldens()
    const ids = new Set(goldens.map((g) => g.id))
    expect(ids.size).toBe(goldens.length)
  })
})

describe('percentile', () => {
  it('returns 0 on empty input', () => {
    expect(percentile([], 0.95)).toBe(0)
  })

  it('returns the value at the requested percentile', () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    expect(percentile(xs, 0.5)).toBe(60)
    expect(percentile(xs, 0.95)).toBe(100)
  })

  it('is order-independent', () => {
    const a = [50, 10, 90, 30, 70]
    const b = [10, 30, 50, 70, 90]
    expect(percentile(a, 0.95)).toBe(percentile(b, 0.95))
  })
})

describe('judgeOutcome', () => {
  it('precision@5 = 1 when top-1 source_type is expected', () => {
    const result = makeResult([makeChunk()])
    expect(judgeOutcome(goldenSpec, result).precision_at_5).toBe(1)
  })

  it('precision@5 = 0 when top-1 source_type is NOT in expected set', () => {
    const result = makeResult([makeChunk({ source_type: 'photo' })])
    expect(judgeOutcome(goldenSpec, result).precision_at_5).toBe(0)
  })

  it('recall@5 = 1 when any of top-5 anchors contains a substring', () => {
    const result = makeResult([
      makeChunk({ source_anchor: { kind: 'spec_section', section: '01 00 00' } }),
      makeChunk({ source_anchor: { kind: 'spec_section', section: '03 30 00' } }),
    ])
    expect(judgeOutcome(goldenSpec, result).recall_at_5).toBe(1)
  })

  it('recall@5 = 1 when chunk_text contains a substring', () => {
    const result = makeResult([
      makeChunk({
        source_anchor: { kind: 'spec_section', section: '99 99 99' },
        chunk_text: 'discussion of concrete cover',
      }),
    ])
    expect(judgeOutcome(goldenSpec, result).recall_at_5).toBe(1)
  })

  it('recall@5 = 0 when no top-5 chunk matches', () => {
    const result = makeResult([
      makeChunk({
        source_anchor: { kind: 'spec_section', section: '99 99 99' },
        chunk_text: 'unrelated electrical content',
      }),
    ])
    expect(judgeOutcome(goldenSpec, result).recall_at_5).toBe(0)
  })

  it('recall@5 = 0 on empty result', () => {
    expect(judgeOutcome(goldenSpec, makeResult([])).recall_at_5).toBe(0)
    expect(judgeOutcome(goldenSpec, makeResult([])).precision_at_5).toBe(0)
  })

  it('propagates latency + cache_hit from the result', () => {
    const result = makeResult([makeChunk()], 250, true)
    const o = judgeOutcome(goldenSpec, result)
    expect(o.latency_ms).toBe(250)
    expect(o.cache_hit).toBe(true)
  })
})
