import { supabase } from '../client'
import { transformSupabaseError, PermissionError } from '../errors'
import type { ProjectMember, ProjectRole } from '../../types/tenant'
import { ROLE_HIERARCHY } from '../../types/tenant'
import type { ProjectMemberRow } from '../../types/api'

export interface MemberForMention {
  userId: string
  name: string
  role: string
  initials: string
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function deriveInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || (name.trim()[0]?.toUpperCase() ?? 'U')
  )
}

export async function getProjectMembersForMention(projectId: string): Promise<MemberForMention[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('user_id, role, company')
    .eq('project_id', projectId)
    .order('role', { ascending: true })

  if (error) throw transformSupabaseError(error)

  return (data ?? []).map((row) => {
    const displayName = row.company || formatRole(row.role)
    return {
      userId: row.user_id,
      name: displayName,
      role: formatRole(row.role),
      initials: deriveInitials(displayName),
    }
  })
}

function rowToMember(row: ProjectMemberRow): ProjectMember {
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    role: row.role as ProjectRole,
    permissions: (row.permissions ?? {}) as Record<string, boolean>,
    created_at: row.created_at ?? undefined,
  }
}

// Throws 403 if the caller's role is not strictly higher than the target role
export function assertCanAssignRole(callerRole: ProjectRole, targetRole: ProjectRole): void {
  if (ROLE_HIERARCHY[callerRole] <= ROLE_HIERARCHY[targetRole]) {
    throw new PermissionError(
      `Role '${callerRole}' cannot assign role '${targetRole}': insufficient privilege level`,
    )
  }
}

// Fetch all members of a project with their roles and permissions
export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw transformSupabaseError(error)
  return (data ?? []).map(rowToMember)
}

// Add a user to a project with a given role
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole,
  permissions: Record<string, boolean> = {},
): Promise<ProjectMember> {
  const callerRole = await getMyProjectRole(projectId)
  assertCanAssignRole(callerRole ?? 'viewer', role)

  const { data, error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role, permissions })
    .select()
    .single()

  if (error) throw transformSupabaseError(error)
  return rowToMember(data)
}

// Update a project member's role or permissions
export async function updateProjectMember(
  memberId: string,
  updates: { role?: ProjectRole; permissions?: Record<string, boolean> },
): Promise<ProjectMember> {
  const { data: memberRow, error: fetchError } = await supabase
    .from('project_members')
    .select('project_id, role')
    .eq('id', memberId)
    .single()

  if (fetchError || !memberRow) throw transformSupabaseError(fetchError ?? { message: 'Member not found' })

  if (updates.role !== undefined) {
    const callerRole = await getMyProjectRole(memberRow.project_id)
    const effective = callerRole ?? 'viewer'
    // Caller must outrank the target's current role (prevents demoting higher-ranked members)
    assertCanAssignRole(effective, memberRow.role as ProjectRole)
    // Caller must also outrank the new role being assigned
    assertCanAssignRole(effective, updates.role)
  }

  const { data, error } = await supabase
    .from('project_members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single()

  if (error) throw transformSupabaseError(error)
  return rowToMember(data)
}

// Remove a user from a project (requires project_manager level or above)
export async function removeProjectMember(memberId: string): Promise<void> {
  const { data: memberRow, error: fetchError } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('id', memberId)
    .single()

  if (fetchError || !memberRow) throw transformSupabaseError(fetchError ?? { message: 'Member not found' })

  const callerRole = await getMyProjectRole(memberRow.project_id)
  const effective = callerRole ?? 'viewer'
  if (ROLE_HIERARCHY[effective] < ROLE_HIERARCHY['project_manager']) {
    throw new PermissionError('Only project managers and above can remove project members')
  }

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)

  if (error) throw transformSupabaseError(error)
}

// Get the current user's role on a specific project
export async function getMyProjectRole(projectId: string): Promise<ProjectRole | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getCallerProjectRole(projectId, user.id)
}

// Get a specific user's role on a project (used for server-side privilege checks)
export async function getCallerProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const { data, error } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data.role as ProjectRole
}
