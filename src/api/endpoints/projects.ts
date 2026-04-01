import { supabase, transformSupabaseError } from '../client'
import { ApiError } from '../errors'
import type { EnrichedProject } from '../../types/project'
import type { ProjectMetrics, ProjectMetricsResult } from '../../types/api'
import { computeProjectFinancials } from '../../lib/financialEngine'
import { computeProjectHealthScore, computeAiConfidenceLevel } from '../../lib/healthScoring'
import { getCostData } from './budget'

// Queries schedule_phases for a project and derives schedule variance and weighted completion.
// Returns nulls when no phase data exists — never fake zeros.
async function fetchScheduleMetrics(projectId: string): Promise<{
  scheduleVarianceDays: number | null
  completionPercentage: number | null
}> {
  const { data, error } = await supabase
    .from('schedule_phases')
    .select('baseline_start, baseline_end, end_date, percent_complete, is_critical_path')
    .eq('project_id', projectId)
  if (error || !data || data.length === 0) return { scheduleVarianceDays: null, completionPercentage: null }

  // COMPUTED: source = financialEngine
  // schedule_variance_days: days behind on last critical path item (positive = late)
  const criticalItems = data.filter(p => p.is_critical_path && p.baseline_end)
  let scheduleVarianceDays: number | null = null
  if (criticalItems.length > 0) {
    criticalItems.sort((a, b) =>
      new Date(b.baseline_end!).getTime() - new Date(a.baseline_end!).getTime()
    )
    const last = criticalItems[0]
    const plannedEnd = new Date(last.baseline_end!)
    const actualEnd = last.end_date ? new Date(last.end_date) : new Date()
    scheduleVarianceDays = Math.round(
      (actualEnd.getTime() - plannedEnd.getTime()) / 86400000
    )
  }

  // COMPUTED: source = financialEngine
  // completion_percentage: sum(percent_complete * duration_days) / sum(duration_days)
  let weightedSum = 0
  let totalDuration = 0
  for (const phase of data) {
    if (phase.baseline_start && phase.baseline_end && phase.percent_complete != null) {
      const duration = Math.max(
        1,
        (new Date(phase.baseline_end).getTime() - new Date(phase.baseline_start).getTime()) / 86400000
      )
      weightedSum += phase.percent_complete * duration
      totalDuration += duration
    }
  }
  const completionPercentage = totalDuration > 0 ? weightedSum / totalDuration : null

  return { scheduleVarianceDays, completionPercentage }
}

export async function getProject(projectId: string): Promise<EnrichedProject> {
  if (!projectId) throw new ApiError('projectId is required to load project data', 400, 'MISSING_PROJECT_ID', 'No project selected.')
  const [projectResult, { completionPercentage }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    fetchScheduleMetrics(projectId),
  ])
  if (projectResult.error) throw transformSupabaseError(projectResult.error)
  const data = projectResult.data
  return {
    ...data,
    totalValue: data.contract_value || 0,
    // COMPUTED: source = financialEngine
    completionPercentage: completionPercentage ?? 0,
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

  const [projectResult, metricsResult, scheduleMetrics, costData] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('project_metrics').select('*').eq('project_id', projectId).single(),
    fetchScheduleMetrics(projectId),
    getCostData(projectId).catch(() => null),
  ])

  if (projectResult.error) throw transformSupabaseError(projectResult.error)
  if (metricsResult.error) throw transformSupabaseError(metricsResult.error)

  const project = projectResult.data
  const metrics = metricsResult.data as ProjectMetrics
  const contractValue = project.contract_value || 0

  // COMPUTED: source = financialEngine
  const budgetVariance: number | null = (() => {
    if (!costData) return null
    const summary = computeProjectFinancials(costData.divisions, costData.changeOrders, contractValue)
    return summary.variance
  })()

  const { scheduleVarianceDays, completionPercentage } = scheduleMetrics

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
    aiHealthScore: computeProjectHealthScore(metrics),
    daysBeforeSchedule,
    milestonesHit: metrics.milestones_completed,
    milestoneTotal: metrics.milestones_total,
    aiConfidenceLevel: computeAiConfidenceLevel(metrics),
    // COMPUTED: source = financialEngine
    budgetVariance,
    // COMPUTED: source = financialEngine
    scheduleVarianceDays,
    // COMPUTED: source = financialEngine
    completionPercentage,
  }
}
