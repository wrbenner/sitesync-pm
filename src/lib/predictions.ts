// Prediction Engine: Risk detection algorithms for construction projects
// Each function returns structured predictions that can be stored as ai_insights

import { type Cents, toCents, fromCents, addCents, subtractCents, applyRateCents } from '../types/money'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// ── Schedule Risk Prediction ─────────────────────────────────

export interface TaskRiskAssessment {
  taskId: string
  taskTitle: string
  riskLevel: RiskLevel
  riskScore: number // 0 to 100
  factors: string[]
  delayProbability: number // 0 to 1
}

export function assessTaskRisk(task: {
  id: string
  title: string
  status: string | null
  due_date: string | null
  start_date: string | null
  percent_complete: number | null
  predecessor_ids: string[] | null
  is_critical_path: boolean | null
  estimated_hours: number | null
}, predecessors: Array<{ id: string; status: string | null }>, isOutdoorWork?: boolean): TaskRiskAssessment {
  let score = 0
  const factors: string[] = []
  const now = new Date()

  // Factor 1: Progress vs elapsed time
  if (task.start_date && task.due_date) {
    const start = new Date(task.start_date).getTime()
    const end = new Date(task.due_date).getTime()
    const totalDuration = end - start
    const elapsed = now.getTime() - start
    const elapsedRatio = totalDuration > 0 ? Math.min(1, elapsed / totalDuration) : 0
    const progressRatio = (task.percent_complete || 0) / 100

    if (elapsedRatio > 0.3 && progressRatio < elapsedRatio * 0.5) {
      score += 30
      factors.push(`Progress (${Math.round(progressRatio * 100)}%) significantly behind elapsed time (${Math.round(elapsedRatio * 100)}%)`)
    } else if (elapsedRatio > 0.5 && progressRatio < elapsedRatio * 0.7) {
      score += 15
      factors.push(`Progress tracking behind schedule pace`)
    }
  }

  // Factor 2: Overdue
  if (task.due_date && new Date(task.due_date) < now && task.status !== 'done') {
    const daysOverdue = Math.ceil((now.getTime() - new Date(task.due_date).getTime()) / 86400000)
    score += Math.min(40, daysOverdue * 5)
    factors.push(`${daysOverdue} days overdue`)
  }

  // Factor 3: Predecessor status
  if (task.predecessor_ids && task.predecessor_ids.length > 0) {
    const blockedPreds = predecessors.filter(p => task.predecessor_ids!.includes(p.id) && p.status !== 'done')
    if (blockedPreds.length > 0) {
      score += blockedPreds.length * 10
      factors.push(`${blockedPreds.length} predecessor${blockedPreds.length > 1 ? 's' : ''} not complete`)
    }
  }

  // Factor 4: Critical path premium
  if (task.is_critical_path) {
    score += 10
    factors.push('On critical path')
  }

  // Factor 5: Outdoor work weather exposure (simplified)
  if (isOutdoorWork) {
    score += 5
    factors.push('Outdoor work, weather dependent')
  }

  // Factor 6: No start date or due date
  if (!task.due_date) {
    score += 5
    factors.push('No due date set')
  }

  score = Math.min(100, score)

  const riskLevel: RiskLevel = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low'

  return {
    taskId: task.id,
    taskTitle: task.title,
    riskLevel,
    riskScore: score,
    factors,
    delayProbability: Math.min(0.95, score / 100),
  }
}

// ── Budget Burn Rate / Earned Value Analysis ─────────────────

export interface EarnedValueMetrics {
  BAC: number  // Budget at Completion
  PV: number   // Planned Value
  EV: number   // Earned Value
  AC: number   // Actual Cost
  CPI: number  // Cost Performance Index
  SPI: number  // Schedule Performance Index
  EAC: number  // Estimate at Completion
  ETC: number  // Estimate to Complete
  VAC: number  // Variance at Completion
  CV: number   // Cost Variance
  SV: number   // Schedule Variance
  TCPI: number // To Complete Performance Index
  alerts: string[]
}

