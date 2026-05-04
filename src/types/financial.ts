import type { Cents } from './money'

export interface ProjectFinancials {
  isEmpty: boolean
  originalContractValue: Cents
  approvedChangeOrders: Cents
  approvedCOValue: Cents
  revisedContractValue: Cents
  pendingChangeOrders: Cents
  pendingCOValue: Cents
  pendingExposure: Cents
  totalPotentialContract: Cents
  committedCost: Cents
  invoicedToDate: Cents
  costToComplete: Cents
  projectedFinalCost: Cents
  variance: Cents // positive = under budget
  variancePercent: number
  percentComplete: number
  retainageHeld: Cents // from subs
  retainageReceivable: Cents // from owner
  overUnder: Cents
}

export interface DivisionFinancials {
  divisionCode: string
  divisionName: string
  originalBudget: Cents
  approvedChanges: Cents
  revisedBudget: Cents
  committedCost: Cents
  invoicedToDate: Cents
  costToComplete: Cents
  projectedFinalCost: Cents
  variance: Cents
  variancePercent: number
  percentComplete: number
}

export interface EarnedValueMetrics {
  bcws: Cents              // Planned Value
  bcwp: Cents              // Earned Value
  acwp: Cents              // Actual Cost
  spi: number              // Schedule Performance Index
  cpi: number              // Cost Performance Index
  eac: Cents               // Estimate at Completion
  etc: Cents               // Estimate to Complete
  vac: Cents               // Variance at Completion
  scheduleVarianceDays: number // Estimated days ahead (positive) or behind (negative) schedule
  costVariance: Cents      // BCWP - ACWP (positive = under budget)
}

export interface CashFlowWeek {
  weekLabel: string
  weekStart: string
  projectedInflow: Cents
  projectedOutflow: Cents
  netCash: Cents
  cumulativePosition: Cents
}

export interface CashFlowForecast {
  weeks: CashFlowWeek[]
  currentCashPosition: Cents
  lowestProjectedPosition: Cents
  lowestPositionWeek: number
}

// 13-week cash flow types
export interface WeeklyCashFlowRow {
  weekStart: string
  weekEnd: string
  inflow: Cents
  outflow: Cents
  net: Cents
  cumulativeBalance: Cents
}

export interface PayAppRow {
  id: string
  project_id: string
  status: string
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
