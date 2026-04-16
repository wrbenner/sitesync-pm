import type {
  ProjectFinancials,
  DivisionFinancials,
  EarnedValueMetrics,
  CashFlowForecast,
  CashFlowWeek,
  WeeklyCashFlowRow,
  PayApplicationRow,
  SubInvoiceRow,
  PayAppRow,
  InvoiceRow,
} from '../types/financial'
import type { Cents } from '../types/money'
import { toCents, addCents, subtractCents, applyRateCents } from '../types/money'
import type { MappedDivision, MappedChangeOrder } from '../api/endpoints/budget'
import type { BudgetItemRow, ScheduleActivity } from '../types/api'

/** Default retainage rate (10%) — construction industry standard. Override per-project as needed. */
export const DEFAULT_RETAINAGE_RATE = 0.10

const ZERO_CENTS = 0 as Cents

function assertFinancialInputs(divisions: MappedDivision[], changeOrders: MappedChangeOrder[]): void {
  if (!Array.isArray(divisions) || !Array.isArray(changeOrders)) throw new Error('Invalid financial inputs')
}

export function computeProjectFinancials(
  divisions: MappedDivision[],
  changeOrders: MappedChangeOrder[],
  contractValue: number,
  retainageRate: number = DEFAULT_RETAINAGE_RATE,
): ProjectFinancials {
  assertFinancialInputs(divisions, changeOrders)
  const originalContractValue = toCents(contractValue)

  const approvedChangeOrders = changeOrders
    .filter(co => co.status === 'approved')
    .reduce<Cents>((sum, co) => addCents(sum, toCents(co.approved_cost)), ZERO_CENTS)

  const revisedContractValue = addCents(originalContractValue, approvedChangeOrders)

  const pendingChangeOrders = changeOrders
    .filter(co => co.status === 'pending_review')
    .reduce<Cents>((sum, co) => addCents(sum, toCents(co.amount)), ZERO_CENTS)

  const pendingCOValue = changeOrders
    .filter(co => co.status === 'pending_review')
    .reduce<Cents>((sum, co) => addCents(sum, toCents(co.submitted_cost)), ZERO_CENTS)

  const pendingExposure = changeOrders
    .filter(co => co.status === 'pending_review')
    .reduce<Cents>((sum, co) => addCents(sum, toCents(co.estimated_cost)), ZERO_CENTS)

  const totalPotentialContract = addCents(revisedContractValue, pendingChangeOrders)

  const committedCost = divisions.reduce<Cents>((s, d) => addCents(s, toCents(d.committed)), ZERO_CENTS)
  const invoicedToDate = divisions.reduce<Cents>((s, d) => addCents(s, toCents(d.spent)), ZERO_CENTS)
  const costToComplete = (Math.max(0, committedCost - invoicedToDate)) as Cents
  const projectedFinalCost = addCents(invoicedToDate, costToComplete)

  const variance = subtractCents(revisedContractValue, projectedFinalCost)
  const variancePercent = revisedContractValue > 0 ? (variance / revisedContractValue) * 100 : 0
  const percentComplete = committedCost > 0 ? (invoicedToDate / committedCost) * 100 : 0

  const retainage = applyRateCents(invoicedToDate, retainageRate)

  return {
    isEmpty: divisions.length === 0,
    originalContractValue,
    approvedChangeOrders,
    approvedCOValue: approvedChangeOrders,
    revisedContractValue,
    pendingChangeOrders,
    pendingCOValue,
    pendingExposure,
    totalPotentialContract,
    committedCost,
    invoicedToDate,
    costToComplete,
    projectedFinalCost,
    variance,
    variancePercent,
    percentComplete,
    retainageHeld: retainage,
    retainageReceivable: retainage,
    overUnder: variance,
  }
}

export function getApprovedCOTotal(changeOrders: MappedChangeOrder[]): Cents {
  return changeOrders
    .filter(co => co.status === 'approved')
    .reduce<Cents>((sum, co) => addCents(sum, toCents(co.approved_cost)), ZERO_CENTS)
}