export function computeEarnedValue(
  budgetItems: Array<{ original_amount: number | null; actual_amount: number | null; committed_amount: number | null; percent_complete: number | null }>,
  projectProgressPercent: number,
  elapsedPercent: number, // percent of project timeline elapsed
): EarnedValueMetrics {
  const ZERO = 0 as Cents
  const bacCents = budgetItems.reduce<Cents>((s, b) => addCents(s, toCents((b.original_amount || 0) * 100)), ZERO)
  const acCents = budgetItems.reduce<Cents>((s, b) => addCents(s, toCents((b.actual_amount || 0) * 100)), ZERO)
  const pvCents = applyRateCents(bacCents, Math.min(1, elapsedPercent / 100))
  const evCents = applyRateCents(bacCents, Math.min(1, projectProgressPercent / 100))

  const CPI = acCents > 0 ? fromCents(evCents) / fromCents(acCents) : 1
  const SPI = pvCents > 0 ? fromCents(evCents) / fromCents(pvCents) : 1
  const eacCents = (CPI > 0 ? Math.round(fromCents(bacCents) / CPI) : Math.round(fromCents(bacCents) * 1.5)) as Cents
  const etcCents = Math.max(0, fromCents(eacCents) - fromCents(acCents)) as Cents
  const vacCents = subtractCents(bacCents, eacCents)
  const cvCents = subtractCents(evCents, acCents)
  const svCents = subtractCents(evCents, pvCents)
  const remainingWork = subtractCents(bacCents, evCents)
  const remainingBudget = subtractCents(bacCents, acCents)
  const TCPI = remainingWork > 0 && remainingBudget !== 0 ? fromCents(remainingWork) / fromCents(remainingBudget) : 1

  // Convert back to dollars for display-facing metric consumers
  const BAC = fromCents(bacCents) / 100
  const AC = fromCents(acCents) / 100
  const PV = fromCents(pvCents) / 100
  const EV = fromCents(evCents) / 100
  const EAC = fromCents(eacCents) / 100
  const ETC = fromCents(etcCents) / 100
  const VAC = fromCents(vacCents) / 100
  const CV = fromCents(cvCents) / 100
  const SV = fromCents(svCents) / 100

  const alerts: string[] = []
  if (CPI < 0.95) alerts.push(`CPI at ${CPI.toFixed(2)}: project is over budget per unit of work`)
  if (CPI < 0.90) alerts.push(`CPI critically low at ${CPI.toFixed(2)}: immediate cost control needed`)
  if (SPI < 0.90) alerts.push(`SPI at ${SPI.toFixed(2)}: project is behind schedule`)
  if (SPI < 0.85) alerts.push(`SPI critically low at ${SPI.toFixed(2)}: schedule recovery plan needed`)
  if (TCPI > 1.15) alerts.push(`TCPI at ${TCPI.toFixed(2)}: required future efficiency is unrealistic`)
  if (fromCents(vacCents) < -fromCents(bacCents) * 0.05) alerts.push(`Projected overrun of $${Math.round(Math.abs(VAC)).toLocaleString()} at completion`)

  return { BAC, PV, EV, AC, CPI, SPI, EAC, ETC, VAC, CV, SV, TCPI, alerts }
}

// ── S-Curve data points from real data ───────────────────────

export interface SCurveDataPoint {
  date: string
  planned: number
  actual: number
  forecast?: number
}

export function buildSCurveData(
  snapshots: Array<{ snapshot_date: string; data: { budget_spent?: number; budget_total?: number; progress?: number } }>,
  totalBudget: number,
  projectStartDate: string,
  projectEndDate: string,
): SCurveDataPoint[] {
  const points: SCurveDataPoint[] = []
  const start = new Date(projectStartDate).getTime()
  const end = new Date(projectEndDate).getTime()
  const totalDuration = end - start

  // Sort snapshots by date
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

  for (const snap of sorted) {
    const snapTime = new Date(snap.snapshot_date).getTime()
    const elapsed = totalDuration > 0 ? (snapTime - start) / totalDuration : 0
    // S-curve planned: use a sigmoid approximation
    const plannedFraction = 1 / (1 + Math.exp(-10 * (elapsed - 0.5)))
    const plannedCost = totalBudget * plannedFraction

    points.push({
      date: snap.snapshot_date,
      planned: plannedCost,
      actual: snap.data.budget_spent || 0,
    })
  }

  return points
}

