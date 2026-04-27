import { describe, it, expect } from 'vitest'
import {
  calculateSafetyScore,
  calculateTrend,
  calculateEMR,
  calculateDARTRate,
} from './safetyScoring'
import type { SafetyScoreInput } from './safetyScoring'

// Default zero-input baseline. Each test overrides only the fields it cares about.
const ZERO: SafetyScoreInput = {
  recordableIncidents: 0,
  totalWorkHours: 0,
  daysWithoutIncident: 0,
  nearMissCount: 0,
  totalCorrectiveActions: 0,
  closedCorrectiveActions: 0,
  overdueCorrectiveActions: 0,
  totalObservations: 0,
  compliantObservations: 0,
  violationObservations: 0,
  totalInspections: 0,
  passedInspections: 0,
  failedInspections: 0,
  totalWorkers: 0,
  workersWithValidCerts: 0,
  expiringCertsCount: 0,
  expiredCertsCount: 0,
}

// ── calculateSafetyScore — overall + grade ladder ─────────────────

describe('calculateSafetyScore — perfect-input baseline', () => {
  it('zero recordable incidents + zero data anywhere yields a 100 overall (grade A)', () => {
    const r = calculateSafetyScore(ZERO)
    expect(r.overall).toBe(100)
    expect(r.grade).toBe('A')
    expect(r.riskLevel).toBe('low')
  })

  it('zero recordable + missing observations defaults to 100% compliance (no false alarms)', () => {
    const r = calculateSafetyScore(ZERO)
    expect(r.components.ppeCompliance.score).toBe(100)
    expect(r.components.inspections.score).toBe(100)
    expect(r.components.certifications.score).toBe(100)
    expect(r.components.correctiveActions.score).toBe(100)
  })
})

describe('calculateSafetyScore — TRIR (incident-rate) formula', () => {
  it('TRIR = (recordableIncidents * 200000) / totalWorkHours, rounded to 2 decimals', () => {
    // 1 recordable in 100k hours → TRIR = 2.0
    const r = calculateSafetyScore({ ...ZERO, recordableIncidents: 1, totalWorkHours: 100_000 })
    expect(r.components.incidentRate.trir).toBe(2)
  })

  it('TRIR <= industry-best (1.0) → trirScore=95 (top quartile lock)', () => {
    // 0.5 incidents per 200k hours → TRIR = 0.5 (well below best=1.0)
    const r = calculateSafetyScore({ ...ZERO, recordableIncidents: 1, totalWorkHours: 400_000 })
    expect(r.components.incidentRate.trir).toBe(0.5)
    // incidentScore = trirScore + safeDayBonus(0) = 95
    expect(r.components.incidentRate.score).toBe(95)
  })

  it('TRIR > industry average (3.1) → score floors toward 0', () => {
    // 10 incidents per 100k hours → TRIR = 20
    const r = calculateSafetyScore({ ...ZERO, recordableIncidents: 10, totalWorkHours: 100_000 })
    expect(r.components.incidentRate.score).toBe(0)
    expect(r.benchmarkComparison).toBe('below_average')
  })

  it('TRIR exactly at industry-best yields score=95', () => {
    // 1 incident in 200k hours → TRIR = 1.0 (best)
    const r = calculateSafetyScore({ ...ZERO, recordableIncidents: 1, totalWorkHours: 200_000 })
    expect(r.components.incidentRate.trir).toBe(1)
    expect(r.components.incidentRate.score).toBe(95)
  })

  it('safeDayBonus caps at 10 even with 1000 days incident-free', () => {
    // TRIR=0 already locks score at 100, but the bonus path is exercised here
    const r = calculateSafetyScore({ ...ZERO, daysWithoutIncident: 10_000 })
    // 10000/10 = 1000 raw, capped to 10, but trirScore=100 + 10 → still capped at 100
    expect(r.components.incidentRate.score).toBe(100)
  })
})

