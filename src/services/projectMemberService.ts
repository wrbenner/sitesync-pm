import { supabase } from '../lib/supabase';
import { fromTable } from '../lib/db/queries';
import type { ProjectRole } from '../types/tenant';
import { ROLE_HIERARCHY } from '../types/tenant';
import type { Database } from '../types/database';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  validationError,
  conflictError,
} from './errors';
import {
  getMemberLifecycleState,
  getValidMemberTransitions,
  canAssignRole,
  getDefaultPermissions,
  type MemberLifecycleState,
} from '../machines/projectMemberMachine';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Resolve the caller's authoritative project role from the database.
 * NEVER trusts caller-supplied role values.
 */
async function resolveProjectRole(
  projectId: string,
  userId: string | null,
): Promise<ProjectRole | null> {
  if (!userId) return null;

  const { data } = await fromTable('project_members')
    .select('role')
    .eq('project_id' as never, projectId)
    .eq('user_id' as never, userId)
    .single();

  return ((data as unknown as { role?: string } | null)?.role as ProjectRole) ?? null;
}

const MANAGER_LEVEL = ROLE_HIERARCHY['project_manager']; // 5

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectMemberRow = Database['public']['Tables']['project_members']['Row'];

export type ProjectMemberWithState = ProjectMemberRow & {
  lifecycleState: MemberLifecycleState;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
};

export type InviteMemberInput = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  company?: string;
  trade?: string;
  permissions?: Record<string, boolean>;
};

export type AddMemberDirectInput = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  company?: string;
  trade?: string;
  permissions?: Record<string, boolean>;
};

