import { describe, it, expect } from 'vitest'
import {
  computeProjectFinancials,
  computeDivisionFinancials,
  computeEarnedValue,
  computeCashFlowForecast,
  detectBudgetAnomalies,
  getApprovedCOTotal,
} from '../../lib/financialEngine'
import type { MappedDivision, MappedChangeOrder } from '../../api/endpoints/budget'
import type { BudgetItemRow } from '../../types/api'
import type { InvoiceRow, ProjectFinancials, DivisionFinancials } from '../../types/financial'

// ── Test data builders ──────────────────────────────────────────

function makeDivision(overrides: Partial<MappedDivision> = {}): MappedDivision {
  return {
    id: 'div-001',
    name: 'Concrete',
    csi_division: '03',
    budget: 1_000_000,
    spent: 400_000,
    committed: 800_000,
    progress: 50,
    cost_code: '03-100',
    ...overrides,
  }
}

function makeCO(overrides: Partial<MappedChangeOrder> = {}): MappedChangeOrder {
  return {
    id: 'co-001',
    coNumber: 'CO-001',
    title: 'Foundation Scope Change',
    description: '',
    amount: 50_000,
    estimated_cost: 45_000,
    submitted_cost: 48_000,
    approved_cost: 50_000,
    status: 'approved',
    type: 'co',
    reason_code: null,
    schedule_impact_days: 0,
    cost_code: null,
    budget_line_item_id: null,
    parent_co_id: null,
    promoted_from_id: null,
    submitted_by: null,
    ...overrides,
  }
}

// ── computeProjectFinancials ──────────────────────────────────

describe('computeProjectFinancials', () => {
  it('should return isEmpty true when no divisions', () => {
    const result = computeProjectFinancials([], [], 1_000_000)
    expect(result.isEmpty).toBe(true)
  })

  it('should compute revised contract value with approved COs', () => {
    const divisions = [makeDivision()]
    const changeOrders = [makeCO({ status: 'approved', approved_cost: 50_000 })]
    const result = computeProjectFinancials(divisions, changeOrders, 1_000_000)
    expect(result.revisedContractValue).toBe(1_050_000)
  })

  it('should exclude pending COs from revised contract value', () => {
    const divisions = [makeDivision()]
    const changeOrders = [makeCO({ status: 'pending_review', approved_cost: 0 })]
    const result = computeProjectFinancials(divisions, changeOrders, 1_000_000)
    expect(result.revisedContractValue).toBe(1_000_000)
  })

  it('should compute invoiced to date from divisions', () => {
    const divisions = [
      makeDivision({ spent: 200_000 }),
      makeDivision({ id: 'div-002', name: 'Steel', spent: 300_000 }),
    ]
    const result = computeProjectFinancials(divisions, [], 2_000_000)
    expect(result.invoicedToDate).toBe(500_000)
  })

  it('should compute committed cost from divisions', () => {
    const divisions = [
      makeDivision({ committed: 600_000 }),
      makeDivision({ id: 'div-002', name: 'Steel', committed: 400_000 }),
    ]
    const result = computeProjectFinancials(divisions, [], 2_000_000)
    expect(result.committedCost).toBe(1_000_000)
  })

  it('should compute cost to complete as max 0', () => {
    const divisions = [makeDivision({ committed: 500_000, spent: 600_000 })]
    const result = computeProjectFinancials(divisions, [], 1_000_000)
    expect(result.costToComplete).toBe(0) // spent > committed, clamped to 0
  })

  it('should compute cost to complete', () => {
    const divisions = [makeDivision({ committed: 800_000, spent: 400_000 })]
    const result = computeProjectFinancials(divisions, [], 1_000_000)
    expect(result.costToComplete).toBe(400_000)
  })

  it('should compute percent complete from committed vs invoiced', () => {
    const divisions = [makeDivision({ committed: 1_000_000, spent: 500_000 })]
    const result = computeProjectFinancials(divisions, [], 1_000_000)
    expect(result.percentComplete).toBe(50)
  })

  it('should compute retainage as 10% of invoiced', () => {
    const divisions = [makeDivision({ spent: 400_000 })]
    const result = computeProjectFinancials(divisions, [], 1_000_000)
    expect(result.retainageHeld).toBe(40_000)
  })

  it('should compute positive variance when under budget', () => {
    const divisions = [makeDivision({ committed: 700_000, spent: 700_000 })]
    const result = computeProjectFinancials(divisions, [], 1_000_000)
    expect(result.variance).toBeGreaterThan(0)
  })

  it('should compute negative variance when over budget', () => {
    const divisions = [makeDivision({ committed: 1_100_000, spent: 1_100_000 })]
    const result = computeProjectFinancials(divisions, [], 1_000_000)
    expect(result.variance).toBeLessThan(0)
  })

  it('should throw on invalid inputs', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => computeProjectFinancials(null as any, [], 0)).toThrow('Invalid financial inputs')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => computeProjectFinancials([], null as any, 0)).toThrow('Invalid financial inputs')
  })

  it('should handle empty changeOrders', () => {
    const divisions = [makeDivision()]
    const result = computeProjectFinancials(divisions, [], 500_000)
    expect(result.approvedChangeOrders).toBe(0)
    expect(result.pendingChangeOrders).toBe(0)
  })
})

