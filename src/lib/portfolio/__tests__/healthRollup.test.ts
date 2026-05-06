import { describe, it, expect } from 'vitest';
import { healthRollup } from '../healthRollup';
import type { PortfolioProjectInput } from '../../../types/portfolio';

const baseProject: PortfolioProjectInput = {
  project_id: 'p1',
  project_name: 'Avery Oaks',
  contract_value: 10_000_000,
  schedule_variance_days: 0,
  percent_complete: 50,
  rfis_overdue: 0,
  payapp_status: 'on_track',
  safety_incidents_ytd: 0,
  profit_margin_pct: 12,
  status: 'active',
};

describe('healthRollup', () => {
  it('aggregates totals across active projects', () => {
    const result = healthRollup([
      { ...baseProject },
      { ...baseProject, project_id: 'p2', contract_value: 5_000_000, rfis_overdue: 3, safety_incidents_ytd: 1 },
    ]);
    expect(result.totalActiveValue).toBe(15_000_000);
    expect(result.totalOpenRfis).toBe(3);
    expect(result.totalIncidentsYtd).toBe(1);
    expect(result.totalProjects).toBe(2);
  });

  it('excludes closed and archived projects', () => {
    const result = healthRollup([
      { ...baseProject },
      { ...baseProject, project_id: 'p2', status: 'closed', contract_value: 50_000_000 },
      { ...baseProject, project_id: 'p3', status: 'archived', contract_value: 50_000_000 },
    ]);
    expect(result.totalActiveValue).toBe(10_000_000);
    expect(result.totalProjects).toBe(1);
  });

  it('weights percent complete by contract value', () => {
    const result = healthRollup([
      { ...baseProject, contract_value: 1_000_000, percent_complete: 90 },
      { ...baseProject, project_id: 'p2', contract_value: 9_000_000, percent_complete: 10 },
    ]);
    // (1*90 + 9*10) / 10 = 18
    expect(result.weightedPercentComplete).toBe(18);
  });

  it('classifies projectsAtRisk as red+yellow', () => {
    const red: PortfolioProjectInput = {
      ...baseProject,
      project_id: 'red',
      schedule_variance_days: -60,
      safety_incidents_ytd: 5,
      rfis_overdue: 25,
      profit_margin_pct: -2,
    };
    const result = healthRollup([{ ...baseProject }, red]);
    expect(result.projectsAtRisk).toBeGreaterThanOrEqual(1);
    expect(result.byStatus.red).toBeGreaterThanOrEqual(1);
  });

  it('handles empty input', () => {
    const result = healthRollup([]);
    expect(result.totalActiveValue).toBe(0);
    expect(result.weightedPercentComplete).toBe(0);
    expect(result.totalProjects).toBe(0);
  });

  it('treats undefined status as active by default', () => {
    const p: PortfolioProjectInput = { ...baseProject };
    delete (p as unknown as { status?: string }).status;
    const result = healthRollup([p]);
    expect(result.totalProjects).toBe(1);
  });
});
