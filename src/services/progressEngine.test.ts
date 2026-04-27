import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  deriveProgress,
  deriveParentProgress,
  getScheduleHealth,
  getScheduleHealthDisplay,
  type ScheduleHealth,
} from './progressEngine'

describe('progressEngine — deriveProgress (work-based)', () => {
  it('derives percent_complete from estimated + remaining hours', () => {
    // 100 estimated, 25 remaining → 75% complete
    expect(deriveProgress(100, 25, null).percent_complete).toBe(75)
  })

  it('clamps percent_complete to [0, 100]', () => {
    // remaining > estimated → negative → clamped to 0
    expect(deriveProgress(100, 200, null).percent_complete).toBe(0)
  })

  it('estimated = 0 with remaining = 0 → 100% (vacuously complete)', () => {
    expect(deriveProgress(0, 0, null).percent_complete).toBe(100)
  })

  it('estimated = 0 with remaining > 0 → 0% (no work yet)', () => {
    expect(deriveProgress(0, 10, null).percent_complete).toBe(0)
  })

  it('derives remaining_hours from estimated + percent_complete', () => {
    // 100 estimated, 75% complete → 25 remaining
    expect(deriveProgress(100, null, 75).remaining_hours).toBe(25)
  })

  it('remaining_hours rounds to 2 decimals', () => {
    // 33% of 100 = 67 remaining; rounding test: 33.333% of 100 = 66.667 → 66.67
    const r = deriveProgress(100, null, 33.333)
    expect(r.remaining_hours).toBeCloseTo(66.67, 2)
  })

  it('derives estimated_hours from remaining + percent_complete', () => {
    // 25 remaining at 75% complete → 100 estimated
    expect(deriveProgress(null, 25, 75).estimated_hours).toBe(100)
  })

  it('100% complete with leftover remaining → estimated = remaining (edge case)', () => {
    expect(deriveProgress(null, 5, 100).estimated_hours).toBe(5)
  })

  it('returns empty when too many fields are known (no derivation needed)', () => {
    const r = deriveProgress(100, 25, 75)
    expect(r).toEqual({})
  })

  it('returns empty when not enough fields are known', () => {
    expect(deriveProgress(null, null, null)).toEqual({})
    expect(deriveProgress(100, null, null)).toEqual({})
  })

  it('rejects out-of-range percent_complete (negative or >100)', () => {
    // -5 isn't a valid percent → derivation skipped → empty
    expect(deriveProgress(100, null, -5)).toEqual({})
    expect(deriveProgress(100, null, 150)).toEqual({})
  })

  it('rejects negative hour values', () => {
    expect(deriveProgress(-10, 25, null)).toEqual({})
    expect(deriveProgress(100, -5, null)).toEqual({})
  })
})

describe('progressEngine — deriveParentProgress (work-weighted rollup)', () => {
  it('returns null when no children have estimated_hours', () => {
    expect(deriveParentProgress([])).toBeNull()
    expect(deriveParentProgress([{ estimated_hours: null, remaining_hours: 5 }])).toBeNull()
    expect(deriveParentProgress([{ estimated_hours: 0, remaining_hours: 0 }])).toBeNull()
  })

  it('weights by estimated_hours (work-weighted average)', () => {
    // Two children: 100h estimated, 0h remaining (100% done) AND 100h estimated, 100h remaining (0% done)
    // Total: 200h work, 100h remaining → 50% complete
    expect(
      deriveParentProgress([
        { estimated_hours: 100, remaining_hours: 0 },
        { estimated_hours: 100, remaining_hours: 100 },
      ]),
    ).toBe(50)
  })

  it('child with null remaining is treated as no progress (remaining = estimated)', () => {
    // 100h estimated, no remaining set → assumed 100h remaining → 0% complete
    expect(
      deriveParentProgress([
        { estimated_hours: 100, remaining_hours: null },
      ]),
    ).toBe(0)
  })

  it('children without estimated_hours are skipped', () => {
    // Skipped child: { estimated_hours: null }; effective: 100h work, 25h rem → 75%
    expect(
      deriveParentProgress([
        { estimated_hours: null, remaining_hours: 999 },
        { estimated_hours: 100, remaining_hours: 25 },
      ]),
    ).toBe(75)
  })

  it('clamps to [0, 100]', () => {
    // Negative-remaining shouldn't happen but if it does the clamp catches it
    expect(
      deriveParentProgress([
        { estimated_hours: 100, remaining_hours: -50 },
      ]),
    ).toBe(100)
    expect(
      deriveParentProgress([
        { estimated_hours: 100, remaining_hours: 200 },
      ]),
    ).toBe(0)
  })
})

describe('progressEngine — getScheduleHealth', () => {
  // Fix Date.now() for deterministic dates relative to "today"
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('100% complete → "complete"', () => {
    expect(
      getScheduleHealth({ start_date: null, end_date: null, percent_complete: 100 }),
    ).toBe('complete')
  })

  it('no end_date → "on_track"', () => {
    expect(
      getScheduleHealth({ start_date: null, end_date: null, percent_complete: 50 }),
    ).toBe('on_track')
  })

  it('end_date in the past + not complete → "behind"', () => {
    expect(
      getScheduleHealth({
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        percent_complete: 50,
      }),
    ).toBe('behind')
  })

  it('within 3 days of end + lagging expected progress → "at_risk"', () => {
    // Start: Jan 1, End: Jan 17 (2 days from now). Total 16 days. Elapsed 14.
    // Expected progress ≈ 88%. Actual = 30% → at_risk.
    expect(
      getScheduleHealth({
        start_date: '2026-01-01',
        end_date: '2026-01-17',
        percent_complete: 30,
      }),
    ).toBe('at_risk')
  })

  it('within 3 days of end but ahead of expected → "on_track"', () => {
    // Same dates but progress = 95% → keeping up with expected ~88%
    expect(
      getScheduleHealth({
        start_date: '2026-01-01',
        end_date: '2026-01-17',
        percent_complete: 95,
      }),
    ).toBe('on_track')
  })

  it('end_date far in the future → "on_track" regardless of progress', () => {
    expect(
      getScheduleHealth({
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        percent_complete: 0,
      }),
    ).toBe('on_track')
  })

  it('treats null percent_complete as 0', () => {
    // far-future end date, no progress → on_track
    expect(
      getScheduleHealth({ start_date: null, end_date: '2026-06-01', percent_complete: null }),
    ).toBe('on_track')
  })
})

describe('progressEngine — getScheduleHealthDisplay', () => {
  it.each([
    ['on_track', 'On Track', 'green'],
    ['at_risk', 'At Risk', 'yellow'],
    ['behind', 'Behind', 'red'],
    ['complete', 'Complete', 'blue'],
  ] as const)('%s → %s / %s', (health, label, color) => {
    const r = getScheduleHealthDisplay(health as ScheduleHealth)
    expect(r.label).toBe(label)
    expect(r.color).toBe(color)
  })
})
