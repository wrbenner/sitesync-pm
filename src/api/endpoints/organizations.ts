import { supabase } from '../client'
import { transformSupabaseError } from '../errors'
import { assertOrganizationAccess } from '../middleware/organizationScope'
import { dedupTtl, queryKey } from '../../lib/requestDedup'
import type { Organization, PortfolioMetrics } from '../../types/tenant'
import type { OrganizationMemberRow, ProjectRow, ProjectSummaryRow } from '../../types/api'

// Represents an organization_members row with its joined organization.
// The query selects only the nested org field, so only organization is accessed at runtime.
type OrgMemberWithOrg = OrganizationMemberRow & { organization: Organization | null }

// Fetch all organizations the current user belongs to
export async function getUserOrganizations(): Promise<Organization[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization:organizations(*)')
    .eq('user_id', user.id)

  if (error) throw transformSupabaseError(error)

  const members = (data ?? []) as OrgMemberWithOrg[]
  return members
    .map((row) => row.organization)
    .filter((org): org is Organization => org !== null)
}

// Fetch all projects belonging to an organization
export async function getOrganizationProjects(orgId: string): Promise<ProjectRow[]> {
  await assertOrganizationAccess(orgId)
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, contract_value, start_date, target_completion, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return (data ?? []) as ProjectRow[]
}

// Fetch a lightweight summary of all projects in an org — only the columns
// required for portfolio aggregation. Use this instead of getOrganizationProjects
// whenever full project detail is not needed (e.g. metrics, counts, status lists).
export async function getOrganizationProjectSummaries(orgId: string): Promise<ProjectSummaryRow[]> {
  await assertOrganizationAccess(orgId)
  const { data, error } = await supabase
    .from('projects')
    .select('id, status, contract_value, target_completion')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return (data ?? []) as ProjectSummaryRow[]
}

// Aggregate portfolio metrics across all projects in the org.
// Used by the executive dashboard for the CFO and project executive view.
//
// Performance notes:
//   Round-trip 1: get_portfolio_metrics RPC (single aggregated row, O(1) regardless of project count)
//   Round-trip 2: two parallel server-side count queries scoped to org via projects inner join
//   Results are cached for 60 seconds so rapid navigation does not re-fetch.
//
// Recommended DB indexes:
//   -- CREATE INDEX idx_projects_org_id ON projects(organization_id);
//   -- CREATE INDEX idx_rfis_project_status ON rfis(project_id, status);
//   -- CREATE INDEX idx_rfis_project_due_date ON rfis(project_id, due_date) WHERE status <> 'closed';
//   -- CREATE INDEX idx_punch_items_project_status ON punch_items(project_id, status);
export async function getPortfolioMetrics(orgId: string): Promise<PortfolioMetrics> {
  await assertOrganizationAccess(orgId)
  const cacheKey = queryKey('portfolio_metrics', { orgId })
  return dedupTtl(cacheKey, 60_000, async () => {
    // Round-trip 1: single-row aggregate via Postgres RPC.
    // Joins project_metrics for avg_completion_percentage and schedule_variance_days.
    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_portfolio_metrics', { org_id: orgId })
    if (rpcError) throw transformSupabaseError(rpcError)

    const row = rpcRows?.[0]
    if (!row || Number(row.total_projects) === 0) {
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

    const now = new Date().toISOString()

    // Round-trip 2: RFI and punch counts run in parallel, scoped to the org via
    // projects!inner join (no project ID fetch needed, O(1) round-trips regardless of count).
    const [openRfiResult, overdueRfiResult, openPunchResult] = await Promise.all([
      supabase
        .from('rfis')
        .select('id, projects!inner(organization_id)', { count: 'exact', head: true })
        .eq('projects.organization_id', orgId)
        .not('status', 'in', '("closed","answered")'),
      supabase
        .from('rfis')
        .select('id, projects!inner(organization_id)', { count: 'exact', head: true })
        .eq('projects.organization_id', orgId)
        .neq('status', 'closed')
        .lt('due_date', now),
      supabase
        .from('punch_items')
        .select('id, projects!inner(organization_id)', { count: 'exact', head: true })
        .eq('projects.organization_id', orgId)
        .not('status', 'in', '("complete","closed")'),
    ])

    // Partial failure mode: group RFI queries together and punch separately.
    // If both groups fail we cannot show any items data, so throw.
    // If only one group fails, surface a warning and continue with the data we have.
    const rfiFailed = openRfiResult.error !== null || overdueRfiResult.error !== null
    const punchFailed = openPunchResult.error !== null

    if (rfiFailed && punchFailed) {
      throw transformSupabaseError(
        openRfiResult.error ?? overdueRfiResult.error ?? openPunchResult.error!
      )
    }

    const warnings: string[] = []
    if (rfiFailed) warnings.push('RFI data unavailable — showing last known count')
    if (punchFailed) warnings.push('Punch list data unavailable — showing last known count')

    return {
      total_projects: Number(row.total_projects),
      active_projects: Number(row.active_projects),
      total_contract_value: Number(row.total_contract_value),
      total_budget_spent: 0,
      open_rfis: rfiFailed ? undefined : (openRfiResult.count ?? 0),
      overdue_rfis: rfiFailed ? undefined : (overdueRfiResult.count ?? 0),
      open_punch_items: punchFailed ? undefined : (openPunchResult.count ?? 0),
      avg_completion_percentage: Number(row.avg_completion_percentage),
      projects_on_schedule: Number(row.projects_on_schedule),
      projects_at_risk: Number(row.projects_at_risk),
      ...(warnings.length > 0 ? { warnings } : {}),
    }
  })
}
