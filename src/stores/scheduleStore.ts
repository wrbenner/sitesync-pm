import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { MappedSchedulePhase } from '../types/entities';

function makeDemoPhase(
  id: string,
  name: string,
  startDate: string,
  endDate: string,
  progress: number,
  status: string,
  isCritical: boolean,
  baselineEnd?: string,
): MappedSchedulePhase {
  const slippageDays = baselineEnd && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(baselineEnd).getTime()) / 86400000)
    : 0;
  return {
    id,
    name,
    project_id: 'demo',
    start_date: startDate,
    end_date: endDate,
    percent_complete: progress,
    status,
    is_critical_path: isCritical,
    float_days: isCritical ? 0 : 5,
    baseline_start: startDate,
    baseline_end: baselineEnd ?? endDate,
    earned_value: null,
    assigned_crew_id: null,
    dependencies: null,
    depends_on: null,
    created_at: null,
    updated_at: null,
    // Extended domain
    baseline_start_date: startDate,
    baseline_end_date: baselineEnd ?? endDate,
    baseline_percent_complete: null,
    is_milestone: false,
    predecessor_ids: null,
    work_type: null,
    location: null,
    assigned_trade: null,
    planned_labor_hours: null,
    actual_labor_hours: null,
    baseline_finish: baselineEnd ?? endDate,
    baseline_duration_days: null,
    slippage_days: slippageDays,
    is_critical: isCritical,
    // Camelcase
    startDate,
    endDate,
    progress,
    critical: isCritical,
    completed: progress >= 100 || status === 'completed',
    baselineStartDate: startDate,
    baselineEndDate: baselineEnd ?? endDate,
    baselineProgress: 0,
    slippageDays,
    earnedValue: 0,
    isOnCriticalPath: isCritical,
    floatDays: isCritical ? 0 : 5,
    scheduleVarianceDays: -slippageDays,
    isMilestone: false,
    predecessorIds: [],
    plannedLaborHours: 0,
    actualLaborHours: 0,
  };
}

const DEMO_PHASES: MappedSchedulePhase[] = [
  makeDemoPhase('demo-1', 'Mobilization and Site Prep', '2026-01-06', '2026-02-14', 100, 'completed', false),
  makeDemoPhase('demo-2', 'Foundation and Excavation', '2026-02-03', '2026-04-11', 85, 'in_progress', true, '2026-04-04'),
  makeDemoPhase('demo-3', 'Underground Utilities', '2026-02-17', '2026-03-28', 100, 'completed', false),
  makeDemoPhase('demo-4', 'Structural Steel', '2026-04-14', '2026-07-11', 15, 'in_progress', true),
  makeDemoPhase('demo-5', 'Concrete Superstructure', '2026-05-26', '2026-08-29', 0, 'not_started', true),
  makeDemoPhase('demo-6', 'Mechanical Rough-In', '2026-07-06', '2026-09-26', 0, 'not_started', false),
  makeDemoPhase('demo-7', 'Electrical Rough-In', '2026-07-06', '2026-10-03', 0, 'not_started', false),
  makeDemoPhase('demo-8', 'Exterior Facade', '2026-08-17', '2026-11-07', 0, 'not_started', true),
  makeDemoPhase('demo-9', 'Interior Finishes', '2026-10-12', '2027-01-09', 0, 'not_started', false),
  makeDemoPhase('demo-10', 'Commissioning and Closeout', '2027-01-04', '2027-02-27', 0, 'not_started', true),
];

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

      const resolved = phases.length > 0 ? phases : DEMO_PHASES;
      // Derive metrics from phases
      const completedPhases = resolved.filter((p) => p.completed).length;
      set({
        phases: resolved,
        metrics: {
          daysBeforeSchedule: 0,
          milestonesHit: completedPhases,
          milestoneTotal: resolved.length,
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
