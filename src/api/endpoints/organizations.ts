import { supabase } from '../client'
import { transformSupabaseError } from '../errors'
import type { Organization, PortfolioMetrics } from '../../types/tenant'
import type { ProjectRow } from '../../types/api'

// Fetch all organizations the current user belongs to
export async function getUserOrganizations(): Promise<Organization[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization:organizations(*)')
    .eq('user_id', user.id)

  if (error) throw transformSupabaseError(error)

  return ((data ?? []) as any[])
    .map((row) => row.organization)
    .filter(Boolean) as Organization[]
}

// Fetch all projects belonging to an organization
export async function getOrganizationProjects(orgId: string): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return (data ?? []) as ProjectRow[]
}

// Aggregate portfolio metrics across all projects in the org.
// Used by the executive dashboard for the CFO and project executive view.
export async function getPortfolioMetrics(orgId: string): Promise<PortfolioMetrics> {
  const projects = await getOrganizationProjects(orgId)

  if (projects.length === 0) {
    return {
      total_projects: 0,
      active_projects: 0,
      total_contract_value: 0,
      total_budget_spent: 0,
      open_rfis: 0,
      overdue_rfis: 0,
      open_punch_items: 0,
      avg_completion_percentage: 0,
      projects_on_schedule: 0,
      projects_at_risk: 0,
    }
  }

  const projectIds = projects.map((p: any) => p.id)

  // Parallel queries for RFI and punch item counts across all org projects
  const [rfiResult, punchResult] = await Promise.all([
    supabase
      .from('rfis')
      .select('id, status, due_date')
      .in('project_id', projectIds),
    supabase
      .from('punch_items')
      .select('id, status')
      .in('project_id', projectIds),
  ])

  const rfis = (rfiResult.data ?? []) as any[]
  const punchItems = (punchResult.data ?? []) as any[]
  const now = new Date().toISOString()

  const activeProjects = projects.filter((p: any) => p.status === 'active')
  const totalContractValue = projects.reduce((sum: number, p: any) => sum + (p.total_value ?? 0), 0)
  const totalBudgetSpent = projects.reduce((sum: number, p: any) => sum + (p.budget_spent ?? 0), 0)
  const avgCompletion = projects.reduce((sum: number, p: any) => sum + (p.completion_percentage ?? 0), 0) / projects.length

  return {
    total_projects: projects.length,
    active_projects: activeProjects.length,
    total_contract_value: totalContractValue,
    total_budget_spent: totalBudgetSpent,
    open_rfis: rfis.filter((r) => r.status !== 'closed' && r.status !== 'answered').length,
    overdue_rfis: rfis.filter((r) => r.status !== 'closed' && r.due_date && r.due_date < now).length,
    open_punch_items: punchItems.filter((p) => p.status !== 'complete' && p.status !== 'closed').length,
    avg_completion_percentage: Math.round(avgCompletion),
    projects_on_schedule: projects.filter((p: any) => (p.schedule_variance_days ?? 0) >= 0).length,
    projects_at_risk: projects.filter((p: any) => (p.schedule_variance_days ?? 0) < -7).length,
  }
}
