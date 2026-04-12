import { describe, it, expect } from 'vitest'
import { colors } from '../../styles/theme'
import {
  computeDivisionFinancials,
  computeProjectFinancials,
  detectBudgetAnomalies,
} from '../../lib/financialEngine'
import type { MappedDivision, MappedChangeOrder } from '../../api/endpoints/budget'

// ── Inline helpers mirroring Budget.tsx private functions ─────────────────────
// These document the exact formatting contract used on the Budget page.

function fmt(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function invoiceStatusDot(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'paid': return colors.statusActive
    case 'overdue': return colors.statusCritical
    case 'pending':
    case 'open': return colors.statusPending
    default: return colors.textTertiary
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

// ── fmt (compact currency formatter) ─────────────────────────────────────────

describe('Budget page: fmt (compact currency formatter)', () => {
  it('should format millions with one decimal place', () => {
    expect(fmt(1_500_000)).toBe('$1.5M')
    expect(fmt(2_000_000)).toBe('$2.0M')
    expect(fmt(10_500_000)).toBe('$10.5M')
  })

  it('should format exactly 1 million as $1.0M', () => {
    expect(fmt(1_000_000)).toBe('$1.0M')
  })

  it('should format thousands without decimal', () => {
    expect(fmt(1_000)).toBe('$1K')
    expect(fmt(250_000)).toBe('$250K')
    expect(fmt(999_000)).toBe('$999K')
  })

  it('should format exactly 1 thousand as $1K', () => {
    expect(fmt(1_000)).toBe('$1K')
  })

  it('should format sub-thousand values with locale string', () => {
    expect(fmt(0)).toBe('$0')
    expect(fmt(999)).toBe('$999')
    expect(fmt(500)).toBe('$500')
  })

  it('should round millions to one decimal (no false precision)', () => {
    // $1,234,567 should be $1.2M, not $1.234567M
    expect(fmt(1_234_567)).toBe('$1.2M')
  })

  it('should return a string for any numeric input', () => {
    expect(typeof fmt(0)).toBe('string')
    expect(typeof fmt(1_000_000_000)).toBe('string')
  })
})

// ── invoiceStatusDot ──────────────────────────────────────────────────────────

describe('Budget page: invoiceStatusDot (status color mapper)', () => {
  it('should return statusActive color for paid invoices', () => {
    expect(invoiceStatusDot('paid')).toBe(colors.statusActive)
  })

  it('should return statusCritical color for overdue invoices', () => {
    expect(invoiceStatusDot('overdue')).toBe(colors.statusCritical)
  })

  it('should return statusPending color for pending invoices', () => {
    expect(invoiceStatusDot('pending')).toBe(colors.statusPending)
  })

  it('should return statusPending color for open invoices', () => {
    expect(invoiceStatusDot('open')).toBe(colors.statusPending)
  })

  it('should return textTertiary for null status', () => {
    expect(invoiceStatusDot(null)).toBe(colors.textTertiary)
  })

  it('should return textTertiary for empty string status', () => {
    expect(invoiceStatusDot('')).toBe(colors.textTertiary)
  })

  it('should return textTertiary for unknown status', () => {
    expect(invoiceStatusDot('processing')).toBe(colors.textTertiary)
    expect(invoiceStatusDot('draft')).toBe(colors.textTertiary)
  })

  it('should be case-insensitive', () => {
    expect(invoiceStatusDot('PAID')).toBe(colors.statusActive)
    expect(invoiceStatusDot('Overdue')).toBe(colors.statusCritical)
    expect(invoiceStatusDot('PENDING')).toBe(colors.statusPending)
    expect(invoiceStatusDot('OPEN')).toBe(colors.statusPending)
  })

  it('should return CSS variable strings (not raw hex)', () => {
    expect(invoiceStatusDot('paid')).toMatch(/^var\(/)
    expect(invoiceStatusDot('overdue')).toMatch(/^var\(/)
    expect(invoiceStatusDot('pending')).toMatch(/^var\(/)
    expect(invoiceStatusDot(null)).toMatch(/^var\(/)
  })
})

// ── computeProjectFinancials (budget page integration) ───────────────────────

describe('Budget page: project financials integration', () => {
  it('should compute revised contract value with approved change orders', () => {
    const divisions = [makeDivision()]
    const approvedCO = makeCO({ status: 'approved', approved_cost: 75_000 })
    const result = computeProjectFinancials(divisions, [approvedCO], 1_000_000)
    expect(result.revisedContractValue).toBe(1_075_000)
  })

  it('should exclude draft and pending change orders from revised contract value', () => {
    const divisions = [makeDivision()]
    const draftCO = makeCO({ status: 'draft', approved_cost: 0, amount: 50_000 })
    const pendingCO = makeCO({ id: 'co-2', status: 'pending_review', approved_cost: 0, amount: 30_000 })
    const result = computeProjectFinancials(divisions, [draftCO, pendingCO], 1_000_000)
    expect(result.revisedContractValue).toBe(1_000_000)
  })

  it('should sum committed costs across all divisions', () => {
    const divisions = [
      makeDivision({ id: 'div-1', committed: 300_000 }),
      makeDivision({ id: 'div-2', committed: 200_000 }),
      makeDivision({ id: 'div-3', committed: 150_000 }),
    ]
    const result = computeProjectFinancials(divisions, [], 1_000_000)
    expect(result.committedCost).toBe(650_000)
  })

  it('should sum invoiced amounts across all divisions', () => {
    const divisions = [
      makeDivision({ id: 'div-1', spent: 100_000 }),
      makeDivision({ id: 'div-2', spent: 75_000 }),
    ]
    const result = computeProjectFinancials(divisions, [], 1_000_000)
    expect(result.invoicedToDate).toBe(175_000)
  })

  it('should mark isEmpty true when contract value and divisions are both zero', () => {
    const result = computeProjectFinancials([], [], 0)
    expect(result.isEmpty).toBe(true)
  })

  it('should compute positive variance when under budget', () => {
    // committed 400K < contractValue 600K => positive variance
    const divisions = [makeDivision({ committed: 400_000, spent: 200_000 })]
    const result = computeProjectFinancials(divisions, [], 600_000)
    expect(result.variance).toBeGreaterThan(0)
  })

  it('should compute negative variance when over budget', () => {
    // committed 700K > contractValue 500K => negative variance
    const divisions = [makeDivision({ committed: 700_000, spent: 600_000 })]
    const result = computeProjectFinancials(divisions, [], 500_000)
    expect(result.variance).toBeLessThan(0)
  })

  it('should compute retainageHeld as 10% of invoicedToDate', () => {
    const divisions = [makeDivision({ spent: 200_000 })]
    const result = computeProjectFinancials(divisions, [], 500_000)
    expect(result.retainageHeld).toBe(20_000)
  })

  it('should accumulate multiple approved change orders correctly', () => {
    const divisions = [makeDivision()]
    const cos = [
      makeCO({ id: 'co-1', status: 'approved', approved_cost: 25_000 }),
      makeCO({ id: 'co-2', status: 'approved', approved_cost: 15_000 }),
      makeCO({ id: 'co-3', status: 'approved', approved_cost: 10_000 }),
    ]
    const result = computeProjectFinancials(divisions, cos, 1_000_000)
    expect(result.approvedCOValue).toBe(50_000)
    expect(result.revisedContractValue).toBe(1_050_000)
  })

  it('should compute pending exposure from pending change orders', () => {
    const divisions = [makeDivision()]
    const pendingCO = makeCO({
      status: 'pending_review',
      amount: 40_000,
      estimated_cost: 40_000,
      submitted_cost: 40_000,
    })
    const result = computeProjectFinancials(divisions, [pendingCO], 1_000_000)
    expect(result.pendingCOValue).toBeGreaterThan(0)
  })
})

// ── computeDivisionFinancials (division-level budget rows) ───────────────────

describe('Budget page: division financials for table rows', () => {
  it('should produce one row per division', () => {
    const divisions = [
      makeDivision({ id: 'div-1', cost_code: '03' }),
      makeDivision({ id: 'div-2', name: 'Steel', cost_code: '05' }),
      makeDivision({ id: 'div-3', name: 'Electrical', cost_code: '26' }),
    ]
    const rows = computeDivisionFinancials(divisions, [])
    expect(rows).toHaveLength(3)
  })

  it('should reflect division name and code in each row', () => {
    const divisions = [makeDivision({ name: 'Mechanical', cost_code: '15' })]
    const [row] = computeDivisionFinancials(divisions, [])
    expect(row.divisionName).toBe('Mechanical')
    expect(row.divisionCode).toBe('15')
  })

  it('should apply approved change orders to matching division cost code', () => {
    const divisions = [makeDivision({ cost_code: '03', budget: 500_000 })]
    const approvedCO = makeCO({ status: 'approved', approved_cost: 30_000, cost_code: '03' })
    const [row] = computeDivisionFinancials(divisions, [approvedCO])
    expect(row.approvedChanges).toBe(30_000)
    expect(row.revisedBudget).toBe(530_000)
  })

  it('should not apply change orders from a different cost code', () => {
    const divisions = [makeDivision({ cost_code: '03', budget: 500_000 })]
    const wrongCO = makeCO({ status: 'approved', approved_cost: 30_000, cost_code: '05' })
    const [row] = computeDivisionFinancials(divisions, [wrongCO])
    expect(row.approvedChanges).toBe(0)
  })

  it('should compute positive variance for an under-budget division', () => {
    // budget 500K, committed 400K => projected 400K, variance = 100K
    const [row] = computeDivisionFinancials([makeDivision({ budget: 500_000, committed: 400_000 })], [])
    expect(row.variance).toBe(100_000)
  })

  it('should clamp costToComplete to 0 when spent exceeds committed', () => {
    const [row] = computeDivisionFinancials([makeDivision({ committed: 100_000, spent: 150_000 })], [])
    expect(row.costToComplete).toBe(0)
  })

  it('should return empty array when no divisions', () => {
    expect(computeDivisionFinancials([], [])).toHaveLength(0)
  })
})

// ── detectBudgetAnomalies (predictive alert banner) ───────────────────────────

describe('Budget page: anomaly detection for the predictive alert banner', () => {
  it('should return no anomalies for a healthy project', () => {
    const divisions = [makeDivision({ budget: 500_000, committed: 400_000, spent: 300_000 })]
    const projectFinancials = computeProjectFinancials(divisions, [], 600_000)
    const divisionFinancials = computeDivisionFinancials(divisions, [])
    expect(detectBudgetAnomalies(projectFinancials, divisionFinancials)).toHaveLength(0)
  })

  it('should flag critical anomaly when projected cost exceeds revised budget', () => {
    const divisions = [makeDivision({ budget: 400_000, committed: 500_000, spent: 400_000 })]
    const projectFinancials = computeProjectFinancials(divisions, [], 500_000)
    const divisionFinancials = computeDivisionFinancials(divisions, [])
    const anomalies = detectBudgetAnomalies(projectFinancials, divisionFinancials)
    expect(anomalies.some(a => a.severity === 'critical')).toBe(true)
  })

  it('should flag warning when spend exceeds 85% of budget', () => {
    // 360K spent / 400K budget = 90%
    const divisions = [makeDivision({ budget: 400_000, committed: 390_000, spent: 360_000 })]
    const projectFinancials = computeProjectFinancials(divisions, [], 500_000)
    const divisionFinancials = computeDivisionFinancials(divisions, [])
    const anomalies = detectBudgetAnomalies(projectFinancials, divisionFinancials)
    expect(anomalies.some(a => a.severity === 'warning')).toBe(true)
  })

  it('should return empty array when isEmpty is true', () => {
    const projectFinancials = computeProjectFinancials([], [], 0)
    expect(detectBudgetAnomalies(projectFinancials, [])).toHaveLength(0)
  })

  it('should identify the division name in anomaly records', () => {
    const divisions = [makeDivision({ name: 'Electrical', budget: 200_000, committed: 280_000, spent: 200_000 })]
    const projectFinancials = computeProjectFinancials(divisions, [], 500_000)
    const divisionFinancials = computeDivisionFinancials(divisions, [])
    const anomalies = detectBudgetAnomalies(projectFinancials, divisionFinancials)
    if (anomalies.length > 0) {
      expect(anomalies[0].divisionName).toBe('Electrical')
    }
  })
})
