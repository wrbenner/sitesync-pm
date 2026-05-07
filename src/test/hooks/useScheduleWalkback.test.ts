// Phase 5 — schedule walkback computation tests.
// Tests the pure `computeWalkback` helper (no React mock surface).

import { describe, it, expect } from 'vitest'
import { computeWalkback } from '../../hooks/useScheduleWalkback'

describe('computeWalkback', () => {
  it('returns ready=false when no activity_start_date', () => {
    const r = computeWalkback({ activity_start_date: null })
    expect(r.ready).toBe(false)
    expect(r.computed_required_on_site).toBeNull()
    expect(r.computed_submit_by).toBeNull()
  })

  it('subtracts buffer from start to compute required-on-site', () => {
    const r = computeWalkback({
      activity_start_date: '2026-12-15',
      buffer_days: 5,
      kind: 'product_data',
    })
    // 2026-12-15 minus 5 days = 2026-12-10
    expect(r.computed_required_on_site).toBe('2026-12-10')
  })

  it('walks back ship + fab + review from required-on-site for submit-by (product_data)', () => {
    // product_data: ship=5, fab=7, review=10 (default) → 22 days back from required-on-site
    const r = computeWalkback({
      activity_start_date: '2026-12-31',
      buffer_days: 5,
      kind: 'product_data',
      review_sla_days: 10,
    })
    // required-on-site = 2026-12-26; submit-by = 22 days earlier = 2026-12-04
    expect(r.computed_required_on_site).toBe('2026-12-26')
    expect(r.computed_submit_by).toBe('2026-12-04')
  })

  it('uses larger lead times for shop drawings', () => {
    // shop_drawing: ship=7, fab=28, review=10 → 45 days back
    const r = computeWalkback({
      activity_start_date: '2027-03-01',
      buffer_days: 5,
      kind: 'shop_drawing',
    })
    expect(r.computed_required_on_site).toBe('2027-02-24')
    // 2027-02-24 minus (7+28+10)=45 days = 2027-01-10
    expect(r.computed_submit_by).toBe('2027-01-10')
    expect(r.ship_lead_time_days).toBe(7)
    expect(r.fab_lead_time_days).toBe(28)
  })

  it('exposes computed lead time in weeks', () => {
    // shop_drawing: ship=7 + fab=28 = 35 days = 5.0 weeks
    const r = computeWalkback({
      activity_start_date: '2026-12-01',
      kind: 'shop_drawing',
    })
    expect(r.computed_lead_time_weeks).toBe(5.0)
  })

  it("falls back to 'other' lead times when no kind given", () => {
    // other: ship=7, fab=14
    const r = computeWalkback({
      activity_start_date: '2026-12-01',
    })
    expect(r.ship_lead_time_days).toBe(7)
    expect(r.fab_lead_time_days).toBe(14)
  })
})
