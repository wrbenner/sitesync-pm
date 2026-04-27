import { describe, it, expect } from 'vitest'
import {
  calculateSafetyScore,
  calculateTrend,
  calculateEMR,
  calculateDARTRate,
  type SafetyScoreInput,
} from './safetyScoring'

// A "perfect" baseline: zero incidents, full closure, 100% compliance.
function perfectInput(): SafetyScoreInput {
  return {
    recordableIncidents: 0,
    totalWorkHours: 200_000,
    daysWithoutIncident: 100,
    nearMissCount: 0,
    totalCorrectiveActions: 10,
    closedCorrectiveActions: 10,
    overdueCorrectiveActions: 0,
    totalObservations: 100,
    compliantObservations: 100,
    violationObservations: 0,
    totalInspections: 20,
    passedInspections: 20,
    failedInspections: 0,
    totalWorkers: 50,
    workersWithValidCerts: 50,
    expiringCertsCount: 0,
    expiredCertsCount: 0,
  }
}

describe('safetyScoring — calculateSafetyScore', () => {
  it('a perfect input yields grade A and risk level low', () => {
    const r = calculateSafetyScore(perfectInput())
    expect(r.overall).toBeGreaterThanOrEqual(95)
    expect(r.grade).toBe('A')
    expect(r.riskLevel).toBe('low')
  })

  it('a clean record produces the "all metrics within target" recommendation', () => {
    const r = calculateSafetyScore(perfectInput())
    expect(r.recommendations).toEqual([
      'All safety metrics are within target range. Maintain current safety program.',
    ])
  })

  it('high TRIR drops grade and flags below_average benchmark', () => {
    // 10 incidents on 200k hours → TRIR = 10. Industry avg is 3.1, so below_average.
    const r = calculateSafetyScore({
      ...perfectInput(),
      recordableIncidents: 10,
    })
    expect(r.benchmarkComparison).toBe('below_average')
    expect(r.components.incidentRate.trir).toBeCloseTo(10, 1)
    expect(r.grade).not.toBe('A')
  })

  it('TRIR below the industry-best threshold flags above_average benchmark', () => {
    // 0.5 incidents @ 200k hours → TRIR = 0.5 < INDUSTRY_TRIR_BEST (1.0)
    // Use 1 incident on 400k hours to get TRIR = 0.5
    const r = calculateSafetyScore({
      ...perfectInput(),
      recordableIncidents: 1,
      totalWorkHours: 400_000,
    })
    expect(r.benchmarkComparison).toBe('above_average')
  })

  it('overdue corrective actions reduce caScore by 5 each and surface a recommendation past threshold', () => {
    const baseline = calculateSafetyScore(perfectInput())
    // 3 overdue → caScore drops 15 (still 85, no rec).
    const mild = calculateSafetyScore({ ...perfectInput(), overdueCorrectiveActions: 3 })
    expect(baseline.overall - mild.overall).toBeGreaterThanOrEqual(2)

    // 5 overdue → caScore = 100 - 25 = 75, which is < 80 → rec fires.
    const heavy = calculateSafetyScore({ ...perfectInput(), overdueCorrectiveActions: 5 })
    expect(heavy.recommendations.some((r) => r.includes('corrective actions are overdue'))).toBe(true)
  })

  it('expired certifications trigger a stronger penalty than expiring certs', () => {
    const expired = calculateSafetyScore({
      ...perfectInput(),
      expiredCertsCount: 5,
    })
    const expiring = calculateSafetyScore({
      ...perfectInput(),
      expiringCertsCount: 5,
    })
    // expired = 5*10 = 50 penalty; expiring = 5*3 = 15 penalty
    expect(expired.overall).toBeLessThan(expiring.overall)
  })

  it('zero work hours does not divide-by-zero', () => {
    const r = calculateSafetyScore({
      ...perfectInput(),
      totalWorkHours: 0,
      recordableIncidents: 5, // ignored because hours = 0
    })
    expect(r.components.incidentRate.trir).toBe(0)
    expect(Number.isFinite(r.overall)).toBe(true)
  })

  it('zero inspections defaults pass rate to 100%', () => {
    const r = calculateSafetyScore({
      ...perfectInput(),
      totalInspections: 0,
      passedInspections: 0,
    })
    // No inspections → 100% pass rate; 0 frequency bonus.
    expect(r.components.inspections.passRate).toBe(100)
  })

  it('PPE non-compliance below 90% triggers a recommendation', () => {
    const r = calculateSafetyScore({
      ...perfectInput(),
      totalObservations: 100,
      compliantObservations: 80,
    })
    expect(r.recommendations.some((s) => /PPE compliance/i.test(s))).toBe(true)
    expect(r.components.ppeCompliance.complianceRate).toBe(80)
  })

  it('grade is F when overall is below 60', () => {
    const r = calculateSafetyScore({
      recordableIncidents: 30, // huge TRIR
      totalWorkHours: 100_000,
      daysWithoutIncident: 0,
      nearMissCount: 0,
      totalCorrectiveActions: 10,
      closedCorrectiveActions: 0,
      overdueCorrectiveActions: 10,
      totalObservations: 100,
      compliantObservations: 30,
      violationObservations: 70,
      totalInspections: 10,
      passedInspections: 1,
      failedInspections: 9,
      totalWorkers: 50,
      workersWithValidCerts: 10,
      expiredCertsCount: 5,
      expiringCertsCount: 10,
    })
    expect(r.grade).toBe('F')
    expect(r.riskLevel).toBe('critical')
  })
})

