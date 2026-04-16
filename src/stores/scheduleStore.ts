// TODO: Migrate to entityStore — see src/stores/entityStore.ts
import { create } from 'zustand';
import { scheduleService } from '../services/scheduleService';
import type { CreatePhaseInput } from '../services/scheduleService';
import type { MappedSchedulePhase } from '../types/entities';
import type { ScheduleStatus } from '../machines/scheduleMachine';

// ── Demo data (shown when project has no phases yet) ─────────────────────────

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

// ── Mapping ───────────────────────────────────────────────────────────────────

function mapToMappedPhase(d: Record<string, unknown>): MappedSchedulePhase {
  const startDate = (d['start_date'] as string | null) ?? '';
  const endDate = (d['end_date'] as string | null) ?? '';
  const baselineEnd = (d['baseline_end'] as string | null) ?? null;
  const slippageDays = baselineEnd && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(baselineEnd).getTime()) / 86400000)
    : 0;
  const scheduleVarianceDays = baselineEnd && endDate
    ? Math.ceil((new Date(baselineEnd).getTime() - new Date(endDate).getTime()) / 86400000)
    : 0;
  const pct = (d['percent_complete'] as number | null) ?? 0;
  const isCritical = (d['is_critical_path'] as boolean | null) ?? false;

  return {
    id: d['id'] as string,
    name: d['name'] as string,
    project_id: d['project_id'] as string,
    start_date: startDate || null,
    end_date: endDate || null,
    percent_complete: pct,
    status: (d['status'] as string | null) ?? 'planned',
    is_critical_path: isCritical,
    float_days: (d['float_days'] as number | null) ?? 0,
    baseline_start: (d['baseline_start'] as string | null) ?? null,
    baseline_end: baselineEnd,
    earned_value: (d['earned_value'] as number | null) ?? null,
    assigned_crew_id: (d['assigned_crew_id'] as string | null) ?? null,
    dependencies: (d['dependencies'] as string[] | null) ?? null,
    depends_on: (d['depends_on'] as string | null) ?? null,
    created_at: (d['created_at'] as string | null) ?? null,
    updated_at: (d['updated_at'] as string | null) ?? null,
    // Extended domain fields
    baseline_start_date: null,
    baseline_end_date: null,
    baseline_percent_complete: null,
    is_milestone: (d['is_milestone'] as boolean | null) ?? null,
    predecessor_ids: (d['dependencies'] as string[] | null) ?? null,
    work_type: null,
    location: null,
    assigned_trade: null,
    planned_labor_hours: null,
    actual_labor_hours: null,
    baseline_finish: baselineEnd,
    baseline_duration_days: null,
    slippage_days: slippageDays,
    is_critical: isCritical,
    // Camelcase convenience
    startDate,
    endDate,
    progress: pct,
    critical: isCritical,
    completed: pct >= 100 || d['status'] === 'completed',
    baselineStartDate: (d['baseline_start'] as string | null) ?? null,
    baselineEndDate: baselineEnd,
    baselineProgress: 0,
    slippageDays,
    earnedValue: (d['earned_value'] as number | null) ?? 0,
    isOnCriticalPath: isCritical,
    floatDays: (d['float_days'] as number | null) ?? 0,
    scheduleVarianceDays,
    isMilestone: (d['is_milestone'] as boolean | null) ?? false,
    predecessorIds: (d['dependencies'] as string[] | null) ?? [],
    plannedLaborHours: 0,
    actualLaborHours: 0,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

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
  createPhase: (input: CreatePhaseInput) => Promise<{ error: string | null }>;
  updatePhase: (id: string, updates: Partial<CreatePhaseInput>) => Promise<{ error: string | null }>;
  transitionStatus: (phaseId: string, newStatus: ScheduleStatus) => Promise<{ error: string | null }>;
  deletePhase: (phaseId: string) => Promise<{ error: string | null }>;
  updateDependencies: (phaseId: string, predecessorIds: string[]) => Promise<{ error: string | null }>;
}

const DEFAULT_METRICS: ScheduleMetrics = {
  daysBeforeSchedule: 0,
  milestonesHit: 0,
  milestoneTotal: 0,
  aiConfidenceLevel: null,
};

function deriveMetrics(phases: SchedulePhase[]): ScheduleMetrics {
  const completedCount = phases.filter((p) => p.completed).length;
  return {
    daysBeforeSchedule: 0,
    milestonesHit: completedCount,
    milestoneTotal: phases.length,
    aiConfidenceLevel: null,
  };
}

export const useScheduleStore = create<ScheduleState>()((set) => ({
  phases: [],
  metrics: DEFAULT_METRICS,
  loading: false,
  error: null,

  loadSchedule: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await scheduleService.loadPhases(projectId);

    if (error) {
      set({ error, loading: false });
      return;
    }

    const phases = ((data ?? []) as Record<string, unknown>[]).map(mapToMappedPhase);
    const resolved = phases.length > 0 ? phases : DEMO_PHASES;

    set({
      phases: resolved,
      metrics: deriveMetrics(resolved),
      loading: false,
    });
  },

  createPhase: async (input) => {
    const { data, error } = await scheduleService.createPhase(input);
    if (error) return { error };
    if (data) {
      const mapped = mapToMappedPhase(data as Record<string, unknown>);
      set((s) => ({
        phases: [...s.phases, mapped],
        metrics: deriveMetrics([...s.phases, mapped]),
      }));
    }
    return { error: null };
  },

  updatePhase: async (id, updates) => {
    const { error } = await scheduleService.updatePhase(id, updates);
    if (!error) {
      set((s) => {
        const phases = s.phases.map((p) =>
          p.id === id ? { ...p, ...(updates as Partial<SchedulePhase>) } : p,
        );
        return { phases, metrics: deriveMetrics(phases) };
      });
    }
    return { error };
  },

  transitionStatus: async (phaseId, newStatus) => {
    const { error } = await scheduleService.transitionStatus(phaseId, newStatus);
    if (!error) {
      set((s) => {
        const phases = s.phases.map((p) => {
          if (p.id !== phaseId) return p;
          const pct = newStatus === 'completed' ? 100 : p.percent_complete ?? 0;
          return {
            ...p,
            status: newStatus,
            percent_complete: pct,
            progress: pct,
            completed: newStatus === 'completed',
          };
        });
        return { phases, metrics: deriveMetrics(phases) };
      });
    }
    return { error };
  },

  deletePhase: async (phaseId) => {
    const { error } = await scheduleService.deletePhase(phaseId);
    if (!error) {
      set((s) => {
        const phases = s.phases.filter((p) => p.id !== phaseId);
        return { phases, metrics: deriveMetrics(phases) };
      });
    }
    return { error };
  },

  updateDependencies: async (phaseId, predecessorIds) => {
    const { error } = await scheduleService.updateDependencies(phaseId, predecessorIds);
    if (!error) {
      set((s) => ({
        phases: s.phases.map((p) =>
          p.id === phaseId
            ? { ...p, dependencies: predecessorIds, predecessorIds, depends_on: predecessorIds[0] ?? null }
            : p,
        ),
      }));
    }
    return { error };
  },

  // Legacy synchronous helper kept for component backward compatibility.
  // Prefer the async updatePhase() which persists to the database.
  ...({} as Record<string, unknown>),
}));

// Re-export for backward compatibility with existing component imports
export { useScheduleStore as default };
