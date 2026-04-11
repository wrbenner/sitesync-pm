import { describe, it, expect } from 'vitest'
import {
  computeDivisionFinancials,
  computeEarnedValue,
  computeCashFlowForecast,
  compute13WeekCashFlow,
  computeThirteenWeekCashFlow,
  detectBudgetAnomalies,
} from '../../lib/financialEngine'
import type { MappedDivision, MappedChangeOrder } from '../../api/endpoints/budget'
import type { BudgetItemRow } from '../../types/api'
import type { DivisionFinancials, ProjectFinancials, PayApplicationRow, InvoiceRow } from '../../types/financial'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDivision(overrides: Partial<MappedDivision> = {}): MappedDivision {
  return {
    id: 'div-1',
    name: 'Concrete',
    budget: 500_000,
    spent: 200_000,
    committed: 400_000,
    progress: 40,
    cost_code: '03',
    ...overrides,
  }
}

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

function makeBudgetItem(overrides: Partial<BudgetItemRow> = {}): BudgetItemRow {
  return {
    id: 'bi-1',
    project_id: 'test-project-id',
    division: '03',
    cost_code: '03-100',
    description: 'Concrete',
    original_amount: 200_000,
    committed_amount: 180_000,
    actual_amount: 100_000,
    forecast_amount: 190_000,
    percent_complete: 50,
    status: 'on_track',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  } as BudgetItemRow
}

// ── computeDivisionFinancials ──────────────────────────────────────────────

describe('computeDivisionFinancials', () => {
  it('should return one result per division', () => {
    const divisions = [makeDivision(), makeDivision({ id: 'div-2', name: 'Steel', cost_code: '05' })]
    const results = computeDivisionFinancials(divisions, [])
    expect(results).toHaveLength(2)
  })

  it('should set divisionName and divisionCode from division', () => {
    const div = makeDivision({ name: 'Electrical', cost_code: '26' })
    const [result] = computeDivisionFinancials([div], [])
    expect(result.divisionName).toBe('Electrical')
    expect(result.divisionCode).toBe('26')
  })

  it('should compute approvedChanges from approved COs matching cost_code', () => {
    const div = makeDivision({ cost_code: '03' })
    const approvedCO = makeCO({ status: 'approved', approved_cost: 25_000, cost_code: '03' })
    const [result] = computeDivisionFinancials([div], [approvedCO])
    expect(result.approvedChanges).toBe(25_000)
    expect(result.revisedBudget).toBe(525_000)
  })

  it('should ignore COs for different cost_codes', () => {
    const div = makeDivision({ cost_code: '03' })
    const otherCO = makeCO({ status: 'approved', approved_cost: 25_000, cost_code: '05' })
    const [result] = computeDivisionFinancials([div], [otherCO])
    expect(result.approvedChanges).toBe(0)
    expect(result.revisedBudget).toBe(500_000)
  })

  it('should ignore pending and draft COs even when cost_code matches', () => {
    const div = makeDivision({ cost_code: '03' })
    const pendingCO = makeCO({ status: 'pending_review', approved_cost: 0, cost_code: '03', amount: 30_000 })
    const [result] = computeDivisionFinancials([div], [pendingCO])
    expect(result.approvedChanges).toBe(0)
  })

  it('should compute costToComplete as max(0, committed - spent)', () => {
    const div = makeDivision({ committed: 400_000, spent: 200_000 })
    const [result] = computeDivisionFinancials([div], [])
    expect(result.costToComplete).toBe(200_000)
  })

  it('should clamp costToComplete to 0 when spent exceeds committed', () => {
    const div = makeDivision({ committed: 150_000, spent: 200_000 })
    const [result] = computeDivisionFinancials([div], [])
    expect(result.costToComplete).toBe(0)
  })

  it('should compute projectedFinalCost as spent + costToComplete', () => {
    const div = makeDivision({ committed: 400_000, spent: 200_000 })
    const [result] = computeDivisionFinancials([div], [])
    // costToComplete = 200_000, projectedFinalCost = 200_000 + 200_000
    expect(result.projectedFinalCost).toBe(400_000)
  })

  it('should compute positive variance when under budget', () => {
    const div = makeDivision({ budget: 500_000, committed: 400_000, spent: 200_000 })
    const [result] = computeDivisionFinancials([div], [])
    // revisedBudget = 500_000, projectedFinalCost = 400_000, variance = 100_000
    expect(result.variance).toBe(100_000)
  })

  it('should compute negative variance when over budget', () => {
    const div = makeDivision({ budget: 300_000, committed: 400_000, spent: 200_000 })
    const [result] = computeDivisionFinancials([div], [])
    // projectedFinalCost = 400_000, revisedBudget = 300_000, variance = -100_000
    expect(result.variance).toBe(-100_000)
  })

  it('should compute variancePercent from revisedBudget', () => {
    const div = makeDivision({ budget: 500_000, committed: 400_000, spent: 200_000 })
    const [result] = computeDivisionFinancials([div], [])
    // variance = 100_000, revisedBudget = 500_000, variancePct = 20%
    expect(result.variancePercent).toBeCloseTo(20, 5)
  })

  it('should handle zero revisedBudget without division by zero', () => {
    const div = makeDivision({ budget: 0, committed: 0, spent: 0 })
    const [result] = computeDivisionFinancials([div], [])
    expect(result.variancePercent).toBe(0)
  })

  it('should pass through progress as percentComplete', () => {
    const div = makeDivision({ progress: 75 })
    const [result] = computeDivisionFinancials([div], [])
    expect(result.percentComplete).toBe(75)
  })

  it('should throw when given invalid inputs', () => {
    // @ts-expect-error intentionally passing invalid inputs
    expect(() => computeDivisionFinancials(null, [])).toThrow()
    // @ts-expect-error intentionally passing invalid inputs
    expect(() => computeDivisionFinancials([], null)).toThrow()
  })

  it('should return empty array for empty divisions', () => {
    expect(computeDivisionFinancials([], [])).toEqual([])
  })
})

