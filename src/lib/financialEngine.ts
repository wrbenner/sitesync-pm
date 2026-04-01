import type {
  ProjectFinancials,
  DivisionFinancials,
  EarnedValueMetrics,
  CashFlowForecast,
  CashFlowWeek,
  WeeklyCashFlowRow,
  PayApplicationRow,
  SubInvoiceRow,
} from '../types/financial'
import type { MappedDivision, MappedChangeOrder } from '../api/endpoints/budget'

function assertFinancialInputs(divisions: MappedDivision[], changeOrders: MappedChangeOrder[]): void {
  if (!Array.isArray(divisions) || !Array.isArray(changeOrders)) throw new Error('Invalid financial inputs')
}

export function computeProjectFinancials(
  divisions: MappedDivision[],
  changeOrders: MappedChangeOrder[],
  contractValue: number
): ProjectFinancials {
  assertFinancialInputs(divisions, changeOrders)
  const originalContractValue = contractValue

  const approvedChangeOrders = changeOrders
    .filter(co => co.status === 'approved')
    .reduce((sum, co) => sum + co.approved_cost, 0)

  const revisedContractValue = originalContractValue + approvedChangeOrders

  const pendingChangeOrders = changeOrders
    .filter(co => co.status === 'pending_review')
    .reduce((sum, co) => sum + co.amount, 0)

  const totalPotentialContract = revisedContractValue + pendingChangeOrders

  const committedCost = divisions.reduce((s, d) => s + d.committed, 0)
  const invoicedToDate = divisions.reduce((s, d) => s + d.spent, 0)
  const costToComplete = Math.max(0, committedCost - invoicedToDate)
  const projectedFinalCost = invoicedToDate + costToComplete

  const variance = revisedContractValue - projectedFinalCost
  const variancePercent = revisedContractValue > 0 ? (variance / revisedContractValue) * 100 : 0
  const percentComplete = committedCost > 0 ? (invoicedToDate / committedCost) * 100 : 0

  return {
    isEmpty: divisions.length === 0,
    originalContractValue,
    approvedChangeOrders,
    revisedContractValue,
    pendingChangeOrders,
    totalPotentialContract,
    committedCost,
    invoicedToDate,
    costToComplete,
    projectedFinalCost,
    variance,
    variancePercent,
    percentComplete,
    retainageHeld: invoicedToDate * 0.10,
    retainageReceivable: invoicedToDate * 0.10,
    overUnder: variance,
  }
}

export function computeDivisionFinancials(
  divisions: MappedDivision[],
  changeOrders: MappedChangeOrder[]
): DivisionFinancials[] {
  assertFinancialInputs(divisions, changeOrders)
  return divisions.map(d => {
    const divisionCOs = changeOrders.filter(co =>
      co.status === 'approved' && co.cost_code === d.cost_code
    )
    const approvedChanges = divisionCOs.reduce((s, co) => s + co.approved_cost, 0)
    const revisedBudget = d.budget + approvedChanges
    const costToComplete = Math.max(0, d.committed - d.spent)
    const projectedFinalCost = d.spent + costToComplete
    const variance = revisedBudget - projectedFinalCost

    return {
      divisionCode: d.cost_code || '',
      divisionName: d.name,
      originalBudget: d.budget,
      approvedChanges,
      revisedBudget,
      committedCost: d.committed,
      invoicedToDate: d.spent,
      costToComplete,
      projectedFinalCost,
      variance,
      variancePercent: revisedBudget > 0 ? (variance / revisedBudget) * 100 : 0,
      percentComplete: d.progress,
    }
  })
}

export function computeEarnedValue(
  divisions: MappedDivision[],
  contractValue: number,
  elapsedFraction: number // 0-1, derived from schedule progress
): EarnedValueMetrics {
  const bcws = contractValue * elapsedFraction
  const bcwp = divisions.reduce((s, d) => s + d.budget * (d.progress / 100), 0)
  const acwp = divisions.reduce((s, d) => s + d.spent, 0)
  const spi = bcws > 0 ? bcwp / bcws : 1
  const cpi = acwp > 0 ? bcwp / acwp : 1
  const eac = cpi > 0 ? contractValue / cpi : contractValue
  const etc = eac - acwp
  const vac = contractValue - eac
  const costVariance = bcwp - acwp
  // Estimated days: schedule variance as a fraction of a 365-day reference duration
  const scheduleVarianceDays = Math.round(((bcwp - bcws) / contractValue) * 365)

  return { bcws, bcwp, acwp, spi, cpi, eac, etc, vac, scheduleVarianceDays, costVariance }
}