// ── RFI Bottleneck Detection ─────────────────────────────────

export interface RFIBottleneck {
  reviewer: string
  overdueCount: number
  totalAssigned: number
  avgResponseDays: number
  projectAvgResponseDays: number
  longestOpenRFI: { id: string; title: string; daysOpen: number } | null
}

export function detectRFIBottlenecks(rfis: Array<{
  id: string
  title: string
  status: string | null
  assigned_to: string | null
  due_date: string | null
  created_at: string | null
  responded_at?: string | null
}>): RFIBottleneck[] {
  const now = new Date()
  const reviewerMap = new Map<string, {
    total: number
    overdue: number
    responseTimes: number[]
    longestOpen: { id: string; title: string; daysOpen: number } | null
  }>()

  // Calculate project average response time
  const allResponseTimes: number[] = []

  for (const rfi of rfis) {
    const reviewer = rfi.assigned_to || 'Unassigned'
    const entry = reviewerMap.get(reviewer) || { total: 0, overdue: 0, responseTimes: [], longestOpen: null }

    if (rfi.status !== 'closed' && rfi.status !== 'void') {
      entry.total++
    }

    // Calculate response time for resolved RFIs
    if (rfi.responded_at && rfi.created_at) {
      const days = Math.ceil((new Date(rfi.responded_at).getTime() - new Date(rfi.created_at).getTime()) / 86400000)
      entry.responseTimes.push(days)
      allResponseTimes.push(days)
    }

    // Check overdue
    const isOpen = rfi.status === 'open' || rfi.status === 'under_review'
    if (isOpen && rfi.due_date && new Date(rfi.due_date) < now) {
      entry.overdue++
    }

    // Track longest open
    if (isOpen && rfi.created_at) {
      const daysOpen = Math.ceil((now.getTime() - new Date(rfi.created_at).getTime()) / 86400000)
      if (!entry.longestOpen || daysOpen > entry.longestOpen.daysOpen) {
        entry.longestOpen = { id: rfi.id, title: rfi.title, daysOpen }
      }
    }

    reviewerMap.set(reviewer, entry)
  }

  const projectAvg = allResponseTimes.length > 0
    ? allResponseTimes.reduce((s, t) => s + t, 0) / allResponseTimes.length
    : 5

  const bottlenecks: RFIBottleneck[] = []
  for (const [reviewer, data] of reviewerMap.entries()) {
    const avgResponse = data.responseTimes.length > 0
      ? data.responseTimes.reduce((s, t) => s + t, 0) / data.responseTimes.length
      : 0

    // Only flag if overdue count > 2 or avg response > 2x project average
    if (data.overdue >= 2 || (avgResponse > projectAvg * 2 && data.total > 0)) {
      bottlenecks.push({
        reviewer,
        overdueCount: data.overdue,
        totalAssigned: data.total,
        avgResponseDays: Math.round(avgResponse * 10) / 10,
        projectAvgResponseDays: Math.round(projectAvg * 10) / 10,
        longestOpenRFI: data.longestOpen,
      })
    }
  }

  return bottlenecks.sort((a, b) => b.overdueCount - a.overdueCount)
}

// ── Submittal Deadline Risk ──────────────────────────────────

export interface SubmittalRisk {
  submittalId: string
  submittalTitle: string
  requiredOnSiteDate: string | null
  daysUntilRequired: number
  estimatedReviewDays: number
  estimatedLeadTimeDays: number
  totalEstimatedDays: number
  riskLevel: RiskLevel
  gapDays: number // negative = projected late
}

