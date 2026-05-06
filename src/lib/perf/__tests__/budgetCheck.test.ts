import { describe, it, expect } from 'vitest'
import { checkBudget, hasRatchetOverride, readMetricsFromLhci, DEFAULT_BUDGETS } from '../budgetCheck'
import { assertQueryP95, percentile } from '../queryRegression'

describe('checkBudget', () => {
  it('passes when all metrics are inside the budget', () => {
    const r = checkBudget({ fcpMs: 1200, ttiMs: 2500, bundleBytesGzipped: 500 * 1024 })
    expect(r.passed).toBe(true)
    expect(r.summary).toMatch(/All performance budgets met/)
  })

  it('fails when FCP is over budget', () => {
    const r = checkBudget({ fcpMs: 1700, ttiMs: 2500, bundleBytesGzipped: 500 * 1024 })
    expect(r.passed).toBe(false)
    const fcp = r.results.find(x => x.metric === 'fcpMs')!
    expect(fcp.overBudget).toBe(true)
    expect(fcp.delta).toBe(200)
  })

  it('uses custom budgets when provided', () => {
    const r = checkBudget({ fcpMs: 1700, ttiMs: 2500, bundleBytesGzipped: 500 * 1024 }, { ...DEFAULT_BUDGETS, fcpMs: 2000 })
    expect(r.passed).toBe(true)
  })
})

describe('hasRatchetOverride', () => {
  it('detects RATCHET_OVERRIDE=1 in commit message', () => {
    expect(hasRatchetOverride('feat: add foo\n\nRATCHET_OVERRIDE=1')).toBe(true)
  })
  it('does not match RATCHET_OVERRIDE=0', () => {
    expect(hasRatchetOverride('RATCHET_OVERRIDE=0')).toBe(false)
  })
  it('handles null + undefined', () => {
    expect(hasRatchetOverride(null)).toBe(false)
    expect(hasRatchetOverride(undefined)).toBe(false)
  })
})

describe('readMetricsFromLhci', () => {
  it('extracts metrics from an lhci entry', () => {
    const m = readMetricsFromLhci({
      audits: {
        'first-contentful-paint': { numericValue: 1234 },
        'interactive': { numericValue: 2500 },
        'total-byte-weight': { numericValue: 1_500_000 },
      },
    })
    expect(m.fcpMs).toBe(1234)
    expect(m.ttiMs).toBe(2500)
    expect(m.bundleBytesGzipped).toBe(525000)  // 1.5M × 0.35
  })

  it('handles missing audits gracefully', () => {
    expect(readMetricsFromLhci({}).fcpMs).toBe(0)
  })
})

describe('percentile', () => {
  it('computes p95 of a sorted set', () => {
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.95)).toBe(100)
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.5)).toBe(50)
  })
  it('handles empty input', () => {
    expect(percentile([], 0.95)).toBe(0)
  })
})

describe('assertQueryP95', () => {
  it('passes a fast query', async () => {
    const r = await assertQueryP95(async () => ({ rowCount: 1 }), { iterations: 5, warmups: 1, dropSlowest: 0, thresholdMs: 50 })
    expect(r.passed).toBe(true)
    expect(r.p95Ms).toBeLessThan(50)
  })

  it('fails a slow query', async () => {
    const r = await assertQueryP95(
      async () => { await new Promise(res => setTimeout(res, 60)); return { rowCount: 1 } },
      { iterations: 5, warmups: 1, dropSlowest: 0, thresholdMs: 50 },
    )
    expect(r.passed).toBe(false)
    expect(r.rationale).toMatch(/regression/)
  })

  it('discards warmups + slowest before computing p95', async () => {
    let call = 0
    const r = await assertQueryP95(
      async () => {
        call += 1
        // First two are slow (warmup), the slowest of the rest is dropped
        const ms = call <= 2 ? 80 : call === 7 ? 80 : 5
        await new Promise(res => setTimeout(res, ms))
        return { rowCount: 1 }
      },
      { iterations: 7, warmups: 2, dropSlowest: 1, thresholdMs: 50 },
    )
    expect(r.passed).toBe(true)
  })
})
