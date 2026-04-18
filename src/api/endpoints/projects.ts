import { useQuery } from '@tanstack/react-query'
import { supabase } from '../client'
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
    supabase
      .from('schedule_phases')
      .select('baseline_end, end_date')
      .eq('project_id', projectId)
      .eq('is_critical_path', true)
      .order('baseline_end', { ascending: false })
      .limit(1),
    supabase
      .from('schedule_phases')
      .select('baseline_start, baseline_end, percent_complete')
      .eq('project_id', projectId),
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
  const last = criticalResult.data?.[0]
  if (last?.baseline_end) {
    const plannedEnd = new Date(last.baseline_end)
    const actualEnd = last.end_date ? new Date(last.end_date) : new Date()
    scheduleVarianceDays = Math.round(
      (actualEnd.getTime() - plannedEnd.getTime()) / 86400000
    )
  }

  // COMPUTED: source = financialEngine
  // completion_percentage: sum(percent_complete * duration_days) / sum(duration_days)
  let weightedSum = 0
  let totalDuration = 0
  for (const phase of (completionResult.data ?? [])) {
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
    supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
    fetchScheduleMetrics(projectId),
  ])
  if (projectResult.error) throw transformSupabaseError(projectResult.error)
  const data = projectResult.data
  if (!data) {
    throw new ApiError(
      `Project ${projectId} not found or not accessible`,
      404,
      'PROJECT_NOT_FOUND',
      'Project not found.',
    )
  }
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
    supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
    supabase.from('project_metrics').select('*').eq('project_id', projectId).maybeSingle(),
    fetchScheduleMetrics(projectId),
    fetchBudgetDivisions(projectId).catch(() => null),
  ])

  if (projectResult.error) throw transformSupabaseError(projectResult.error)
  // metrics view may legitimately be empty for new projects — degrade gracefully.

  const project = projectResult.data
  if (!project) {
    throw new ApiError(
      `Project ${projectId} not found or not accessible`,
      404,
      'PROJECT_NOT_FOUND',
      'Project not found.',
    )
  }
  const metrics = (metricsResult.data ?? null) as ProjectMetrics | null
  const contractValue = project.contract_value || 0

  // COMPUTED: source = financialEngine
  const budgetVariance: number | null = (() => {
    if (!costData) return null
    const summary = computeProjectFinancials(costData.divisions, costData.changeOrders, contractValue)
    return summary.variance
  })()

  const { scheduleVarianceDays, completionPercentage } = scheduleMetrics

  const daysBeforeSchedule = project.target_completion
    ? Math.ceil((new Date(project.target_completion).getTime() - Date.now()) / 86400000) - (metrics?.planned_duration_days ?? 0)
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
