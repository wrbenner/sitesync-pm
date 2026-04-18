// Risk Engine — AI-computed risk scores across RFI, Budget, Schedule, Safety categories.
// All computations are deterministic, client-side, and cheap. Each factor contributes
// 0–100 weighted points to a composite 0–100 risk score.

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type RiskCategory = 'rfi' | 'budget' | 'schedule' | 'safety'

export interface RiskFactor {
  name: string
  contribution: number
  description: string
}

export interface RiskScore {
  score: number
  level: RiskLevel
  factors: RiskFactor[]
}

export interface ScoredEntity {
  entityType: string
  entityId: string
  entityName: string
  category: RiskCategory
  risk: RiskScore
  href?: string
}

export function riskLevel(score: number): RiskLevel {
  if (score <= 25) return 'low'
  if (score <= 50) return 'medium'
  if (score <= 75) return 'high'
  return 'critical'
}

export function riskColor(score: number): string {
  if (score <= 25) return '#10B981'
  if (score <= 50) return '#F59E0B'
  if (score <= 75) return '#F97316'
  return '#EF4444'
}

function composite(factors: RiskFactor[], weights: number[]): number {
  const total = factors.reduce((acc, f, i) => acc + (f.contribution * (weights[i] ?? 0)), 0)
  const wSum = weights.reduce((a, b) => a + b, 0) || 1
  return Math.max(0, Math.min(100, Math.round(total / wSum)))
}

function daysBetween(a: string | Date, b: string | Date): number {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return ms / (1000 * 60 * 60 * 24)
}

// ── RFI Risk ─────────────────────────────────────────────────────
export interface RFIRiskInput {
  id: string
  title?: string | null
  created_at: string
  status?: string | null
  priority?: string | null
  assignee_response_rate?: number | null
  on_critical_path?: boolean
  returned_count?: number
  avg_response_days?: number
}

export function computeRFIRisk(rfi: RFIRiskInput): RiskScore {
  const daysOpen = Math.max(0, daysBetween(rfi.created_at, new Date()))
  const avg = Math.max(1, rfi.avg_response_days ?? 7)
  const openRatio = Math.min(100, (daysOpen / avg) * 50)

  const respRate = rfi.assignee_response_rate ?? 0.7
  const responderFactor = Math.max(0, Math.min(100, (1 - respRate) * 100))

  const critical = rfi.on_critical_path ? 100 : 0

  const priority = (rfi.priority || '').toLowerCase()
  const priorityFactor = priority === 'critical' ? 100 : priority === 'high' ? 75 : priority === 'medium' ? 50 : 25

  const returned = Math.min(100, (rfi.returned_count ?? 0) * 50)

  const factors: RiskFactor[] = [
    { name: 'Days open vs avg response', contribution: openRatio, description: `${daysOpen.toFixed(0)} days open (avg ${avg}d)` },
    { name: 'Assignee response rate', contribution: responderFactor, description: `${Math.round(respRate * 100)}% historical response` },
    { name: 'On critical path', contribution: critical, description: critical ? 'Blocks critical-path activity' : 'Not on critical path' },
    { name: 'Priority level', contribution: priorityFactor, description: priority || 'Normal priority' },
    { name: 'Returned / reopened', contribution: returned, description: `Returned ${rfi.returned_count ?? 0}×` },
  ]
  const score = composite(factors, [30, 20, 25, 15, 10])
  return { score, level: riskLevel(score), factors }
}

// ── Budget Risk ──────────────────────────────────────────────────
export interface BudgetRiskInput {
  code?: string
  description?: string | null
  budget: number
  actual: number
  committed: number
  change_order_count_30d?: number
  forecast?: number
  elapsed_fraction?: number
}

export function computeBudgetRisk(bi: BudgetRiskInput): RiskScore {
  const spent = bi.actual + bi.committed
  const consumption = bi.budget > 0 ? spent / bi.budget : 0
  const overrun = Math.min(100, Math.max(0, (consumption - 0.5) * 200))

  const elapsed = Math.max(0.01, bi.elapsed_fraction ?? 0.5)
  const burnRatio = bi.budget > 0 ? (bi.actual / bi.budget) / elapsed : 0
  const burn = Math.min(100, Math.max(0, (burnRatio - 0.9) * 100))

  const coVelocity = Math.min(100, (bi.change_order_count_30d ?? 0) * 25)

  const forecast = bi.forecast ?? spent
  const forecastGap = bi.budget > 0 ? Math.abs(forecast - bi.budget) / bi.budget : 0
  const forecastFactor = Math.min(100, forecastGap * 200)

  const factors: RiskFactor[] = [
    { name: 'Actual+Committed vs Budget', contribution: overrun, description: `${(consumption * 100).toFixed(0)}% consumed` },
    { name: 'Burn rate trajectory', contribution: burn, description: `${burnRatio.toFixed(2)}× expected pace` },
    { name: 'Change order velocity', contribution: coVelocity, description: `${bi.change_order_count_30d ?? 0} COs in last 30d` },
    { name: 'Forecast accuracy', contribution: forecastFactor, description: `${(forecastGap * 100).toFixed(0)}% forecast variance` },
  ]
  const score = composite(factors, [40, 30, 20, 10])
  return { score, level: riskLevel(score), factors }
}