export function assessSubmittalRisks(submittals: Array<{
  id: string
  title: string
  status: string | null
  submit_by_date: string | null
  required_on_site_date?: string | null
  lead_time_days?: number | null
}>): SubmittalRisk[] {
  const now = new Date()
  const avgReviewDays = 10 // Default review cycle in construction
  const defaultLeadTime = 14 // Default manufacturing lead time

  const risks: SubmittalRisk[] = []

  for (const sub of submittals) {
    if (sub.status === 'approved' || sub.status === 'closed') continue

    const requiredDate = sub.required_on_site_date || sub.submit_by_date
    if (!requiredDate) continue

    const daysUntilRequired = Math.ceil((new Date(requiredDate).getTime() - now.getTime()) / 86400000)
    const leadTime = sub.lead_time_days || defaultLeadTime

    // Estimate remaining review time based on current status
    let estimatedReviewDays = avgReviewDays
    if (sub.status === 'under_review') estimatedReviewDays = Math.ceil(avgReviewDays * 0.5)
    else if (sub.status === 'submitted') estimatedReviewDays = avgReviewDays
    else if (sub.status === 'draft') estimatedReviewDays = avgReviewDays + 3 // Extra for submission process
    else if (sub.status === 'resubmit') estimatedReviewDays = avgReviewDays + 5 // Resubmission adds time

    const totalEstimatedDays = estimatedReviewDays + leadTime
    const gapDays = daysUntilRequired - totalEstimatedDays

    let riskLevel: RiskLevel = 'low'
    if (gapDays < -14) riskLevel = 'critical'
    else if (gapDays < 0) riskLevel = 'high'
    else if (gapDays < 7) riskLevel = 'medium'

    if (riskLevel !== 'low') {
      risks.push({
        submittalId: sub.id,
        submittalTitle: sub.title,
        requiredOnSiteDate: requiredDate,
        daysUntilRequired,
        estimatedReviewDays,
        estimatedLeadTimeDays: leadTime,
        totalEstimatedDays,
        riskLevel,
        gapDays,
      })
    }
  }

  return risks.sort((a, b) => a.gapDays - b.gapDays)
}

// ── Insight Generation ───────────────────────────────────────

export interface GeneratedInsight {
  page: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  expanded_content: string
  action_label: string
  action_link: string
  entity_type?: string
  entity_id?: string
  category?: string
}

export function generateTaskRiskInsights(assessments: TaskRiskAssessment[]): GeneratedInsight[] {
  const insights: GeneratedInsight[] = []
  const critical = assessments.filter(a => a.riskLevel === 'critical')
  const high = assessments.filter(a => a.riskLevel === 'high')

  if (critical.length > 0) {
    insights.push({
      page: 'tasks',
      severity: 'critical',
      message: `${critical.length} task${critical.length > 1 ? 's' : ''} at critical risk of delay`,
      expanded_content: critical.map(t => `${t.taskTitle}: ${t.factors.join(', ')}`).join('. '),
      action_label: 'Review Critical Tasks',
      action_link: '/tasks',
      category: 'schedule',
    })
  }

  if (high.length > 0) {
    insights.push({
      page: 'tasks',
      severity: 'warning',
      message: `${high.length} task${high.length > 1 ? 's' : ''} at high risk of delay`,
      expanded_content: high.map(t => `${t.taskTitle}: ${t.factors.join(', ')}`).join('. '),
      action_label: 'Review At Risk Tasks',
      action_link: '/tasks',
      category: 'schedule',
    })
  }

  return insights
}