export function compute13WeekCashFlow(
  payApps: PayApplicationRow[],
  subInvoices: SubInvoiceRow[],
  committedCosts: MappedDivision[],
  retainageRate: number,
  collectionLagDays: number,
  paymentLagDays: number
): WeeklyCashFlowRow[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const totalUncommitted = committedCosts.reduce(
    (s, d) => s + Math.max(0, d.budget - d.committed),
    0
  )
  const weeklyBurn = totalUncommitted / 13

  let cumulative = 0
  const rows: WeeklyCashFlowRow[] = []

  for (let i = 0; i < 13; i++) {
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() + i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const grossInflow = payApps
      .filter(pa => {
        if (pa.status !== 'approved' || !pa.approved_date) return false
        const clearDate = new Date(pa.approved_date)
        clearDate.setDate(clearDate.getDate() + collectionLagDays)
        return clearDate >= weekStart && clearDate <= weekEnd
      })
      .reduce((s, pa) => s + pa.amount, 0)

    const inflow = grossInflow * (1 - retainageRate)

    const subOutflow = subInvoices
      .filter(inv => {
        let payDate: Date | null = null
        if (inv.due_date) {
          payDate = new Date(inv.due_date)
        } else if (inv.submitted_date) {
          payDate = new Date(inv.submitted_date)
          payDate.setDate(payDate.getDate() + paymentLagDays)
        }
        if (!payDate) return false
        return payDate >= weekStart && payDate <= weekEnd
      })
      .reduce((s, inv) => s + inv.amount, 0)

    const outflow = subOutflow + weeklyBurn
    const net = inflow - outflow
    cumulative += net

    rows.push({
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      inflow,
      outflow,
      net,
      cumulativeBalance: cumulative,
    })
  }

  return rows
}

export interface BudgetAnomaly {
  divisionName: string
  severity: 'warning' | 'critical'
  message: string
  variancePct: number
}

export function detectBudgetAnomalies(
  financials: ProjectFinancials,
  byDivision: DivisionFinancials[]
): BudgetAnomaly[] {
  if (financials.isEmpty) return []

  const anomalies: BudgetAnomaly[] = []

  for (const div of byDivision) {
    const overBudget = div.projectedFinalCost > div.revisedBudget
    const spentRatio = div.revisedBudget > 0 ? div.invoicedToDate / div.revisedBudget : 0

    if (overBudget) {
      const variancePct =
        div.revisedBudget > 0
          ? ((div.projectedFinalCost - div.revisedBudget) / div.revisedBudget) * 100
          : 0
      anomalies.push({
        divisionName: div.divisionName,
        severity: 'critical',
        message: `${div.divisionName} is projected to exceed budget by ${variancePct.toFixed(1)}%.`,
        variancePct,
      })
    } else if (spentRatio > 0.85) {
      anomalies.push({
        divisionName: div.divisionName,
        severity: 'warning',
        message: `${div.divisionName} has consumed ${(spentRatio * 100).toFixed(1)}% of budget.`,
        variancePct: spentRatio * 100,
      })
    }
  }

  return anomalies
}

export function computeCashFlowForecast(
  weeklyInflows: number[],
  weeklyOutflows: number[],
  startingCash: number,
  startDate: Date
): CashFlowForecast {
  let cumulative = startingCash
  let lowest = startingCash
  let lowestWeek = 0
  const weeks: CashFlowWeek[] = []

  for (let i = 0; i < 13; i++) {
    const inflow = weeklyInflows[i] || 0
    const outflow = weeklyOutflows[i] || 0
    const net = inflow - outflow
    cumulative += net

    if (cumulative < lowest) {
      lowest = cumulative
      lowestWeek = i + 1
    }

    const weekStart = new Date(startDate)
    weekStart.setDate(weekStart.getDate() + i * 7)

    weeks.push({
      weekNumber: i + 1,
      weekStartDate: weekStart.toISOString().slice(0, 10),
      projectedInflows: inflow,
      projectedOutflows: outflow,
      netCashFlow: net,
      cumulativePosition: cumulative,
    })
  }

  return {
    weeks,
    currentCashPosition: startingCash,
    lowestProjectedPosition: lowest,
    lowestPositionWeek: lowestWeek,
  }
}
