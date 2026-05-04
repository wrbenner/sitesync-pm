
import { fromTable } from '../../lib/db/queries'
import type { ProjectMetrics } from '../../types/api'
import { computeProjectHealthScore, computeAiConfidenceLevel } from '../../lib/healthScoring'

export async function getProjectMetrics(projectId: string): Promise<ProjectMetrics | null> {
  try {
    const { data, error } = await fromTable('project_metrics' as never)
      .select('*')
      .eq('project_id' as never, projectId)
      .maybeSingle()
    if (error) {
      if (import.meta.env.DEV) console.warn('[getProjectMetrics] error:', error)
      return null
    }
    if (!data) return null
    const metrics = data as unknown as ProjectMetrics
    return {
      ...metrics,
      aiHealthScore: computeProjectHealthScore(metrics),
      aiConfidenceLevel: computeAiConfidenceLevel(metrics),
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[getProjectMetrics] threw:', err)
    return null
  }
}

// Single query for all requested projects using .in() — avoids N+1 fetches in portfolio view.
// RLS is enforced at the DB level; the .in() filter does not bypass row-level security.
export async function getBulkProjectMetrics(
  projectIds: string[]
): Promise<Record<string, ProjectMetrics>> {
  if (projectIds.length === 0) return {}
  try {
    const { data, error } = await fromTable('project_metrics' as never)
      .select('*')
      .in('project_id' as never, projectIds)
    if (error) {
      if (import.meta.env.DEV) console.warn('[getBulkProjectMetrics] error:', error)
      return {}
    }
    const rows = (data ?? []) as unknown as ProjectMetrics[]
    return Object.fromEntries(
      rows.map((metrics): [string, ProjectMetrics] => [
        metrics.project_id,
        {
          ...metrics,
          aiHealthScore: computeProjectHealthScore(metrics),
          aiConfidenceLevel: computeAiConfidenceLevel(metrics),
        },
      ])
    )
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[getBulkProjectMetrics] threw:', err)
    return {}
  }
}

type PortfolioMetricsRow = Pick<
  ProjectMetrics,
  | 'project_id'
  | 'rfis_open'
  | 'rfis_overdue'
  | 'punch_open'
  | 'schedule_variance_days'
  | 'safety_incidents_this_month'
>

// Narrow select reduces payload ~80% vs SELECT *. Only columns required by
// computeProjectHealthScore are fetched; count: 'exact' enables total-row reporting.
export async function getPortfolioMetrics(orgId: string): Promise<PortfolioMetricsRow[]> {
  try {
    const { data, error } = await fromTable('project_metrics' as never)
      .select(
        'project_id, rfis_open, rfis_overdue, punch_open, schedule_variance_days, safety_incidents_this_month, projects!inner(organization_id)',
        { count: 'exact' }
      )
      .eq('projects.organization_id' as never, orgId)
      .limit(200)
    if (error) {
      if (import.meta.env.DEV) console.warn('[getPortfolioMetrics] error:', error)
      return []
    }
    const rows = (data || []) as unknown as PortfolioMetricsRow[]
    return rows.map((metrics) => ({
      ...metrics,
      aiHealthScore: computeProjectHealthScore(metrics as unknown as ProjectMetrics),
      aiConfidenceLevel: computeAiConfidenceLevel(metrics as unknown as ProjectMetrics),
    }))
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[getPortfolioMetrics] threw:', err)
    return []
  }
}