export function generateBudgetInsights(ev: EarnedValueMetrics): GeneratedInsight[] {
  const insights: GeneratedInsight[] = []

  if (ev.CPI < 0.90) {
    insights.push({
      page: 'budget',
      severity: 'critical',
      message: `Cost Performance Index at ${ev.CPI.toFixed(2)}: project significantly over budget`,
      expanded_content: `Current CPI of ${ev.CPI.toFixed(2)} means every $1 of work costs $${(1 / ev.CPI).toFixed(2)}. Projected overrun: $${Math.round(Math.abs(ev.VAC)).toLocaleString()}. Immediate cost control measures recommended.`,
      action_label: 'Review Budget',
      action_link: '/budget',
      category: 'budget',
    })
  } else if (ev.CPI < 0.95) {
    insights.push({
      page: 'budget',
      severity: 'warning',
      message: `Cost Performance Index at ${ev.CPI.toFixed(2)}: trending over budget`,
      expanded_content: `CPI below 0.95 indicates spending is outpacing earned value. Projected final cost: $${Math.round(ev.EAC).toLocaleString()}.`,
      action_label: 'Review Budget',
      action_link: '/budget',
      category: 'budget',
    })
  }

  if (ev.SPI < 0.85) {
    insights.push({
      page: 'schedule',
      severity: 'critical',
      message: `Schedule Performance Index at ${ev.SPI.toFixed(2)}: project significantly behind schedule`,
      expanded_content: `SPI of ${ev.SPI.toFixed(2)} means only earning ${Math.round(ev.SPI * 100)}% of planned value. Schedule recovery plan recommended.`,
      action_label: 'Review Schedule',
      action_link: '/schedule',
      category: 'schedule',
    })
  } else if (ev.SPI < 0.90) {
    insights.push({
      page: 'schedule',
      severity: 'warning',
      message: `Schedule Performance Index at ${ev.SPI.toFixed(2)}: project behind planned pace`,
      expanded_content: `Project is earning value at ${Math.round(ev.SPI * 100)}% of the planned rate. Review critical path tasks for acceleration opportunities.`,
      action_label: 'Review Schedule',
      action_link: '/schedule',
      category: 'schedule',
    })
  }

  return insights
}

export function generateRFIBottleneckInsights(bottlenecks: RFIBottleneck[]): GeneratedInsight[] {
  return bottlenecks.map(b => ({
    page: 'rfis',
    severity: (b.overdueCount >= 5 ? 'critical' : 'warning') as 'critical' | 'warning',
    message: `Bottleneck: ${b.reviewer} has ${b.overdueCount} overdue RFIs. Average response: ${b.avgResponseDays} days (project average: ${b.projectAvgResponseDays} days)`,
    expanded_content: b.longestOpenRFI
      ? `Longest open: "${b.longestOpenRFI.title}" (${b.longestOpenRFI.daysOpen} days). Total assigned: ${b.totalAssigned}. Escalation or workload redistribution recommended.`
      : `Total assigned: ${b.totalAssigned}. Consider escalation.`,
    action_label: 'View RFIs',
    action_link: '/rfis',
    category: 'quality',
  }))
}

// ── Schedule Phase Risk Prediction ──────────────────────────

export interface WeatherDay {
  date: string
  conditions: string
  precipitationChance: number
  tempHigh: number
  tempLow: number
}

// ── Predictive Delay Engine ──────────────────────────────────

export interface ScheduleActivity {
  id: string
  name: string
  percent_complete: number
  planned_percent_complete: number | null
  work_type: 'indoor' | 'outdoor' | 'both' | null
  float_days: number
  status: string | null
  start_date: string | null
  end_date: string | null
}

export interface PredictedDelay {
  activityId: string
  activityName: string
  riskScore: number          // 0 to 1
  predictedSlippageDays: number
  reasons: string[]
  suggestedAction: string
}

/**
 * Flag schedule activities at risk of slipping based on three criteria:
 *  (a) progress more than 10% behind planned_percent_complete
 *  (b) outdoor activity with >60% precipitation forecast in next 3 days
 *  (c) float < 2 days and activity not yet started
 */
