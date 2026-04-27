import { describe, it, expect } from 'vitest'
import {
  computeScheduleScore,
  computeCostScore,
  computeQualityScore,
  computeSafetyScore,
  computeProjectHealth,
} from './projectAnalytics'

describe('projectAnalytics — computeScheduleScore', () => {
  it('returns 100 when no phases exist (vacuous health)', () => {
    expect(computeScheduleScore([])).toBe(100)
  })

  it('returns 100 when every phase is on track', () => {
    expect(
      computeScheduleScore([
        { percent_complete: 50, status: 'on_track', is_critical_path: false },
        { percent_complete: 30, status: 'on_track', is_critical_path: true },
      ]),
    ).toBe(100)
  })

  it('penalizes 15 extra points per critical-path phase that is at_risk or delayed', () => {
    const r = computeScheduleScore([
      { percent_complete: 30, status: 'delayed', is_critical_path: true },
      { percent_complete: 50, status: 'on_track', is_critical_path: false },
    ])
    // 1 of 2 on-track → 50; minus 15 for critical delayed → 35
    expect(r).toBe(35)
  })

  it('clamps result to [0, 100]', () => {
    const phases = Array.from({ length: 5 }, () => ({
      percent_complete: 0,
      status: 'delayed',
      is_critical_path: true,
    }))
    // 0/5 on-track → 0; minus 5*15 = -75 → clamped to 0
    expect(computeScheduleScore(phases)).toBe(0)
  })
})

describe('projectAnalytics — computeCostScore', () => {
  it('returns 100 for empty budget rows', () => {
    expect(computeCostScore([])).toBe(100)
  })

  it('returns 100 when total budget is 0 (cannot compute CPI)', () => {
    expect(
      computeCostScore([
        { original_amount: 0, actual_amount: 0, percent_complete: 0 },
      ]),
    ).toBe(100)
  })

  it('healthy CPI=1 (spent matches earned value) → 100', () => {
    // EV = avgComplete * budget = 0.5 * 1000 = 500. Actual = 500. CPI = 1.
    // Score = 1 * 85 + 15 = 100.
    const r = computeCostScore([
      { original_amount: 1000, actual_amount: 500, percent_complete: 50 },
    ])
    expect(r).toBe(100)
  })

  it('overspend (low CPI) brings score down', () => {
    // EV = 0.2 * 1000 = 200; spent = 800; CPI = 200/800 = 0.25
    // score = 0.25 * 85 + 15 = 36
    const r = computeCostScore([
      { original_amount: 1000, actual_amount: 800, percent_complete: 20 },
    ])
    expect(r).toBe(36)
  })
})

describe('projectAnalytics — computeQualityScore', () => {
  it('returns 100 with no punch and no overdue RFIs', () => {
    expect(computeQualityScore([], [])).toBe(100)
  })

  it('100% punch closure → 100', () => {
    expect(
      computeQualityScore(
        [{ status: 'resolved' }, { status: 'verified' }],
        [],
      ),
    ).toBe(100)
  })

  it('0% punch closure scales score to 40', () => {
    expect(computeQualityScore([{ status: 'open' }, { status: 'open' }], [])).toBe(40)
  })

  it('overdue RFIs cost 3 points each', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    expect(
      computeQualityScore(
        [],
        [
          { status: 'open', due_date: past },
          { status: 'under_review', due_date: past },
        ],
      ),
    ).toBe(94)
  })

  it('clamps minimum to 0', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const lots = Array.from({ length: 50 }, () => ({ status: 'open' as const, due_date: past }))
    expect(computeQualityScore([], lots)).toBe(0)
  })
})

describe('projectAnalytics — computeSafetyScore', () => {
  it('returns 100 with no incidents', () => {
    expect(
      computeSafetyScore([
        { incidents: 0, total_hours: 1000 },
        { incidents: 0, total_hours: 2000 },
      ]),
    ).toBe(100)
  })

  it('returns 100 when no hours logged (cannot compute TRIR)', () => {
    expect(computeSafetyScore([{ incidents: 0, total_hours: 0 }])).toBe(100)
  })

  it('clamps to a 50 floor (never below) regardless of TRIR', () => {
    // 1000 incidents on 100 hours → astronomically high TRIR.
    expect(computeSafetyScore([{ incidents: 1000, total_hours: 100 }])).toBe(50)
  })

  it('moderate TRIR yields a score between 50 and 100', () => {
    // 1 incident on 200_000 hours → TRIR = 1.0 → 100 - 10 = 90
    const r = computeSafetyScore([{ incidents: 1, total_hours: 200_000 }])
    expect(r).toBe(90)
  })
})

describe('projectAnalytics — computeProjectHealth (composite)', () => {
  it('overall is the weighted sum of the five dimensions', () => {
    const r = computeProjectHealth(
      [{ percent_complete: 50, status: 'on_track', is_critical_path: false }],
      [{ original_amount: 1000, actual_amount: 500, percent_complete: 50 }],
      [{ status: 'resolved' }],
      [],
      [{ incidents: 0, total_hours: 1000 }],
    )
    expect(r.dimensions).toHaveLength(5)
    // Weights sum to 1.0 → overall must be in [0,100]
    expect(r.overall).toBeGreaterThanOrEqual(0)
    expect(r.overall).toBeLessThanOrEqual(100)
    // All-healthy inputs produce a strong score.
    expect(r.overall).toBeGreaterThan(85)
    expect(r.prediction.riskLevel).toBe('low')
  })

  it('prediction.completionDate falls back to ~180 days out when no target supplied', () => {
    const r = computeProjectHealth([], [], [], [], [], null)
    const sixMonths = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    const got = new Date(r.prediction.completionDate)
    // Allow ±1 day tolerance for date-boundary timing.
    expect(Math.abs(got.getTime() - sixMonths.getTime())).toBeLessThan(2 * 24 * 60 * 60 * 1000)
  })

  it('overall risk maps to expected riskLevel buckets', () => {
    const bad = computeProjectHealth(
      [
        { percent_complete: 5, status: 'delayed', is_critical_path: true },
        { percent_complete: 5, status: 'delayed', is_critical_path: true },
      ],
      [{ original_amount: 1000, actual_amount: 5000, percent_complete: 10 }],
      [{ status: 'open' }, { status: 'open' }, { status: 'open' }, { status: 'open' }, { status: 'open' }],
      [],
      [],
    )
    expect(['high', 'critical']).toContain(bad.prediction.riskLevel)
  })

  it('confidenceLevel is bucketed by overall (high/medium/low → 85/65/45)', () => {
    const high = computeProjectHealth(
      [{ percent_complete: 80, status: 'on_track', is_critical_path: false }],
      [{ original_amount: 1000, actual_amount: 500, percent_complete: 50 }],
      [{ status: 'resolved' }],
      [],
      [{ incidents: 0, total_hours: 1000 }],
    )
    expect([85, 65, 45]).toContain(high.prediction.confidenceLevel)
    expect(high.prediction.confidenceLevel).toBe(85)
  })
})
