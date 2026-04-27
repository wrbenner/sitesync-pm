import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RETAINAGE_RATE,
  computeProjectFinancials,
  getApprovedCOTotal,
  computeDivisionFinancials,
  detectBudgetAnomalies,
  computeCashFlowForecast,
} from './financialEngine'
import type { MappedDivision, MappedChangeOrder } from '../api/endpoints/budget'
import { fromCents } from '../types/money'

// IMPORTANT: financialEngine treats numeric inputs as ALREADY in cents — it
// only brands them via toCents() (which rounds, never multiplies). So an
// input of `100_000` is interpreted as 100_000 cents = $1,000.00, NOT
// $100,000. fromCents() unwraps to the raw cent value. Test expectations
// reflect this convention.

function div(o: Partial<MappedDivision> = {}): MappedDivision {
  return {
    id: 'd', name: 'Division', csi_division: '03',
    budget: 0, spent: 0, committed: 0, progress: 0, cost_code: null,
    ...o,
  }
}

function co(o: Partial<MappedChangeOrder> = {}): MappedChangeOrder {
  return {
    id: 'co', coNumber: 'CO-1', title: '', description: '',
    amount: 0, estimated_cost: 0, submitted_cost: 0, approved_cost: 0,
    status: 'approved', type: 'CO', reason_code: null, schedule_impact_days: 0,
    cost_code: null, budget_line_item_id: null, parent_co_id: null, promoted_from_id: null,
    submitted_by: null, submitted_at: null, reviewed_by: null, reviewed_at: null, review_comments: null,
    approved_by: null, approved_at: null, approval_comments: null,
    rejected_by: null, rejected_at: null, rejection_comments: null,
    promoted_at: null, requested_by: null, requested_date: null,
    created_at: null, number: 1,
    ...o,
  } as MappedChangeOrder
}

describe('financialEngine — DEFAULT_RETAINAGE_RATE', () => {
  it('is the construction-industry-standard 10%', () => {
    expect(DEFAULT_RETAINAGE_RATE).toBe(0.10)
  })
})

describe('financialEngine — computeProjectFinancials', () => {
  it('marks empty when no divisions and brands the contract value as-is', () => {
    const r = computeProjectFinancials([], [], 1_000_000)
    expect(r.isEmpty).toBe(true)
    expect(fromCents(r.originalContractValue)).toBe(1_000_000)
  })

  it('approved COs roll into revisedContractValue', () => {
    const r = computeProjectFinancials(
      [div({ budget: 100_000 })],
      [co({ status: 'approved', approved_cost: 25_000 })],
      1_000_000,
    )
    expect(fromCents(r.approvedChangeOrders)).toBe(25_000)
    expect(fromCents(r.revisedContractValue)).toBe(1_025_000)
  })

  it('pending COs are tracked separately and add to totalPotentialContract', () => {
    const r = computeProjectFinancials(
      [div()],
      [co({ status: 'pending_review', amount: 10_000, estimated_cost: 12_000 })],
      1_000_000,
    )
    expect(fromCents(r.pendingChangeOrders)).toBe(10_000)
    expect(fromCents(r.pendingExposure)).toBe(12_000)
    expect(fromCents(r.totalPotentialContract)).toBe(1_010_000)
  })

  it('costToComplete is committed minus invoiced (clamped at zero)', () => {
    // committed 800, spent 1000 → over-invoiced; cost-to-complete clamps at 0
    const r = computeProjectFinancials(
      [div({ committed: 800, spent: 1000 })],
      [],
      10_000,
    )
    expect(fromCents(r.costToComplete)).toBe(0)
  })

  it('retainage is invoicedToDate * retainageRate (default 10%)', () => {
    const r = computeProjectFinancials(
      [div({ spent: 100_000, committed: 100_000 })],
      [],
      1_000_000,
    )
    expect(fromCents(r.retainageHeld)).toBe(10_000) // 10% of 100k cents
  })

  it('respects an explicit retainage rate override', () => {
    const r = computeProjectFinancials(
      [div({ spent: 100_000, committed: 100_000 })],
      [],
      1_000_000,
      0.05,
    )
    expect(fromCents(r.retainageHeld)).toBe(5_000) // 5% of 100k
  })

  it('throws when divisions or changeOrders are not arrays', () => {
    // @ts-expect-error — invalid input on purpose
    expect(() => computeProjectFinancials(null, [], 1)).toThrow(/Invalid financial inputs/)
    // @ts-expect-error — invalid input on purpose
    expect(() => computeProjectFinancials([], null, 1)).toThrow(/Invalid financial inputs/)
  })
})

describe('financialEngine — getApprovedCOTotal', () => {
  it('sums only approved COs', () => {
    const total = getApprovedCOTotal([
      co({ status: 'approved', approved_cost: 10_000 }),
      co({ status: 'pending_review', approved_cost: 999 }),
      co({ status: 'rejected', approved_cost: 999 }),
      co({ status: 'approved', approved_cost: 5_000 }),
    ])
    expect(fromCents(total)).toBe(15_000)
  })

  it('returns zero for an empty list', () => {
    expect(fromCents(getApprovedCOTotal([]))).toBe(0)
  })
})