// ── getApprovedCOTotal ────────────────────────────────────────

describe('getApprovedCOTotal', () => {
  it('should return 0 for empty list', () => {
    expect(getApprovedCOTotal([])).toBe(0)
  })

  it('should sum only approved COs', () => {
    const cos = [
      makeCO({ status: 'approved', approved_cost: 50_000 }),
      makeCO({ id: 'co-2', status: 'pending_review', approved_cost: 30_000 }),
      makeCO({ id: 'co-3', status: 'approved', approved_cost: 20_000 }),
    ]
    expect(getApprovedCOTotal(cos)).toBe(70_000)
  })

  it('should return 0 when no approved COs', () => {
    const cos = [makeCO({ status: 'pending_review', approved_cost: 100_000 })]
    expect(getApprovedCOTotal(cos)).toBe(0)
  })
})

// ── computeDivisionFinancials ─────────────────────────────────

describe('computeDivisionFinancials', () => {
  it('should return empty array for no divisions', () => {
    expect(computeDivisionFinancials([], [])).toHaveLength(0)
  })

  it('should compute revised budget with approved COs for matching cost code', () => {
    const division = makeDivision({ cost_code: '03-100', budget: 1_000_000 })
    const co = makeCO({ status: 'approved', cost_code: '03-100', approved_cost: 100_000 })
    const result = computeDivisionFinancials([division], [co])
    expect(result[0].revisedBudget).toBe(1_100_000)
  })

  it('should not apply COs for different cost code', () => {
    const division = makeDivision({ cost_code: '03-100', budget: 1_000_000 })
    const co = makeCO({ status: 'approved', cost_code: '05-100', approved_cost: 100_000 })
    const result = computeDivisionFinancials([division], [co])
    expect(result[0].revisedBudget).toBe(1_000_000)
  })

  it('should compute cost to complete as max 0', () => {
    const division = makeDivision({ committed: 500_000, spent: 700_000 })
    const result = computeDivisionFinancials([division], [])
    expect(result[0].costToComplete).toBe(0)
  })

  it('should compute variance correctly', () => {
    const division = makeDivision({ budget: 1_000_000, committed: 800_000, spent: 800_000 })
    const result = computeDivisionFinancials([division], [])
    expect(result[0].variance).toBe(200_000)
  })

  it('should map division name', () => {
    const division = makeDivision({ name: 'Electrical' })
    const result = computeDivisionFinancials([division], [])
    expect(result[0].divisionName).toBe('Electrical')
  })

  it('should handle null cost_code', () => {
    const division = makeDivision({ cost_code: null })
    const result = computeDivisionFinancials([division], [])
    expect(result[0].divisionCode).toBe('')
  })
})

