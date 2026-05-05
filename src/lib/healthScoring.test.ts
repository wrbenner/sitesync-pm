import { describe, it, expect } from 'vitest'
import {
  HEALTH_WEIGHTS,
  computeAiConfidenceLevel,
  computeProjectHealthScore,
} from './healthScoring'
import type { ProjectMetrics } from '../types/api'

const baseMetrics = (overrides: Partial<ProjectMetrics> = {}): ProjectMetrics =>
  ({
    schedule_variance_days: 0,
    budget_total: 100_000,
    budget_spent: 50_000,
    rfis_total: 5,
    rfis_overdue: 0,
    punch_total: 10,
    punch_open: 0,
    safety_incidents_this_month: 0,
    ...overrides,
  } as ProjectMetrics)

describe('HEALTH_WEIGHTS', () => {
  it('sums to 1', () => {
    const sum =
      HEALTH_WEIGHTS.schedule +
      HEALTH_WEIGHTS.budget +
      HEALTH_WEIGHTS.rfi +
      HEALTH_WEIGHTS.punch +
      HEALTH_WEIGHTS.safety
    expect(sum).toBeCloseTo(1, 6)
  })
})

describe('computeAiConfidenceLevel', () => {
  it('returns null when fewer than 3 dimensions populated', () => {
    expect(
      computeAiConfidenceLevel(
        baseMetrics({
          schedule_variance_days: null,
          budget_total: 0,
          rfis_total: 0,
          punch_total: 0,
          safety_incidents_this_month: null,
        }),
      ),
    ).toBeNull()
  })

  it('returns null with exactly 2 dimensions populated', () => {
    expect(
      computeAiConfidenceLevel(
        baseMetrics({
          schedule_variance_days: 0,
          budget_total: 100,
          rfis_total: 0,
          punch_total: 0,
          safety_incidents_this_month: null,
        }),
      ),
    ).toBeNull()
  })

  it('returns 60 (3/5) for three populated', () => {
    expect(
      computeAiConfidenceLevel(
        baseMetrics({
          schedule_variance_days: 0,
          budget_total: 100,
          rfis_total: 1,
          punch_total: 0,
          safety_incidents_this_month: null,
        }),
      ),
    ).toBe(60)
  })

  it('returns 100 with all five populated', () => {
    expect(computeAiConfidenceLevel(baseMetrics())).toBe(100)
  })
})

describe('computeProjectHealthScore', () => {
  it('returns null when all primary indicators missing', () => {
    expect(
      computeProjectHealthScore(
        baseMetrics({
          schedule_variance_days: null,
          budget_total: 0,
          rfis_overdue: null,
        }),
      ),
    ).toBeNull()
  })

  it('returns 100 for a perfectly healthy project', () => {
    expect(computeProjectHealthScore(baseMetrics())).toBe(100)
  })

  it('treats negative schedule variance (ahead) as healthy', () => {
    expect(
      computeProjectHealthScore(baseMetrics({ schedule_variance_days: -5 })),
    ).toBe(100)
  })

  it('penalises schedule variance up to threshold', () => {
    const score = computeProjectHealthScore(
      baseMetrics({ schedule_variance_days: 20 }),
    )!
    // schedule contributes 0/100 of its 25% weight; remaining components = 75
    expect(score).toBe(75)
  })

  it('caps schedule penalty at threshold (no further drop past 20 days)', () => {
    const a = computeProjectHealthScore(
      baseMetrics({ schedule_variance_days: 20 }),
    )
    const b = computeProjectHealthScore(
      baseMetrics({ schedule_variance_days: 200 }),
    )
    expect(a).toBe(b)
  })

  it('penalises budget overrun proportionally', () => {
    const score = computeProjectHealthScore(
      baseMetrics({ budget_total: 100, budget_spent: 110 }),
    )!
    // 10% overrun = full budget penalty (30%) → 70
    expect(score).toBe(70)
  })

  it('penalises rfi overdue', () => {
    const score = computeProjectHealthScore(
      baseMetrics({ rfis_overdue: 10 }),
    )!
    // 10 overdue maxes out RFI penalty (20% weight) → 80
    expect(score).toBe(80)
  })

  it('treats zero punch_total as 100% punch health', () => {
    expect(
      computeProjectHealthScore(
        baseMetrics({ punch_total: 0, punch_open: 0 }),
      ),
    ).toBe(100)
  })

  it('penalises punch open ratio', () => {
    const score = computeProjectHealthScore(
      baseMetrics({ punch_total: 10, punch_open: 10 }),
    )!
    // all punch open → punch=0 (15% weight) → 85
    expect(score).toBe(85)
  })

  it('penalises safety incidents up to threshold', () => {
    const score = computeProjectHealthScore(
      baseMetrics({ safety_incidents_this_month: 3 }),
    )!
    // 3 incidents = full safety penalty (10% weight) → 90
    expect(score).toBe(90)
  })

  it('returns 100 when only schedule data present (others default healthy)', () => {
    expect(
      computeProjectHealthScore(
        baseMetrics({
          schedule_variance_days: 0,
          budget_total: 0,
          rfis_overdue: null,
          rfis_total: 0,
          punch_total: 0,
          safety_incidents_this_month: null,
        }),
      ),
    ).toBe(100)
  })
})
