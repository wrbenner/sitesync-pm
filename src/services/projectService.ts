import { supabase } from '../lib/supabase';
import { ensureOrganizationMembership } from '../lib/ensureOrganizationMembership';
import type { Project, ProjectMember } from '../types/entities';
import type { ProjectRole } from '../types/tenant';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
} from './errors';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Resolve the user's authoritative project role from the database.
 * Does NOT trust caller-supplied role values.
 */
async function resolveProjectRole(
  projectId: string,
  userId: string | null,
): Promise<ProjectRole | null> {
  if (!userId) return null;

  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  return (data?.role as ProjectRole) ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateProjectInput = {
  name: string;
  /** Organization this project belongs to. */
  organization_id?: string;
  /** @deprecated Use organization_id. Kept for backward-compatibility. */
  company_id?: string;
  address?: string;
  project_type?: string;
  total_value?: number;
  description?: string;
  start_date?: string;
  scheduled_end_date?: string;
  /** @deprecated Resolved automatically from the session. */
  created_by?: string;
};

export type ProjectMemberWithProfile = ProjectMember & {
  profile?: Record<string, unknown> | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const projectService = {
  /**
   * Load all non-deleted projects for an organization, newest first.
   */
  async loadProjects(organizationId: string): Promise<Result<Project[]>> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (error) return fail(dbError(error.message, { organizationId }));
    return ok((data ?? []) as Project[]);
  },

  /**
   * Fetch a single project by ID. Returns NotFoundError if archived or missing.
   */
  async getProject(projectId: string): Promise<Result<Project>> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .neq('status', 'archived')
      .single();

    if (error || !data) return fail(notFoundError('Project', projectId));
    return ok(data as Project);
  },

  /**
   * Create a project. Automatically adds the creator as project_manager.
   *
   * IMPORTANT: created_by is resolved from the active session — never trust
   * caller-supplied values for provenance.
   */
  async createProject(input: CreateProjectInput): Promise<Result<Project>> {
    const userId = await getCurrentUserId();
    let organizationId = input.organization_id ?? input.company_id ?? '';

    // Self-heal: if no org supplied, ensure the user has one (and is a member of it).
    if (!organizationId && userId) {
      const resolved = await ensureOrganizationMembership(userId);
      if (resolved) organizationId = resolved;
    } else if (organizationId && userId) {
      // Ensure org membership row exists for this user on the supplied org.
      await ensureOrganizationMembership(userId);
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: input.name,
        organization_id: organizationId,
        address: input.address ?? null,
        project_type: input.project_type ?? null,
        total_value: input.total_value ?? null,
        description: input.description ?? null,
        status: 'active',
        start_date: input.start_date ?? null,
        target_completion: input.scheduled_end_date ?? null,
        owner_id: userId,
      } as Parameters<ReturnType<typeof supabase.from<'projects'>>['insert']>[0])
      .select()
      .single();

    if (error) return fail(dbError(error.message, { organization_id: organizationId }));

    const project = data as Project;

    // Auto-add creator as project_manager
    if (userId) {
      await supabase.from('project_members').insert({
        project_id: project.id,
        user_id: userId,
        role: 'project_manager' as ProjectRole,
        accepted_at: new Date().toISOString(),
      });
    }

    return ok(project);
  },

  /**
   * Update project fields (non-status). Always records updated_at timestamp.
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Result> {
    const { error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (error) return fail(dbError(error.message, { projectId }));
    return { data: null, error: null };
  },

  /**
   * Soft-delete a project by setting status to 'archived'.
   * Only project_manager or higher roles may archive a project.
   */
  async deleteProject(projectId: string): Promise<Result> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const role = await resolveProjectRole(projectId, userId);
    if (!role) return fail(permissionError('User is not a member of this project'));

    const allowedRoles: ProjectRole[] = ['project_manager', 'project_executive'];
    if (!allowedRoles.includes(role)) {
      return fail(permissionError(`Role '${role}' cannot archive projects`));
    }

    const { error } = await supabase
      .from('projects')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) return fail(dbError(error.message, { projectId }));
    return { data: null, error: null };
  },

  /**
   * Get the current user's server-resolved role in a project.
   * Returns null if the user is not a member.
   */
  async getMyRole(projectId: string): Promise<Result<ProjectRole | null>> {
    const userId = await getCurrentUserId();
    if (!userId) return fail(permissionError('Not authenticated'));

    const role = await resolveProjectRole(projectId, userId);
    return ok(role);
  },

  async loadMembers(projectId: string): Promise<Result<ProjectMemberWithProfile[]>> {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profile:profiles(*)')
      .eq('project_id', projectId);

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as unknown as ProjectMemberWithProfile[]);
  },

  async addMember(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<Result> {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return fail(permissionError('Not authenticated'));

    const { error } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: userId,
      role,
      accepted_at: new Date().toISOString(),
    });

    if (error) return fail(dbError(error.message, { projectId, userId }));
    return { data: null, error: null };
  },

  async updateMemberRole(memberId: string, role: ProjectRole): Promise<Result> {
    const { error } = await supabase
      .from('project_members')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', memberId);

    if (error) return fail(dbError(error.message, { memberId }));
    return { data: null, error: null };
  },

  async removeMember(memberId: string): Promise<Result> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId);

    if (error) return fail(dbError(error.message, { memberId }));
    return { data: null, error: null };
  },
};
