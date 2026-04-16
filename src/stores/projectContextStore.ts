import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectService } from '../services/projectService';
import type { ProjectMemberWithProfile } from '../services/projectService';
import type { Project } from '../types/entities';
import type { ProjectMember } from '../types/entities';

interface ProjectContextState {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  members: ProjectMemberWithProfile[];
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
        const { data, error } = await projectService.loadProjects(companyId);
        if (error) {
          set({ error: error.userMessage, loading: false });
          return;
        }
        const projects = data ?? [];
        const { activeProjectId } = get();
        const active = projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;
        set({ projects, activeProject: active, activeProjectId: active?.id ?? null, loading: false });
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
        const { data, error } = await projectService.loadMembers(projectId);
        if (!error && data) {
          set({ members: data });
        }
      },

      createProject: async (project) => {
        const { data, error } = await projectService.createProject(project);
        if (error) return { error: error.userMessage, project: null };
        if (data) {
          set((s) => ({
            projects: [data, ...s.projects],
            activeProject: data,
            activeProjectId: data.id,
          }));
        }
        return { error: null, project: data };
      },

      updateProject: async (projectId, updates) => {
        const { error } = await projectService.updateProject(projectId, updates);
        if (!error) {
          set((s) => ({
            projects: s.projects.map((p) => (p.id === projectId ? { ...p, ...updates } : p)),
            activeProject:
              s.activeProject?.id === projectId
                ? { ...s.activeProject, ...updates }
                : s.activeProject,
          }));
        }
        return { error: error?.userMessage ?? null };
      },

      addMember: async (projectId, userId, role) => {
        const { error } = await projectService.addMember(projectId, userId, role);
        if (!error) {
          await get().loadMembers(projectId);
        }
        return { error: error?.userMessage ?? null };
      },

      removeMember: async (memberId) => {
        const { error } = await projectService.removeMember(memberId);
        if (!error) {
          const { activeProjectId } = get();
          if (activeProjectId) {
            await get().loadMembers(activeProjectId);
          }
        }
        return { error: error?.userMessage ?? null };
      },
    }),
    {
      name: 'sitesync-project-context',
      partialize: (state) => ({ activeProjectId: state.activeProjectId }),
    }
  )
);
