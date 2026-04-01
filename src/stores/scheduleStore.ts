import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { MappedSchedulePhase } from '../types/entities';

export type SchedulePhase = MappedSchedulePhase;

export interface ScheduleMetrics {
  daysBeforeSchedule: number;
  milestonesHit: number;
  milestoneTotal: number;
  aiConfidenceLevel: number | null;
}

interface ScheduleState {
  phases: SchedulePhase[];
  metrics: ScheduleMetrics;
  loading: boolean;
  error: string | null;

  loadSchedule: (projectId: string) => Promise<void>;
  updatePhase: (id: string, updates: Partial<SchedulePhase>) => void;
}

const DEFAULT_METRICS: ScheduleMetrics = {
  daysBeforeSchedule: 0,
  milestonesHit: 0,
  milestoneTotal: 0,
  aiConfidenceLevel: null,
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
      const phases: SchedulePhase[] = (data ?? []).map((d): SchedulePhase => {
        const startDate = d.start_date ?? '';
        const endDate = d.end_date ?? '';
        const baselineEnd = d.baseline_end ?? null;
        const slippageDays = baselineEnd && endDate
          ? Math.ceil((new Date(endDate).getTime() - new Date(baselineEnd).getTime()) / 86400000)
          : 0;
        const scheduleVarianceDays = baselineEnd && endDate
          ? Math.ceil((new Date(baselineEnd).getTime() - new Date(endDate).getTime()) / 86400000)
          : 0;
        return {
          ...d,
          // Extended domain fields not yet in DB schema — default null
          baseline_start_date: null,
          baseline_end_date: null,
          baseline_percent_complete: null,
          is_milestone: null,
          predecessor_ids: d.dependencies ?? null,
          work_type: null,
          location: null,
          assigned_trade: null,
          planned_labor_hours: null,
          actual_labor_hours: null,
          // Camelcase convenience
          startDate,
          endDate,
          progress: d.percent_complete ?? 0,
          critical: d.is_critical_path ?? false,
          completed: (d.percent_complete ?? 0) >= 100 || d.status === 'completed',
          baselineStartDate: d.baseline_start ?? null,
          baselineEndDate: baselineEnd,
          baselineProgress: 0,
          slippageDays,
          earnedValue: d.earned_value ?? 0,
          // Computed
          isOnCriticalPath: d.is_critical_path ?? false,
          floatDays: d.float_days ?? 0,
          scheduleVarianceDays,
          // New domain camelCase
          isMilestone: false,
          predecessorIds: d.dependencies ?? [],
          plannedLaborHours: 0,
          actualLaborHours: 0,
        };
      });

      // Derive metrics from phases
      const completedPhases = phases.filter((p) => p.completed).length;
      set({
        phases,
        metrics: {
          daysBeforeSchedule: 0,
          milestonesHit: completedPhases,
          milestoneTotal: phases.length,
          aiConfidenceLevel: null,
        },
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  updatePhase: (id: string, updates) => {
    set((s) => ({
      phases: s.phases.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  },
}));