export function predictScheduleDelays(
  _projectId: string,
  activities: ScheduleActivity[],
  weatherForecast: WeatherDay[],
): PredictedDelay[] {
  const today = new Date()
  const todayMs = today.getTime()
  const day3Ms = todayMs + 3 * 86_400_000

  // Weather days within the next 3 calendar days
  const next3Days = weatherForecast.filter(w => {
    const ms = new Date(w.date).getTime()
    return ms >= todayMs - 86_400_000 && ms <= day3Ms
  })

  const delays: PredictedDelay[] = []

  for (const activity of activities) {
    const reasons: string[] = []
    let riskScore = 0
    let predictedSlippageDays = 0

    // (a) Percent complete behind plan
    if (activity.planned_percent_complete != null) {
      const gap = activity.planned_percent_complete - activity.percent_complete
      if (gap > 10) {
        reasons.push(`${Math.round(gap)}% behind planned progress (${activity.percent_complete}% actual vs ${activity.planned_percent_complete}% planned)`)
        riskScore += Math.min(0.5, gap / 100)
        predictedSlippageDays += Math.max(1, Math.ceil(gap / 10))
      }
    }

    // (b) Outdoor work with adverse weather in next 3 days
    if (activity.work_type === 'outdoor' || activity.work_type === 'both') {
      const adverseDays = next3Days.filter(w => w.precipitationChance > 60)
      if (adverseDays.length > 0) {
        const maxPrecip = Math.max(...adverseDays.map(w => w.precipitationChance))
        reasons.push(`${adverseDays.length} day${adverseDays.length > 1 ? 's' : ''} of precipitation forecast (up to ${maxPrecip}% chance)`)
        riskScore += Math.min(0.4, adverseDays.length / 3 * 0.4)
        predictedSlippageDays += adverseDays.length
      }
    }

    // (c) Low float and not yet started
    const notStarted = activity.percent_complete === 0 || activity.status === 'not_started'
    if (activity.float_days < 2 && notStarted) {
      const floatLabel = activity.float_days === 0 ? 'zero float' : `${activity.float_days}d float`
      reasons.push(`Activity not started with ${floatLabel} remaining`)
      riskScore += 0.4
      predictedSlippageDays += Math.max(1, 2 - activity.float_days)
    }

    if (reasons.length === 0) continue

    riskScore = Math.min(1, riskScore)

    let suggestedAction = 'Review resource allocation and update the schedule baseline.'
    if (activity.work_type === 'outdoor' || activity.work_type === 'both') {
      suggestedAction = 'Pre-position indoor work to buffer weather delay. Accelerate outdoor tasks before the precipitation window.'
    } else if (activity.float_days < 2 && notStarted) {
      suggestedAction = 'Assign a dedicated crew immediately to protect the zero-float milestone.'
    } else if (activity.planned_percent_complete != null && activity.planned_percent_complete - activity.percent_complete > 10) {
      suggestedAction = 'Authorize overtime or add crew to recover the schedule progress gap.'
    }

    delays.push({
      activityId: activity.id,
      activityName: activity.name,
      riskScore,
      predictedSlippageDays,
      reasons,
      suggestedAction,
    })
  }

  return delays.sort((a, b) => b.riskScore - a.riskScore)
}

export interface MappedPhase {
  id: string
  name: string
  startDate: string
  endDate: string
  progress: number
  critical: boolean
  completed: boolean
  floatDays?: number | null
  slippageDays?: number
}

export interface PredictedRisk {
  phaseId: string
  title: string
  likelihoodPercent: number
  impactDays: number
  reason: string
  suggestedAction: string
}

