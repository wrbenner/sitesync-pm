import { describe, it, expect } from 'vitest'
import {
  riskLevel,
  riskColor,
  computeRFIRisk,
  computeBudgetRisk,
  computeScheduleRisk,
  computeSafetyRisk,
  overallProjectRisk,
} from './riskEngine'

describe('riskEngine — riskLevel + riskColor', () => {
  it.each([
    [0, 'low', '#10B981'],
    [25, 'low', '#10B981'],
    [26, 'medium', '#F59E0B'],
    [50, 'medium', '#F59E0B'],
    [51, 'high', '#F97316'],
    [75, 'high', '#F97316'],
    [76, 'critical', '#EF4444'],
    [100, 'critical', '#EF4444'],
  ] as const)('score %i → %s / %s', (score, level, color) => {
    expect(riskLevel(score)).toBe(level)
    expect(riskColor(score)).toBe(color)
  })
})

describe('riskEngine — computeRFIRisk', () => {
  it('returns low risk for a fresh, non-critical RFI with good responder rate', () => {
    const r = computeRFIRisk({
      id: 'r1',
      created_at: new Date().toISOString(),
      assignee_response_rate: 0.95,
      on_critical_path: false,
      priority: 'low',
      returned_count: 0,
      avg_response_days: 7,
    })
    expect(r.level).toBe('low')
    expect(r.factors).toHaveLength(5)
  })

  it('escalates risk when RFI sits open longer than the average response window', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const r = computeRFIRisk({
      id: 'r2',
      created_at: tenDaysAgo,
      assignee_response_rate: 0.5,
      on_critical_path: true,
      priority: 'critical',
      returned_count: 1,
      avg_response_days: 5,
    })
    // Composite should be high — open ratio capped at 100, critical path 100,
    // priority 100, responder 50, returned 50 → weighted ≈ high.
    expect(r.score).toBeGreaterThan(50)
    expect(r.level === 'high' || r.level === 'critical').toBe(true)
  })

  it('default values kick in when optional fields are missing', () => {
    // No avg_response_days, no responder rate, no critical path flag.
    const r = computeRFIRisk({
      id: 'r3',
      created_at: new Date().toISOString(),
    })
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })
})

describe('riskEngine — computeBudgetRisk', () => {
  it('reports low risk for a project with healthy burn rate', () => {
    const r = computeBudgetRisk({
      budget: 1_000_000,
      actual: 200_000,
      committed: 100_000,
      change_order_count_30d: 0,
      forecast: 1_000_000,
      elapsed_fraction: 0.4,
    })
    expect(r.level).toBe('low')
  })

  it('escalates with high consumption + frequent change orders', () => {
    const r = computeBudgetRisk({
      budget: 1_000_000,
      actual: 950_000,
      committed: 100_000,           // total spent = 1.05M, over budget
      change_order_count_30d: 5,
      forecast: 1_300_000,
      elapsed_fraction: 0.6,
    })
    expect(r.score).toBeGreaterThan(50)
  })

  it('does not divide-by-zero when budget is 0', () => {
    const r = computeBudgetRisk({
      budget: 0,
      actual: 100,
      committed: 0,
    })
    expect(Number.isFinite(r.score)).toBe(true)
  })
})

describe('riskEngine — computeScheduleRisk', () => {
  it('low risk when on track with sufficient float', () => {
    const r = computeScheduleRisk({
      id: 's1',
      percent_complete: 50,
      expected_percent: 48,
      float_days: 15,
      predecessors_complete: true,
      weather_dependent: false,
      resource_conflicts: 0,
    })
    expect(r.level).toBe('low')
  })

  it('high risk when behind schedule with no float and blocked predecessors', () => {
    const r = computeScheduleRisk({
      id: 's2',
      percent_complete: 20,
      expected_percent: 80,
      float_days: 0,
      predecessors_complete: false,
      weather_dependent: true,
      season_risk: 0.8,
      resource_conflicts: 2,
    })
    expect(r.score).toBeGreaterThan(50)
  })
})

describe('riskEngine — computeSafetyRisk', () => {
  it('higher risk recently after an incident vs many days clean', () => {
    const recent = computeSafetyRisk({
      days_since_last_incident: 1,
      inspections_required_30d: 10,
      inspections_completed_30d: 10,
      open_corrective_actions: 0,
      certs_expiring_30d: 0,
      trir_trend: 0,
    })
    const long = computeSafetyRisk({
      days_since_last_incident: 90,
      inspections_required_30d: 10,
      inspections_completed_30d: 10,
      open_corrective_actions: 0,
      certs_expiring_30d: 0,
      trir_trend: 0,
    })
    expect(recent.score).toBeGreaterThan(long.score)
  })

  it('open corrective actions and missed inspections both raise the score', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 30,
      inspections_required_30d: 10,
      inspections_completed_30d: 2,
      open_corrective_actions: 4,
      certs_expiring_30d: 3,
      trir_trend: 1,
    })
    expect(r.score).toBeGreaterThan(50)
  })
})

describe('riskEngine — overallProjectRisk', () => {
  it('returns 0 when no categories are populated', () => {
    expect(overallProjectRisk({})).toBe(0)
  })

  it('averages only the populated categories', () => {
    expect(overallProjectRisk({ rfi: 80, budget: 40 })).toBe(60)
    // safety and schedule omitted → not counted.
    expect(overallProjectRisk({ safety: 100 })).toBe(100)
  })
})
