import { supabase, transformSupabaseError } from '../client'

export async function getProject(projectId?: string) {
  const q = projectId
    ? supabase.from('projects').select('*').eq('id', projectId).single()
    : supabase.from('projects').select('*').eq('status', 'active').limit(1).single()
  const { data, error } = await q
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  // Map DB fields to shape expected by pages
  return {
    ...data,
    totalValue: data.contract_value || 0,
    completionPercentage: 0,
    daysRemaining: data.target_completion ? Math.max(0, Math.ceil((new Date(data.target_completion).getTime() - Date.now()) / (1000*60*60*24))) : 0,
    scheduledEndDate: data.target_completion || '',
    startDate: data.start_date || '',
    owner: '',
    architect: '',
    contractor: data.general_contractor || '',
    description: '',
    type: 'Commercial',
  }
}

export async function getMetrics(projectId?: string) {
  const project = await getProject(projectId)
  const pid = project.id
  const [rfis, punchItems, crews, phases, budget] = await Promise.all([
    supabase.from('rfis').select('id, status').eq('project_id', pid),
    supabase.from('punch_items').select('id, status').eq('project_id', pid),
    supabase.from('crews').select('id, status, size').eq('project_id', pid),
    supabase.from('schedule_phases').select('id, percent_complete').eq('project_id', pid),
    supabase.from('budget_items').select('original_amount, actual_amount').eq('project_id', pid),
  ])
  const progress = (phases.data || []).length
    ? Math.round((phases.data || []).reduce((s: number, p: any) => s + (p.percent_complete || 0), 0) / (phases.data || []).length)
    : 0
  const budgetTotal = (budget.data || []).reduce((s: number, b: any) => s + (b.original_amount || 0), 0)
  const budgetSpent = (budget.data || []).reduce((s: number, b: any) => s + (b.actual_amount || 0), 0)
  return {
    progress,
    budgetSpent,
    budgetTotal: budgetTotal || (project.contract_value || 0),
    crewsActive: (crews.data || []).filter((c: any) => c.status === 'active').length,
    workersOnSite: (crews.data || []).reduce((s: number, c: any) => s + (c.size || 0), 0),
    rfiOpen: (rfis.data || []).filter((r: any) => r.status === 'open' || r.status === 'under_review').length,
    rfiOverdue: 0,
    punchListOpen: (punchItems.data || []).filter((p: any) => p.status === 'open' || p.status === 'in_progress').length,
    aiHealthScore: 85,
    daysBeforeSchedule: 0,
    milestonesHit: (phases.data || []).filter((p: any) => (p.percent_complete || 0) >= 100).length,
    milestoneTotal: (phases.data || []).length,
    aiConfidenceLevel: 74,
  }
}