// ── computeEarnedValue ────────────────────────────────────────

describe('computeEarnedValue', () => {
  const past = new Date(Date.now() - 180 * 86400000).toISOString()

  const budgetItems: BudgetItemRow[] = [
    {
      id: 'bi-1', project_id: 'p1', name: 'Concrete', original_amount: 500_000,
      committed_amount: 400_000, invoiced_amount: 200_000, percent_complete: 50,
      cost_code: null, description: null, created_at: past, updated_at: past,
      category: null, unit_of_measure: null, unit_price: null, quantity: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  ]

  it('should return default CPI of 1 when ACWP is 0', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    expect(result.cpi).toBe(1.0)
  })

  it('should return default SPI of 1 when no schedule activities', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    expect(result.spi).toBe(1.0)
  })

  it('should compute BCWP from percent_complete', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    // BCWP = 500_000 * 0.50 = 250_000
    expect(result.bcwp).toBe(250_000)
  })

  it('should compute ACWP from approved/paid invoices', () => {
    const invoices: InvoiceRow[] = [
      { id: 'inv-1', status: 'approved', total: 200_000 },
      { id: 'inv-2', status: 'draft', total: 100_000 },
    ]
    const result = computeEarnedValue(budgetItems, [], invoices, [])
    expect(result.acwp).toBe(200_000)
  })

  it('should include paid invoices in ACWP', () => {
    const invoices: InvoiceRow[] = [{ id: 'inv-1', status: 'paid', total: 150_000 }]
    const result = computeEarnedValue(budgetItems, [], invoices, [])
    expect(result.acwp).toBe(150_000)
  })

  it('should compute schedule variance days as 0 with no activities', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    expect(result.scheduleVarianceDays).toBe(0)
  })

  it('should compute BAC as budget + approved COs', () => {
    const co = makeCO({ status: 'approved', approved_cost: 100_000 })
    const result = computeEarnedValue(budgetItems, [co], [], [])
    // BAC = 500_000 + 100_000 = 600_000
    expect(result.eac).toBe(600_000) // EAC = BAC / CPI = 600_000 / 1 = 600_000
  })
})

// ── detectBudgetAnomalies ─────────────────────────────────────

function makeProjectFinancials(overrides: Partial<ProjectFinancials> = {}): ProjectFinancials {
  return {
    isEmpty: false,
    originalContractValue: 1_000_000,
    approvedChangeOrders: 0,
    approvedCOValue: 0,
    revisedContractValue: 1_000_000,
    pendingChangeOrders: 0,
    pendingCOValue: 0,
    pendingExposure: 0,
    totalPotentialContract: 1_000_000,
    committedCost: 800_000,
    invoicedToDate: 400_000,
    costToComplete: 400_000,
    projectedFinalCost: 800_000,
    variance: 200_000,
    variancePercent: 20,
    percentComplete: 50,
    retainageHeld: 40_000,
    retainageReceivable: 40_000,
    overUnder: 200_000,
    ...overrides,
  }
}

function makeDivisionFinancials(overrides: Partial<DivisionFinancials> = {}): DivisionFinancials {
  return {
    divisionCode: '03',
    divisionName: 'Concrete',
    originalBudget: 1_000_000,
    approvedChanges: 0,
    revisedBudget: 1_000_000,
    committedCost: 800_000,
    invoicedToDate: 400_000,
    costToComplete: 400_000,
    projectedFinalCost: 800_000,
    variance: 200_000,
    variancePercent: 20,
    percentComplete: 50,
    ...overrides,
  }
}

