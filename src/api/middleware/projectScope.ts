import { ApiError, AuthError, ValidationError } from '../errors'
import { supabase } from '../../lib/supabase'
import { dedupTtl, queryKey } from '../../lib/requestDedup'
import { useOrganizationStore } from '../../stores/organizationStore'
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
  try {
    // Deduplicated project membership check (TTL 1s to minimise stale-access window)
    const key = queryKey('project_members', { project_id: projectId, user_id: user.id })
    const memberData = await dedupTtl(key, 1000, () =>
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

    // Cross-org isolation: verify the project belongs to the caller's active org
    const currentOrg = useOrganizationStore.getState().currentOrg
    if (!currentOrg) {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }
    const { data: projectData } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .maybeSingle()
    const orgId = (projectData as { organization_id: string } | null)?.organization_id
    if (orgId !== currentOrg.id) {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }
  } catch (err) {
    if (err instanceof ApiError || err instanceof AuthError || err instanceof ValidationError) {
      throw err
    }
    if (err instanceof Error && err.message.includes('permission')) throw new ApiError('Access denied', 403, 'FORBIDDEN')
    throw new ApiError('Unable to verify project access. Please try again.', 503, 'SERVICE_UNAVAILABLE')
  }
}

export async function assertProjectAccessNoCache(projectId: string): Promise<void> {
  validateProjectId(projectId)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new AuthError('Not authenticated')
  }
  try {
    const { data: memberData } = await supabase
      .from('project_members')
      .select('id, project:projects(organization_id)')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!memberData) {
      throw new ApiError('You do not have access to this project', 403, 'FORBIDDEN')
    }
    const orgId = (memberData as { id: string; project: { organization_id: string } | null }).project?.organization_id
    if (!orgId) {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!orgMember) {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }
  } catch (err) {
    if (err instanceof ApiError || err instanceof AuthError || err instanceof ValidationError) {
      throw err
    }
    if (err instanceof Error && err.message.includes('permission')) throw new ApiError('Access denied', 403, 'FORBIDDEN')
    throw new ApiError('Unable to verify project access. Please try again.', 503, 'SERVICE_UNAVAILABLE')
  }
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
    throw new ApiError('Project does not belong to this organization', 403, 'FORBIDDEN')
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
