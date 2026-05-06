import { describe, it, expect } from 'vitest'
import type { MappedChangeOrder, MappedDivision } from '../../api/endpoints/budget'
import { computeProjectFinancials, getApprovedCOTotal } from '../../lib/financialEngine'

function makeCO(overrides: Partial<MappedChangeOrder> = {}): MappedChangeOrder {
  return {
    id: 'co-1',
    coNumber: 'CO-001',
    title: 'Test CO',
    description: '',
    amount: 50_000,
    estimated_cost: 50_000,
    submitted_cost: 50_000,
    approved_cost: 0,
    status: 'draft',
    type: 'co',
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
  }
}

function makeDivision(overrides: Partial<MappedDivision> = {}): MappedDivision {
  return {
    id: 'div-1',
    name: 'Concrete',
    csi_division: null,
    budget: 400_000,
    spent: 200_000,
    committed: 350_000,
    progress: 50,
    cost_code: '03',
    ...overrides,
  }
}

// Mapper logic (mirrors getCostData mapper) isolated for unit testing.
// This keeps the test independent of Supabase.
function mapApprovedCost(co: {
  status: string | null
  approved_amount: number | null
  amount: number | null
}): number {
  return co.status === 'approved' ? (co.approved_amount ?? co.amount ?? 0) : 0
}

function mapSubmittedCost(co: {
  status: string | null
  amount: number | null
}): number {
  return ['submitted', 'approved', 'rejected'].includes(co.status ?? '') ? (co.amount ?? 0) : 0
}

describe('change order mapper: approved_cost', () => {
  it('draft CO produces approved_cost=0', () => {
    expect(mapApprovedCost({ status: 'draft', approved_amount: null, amount: 50_000 })).toBe(0)
  })

  it('approved CO with no approved_amount falls back to amount', () => {
    expect(mapApprovedCost({ status: 'approved', approved_amount: null, amount: 50_000 })).toBe(50_000)
  })

  it('approved CO uses approved_amount when present', () => {
    expect(mapApprovedCost({ status: 'approved', approved_amount: 45_000, amount: 50_000 })).toBe(45_000)
  })

  it('submitted CO produces approved_cost=0', () => {
    expect(mapApprovedCost({ status: 'submitted', approved_amount: null, amount: 50_000 })).toBe(0)
  })
})

describe('change order mapper: submitted_cost', () => {
  it('draft CO produces submitted_cost=0', () => {
    expect(mapSubmittedCost({ status: 'draft', amount: 50_000 })).toBe(0)
  })

  it('submitted CO produces submitted_cost=amount', () => {
    expect(mapSubmittedCost({ status: 'submitted', amount: 50_000 })).toBe(50_000)
  })

  it('approved CO produces submitted_cost=amount', () => {
    expect(mapSubmittedCost({ status: 'approved', amount: 50_000 })).toBe(50_000)
  })

  it('rejected CO produces submitted_cost=amount', () => {
    expect(mapSubmittedCost({ status: 'rejected', amount: 50_000 })).toBe(50_000)
  })
})

describe('computeProjectFinancials: mixed approved/pending/draft COs', () => {
  const divisions = [makeDivision()]
  const contractValue = 1_000_000

  it('Revised Contract Value = Original + sum(approved only), excludes draft and pending_review', () => {
    const approvedCO1 = makeCO({ id: 'co-1', status: 'approved', approved_cost: 30_000, amount: 30_000 })
    const approvedCO2 = makeCO({ id: 'co-2', status: 'approved', approved_cost: 20_000, amount: 20_000 })
    const pendingCO   = makeCO({ id: 'co-3', status: 'pending_review', approved_cost: 0, amount: 15_000 })
    const draftCO     = makeCO({ id: 'co-4', status: 'draft', approved_cost: 0, amount: 10_000 })

    const result = computeProjectFinancials(
      divisions,
      [approvedCO1, approvedCO2, pendingCO, draftCO],
      contractValue
    )

    expect(result.approvedChangeOrders).toBe(50_000)
    expect(result.revisedContractValue).toBe(1_050_000)
    expect(result.pendingChangeOrders).toBe(15_000)
  })
})

describe('computeProjectFinancials: revisedContractValue and pendingExposure', () => {
  const originalBudget = 1_000_000
  const divisions = [makeDivision({ budget: originalBudget })]

  it('revisedContractValue = originalBudget + approved_cost; pendingExposure = estimated_cost of pending_review', () => {
    const approvedCO = makeCO({
      id: 'co-approved',
      status: 'approved',
      approved_cost: 50_000,
      amount: 55_000,
      estimated_cost: 55_000,
    })
    const pendingCO = makeCO({
      id: 'co-pending',
      status: 'pending_review',
      approved_cost: 0,
      amount: 22_000,
      estimated_cost: 20_000,
    })
    const draftCO = makeCO({
      id: 'co-draft',
      status: 'draft',
      approved_cost: 0,
      amount: 30_000,
      estimated_cost: 30_000,
    })

    const result = computeProjectFinancials(divisions, [approvedCO, pendingCO, draftCO], originalBudget)

    expect(result.revisedContractValue).toBe(originalBudget + 50_000)
    expect(result.pendingExposure).toBe(20_000)
  })

  it('getApprovedCOTotal returns sum of approved_cost for approved COs only', () => {
    const cos = [
      makeCO({ id: 'a', status: 'approved', approved_cost: 50_000 }),
      makeCO({ id: 'b', status: 'pending_review', approved_cost: 0 }),
      makeCO({ id: 'c', status: 'draft', approved_cost: 0 }),
    ]
    expect(getApprovedCOTotal(cos)).toBe(50_000)
  })
})

describe('computeProjectFinancials with approved change order', () => {
  const divisions = [makeDivision()]
  const contractValue = 1_000_000

  it('approved CO with amount=50000 increases revisedContractValue by 50000', () => {
    const approvedCO = makeCO({ status: 'approved', approved_cost: 50_000 })
    const result = computeProjectFinancials(divisions, [approvedCO], contractValue)
    expect(result.approvedChangeOrders).toBe(50_000)
    expect(result.revisedContractValue).toBe(1_050_000)
  })

  it('draft CO does not affect revisedContractValue', () => {
    const draftCO = makeCO({ status: 'draft', approved_cost: 0 })
    const result = computeProjectFinancials(divisions, [draftCO], contractValue)
    expect(result.approvedChangeOrders).toBe(0)
    expect(result.revisedContractValue).toBe(contractValue)
  })

  it('approved CO affects variance computation', () => {
    const noCO = computeProjectFinancials(divisions, [], contractValue)
    const withApprovedCO = computeProjectFinancials(
      divisions,
      [makeCO({ status: 'approved', approved_cost: 50_000 })],
      contractValue
    )
    expect(withApprovedCO.variance).toBeGreaterThan(noCO.variance)
    expect(withApprovedCO.variance - noCO.variance).toBe(50_000)
  })
})