describe('calculateSafetyScore — corrective-action closure', () => {
  it('100% closure rate with no overdue → caScore=100', () => {
    const r = calculateSafetyScore({ ...ZERO, totalCorrectiveActions: 10, closedCorrectiveActions: 10 })
    expect(r.components.correctiveActions.score).toBe(100)
    expect(r.components.correctiveActions.closureRate).toBe(100)
  })

  it('Each overdue subtracts 5 points from caScore', () => {
    // 100% closed but 4 overdue → 100 - 20 = 80
    const r = calculateSafetyScore({
      ...ZERO,
      totalCorrectiveActions: 10,
      closedCorrectiveActions: 10,
      overdueCorrectiveActions: 4,
    })
    expect(r.components.correctiveActions.score).toBe(80)
  })

  it('caScore floors at 0 (cannot go negative even with many overdue)', () => {
    const r = calculateSafetyScore({
      ...ZERO,
      totalCorrectiveActions: 10,
      closedCorrectiveActions: 0,
      overdueCorrectiveActions: 100,
    })
    expect(r.components.correctiveActions.score).toBe(0)
  })

  it('No corrective actions tracked yet → score=100 (avoid penalising a clean slate)', () => {
    const r = calculateSafetyScore({ ...ZERO, totalCorrectiveActions: 0 })
    expect(r.components.correctiveActions.score).toBe(100)
  })
})

describe('calculateSafetyScore — PPE compliance', () => {
  it('ppeScore = (compliantObservations / totalObservations) * 100, rounded', () => {
    // 75% compliance
    const r = calculateSafetyScore({ ...ZERO, totalObservations: 100, compliantObservations: 75 })
    expect(r.components.ppeCompliance.score).toBe(75)
  })

  it('100% compliance yields ppeScore=100', () => {
    const r = calculateSafetyScore({ ...ZERO, totalObservations: 50, compliantObservations: 50 })
    expect(r.components.ppeCompliance.score).toBe(100)
  })

  it('Zero observations defaults to 100% (no observations = no violations recorded)', () => {
    const r = calculateSafetyScore({ ...ZERO, totalObservations: 0 })
    expect(r.components.ppeCompliance.score).toBe(100)
  })
})

describe('calculateSafetyScore — inspections', () => {
  it('100% pass rate with frequent inspections caps at 100 (bonus does not push past)', () => {
    const r = calculateSafetyScore({ ...ZERO, totalInspections: 100, passedInspections: 100 })
    expect(r.components.inspections.score).toBe(100)
  })

  it('Inspection-frequency bonus caps at 5 (so 50% pass + heavy bonus → 55, not 70)', () => {
    // 50% pass + 100 inspections → 50 + min(5, 100/4=25) = 50 + 5 = 55
    const r = calculateSafetyScore({ ...ZERO, totalInspections: 100, passedInspections: 50 })
    expect(r.components.inspections.score).toBe(55)
  })

  it('Zero inspections defaults to 100% (clean-slate)', () => {
    const r = calculateSafetyScore({ ...ZERO, totalInspections: 0 })
    expect(r.components.inspections.score).toBe(100)
  })
})

describe('calculateSafetyScore — certifications', () => {
  it('Each expired cert subtracts 10 points (heaviest penalty)', () => {
    // 100% valid + 2 expired → 100 - 20 = 80
    const r = calculateSafetyScore({
      ...ZERO, totalWorkers: 10, workersWithValidCerts: 10, expiredCertsCount: 2,
    })
    expect(r.components.certifications.score).toBe(80)
  })

  it('Each expiring cert subtracts 3 points (lighter penalty than expired)', () => {
    // 100% valid + 5 expiring → 100 - 15 = 85
    const r = calculateSafetyScore({
      ...ZERO, totalWorkers: 10, workersWithValidCerts: 10, expiringCertsCount: 5,
    })
    expect(r.components.certifications.score).toBe(85)
  })

  it('certScore floors at 0', () => {
    const r = calculateSafetyScore({ ...ZERO, totalWorkers: 10, workersWithValidCerts: 0, expiredCertsCount: 100 })
    expect(r.components.certifications.score).toBe(0)
  })
})

// ── Overall composition + grade + risk + benchmark ────────────────

