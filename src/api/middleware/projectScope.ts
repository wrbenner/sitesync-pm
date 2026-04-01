import { ApiError, AuthError, ValidationError } from '../errors'
import { supabase } from '../../lib/supabase'
import { useOrganizationStore } from '../../stores/organizationStore'
import { dedupTtl, queryKey } from '../../lib/requestDedup'
import type { Database } from '../../types/database'

type TableName = keyof Database['public']['Tables']

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateProjectId(projectId: string): void {
  if (!projectId || !UUID_V4_RE.test(projectId)) {
    throw new ValidationError('Invalid project ID', { projectId: 'Must be a valid UUID v4' })
  }
}

export async function assertProjectBelongsToActiveOrg(projectId: string, orgId: string): Promise<void> {
  const { data } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!data || data.organization_id !== orgId) {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }
}

export async function assertProjectAccess(projectId: string): Promise<void> {
  validateProjectId(projectId)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthError('Not authenticated')
  }
  const key = queryKey('project_members', { project_id: projectId, user_id: user.id })
  const memberData = await dedupTtl(key, 5000, () =>
    supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => data),
  )
  if (!memberData) {
    throw new ApiError('You do not have access to this project', 403, 'FORBIDDEN')
  }
  const orgId = useOrganizationStore.getState().currentOrg?.id
  if (!orgId) {
    throw new ApiError('No active organization context', 403, 'FORBIDDEN')
  }
  await assertProjectBelongsToActiveOrg(projectId, orgId)
}

export async function assertProjectBelongsToOrg(projectId: string, orgId: string): Promise<void> {
  validateProjectId(projectId)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthError('Not authenticated')
  }
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!data) {
    throw new ApiError(
      `Project ${projectId} does not belong to organization ${orgId}`,
      403,
      'FORBIDDEN',
    )
  }
}

// Simplified four-tier role rank used for addProjectMember / updateProjectMember checks.
// The detailed construction role hierarchy lives in src/types/tenant.ts (ROLE_HIERARCHY).
export const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
}

export function createProjectScopedQuery(table: TableName, projectId: string) {
  validateProjectId(projectId)
  return supabase.from(table as any).eq('project_id', projectId)
}
