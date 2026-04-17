import { supabase } from '../lib/supabase';
import type { OrgRole, ProjectRole } from '../types/tenant';
import type { Database } from '../types/database';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  conflictError,
} from './errors';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Resolve the user's authoritative org role from the database.
 * Does NOT trust caller-supplied role values.
 */
async function resolveOrgRole(
  organizationId: string,
  userId: string | null,
): Promise<OrgRole | null> {
  if (!userId) return null;

  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single();

  return (data?.role as OrgRole) ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

type OrgMemberRow = Database['public']['Tables']['organization_members']['Row'];
type PortalInvitationRow = Database['public']['Tables']['portal_invitations']['Row'];

export type TeamMember = OrgMemberRow & {
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    company: string | null;
    role: string | null;
  } | null;
};

export type TeamInvitation = PortalInvitationRow;

export type CreateInvitationInput = {
  project_id: string;
  email: string;
  name?: string;
  company?: string;
  portal_type: string;
  role?: ProjectRole;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const teamService = {
  /**
   * Load all members of an organization with their profiles.
   * Requires the caller to be an org member (server-resolved).
   */
  async loadTeamMembers(organizationId: string): Promise<Result<TeamMember[]>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const role = await resolveOrgRole(organizationId, userId);
    if (!role) return fail(permissionError('User is not a member of this organization'));

    const { data, error } = await supabase
      .from('organization_members')
      .select('*, profile:profiles(full_name, avatar_url, company, role)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) return fail(dbError(error.message, { organizationId }));
    return ok((data ?? []) as unknown as TeamMember[]);
  },

  /**
   * Add a user to an organization. Only org admins and owners may do this.
   * IMPORTANT: Caller's role is resolved from the database, never trusted from input.
   */
  async addTeamMember(
    organizationId: string,
    userId: string,
    role: OrgRole,
  ): Promise<Result<OrgMemberRow>> {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return fail(permissionError('Not authenticated'));

    const callerRole = await resolveOrgRole(organizationId, currentUserId);
    if (!callerRole || callerRole === 'member') {
      return fail(permissionError('Only org admins and owners can add members'));
    }

    // Owners cannot be added programmatically (set only on org creation)
    if (role === 'owner') {
      return fail(permissionError('Cannot assign owner role through this endpoint'));
    }

    // Check for existing membership
    const { data: existing } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return fail(conflictError('User is already a member of this organization', { userId, organizationId }));
    }

    const { data, error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        role,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { organizationId, userId }));
    return ok(data as OrgMemberRow);
  },

  /**
   * Update a team member's role. Only org admins and owners may do this.
   * IMPORTANT: Caller's role is resolved from the database.
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    newRole: OrgRole,
  ): Promise<Result> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const callerRole = await resolveOrgRole(organizationId, userId);
    if (!callerRole || callerRole === 'member') {
      return fail(permissionError('Only org admins and owners can change member roles'));
    }

    if (newRole === 'owner') {
      return fail(permissionError('Cannot assign owner role through this endpoint'));
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('id, role')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (!member) return fail(notFoundError('TeamMember', memberId));

    if (member.role === 'owner') {
      return fail(permissionError('Cannot change the role of an org owner'));
    }

    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) return fail(dbError(error.message, { memberId }));
    return { data: null, error: null };
  },

  /**
   * Remove a member from an organization. Only admins/owners may do this.
   * Owners cannot be removed via this endpoint.
   */
  async removeTeamMember(
    organizationId: string,
    memberId: string,
  ): Promise<Result> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const callerRole = await resolveOrgRole(organizationId, userId);
    if (!callerRole || callerRole === 'member') {
      return fail(permissionError('Only org admins and owners can remove members'));
    }

    const { data: member } = await supabase
      .from('organization_members')
      .select('id, role, user_id')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (!member) return fail(notFoundError('TeamMember', memberId));

    if (member.role === 'owner') {
      return fail(permissionError('Cannot remove an org owner'));
    }

    // Members may remove themselves
    if (callerRole === 'admin' && member.user_id !== userId) {
      // Admins can remove other members (non-owners)
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    if (error) return fail(dbError(error.message, { memberId }));
    return { data: null, error: null };
  },

  /**
   * Load all pending invitations for a project.
   */
  async loadInvitations(projectId: string): Promise<Result<TeamInvitation[]>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const { data, error } = await supabase
      .from('portal_invitations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as TeamInvitation[]);
  },

  /**
   * Create an invitation for external project access.
   *
   * IMPORTANT: invited_by is resolved from the session — never trust client input.
   */
  async createInvitation(input: CreateInvitationInput): Promise<Result<TeamInvitation>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    // Prevent duplicate invitations for the same email + project
    const { data: existing } = await supabase
      .from('portal_invitations')
      .select('id, accepted')
      .eq('project_id', input.project_id)
      .eq('email', input.email)
      .single();

    if (existing && !existing.accepted) {
      return fail(conflictError('An active invitation already exists for this email', {
        email: input.email,
        project_id: input.project_id,
      }));
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('portal_invitations')
      .insert({
        project_id: input.project_id,
        email: input.email,
        name: input.name ?? null,
        company: input.company ?? null,
        portal_type: input.portal_type,
        invited_by: userId,
        expires_at: expiresAt,
        accepted: false,
        permissions: input.role ? { role: input.role } : null,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { email: input.email, project_id: input.project_id }));
    return ok(data as TeamInvitation);
  },

  /**
   * Accept an invitation by token. Marks it as accepted with the current timestamp.
   */
  async acceptInvitation(token: string): Promise<Result<TeamInvitation>> {
    const { data, error } = await supabase
      .from('portal_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !data) return fail(notFoundError('Invitation', token));

    const invitation = data as TeamInvitation;

    if (invitation.accepted) {
      return fail(conflictError('This invitation has already been accepted', { token }));
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return fail(permissionError('This invitation has expired'));
    }

    const { error: updateError } = await supabase
      .from('portal_invitations')
      .update({
        accepted: true,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) return fail(dbError(updateError.message, { token }));
    return ok({ ...invitation, accepted: true, accepted_at: new Date().toISOString() });
  },

  /**
   * Revoke an invitation. Only the person who sent it (or an admin) can revoke.
   */
  async revokeInvitation(invitationId: string): Promise<Result> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const { data: invitation } = await supabase
      .from('portal_invitations')
      .select('id, invited_by, accepted')
      .eq('id', invitationId)
      .single();

    if (!invitation) return fail(notFoundError('Invitation', invitationId));

    if (invitation.accepted) {
      return fail(conflictError('Cannot revoke an accepted invitation', { invitationId }));
    }

    if (invitation.invited_by !== userId) {
      return fail(permissionError('Only the inviter can revoke this invitation'));
    }

    const { error } = await supabase
      .from('portal_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) return fail(dbError(error.message, { invitationId }));
    return { data: null, error: null };
  },

  /**
   * Get the server-resolved org role for the current user.
   */
  async getMyOrgRole(organizationId: string): Promise<Result<OrgRole | null>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const role = await resolveOrgRole(organizationId, userId);
    return ok(role);
  },
};