export function computeDivisionFinancials(
  divisions: MappedDivision[],
  changeOrders: MappedChangeOrder[]
): DivisionFinancials[] {
  assertFinancialInputs(divisions, changeOrders)
  return divisions.map(d => {
    const originalBudget = toCents(d.budget)
    const committedCost = toCents(d.committed)
    const invoicedToDate = toCents(d.spent)

    const divisionCOs = changeOrders.filter(co =>
      co.status === 'approved' && co.cost_code === d.cost_code
    )
    const approvedChanges = divisionCOs.reduce<Cents>(
      (s, co) => addCents(s, toCents(co.approved_cost)),
      ZERO_CENTS,
    )
    const revisedBudget = addCents(originalBudget, approvedChanges)
    const costToComplete = Math.max(0, committedCost - invoicedToDate) as Cents
    const projectedFinalCost = addCents(invoicedToDate, costToComplete)
    const variance = subtractCents(revisedBudget, projectedFinalCost)

    return {
      divisionCode: d.cost_code || '',
      divisionName: d.name,
      originalBudget,
      approvedChanges,
      revisedBudget,
      committedCost,
      invoicedToDate,
      costToComplete,
      projectedFinalCost,
      variance,
      variancePercent: revisedBudget > 0 ? (variance / revisedBudget) * 100 : 0,
      percentComplete: d.progress,
    }
  })
}

/**
 * Computes earned value metrics from live project data.
 *
 * BCWS (Planned Value)  = BAC * time-elapsed fraction derived from schedule activity dates
 * BCWP (Earned Value)   = sum(budgetItem.originalBudget * actualPercentComplete)
 * ACWP (Actual Cost)    = sum(approved or paid invoice totals)
 * CPI                   = BCWP / ACWP  (defaults to 1.0 when ACWP = 0)
 * SPI                   = BCWP / BCWS  (defaults to 1.0 when BCWS = 0)
 * EAC                   = BAC / CPI
 * VAC                   = BAC - EAC
 */
export function computeEarnedValue(
  budgetItems: BudgetItemRow[],
  changeOrders: MappedChangeOrder[],
  invoices: InvoiceRow[],
  scheduleActivities: ScheduleActivity[],
): EarnedValueMetrics {
  const totalBudget = budgetItems.reduce<Cents>(
    (s, b) => addCents(s, toCents(b.original_amount ?? 0)),
    ZERO_CENTS,
  )
  const approvedCO = changeOrders
    .filter(co => co.status === 'approved')
    .reduce<Cents>((s, co) => addCents(s, toCents(co.approved_cost)), ZERO_CENTS)
  const bac = addCents(totalBudget, approvedCO)

  // BCWP: budgeted cost of work performed = physical % complete applied to each budget line
  const bcwp = budgetItems.reduce<Cents>(
    (s, b) => addCents(
      s,
      applyRateCents(toCents(b.original_amount ?? 0), (b.percent_complete ?? 0) / 100),
    ),
    ZERO_CENTS,
  )

  // BCWS: budgeted cost of work scheduled = BAC * time-elapsed fraction from schedule dates
  let bcws: Cents = ZERO_CENTS
  if (scheduleActivities.length > 0) {
    const starts = scheduleActivities
      .map(a => new Date(a.start_date).getTime())
      .filter(t => !isNaN(t))
    const ends = scheduleActivities
      .map(a => new Date(a.finish_date).getTime())
      .filter(t => !isNaN(t))
    if (starts.length > 0 && ends.length > 0) {
      const projectStart = Math.min(...starts)
      const projectEnd = Math.max(...ends)
      const elapsed =
        projectEnd > projectStart
          ? Math.max(0, Math.min(1, (Date.now() - projectStart) / (projectEnd - projectStart)))
          : 0
      bcws = applyRateCents(bac, elapsed)
    }
  }

  // ACWP: actual cost of work performed = sum of approved/paid invoice totals
  const acwp = invoices
    .filter(inv => inv.status === 'approved' || inv.status === 'paid')
    .reduce<Cents>((s, inv) => addCents(s, toCents(inv.total)), ZERO_CENTS)

  const cpi = acwp > 0 ? bcwp / acwp : 1.0
  const spi = bcws > 0 ? bcwp / bcws : 1.0
  const eac = (cpi > 0 ? Math.round(bac / cpi) : bac) as Cents
  const etc = subtractCents(eac, acwp)
  const vac = subtractCents(bac, eac)
  const costVariance = subtractCents(bcwp, acwp)

  const scheduleVarianceDays =
    scheduleActivities.length > 0
      ? Math.round(
          scheduleActivities.reduce((s, a) => s + a.scheduleVarianceDays, 0) /
            scheduleActivities.length,
        )
      : 0

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

  const totalUncommitted = committedCosts.reduce<Cents>(
    (s, d) => addCents(s, toCents(Math.max(0, d.budget - d.committed))),
    ZERO_CENTS,
  )
  const weeklyBurn = Math.round(totalUncommitted / 13) as Cents

  let cumulative: Cents = ZERO_CENTS
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
      .reduce<Cents>((s, pa) => addCents(s, toCents(pa.amount)), ZERO_CENTS)

    const inflow = applyRateCents(grossInflow, 1 - retainageRate)

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
      .reduce<Cents>((s, inv) => addCents(s, toCents(inv.amount)), ZERO_CENTS)

    const outflow = addCents(subOutflow, weeklyBurn)
    const net = subtractCents(inflow, outflow)
    cumulative = addCents(cumulative, net)

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
  const startingCents = toCents(startingCash)
  let cumulative: Cents = startingCents
  let lowest: Cents = startingCents
  let lowestWeek = 0
  const weeks: CashFlowWeek[] = []

  for (let i = 0; i < 13; i++) {
    const inflow = toCents(weeklyInflows[i] || 0)
    const outflow = toCents(weeklyOutflows[i] || 0)
    const net = subtractCents(inflow, outflow)
    cumulative = addCents(cumulative, net)

    if (cumulative < lowest) {
      lowest = cumulative
      lowestWeek = i + 1
    }

    const weekStart = new Date(startDate)
    weekStart.setDate(weekStart.getDate() + i * 7)

    weeks.push({
      weekLabel: `Wk ${i + 1}`,
      weekStart: weekStart.toISOString().slice(0, 10),
      projectedInflow: inflow,
      projectedOutflow: outflow,
      netCash: net,
      cumulativePosition: cumulative,
    })
  }

  return {
    weeks,
    currentCashPosition: startingCents,
    lowestProjectedPosition: lowest,
    lowestPositionWeek: lowestWeek,
  }
}

