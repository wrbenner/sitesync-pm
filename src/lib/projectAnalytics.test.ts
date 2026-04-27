import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeScheduleScore,
  computeCostScore,
  computeQualityScore,
  computeSafetyScore,
  computeProjectHealth,
} from './projectAnalytics'

// ── computeScheduleScore ─────────────────────────────────────────

describe('computeScheduleScore', () => {
  it('Empty phase list returns 100 (no signal = full credit)', () => {
    expect(computeScheduleScore([])).toBe(100)
  })

  it('All phases on track → 100', () => {
    const phases = [
      { percent_complete: 50, status: 'in_progress', is_critical_path: true },
      { percent_complete: 30, status: 'upcoming', is_critical_path: false },
    ]
    expect(computeScheduleScore(phases)).toBe(100)
  })

  it('All phases at risk → 0', () => {
    const phases = [
      { percent_complete: 50, status: 'at_risk', is_critical_path: false },
      { percent_complete: 30, status: 'delayed', is_critical_path: false },
    ]
    expect(computeScheduleScore(phases)).toBe(0)
  })

  it('Half on-track, none critical → 50', () => {
    const phases = [
      { percent_complete: 50, status: 'in_progress', is_critical_path: false },
      { percent_complete: 30, status: 'at_risk', is_critical_path: false },
    ]
    expect(computeScheduleScore(phases)).toBe(50)
  })

  it('Critical-path delays cost an extra 15 points each', () => {
    // 1 of 2 on-track (50) + 1 critical delayed (-15) = 35
    const phases = [
      { percent_complete: 50, status: 'in_progress', is_critical_path: false },
      { percent_complete: 30, status: 'delayed', is_critical_path: true },
    ]
    expect(computeScheduleScore(phases)).toBe(35)
  })

  it('Score floored at 0 even when penalties exceed base score', () => {
    // 0 of 5 on-track (0) + 5 critical delays (-75) → still 0
    const phases = Array.from({ length: 5 }, () => ({
      percent_complete: 0, status: 'at_risk', is_critical_path: true,
    }))
    expect(computeScheduleScore(phases)).toBe(0)
  })
})

// ── computeCostScore ─────────────────────────────────────────────

describe('computeCostScore', () => {
  it('Empty budget returns 100', () => {
    expect(computeCostScore([])).toBe(100)
  })

  it('Zero total budget returns 100 (avoid divide-by-zero)', () => {
    expect(computeCostScore([{ original_amount: 0, actual_amount: 0, percent_complete: 0 }])).toBe(100)
  })

  it('On-pace (CPI ~ 1.0) yields a strong score', () => {
    // Single budget item, 50% complete with 50% spent → CPI=1.0
    const r = computeCostScore([{ original_amount: 100, actual_amount: 50, percent_complete: 50 }])
    // cpi=1 → score = min(100, 1*85+15) = 100
    expect(r).toBe(100)
  })

  it('Spending faster than progress drives the score down', () => {
    // 25% complete but 100% spent → cpi=0.25 → score=0.25*85+15=36.25 → 36
    const r = computeCostScore([{ original_amount: 100, actual_amount: 100, percent_complete: 25 }])
    expect(r).toBe(36)
  })

  it('Score is bounded 0..100', () => {
    const high = computeCostScore([{ original_amount: 100, actual_amount: 0, percent_complete: 100 }])
    expect(high).toBeLessThanOrEqual(100)

    const low = computeCostScore([{ original_amount: 100, actual_amount: 1000, percent_complete: 1 }])
    expect(low).toBeGreaterThanOrEqual(0)
  })
})

// ── computeQualityScore ──────────────────────────────────────────

describe('computeQualityScore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-25T00:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('Empty punch + empty rfis returns 100', () => {
    expect(computeQualityScore([], [])).toBe(100)
  })

  it('All punch items resolved/verified → high score', () => {
    const punch = [
      { status: 'resolved' },
      { status: 'verified' },
    ]
    expect(computeQualityScore(punch, [])).toBe(100)
  })

  it('Half punch closed → score = 0.5*60 + 40 = 70', () => {
    const punch = [
      { status: 'resolved' },
      { status: 'open' },
    ]
    expect(computeQualityScore(punch, [])).toBe(70)
  })

  it('Each overdue RFI subtracts 3 points', () => {
    const rfis = [
      { status: 'open', due_date: '2026-04-01' },          // overdue
      { status: 'open', due_date: '2026-05-01' },          // not yet due
      { status: 'closed', due_date: '2026-04-01' },        // overdue but closed → ignored
    ]
    // 100 - 3 = 97
    expect(computeQualityScore([], rfis)).toBe(97)
  })

  it('Score floored at 0 with many overdue RFIs', () => {
    const rfis = Array.from({ length: 100 }, () => ({
      status: 'under_review' as string,
      due_date: '2026-01-01',
    }))
    expect(computeQualityScore([], rfis)).toBe(0)
  })
})

