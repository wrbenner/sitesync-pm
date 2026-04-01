export interface ProjectFinancials {
  isEmpty: boolean
  originalContractValue: number
  approvedChangeOrders: number
  approvedCOValue: number
  revisedContractValue: number
  pendingChangeOrders: number
  pendingCOValue: number
  pendingExposure: number
  totalPotentialContract: number
  committedCost: number
  invoicedToDate: number
  costToComplete: number
  projectedFinalCost: number
  variance: number // positive = under budget
  variancePercent: number
  percentComplete: number
  retainageHeld: number // from subs
  retainageReceivable: number // from owner
  overUnder: number
}

export interface DivisionFinancials {
  divisionCode: string
  divisionName: string
  originalBudget: number
  approvedChanges: number
  revisedBudget: number
  committedCost: number
  invoicedToDate: number
  costToComplete: number
  projectedFinalCost: number
  variance: number
  variancePercent: number
  percentComplete: number
}

export interface EarnedValueMetrics {
  bcws: number              // Planned Value
  bcwp: number              // Earned Value
  acwp: number              // Actual Cost
  spi: number               // Schedule Performance Index
  cpi: number               // Cost Performance Index
  eac: number               // Estimate at Completion
  etc: number               // Estimate to Complete
  vac: number               // Variance at Completion
  scheduleVarianceDays: number // Estimated days ahead (positive) or behind (negative) schedule
  costVariance: number      // BCWP - ACWP (positive = under budget)
}

export interface CashFlowWeek {
  weekLabel: string
  weekStart: string
  projectedInflow: number
  projectedOutflow: number
  netCash: number
  cumulativePosition: number
}

export interface CashFlowForecast {
  weeks: CashFlowWeek[]
  currentCashPosition: number
  lowestProjectedPosition: number
  lowestPositionWeek: number
}

// 13-week cash flow types
export interface WeeklyCashFlowRow {
  weekStart: string
  weekEnd: string
  inflow: number
  outflow: number
  net: number
  cumulativeBalance: number
}

export interface PayAppRow {
  id: string
  project_id: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  approved_date: string | null
  period_to: string | null
  current_payment_due: number | null
}

export interface PayApplicationRow {
  id: string
  project_id: string
  amount: number
  status: 'draft' | 'submitted' | 'approved' | 'paid'
  submitted_date: string | null
  approved_date: string | null
  period_end: string | null
}

export interface SubInvoiceRow {
  id: string
  project_id: string
  amount: number
  submitted_date: string | null
  due_date: string | null
}

export interface InvoiceRow {
  id: string
  total: number
  status: string // 'approved' | 'paid' | 'pending' | 'draft'
}