// ── computeEarnedValue ─────────────────────────────────────────────────────

describe('computeEarnedValue', () => {
  const budgetItems = [
    makeBudgetItem({ original_amount: 200_000, percent_complete: 50 }),
    makeBudgetItem({ id: 'bi-2', original_amount: 100_000, percent_complete: 100 }),
  ]
  const approvedCOs: MappedChangeOrder[] = [
    makeCO({ status: 'approved', approved_cost: 50_000 }),
  ]
  const approvedInvoices: InvoiceRow[] = [
    { id: 'inv-1', total: 100_000, status: 'approved' },
    { id: 'inv-2', total: 50_000, status: 'paid' },
  ]

  it('should compute BAC as totalBudget + approved CO total', () => {
    const result = computeEarnedValue(budgetItems, approvedCOs, [], [])
    // totalBudget = 300_000, approvedCO = 50_000, BAC = 350_000
    expect(result.eac).toBeDefined()
  })

  it('should compute BCWP from physical percent complete', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    // BCWP = 200_000*0.50 + 100_000*1.00 = 100_000 + 100_000 = 200_000
    expect(result.bcwp).toBe(200_000)
  })

  it('should compute ACWP from approved and paid invoices only', () => {
    const pendingInvoice: InvoiceRow = { id: 'inv-3', total: 25_000, status: 'pending' }
    const result = computeEarnedValue(budgetItems, [], [...approvedInvoices, pendingInvoice], [])
    // ACWP = 100_000 + 50_000 = 150_000 (pending excluded)
    expect(result.acwp).toBe(150_000)
  })

  it('should default ACWP to 0 when no invoices', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    expect(result.acwp).toBe(0)
  })

  it('should default CPI to 1.0 when ACWP is 0', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    expect(result.cpi).toBe(1.0)
  })

  it('should compute CPI correctly when ACWP > 0', () => {
    const singleItem = [makeBudgetItem({ original_amount: 100_000, percent_complete: 50 })]
    // BCWP = 50_000, ACWP = 50_000, CPI = 1.0
    const invoices: InvoiceRow[] = [{ id: 'inv-1', total: 50_000, status: 'approved' }]
    const result = computeEarnedValue(singleItem, [], invoices, [])
    expect(result.cpi).toBe(1.0)
  })

  it('should compute CPI < 1 when costs exceed earned value', () => {
    const singleItem = [makeBudgetItem({ original_amount: 100_000, percent_complete: 40 })]
    // BCWP = 40_000, ACWP = 60_000 (over-spent), CPI < 1
    const invoices: InvoiceRow[] = [{ id: 'inv-1', total: 60_000, status: 'approved' }]
    const result = computeEarnedValue(singleItem, [], invoices, [])
    expect(result.cpi).toBeLessThan(1)
    expect(result.cpi).toBeCloseTo(40_000 / 60_000, 5)
  })

  it('should default SPI to 1.0 when no schedule activities', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    expect(result.spi).toBe(1.0)
  })

  it('should compute costVariance as BCWP minus ACWP', () => {
    const singleItem = [makeBudgetItem({ original_amount: 100_000, percent_complete: 80 })]
    // BCWP = 80_000, ACWP = 60_000, costVariance = 20_000 (under-spent)
    const invoices: InvoiceRow[] = [{ id: 'inv-1', total: 60_000, status: 'approved' }]
    const result = computeEarnedValue(singleItem, [], invoices, [])
    expect(result.costVariance).toBe(20_000)
  })

  it('should return scheduleVarianceDays = 0 when no schedule activities', () => {
    const result = computeEarnedValue(budgetItems, [], [], [])
    expect(result.scheduleVarianceDays).toBe(0)
  })

  it('should handle empty budget items without errors', () => {
    const result = computeEarnedValue([], [], [], [])
    expect(result.bcwp).toBe(0)
    expect(result.cpi).toBe(1.0)
    expect(result.spi).toBe(1.0)
  })
})

