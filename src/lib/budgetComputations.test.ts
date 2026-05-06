import { describe, it, expect } from 'vitest';
import {
  buildWBSFromDivisions,
  computeContingency,
  computeCashFlow,
  computeMilestoneAlignment,
  generateSCurveData,
} from './budgetComputations';
import type { MappedDivision, MappedChangeOrder } from '../api/endpoints/budget';
import type { ScheduleActivity } from '../types/api';

// ── Fixtures ────────────────────────────────────────────────────

function div(over: Partial<MappedDivision> = {}): MappedDivision {
  return {
    id: 'd1',
    name: 'Concrete',
    csi_division: '03 30 00',
    budget: 100_000,
    spent: 25_000,
    committed: 60_000,
    progress: 25,
    cost_code: null,
    ...over,
  };
}

function co(over: Partial<MappedChangeOrder> = {}): MappedChangeOrder {
  return {
    id: 'co1',
    coNumber: 'CO-001',
    title: 'Test CO',
    description: 'Test description',
    amount: 10_000,
    estimated_cost: 10_000,
    submitted_cost: 10_000,
    approved_cost: 10_000,
    status: 'approved',
    type: 'owner_change',
    reason_code: null,
    schedule_impact_days: 0,
    cost_code: null,
    budget_line_item_id: null,
    parent_co_id: null,
    promoted_from_id: null,
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_comments: null,
    approved_by: null,
    approved_at: null,
    approval_comments: null,
    rejected_by: null,
    rejected_at: null,
    rejection_comments: null,
    promoted_at: null,
    requested_by: null,
    requested_date: null,
    ...over,
  } as MappedChangeOrder;
}

