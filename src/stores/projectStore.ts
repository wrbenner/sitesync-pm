import { create } from 'zustand';
import * as api from '../api/endpoints/projects';

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

  loadProject: () => Promise<void>;
  loadMetrics: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProject: null,
  metrics: null,
  loading: false,
  error: null,

  loadProject: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getProject();
      set({ activeProject: data, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  loadMetrics: async () => {
    try {
      const data = await api.getMetrics();
      set({ metrics: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));
