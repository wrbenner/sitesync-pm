import { ApiError, AuthError, ValidationError } from '../errors'
import { supabase, fromTable } from '../../lib/supabase'
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
      // Self-heal: if the user is the project owner but has no project_members row,
      // auto-create it. Covers projects created before the auto-add logic existed.
      const { data: ownerRow } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .maybeSingle()
      if (ownerRow && (ownerRow as { owner_id: string | null }).owner_id === user.id) {
        await supabase.from('project_members').insert({
          project_id: projectId,
          user_id: user.id,
          role: 'project_manager',
          accepted_at: new Date().toISOString(),
        })
        // Continue — membership now exists.
      } else {
        throw new ApiError('You do not have access to this project', 403, 'FORBIDDEN')
      }
    }

    // Access is established — the user has a verified project_members row above.
    // Everything below is best-effort client-side org-context hydration; it NEVER throws
    // because the DB's RLS is the real source of truth and we don't want client-side
    // state drift to block legitimate users.
    //
    // Strategy: try a few paths to resolve the project's org. If any works, sync
    // `currentOrg` when it's missing or stale. If none works (RLS blocks every path),
    // leave currentOrg alone and proceed — every downstream query will still be
    // RLS-filtered server-side.
    try {
      const orgKey = queryKey('projects_org_any', { project_id: projectId, user_id: user.id })
      const orgId = await dedupTtl(orgKey, 2000, async (): Promise<string | null> => {
        // Path 1: direct SELECT on projects (works if projects RLS allows project members).
        const direct = await supabase
          .from('projects')
          .select('organization_id')
          .eq('id', projectId)
          .maybeSingle()
          .then(({ data }) => (data as { organization_id?: string } | null)?.organization_id ?? null)
        if (direct) return direct
        // Path 2: embedded join through the user's own project_members row.
        const viaMember = await supabase
          .from('project_members')
          .select('project:projects(organization_id)')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            const row = data as unknown as { project?: { organization_id?: string } | null } | null
            return row?.project?.organization_id ?? null
          })
        if (viaMember) return viaMember
        // Path 3: cross-reference drawings (a member can often read sibling rows even
        // when the projects row itself is blocked by a narrower policy).
        const viaDrawing = await supabase
          .from('drawings')
          .select('organization_id')
          .eq('project_id', projectId)
          .limit(1)
          .maybeSingle()
          .then(({ data }) => (data as { organization_id?: string } | null)?.organization_id ?? null)
        return viaDrawing
      })

      const store = useOrganizationStore.getState()
      const activeOrg = store.currentOrg
      if (orgId && (!activeOrg || activeOrg.id !== orgId)) {
        // Fetch an Organization object from the user's memberships to hydrate the store.
        const { data: memberships } = await supabase
          .from('organization_members')
          .select('organization_id, organizations:organization_id(id, name, slug)')
          .eq('user_id', user.id)
        const match = (memberships as unknown as Array<{ organizations: { id: string; name: string; slug: string } | null }> | null)
          ?.map((m) => m.organizations)
          .find((o): o is { id: string; name: string; slug: string } => !!o && o.id === orgId)
        if (match) {
          store.setCurrentOrg(match as unknown as Parameters<typeof store.setCurrentOrg>[0])
        }
      }
    } catch {
      // Silent — this path is purely for client-side context hydration. RLS enforces the real rules.
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
  return fromTable(table).select('*').eq('project_id', projectId)
}
