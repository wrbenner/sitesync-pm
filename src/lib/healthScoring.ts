import type { ProjectMetrics } from '../types/api'

// Health score component weights — must sum to 1
export const HEALTH_WEIGHTS = {
  schedule: 0.25,
  budget: 0.30,
  rfi: 0.20,
  punch: 0.15,
  safety: 0.10,
} as const

// Thresholds at which a negative indicator drives its component score to 0
const SCHEDULE_VARIANCE_THRESHOLD_DAYS = 20  // days behind schedule
const BUDGET_OVERRUN_THRESHOLD = 0.10         // fraction over budget (0.10 = 10%)
const RFI_OVERDUE_THRESHOLD = 10             // count of overdue RFIs
const SAFETY_INCIDENT_THRESHOLD = 3          // incidents this month

// Minimum populated data sources before confidence can be reported
const MIN_DATA_SOURCES = 3

function componentScore(negativeIndicator: number, threshold: number): number {
  return 100 * (1 - Math.min(1, negativeIndicator / threshold))
}

// Returns how many of the five health data source dimensions have real data
function countPopulatedSources(data: ProjectMetrics): number {
  let count = 0
  if (data.schedule_variance_days != null) count++
  if (data.budget_total > 0) count++
  if (data.rfis_total > 0) count++
  if (data.punch_total > 0) count++
  if (data.safety_incidents_this_month != null) count++
  return count
}

/**
 * Returns the percentage of the five health dimensions (schedule, budget, RFI,
 * punch list, safety) that have real data. Returns null when fewer than
 * MIN_DATA_SOURCES are populated — callers should show "Insufficient data"
 * instead of a number.
 */
export function computeAiConfidenceLevel(data: ProjectMetrics): number | null {
  const populated = countPopulatedSources(data)
  if (populated < MIN_DATA_SOURCES) return null
  return Math.round((populated / 5) * 100)
}

/**
 * Returns a 0-100 project health score weighted across five dimensions.
 * Returns null when the three primary health indicators (schedule, budget,
 * RFI) are all absent from the metrics row.
 */
export function computeProjectHealthScore(data: ProjectMetrics): number | null {
  const hasScheduleData = data.schedule_variance_days != null
  const hasBudgetData = data.budget_total > 0
  const hasRfiData = data.rfis_overdue != null
  if (!hasScheduleData && !hasBudgetData && !hasRfiData) return null

  const scheduleHealth = hasScheduleData
    ? componentScore(Math.max(0, data.schedule_variance_days!), SCHEDULE_VARIANCE_THRESHOLD_DAYS)
    : 100

  const budgetOverrunFraction = hasBudgetData
    ? Math.max(0, data.budget_spent / data.budget_total - 1)
    : 0
  const budgetHealth = componentScore(budgetOverrunFraction, BUDGET_OVERRUN_THRESHOLD)

  const rfiHealth = componentScore(data.rfis_overdue ?? 0, RFI_OVERDUE_THRESHOLD)

  const punchHealth = data.punch_total > 0
    ? 100 * (1 - Math.min(1, (data.punch_open ?? 0) / data.punch_total))
    : 100

  const safetyHealth = componentScore(
    data.safety_incidents_this_month ?? 0,
    SAFETY_INCIDENT_THRESHOLD
  )

  return Math.round(
    scheduleHealth * HEALTH_WEIGHTS.schedule +
    budgetHealth * HEALTH_WEIGHTS.budget +
    rfiHealth * HEALTH_WEIGHTS.rfi +
    punchHealth * HEALTH_WEIGHTS.punch +
    safetyHealth * HEALTH_WEIGHTS.safety
  )
}