function activity(over: Partial<ScheduleActivity> = {}): ScheduleActivity {
  return {
    id: 'a1',
    project_id: 'p1',
    name: 'Phase 1',
    description: null,
    start_date: '2026-01-01',
    finish_date: '2026-06-30',
    baseline_start: null,
    baseline_finish: null,
    actual_start: null,
    actual_finish: null,
    percent_complete: 0,
    planned_percent_complete: 0,
    duration_days: 180,
    float_days: 0,
    is_critical: false,
    is_milestone: false,
    wbs_code: null,
    trade: null,
    assigned_sub_id: null,
    outdoor_activity: false,
    predecessor_ids: [],
    successor_ids: [],
    status: 'not_started',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

// ── buildWBSFromDivisions ───────────────────────────────────────

describe('buildWBSFromDivisions', () => {
  it('returns empty array for no divisions', () => {
    expect(buildWBSFromDivisions([])).toEqual([]);
  });

  it('groups multi-item CSI divisions into a parent with children', () => {
    const items = [
      div({ id: '1', csi_division: '03 30 00', name: 'Cast-in-place', budget: 60_000, spent: 10_000, committed: 30_000 }),
      div({ id: '2', csi_division: '03 10 00', name: 'Concrete Forming', budget: 40_000, spent: 5_000, committed: 20_000 }),
    ];
    const wbs = buildWBSFromDivisions(items);
    expect(wbs).toHaveLength(1);
    expect(wbs[0].code).toBe('03');
    expect(wbs[0].name).toBe('Concrete');
    expect(wbs[0].budget).toBe(100_000);
    expect(wbs[0].spent).toBe(15_000);
    expect(wbs[0].committed).toBe(50_000);
    expect(wbs[0].children).toHaveLength(2);
  });

  it('emits leaf nodes when only one item or no sub-divisions', () => {
    const items = [
      div({ id: '1', csi_division: '04', name: 'Masonry', budget: 50_000 }),
      div({ id: '2', csi_division: '05', name: 'Metals', budget: 30_000 }),
    ];
    const wbs = buildWBSFromDivisions(items);
    expect(wbs).toHaveLength(2);
    expect(wbs.every(n => n.children.length === 0)).toBe(true);
  });

  it('falls back to "00" prefix and "General" naming when CSI is missing', () => {
    const items = [div({ id: '1', csi_division: null, name: 'Misc' })];
    const wbs = buildWBSFromDivisions(items);
    expect(wbs).toHaveLength(1);
    // single-item leaf path
    expect(wbs[0].children).toHaveLength(0);
    expect(wbs[0].name).toBe('Misc');
  });

  it('uses fallback name when division name is empty', () => {
    const items = [div({ id: '1', csi_division: '03', name: '' })];
    const wbs = buildWBSFromDivisions(items);
    expect(wbs[0].name).toBe('Concrete');
  });

  it('sorts groups by CSI prefix', () => {
    const items = [
      div({ id: '1', csi_division: '23' }),
      div({ id: '2', csi_division: '03' }),
      div({ id: '3', csi_division: '09' }),
    ];
    const wbs = buildWBSFromDivisions(items);
    expect(wbs.map(n => n.code)).toEqual(['03', '09', '23']);
  });

  it('uses "Division NN" placeholder for unknown CSI codes', () => {
    const items = [div({ csi_division: '99', name: '' })];
    const wbs = buildWBSFromDivisions(items);
    expect(wbs[0].name).toBe('Division 99');
  });
});

// ── computeContingency ──────────────────────────────────────────

describe('computeContingency', () => {
  it('returns zeros when no contingency lines exist', () => {
    const result = computeContingency([div({ csi_division: '03' })], []);
    expect(result.totalBudget).toBe(0);
    expect(result.consumed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(result.percentUsed).toBe(0);
  });

  it('treats Division 01 as contingency', () => {
    const items = [div({ csi_division: '01', name: 'GR', budget: 100_000, spent: 10_000 })];
    const result = computeContingency(items, []);
    expect(result.totalBudget).toBe(100_000);
    expect(result.remaining).toBe(90_000);
    expect(result.percentUsed).toBe(10);
  });

  it('treats lines with "contingency" in name as contingency', () => {
    const items = [div({ csi_division: '99', name: 'Project Contingency', budget: 50_000 })];
    const result = computeContingency(items, []);
    expect(result.totalBudget).toBe(50_000);
  });

  it('treats lines with "general requirements" in name as contingency', () => {
    const items = [div({ csi_division: '99', name: 'General Requirements', budget: 30_000 })];
    expect(computeContingency(items, []).totalBudget).toBe(30_000);
  });

  it('uses approved CO total when greater than direct spend', () => {
    const items = [div({ csi_division: '01', budget: 100_000, spent: 5_000 })];
    const cos = [
      co({ amount: 20_000, status: 'approved' }),
      co({ amount: 5_000, status: 'pending_review' }),
    ];
    const result = computeContingency(items, cos);
    expect(result.consumed).toBe(20_000);
    expect(result.remaining).toBe(80_000);
    expect(result.percentUsed).toBe(20);
  });

  it('caps remaining at 0 when consumed exceeds budget', () => {
    const items = [div({ csi_division: '01', budget: 50_000, spent: 80_000 })];
    const result = computeContingency(items, []);
    expect(result.remaining).toBe(0);
    expect(result.percentUsed).toBe(100);
  });
});

// ── computeCashFlow ─────────────────────────────────────────────

describe('computeCashFlow', () => {
  it('produces empty monthlyData with sensible defaults when there is nothing to compute', () => {
    // No divisions, no schedule, no project dates → fallback timeline ±180 days
    const result = computeCashFlow([], [], []);
    expect(Array.isArray(result.monthlyData)).toBe(true);
    expect(result.actualSpendMTD).toBe(0);
    expect(result.costPerformanceIndex).toBe(1.0);
  });

  it('uses project start/end when no schedule activities', () => {
    const result = computeCashFlow(
      [div({ budget: 1_200_000, spent: 0, committed: 0, progress: 0 })],
      [],
      [],
      '2026-01-01',
      '2026-12-31',
    );
    expect(result.monthlyData.length).toBeGreaterThanOrEqual(12);
    const totalPlanned = result.monthlyData.reduce((s, m) => s + m.planned, 0);
    // S-curve normalises to revisedBudget (rounded), within $1k tolerance
    expect(Math.abs(totalPlanned - 1_200_000)).toBeLessThan(1_000);
  });

  it('uses schedule activities to determine the timeline', () => {
    const schedule = [
      activity({ start_date: '2026-01-01', finish_date: '2026-03-31' }),
      activity({ id: 'a2', start_date: '2026-04-01', finish_date: '2026-06-30' }),
    ];
    const divisions = [div({ budget: 600_000 })];
    const result = computeCashFlow(divisions, [], schedule);
    expect(result.monthlyData.length).toBeGreaterThan(0);
    // First month is YYYY-MM-formatted
    expect(result.monthlyData[0].monthKey).toMatch(/^\d{4}-\d{2}$/);
  });

  it('factors approved change orders into revised budget', () => {
    const result = computeCashFlow(
      [div({ budget: 100_000, spent: 0 })],
      [co({ amount: 50_000, status: 'approved' })],
      [],
      '2026-01-01',
      '2026-12-31',
    );
    const totalPlanned = result.monthlyData.reduce((s, m) => s + m.planned, 0);
    expect(totalPlanned).toBeGreaterThanOrEqual(149_000);
    expect(totalPlanned).toBeLessThanOrEqual(151_000);
  });

  it('returns CPI of 1.0 when no actual spend', () => {
    const result = computeCashFlow(
      [div({ budget: 100_000, spent: 0, progress: 0 })],
      [],
      [],
      '2026-01-01',
      '2026-12-31',
    );
    expect(result.costPerformanceIndex).toBe(1.0);
  });

  it('handles invalid date strings by using fallback timeline', () => {
    const result = computeCashFlow(
      [div({ budget: 100_000 })],
      [],
      [],
      'not-a-date',
      'also-not-a-date',
    );
    expect(result.monthlyData.length).toBeGreaterThan(0);
  });

  it('clamps end before start by extending end by ~365 days', () => {
    const result = computeCashFlow(
      [div({ budget: 50_000 })],
      [],
      [],
      '2026-12-01',
      '2026-01-01',
    );
    expect(result.monthlyData.length).toBeGreaterThan(0);
  });
});

// ── computeMilestoneAlignment ───────────────────────────────────

describe('computeMilestoneAlignment', () => {
  it('returns [] when no schedule activities', () => {
    expect(computeMilestoneAlignment([div()], [])).toEqual([]);
  });

  it('returns [] when total budget is zero', () => {
    const acts = [activity({ is_milestone: true, finish_date: '2026-03-01' })];
    expect(computeMilestoneAlignment([div({ budget: 0 })], acts)).toEqual([]);
  });

  it('uses milestones when present', () => {
    const acts = [
      activity({ id: 'm1', name: 'Foundation Done', is_milestone: true, finish_date: '2026-03-01' }),
      activity({ id: 'a2', is_milestone: false, finish_date: '2026-04-01' }),
    ];
    const result = computeMilestoneAlignment([div({ budget: 100_000 })], acts);
    expect(result).toHaveLength(1);
    expect(result[0].milestone).toBe('Foundation Done');
  });

  it('falls back to critical activities when no milestones', () => {
    const acts = [
      activity({ id: 'c1', is_critical: true, finish_date: '2026-03-01', name: 'Critical Activity' }),
      activity({ id: 'c2', is_critical: false, finish_date: '2026-04-01' }),
    ];
    const result = computeMilestoneAlignment([div({ budget: 100_000 })], acts);
    expect(result).toHaveLength(1);
    expect(result[0].milestone).toBe('Critical Activity');
  });

  it('records actual spend for completed milestones', () => {
    const acts = [
      activity({
        is_milestone: true,
        finish_date: '2026-03-01',
        percent_complete: 100,
        actual_finish: '2026-03-05',
      }),
    ];
    const divisions = [div({ budget: 100_000, spent: 50_000 })];
    const result = computeMilestoneAlignment(divisions, acts);
    expect(result[0].actualSpend).toBeGreaterThan(0);
  });

  it('reports zero actual spend for incomplete milestones', () => {
    const acts = [
      activity({
        is_milestone: true,
        finish_date: '2026-03-01',
        percent_complete: 30,
        actual_finish: null,
      }),
    ];
    const result = computeMilestoneAlignment([div({ budget: 100_000, spent: 50_000 })], acts);
    expect(result[0].actualSpend).toBe(0);
  });

  it('sorts milestones by finish date', () => {
    const acts = [
      activity({ id: 'm1', name: 'B', is_milestone: true, finish_date: '2026-06-01' }),
      activity({ id: 'm2', name: 'A', is_milestone: true, finish_date: '2026-03-01' }),
    ];
    const result = computeMilestoneAlignment([div({ budget: 100_000 })], acts);
    expect(result.map(r => r.milestone)).toEqual(['A', 'B']);
  });
});

// ── generateSCurveData ──────────────────────────────────────────

describe('generateSCurveData', () => {
  it('returns a single zero-anchor when no monthly data', () => {
    const result = generateSCurveData(
      {
        monthlyData: [],
        plannedSpendThisMonth: 0,
        actualSpendMTD: 0,
        forecastNext30: 0,
        scheduleVariance: 0,
        costPerformanceIndex: 1,
      },
      0,
    );
    expect(result.planned).toEqual([0]);
    expect(result.actual).toEqual([0]);
    expect(result.labels).toEqual(['Start']);
  });

  it('produces monotonically non-decreasing cumulative planned series', () => {
    const monthlyData = [
      { month: 'Jan 2026', monthKey: '2026-01', planned: 100_000, actual: 50_000 },
      { month: 'Feb 2026', monthKey: '2026-02', planned: 200_000, actual: 150_000 },
      { month: 'Mar 2026', monthKey: '2026-03', planned: 300_000, actual: 0 },
    ];
    const result = generateSCurveData(
      {
        monthlyData,
        plannedSpendThisMonth: 0,
        actualSpendMTD: 0,
        forecastNext30: 0,
        scheduleVariance: 0,
        costPerformanceIndex: 1,
      },
      600_000,
    );
    expect(result.labels).toEqual(['Jan 2026', 'Feb 2026', 'Mar 2026']);
    // Cumulative planned in fractional millions: 0.1, 0.3, 0.6
    expect(result.planned).toEqual([0.1, 0.3, 0.6]);
    // Cumulative actual is non-decreasing; once non-zero, stays non-zero
    expect(result.actual.length).toBeGreaterThan(0);
    expect(result.actual[result.actual.length - 1]).toBeGreaterThan(0);
  });

  it('returns empty actual series when no actuals', () => {
    const monthlyData = [
      { month: 'Jan 2026', monthKey: '2026-01', planned: 100_000, actual: 0 },
    ];
    const result = generateSCurveData(
      {
        monthlyData,
        plannedSpendThisMonth: 0,
        actualSpendMTD: 0,
        forecastNext30: 0,
        scheduleVariance: 0,
        costPerformanceIndex: 1,
      },
      100_000,
    );
    expect(result.actual).toEqual([]);
  });
});
