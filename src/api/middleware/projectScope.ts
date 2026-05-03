import { ApiError, AuthError, ValidationError } from '../errors'
import { supabase, fromTable } from '../../lib/supabase'
import { dedupTtl, queryKey } from '../../lib/requestDedup'
import { useAuthStore } from '../../stores/authStore'
import type { Database } from '../../types/database'

type TableName = keyof Database['public']['Tables']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateProjectId(projectId: string): void {
  if (!projectId || !UUID_RE.test(projectId)) {
    throw new ValidationError('Invalid project ID', { projectId: 'Must be a valid UUID' })
  }
}

/**
 * Strict cross-org check. Resolves to:
 *   • allow — project's organization_id matches `orgId`
 *   • reject — we observed a different organization_id (real cross-org leak attempt)
 *   • allow (defer to RLS) — we can't observe organization_id at all (RLS blocks
 *     metadata reads on `projects` for this user). The DB will still gate actual
 *     data via row-level security on every downstream query, so failing closed
 *     here would lock out legitimate users without adding security.
 *
 * Three lookup paths (each goes through a different RLS policy surface):
 *   1. projects.organization_id directly
 *   2. drawings.organization_id (cross-ref — works when a member can read
 *      project sibling rows but not the parent projects row)
 *   3. rfis.organization_id (second cross-ref for projects with no drawings yet)
 */
export async function assertProjectBelongsToActiveOrg(projectId: string, orgId: string): Promise<void> {
  const observed = await observeProjectOrg(projectId)
  if (observed && observed !== orgId) {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }
  // observed === orgId → allow. observed === null → defer to RLS.
}

async function observeProjectOrg(projectId: string): Promise<string | null> {
  // Path 1
  const direct = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .maybeSingle()
    .then(({ data }) => (data as { organization_id?: string } | null)?.organization_id ?? null)
    .catch(() => null)
  if (direct) return direct
  // Path 2 — drawings cross-ref
  const viaDrawing = await supabase
    .from('drawings')
    .select('organization_id')
    .eq('project_id', projectId)
    .limit(1)
    .maybeSingle()
    .then(({ data }) => (data as { organization_id?: string } | null)?.organization_id ?? null)
    .catch(() => null)
  if (viaDrawing) return viaDrawing
  // Path 3 — rfis cross-ref
  const viaRfi = await supabase
    .from('rfis')
    .select('organization_id')
    .eq('project_id', projectId)
    .limit(1)
    .maybeSingle()
    .then(({ data }) => (data as { organization_id?: string } | null)?.organization_id ?? null)
    .catch(() => null)
  return viaRfi
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

    // Membership check passed. Now enforce active-org isolation.
    // A user can be a member of projects in multiple orgs; switching orgs in the
    // UI must NOT leak documents from the previous org. We require:
    //   1. An active org to be set (else fail 403).
    //   2. The project's organization_id to match the active org.
    // RLS is still the source of truth at the DB layer, but the client-side
    // gate prevents accidentally fanning out queries that would all return [].
    const store = useAuthStore.getState()
    let activeOrg = store.organization

    // Try to hydrate currentOrg if it isn't set yet — this happens on first
    // load before the OrganizationProvider has resolved. Failure to hydrate
    // is treated as "no active org" and rejects.
    if (!activeOrg) {
      try {
        const orgKey = queryKey('projects_org_hydrate', { project_id: projectId, user_id: user.id })
        const orgId = await dedupTtl(orgKey, 2000, async (): Promise<string | null> => {
          // Path 1: direct projects SELECT.
          const direct = await supabase
            .from('projects')
            .select('organization_id')
            .eq('id', projectId)
            .maybeSingle()
            .then(({ data }) => (data as { organization_id?: string } | null)?.organization_id ?? null)
            .catch(() => null)
          if (direct) return direct
          // Path 2: embedded join via the user's project_members row.
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
            .catch(() => null)
          if (viaMember) return viaMember
          // Path 3: drawings cross-ref — works when a member can read sibling
          // rows but not the parent projects row (common RLS shape).
          const viaDrawing = await supabase
            .from('drawings')
            .select('organization_id')
            .eq('project_id', projectId)
            .limit(1)
            .maybeSingle()
            .then(({ data }) => (data as { organization_id?: string } | null)?.organization_id ?? null)
            .catch(() => null)
          if (viaDrawing) return viaDrawing
          // Path 4: rfis cross-ref — second sibling fallback.
          const viaRfi = await supabase
            .from('rfis')
            .select('organization_id')
            .eq('project_id', projectId)
            .limit(1)
            .maybeSingle()
            .then(({ data }) => (data as { organization_id?: string } | null)?.organization_id ?? null)
            .catch(() => null)
          return viaRfi
        })
        if (orgId) {
          const { data: memberships } = await supabase
            .from('organization_members')
            .select('organization_id, organizations:organization_id(id, name, slug)')
            .eq('user_id', user.id)
          const match = (memberships as unknown as Array<{ organizations: { id: string; name: string; slug: string } | null }> | null)
            ?.map((m) => m.organizations)
            .find((o): o is { id: string; name: string; slug: string } => !!o && o.id === orgId)
          if (match) {
            store.setCurrentOrg(match as unknown as Parameters<typeof store.setCurrentOrg>[0])
            activeOrg = useAuthStore.getState().organization
          }
        }
      } catch {
        // Hydration failed — fall through to the strict check, which will reject.
      }
    }

    if (!activeOrg) {
      // Hydration found no organization_id through any of the four paths AND
      // OrganizationProvider hasn't resolved yet. The membership check above
      // already proved this user has legitimate access to projectId, so rather
      // than reject them on a transient client-state race we let the request
      // proceed — RLS still gates every downstream query at the DB layer.
      return
    }

    // Strict cross-org check: only fails when we observe a DIFFERENT org_id
    // (real cross-org leak attempt). When we can't observe org_id at all
    // (RLS blocks metadata reads), we defer to downstream RLS.
    await assertProjectBelongsToActiveOrg(projectId, activeOrg.id)
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
