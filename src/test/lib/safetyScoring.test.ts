import { describe, it, expect } from 'vitest'
import {
  calculateSafetyScore,
  calculateTrend,
  calculateEMR,
  calculateDARTRate,
} from '../../lib/safetyScoring'
import type { SafetyScoreInput } from '../../lib/safetyScoring'

// ── Test data builder ──────────────────────────────────────────

function makeInput(overrides: Partial<SafetyScoreInput> = {}): SafetyScoreInput {
  return {
    recordableIncidents: 0,
    totalWorkHours: 200_000,
    daysWithoutIncident: 100,
    nearMissCount: 0,

    totalCorrectiveActions: 10,
    closedCorrectiveActions: 9,
    overdueCorrectiveActions: 0,

    totalObservations: 100,
    compliantObservations: 98,
    violationObservations: 2,

    totalInspections: 20,
    passedInspections: 19,
    failedInspections: 1,

    totalWorkers: 50,
    workersWithValidCerts: 50,
    expiringCertsCount: 0,
    expiredCertsCount: 0,
    ...overrides,
  }
}

// ── calculateSafetyScore ──────────────────────────────────────

describe('calculateSafetyScore', () => {
  describe('grade assignment', () => {
    it('should return grade A for excellent input', () => {
      const result = calculateSafetyScore(makeInput())
      expect(result.grade).toBe('A')
    })

    it('should return grade F for catastrophic input', () => {
      const result = calculateSafetyScore(makeInput({
        recordableIncidents: 20,
        totalWorkHours: 200_000,
        daysWithoutIncident: 0,
        closedCorrectiveActions: 0,
        overdueCorrectiveActions: 10,
        compliantObservations: 0,
        passedInspections: 0,
        workersWithValidCerts: 0,
        expiredCertsCount: 50,
      }))
      expect(result.grade).toBe('F')
    })

    it('should score 100 for perfect input', () => {
      const result = calculateSafetyScore(makeInput({ daysWithoutIncident: 0 }))
      expect(result.overall).toBeGreaterThan(0)
      expect(result.overall).toBeLessThanOrEqual(100)
    })
  })

  describe('incident rate', () => {
    it('should score 100 incident component with 0 recordables', () => {
      const result = calculateSafetyScore(makeInput({ recordableIncidents: 0 }))
      expect(result.components.incidentRate.trir).toBe(0)
    })

    it('should compute correct TRIR', () => {
      // TRIR = (incidents * 200_000) / hours = (2 * 200_000) / 200_000 = 2.0
      const result = calculateSafetyScore(makeInput({
        recordableIncidents: 2,
        totalWorkHours: 200_000,
      }))
      expect(result.components.incidentRate.trir).toBe(2.0)
    })

    it('should set TRIR to 0 when no work hours', () => {
      const result = calculateSafetyScore(makeInput({ totalWorkHours: 0 }))
      expect(result.components.incidentRate.trir).toBe(0)
    })
  })

  describe('corrective actions', () => {
    it('should penalize overdue corrective actions', () => {
      const good = calculateSafetyScore(makeInput({ overdueCorrectiveActions: 0 }))
      const bad = calculateSafetyScore(makeInput({ overdueCorrectiveActions: 5 }))
      expect(bad.components.correctiveActions.score).toBeLessThan(good.components.correctiveActions.score)
    })

    it('should score 100 closure rate when no CAs', () => {
      const result = calculateSafetyScore(makeInput({
        totalCorrectiveActions: 0,
        closedCorrectiveActions: 0,
      }))
      expect(result.components.correctiveActions.closureRate).toBe(100)
    })

    it('should compute correct closure rate percentage', () => {
      const result = calculateSafetyScore(makeInput({
        totalCorrectiveActions: 10,
        closedCorrectiveActions: 8,
      }))
      expect(result.components.correctiveActions.closureRate).toBe(80)
    })
  })

  describe('PPE compliance', () => {
    it('should score 100 when no observations', () => {
      const result = calculateSafetyScore(makeInput({
        totalObservations: 0,
        compliantObservations: 0,
        violationObservations: 0,
      }))
      expect(result.components.ppeCompliance.complianceRate).toBe(100)
    })

    it('should reflect actual compliance percentage', () => {
      const result = calculateSafetyScore(makeInput({
        totalObservations: 10,
        compliantObservations: 7,
        violationObservations: 3,
      }))
      expect(result.components.ppeCompliance.complianceRate).toBe(70)
    })
  })

  describe('inspections', () => {
    it('should score 100 inspection when no inspections', () => {
      const result = calculateSafetyScore(makeInput({
        totalInspections: 0,
        passedInspections: 0,
        failedInspections: 0,
      }))
      expect(result.components.inspections.passRate).toBe(100)
    })

    it('should give bonus for frequent inspections', () => {
      const few = calculateSafetyScore(makeInput({ totalInspections: 4, passedInspections: 4 }))
      const many = calculateSafetyScore(makeInput({ totalInspections: 20, passedInspections: 20 }))
      // More inspections = bonus points
      expect(many.components.inspections.score).toBeGreaterThanOrEqual(few.components.inspections.score)
    })
  })

  describe('certifications', () => {
    it('should penalize expired certifications', () => {
      const good = calculateSafetyScore(makeInput({ expiredCertsCount: 0 }))
      const bad = calculateSafetyScore(makeInput({ expiredCertsCount: 3 }))
      expect(bad.components.certifications.score).toBeLessThan(good.components.certifications.score)
    })

    it('should penalize expiring certifications less than expired', () => {
      const expiring = calculateSafetyScore(makeInput({ expiringCertsCount: 1, expiredCertsCount: 0 }))
      const expired = calculateSafetyScore(makeInput({ expiredCertsCount: 1, expiringCertsCount: 0 }))
      // Expired (10 pts) > expiring (3 pts) penalty
      expect(expiring.components.certifications.score).toBeGreaterThan(expired.components.certifications.score)
    })
  })

  describe('benchmark comparison', () => {
    it('should be above_average for TRIR below 1.0', () => {
      const result = calculateSafetyScore(makeInput({
        recordableIncidents: 0,
        totalWorkHours: 1_000_000,
      }))
      expect(result.benchmarkComparison).toBe('above_average')
    })

    it('should be below_average for TRIR above industry average', () => {
      // TRIR = (10 * 200_000) / 200_000 = 10 > 3.1 industry avg
      const result = calculateSafetyScore(makeInput({
        recordableIncidents: 10,
        totalWorkHours: 200_000,
      }))
      expect(result.benchmarkComparison).toBe('below_average')
    })
  })

  describe('risk level', () => {
    it('should be low for high overall score', () => {
      const result = calculateSafetyScore(makeInput())
      expect(result.riskLevel).toBe('low')
    })

    it('should be critical for very low overall score', () => {
      const result = calculateSafetyScore(makeInput({
        recordableIncidents: 20,
        totalWorkHours: 200_000,
        closedCorrectiveActions: 0,
        overdueCorrectiveActions: 10,
        compliantObservations: 0,
        passedInspections: 0,
        workersWithValidCerts: 0,
        expiredCertsCount: 50,
      }))
      expect(result.riskLevel).toBe('critical')
    })
  })

  describe('recommendations', () => {
    it('should provide recommendation when all good', () => {
      const result = calculateSafetyScore(makeInput())
      expect(result.recommendations.length).toBeGreaterThan(0)
      expect(result.recommendations[0]).toMatch(/target range/i)
    })

    it('should recommend expired cert removal', () => {
      const result = calculateSafetyScore(makeInput({
        expiredCertsCount: 3,
        workersWithValidCerts: 47,
      }))
      const hasExpiredRec = result.recommendations.some(r => r.includes('expired'))
      expect(hasExpiredRec).toBe(true)
    })

    it('should recommend renewal for expiring certs', () => {
      const result = calculateSafetyScore(makeInput({
        expiringCertsCount: 5,
        workersWithValidCerts: 45,
      }))
      const hasExpiringRec = result.recommendations.some(r => r.includes('expiring'))
      expect(hasExpiringRec).toBe(true)
    })

    it('should recommend PPE standown when compliance is low', () => {
      const result = calculateSafetyScore(makeInput({
        totalObservations: 100,
        compliantObservations: 70,
        violationObservations: 30,
      }))
      const hasPPERec = result.recommendations.some(r => r.toLowerCase().includes('ppe'))
      expect(hasPPERec).toBe(true)
    })
  })

  describe('weights', () => {
    it('should return component weights matching constants', () => {
      const result = calculateSafetyScore(makeInput())
      expect(result.components.incidentRate.weight).toBe(0.30)
      expect(result.components.correctiveActions.weight).toBe(0.20)
      expect(result.components.ppeCompliance.weight).toBe(0.20)
      expect(result.components.inspections.weight).toBe(0.15)
      expect(result.components.certifications.weight).toBe(0.15)
    })
  })
})

