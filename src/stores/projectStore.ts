import { create } from 'zustand';

export interface ProjectData {
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
  aiHealthScore: number;
  daysBeforeSchedule: number;
  milestonesHit: number;
  milestoneTotal: number;
  aiConfidenceLevel: number;
}

interface ProjectState {
  activeProject: ProjectData | null;
  metrics: Metrics | null;
  loading: boolean;
  error: string | null;

  setActiveProject: (project: ProjectData | null) => void;
  setMetrics: (metrics: Metrics | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProject: null,
  metrics: null,
  loading: false,
  error: null,

  setActiveProject: (project) => set({ activeProject: project }),
  setMetrics: (metrics) => set({ metrics }),
}));
