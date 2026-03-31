import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Project, ProjectMember } from '../types/database';

interface ProjectContextState {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  members: ProjectMember[];
  loading: boolean;
  error: string | null;

  loadProjects: (companyId: string) => Promise<void>;
  setActiveProject: (projectId: string) => void;
  loadMembers: (projectId: string) => Promise<void>;
  createProject: (project: {
    name: string;
    company_id: string;
    address?: string;
    project_type?: string;
    total_value?: number;
    description?: string;
    start_date?: string;
    scheduled_end_date?: string;
    created_by: string;
  }) => Promise<{ error: string | null; project: Project | null }>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<{ error: string | null }>;
  addMember: (projectId: string, userId: string, role: ProjectMember['role']) => Promise<{ error: string | null }>;
  removeMember: (memberId: string) => Promise<{ error: string | null }>;
}

export const useProjectContext = create<ProjectContextState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      activeProject: null,
      members: [],
      loading: false,
      error: null,

      loadProjects: async (companyId) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const projects = (data ?? []) as Project[];
          const { activeProjectId } = get();
          const active = projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;

          set({
            projects,
            activeProject: active,
            activeProjectId: active?.id ?? null,
            loading: false,
          });
        } catch (e) {
          set({ error: (e as Error).message, loading: false });
        }
      },

      setActiveProject: (projectId) => {
        const { projects } = get();
        const project = projects.find((p) => p.id === projectId) ?? null;
        set({ activeProjectId: projectId, activeProject: project });
        if (projectId) {
          get().loadMembers(projectId);
        }
      },

      loadMembers: async (projectId) => {
        const { data, error } = await supabase
          .from('project_members')
          .select('*, profile:profiles(*)')
          .eq('project_id', projectId);

        if (!error && data) {
          set({ members: data as unknown as ProjectMember[] });
        }
      },

      createProject: async (project) => {
        const { data, error } = await (supabase
          .from('projects') as any)
          .insert({
            name: project.name,
            company_id: project.company_id,
            address: project.address ?? null,
            project_type: project.project_type ?? null,
            total_value: project.total_value ?? null,
            status: 'active',
            completion_percentage: 0,
            start_date: project.start_date ?? null,
            scheduled_end_date: project.scheduled_end_date ?? null,
            actual_end_date: null,
            description: project.description ?? null,
            created_by: project.created_by,
          })
          .select()
          .single();

        if (error) return { error: error.message, project: null };

        const newProject = data as Project;

        // Auto add creator as project manager
        await (supabase.from('project_members') as any).insert({
          project_id: newProject.id,
          user_id: project.created_by,
          role: 'project_manager',
          accepted_at: new Date().toISOString(),
        });

        set((s) => ({
          projects: [newProject, ...s.projects],
          activeProject: newProject,
          activeProjectId: newProject.id,
        }));

        return { error: null, project: newProject };
      },

      updateProject: async (projectId, updates) => {
        const { error } = await (supabase.from('projects') as any).update(updates).eq('id', projectId);
        if (!error) {
          set((s) => ({
            projects: s.projects.map((p) => (p.id === projectId ? { ...p, ...updates } : p)),
            activeProject: s.activeProject?.id === projectId ? { ...s.activeProject, ...updates } : s.activeProject,
          }));
        }
        return { error: error?.message ?? null };
      },

      addMember: async (projectId, userId, role) => {
        const { error } = await (supabase.from('project_members') as any).insert({
          project_id: projectId,
          user_id: userId,
          role,
          accepted_at: new Date().toISOString(),
        });

        if (!error) {
          await get().loadMembers(projectId);
        }
        return { error: error?.message ?? null };
      },

      removeMember: async (memberId) => {
        const { error } = await supabase.from('project_members').delete().eq('id', memberId);
        if (!error) {
          const { activeProjectId } = get();
          if (activeProjectId) {
            await get().loadMembers(activeProjectId);
          }
        }
        return { error: error?.message ?? null };
      },
    }),
    {
      name: 'sitesync-project-context',
      partialize: (state) => ({ activeProjectId: state.activeProjectId }),
    }
  )
);