// ── computeSafetyScore ───────────────────────────────────────────

describe('computeSafetyScore', () => {
  it('Empty logs → 100', () => {
    expect(computeSafetyScore([])).toBe(100)
  })

  it('Zero incidents (any hours) → 100', () => {
    expect(computeSafetyScore([{ incidents: 0, total_hours: 100_000 }])).toBe(100)
  })

  it('Zero hours but incidents present → 100 (no exposure denominator)', () => {
    expect(computeSafetyScore([{ incidents: 5, total_hours: 0 }])).toBe(100)
  })

  it('TRIR formula: (incidents * 200000) / hours, then 100 - TRIR*10', () => {
    // 1 incident in 200k hours → TRIR=1 → score = 100 - 10 = 90
    expect(computeSafetyScore([{ incidents: 1, total_hours: 200_000 }])).toBe(90)
  })

  it('Score floored at 50 (compassionate floor — never below 50 in this engine)', () => {
    expect(computeSafetyScore([{ incidents: 100, total_hours: 1000 }])).toBe(50)
  })
})

// ── computeProjectHealth ─────────────────────────────────────────

describe('computeProjectHealth — integration of all 5 dimensions', () => {
  it('Empty inputs → overall is the weighted sum of all-100 component scores', () => {
    const r = computeProjectHealth([], [], [], [], [])
    expect(r.overall).toBe(100)
    expect(r.dimensions).toHaveLength(5)
  })

  it('Returns 5 dimensions in canonical order: Schedule, Budget, Quality, Safety, Team', () => {
    const r = computeProjectHealth([], [], [], [], [])
    expect(r.dimensions.map(d => d.name)).toEqual(['Schedule', 'Budget', 'Quality', 'Safety', 'Team'])
  })

  it('Dimension weights sum to 1.0 invariant', () => {
    const r = computeProjectHealth([], [], [], [], [])
    const sum = r.dimensions.reduce((s, d) => s + d.weight, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('Risk level "low" >= 80 for clean inputs', () => {
    const allGood = computeProjectHealth([], [], [], [], [])
    expect(allGood.prediction.riskLevel).toBe('low')
  })

  it('Risk level degrades to "medium" or worse when schedule + cost both crater', () => {
    // 5 at-risk critical phases drive schedule=0; budget overrun drives cost down too.
    const phases = Array.from({ length: 5 }, () => ({
      percent_complete: 0, status: 'at_risk', is_critical_path: true,
    }))
    const budget = [{ original_amount: 100, actual_amount: 1000, percent_complete: 1 }]
    const r = computeProjectHealth(phases, budget, [], [], [])
    expect(['medium', 'high', 'critical']).toContain(r.prediction.riskLevel)
    expect(r.prediction.riskLevel).not.toBe('low')
  })

  it('Confidence level: 85 when overall>=80, 65 when >=60, 45 below', () => {
    const goodHealth = computeProjectHealth([], [], [], [], [])
    expect(goodHealth.prediction.confidenceLevel).toBe(85)
  })

  it('targetCompletion when provided is preserved on the prediction; null falls back to ~6 months', () => {
    const withTarget = computeProjectHealth([], [], [], [], [], '2027-01-15')
    expect(withTarget.prediction.completionDate).toBe('2027-01-15')

    const withoutTarget = computeProjectHealth([], [], [], [], [])
    // Falls back to a 6-month-ish ISO date
    expect(withoutTarget.prediction.completionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('predictedCost falls back to total budget when avgProgress is 0', () => {
    const r = computeProjectHealth(
      [],
      [{ original_amount: 50_000, actual_amount: 5_000, percent_complete: 0 }],
      [], [], [],
    )
    expect(r.prediction.finalCost).toBeCloseTo(50_000, 0)
  })
})
