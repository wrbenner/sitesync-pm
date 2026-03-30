import { describe, it, expect } from 'vitest'
import { computeScheduleScore, computeCostScore, computeQualityScore, computeSafetyScore, computeProjectHealth } from '../../lib/projectAnalytics'

describe('Schedule Score', () => {
  it('returns 100 for empty phases', () => {
    expect(computeScheduleScore([])).toBe(100)
  })

  it('returns 100 for all on-track phases', () => {
    const phases = [
      { percent_complete: 50, status: 'active', is_critical_path: false },
      { percent_complete: 100, status: 'completed', is_critical_path: false },
    ]
    expect(computeScheduleScore(phases)).toBe(100)
  })

  it('penalizes at-risk phases', () => {
    const phases = [
      { percent_complete: 50, status: 'active', is_critical_path: false },
      { percent_complete: 30, status: 'at_risk', is_critical_path: false },
    ]
    expect(computeScheduleScore(phases)).toBeLessThan(100)
  })

  it('heavily penalizes critical path delays', () => {
    const phases = [
      { percent_complete: 50, status: 'active', is_critical_path: false },
      { percent_complete: 30, status: 'delayed', is_critical_path: true },
    ]
    expect(computeScheduleScore(phases)).toBeLessThan(70)
  })
})

describe('Cost Score', () => {
  it('returns 100 for empty budget', () => {
    expect(computeCostScore([])).toBe(100)
  })

  it('returns high score for under-budget items', () => {
    const items = [{ original_amount: 100000, actual_amount: 50000, percent_complete: 60 }]
    expect(computeCostScore(items)).toBeGreaterThan(80)
  })

  it('returns lower score for over-budget items', () => {
    const items = [{ original_amount: 100000, actual_amount: 90000, percent_complete: 50 }]
    expect(computeCostScore(items)).toBeLessThan(80)
  })
})

describe('Quality Score', () => {
  it('returns 100 for no punch items', () => {
    expect(computeQualityScore([], [])).toBe(100)
  })

  it('higher score with more closed punch items', () => {
    const punch = [{ status: 'resolved' }, { status: 'verified' }, { status: 'open' }]
    expect(computeQualityScore(punch, [])).toBeGreaterThan(70)
  })

  it('penalizes overdue RFIs', () => {
    const rfis = [{ status: 'open', due_date: '2020-01-01' }, { status: 'open', due_date: '2020-01-01' }]
    expect(computeQualityScore([], rfis)).toBeLessThan(100)
  })
})

describe('Safety Score', () => {
  it('returns 100 for no incidents', () => {
    const logs = [{ incidents: 0, total_hours: 1000 }]
    expect(computeSafetyScore(logs)).toBe(100)
  })

  it('penalizes incidents', () => {
    const logs = [{ incidents: 2, total_hours: 10000 }]
    expect(computeSafetyScore(logs)).toBeLessThan(100)
  })
})

describe('Project Health', () => {
  it('computes overall score with all dimensions', () => {
    const result = computeProjectHealth(
      [{ percent_complete: 65, status: 'active', is_critical_path: true }],
      [{ original_amount: 1000000, actual_amount: 600000, percent_complete: 65 }],
      [{ status: 'open' }, { status: 'resolved' }],
      [{ status: 'open', due_date: '2027-01-01' }],
      [{ incidents: 0, total_hours: 5000 }],
      '2027-03-31'
    )
    expect(result.overall).toBeGreaterThan(0)
    expect(result.overall).toBeLessThanOrEqual(100)
    expect(result.dimensions).toHaveLength(5)
    expect(result.prediction.riskLevel).toBeDefined()
    expect(result.prediction.finalCost).toBeGreaterThan(0)
  })
})
