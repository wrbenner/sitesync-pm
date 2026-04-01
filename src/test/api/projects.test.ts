import { describe, it, expect } from 'vitest'
import { computeHealthScoreFromMetrics, computeMetricsConfidence } from '../../api/endpoints/projects'
import type { ProjectMetrics } from '../../types/api'

function makeMetrics(overrides: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    project_id: 'proj-1',
    project_name: 'Test Project',
    contract_value: 1_000_000,
    overall_progress: 50,
    milestones_completed: 3,
    milestones_total: 10,
    schedule_variance_days: 0,
    rfis_open: 2,
    rfis_overdue: 0,
    rfis_total: 5,
    avg_rfi_response_days: 3,
    punch_open: 4,
    punch_total: 10,
    budget_total: 900_000,
    budget_spent: 450_000,
    budget_committed: 50_000,
    crews_active: 3,
    workers_onsite: 12,
    safety_incidents_this_month: 0,
    submittals_pending: 1,
    submittals_approved: 8,
    submittals_total: 10,
    ...overrides,
  }
}

describe('computeHealthScoreFromMetrics', () => {
  it('returns 100 when on schedule, on budget, and no overdue RFIs', () => {
    const metrics = makeMetrics({ schedule_variance_days: 0, rfis_overdue: 0 })
    expect(computeHealthScoreFromMetrics(metrics)).toBe(100)
  })

  it('reduces score when RFIs are overdue', () => {
    const baseline = makeMetrics({ rfis_overdue: 0 })
    const overdue = makeMetrics({ rfis_overdue: 5 })
    const baseScore = computeHealthScoreFromMetrics(baseline)
    const overdueScore = computeHealthScoreFromMetrics(overdue)
    expect(overdueScore).toBeLessThan(baseScore)
  })

  it('8 overdue RFIs reduce health score below 85', () => {
    // rfiHealth = 100*(1-8/10) = 20, weighted 0.20 => 4
    // perfect schedule (100*0.35=35), budget (100*0.35=35), safety (100*0.10=10): total = 84
    const metrics = makeMetrics({ rfis_overdue: 8, schedule_variance_days: 0 })
    const score = computeHealthScoreFromMetrics(metrics)
    expect(score).toBeLessThan(85)
  })

  it('reduces score when budget is overspent', () => {
    // budget_spent 10% over budget_total => budgetHealth = 0
    // schedule (100*0.35) + budget (0*0.35) + rfi (100*0.20) + safety (100*0.10) = 35+0+20+10 = 65
    const metrics = makeMetrics({ budget_spent: 990_000, budget_total: 900_000 })
    const score = computeHealthScoreFromMetrics(metrics)
    expect(score).toBe(65)
  })

  it('schedule variance of 10 days reduces schedule component', () => {
    // scheduleHealth = 100*(1-10/20) = 50 => 50*0.35=17.5
    // budget on track (100*0.35=35), rfi clean (100*0.20=20), safety clean (100*0.10=10) => 82.5 => 83
    const metrics = makeMetrics({ schedule_variance_days: 10, rfis_overdue: 0 })
    const score = computeHealthScoreFromMetrics(metrics)
    expect(score).toBe(83)
  })

  it('clamps to 0 when all components are at or beyond their thresholds', () => {
    // schedule >= 20 days, budget >= 10% overrun, rfis_overdue >= 10, incidents >= 3
    const metrics = makeMetrics({
      schedule_variance_days: 20,
      rfis_overdue: 10,
      budget_spent: 990_000,
      budget_total: 900_000,
      safety_incidents_this_month: 3,
    })
    expect(computeHealthScoreFromMetrics(metrics)).toBe(0)
  })
})

describe('computeMetricsConfidence', () => {
  it('returns 100 when all fields are populated', () => {
    const metrics = makeMetrics()
    expect(computeMetricsConfidence(metrics)).toBe(100)
  })

  it('returns less than 100 when nullable fields are null', () => {
    const metrics = makeMetrics({ schedule_variance_days: null, rfis_overdue: null, punch_open: null })
    expect(computeMetricsConfidence(metrics)).toBeLessThan(100)
  })

  it('scales linearly with number of non-null fields', () => {
    // 19 total fields; null out 1 => 18/19 ~ 94.7 => 95
    const metrics = makeMetrics({ schedule_variance_days: null })
    const confidence = computeMetricsConfidence(metrics)
    expect(confidence).toBeGreaterThan(90)
    expect(confidence).toBeLessThan(100)
  })

  it('returns null when all completeness fields are absent (e.g. newly created row with no data)', () => {
    // Simulate a DB row where every completeness field is missing — only identity fields present.
    // This can happen when the materialized view has not yet populated for a brand-new project.
    const empty = { project_id: 'proj-empty', project_name: 'Empty Project' } as ProjectMetrics
    expect(computeMetricsConfidence(empty)).toBeNull()
  })
})

describe('computeHealthScoreFromMetrics null cases', () => {
  it('returns null when schedule_variance_days and rfis_overdue are null and budget_total is 0', () => {
    // All three health-relevant indicators are absent — result must be null, not a fake perfect score.
    const empty = makeMetrics({
      schedule_variance_days: null,
      rfis_overdue: null,
      budget_total: 0,
      budget_spent: 0,
    })
    expect(computeHealthScoreFromMetrics(empty)).toBeNull()
  })

  it('returns a number (not null) when at least budget data is present', () => {
    const metrics = makeMetrics({ schedule_variance_days: null, rfis_overdue: null })
    expect(computeHealthScoreFromMetrics(metrics)).not.toBeNull()
  })
})
