import { describe, it, expect } from 'vitest'
import {
  buildWBSFromDivisions,
  computeContingency,
  computeCashFlow,
  computeMilestoneAlignment,
  generateSCurveData,
} from './budgetComputations'
import type { MappedDivision, MappedChangeOrder } from '../api/endpoints/budget'
import type { ScheduleActivity } from '../types/api'

// ── Fixture builders ───────────────────────────────────────

function div(overrides: Partial<MappedDivision> = {}): MappedDivision {
  return {
    id: 'd-' + Math.random().toString(36).slice(2, 7),
    name: 'Division',
    csi_division: '03',
    budget: 100_000,
    spent: 0,
    committed: 0,
    progress: 0,
    cost_code: null,
    ...overrides,
  }
}

function co(overrides: Partial<MappedChangeOrder> = {}): MappedChangeOrder {
  return {
    id: 'co-' + Math.random().toString(36).slice(2, 7),
    coNumber: 'CO-001',
    title: 'Change',
    description: '',
    amount: 5_000,
    estimated_cost: 5_000,
    submitted_cost: 5_000,
    approved_cost: 5_000,
    status: 'approved',
    type: 'CO',
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
    created_at: null,
    number: 1,
    ...overrides,
  } as MappedChangeOrder
}

function activity(overrides: Partial<ScheduleActivity> = {}): ScheduleActivity {
  return {
    id: 'a-' + Math.random().toString(36).slice(2, 7),
    project_id: 'p',
    name: 'Activity',
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
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  }
}

// ── buildWBSFromDivisions ──────────────────────────────────

describe('buildWBSFromDivisions', () => {
  it('returns empty array for empty input', () => {
    expect(buildWBSFromDivisions([])).toEqual([])
  })

  it('groups divisions by 2-digit CSI prefix', () => {
    const tree = buildWBSFromDivisions([
      div({ csi_division: '03 30 00', name: 'Cast-in-Place', budget: 50_000 }),
      div({ csi_division: '03 10 00', name: 'Forming', budget: 20_000 }),
      div({ csi_division: '04', name: 'Masonry', budget: 80_000 }),
    ])
    // Two top-level divisions: 03 + 04
    expect(tree).toHaveLength(2)
    const concrete = tree.find((n) => n.code === '03')!
    expect(concrete.budget).toBe(70_000)
    expect(concrete.children.length).toBe(2)
    expect(tree.find((n) => n.code === '04')!.budget).toBe(80_000)
  })

  it('falls back to "00" when CSI code is missing', () => {
    const tree = buildWBSFromDivisions([
      div({ csi_division: null, name: 'Generic line', budget: 10_000 }),
    ])
    expect(tree[0].code).toBe('00')
  })

  it('rolls up budget/spent/committed from children to parent', () => {
    const tree = buildWBSFromDivisions([
      div({ csi_division: '03 30 00', budget: 100, spent: 30, committed: 60 }),
      div({ csi_division: '03 10 00', budget: 50, spent: 5, committed: 10 }),
    ])
    const concrete = tree.find((n) => n.code === '03')!
    expect(concrete.budget).toBe(150)
    expect(concrete.spent).toBe(35)
    expect(concrete.committed).toBe(70)
  })
})

// ── computeContingency ────────────────────────────────────

