import { describe, it, expect } from 'vitest';
import {
  calculateSafetyScore,
  calculateTrend,
  calculateEMR,
  calculateDARTRate,
  type SafetyScoreInput,
} from './safetyScoring';

function input(over: Partial<SafetyScoreInput> = {}): SafetyScoreInput {
  return {
    recordableIncidents: 0,
    totalWorkHours: 100_000,
    daysWithoutIncident: 100,
    nearMissCount: 0,
    totalCorrectiveActions: 10,
    closedCorrectiveActions: 9,
    overdueCorrectiveActions: 0,
    totalObservations: 100,
    compliantObservations: 95,
    violationObservations: 5,
    totalInspections: 20,
    passedInspections: 18,
    failedInspections: 2,
    totalWorkers: 50,
    workersWithValidCerts: 50,
    expiringCertsCount: 0,
    expiredCertsCount: 0,
    ...over,
  };
}

// ── calculateSafetyScore ────────────────────────────────────────

describe('calculateSafetyScore', () => {
  it('grades a clean record as A', () => {
    const r = calculateSafetyScore(input());
    expect(r.grade).toBe('A');
    expect(r.overall).toBeGreaterThanOrEqual(90);
    expect(r.riskLevel).toBe('low');
  });

  it('drops grade when there are recordable incidents', () => {
    const r = calculateSafetyScore(input({ recordableIncidents: 5, totalWorkHours: 100_000 }));
    expect(r.overall).toBeLessThan(90);
  });

  it('returns TRIR=0 for zero work hours', () => {
    const r = calculateSafetyScore(input({ totalWorkHours: 0 }));
    expect(r.components.incidentRate.trir).toBe(0);
  });

  it('emits "above_average" benchmark for TRIR < industry best', () => {
    const r = calculateSafetyScore(input());
    expect(r.benchmarkComparison).toBe('above_average');
  });

  it('emits "below_average" for high TRIR', () => {
    const r = calculateSafetyScore(input({ recordableIncidents: 100, totalWorkHours: 100_000 }));
    expect(r.benchmarkComparison).toBe('below_average');
  });

  it('penalizes overdue corrective actions', () => {
    const noOverdue = calculateSafetyScore(input({ overdueCorrectiveActions: 0 }));
    const someOverdue = calculateSafetyScore(input({ overdueCorrectiveActions: 5 }));
    expect(someOverdue.components.correctiveActions.score).toBeLessThan(
      noOverdue.components.correctiveActions.score,
    );
  });

  it('emits a recommendation for low PPE compliance', () => {
    const r = calculateSafetyScore(input({ compliantObservations: 50, totalObservations: 100 }));
    expect(r.recommendations.some(r => r.toLowerCase().includes('ppe'))).toBe(true);
  });

  it('emits no specific recommendations when everything is healthy', () => {
    const r = calculateSafetyScore(input());
    expect(r.recommendations).toHaveLength(1);
    expect(r.recommendations[0]).toContain('within target');
  });

  it('reports "critical" risk for terrible scores', () => {
    const r = calculateSafetyScore(
      input({
        recordableIncidents: 50,
        totalWorkHours: 100_000,
        closedCorrectiveActions: 0,
        overdueCorrectiveActions: 20,
        compliantObservations: 0,
        passedInspections: 0,
        workersWithValidCerts: 0,
        expiredCertsCount: 50,
      }),
    );
    expect(r.riskLevel).toBe('critical');
    expect(r.grade).toBe('F');
  });

  it('handles zero observations / inspections / workers as 100% compliance', () => {
    const r = calculateSafetyScore(
      input({
        totalObservations: 0,
        compliantObservations: 0,
        totalInspections: 0,
        passedInspections: 0,
        totalWorkers: 0,
        workersWithValidCerts: 0,
      }),
    );
    expect(r.components.ppeCompliance.complianceRate).toBe(100);
    expect(r.components.inspections.passRate).toBe(100);
  });

  it('emits expiry-specific recommendations', () => {
    const r = calculateSafetyScore(input({ expiredCertsCount: 3, expiringCertsCount: 5 }));
    const text = r.recommendations.join('|').toLowerCase();
    expect(text).toContain('expired');
    expect(text).toContain('expir');
  });

  it('returns weighted overall score in [0,100]', () => {
    for (let i = 0; i < 10; i++) {
      const r = calculateSafetyScore(
        input({
          recordableIncidents: i * 2,
          overdueCorrectiveActions: i,
          compliantObservations: 100 - i * 5,
        }),
      );
      expect(r.overall).toBeGreaterThanOrEqual(0);
      expect(r.overall).toBeLessThanOrEqual(100);
    }
  });
});

// ── calculateTrend ──────────────────────────────────────────────

describe('calculateTrend', () => {
  it('returns stable for 0 or 1 score', () => {
    expect(calculateTrend([])).toBe('stable');
    expect(calculateTrend([{ date: '2026-01-01', score: 80 }])).toBe('stable');
  });

  it('returns improving when last - first > 5', () => {
    expect(
      calculateTrend([
        { date: '2026-01-01', score: 70 },
        { date: '2026-01-15', score: 78 },
      ]),
    ).toBe('improving');
  });

  it('returns declining when last - first < -5', () => {
    expect(
      calculateTrend([
        { date: '2026-01-01', score: 80 },
        { date: '2026-01-15', score: 70 },
      ]),
    ).toBe('declining');
  });

  it('returns stable for small changes', () => {
    expect(
      calculateTrend([
        { date: '2026-01-01', score: 75 },
        { date: '2026-01-15', score: 77 },
      ]),
    ).toBe('stable');
  });

  it('only considers the last 5 entries', () => {
    expect(
      calculateTrend([
        { date: '2026-01-01', score: 30 },
        { date: '2026-01-08', score: 80 },
        { date: '2026-01-15', score: 80 },
        { date: '2026-01-22', score: 80 },
        { date: '2026-01-29', score: 80 },
        { date: '2026-02-05', score: 80 },
      ]),
    ).toBe('stable');
  });
});

// ── calculateEMR ────────────────────────────────────────────────

describe('calculateEMR', () => {
  it('returns 1.0 when expected losses is 0', () => {
    expect(calculateEMR(50_000, 0)).toBe(1.0);
  });

  it('returns the actual/expected ratio rounded to 2 decimals', () => {
    expect(calculateEMR(50_000, 100_000)).toBe(0.5);
    expect(calculateEMR(123_456, 100_000)).toBe(1.23);
  });

  it('returns 1.0 for negative expected losses', () => {
    expect(calculateEMR(0, -5)).toBe(1.0);
  });
});

// ── calculateDARTRate ───────────────────────────────────────────

describe('calculateDARTRate', () => {
  it('returns 0 when no work hours', () => {
    expect(calculateDARTRate(5, 0)).toBe(0);
  });

  it('calculates per OSHA DART formula (×200,000 / hours)', () => {
    expect(calculateDARTRate(2, 200_000)).toBe(2);
  });

  it('rounds to 2 decimals', () => {
    expect(calculateDARTRate(1, 333_333)).toBe(0.6);
  });
});
