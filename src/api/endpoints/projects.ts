import { supabase, transformSupabaseError } from '../client'
import type { EnrichedProject } from '../../types/project'

export async function getProject(projectId?: string): Promise<EnrichedProject> {
  const q = projectId
    ? supabase.from('projects').select('*').eq('id', projectId).single()
    : supabase.from('projects').select('*').eq('status', 'active').limit(1).single()
  const { data, error } = await q
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

export async function getMetrics(projectId?: string) {
  const project = await getProject(projectId)
  const { data, error } = await supabase
    .from('project_metrics')
    .select('*')
    .eq('project_id', project.id)
    .single()
  if (error) throw transformSupabaseError(error)
  return {
    progress: data.overall_progress,
    budgetSpent: data.budget_spent,
    budgetTotal: data.budget_total || (project.contract_value || 0),
    crewsActive: data.crews_active,
    workersOnSite: data.workers_onsite,
    rfiOpen: data.rfis_open,
    rfiOverdue: data.rfis_overdue,
    punchListOpen: data.punch_open,
    aiHealthScore: 85,
    daysBeforeSchedule: 0,
    milestonesHit: data.milestones_completed,
    milestoneTotal: data.milestones_total,
    aiConfidenceLevel: 74,
  }
}
