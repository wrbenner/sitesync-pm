import type {
  ProjectFinancials,
  DivisionFinancials,
  EarnedValueMetrics,
  CashFlowForecast,
  CashFlowWeek,
} from '../types/financial'
import type { MappedDivision, MappedChangeOrder } from '../api/endpoints/budget'

export function computeProjectFinancials(
  divisions: MappedDivision[],
  changeOrders: MappedChangeOrder[],
  contractValue: number
): ProjectFinancials {
  const originalContractValue = contractValue

  const approvedChangeOrders = changeOrders
    .filter(co => co.status === 'approved')
    .reduce((sum, co) => sum + (co.approved_cost || co.amount), 0)

  const revisedContractValue = originalContractValue + approvedChangeOrders

  const pendingChangeOrders = changeOrders
    .filter(co => ['submitted', 'under_review', 'pending'].includes(co.status))
    .reduce((sum, co) => sum + (co.submitted_cost || co.estimated_cost || co.amount), 0)

  const totalPotentialContract = revisedContractValue + pendingChangeOrders

  const committedCost = divisions.reduce((s, d) => s + d.committed, 0)
  const invoicedToDate = divisions.reduce((s, d) => s + d.spent, 0)
  const costToComplete = Math.max(0, committedCost - invoicedToDate)
  const projectedFinalCost = invoicedToDate + costToComplete

  const variance = revisedContractValue - projectedFinalCost
  const variancePercent = revisedContractValue > 0 ? (variance / revisedContractValue) * 100 : 0
  const percentComplete = committedCost > 0 ? (invoicedToDate / committedCost) * 100 : 0

  return {
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
  return divisions.map(d => {
    const divisionCOs = changeOrders.filter(co =>
      co.status === 'approved' && co.cost_code === d.cost_code
    )
    const approvedChanges = divisionCOs.reduce((s, co) => s + (co.approved_cost || co.amount), 0)
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
  budgetTotal: number,
  plannedPercentComplete: number,
  actualPercentComplete: number,
  actualCost: number
): EarnedValueMetrics {
  const bcws = budgetTotal * (plannedPercentComplete / 100)
  const bcwp = budgetTotal * (actualPercentComplete / 100)
  const acwp = actualCost
  const spi = bcws > 0 ? bcwp / bcws : 1
  const cpi = acwp > 0 ? bcwp / acwp : 1
  const eac = cpi > 0 ? budgetTotal / cpi : budgetTotal
  const etc = eac - acwp
  const vac = budgetTotal - eac

  return { bcws, bcwp, acwp, spi, cpi, eac, etc, vac }
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