const WEEK_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const

export function computeThirteenWeekCashFlow(
  payApps: PayAppRow[],
  changeOrders: MappedChangeOrder[],
  budgetItems: BudgetItemRow[],
  startDate?: Date,
  retainageRate: number = DEFAULT_RETAINAGE_RATE,
): CashFlowWeek[] {
  void changeOrders // reserved for future CO-driven inflow adjustments

  const start = startDate ? new Date(startDate) : new Date()
  start.setHours(0, 0, 0, 0)

  // Net-of-retainage factor (e.g. 10% retainage → pay out 90%)
  const netFactor = 1 - retainageRate

  // Weekly outflow: committed costs spread at a 1/12 monthly burn rate, prorated to weekly
  const totalCommitted = budgetItems.reduce<Cents>(
    (s, b) => addCents(s, toCents(b.committed_amount ?? 0)),
    ZERO_CENTS,
  )
  const weeklyOutflow = Math.round(totalCommitted / 52) as Cents

  const approvedApps = payApps.filter(pa => pa.status === 'approved')
  const hasPaymentDates = approvedApps.some(pa => pa.approved_date != null)
  const totalApprovedBilling = approvedApps.reduce<Cents>(
    (s, pa) => addCents(s, toCents(pa.current_payment_due ?? 0)),
    ZERO_CENTS,
  )

  let cumulative: Cents = ZERO_CENTS
  const weeks: CashFlowWeek[] = []

  for (let i = 0; i < 13; i++) {
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() + i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    let inflow: Cents
    if (hasPaymentDates) {
      const gross = approvedApps
        .filter(pa => {
          if (!pa.approved_date) return false
          const d = new Date(pa.approved_date)
          return d >= weekStart && d <= weekEnd
        })
        .reduce<Cents>((s, pa) => addCents(s, toCents(pa.current_payment_due ?? 0)), ZERO_CENTS)
      inflow = applyRateCents(gross, netFactor)
    } else {
      // Distribute remaining approved billing evenly over weeks 1-8
      inflow = i < 8
        ? (Math.round((totalApprovedBilling / 8) * netFactor) as Cents)
        : ZERO_CENTS
    }

    const netCash = subtractCents(inflow, weeklyOutflow)
    cumulative = addCents(cumulative, netCash)

    weeks.push({
      weekLabel: `${WEEK_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`,
      weekStart: weekStart.toISOString().slice(0, 10),
      projectedInflow: inflow,
      projectedOutflow: weeklyOutflow,
      netCash,
      cumulativePosition: cumulative,
    })
  }

  return weeks
}