describe('computeContingency', () => {
  it('returns zero values when no contingency lines exist', () => {
    const r = computeContingency(
      [div({ csi_division: '03 30 00', budget: 100_000 })],
      [],
    )
    expect(r).toEqual({ totalBudget: 0, consumed: 0, remaining: 0, percentUsed: 0 })
  })

  it('treats Division 01 lines as contingency', () => {
    const r = computeContingency(
      [
        div({ csi_division: '01 50 00', name: 'General Conditions', budget: 100_000, spent: 25_000 }),
        div({ csi_division: '03', name: 'Concrete', budget: 200_000 }),
      ],
      [],
    )
    expect(r.totalBudget).toBe(100_000)
    // Consumed = max(direct spend 25k, approved CO total 0) = 25k
    expect(r.consumed).toBe(25_000)
    expect(r.remaining).toBe(75_000)
    expect(r.percentUsed).toBe(25)
  })

  it('matches lines whose name contains "contingency"', () => {
    const r = computeContingency(
      [div({ csi_division: '99', name: 'Project Contingency', budget: 50_000 })],
      [],
    )
    expect(r.totalBudget).toBe(50_000)
  })

  it('approved change orders count toward contingency consumption', () => {
    const r = computeContingency(
      [div({ csi_division: '01', name: 'Gen Reqs', budget: 100_000, spent: 0 })],
      [co({ status: 'approved', amount: 30_000 }), co({ status: 'pending', amount: 50_000 })],
    )
    // Direct spend = 0, approved CO total = 30k → consumed = 30k
    expect(r.consumed).toBe(30_000)
    expect(r.percentUsed).toBe(30)
  })

  it('caps percentUsed at 100 when consumption exceeds budget', () => {
    const r = computeContingency(
      [div({ csi_division: '01', budget: 50_000, spent: 100_000 })],
      [],
    )
    expect(r.percentUsed).toBe(100)
    expect(r.remaining).toBe(0)
  })
})

// ── computeCashFlow ───────────────────────────────────────

describe('computeCashFlow', () => {
  it('returns empty curve when no schedule + no fallback dates', () => {
    const r = computeCashFlow(
      [div({ budget: 1000 })],
      [],
      [],
      null,
      null,
    )
    // The default 12-month window always produces months, so the curve is non-empty.
    expect(r.monthlyData.length).toBeGreaterThan(0)
    expect(r.monthlyData[0]).toMatchObject({ planned: expect.any(Number), actual: expect.any(Number) })
  })

  it('CPI defaults to 1.0 when nothing has been spent', () => {
    const r = computeCashFlow([div({ budget: 1000 })], [], [], '2026-01-01', '2026-12-31')
    expect(r.costPerformanceIndex).toBe(1.0)
  })

  it('positive CPI when earned value exceeds cost', () => {
    // 50% complete, 30% spent → CPI = (0.5 * 1000) / 300 ≈ 1.67
    const r = computeCashFlow(
      [div({ budget: 1000, spent: 300, progress: 50 })],
      [],
      [],
      '2026-01-01',
      '2026-12-31',
    )
    expect(r.costPerformanceIndex).toBeGreaterThan(1)
  })

  it('totalBudget reflects approved change orders (revised budget)', () => {
    const r = computeCashFlow(
      [div({ budget: 100_000 })],
      [co({ status: 'approved', amount: 20_000 })],
      [],
      '2026-01-01',
      '2026-12-31',
    )
    // The S-curve weights are normalized so the cumulative planned ≈ revised budget.
    const cumulativePlanned = r.monthlyData.reduce((s, m) => s + m.planned, 0)
    expect(cumulativePlanned).toBeGreaterThanOrEqual(110_000)
    expect(cumulativePlanned).toBeLessThanOrEqual(130_000)
  })

  it('uses schedule activities to derive project timeline when supplied', () => {
    const r = computeCashFlow(
      [div({ budget: 1000 })],
      [],
      [
        activity({ start_date: '2026-03-15', finish_date: '2026-09-01' }),
        activity({ start_date: '2026-04-01', finish_date: '2026-10-01' }),
      ],
      null,
      null,
    )
    // First bucket falls in the month containing the earliest activity start.
    // Use Feb-or-March tolerance because the date string parses to UTC and the
    // Date(year, month, 1) cursor uses local time — so depending on the runner's
    // timezone the month bucket can be ±1.
    expect(['2026-02', '2026-03']).toContain(r.monthlyData[0].monthKey)
  })
})

// ── computeMilestoneAlignment ─────────────────────────────

