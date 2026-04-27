import { describe, it, expect } from 'vitest'
import { computeAiConfidenceLevel, computeProjectHealthScore, HEALTH_WEIGHTS } from './healthScoring'
import type { ProjectMetrics } from '../types/api'

// Builds a fully-populated metrics row; tests override individual fields
// to isolate the component they're exercising.
function metrics(overrides: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    project_id: 'p',
    project_name: 'P',
    contract_value: 1_000_000,
    overall_progress: 50,
    milestones_completed: 5,
    milestones_total: 10,
    schedule_variance_days: 0,
    rfis_open: 0,
    rfis_overdue: 0,
    rfis_total: 1,
    avg_rfi_response_days: 0,
    punch_open: 0,
    punch_total: 1,
    budget_total: 1000,
    budget_spent: 500,
    budget_committed: 0,
    crews_active: 0,
    workers_onsite: 0,
    safety_incidents_this_month: 0,
    submittals_pending: 0,
    submittals_approved: 0,
    submittals_total: 0,
    ...overrides,
  }
}

describe('healthScoring — HEALTH_WEIGHTS', () => {
  it('weights sum to exactly 1.0 (otherwise scoring is biased)', () => {
    const sum = Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })
})

describe('healthScoring — computeAiConfidenceLevel', () => {
  it('returns null when fewer than 3 sources are populated', () => {
    // Only schedule + safety populated → 2 sources, below MIN_DATA_SOURCES
    const r = computeAiConfidenceLevel(
      metrics({
        schedule_variance_days: 5,
        budget_total: 0,        // not populated (>0 check)
        rfis_total: 0,          // not populated
        punch_total: 0,         // not populated
        safety_incidents_this_month: 1,
      }),
    )
    expect(r).toBeNull()
  })

  it('returns 60% when 3 of 5 sources are populated (3/5 = 60%)', () => {
    const r = computeAiConfidenceLevel(
      metrics({
        schedule_variance_days: 1,
        budget_total: 500,
        rfis_total: 5,
        punch_total: 0,
        safety_incidents_this_month: null as unknown as number,
      }),
    )
    expect(r).toBe(60)
  })

  it('returns 100 when all five sources are populated', () => {
    const r = computeAiConfidenceLevel(
      metrics({
        schedule_variance_days: 1,
        budget_total: 1,
        rfis_total: 1,
        punch_total: 1,
        safety_incidents_this_month: 1,
      }),
    )
    expect(r).toBe(100)
  })
})

describe('healthScoring — computeProjectHealthScore', () => {
  it('returns null when none of schedule/budget/RFI are populated', () => {
    const r = computeProjectHealthScore(
      metrics({
        schedule_variance_days: null,
        budget_total: 0,
        rfis_overdue: null,
      }),
    )
    expect(r).toBeNull()
  })

  it('returns ≥99 for a perfect project (no variance, no overdue, on budget)', () => {
    const r = computeProjectHealthScore(
      metrics({
        schedule_variance_days: 0,
        budget_total: 1000,
        budget_spent: 1000,    // exactly at budget = 0 overrun
        rfis_overdue: 0,
        punch_total: 10,
        punch_open: 0,
        safety_incidents_this_month: 0,
      }),
    )
    expect(r).toBeGreaterThanOrEqual(99)
  })

  it('drives schedule component to 0 when variance ≥ 20 days behind', () => {
    const baseline = computeProjectHealthScore(metrics({ schedule_variance_days: 0 }))!
    const tanked = computeProjectHealthScore(metrics({ schedule_variance_days: 25 }))!
    // Schedule weight is 25%; baseline schedule = 100, tanked = 0
    // → expect ≈25-point drop
    expect(baseline - tanked).toBeGreaterThan(20)
    expect(baseline - tanked).toBeLessThan(30)
  })

  it('treats negative variance (ahead of schedule) as fully healthy', () => {
    const ahead = computeProjectHealthScore(metrics({ schedule_variance_days: -5 }))!
    const onTime = computeProjectHealthScore(metrics({ schedule_variance_days: 0 }))!
    expect(ahead).toBe(onTime)
  })

  it('drives budget component to 0 when overrun ≥ 10%', () => {
    const baseline = computeProjectHealthScore(metrics({ budget_total: 1000, budget_spent: 1000 }))!
    const tanked = computeProjectHealthScore(metrics({ budget_total: 1000, budget_spent: 1500 }))!
    // Budget weight is 30%; expect ≈30-point drop
    expect(baseline - tanked).toBeGreaterThan(25)
  })

  it('punch component is 100 when punch_total is 0 (no work to evaluate)', () => {
    const r = computeProjectHealthScore(
      metrics({
        schedule_variance_days: 0,
        budget_total: 1000,
        budget_spent: 0,
        rfis_overdue: 0,
        punch_total: 0,
        punch_open: 0,
      }),
    )!
    // All other components also healthy → near-100
    expect(r).toBeGreaterThanOrEqual(99)
  })

  it('rounds to an integer (no fractional output)', () => {
    const r = computeProjectHealthScore(
      metrics({ schedule_variance_days: 7, budget_spent: 1075 }),
    )!
    expect(Number.isInteger(r)).toBe(true)
  })
})
