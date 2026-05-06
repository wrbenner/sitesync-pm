import { describe, it, expect } from 'vitest';
import {
  riskLevel,
  riskColor,
  computeRFIRisk,
  computeBudgetRisk,
  computeScheduleRisk,
  computeSafetyRisk,
  overallProjectRisk,
} from './riskEngine';

// ── riskLevel / riskColor ──────────────────────────────────────

describe('riskLevel', () => {
  it('returns low for score ≤ 25', () => {
    expect(riskLevel(0)).toBe('low');
    expect(riskLevel(25)).toBe('low');
  });
  it('returns medium for 26–50', () => {
    expect(riskLevel(26)).toBe('medium');
    expect(riskLevel(50)).toBe('medium');
  });
  it('returns high for 51–75', () => {
    expect(riskLevel(51)).toBe('high');
    expect(riskLevel(75)).toBe('high');
  });
  it('returns critical for > 75', () => {
    expect(riskLevel(76)).toBe('critical');
    expect(riskLevel(100)).toBe('critical');
  });
});

describe('riskColor', () => {
  it('returns green for low scores', () => {
    expect(riskColor(10)).toBe('#10B981');
  });
  it('returns red for critical scores', () => {
    expect(riskColor(100)).toBe('#EF4444');
  });
  it('returns escalating colors at thresholds', () => {
    expect(riskColor(30)).toBe('#F59E0B');
    expect(riskColor(60)).toBe('#F97316');
  });
});

// ── computeRFIRisk ─────────────────────────────────────────────

describe('computeRFIRisk', () => {
  it('returns a score between 0 and 100', () => {
    const result = computeRFIRisk({
      id: 'r1',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.factors).toHaveLength(5);
  });

  it('flags high risk for critical-path RFI with critical priority', () => {
    const r = computeRFIRisk({
      id: 'r1',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      priority: 'critical',
      on_critical_path: true,
      assignee_response_rate: 0.2,
      returned_count: 2,
    });
    expect(r.level === 'high' || r.level === 'critical').toBe(true);
  });

  it('returns low risk for fresh, low-priority RFI', () => {
    const r = computeRFIRisk({
      id: 'r1',
      created_at: new Date().toISOString(),
      priority: 'low',
      on_critical_path: false,
      assignee_response_rate: 0.95,
      returned_count: 0,
    });
    expect(r.score).toBeLessThan(50);
  });

  it('uses sensible defaults when avg_response_days missing', () => {
    const r = computeRFIRisk({
      id: 'r1',
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    });
    expect(r.factors.find(f => f.name.includes('Days open'))?.contribution).toBeGreaterThan(0);
  });
});

// ── computeBudgetRisk ──────────────────────────────────────────

describe('computeBudgetRisk', () => {
  it('reports low risk when consumption is under 50%', () => {
    const r = computeBudgetRisk({ budget: 100_000, actual: 30_000, committed: 0 });
    expect(r.score).toBeLessThan(50);
  });

  it('reports high risk when consumption exceeds 100%', () => {
    const r = computeBudgetRisk({
      budget: 100_000,
      actual: 80_000,
      committed: 50_000,
      change_order_count_30d: 4,
    });
    expect(r.level === 'high' || r.level === 'critical').toBe(true);
  });

  it('handles zero budget gracefully', () => {
    const r = computeBudgetRisk({ budget: 0, actual: 0, committed: 0 });
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('factors change-order velocity into the score', () => {
    const r = computeBudgetRisk({
      budget: 100_000,
      actual: 30_000,
      committed: 0,
      change_order_count_30d: 5,
    });
    const coFactor = r.factors.find(f => f.name.includes('Change order'));
    expect(coFactor?.contribution).toBe(100);
  });
});

// ── computeScheduleRisk ────────────────────────────────────────

describe('computeScheduleRisk', () => {
  it('flags zero-float critical task as high risk', () => {
    const r = computeScheduleRisk({
      id: 't1',
      percent_complete: 30,
      expected_percent: 60,
      float_days: 0,
      predecessors_complete: false,
    });
    expect(r.level === 'high' || r.level === 'critical').toBe(true);
  });

  it('reports low risk when on track with float', () => {
    const r = computeScheduleRisk({
      id: 't1',
      percent_complete: 60,
      expected_percent: 50,
      float_days: 20,
      predecessors_complete: true,
    });
    expect(r.score).toBeLessThan(50);
  });

  it('weighs progressGap heavily', () => {
    const r = computeScheduleRisk({
      id: 't1',
      percent_complete: 0,
      expected_percent: 80,
      float_days: 5,
    });
    expect(r.factors[0].contribution).toBeGreaterThan(50);
  });

  it('considers weather-dependent activities riskier', () => {
    const sunny = computeScheduleRisk({
      id: 't1',
      percent_complete: 50,
      expected_percent: 50,
      float_days: 5,
      weather_dependent: false,
    });
    const stormy = computeScheduleRisk({
      id: 't1',
      percent_complete: 50,
      expected_percent: 50,
      float_days: 5,
      weather_dependent: true,
      season_risk: 0.8,
    });
    expect(stormy.score).toBeGreaterThan(sunny.score);
  });
});

// ── computeSafetyRisk ──────────────────────────────────────────

describe('computeSafetyRisk', () => {
  it('reports low risk for spotless safety record', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 365,
      inspections_required_30d: 5,
      inspections_completed_30d: 5,
      open_corrective_actions: 0,
      certs_expiring_30d: 0,
    });
    expect(r.score).toBeLessThan(50);
  });

  it('reports high risk for recent incident + missed inspections', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 0,
      inspections_required_30d: 10,
      inspections_completed_30d: 0,
      open_corrective_actions: 5,
      certs_expiring_30d: 5,
    });
    expect(r.level === 'high' || r.level === 'critical').toBe(true);
  });

  it('handles zero required inspections without divide-by-zero', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 100,
      inspections_required_30d: 0,
      inspections_completed_30d: 0,
      open_corrective_actions: 0,
      certs_expiring_30d: 0,
    });
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it('captures TRIR trend in factors', () => {
    const upTrend = computeSafetyRisk({
      days_since_last_incident: 50,
      inspections_required_30d: 5,
      inspections_completed_30d: 5,
      open_corrective_actions: 0,
      certs_expiring_30d: 0,
      trir_trend: 1,
    });
    const trirFactor = upTrend.factors.find(f => f.name.includes('TRIR'));
    expect(trirFactor?.description).toBe('TRIR trending up');
  });

  it('reports stable TRIR when trend is 0', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 50,
      inspections_required_30d: 5,
      inspections_completed_30d: 5,
      open_corrective_actions: 0,
      certs_expiring_30d: 0,
      trir_trend: 0,
    });
    expect(r.factors.find(f => f.name.includes('TRIR'))?.description).toBe('TRIR stable');
  });
});

// ── overallProjectRisk ─────────────────────────────────────────

describe('overallProjectRisk', () => {
  it('returns 0 when no parts supplied', () => {
    expect(overallProjectRisk({})).toBe(0);
  });

  it('averages provided categories', () => {
    expect(overallProjectRisk({ rfi: 50, budget: 70, schedule: 30 })).toBe(50);
  });

  it('ignores undefined parts', () => {
    expect(
      overallProjectRisk({ rfi: 100, budget: undefined, schedule: 0, safety: undefined }),
    ).toBe(50);
  });
});
