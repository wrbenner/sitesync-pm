import { supabase } from '../client'
import { transformSupabaseError } from '../errors'
import type { ProjectMember, ProjectRole } from '../../types/tenant'

// Fetch all members of a project with their roles and permissions
export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw transformSupabaseError(error)
  return (data ?? []) as unknown as ProjectMember[]
}

// Add a user to a project with a given role
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole,
  permissions: Record<string, boolean> = {},
): Promise<ProjectMember> {
  const { data, error } = await (supabase
    .from('project_members') as any)
    .insert({ project_id: projectId, user_id: userId, role, permissions })
    .select()
    .single()

  if (error) throw transformSupabaseError(error)
  return data as ProjectMember
}

// Update a project member's role or permissions
export async function updateProjectMember(
  memberId: string,
  updates: { role?: ProjectRole; permissions?: Record<string, boolean> },
): Promise<ProjectMember> {
  const { data, error } = await (supabase
    .from('project_members') as any)
    .update(updates)
    .eq('id', memberId)
    .select()
    .single()

  if (error) throw transformSupabaseError(error)
  return data as ProjectMember
}

// Remove a user from a project
export async function removeProjectMember(memberId: string): Promise<void> {
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

  const { data, error } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return data.role as ProjectRole
}
