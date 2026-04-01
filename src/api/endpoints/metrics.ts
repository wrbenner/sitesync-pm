import { supabase, transformSupabaseError } from '../client'
import type { ProjectMetrics } from '../../types/api'

export async function getProjectMetrics(projectId: string): Promise<ProjectMetrics> {
  const { data, error } = await supabase
    .from('project_metrics')
    .select('*')
    .eq('project_id', projectId)
    .single()
  if (error) throw transformSupabaseError(error)
  return data
}

export async function getPortfolioMetrics(orgId: string): Promise<ProjectMetrics[]> {
  const { data, error } = await supabase
    .from('project_metrics')
    .select('*, projects!inner(organization_id)')
    .eq('projects.organization_id', orgId)
  if (error) throw transformSupabaseError(error)
  return data || []
}
