import { describe, it, expect } from 'vitest';
import { riskRanker, classifyRisk } from '../riskRanker';
import type { PortfolioProjectInput } from '../../../types/portfolio';

const HEALTHY: PortfolioProjectInput = {
  project_id: 'p1',
  project_name: 'Healthy',
  contract_value: 5_000_000,
  schedule_variance_days: 1,
  percent_complete: 60,
  rfis_overdue: 0,
  payapp_status: 'on_track',
  safety_incidents_ytd: 0,
  profit_margin_pct: 12,
};

const TROUBLED: PortfolioProjectInput = {
  project_id: 'p2',
  project_name: 'Troubled',
  contract_value: 25_000_000,
  schedule_variance_days: -45,
  percent_complete: 30,
  rfis_overdue: 18,
  payapp_status: 'overdue',
  safety_incidents_ytd: 4,
  profit_margin_pct: -1,
  budget_variance_pct: 22,
};

describe('classifyRisk', () => {
  it('green for healthy', () => {
    const result = classifyRisk(HEALTHY);
    expect(result.riskLevel).toBe('green');
    expect(result.riskScore).toBeLessThan(30);
  });

  it('red for troubled', () => {
    const result = classifyRisk(TROUBLED);
    expect(result.riskLevel).toBe('red');
    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.riskFactors.length).toBeGreaterThan(0);
  });

  it('reports schedule-slip factor', () => {
    const result = classifyRisk(TROUBLED);
    expect(result.riskFactors.some((f) => f.includes('schedule slip'))).toBe(true);
  });

  it('reports overdue payapp factor', () => {
    const result = classifyRisk(TROUBLED);
    expect(result.riskFactors.some((f) => f.toLowerCase().includes('pay app'))).toBe(true);
  });

  it('clamps score 0-100', () => {
    const insane: PortfolioProjectInput = {
      ...TROUBLED,
      schedule_variance_days: -10000,
      safety_incidents_ytd: 100,
      rfis_overdue: 999,
      profit_margin_pct: -50,
      budget_variance_pct: 200,
    };
    const result = classifyRisk(insane);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
  });
});

describe('riskRanker', () => {
  it('sorts most-at-risk first', () => {
    const ranked = riskRanker([HEALTHY, TROUBLED]);
    expect(ranked[0].project_id).toBe('p2');
    expect(ranked[1].project_id).toBe('p1');
  });

  it('handles empty', () => {
    expect(riskRanker([])).toEqual([]);
  });

  it('returns same number of projects', () => {
    const ranked = riskRanker([HEALTHY, TROUBLED, { ...HEALTHY, project_id: 'p3' }]);
    expect(ranked.length).toBe(3);
  });
});