describe('financialEngine — computeDivisionFinancials', () => {
  it('matches division-level COs by cost_code', () => {
    const r = computeDivisionFinancials(
      [
        div({ name: 'Concrete', cost_code: 'C1', budget: 100_000 }),
        div({ name: 'Masonry',  cost_code: 'M1', budget: 50_000 }),
      ],
      [
        co({ status: 'approved', cost_code: 'C1', approved_cost: 10_000 }),
        co({ status: 'approved', cost_code: 'M1', approved_cost: 2_000 }),
        co({ status: 'pending_review', cost_code: 'C1', approved_cost: 999 }),
      ],
    )
    const concrete = r.find((d) => d.divisionName === 'Concrete')!
    expect(fromCents(concrete.approvedChanges)).toBe(10_000)
    expect(fromCents(concrete.revisedBudget)).toBe(110_000)

    const masonry = r.find((d) => d.divisionName === 'Masonry')!
    expect(fromCents(masonry.approvedChanges)).toBe(2_000)
  })

  it('variancePercent defaults to 0 when revisedBudget is 0', () => {
    const r = computeDivisionFinancials(
      [div({ budget: 0, committed: 0, spent: 0 })],
      [],
    )
    expect(r[0].variancePercent).toBe(0)
  })
})

describe('financialEngine — detectBudgetAnomalies', () => {
  it('returns no anomalies when project is empty', () => {
    const r = detectBudgetAnomalies(
      { isEmpty: true } as never,
      [],
    )
    expect(r).toEqual([])
  })

  it('flags critical when projected final cost exceeds revised budget', () => {
    const financials = { isEmpty: false } as never
    const r = detectBudgetAnomalies(financials, [
      {
        divisionCode: 'C',
        divisionName: 'Concrete',
        revisedBudget: 1000 as never,
        projectedFinalCost: 1200 as never,
        invoicedToDate: 0 as never,
        committedCost: 0 as never,
        approvedChanges: 0 as never,
        originalBudget: 1000 as never,
        costToComplete: 0 as never,
        variance: 0 as never,
        variancePercent: 0,
        percentComplete: 0,
      },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('critical')
    expect(r[0].variancePct).toBeCloseTo(20)
  })

  it('flags warning when spent ratio is above 85% but not over budget', () => {
    const financials = { isEmpty: false } as never
    const r = detectBudgetAnomalies(financials, [
      {
        divisionCode: 'C',
        divisionName: 'Concrete',
        revisedBudget: 1000 as never,
        projectedFinalCost: 900 as never,         // not over budget
        invoicedToDate: 900 as never,             // 90% spent
        committedCost: 0 as never,
        approvedChanges: 0 as never,
        originalBudget: 1000 as never,
        costToComplete: 0 as never,
        variance: 0 as never,
        variancePercent: 0,
        percentComplete: 0,
      },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('warning')
  })
})

describe('financialEngine — computeCashFlowForecast', () => {
  it('produces 13 weeks of forecast', () => {
    const r = computeCashFlowForecast(
      Array(13).fill(0),
      Array(13).fill(0),
      100_000,
      new Date('2026-01-01'),
    )
    expect(r.weeks).toHaveLength(13)
    expect(r.weeks[0].weekLabel).toBe('Wk 1')
    expect(r.weeks[12].weekLabel).toBe('Wk 13')
  })

  it('cumulative position tracks running balance from inflows minus outflows', () => {
    const inflows = [50_000, 50_000, 50_000, ...Array(10).fill(0)]
    const outflows = [10_000, 10_000, 10_000, ...Array(10).fill(0)]
    const r = computeCashFlowForecast(inflows, outflows, 100_000, new Date('2026-01-01'))

    // Starting 100k → +40k each of weeks 1-3 → 220k cumulative by week 3.
    expect(fromCents(r.weeks[0].cumulativePosition)).toBe(140_000)
    expect(fromCents(r.weeks[2].cumulativePosition)).toBe(220_000)
    expect(r.lowestPositionWeek).toBe(0) // no week dips below starting cash
  })

  it('detects the lowest projected week when outflows exceed inflows mid-window', () => {
    const inflows = Array(13).fill(0)
    const outflows = Array(13).fill(0)
    outflows[5] = 50_000 // drain in week 6
    const r = computeCashFlowForecast(inflows, outflows, 10_000, new Date('2026-01-01'))
    expect(r.lowestPositionWeek).toBe(6) // 1-indexed in the function
    expect(fromCents(r.lowestProjectedPosition)).toBe(-40_000)
  })

  it('weekStart advances by 7 days each week', () => {
    const r = computeCashFlowForecast(
      Array(13).fill(0),
      Array(13).fill(0),
      0,
      new Date('2026-01-01'),
    )
    // Week 0 -> Jan 1 (or Dec 31 / Jan 2 depending on TZ);
    // accept any of those 3 dates and just check the gap is 7 days.
    const w0 = new Date(r.weeks[0].weekStart).getTime()
    const w1 = new Date(r.weeks[1].weekStart).getTime()
    expect((w1 - w0) / 86_400_000).toBe(7)
  })
})
