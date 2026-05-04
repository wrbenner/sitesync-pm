import { useQuery } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { ApiError, transformSupabaseError } from '../errors'
import { queryKeys } from '../queryKeys'
import type { EnrichedProject } from '../../types/project'
import type { ProjectMetrics, ProjectMetricsResult } from '../../types/api'
import { computeProjectFinancials } from '../../lib/financialEngine'
import { computeProjectHealthScore, computeAiConfidenceLevel } from '../../lib/healthScoring'
import { fetchBudgetDivisions } from './budget'

// Queries schedule_phases for a project and derives schedule variance and weighted completion.
// Returns nulls when no phase data exists — never fake zeros.
async function fetchScheduleMetrics(projectId: string): Promise<{
  scheduleVarianceDays: number | null
  completionPercentage: number | null
}> {
  const [criticalResult, completionResult] = await Promise.all([
    fromTable('schedule_phases')
      .select('end_date, start_date')
      .eq('project_id' as never, projectId)
      .eq('is_critical_path' as never, true)
      .order('end_date', { ascending: false })
      .limit(1),
    fromTable('schedule_phases')
      .select('start_date, end_date, percent_complete')
      .eq('project_id' as never, projectId),
  ])

  if (criticalResult.error) {
    if (import.meta.env.DEV) console.warn('fetchScheduleMetrics critical query failed for project', projectId, criticalResult.error.message)
    return { scheduleVarianceDays: null, completionPercentage: null }
  }
  if (completionResult.error) {
    if (import.meta.env.DEV) console.warn('fetchScheduleMetrics completion query failed for project', projectId, completionResult.error.message)
    return { scheduleVarianceDays: null, completionPercentage: null }
  }

  // COMPUTED: source = financialEngine
  // schedule_variance_days: days behind on last critical path item (positive = late)
  let scheduleVarianceDays: number | null = null
  const last = (criticalResult.data?.[0]) as unknown as { end_date?: string } | undefined
  if (last?.end_date) {
    // Use end_date as planned end (baseline columns don't exist in this schema)
    const plannedEnd = new Date(last.end_date)
    const now = new Date()
    scheduleVarianceDays = Math.round(
      (now.getTime() - plannedEnd.getTime()) / 86400000
    )
    // If the phase end is in the future, variance is negative (ahead of schedule)
  }

  // COMPUTED: source = financialEngine
  // completion_percentage: sum(percent_complete * duration_days) / sum(duration_days)
  let weightedSum = 0
  let totalDuration = 0
  type PhaseRow = { start_date: string | null; end_date: string | null; percent_complete: number | null }
  for (const phase of ((completionResult.data ?? []) as unknown as PhaseRow[])) {
    if (phase.start_date && phase.end_date && phase.percent_complete != null) {
      const duration = Math.max(
        1,
        (new Date(phase.end_date).getTime() - new Date(phase.start_date).getTime()) / 86400000
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
  const [projectResult, scheduleResult] = await Promise.all([
    fromTable('projects').select('*').eq('id' as never, projectId).maybeSingle(),
    fetchScheduleMetrics(projectId).catch((err) => {
      if (import.meta.env.DEV) console.warn('fetchScheduleMetrics failed, using defaults:', err)
      return { scheduleVarianceDays: null, completionPercentage: null }
    }),
  ])
  const { completionPercentage } = scheduleResult
  if (projectResult.error) throw transformSupabaseError(projectResult.error)
  const data = projectResult.data as unknown as Record<string, unknown> | null
  if (!data) {
    throw new ApiError(
      `Project ${projectId} not found or not accessible`,
      404,
      'PROJECT_NOT_FOUND',
      'Project not found.',
    )
  }
  const proj = data as unknown as Record<string, unknown>
  const targetCompletion = (proj.target_completion as string | null) ?? null
  return {
    ...(data as object),
    totalValue: (proj.contract_value as number | null) || 0,
    // COMPUTED: source = financialEngine
    completionPercentage: completionPercentage ?? 0,
    daysRemaining: targetCompletion
      ? Math.max(0, Math.ceil((new Date(targetCompletion).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0,
    scheduledEndDate: targetCompletion || '',
    startDate: (proj.start_date as string | null) || '',
    contractor: (proj.general_contractor as string | null) || '',
  } as unknown as EnrichedProject
}

export async function getMetrics(projectId: string): Promise<ProjectMetricsResult> {
  if (!projectId) throw new ApiError('projectId is required to load project data', 400, 'MISSING_PROJECT_ID', 'No project selected.')

  const [projectResult, metricsResult, scheduleMetrics, costData] = await Promise.all([
    fromTable('projects').select('*').eq('id' as never, projectId).maybeSingle(),
    fromTable('project_metrics' as never).select('*').eq('project_id' as never, projectId).maybeSingle(),
    fetchScheduleMetrics(projectId).catch(() => ({ scheduleVarianceDays: null, completionPercentage: null })),
    fetchBudgetDivisions(projectId).catch(() => null),
  ])

  if (projectResult.error) throw transformSupabaseError(projectResult.error)
  // metrics view may legitimately be empty for new projects — degrade gracefully.

  const project = projectResult.data as unknown as Record<string, unknown> | null
  if (!project) {
    throw new ApiError(
      `Project ${projectId} not found or not accessible`,
      404,
      'PROJECT_NOT_FOUND',
      'Project not found.',
    )
  }
  const metrics = (metricsResult.data ?? null) as unknown as ProjectMetrics | null
  const contractValue = (project.contract_value as number | null) || 0

  // COMPUTED: source = financialEngine
  const budgetVariance: number | null = (() => {
    if (!costData) return null
    const summary = computeProjectFinancials(costData.divisions, costData.changeOrders, contractValue)
    return summary.variance
  })()

  const { scheduleVarianceDays, completionPercentage } = scheduleMetrics

  const projTarget = project.target_completion as string | null
  const daysBeforeSchedule = projTarget
    ? Math.ceil((new Date(projTarget).getTime() - Date.now()) / 86400000) - (metrics?.planned_duration_days ?? 0)
    : 0

  return {
    progress: metrics?.overall_progress ?? 0,
    budgetSpent: metrics?.budget_spent ?? 0,
    budgetTotal: metrics?.budget_total || contractValue,
    crewsActive: metrics?.crews_active ?? 0,
    workersOnSite: metrics?.workers_onsite ?? 0,
    rfiOpen: metrics?.rfis_open ?? 0,
    rfiOverdue: metrics?.rfis_overdue ?? null,
    punchListOpen: metrics?.punch_open ?? null,
    aiHealthScore: metrics ? computeProjectHealthScore(metrics) : null,
    daysBeforeSchedule,
    milestonesHit: metrics?.milestones_completed ?? 0,
    milestoneTotal: metrics?.milestones_total ?? 0,
    aiConfidenceLevel: metrics ? computeAiConfidenceLevel(metrics) : null,
    // COMPUTED: source = financialEngine
    budgetVariance,
    // COMPUTED: source = financialEngine
    scheduleVarianceDays,
    // COMPUTED: source = financialEngine
    completionPercentage,
  }
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useProjectMetrics(projectId: string) {
  return useQuery({
    queryKey: queryKeys.metrics.project(projectId),
    queryFn: () => getMetrics(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
  })
}