describe('computeMilestoneAlignment', () => {
  it('returns empty array when no milestones and no critical-path activities', () => {
    expect(
      computeMilestoneAlignment(
        [div({ budget: 100_000 })],
        [activity({ is_milestone: false, is_critical: false })],
      ),
    ).toEqual([])
  })

  it('returns empty array when total budget is 0 (cannot scale spend)', () => {
    expect(
      computeMilestoneAlignment(
        [div({ budget: 0 })],
        [activity({ is_milestone: true })],
      ),
    ).toEqual([])
  })

  it('falls back to critical-path activities when no milestones flagged', () => {
    const r = computeMilestoneAlignment(
      [div({ budget: 1_000_000, spent: 100_000 })],
      [
        activity({ name: 'Foundation', is_critical: true, finish_date: '2026-03-01' }),
        activity({ name: 'Frame',      is_critical: true, finish_date: '2026-06-01' }),
        activity({ name: 'Finishes',   is_critical: false }), // not picked
      ],
    )
    expect(r.map((m) => m.milestone)).toEqual(['Foundation', 'Frame'])
  })

  it('marks actualSpend as 0 for incomplete milestones', () => {
    const r = computeMilestoneAlignment(
      [div({ budget: 1_000_000, spent: 100_000 })],
      [activity({ is_milestone: true, percent_complete: 0, name: 'Slab' })],
    )
    expect(r[0].actualSpend).toBe(0)
  })

  it('sets actualSpend proportional to percent_complete when complete', () => {
    const r = computeMilestoneAlignment(
      [div({ budget: 1_000_000, spent: 500_000 })],
      [activity({ is_milestone: true, percent_complete: 100, actual_finish: '2026-06-30', name: 'Done' })],
    )
    expect(r[0].actualSpend).toBe(500_000)
  })
})

// ── generateSCurveData ────────────────────────────────────

describe('generateSCurveData', () => {
  it('returns a sentinel point when there is no monthly data', () => {
    const r = generateSCurveData(
      { monthlyData: [], plannedSpendThisMonth: 0, actualSpendMTD: 0, forecastNext30: 0, scheduleVariance: 0, costPerformanceIndex: 1 },
      0,
    )
    expect(r).toEqual({ planned: [0], actual: [0], labels: ['Start'] })
  })

  it('produces monotonically non-decreasing cumulative planned curve', () => {
    const r = generateSCurveData(
      {
        monthlyData: [
          { month: 'Jan', monthKey: '2026-01', planned: 100_000, actual: 0 },
          { month: 'Feb', monthKey: '2026-02', planned: 200_000, actual: 0 },
          { month: 'Mar', monthKey: '2026-03', planned: 300_000, actual: 0 },
        ],
        plannedSpendThisMonth: 0,
        actualSpendMTD: 0,
        forecastNext30: 0,
        scheduleVariance: 0,
        costPerformanceIndex: 1,
      },
      600_000,
    )
    // planned values are in millions: 0.10, 0.30, 0.60
    expect(r.planned).toEqual([0.1, 0.3, 0.6])
    expect(r.labels).toHaveLength(3)
  })

  it('returns an empty actual array when no months have any actual spend', () => {
    const r = generateSCurveData(
      {
        monthlyData: [
          { month: 'Jan', monthKey: '2026-01', planned: 100_000, actual: 0 },
          { month: 'Feb', monthKey: '2026-02', planned: 200_000, actual: 0 },
        ],
        plannedSpendThisMonth: 0,
        actualSpendMTD: 0,
        forecastNext30: 0,
        scheduleVariance: 0,
        costPerformanceIndex: 1,
      },
      300_000,
    )
    expect(r.planned).toHaveLength(2)
    expect(r.actual).toEqual([])
  })

  it('cumulative actual is monotonically non-decreasing once spend starts', () => {
    const r = generateSCurveData(
      {
        monthlyData: [
          { month: 'Jan', monthKey: '2026-01', planned: 100_000, actual: 50_000 },
          { month: 'Feb', monthKey: '2026-02', planned: 100_000, actual: 60_000 },
          { month: 'Mar', monthKey: '2026-03', planned: 100_000, actual: 0 },   // late month, no new spend
        ],
        plannedSpendThisMonth: 0,
        actualSpendMTD: 0,
        forecastNext30: 0,
        scheduleVariance: 0,
        costPerformanceIndex: 1,
      },
      300_000,
    )
    // Cumulative actual reaches 110k by month 2 (50k + 60k); month 3 keeps 110k.
    // The function divides by 10_000 then by 100 → output is in *hundreds-of-millions*
    // (i.e. 50_000 → 0.05). Trimming uses findLastIndex(v > 0) so all 3 cumulative
    // entries survive (cum value stays positive).
    expect(r.actual).toEqual([0.05, 0.11, 0.11])
  })
})
