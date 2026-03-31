import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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

const DEFAULT_METRICS: ScheduleMetrics = {
  daysBeforeSchedule: 0,
  milestonesHit: 0,
  milestoneTotal: 0,
  aiConfidenceLevel: 0,
};

export const useScheduleStore = create<ScheduleState>()((set) => ({
  phases: [],
  metrics: DEFAULT_METRICS,
  loading: false,
  error: null,

  loadSchedule: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('schedule_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      const phases: SchedulePhase[] = (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        startDate: d.start_date,
        endDate: d.end_date,
        progress: d.progress,
        critical: d.critical,
        completed: d.completed,
      }));

      // Derive metrics from phases
      const completedPhases = phases.filter((p) => p.completed).length;
      set({
        phases,
        metrics: {
          daysBeforeSchedule: 0,
          milestonesHit: completedPhases,
          milestoneTotal: phases.length,
          aiConfidenceLevel: phases.length > 0
            ? Math.round(phases.reduce((s, p) => s + p.progress, 0) / phases.length)
            : 0,
        },
        loading: false,
      });
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
