import { create } from 'zustand';
import { projectService } from '../services/projectService';
import type { CreateProjectInput, ProjectMemberWithProfile } from '../services/projectService';
import type { Project } from '../types/entities';
import type { ProjectRole } from '../types/tenant';
import type { ServiceError } from '../services/errors';

export interface ProjectData {
  id?: string;
  organizationId?: string;
  name: string;
  address: string;
  type: string;
  totalValue: number;
  status: string;
  completionPercentage: number;
  daysRemaining: number;
  startDate: string;
  scheduledEndDate: string;
  actualEndDate: string | null;
  owner: string;
  architect: string;
  contractor: string;
  description: string;
}

export interface Metrics {
  progress: number;
  budgetSpent: number;
  budgetTotal: number;
  crewsActive: number;
  workersOnSite: number;
  rfiOpen: number;
  rfiOverdue: number;
  punchListOpen: number;
  aiHealthScore: number | null;
  daysBeforeSchedule: number;
  milestonesHit: number;
  milestoneTotal: number;
  aiConfidenceLevel: number | null;
}

interface ProjectState {
  activeProject: ProjectData | null;
  projectList: ProjectData[];
  projects: Project[];
  members: ProjectMemberWithProfile[];
  metrics: Metrics | null;
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;

  // Legacy setters (backward-compat)
  setActiveProject: (project: ProjectData | null) => void;
  setProjectList: (projects: ProjectData[]) => void;
  setMetrics: (metrics: Metrics | null) => void;

  // Service-delegating async actions
  loadProjects: (organizationId: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<{ error: string | null; project: Project | null }>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<{ error: string | null }>;
  deleteProject: (projectId: string) => Promise<{ error: string | null }>;
  loadMembers: (projectId: string) => Promise<void>;
  addMember: (projectId: string, userId: string, role: ProjectRole) => Promise<{ error: string | null }>;
  updateMemberRole: (memberId: string, role: ProjectRole) => Promise<{ error: string | null }>;
  removeMember: (memberId: string) => Promise<{ error: string | null }>;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  activeProject: null,
  projectList: [],
  projects: [],
  members: [],
  metrics: null,
  loading: false,
  error: null,
  errorDetails: null,

  // ── Legacy setters ─────────────────────────────────────────────────────────
  setActiveProject: (project) => set({ activeProject: project }),
  setProjectList: (projects) => set({ projectList: projects }),
  setMetrics: (metrics) => set({ metrics }),

  // ── Service-delegating actions ─────────────────────────────────────────────

  loadProjects: async (organizationId) => {
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await projectService.loadProjects(organizationId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
    } else {
      set({ projects: data ?? [], loading: false });
    }
  },

  createProject: async (input) => {
    const { data, error } = await projectService.createProject(input);
    if (error) return { error: error.userMessage, project: null };
    if (data) {
      set((s) => ({ projects: [data, ...s.projects] }));
    }
    return { error: null, project: data };
  },

  updateProject: async (projectId, updates) => {
    const prev = get().projects;
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, ...updates } : p,
      ),
    }));
    const { error } = await projectService.updateProject(projectId, updates);
    if (error) {
      set({ projects: prev });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  deleteProject: async (projectId) => {
    const prev = get().projects;
    const prevActive = get().activeProject;
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== projectId),
      activeProject: s.activeProject?.id === projectId ? null : s.activeProject,
    }));
    const { error } = await projectService.deleteProject(projectId);
    if (error) {
      set({ projects: prev, activeProject: prevActive });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  loadMembers: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await projectService.loadMembers(projectId);
    if (error) {
      set({ error: error.userMessage, loading: false });
    } else {
      set({ members: data ?? [], loading: false });
    }
  },

  addMember: async (projectId, userId, role) => {
    const { error } = await projectService.addMember(projectId, userId, role);
    if (error) return { error: error.userMessage };
    await get().loadMembers(projectId);
    return { error: null };
  },

  updateMemberRole: async (memberId, role) => {
    const prev = get().members;
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, role } : m,
      ),
    }));
    const { error } = await projectService.updateMemberRole(memberId, role);
    if (error) {
      set({ members: prev });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  removeMember: async (memberId) => {
    const prev = get().members;
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }));
    const { error } = await projectService.removeMember(memberId);
    if (error) {
      set({ members: prev });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