export function predictScheduleRisks(phases: MappedPhase[], weatherForecast: WeatherDay[]): PredictedRisk[] {
  const now = new Date()
  const risks: PredictedRisk[] = []
  const LOOKAHEAD_MS = 30 * 86400000

  for (const phase of phases) {
    if (phase.completed) continue

    const phaseStart = new Date(phase.startDate)
    const phaseEnd = new Date(phase.endDate)

    // Only analyze phases active within the next 30 days
    if (phaseStart.getTime() > now.getTime() + LOOKAHEAD_MS) continue

    let likelihood = 20
    const reasonParts: string[] = []
    let impactDays = 0

    if (phase.critical) {
      likelihood += 15
      reasonParts.push('on critical path')
    }

    if (phase.floatDays === 0) {
      likelihood += 10
      reasonParts.push('zero float remaining')
    } else if ((phase.floatDays ?? 999) <= 3) {
      likelihood += 6
      reasonParts.push(`only ${phase.floatDays}d float remaining`)
    }

    const slip = phase.slippageDays ?? 0
    if (slip > 0) {
      likelihood += Math.min(slip * 5, 25)
      impactDays += slip
      reasonParts.push(`${slip} days of existing slippage`)
    }

    if (phase.progress < 30 && phaseStart < now) {
      likelihood += 15
      reasonParts.push('progress behind expected pace')
    }

    const adverseDays = weatherForecast.filter((w) => {
      const wd = new Date(w.date)
      return (
        wd >= phaseStart &&
        wd <= phaseEnd &&
        (w.conditions === 'Rain' ||
          w.conditions === 'Snow' ||
          w.conditions === 'Thunderstorm' ||
          w.precipitationChance > 60)
      )
    })
    if (adverseDays.length > 0) {
      likelihood += adverseDays.length * 8
      impactDays += Math.ceil(adverseDays.length * 0.5)
      const condSet = [...new Set(adverseDays.map((w) => w.conditions.toLowerCase()))].join(' and ')
      reasonParts.push(`${adverseDays.length} day${adverseDays.length > 1 ? 's' : ''} of ${condSet} in the 7-day forecast`)
    }

    likelihood = Math.min(95, likelihood)
    impactDays = Math.max(1, impactDays)

    if (likelihood < 40) continue

    const reason =
      reasonParts.length > 0
        ? `At risk due to ${reasonParts.join(', ')}.`
        : 'Multiple scheduling risk factors detected.'

    let suggestedAction = 'Review resource allocation and adjust schedule baseline.'
    if (adverseDays.length > 0) {
      suggestedAction = `Pre-position indoor work to buffer ${adverseDays.length} forecast weather day${adverseDays.length > 1 ? 's' : ''}. Add crew to accelerate critical tasks before weather window.`
    } else if (slip > 0) {
      suggestedAction = `Authorize overtime on ${phase.name} to recover ${slip} days of slippage before it cascades to successors.`
    } else if (phase.critical && phase.floatDays === 0) {
      suggestedAction = `Assign a dedicated crew to ${phase.name} to protect the zero-float critical path milestone.`
    }

    risks.push({ phaseId: phase.id, title: phase.name, likelihoodPercent: likelihood, impactDays, reason, suggestedAction })
  }

  return risks.sort((a, b) => b.likelihoodPercent - a.likelihoodPercent)
}

export function generateSubmittalRiskInsights(risks: SubmittalRisk[]): GeneratedInsight[] {
  const insights: GeneratedInsight[] = []
  const critical = risks.filter(r => r.riskLevel === 'critical')
  const high = risks.filter(r => r.riskLevel === 'high')

  if (critical.length > 0) {
    insights.push({
      page: 'submittals',
      severity: 'critical',
      message: `${critical.length} submittal${critical.length > 1 ? 's' : ''} projected to miss required on site date`,
      expanded_content: critical.map(s => `${s.submittalTitle}: ${Math.abs(s.gapDays)} days late (need ${s.totalEstimatedDays} days, only ${Math.max(0, s.daysUntilRequired)} remaining)`).join('. '),
      action_label: 'Review Submittals',
      action_link: '/submittals',
      category: 'schedule',
    })
  }

  if (high.length > 0) {
    insights.push({
      page: 'submittals',
      severity: 'warning',
      message: `${high.length} submittal${high.length > 1 ? 's' : ''} at risk of missing deadlines`,
      expanded_content: high.map(s => `${s.submittalTitle}: ${s.gapDays} days buffer remaining`).join('. '),
      action_label: 'Review Submittals',
      action_link: '/submittals',
      category: 'schedule',
    })
  }

  return insights
}