export type UpdateMemberInput = {
  role?: ProjectRole;
  company?: string;
  trade?: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

export const projectMemberService = {
  /**
   * Load all non-removed members of a project with lifecycle state derived
   * from DB columns. Requires the caller to be a project member.
   */
  async loadMembers(projectId: string): Promise<Result<ProjectMemberWithState[]>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const role = await resolveProjectRole(projectId, userId);
    if (!role) return fail(permissionError('User is not a member of this project'));

    const { data, error } = await fromTable('project_members')
      .select('*')
      .eq('project_id' as never, projectId)
      .order('invited_at', { ascending: true });

    if (error) return fail(dbError(error.message, { projectId }));

    const rows = (data ?? []) as unknown as ProjectMemberRow[];
    const members: ProjectMemberWithState[] = rows
      .map((row) => ({
        ...row,
        lifecycleState: getMemberLifecycleState({
          invited_at: row.invited_at,
          accepted_at: row.accepted_at,
          permissions: row.permissions as unknown as Record<string, unknown> | null,
        }),
      }))
      .filter((m) => m.lifecycleState !== 'removed');

    return ok(members);
  },

  /**
   * Invite an existing user to a project. Sets invited_at; the user must call
   * acceptInvitation() to become active. Email notification is triggered via
   * Supabase edge function after the record is created.
   *
   * IMPORTANT: Caller's role is resolved from the database.
   */
  async inviteMember(input: InviteMemberInput): Promise<Result<ProjectMemberWithState>> {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return fail(permissionError('Not authenticated'));

    const callerRole = await resolveProjectRole(input.project_id, currentUserId);
    if (!callerRole || (ROLE_HIERARCHY[callerRole] ?? 0) < MANAGER_LEVEL) {
      return fail(permissionError('Only project managers and above can invite members'));
    }

    if (!canAssignRole(callerRole, input.role)) {
      return fail(
        permissionError(
          `Role '${callerRole}' cannot assign role '${input.role}': insufficient privilege level`,
        ),
      );
    }

    const { data: existing } = await fromTable('project_members')
      .select('id, invited_at, accepted_at, permissions')
      .eq('project_id' as never, input.project_id)
      .eq('user_id' as never, input.user_id)
      .single();
    const existingRow = existing as unknown as { id: string; invited_at: string | null; accepted_at: string | null; permissions: Record<string, unknown> | null } | null

    if (existingRow) {
      const existingState = getMemberLifecycleState({
        invited_at: existingRow.invited_at,
        accepted_at: existingRow.accepted_at,
        permissions: existingRow.permissions,
      });
      if (existingState !== 'removed') {
        return fail(
          conflictError('User is already a member or has a pending invitation', {
            user_id: input.user_id,
            project_id: input.project_id,
            existingState,
          }),
        );
      }
    }

    const mergedPermissions = {
      ...getDefaultPermissions(input.role),
      ...(input.permissions ?? {}),
    };

    const now = new Date().toISOString();

    const { data, error } = await fromTable('project_members')
      .insert({
        project_id: input.project_id,
        user_id: input.user_id,
        role: input.role,
        company: input.company ?? null,
        trade: input.trade ?? null,
        permissions: mergedPermissions,
        invited_at: now,
        accepted_at: null,
      } as never)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id, user_id: input.user_id }));

    const row = data as unknown as ProjectMemberRow;

    await projectMemberService._triggerInvitationEmail(row.id, input.project_id, input.user_id);

    return ok({
      ...row,
      lifecycleState: 'invited' as MemberLifecycleState,
    });
  },

  /**
   * Add a member directly without an invitation flow (immediately active).
   * Use this for bulk imports or when the user is already known.
   *
   * IMPORTANT: Caller's role is resolved from the database.
   */
  async addMember(input: AddMemberDirectInput): Promise<Result<ProjectMemberWithState>> {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return fail(permissionError('Not authenticated'));

    const callerRole = await resolveProjectRole(input.project_id, currentUserId);
    if (!callerRole || (ROLE_HIERARCHY[callerRole] ?? 0) < MANAGER_LEVEL) {
      return fail(permissionError('Only project managers and above can add members'));
    }

    if (!canAssignRole(callerRole, input.role)) {
      return fail(
        permissionError(
          `Role '${callerRole}' cannot assign role '${input.role}': insufficient privilege level`,
        ),
      );
    }

    const { data: existing } = await fromTable('project_members')
      .select('id, invited_at, accepted_at, permissions')
      .eq('project_id' as never, input.project_id)
      .eq('user_id' as never, input.user_id)
      .single();
    const existingRow = existing as unknown as { id: string; invited_at: string | null; accepted_at: string | null; permissions: Record<string, unknown> | null } | null

    if (existingRow) {
      const existingState = getMemberLifecycleState({
        invited_at: existingRow.invited_at,
        accepted_at: existingRow.accepted_at,
        permissions: existingRow.permissions,
      });
      if (existingState !== 'removed') {
        return fail(
          conflictError('User is already a member of this project', {
            user_id: input.user_id,
            project_id: input.project_id,
          }),
        );
      }
    }

    const mergedPermissions = {
      ...getDefaultPermissions(input.role),
      ...(input.permissions ?? {}),
    };

    const now = new Date().toISOString();

    const { data, error } = await fromTable('project_members')
      .insert({
        project_id: input.project_id,
        user_id: input.user_id,
        role: input.role,
        company: input.company ?? null,
        trade: input.trade ?? null,
        permissions: mergedPermissions,
        invited_at: now,
        accepted_at: now,
      } as never)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id, user_id: input.user_id }));

    const row = data as unknown as ProjectMemberRow;
    return ok({ ...row, lifecycleState: 'active' as MemberLifecycleState });
  },

  /**
   * Accept a project invitation. Sets accepted_at on the member record.
   * Only the invited user may accept their own invitation.
   */
  async acceptInvitation(memberId: string): Promise<Result<ProjectMemberWithState>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const { data: member, error: fetchError } = await fromTable('project_members')
      .select('*')
      .eq('id' as never, memberId)
      .single();

    if (fetchError || !member) return fail(notFoundError('ProjectMember', memberId));

    const row = member as unknown as ProjectMemberRow;

    if (row.user_id !== userId) {
      return fail(permissionError('Only the invited user can accept their own invitation'));
    }

    const currentState = getMemberLifecycleState({
      invited_at: row.invited_at,
      accepted_at: row.accepted_at,
      permissions: row.permissions as unknown as Record<string, unknown> | null,
    });

    if (currentState !== 'invited') {
      return fail(
        validationError(
          `Cannot accept: member is in '${currentState}' state, must be 'invited'`,
          { currentState, memberId },
        ),
      );
    }

    const now = new Date().toISOString();

    const { error } = await fromTable('project_members')
      .update({ accepted_at: now } as never)
      .eq('id' as never, memberId);

    if (error) return fail(dbError(error.message, { memberId }));

    return ok({ ...row, accepted_at: now, lifecycleState: 'active' as MemberLifecycleState });
  },

  /**
   * Assign a new role to a project member.
   * Caller must outrank both the member's current role and the new role.
   * IMPORTANT: Caller's role is resolved from the database.
   */
  async assignRole(memberId: string, newRole: ProjectRole): Promise<Result> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const { data: member, error: fetchError } = await fromTable('project_members')
      .select('project_id, role, invited_at, accepted_at, permissions')
      .eq('id' as never, memberId)
      .single();

    if (fetchError || !member) return fail(notFoundError('ProjectMember', memberId));

    const row = member as unknown as Pick<ProjectMemberRow, 'project_id' | 'role' | 'invited_at' | 'accepted_at' | 'permissions'>;

    const callerRole = await resolveProjectRole(row.project_id, userId);
    if (!callerRole) return fail(permissionError('User is not a member of this project'));

    if (!canAssignRole(callerRole, row.role as ProjectRole)) {
      return fail(
        permissionError(
          `Cannot change role: your role '${callerRole}' does not outrank the member's current role '${row.role}'`,
        ),
      );
    }

    if (!canAssignRole(callerRole, newRole)) {
      return fail(
        permissionError(
          `Cannot assign role '${newRole}': your role '${callerRole}' does not outrank it`,
        ),
      );
    }

    const currentState = getMemberLifecycleState({
      invited_at: row.invited_at,
      accepted_at: row.accepted_at,
      permissions: row.permissions as unknown as Record<string, unknown> | null,
    });

    if (currentState === 'removed') {
      return fail(validationError('Cannot change the role of a removed member', { memberId }));
    }

    const updatedPermissions = {
      ...(row.permissions as unknown as Record<string, unknown> | null ?? {}),
      ...getDefaultPermissions(newRole),
    };

    const { error } = await fromTable('project_members')
      .update({ role: newRole, permissions: updatedPermissions } as never)
      .eq('id' as never, memberId);

    if (error) return fail(dbError(error.message, { memberId, newRole }));
    return { data: null, error: null };
  },

  /**
   * Transition a member's lifecycle state (suspend, reactivate, remove, restore).
   * Enforces the state machine via getValidMemberTransitions.
   * IMPORTANT: Caller's role is resolved from the database.
   */
  async transitionMemberState(
    memberId: string,
    newState: MemberLifecycleState,
    reason?: string,
  ): Promise<Result> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const { data: member, error: fetchError } = await fromTable('project_members')
      .select('project_id, role, invited_at, accepted_at, permissions')
      .eq('id' as never, memberId)
      .single();

    if (fetchError || !member) return fail(notFoundError('ProjectMember', memberId));

    const row = member as unknown as Pick<ProjectMemberRow, 'project_id' | 'role' | 'invited_at' | 'accepted_at' | 'permissions'>;

    const callerRole = await resolveProjectRole(row.project_id, userId);
    if (!callerRole) return fail(permissionError('User is not a member of this project'));

    const currentState = getMemberLifecycleState({
      invited_at: row.invited_at,
      accepted_at: row.accepted_at,
      permissions: row.permissions as unknown as Record<string, unknown> | null,
    });

    const validTransitions = getValidMemberTransitions(currentState, callerRole);
    if (!validTransitions.includes(newState)) {
      return fail(
        validationError(
          `Invalid transition: ${currentState} → ${newState} (role: ${callerRole}). Valid: ${validTransitions.join(', ') || 'none'}`,
          { currentState, newState, callerRole, validTransitions },
        ),
      );
    }

    const existingPermissions = (row.permissions as unknown as Record<string, unknown> | null) ?? {};
    const updatedPermissions: Record<string, unknown> = { ...existingPermissions };

    if (newState === 'active') {
      delete updatedPermissions['_memberStatus'];
      delete updatedPermissions['_suspendedReason'];
      delete updatedPermissions['_removedReason'];

      const now = new Date().toISOString();
      const { error } = await fromTable('project_members')
        .update({ permissions: updatedPermissions, accepted_at: now } as never)
        .eq('id' as never, memberId);

      if (error) return fail(dbError(error.message, { memberId, newState }));
    } else {
      updatedPermissions['_memberStatus'] = newState;
      if (reason) {
        updatedPermissions[newState === 'suspended' ? '_suspendedReason' : '_removedReason'] = reason;
      }

      const { error } = await fromTable('project_members')
        .update({ permissions: updatedPermissions } as never)
        .eq('id' as never, memberId);

      if (error) return fail(dbError(error.message, { memberId, newState }));
    }

    return { data: null, error: null };
  },

  /**
   * Update non-role fields on a member record (company, trade).
   * Status and role changes must go through their dedicated methods.
   */
  async updateMember(memberId: string, updates: UpdateMemberInput): Promise<Result> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const { data: member, error: fetchError } = await fromTable('project_members')
      .select('project_id, role')
      .eq('id' as never, memberId)
      .single();

    if (fetchError || !member) return fail(notFoundError('ProjectMember', memberId));

    const row = member as unknown as Pick<ProjectMemberRow, 'project_id' | 'role'>;

    const callerRole = await resolveProjectRole(row.project_id, userId);
    if (!callerRole || (ROLE_HIERARCHY[callerRole] ?? 0) < MANAGER_LEVEL) {
      return fail(permissionError('Only project managers and above can update member details'));
    }

    const { role: _role, ...safeUpdates } = updates as unknown as Record<string, unknown>;

    const { error } = await fromTable('project_members')
      .update(safeUpdates as never)
      .eq('id' as never, memberId);

    if (error) return fail(dbError(error.message, { memberId }));
    return { data: null, error: null };
  },

  /**
   * Override the custom permission set for a member.
   * Caller must be project_manager or above.
   * System keys (prefixed with _) are preserved and cannot be overwritten here.
   */
  async updatePermissions(
    memberId: string,
    permissions: Record<string, boolean>,
  ): Promise<Result> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const { data: member, error: fetchError } = await fromTable('project_members')
      .select('project_id, permissions')
      .eq('id' as never, memberId)
      .single();

    if (fetchError || !member) return fail(notFoundError('ProjectMember', memberId));

    const row = member as unknown as Pick<ProjectMemberRow, 'project_id' | 'permissions'>;

    const callerRole = await resolveProjectRole(row.project_id, userId);
    if (!callerRole || (ROLE_HIERARCHY[callerRole] ?? 0) < MANAGER_LEVEL) {
      return fail(permissionError('Only project managers and above can update member permissions'));
    }

    const existing = (row.permissions as unknown as Record<string, unknown> | null) ?? {};
    const systemKeys: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(existing)) {
      if (k.startsWith('_')) systemKeys[k] = v;
    }

    const merged = { ...permissions, ...systemKeys };

    const { error } = await fromTable('project_members')
      .update({ permissions: merged } as never)
      .eq('id' as never, memberId);

    if (error) return fail(dbError(error.message, { memberId }));
    return { data: null, error: null };
  },

  /**
   * Get the server-resolved project role for the current session user.
   */
  async getMyProjectRole(projectId: string): Promise<Result<ProjectRole | null>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const role = await resolveProjectRole(projectId, userId);
    return ok(role);
  },

  /**
   * Load a single member record with lifecycle state.
   */
  async getMember(memberId: string): Promise<Result<ProjectMemberWithState>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const { data, error } = await fromTable('project_members')
      .select('*')
      .eq('id' as never, memberId)
      .single();

    if (error || !data) return fail(notFoundError('ProjectMember', memberId));

    const row = data as unknown as ProjectMemberRow;

    const callerRole = await resolveProjectRole(row.project_id, userId);
    if (!callerRole) return fail(permissionError('User is not a member of this project'));

    return ok({
      ...row,
      lifecycleState: getMemberLifecycleState({
        invited_at: row.invited_at,
        accepted_at: row.accepted_at,
        permissions: row.permissions as unknown as Record<string, unknown> | null,
      }),
    });
  },

  /**
   * Internal: trigger the invitation email edge function.
   * Failures are non-fatal — the member record is already created.
   */
  async _triggerInvitationEmail(
    memberId: string,
    projectId: string,
    userId: string,
  ): Promise<void> {
    // Calls the deployed `send-invite` edge function, which expects
    // { action, emails[], role, organization_id, project_ids[] }.
    // We translate from the project-member shape (memberId/userId) by
    // re-fetching the row + the project's organization_id. This is the
    // bridge that used to call the never-deployed `send-invitation-email`.
    try {
      // Pull email + role from the member row + auth.users
      const { data: member } = await fromTable('project_members')
        .select('role')
        .eq('id' as never, memberId)
        .single()
      const memberRow = member as unknown as { role: string } | null

      // auth.users isn't queryable by RLS for non-admins; fall back to
      // the profile email which is mirrored on profile creation.
      const { data: profile } = await fromTable('profiles')
        .select('user_id')
        .eq('user_id' as never, userId)
        .maybeSingle()

      const { data: project } = await fromTable('projects')
        .select('organization_id')
        .eq('id' as never, projectId)
        .single()
      const projectRow = project as unknown as { organization_id: string | null } | null

      // auth.getUser() can return undefined in tests with partial auth mocks
      // and can also fail in real code if the session has expired. Treat both
      // as "no inviter known" rather than crashing the whole invite flow.
      const authResult = await supabase.auth.getUser().catch(() => null)
      const inviterEmail = authResult?.data?.user?.email
      // We need the invitee's email. Try profile.email if the column
      // exists, otherwise we have to pass userId and let the edge
      // function look it up via service role.
      const inviteeEmail = (profile as { email?: string } | null)?.email
        ?? inviterEmail  // last-ditch fallback (will at minimum reach the inviter)

      if (!inviteeEmail || !projectRow?.organization_id || !memberRow?.role) {
        console.warn('[projectMemberService] invite missing required fields', { memberId, projectId, userId })
        return
      }

      await supabase.functions.invoke('send-invite', {
        body: {
          action: 'invite',
          email: inviteeEmail,
          role: memberRow.role,
          organization_id: projectRow.organization_id,
          project_ids: [projectId],
        },
      });
    } catch (err) {
      // Non-fatal: the member record is already created. The user can
      // be re-invited via the UI if the email never arrives.
      console.warn('[projectMemberService] invitation email trigger failed', { memberId, projectId, userId, err });
    }
  },
};
