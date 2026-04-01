import { supabase, transformSupabaseError } from '../client'
import { ApiError } from '../errors'
import type { EnrichedProject } from '../../types/project'
import type { ProjectMetrics, ProjectMetricsResult } from '../../types/api'

// Health score component weights (must sum to 1)
const SCHEDULE_WEIGHT = 0.35
const BUDGET_WEIGHT = 0.35
const RFI_WEIGHT = 0.20
const SAFETY_WEIGHT = 0.10

// Thresholds at which each negative indicator drives the component to 0
const SCHEDULE_VARIANCE_THRESHOLD_DAYS = 20   // days behind schedule
const BUDGET_OVERRUN_THRESHOLD = 0.10          // fraction over budget (e.g. 0.10 = 10% overrun)
const RFI_OVERDUE_THRESHOLD = 10              // count of overdue RFIs
const SAFETY_INCIDENT_THRESHOLD = 3           // incidents this month

function componentScore(negativeIndicator: number, threshold: number): number {
  return 100 * (1 - Math.min(1, negativeIndicator / threshold))
}

// Fields used to compute data completeness (excludes id/name identifiers)
const METRICS_COMPLETENESS_FIELDS: (keyof ProjectMetrics)[] = [
  'overall_progress',
  'milestones_completed',
  'milestones_total',
  'schedule_variance_days',
  'rfis_open',
  'rfis_overdue',
  'rfis_total',
  'avg_rfi_response_days',
  'punch_open',
  'punch_total',
  'budget_total',
  'budget_spent',
  'budget_committed',
  'crews_active',
  'workers_onsite',
  'safety_incidents_this_month',
  'submittals_pending',
  'submittals_approved',
  'submittals_total',
]

// Returns null when no fields are populated — never a fake zero.
export function computeMetricsConfidence(data: ProjectMetrics): number | null {
  const nonNull = METRICS_COMPLETENESS_FIELDS.filter(f => data[f] != null).length
  if (nonNull === 0) return null
  return Math.round((nonNull / METRICS_COMPLETENESS_FIELDS.length) * 100)
}

// Returns null when all health-relevant fields are absent — never a fake perfect score.
export function computeHealthScoreFromMetrics(data: ProjectMetrics): number | null {
  const hasScheduleData = data.schedule_variance_days != null
  const hasBudgetData = data.budget_total > 0
  const hasRfiData = data.rfis_overdue != null
  if (!hasScheduleData && !hasBudgetData && !hasRfiData) return null

  const scheduleHealth = componentScore(
    Math.max(0, data.schedule_variance_days ?? 0),
    SCHEDULE_VARIANCE_THRESHOLD_DAYS
  )
  const budgetOverrunFraction = data.budget_total
    ? Math.max(0, data.budget_spent / data.budget_total - 1)
    : 0
  const budgetHealth = componentScore(budgetOverrunFraction, BUDGET_OVERRUN_THRESHOLD)
  const rfiHealth = componentScore(data.rfis_overdue ?? 0, RFI_OVERDUE_THRESHOLD)
  const safetyHealth = componentScore(data.safety_incidents_this_month ?? 0, SAFETY_INCIDENT_THRESHOLD)
  return Math.round(
    scheduleHealth * SCHEDULE_WEIGHT +
    budgetHealth * BUDGET_WEIGHT +
    rfiHealth * RFI_WEIGHT +
    safetyHealth * SAFETY_WEIGHT
  )
}

export async function getProject(projectId: string): Promise<EnrichedProject> {
  if (!projectId) throw new ApiError('projectId is required to load project data', 400, 'MISSING_PROJECT_ID', 'No project selected.')
  const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (error) throw transformSupabaseError(error)
  return {
    ...data,
    totalValue: data.contract_value || 0,
    completionPercentage: 0,
    daysRemaining: data.target_completion
      ? Math.max(0, Math.ceil((new Date(data.target_completion).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0,
    scheduledEndDate: data.target_completion || '',
    startDate: data.start_date || '',
    contractor: data.general_contractor || '',
  }
}

export async function getMetrics(projectId: string): Promise<ProjectMetricsResult> {
  if (!projectId) throw new ApiError('projectId is required to load project data', 400, 'MISSING_PROJECT_ID', 'No project selected.')
  const project = await getProject(projectId)
  const { data, error } = await supabase
    .from('project_metrics')
    .select('*')
    .eq('project_id', project.id)
    .single()
  if (error) throw transformSupabaseError(error)
  const metrics = data as ProjectMetrics
  const contractValue = project.contract_value || 0
  const daysBeforeSchedule = project.target_completion
    ? Math.ceil((new Date(project.target_completion).getTime() - Date.now()) / 86400000) - (metrics.planned_duration_days ?? 0)
    : 0
  return {
    progress: metrics.overall_progress,
    budgetSpent: metrics.budget_spent,
    budgetTotal: metrics.budget_total || contractValue,
    crewsActive: metrics.crews_active,
    workersOnSite: metrics.workers_onsite,
    rfiOpen: metrics.rfis_open,
    rfiOverdue: metrics.rfis_overdue,
    punchListOpen: metrics.punch_open,
    aiHealthScore: computeHealthScoreFromMetrics(metrics),
    daysBeforeSchedule,
    milestonesHit: metrics.milestones_completed,
    milestoneTotal: metrics.milestones_total,
    aiConfidenceLevel: computeMetricsConfidence(metrics),
  }
}