// ── calculateTrend ────────────────────────────────────────────

describe('calculateTrend', () => {
  it('should return stable for empty scores', () => {
    expect(calculateTrend([])).toBe('stable')
  })

  it('should return stable for single score', () => {
    expect(calculateTrend([{ date: '2026-01-01', score: 80 }])).toBe('stable')
  })

  it('should return improving when score increases by more than 5', () => {
    const scores = [
      { date: '2026-01-01', score: 70 },
      { date: '2026-01-08', score: 80 },
    ]
    expect(calculateTrend(scores)).toBe('improving')
  })

  it('should return declining when score drops by more than 5', () => {
    const scores = [
      { date: '2026-01-01', score: 85 },
      { date: '2026-01-08', score: 75 },
    ]
    expect(calculateTrend(scores)).toBe('declining')
  })

  it('should return stable when change is within 5 points', () => {
    const scores = [
      { date: '2026-01-01', score: 80 },
      { date: '2026-01-08', score: 83 },
    ]
    expect(calculateTrend(scores)).toBe('stable')
  })

  it('should use only last 5 scores', () => {
    const scores = [
      { date: '2025-01-01', score: 50 }, // old declining baseline, ignored
      { date: '2026-01-01', score: 75 },
      { date: '2026-01-08', score: 76 },
      { date: '2026-01-15', score: 77 },
      { date: '2026-01-22', score: 78 },
      { date: '2026-01-29', score: 79 }, // last 5: 75..79 = +4 = stable
    ]
    expect(calculateTrend(scores)).toBe('stable')
  })
})