describe('safetyScoring — calculateTrend', () => {
  it('returns stable when fewer than 2 samples', () => {
    expect(calculateTrend([])).toBe('stable')
    expect(calculateTrend([{ date: '2026-01-01', score: 80 }])).toBe('stable')
  })

  it('returns improving when last - first is > 5', () => {
    expect(
      calculateTrend([
        { date: '2026-01-01', score: 70 },
        { date: '2026-01-02', score: 78 },
      ]),
    ).toBe('improving')
  })

  it('returns declining when last - first is < -5', () => {
    expect(
      calculateTrend([
        { date: '2026-01-01', score: 90 },
        { date: '2026-01-02', score: 80 },
      ]),
    ).toBe('declining')
  })

  it('only inspects the most recent 5 samples', () => {
    // Older improvement should be ignored if recent 5 are flat.
    const r = calculateTrend([
      { date: '2026-01-01', score: 50 },  // ignored — outside last 5
      { date: '2026-01-02', score: 80 },
      { date: '2026-01-03', score: 80 },
      { date: '2026-01-04', score: 80 },
      { date: '2026-01-05', score: 80 },
      { date: '2026-01-06', score: 80 },
    ])
    expect(r).toBe('stable')
  })
})

describe('safetyScoring — calculateEMR', () => {
  it('returns 1.0 when expectedLosses ≤ 0 (no baseline available)', () => {
    expect(calculateEMR(100, 0)).toBe(1.0)
    expect(calculateEMR(100, -5)).toBe(1.0)
  })

  it('rounds to 2 decimal places', () => {
    expect(calculateEMR(50, 100)).toBe(0.5)
    expect(calculateEMR(123, 456)).toBe(0.27)  // 0.2697... → 0.27
  })
})

describe('safetyScoring — calculateDARTRate', () => {
  it('returns 0 when totalWorkHours ≤ 0', () => {
    expect(calculateDARTRate(5, 0)).toBe(0)
    expect(calculateDARTRate(5, -100)).toBe(0)
  })

  it('uses the OSHA 200,000-hour formula', () => {
    // (5 * 200_000) / 1_000_000 = 1.0
    expect(calculateDARTRate(5, 1_000_000)).toBe(1.0)
  })

  it('rounds to 2 decimals', () => {
    // (3 * 200_000) / 470_000 = 1.2766... → 1.28
    expect(calculateDARTRate(3, 470_000)).toBe(1.28)
  })
})
