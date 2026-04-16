import { supabase } from '../lib/supabase';
import type { Project, ProjectMember } from '../types/entities';
import { type Result, ok, fail, dbError, permissionError } from './errors';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateProjectInput = {
  name: string;
  company_id: string;
  address?: string;
  project_type?: string;
  total_value?: number;
  description?: string;
  start_date?: string;
  scheduled_end_date?: string;
  created_by: string;
};

export type ProjectMemberWithProfile = ProjectMember & {
  profile?: Record<string, unknown> | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const projectService = {
  async loadProjects(companyId: string): Promise<Result<Project[]>> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) return fail(dbError(error.message, { companyId }));
    return ok((data ?? []) as Project[]);
  },

  async createProject(input: CreateProjectInput): Promise<Result<Project>> {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: input.name,
        company_id: input.company_id,
        address: input.address ?? null,
        project_type: input.project_type ?? null,
        total_value: input.total_value ?? null,
        status: 'active',
        completion_percentage: 0,
        start_date: input.start_date ?? null,
        scheduled_end_date: input.scheduled_end_date ?? null,
        actual_end_date: null,
        description: input.description ?? null,
        created_by: input.created_by,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { company_id: input.company_id }));

    const project = data as Project;

    // Auto add creator as project manager
    await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: input.created_by,
      role: 'project_manager',
      accepted_at: new Date().toISOString(),
    });

    return ok(project);
  },

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Result> {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);

    if (error) return fail(dbError(error.message, { projectId }));
    return { data: null, error: null };
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
    role: ProjectMember['role'],
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

  async removeMember(memberId: string): Promise<Result> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId);

    if (error) return fail(dbError(error.message, { memberId }));
    return { data: null, error: null };
  },
};
