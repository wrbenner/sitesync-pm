export interface ProjectFinancials {
  originalContractValue: number
  approvedChangeOrders: number
  revisedContractValue: number
  pendingChangeOrders: number
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
  bcws: number // Planned Value
  bcwp: number // Earned Value
  acwp: number // Actual Cost
  spi: number  // Schedule Performance Index
  cpi: number  // Cost Performance Index
  eac: number  // Estimate at Completion
  etc: number  // Estimate to Complete
  vac: number  // Variance at Completion
}

export interface CashFlowWeek {
  weekNumber: number
  weekStartDate: string
  projectedInflows: number
  projectedOutflows: number
  netCashFlow: number
  cumulativePosition: number
}

export interface CashFlowForecast {
  weeks: CashFlowWeek[]
  currentCashPosition: number
  lowestProjectedPosition: number
  lowestPositionWeek: number
}
