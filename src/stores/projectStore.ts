import { create } from 'zustand';

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
  // All projects available to the user in the current org context
  projectList: ProjectData[];
  metrics: Metrics | null;
  loading: boolean;
  error: string | null;

  setActiveProject: (project: ProjectData | null) => void;
  setProjectList: (projects: ProjectData[]) => void;
  setMetrics: (metrics: Metrics | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProject: null,
  projectList: [],
  metrics: null,
  loading: false,
  error: null,

  setActiveProject: (project) => set({ activeProject: project }),
  setProjectList: (projects) => set({ projectList: projects }),
  setMetrics: (metrics) => set({ metrics }),
}));
