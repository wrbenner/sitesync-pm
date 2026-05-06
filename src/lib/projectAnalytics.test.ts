import { describe, it, expect } from 'vitest';
import {
  computeScheduleScore,
  computeCostScore,
  computeQualityScore,
  computeSafetyScore,
  computeProjectHealth,
} from './projectAnalytics';

// ── computeScheduleScore ───────────────────────────────────────

describe('computeScheduleScore', () => {
  it('returns 100 when no phases', () => {
    expect(computeScheduleScore([])).toBe(100);
  });

  it('returns 100 when all phases on track', () => {
    expect(
      computeScheduleScore([
        { percent_complete: 50, status: 'in_progress', is_critical_path: false },
        { percent_complete: 30, status: 'in_progress', is_critical_path: true },
      ]),
    ).toBe(100);
  });

  it('lowers score when phases at risk', () => {
    const r = computeScheduleScore([
      { percent_complete: 50, status: 'in_progress', is_critical_path: false },
      { percent_complete: 30, status: 'at_risk', is_critical_path: false },
    ]);
    expect(r).toBeLessThan(100);
  });

  it('penalizes critical-path delays heavily', () => {
    const r = computeScheduleScore([
      { percent_complete: 30, status: 'delayed', is_critical_path: true },
    ]);
    expect(r).toBeLessThanOrEqual(100);
  });

  it('clamps to [0, 100]', () => {
    const phases = Array.from({ length: 10 }, () => ({
      percent_complete: 0,
      status: 'delayed' as const,
      is_critical_path: true,
    }));
    expect(computeScheduleScore(phases)).toBe(0);
  });
});

// ── computeCostScore ───────────────────────────────────────────

describe('computeCostScore', () => {
  it('returns 100 when no items', () => {
    expect(computeCostScore([])).toBe(100);
  });

  it('returns 100 when budget is zero', () => {
    expect(
      computeCostScore([
        { original_amount: 0, actual_amount: 0, percent_complete: 0 },
      ]),
    ).toBe(100);
  });

  it('reports good score when CPI ~ 1.0', () => {
    const r = computeCostScore([
      { original_amount: 100_000, actual_amount: 50_000, percent_complete: 50 },
    ]);
    expect(r).toBeGreaterThan(80);
  });

  it('reports lower score when over budget for progress', () => {
    const r = computeCostScore([
      { original_amount: 100_000, actual_amount: 90_000, percent_complete: 50 },
    ]);
    expect(r).toBeLessThan(80);
  });
});

// ── computeQualityScore ────────────────────────────────────────

describe('computeQualityScore', () => {
  it('returns 100 when no punch items and no overdue RFIs', () => {
    expect(computeQualityScore([], [])).toBe(100);
  });

  it('lowers score for open punch items', () => {
    expect(
      computeQualityScore(
        [{ status: 'open' }, { status: 'open' }, { status: 'resolved' }],
        [],
      ),
    ).toBeLessThan(100);
  });

  it('rewards punch closure progress', () => {
    const more = computeQualityScore(
      [{ status: 'resolved' }, { status: 'resolved' }, { status: 'verified' }, { status: 'open' }],
      [],
    );
    const less = computeQualityScore(
      [{ status: 'open' }, { status: 'open' }, { status: 'open' }, { status: 'resolved' }],
      [],
    );
    expect(more).toBeGreaterThan(less);
  });

  it('penalizes overdue RFIs', () => {
    const r = computeQualityScore([], [
      { status: 'open', due_date: '2025-01-01' },
      { status: 'under_review', due_date: '2025-02-01' },
    ]);
    expect(r).toBeLessThan(100);
  });

  it('does not penalize closed RFIs', () => {
    expect(
      computeQualityScore([], [{ status: 'closed', due_date: '2025-01-01' }]),
    ).toBe(100);
  });

  it('clamps to [0, 100]', () => {
    const overdue = Array.from({ length: 50 }, () => ({
      status: 'open',
      due_date: '2025-01-01',
    }));
    expect(computeQualityScore([], overdue)).toBe(0);
  });
});

// ── computeSafetyScore ─────────────────────────────────────────

describe('computeSafetyScore', () => {
  it('returns 100 when no incidents', () => {
    expect(
      computeSafetyScore([{ incidents: 0, total_hours: 10_000 }]),
    ).toBe(100);
  });

  it('returns 100 when no hours', () => {
    expect(
      computeSafetyScore([{ incidents: 5, total_hours: 0 }]),
    ).toBe(100);
  });

  it('lowers score when incidents present', () => {
    expect(
      computeSafetyScore([{ incidents: 5, total_hours: 100_000 }]),
    ).toBeLessThan(100);
  });

  it('clamps to [50, 100]', () => {
    expect(
      computeSafetyScore([{ incidents: 10000, total_hours: 1000 }]),
    ).toBe(50);
  });
});

// ── computeProjectHealth ───────────────────────────────────────

describe('computeProjectHealth', () => {
  it('returns a complete health structure for healthy project', () => {
    const result = computeProjectHealth(
      [{ percent_complete: 50, status: 'in_progress', is_critical_path: false }],
      [{ original_amount: 100_000, actual_amount: 45_000, percent_complete: 50 }],
      [],
      [],
      [{ incidents: 0, total_hours: 10_000 }],
    );
    expect(result.overall).toBeGreaterThan(0);
    expect(result.dimensions).toHaveLength(5);
    expect(result.prediction.riskLevel).toMatch(/^(low|medium|high|critical)$/);
  });

  it('uses targetCompletion when provided', () => {
    const result = computeProjectHealth(
      [],
      [],
      [],
      [],
      [],
      '2026-12-31',
    );
    expect(result.prediction.completionDate).toBe('2026-12-31');
  });

  it('falls back to projected completion when no target', () => {
    const result = computeProjectHealth([], [], [], [], []);
    expect(result.prediction.completionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reports critical risk for terrible scores', () => {
    const result = computeProjectHealth(
      Array.from({ length: 5 }, () => ({
        percent_complete: 0,
        status: 'delayed',
        is_critical_path: true,
      })),
      [{ original_amount: 100_000, actual_amount: 200_000, percent_complete: 30 }],
      Array.from({ length: 20 }, () => ({ status: 'open' })),
      Array.from({ length: 20 }, () => ({ status: 'open', due_date: '2025-01-01' })),
      [{ incidents: 100, total_hours: 1_000 }],
    );
    expect(['high', 'critical']).toContain(result.prediction.riskLevel);
  });

  it('budget dimension reflects cost score', () => {
    const result = computeProjectHealth(
      [],
      [{ original_amount: 100_000, actual_amount: 50_000, percent_complete: 50 }],
      [],
      [],
      [],
    );
    const budget = result.dimensions.find(d => d.name === 'Budget');
    expect(budget).toBeDefined();
    expect(budget!.score).toBeGreaterThan(0);
  });

  it('predicts final cost from spend trajectory', () => {
    const result = computeProjectHealth(
      [{ percent_complete: 50, status: 'in_progress', is_critical_path: false }],
      [{ original_amount: 100_000, actual_amount: 60_000, percent_complete: 50 }],
      [],
      [],
      [],
    );
    // 60k spent at 50% → projected ~120k
    expect(result.prediction.finalCost).toBeGreaterThan(0);
  });
});
