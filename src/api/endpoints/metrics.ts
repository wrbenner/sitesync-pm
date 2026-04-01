import { supabase, transformSupabaseError } from '../client'
import type { ProjectMetrics } from '../../types/api'
import { computeProjectHealthScore, computeAiConfidenceLevel } from '../../lib/healthScoring'

export async function getProjectMetrics(projectId: string): Promise<ProjectMetrics> {
  const { data, error } = await supabase
    .from('project_metrics')
    .select('*')
    .eq('project_id', projectId)
    .single()
  if (error) throw transformSupabaseError(error)
  const metrics = data as ProjectMetrics
  return {
    ...metrics,
    aiHealthScore: computeProjectHealthScore(metrics),
    aiConfidenceLevel: computeAiConfidenceLevel(metrics),
  }
}

// Single query for all requested projects using .in() — avoids N+1 fetches in portfolio view.
// RLS is enforced at the DB level; the .in() filter does not bypass row-level security.
export async function getBulkProjectMetrics(
  projectIds: string[]
): Promise<Record<string, ProjectMetrics>> {
  if (projectIds.length === 0) return {}
  const { data, error } = await supabase
    .from('project_metrics')
    .select('*')
    .in('project_id', projectIds)
  if (error) throw transformSupabaseError(error)
  const rows = (data ?? []) as ProjectMetrics[]
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
}

// Cap at 200 rows — full rows are required for per-project health scoring.
// For portfolio-level RFI/punch counts use getPortfolioMetrics in organizations.ts
// which runs count-only queries ({ head: true }) and transfers zero data rows.
export async function getPortfolioMetrics(orgId: string): Promise<ProjectMetrics[]> {
  const { data, error } = await supabase
    .from('project_metrics')
    .select('*, projects!inner(organization_id)')
    .eq('projects.organization_id', orgId)
    .limit(200)
  if (error) throw transformSupabaseError(error)
  const rows = (data || []) as ProjectMetrics[]
  return rows.map((metrics) => ({
    ...metrics,
    aiHealthScore: computeProjectHealthScore(metrics),
    aiConfidenceLevel: computeAiConfidenceLevel(metrics),
  }))
}