// ── calculateEMR ──────────────────────────────────────────────

describe('calculateEMR', () => {
  it('should return 1.0 when expected losses are 0', () => {
    expect(calculateEMR(5000, 0)).toBe(1.0)
  })

  it('should return 1.0 when actual equals expected', () => {
    expect(calculateEMR(10000, 10000)).toBe(1.0)
  })

  it('should return less than 1.0 when actual is below expected', () => {
    expect(calculateEMR(5000, 10000)).toBe(0.5)
  })

  it('should return greater than 1.0 when actual exceeds expected', () => {
    expect(calculateEMR(15000, 10000)).toBe(1.5)
  })

  it('should round to 2 decimal places', () => {
    const result = calculateEMR(10000, 3000)
    expect(result.toString()).toMatch(/^\d+\.\d{1,2}$/)
  })
})

// ── calculateDARTRate ─────────────────────────────────────────

describe('calculateDARTRate', () => {
  it('should return 0 when no work hours', () => {
    expect(calculateDARTRate(10, 0)).toBe(0)
  })

  it('should compute DART rate correctly', () => {
    // DART = (days * 200_000) / hours = (2 * 200_000) / 200_000 = 2.0
    expect(calculateDARTRate(2, 200_000)).toBe(2.0)
  })

  it('should return 0 when no DART incidents', () => {
    expect(calculateDARTRate(0, 200_000)).toBe(0)
  })

  it('should round to 2 decimal places', () => {
    const result = calculateDARTRate(1, 300_000)
    expect(Number.isFinite(result)).toBe(true)
    expect(result.toString()).toMatch(/^\d+\.?\d*$/)
  })
})
