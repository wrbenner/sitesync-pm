
import { supabase } from '../../lib/supabase'
import type { ProjectMetrics } from '../../types/api'
import { computeProjectHealthScore, computeAiConfidenceLevel } from '../../lib/healthScoring'

// BRT sub-0 day-2 P0-A: project_metrics is no longer reachable via .from() —
// direct SELECT is REVOKE'd from anon/authenticated. All reads go through
// the get_project_metrics SECURITY DEFINER wrapper with inline membership
// gate. p_project_id pins one project; p_organization_id (joins projects
// internally) scopes to an org; both NULL returns all caller-member rows.

export async function getProjectMetrics(projectId: string): Promise<ProjectMetrics | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_project_metrics' as never, { p_project_id: projectId } as never)
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

// Bulk fetch via single RPC call (no p_project_id) + client-side .in() chain
// on the SETOF return. PostgREST supports filter chaining on RPCs returning
// tables. RLS / membership is enforced inside the RPC's EXISTS gate.
export async function getBulkProjectMetrics(
  projectIds: string[]
): Promise<Record<string, ProjectMetrics>> {
  if (projectIds.length === 0) return {}
  try {
    const { data, error } = await supabase
      .rpc('get_project_metrics' as never)
      .in('project_id', projectIds)
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

// Portfolio scope filters by organization via the RPC's p_organization_id
// arg (the wrapper joins `projects` internally — project_metrics has no
// org_id column of its own).
export async function getPortfolioMetrics(orgId: string): Promise<PortfolioMetricsRow[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_project_metrics' as never, { p_organization_id: orgId } as never)
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