describe('detectBudgetAnomalies', () => {
  it('should return empty for isEmpty financials', () => {
    const financials = makeProjectFinancials({ isEmpty: true })
    expect(detectBudgetAnomalies(financials, [])).toHaveLength(0)
  })

  it('should flag critical when projected cost exceeds revised budget', () => {
    const financials = makeProjectFinancials()
    const division = makeDivisionFinancials({
      divisionName: 'Steel',
      projectedFinalCost: 1_100_000,
      revisedBudget: 1_000_000,
      invoicedToDate: 800_000,
    })
    const anomalies = detectBudgetAnomalies(financials, [division])
    expect(anomalies[0].severity).toBe('critical')
    expect(anomalies[0].divisionName).toBe('Steel')
  })

  it('should flag warning when spent exceeds 85% of budget', () => {
    const financials = makeProjectFinancials()
    const division = makeDivisionFinancials({
      divisionName: 'Concrete',
      projectedFinalCost: 800_000,
      revisedBudget: 1_000_000,
      invoicedToDate: 900_000, // 90% spent
    })
    const anomalies = detectBudgetAnomalies(financials, [division])
    expect(anomalies[0].severity).toBe('warning')
  })

  it('should not flag when under 85% spent and under budget', () => {
    const financials = makeProjectFinancials()
    const division = makeDivisionFinancials({
      divisionName: 'Electrical',
      projectedFinalCost: 400_000,
      revisedBudget: 1_000_000,
      invoicedToDate: 400_000, // 40%
    })
    const anomalies = detectBudgetAnomalies(financials, [division])
    expect(anomalies).toHaveLength(0)
  })

  it('should return multiple anomalies for multiple over-budget divisions', () => {
    const financials = makeProjectFinancials()
    const divisions = [
      makeDivisionFinancials({ divisionName: 'A', projectedFinalCost: 1_100_000, revisedBudget: 1_000_000, invoicedToDate: 900_000 }),
      makeDivisionFinancials({ divisionName: 'B', projectedFinalCost: 1_200_000, revisedBudget: 1_000_000, invoicedToDate: 900_000 }),
    ]
    const anomalies = detectBudgetAnomalies(financials, divisions)
    expect(anomalies).toHaveLength(2)
  })
})

// ── computeCashFlowForecast ───────────────────────────────────

describe('computeCashFlowForecast', () => {
  const startDate = new Date('2026-01-01')

  it('should return 13 weeks', () => {
    const result = computeCashFlowForecast(
      Array(13).fill(100_000),
      Array(13).fill(80_000),
      500_000,
      startDate,
    )
    expect(result.weeks).toHaveLength(13)
  })

  it('should compute cumulative position correctly', () => {
    // Each week: inflow 100, outflow 80, net +20k, starting 500k
    const result = computeCashFlowForecast(
      Array(13).fill(100_000),
      Array(80_000).fill(80_000),
      500_000,
      startDate,
    )
    expect(result.currentCashPosition).toBe(500_000)
  })

  it('should track lowest projected position', () => {
    // Net negative each week
    const result = computeCashFlowForecast(
      Array(13).fill(50_000),
      Array(13).fill(100_000),
      500_000,
      startDate,
    )
    expect(result.lowestProjectedPosition).toBeLessThan(500_000)
  })

  it('should handle missing inflow/outflow entries', () => {
    // Only 5 weeks provided, rest default to 0
    const result = computeCashFlowForecast(
      [100_000, 100_000, 100_000, 100_000, 100_000],
      [80_000, 80_000],
      0,
      startDate,
    )
    expect(result.weeks).toHaveLength(13)
    // Week 6+ should have 0 inflow/outflow
    expect(result.weeks[5].projectedInflow).toBe(0)
  })

  it('should assign weekly labels', () => {
    const result = computeCashFlowForecast([], [], 0, startDate)
    expect(result.weeks[0].weekLabel).toBe('Wk 1')
    expect(result.weeks[12].weekLabel).toBe('Wk 13')
  })

  it('should set lowestPositionWeek to correct week index', () => {
    // Cash starts at 1000, drops most in week 3
    const inflows = Array(13).fill(0)
    const outflows = Array(13).fill(0)
    outflows[2] = 500 // week 3 has a big outflow
    const result = computeCashFlowForecast(inflows, outflows, 1000, startDate)
    expect(result.lowestPositionWeek).toBe(3)
  })
})