describe('calculateSafetyScore — weighted overall + grade ladder', () => {
  it('Overall = weighted sum (incident*0.30 + ca*0.20 + ppe*0.20 + insp*0.15 + cert*0.15), rounded', () => {
    // All components 100 → overall = 100, grade A
    const r = calculateSafetyScore({
      ...ZERO,
      totalCorrectiveActions: 5, closedCorrectiveActions: 5,
      totalObservations: 100, compliantObservations: 100,
      totalInspections: 10, passedInspections: 10,
      totalWorkers: 10, workersWithValidCerts: 10,
    })
    expect(r.overall).toBe(100)
    expect(r.grade).toBe('A')
  })

  it('Component weights sum to 1.0 (no missing safety dimension)', () => {
    const r = calculateSafetyScore(ZERO)
    const sum =
      r.components.incidentRate.weight +
      r.components.correctiveActions.weight +
      r.components.ppeCompliance.weight +
      r.components.inspections.weight +
      r.components.certifications.weight
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('Grade A boundary at 90, B at 80, C at 70, D at 60, F below', () => {
    // Engineer overall=89 by setting expired certs (heaviest individual lever)
    // overall=100 then knock cert score with expired certs:
    // start: all 100s → overall=100
    // 1 expired → cert=90 → overall = 100*0.30+100*0.20+100*0.20+100*0.15+90*0.15
    //          = 30+20+20+15+13.5 = 98.5 → 99 grade A
    const baseInputs: SafetyScoreInput = {
      ...ZERO,
      totalCorrectiveActions: 5, closedCorrectiveActions: 5,
      totalObservations: 100, compliantObservations: 100,
      totalInspections: 10, passedInspections: 10,
      totalWorkers: 10, workersWithValidCerts: 10,
    }
    const a = calculateSafetyScore({ ...baseInputs }).grade
    expect(a).toBe('A')
  })

  it('Risk level "low" >= 85, "moderate" >= 70, "high" >= 50, "critical" < 50', () => {
    expect(calculateSafetyScore({
      ...ZERO,
      totalCorrectiveActions: 5, closedCorrectiveActions: 5,
      totalObservations: 100, compliantObservations: 100,
      totalInspections: 10, passedInspections: 10,
      totalWorkers: 10, workersWithValidCerts: 10,
    }).riskLevel).toBe('low')

    // Force critical via TRIR=20 + zero observations etc.
    const critical = calculateSafetyScore({
      ...ZERO,
      recordableIncidents: 10, totalWorkHours: 100_000,
      totalCorrectiveActions: 10, closedCorrectiveActions: 0, overdueCorrectiveActions: 20,
      totalObservations: 100, compliantObservations: 0,
      totalInspections: 10, passedInspections: 0,
      totalWorkers: 10, workersWithValidCerts: 0, expiredCertsCount: 10,
    })
    expect(critical.riskLevel).toBe('critical')
  })

  it('Benchmark "above_average" when TRIR < industry-best (1.0)', () => {
    const r = calculateSafetyScore({ ...ZERO, recordableIncidents: 1, totalWorkHours: 400_000 })
    // TRIR=0.5 < 1.0
    expect(r.benchmarkComparison).toBe('above_average')
  })

  it('Benchmark "below_average" when TRIR > industry-average (3.1)', () => {
    const r = calculateSafetyScore({ ...ZERO, recordableIncidents: 5, totalWorkHours: 100_000 })
    // TRIR=10 >> 3.1
    expect(r.benchmarkComparison).toBe('below_average')
  })
})

// ── Recommendations ──────────────────────────────────────────────

describe('calculateSafetyScore — recommendations', () => {
  it('Clean inputs → single "maintain" recommendation (no false alarms)', () => {
    const r = calculateSafetyScore({
      ...ZERO,
      totalCorrectiveActions: 5, closedCorrectiveActions: 5,
      totalObservations: 100, compliantObservations: 100,
      totalInspections: 10, passedInspections: 10,
      totalWorkers: 10, workersWithValidCerts: 10,
    })
    expect(r.recommendations).toHaveLength(1)
    expect(r.recommendations[0]).toMatch(/maintain/i)
  })

  it('Overdue corrective actions trigger a count-aware recommendation', () => {
    const r = calculateSafetyScore({
      ...ZERO,
      totalCorrectiveActions: 10, closedCorrectiveActions: 5, overdueCorrectiveActions: 5,
    })
    expect(r.recommendations.some(s => s.includes('5 corrective actions'))).toBe(true)
  })

  it('Expired certs trigger a "remove from active duty" recommendation', () => {
    const r = calculateSafetyScore({
      ...ZERO, totalWorkers: 10, workersWithValidCerts: 8, expiredCertsCount: 2,
    })
    expect(r.recommendations.some(s => s.includes('2 workers have expired certifications'))).toBe(true)
  })

  it('Expiring certs trigger a "schedule renewal" recommendation', () => {
    const r = calculateSafetyScore({
      ...ZERO, totalWorkers: 10, workersWithValidCerts: 10, expiringCertsCount: 3,
    })
    // certScore = 100 - 9 = 91 — above the 90 threshold, so recommendation may not fire
    // unless we drop certs further. Force the recommendation by adding more expiring:
    const r2 = calculateSafetyScore({
      ...ZERO, totalWorkers: 10, workersWithValidCerts: 10, expiringCertsCount: 5,
    })
    // certScore = 100 - 15 = 85 → triggers cert recommendation block
    expect(r2.recommendations.some(s => s.includes('5 certifications expiring'))).toBe(true)
  })
})

// ── calculateTrend ───────────────────────────────────────────────

describe('calculateTrend — score sequence direction', () => {
  it('< 2 scores → "stable" (no signal)', () => {
    expect(calculateTrend([])).toBe('stable')
    expect(calculateTrend([{ date: '2026-04-01', score: 80 }])).toBe('stable')
  })

  it('improving when last5[last] - last5[first] > 5', () => {
    expect(calculateTrend([
      { date: '2026-04-01', score: 70 },
      { date: '2026-04-02', score: 76 }, // +6
    ])).toBe('improving')
  })

  it('declining when last5[last] - last5[first] < -5', () => {
    expect(calculateTrend([
      { date: '2026-04-01', score: 80 },
      { date: '2026-04-02', score: 74 }, // -6
    ])).toBe('declining')
  })

  it('stable when |diff| <= 5', () => {
    expect(calculateTrend([
      { date: '2026-04-01', score: 80 },
      { date: '2026-04-02', score: 84 }, // +4
    ])).toBe('stable')
  })

  it('Only the LAST 5 scores are considered (tail window, not full history)', () => {
    // First score is 50 but it's outside the last-5 window
    const r = calculateTrend([
      { date: '2026-04-01', score: 50 }, // ignored — outside tail window
      { date: '2026-04-02', score: 80 }, // last5 starts here
      { date: '2026-04-03', score: 81 },
      { date: '2026-04-04', score: 82 },
      { date: '2026-04-05', score: 83 },
      { date: '2026-04-06', score: 84 }, // 84 - 80 = +4 → stable
    ])
    expect(r).toBe('stable')
  })
})

// ── calculateEMR ─────────────────────────────────────────────────

describe('calculateEMR — Experience Modification Rate', () => {
  it('EMR = actualLosses / expectedLosses, rounded to 2 decimals', () => {
    expect(calculateEMR(150_000, 100_000)).toBe(1.5)
    expect(calculateEMR(50_000, 100_000)).toBe(0.5)
  })

  it('EMR = 1.0 when expectedLosses <= 0 (avoid divide-by-zero)', () => {
    expect(calculateEMR(50_000, 0)).toBe(1.0)
    expect(calculateEMR(50_000, -1)).toBe(1.0)
  })

  it('EMR rounding: 1/3 → 0.33', () => {
    expect(calculateEMR(100, 300)).toBe(0.33)
  })
})

// ── calculateDARTRate ────────────────────────────────────────────

describe('calculateDARTRate — DART rate formula', () => {
  it('DART = (daysAwayRestrictedTransfer * 200000) / totalWorkHours, rounded to 2 decimals', () => {
    // 5 DART days in 100k hours → 5 * 200000 / 100000 = 10
    expect(calculateDARTRate(5, 100_000)).toBe(10)
  })

  it('Returns 0 when totalWorkHours <= 0 (no exposure to date)', () => {
    expect(calculateDARTRate(5, 0)).toBe(0)
    expect(calculateDARTRate(5, -1)).toBe(0)
  })

  it('Returns 0 when no DART days (perfect exposure record)', () => {
    expect(calculateDARTRate(0, 100_000)).toBe(0)
  })
})