// ── Schedule Risk ────────────────────────────────────────────────
export interface ScheduleRiskInput {
  id: string
  name?: string
  percent_complete: number
  expected_percent: number
  float_days?: number
  predecessors_complete?: boolean
  weather_dependent?: boolean
  season_risk?: number
  resource_conflicts?: number
}

export function computeScheduleRisk(task: ScheduleRiskInput): RiskScore {
  const progressGap = Math.max(0, task.expected_percent - task.percent_complete)
  const progressFactor = Math.min(100, progressGap * 1.5)

  const floatDays = task.float_days ?? 5
  const floatFactor = floatDays <= 0 ? 100 : Math.max(0, 100 - floatDays * 5)

  const predecessors = task.predecessors_complete === false ? 100 : 0

  const weather = task.weather_dependent ? Math.min(100, (task.season_risk ?? 0.3) * 100) : 0

  const conflicts = Math.min(100, (task.resource_conflicts ?? 0) * 50)

  const factors: RiskFactor[] = [
    { name: '% complete vs expected', contribution: progressFactor, description: `${task.percent_complete.toFixed(0)}% of expected ${task.expected_percent.toFixed(0)}%` },
    { name: 'Float on critical path', contribution: floatFactor, description: `${floatDays.toFixed(1)} days float remaining` },
    { name: 'Predecessor completion', contribution: predecessors, description: task.predecessors_complete === false ? 'Blocked by predecessors' : 'Predecessors complete' },
    { name: 'Weather × season', contribution: weather, description: task.weather_dependent ? 'Weather sensitive' : 'Indoor / weather independent' },
    { name: 'Resource conflicts', contribution: conflicts, description: `${task.resource_conflicts ?? 0} conflicts detected` },
  ]
  const score = composite(factors, [35, 25, 20, 10, 10])
  return { score, level: riskLevel(score), factors }
}

// ── Safety Risk ──────────────────────────────────────────────────
export interface SafetyRiskInput {
  days_since_last_incident: number
  inspections_required_30d: number
  inspections_completed_30d: number
  open_corrective_actions: number
  certs_expiring_30d: number
  trir_trend?: number
}

export function computeSafetyRisk(s: SafetyRiskInput): RiskScore {
  const incidentFactor = Math.max(0, 100 - s.days_since_last_incident * 2)

  const reqRate = s.inspections_required_30d > 0
    ? s.inspections_completed_30d / s.inspections_required_30d
    : 1
  const inspectionFactor = Math.max(0, Math.min(100, (1 - reqRate) * 100))

  const corrective = Math.min(100, s.open_corrective_actions * 20)

  const certs = Math.min(100, s.certs_expiring_30d * 25)

  const trir = s.trir_trend ?? 0
  const trirFactor = Math.max(0, Math.min(100, trir * 50 + 50))

  const factors: RiskFactor[] = [
    { name: 'Days since last incident', contribution: incidentFactor, description: `${s.days_since_last_incident} days incident-free` },
    { name: 'Inspection compliance', contribution: inspectionFactor, description: `${s.inspections_completed_30d}/${s.inspections_required_30d} inspections completed` },
    { name: 'Open corrective actions', contribution: corrective, description: `${s.open_corrective_actions} open items` },
    { name: 'Certifications expiring', contribution: certs, description: `${s.certs_expiring_30d} expiring in 30 days` },
    { name: 'TRIR trend', contribution: trirFactor, description: trir > 0 ? 'TRIR trending up' : trir < 0 ? 'TRIR trending down' : 'TRIR stable' },
  ]
  const score = composite(factors, [25, 25, 20, 15, 15])
  return { score, level: riskLevel(score), factors }
}

// ── Overall project risk ─────────────────────────────────────────
export function overallProjectRisk(parts: Partial<Record<RiskCategory, number>>): number {
  const values = Object.values(parts).filter((v): v is number => typeof v === 'number')
  if (!values.length) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}
