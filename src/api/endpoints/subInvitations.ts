import { supabase } from '../client'
import { transformSupabaseError } from '../errors'
import type { ProjectRole } from '../../types/tenant'

// ── Types ────────────────────────────────────────────────

export interface SubInvitation {
  id: string
  project_id: string
  email: string
  company_name: string
  role: ProjectRole
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  invited_by: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface CreateInvitationInput {
  projectId: string
  email: string
  companyName: string
  role: ProjectRole
  tradeScopes?: string[]
}

// ── API Functions ────────────────────────────────────────

/**
 * Create a project invitation for a subcontractor or external collaborator.
 * Generates a unique token for magic link access.
 */
export async function createProjectInvitation(
  input: CreateInvitationInput
): Promise<SubInvitation> {
  // Generate a secure token for the magic link
  const token = crypto.randomUUID() + '-' + crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('portal_invitations')
    .insert({
      project_id: input.projectId,
      portal_type: input.role === 'subcontractor' ? 'subcontractor' : input.role === 'architect' ? 'architect' : 'subcontractor',
      email: input.email.toLowerCase().trim(),
      token,
      expires_at: expiresAt,
      accepted: false,
      permissions: {
        company_name: input.companyName,
        role: input.role,
        trade_scopes: input.tradeScopes ?? [],
      },
    })
    .select()
    .single()

  if (error) throw transformSupabaseError(error)

  return mapInvitation(data)
}

/**
 * List all pending and recent invitations for a project.
 */
export async function getProjectInvitations(projectId: string): Promise<SubInvitation[]> {
  const { data, error } = await supabase
    .from('portal_invitations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return (data ?? []).map(mapInvitation)
}

/**
 * Accept an invitation using its token. Creates a project_members record
 * linking the authenticated user to the project with the invited role.
 */
export async function acceptInvitation(token: string): Promise<{
  projectId: string
  projectName: string
  role: ProjectRole
}> {
  // 1. Validate token
  const { data: invitation, error: fetchError } = await supabase
    .from('portal_invitations')
    .select('*, projects!inner(id, name)')
    .eq('token', token)
    .single()

  if (fetchError || !invitation) {
    throw new Error('Invalid or expired invitation link')
  }

  if (invitation.accepted) {
    throw new Error('This invitation has already been accepted')
  }

  if (new Date(invitation.expires_at) < new Date()) {
    throw new Error('This invitation has expired. Ask the project manager to send a new one.')
  }

  // 2. Get current user
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Please sign in or create an account to accept this invitation')

  const permissions = (invitation.permissions ?? {}) as Record<string, unknown>
  const role = (permissions.role as ProjectRole) ?? 'subcontractor'
  const companyName = (permissions.company_name as string) ?? ''

  // 3. Add user as project member
  const { error: memberError } = await supabase
    .from('project_members')
    .upsert({
      project_id: invitation.project_id,
      user_id: user.user.id,
      role,
      company: companyName,
      permissions: {},
    }, {
      onConflict: 'project_id,user_id',
    })

  if (memberError) throw transformSupabaseError(memberError)

  // 4. Mark invitation as accepted
  await supabase
    .from('portal_invitations')
    .update({
      accepted: true,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id)

  const project = invitation.projects as { id: string; name: string }

  return {
    projectId: project.id,
    projectName: project.name,
    role,
  }
}

/**
 * Resend an invitation (generates new token and extends expiry).
 */
export async function resendInvitation(invitationId: string): Promise<void> {
  const newToken = crypto.randomUUID() + '-' + crypto.randomUUID()
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('portal_invitations')
    .update({
      token: newToken,
      expires_at: newExpiry,
    })
    .eq('id', invitationId)
    .eq('accepted', false)

  if (error) throw transformSupabaseError(error)
}

/**
 * Revoke a pending invitation.
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('portal_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('accepted', false)

  if (error) throw transformSupabaseError(error)
}

/**
 * Get all projects the current user is a member of (cross-GC view for subs).
 */
export async function getMyProjects(): Promise<Array<{
  projectId: string
  projectName: string
  role: ProjectRole
  company: string
  joinedAt: string
}>> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('project_members')
    .select('project_id, role, company, created_at, projects!inner(id, name)')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)

  return (data ?? []).map((row) => {
    const project = row.projects as { id: string; name: string }
    return {
      projectId: project.id,
      projectName: project.name,
      role: row.role as ProjectRole,
      company: row.company ?? '',
      joinedAt: row.created_at ?? '',
    }
  })
}

// ── Helpers ──────────────────────────────────────────────

function mapInvitation(row: Record<string, unknown>): SubInvitation {
  const permissions = (row.permissions ?? {}) as Record<string, unknown>
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    email: row.email as string,
    company_name: (permissions.company_name as string) ?? '',
    role: (permissions.role as ProjectRole) ?? 'subcontractor',
    token: row.token as string,
    status: row.accepted ? 'accepted' : new Date(row.expires_at as string) < new Date() ? 'expired' : 'pending',
    invited_by: (row.invited_by ?? row.created_by ?? '') as string,
    expires_at: row.expires_at as string,
    accepted_at: (row.accepted_at ?? null) as string | null,
    created_at: row.created_at as string,
  }
}