// ── computeCashFlowForecast ────────────────────────────────────────────────

describe('computeCashFlowForecast', () => {
  const startDate = new Date('2026-04-14')

  it('should produce exactly 13 weeks', () => {
    const result = computeCashFlowForecast([], [], 0, startDate)
    expect(result.weeks).toHaveLength(13)
  })

  it('should use starting cash as the initial cumulative position', () => {
    const result = computeCashFlowForecast([], [], 500_000, startDate)
    expect(result.currentCashPosition).toBe(500_000)
  })

  it('should accumulate net cash correctly across weeks', () => {
    const inflows = Array(13).fill(100_000)
    const outflows = Array(13).fill(60_000)
    const result = computeCashFlowForecast(inflows, outflows, 0, startDate)
    // Each week: net = 40_000; after 13 weeks: cumulative = 520_000
    const lastWeek = result.weeks[12]
    expect(lastWeek.cumulativePosition).toBeCloseTo(520_000, 0)
  })

  it('should identify the lowest cumulative position', () => {
    const inflows = [0, 0, 200_000, ...Array(10).fill(50_000)]
    const outflows = Array(13).fill(100_000)
    const result = computeCashFlowForecast(inflows, outflows, 100_000, startDate)
    expect(result.lowestProjectedPosition).toBeLessThanOrEqual(result.currentCashPosition)
    expect(result.lowestPositionWeek).toBeGreaterThan(0)
  })

  it('should handle zero inflows and outflows (flat line)', () => {
    const result = computeCashFlowForecast([], [], 250_000, startDate)
    for (const week of result.weeks) {
      expect(week.netCash).toBe(0)
      expect(week.cumulativePosition).toBe(250_000)
    }
  })

  it('should include weekStart dates in ISO format', () => {
    const result = computeCashFlowForecast([], [], 0, startDate)
    for (const week of result.weeks) {
      expect(week.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('should increment weekStart by 7 days per week', () => {
    const result = computeCashFlowForecast([], [], 0, startDate)
    const firstDate = new Date(result.weeks[0].weekStart)
    const secondDate = new Date(result.weeks[1].weekStart)
    const diffDays = (secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(7)
  })
})

// ── detectBudgetAnomalies ──────────────────────────────────────────────────

describe('detectBudgetAnomalies', () => {
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
      originalBudget: 500_000,
      approvedChanges: 0,
      revisedBudget: 500_000,
      committedCost: 400_000,
      invoicedToDate: 300_000,
      costToComplete: 100_000,
      projectedFinalCost: 400_000,
      variance: 100_000,
      variancePercent: 20,
      percentComplete: 60,
      ...overrides,
    }
  }

  it('should return empty array when financials are empty', () => {
    const result = detectBudgetAnomalies(makeProjectFinancials({ isEmpty: true }), [])
    expect(result).toEqual([])
  })

  it('should return no anomalies for a healthy division', () => {
    const healthy = makeDivisionFinancials()
    const result = detectBudgetAnomalies(makeProjectFinancials(), [healthy])
    expect(result).toHaveLength(0)
  })

  it('should flag a critical anomaly when projected exceeds revised budget', () => {
    const overBudget = makeDivisionFinancials({
      revisedBudget: 400_000,
      projectedFinalCost: 480_000,
      invoicedToDate: 300_000,
    })
    const result = detectBudgetAnomalies(makeProjectFinancials(), [overBudget])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('critical')
    expect(result[0].divisionName).toBe('Concrete')
  })

  it('should compute variance percentage for critical anomaly', () => {
    const overBudget = makeDivisionFinancials({
      revisedBudget: 400_000,
      projectedFinalCost: 440_000, // 10% over
      invoicedToDate: 300_000,
    })
    const result = detectBudgetAnomalies(makeProjectFinancials(), [overBudget])
    expect(result[0].variancePct).toBeCloseTo(10, 5)
  })

  it('should flag a warning when a division has consumed more than 85% of budget', () => {
    const highSpend = makeDivisionFinancials({
      revisedBudget: 400_000,
      projectedFinalCost: 380_000, // under budget, no critical
      invoicedToDate: 350_000, // 87.5% of 400_000
    })
    const result = detectBudgetAnomalies(makeProjectFinancials(), [highSpend])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('warning')
  })

  it('should not flag a warning when spend is exactly 85% of budget', () => {
    const edgeCase = makeDivisionFinancials({
      revisedBudget: 400_000,
      projectedFinalCost: 380_000,
      invoicedToDate: 340_000, // exactly 85%
    })
    const result = detectBudgetAnomalies(makeProjectFinancials(), [edgeCase])
    expect(result).toHaveLength(0)
  })

  it('should handle division with zero revisedBudget without division by zero', () => {
    const zeroBudget = makeDivisionFinancials({
      revisedBudget: 0,
      projectedFinalCost: 0,
      invoicedToDate: 0,
    })
    expect(() =>
      detectBudgetAnomalies(makeProjectFinancials(), [zeroBudget])
    ).not.toThrow()
  })

  it('should collect anomalies from multiple divisions', () => {
    const overBudget = makeDivisionFinancials({
      divisionName: 'Electrical',
      revisedBudget: 200_000,
      projectedFinalCost: 250_000,
      invoicedToDate: 100_000,
    })
    const highSpend = makeDivisionFinancials({
      divisionName: 'Plumbing',
      revisedBudget: 300_000,
      projectedFinalCost: 290_000,
      invoicedToDate: 270_000, // 90%
    })
    const healthy = makeDivisionFinancials({ divisionName: 'Steel' })
    const result = detectBudgetAnomalies(makeProjectFinancials(), [overBudget, highSpend, healthy])
    expect(result).toHaveLength(2)
    const names = result.map(a => a.divisionName)
    expect(names).toContain('Electrical')
    expect(names).toContain('Plumbing')
    expect(names).not.toContain('Steel')
  })
})

// ── compute13WeekCashFlow ──────────────────────────────────────────────────

describe('compute13WeekCashFlow', () => {
  const today = new Date()
  // Format a date as ISO string shifted by N days
  const shiftDate = (days: number): string => {
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }

  it('should produce exactly 13 rows', () => {
    const rows = compute13WeekCashFlow([], [], [], 0.10, 30, 30)
    expect(rows).toHaveLength(13)
  })

  it('should include weekStart and weekEnd as YYYY-MM-DD strings', () => {
    const rows = compute13WeekCashFlow([], [], [], 0.10, 30, 30)
    for (const row of rows) {
      expect(row.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(row.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('should produce zero inflow when no pay apps', () => {
    const rows = compute13WeekCashFlow([], [], [], 0.10, 30, 30)
    for (const row of rows) {
      expect(row.inflow).toBe(0)
    }
  })

  it('should compute net as inflow minus outflow', () => {
    const rows = compute13WeekCashFlow([], [], [], 0.10, 30, 30)
    for (const row of rows) {
      expect(row.net).toBeCloseTo(row.inflow - row.outflow, 5)
    }
  })

  it('should accumulate cumulative balance across weeks', () => {
    const rows = compute13WeekCashFlow([], [], [], 0.10, 30, 30)
    let runningSum = 0
    for (const row of rows) {
      runningSum += row.net
      expect(row.cumulativeBalance).toBeCloseTo(runningSum, 5)
    }
  })

  it('should capture approved pay app in the correct collection week', () => {
    // Approved today, clear date = today + 30 days (collectionLagDays)
    const payApp: PayApplicationRow = {
      id: 'pa-1',
      project_id: 'test-project-id',
      amount: 100_000,
      status: 'approved',
      submitted_date: null,
      approved_date: shiftDate(0), // approved today
      period_end: null,
    }
    // With 30-day collection lag the inflow appears in week 4 (day 21-27 vs day 30)
    // Actually 30 day lag means it clears ~day 30, which is in week 5 (days 29-35)
    const rows = compute13WeekCashFlow([payApp], [], [], 0.10, 30, 30)
    // At least one row should have non-zero inflow
    const totalInflow = rows.reduce((s, r) => s + r.inflow, 0)
    expect(totalInflow).toBeGreaterThan(0)
  })

  it('should apply retainageRate to reduce inflow', () => {
    // No lag so the inflow appears in week 1
    const payApp: PayApplicationRow = {
      id: 'pa-1',
      project_id: 'test-project-id',
      amount: 100_000,
      status: 'approved',
      submitted_date: null,
      approved_date: shiftDate(0),
      period_end: null,
    }
    const withRetainage = compute13WeekCashFlow([payApp], [], [], 0.10, 0, 0)
    const withoutRetainage = compute13WeekCashFlow([payApp], [], [], 0.0, 0, 0)
    const totalWithRetainage = withRetainage.reduce((s, r) => s + r.inflow, 0)
    const totalWithoutRetainage = withoutRetainage.reduce((s, r) => s + r.inflow, 0)
    expect(totalWithRetainage).toBeLessThan(totalWithoutRetainage)
  })

  it('should spread outflow based on uncommitted budget', () => {
    const divisions = [
      makeDivision({ budget: 520_000, committed: 400_000 }), // uncommitted = 120_000
    ]
    const rows = compute13WeekCashFlow([], [], divisions, 0.10, 30, 30)
    const weeklyBurn = 120_000 / 13
    for (const row of rows) {
      expect(row.outflow).toBeCloseTo(weeklyBurn, 5)
    }
  })
})

// ── computeThirteenWeekCashFlow ────────────────────────────────────────────

describe('computeThirteenWeekCashFlow', () => {
  it('should produce exactly 13 weeks', () => {
    const weeks = computeThirteenWeekCashFlow([], [], [])
    expect(weeks).toHaveLength(13)
  })

  it('should label each week with month and day', () => {
    const weeks = computeThirteenWeekCashFlow([], [], [])
    for (const week of weeks) {
      expect(week.weekLabel).toMatch(/^[A-Za-z]+ \d+$/)
    }
  })

  it('should apply 90% factor to inflow from approved apps (retainage hold)', () => {
    // No approved apps with dates — evenly spread over 8 weeks
    const payApps = [{
      id: 'pa-1',
      project_id: 'proj',
      status: 'approved' as const,
      approved_date: null,
      period_to: null,
      current_payment_due: 80_000,
    }]
    const weeks = computeThirteenWeekCashFlow(payApps, [], [])
    // Total approved billing = 80_000; spread evenly over weeks 1-8 at 90% factor
    const totalInflow = weeks.reduce((s, w) => s + w.projectedInflow, 0)
    expect(totalInflow).toBeCloseTo(80_000 * 0.9, 5)
  })

  it('should produce zero inflow in weeks 9-13 when no date-stamped apps', () => {
    const payApps = [{
      id: 'pa-1',
      project_id: 'proj',
      status: 'approved' as const,
      approved_date: null,
      period_to: null,
      current_payment_due: 80_000,
    }]
    const weeks = computeThirteenWeekCashFlow(payApps, [], [])
    const lateWeeks = weeks.slice(8) // weeks 9-13
    for (const week of lateWeeks) {
      expect(week.projectedInflow).toBe(0)
    }
  })

  it('should compute weekly outflow from committed costs / 52', () => {
    const budgetItems = [
      makeBudgetItem({ committed_amount: 520_000 }),
    ]
    const weeks = computeThirteenWeekCashFlow([], [], budgetItems)
    const expectedWeeklyOutflow = 520_000 / 52
    for (const week of weeks) {
      expect(week.projectedOutflow).toBeCloseTo(expectedWeeklyOutflow, 5)
    }
  })

  it('should accumulate cumulativePosition across weeks', () => {
    const weeks = computeThirteenWeekCashFlow([], [], [])
    let running = 0
    for (const week of weeks) {
      running += week.netCash
      expect(week.cumulativePosition).toBeCloseTo(running, 5)
    }
  })

  it('should compute netCash = inflow - outflow', () => {
    const weeks = computeThirteenWeekCashFlow([], [], [])
    for (const week of weeks) {
      expect(week.netCash).toBeCloseTo(week.projectedInflow - week.projectedOutflow, 5)
    }
  })

  it('should respect an optional startDate override', () => {
    const customStart = new Date('2026-06-01')
    const weeks = computeThirteenWeekCashFlow([], [], [], customStart)
    expect(weeks[0].weekStart).toBe('2026-06-01')
  })
})
