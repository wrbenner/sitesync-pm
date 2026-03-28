import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SchedulePhase {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  critical: boolean;
  completed: boolean;
}

export interface ScheduleMetrics {
  daysBeforeSchedule: number;
  milestonesHit: number;
  milestoneTotal: number;
  aiConfidenceLevel: number;
}

interface ScheduleState {
  phases: SchedulePhase[];
  metrics: ScheduleMetrics;
  loading: boolean;
  error: string | null;

  loadSchedule: (projectId: string) => Promise<void>;
  updatePhase: (id: number, updates: Partial<SchedulePhase>) => void;
}

const MOCK_PHASES: SchedulePhase[] = [
  { id: 1, name: 'Demolition', startDate: '2023-06-15', endDate: '2023-08-30', progress: 100, critical: false, completed: true },
  { id: 2, name: 'Foundation', startDate: '2023-09-01', endDate: '2023-12-15', progress: 100, critical: true, completed: true },
  { id: 3, name: 'Structure', startDate: '2023-12-20', endDate: '2024-08-15', progress: 100, critical: true, completed: true },
  { id: 4, name: 'MEP', startDate: '2024-08-01', endDate: '2025-03-31', progress: 62, critical: true, completed: false },
  { id: 5, name: 'Exterior', startDate: '2024-07-15', endDate: '2025-05-30', progress: 55, critical: true, completed: false },
  { id: 6, name: 'Interior', startDate: '2025-02-01', endDate: '2025-10-31', progress: 25, critical: false, completed: false },
  { id: 7, name: 'Finishes', startDate: '2025-06-01', endDate: '2025-12-15', progress: 0, critical: false, completed: false },
];

const MOCK_METRICS: ScheduleMetrics = {
  daysBeforeSchedule: 4,
  milestonesHit: 8,
  milestoneTotal: 12,
  aiConfidenceLevel: 74,
};

export const useScheduleStore = create<ScheduleState>()((set) => ({
  phases: [],
  metrics: MOCK_METRICS,
  loading: false,
  error: null,

  loadSchedule: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ phases: MOCK_PHASES, metrics: MOCK_METRICS, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('schedule_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phases: SchedulePhase[] = (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        startDate: d.start_date,
        endDate: d.end_date,
        progress: d.progress,
        critical: d.critical,
        completed: d.completed,
      }));
      set({ phases, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  updatePhase: (id, updates) => {
    set((s) => ({
      phases: s.phases.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  },
}));
