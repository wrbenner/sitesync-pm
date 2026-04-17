// Thin wrapper over React Query — server data lives in the query cache.
// The old Zustand store has been removed. Keeps the existing consumer API
// (phases, metrics, loadSchedule, updatePhase) so call sites stay unchanged.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { scheduleService } from '../services/scheduleService';
import type { CreatePhaseInput, GanttTask } from '../services/scheduleService';
import type { MappedSchedulePhase } from '../types/entities';
import type { ScheduleStatus } from '../machines/scheduleMachine';
import type { TaskLifecycleStatus } from '../machines/scheduleStateMachine';

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

export type SchedulePhase = MappedSchedulePhase;

export interface ScheduleMetrics {
  daysBeforeSchedule: number;
  milestonesHit: number;
  milestoneTotal: number;
  aiConfidenceLevel: number | null;
}

function deriveMetrics(phases: SchedulePhase[]): ScheduleMetrics {
  const completedCount = phases.filter((p) => p.completed).length;
  return {
    daysBeforeSchedule: 0,
    milestonesHit: completedCount,
    milestoneTotal: phases.length,
    aiConfidenceLevel: null,
  };
}

const DEFAULT_METRICS: ScheduleMetrics = {
  daysBeforeSchedule: 0,
  milestonesHit: 0,
  milestoneTotal: 0,
  aiConfidenceLevel: null,
};

interface ScheduleHookState {
  phases: SchedulePhase[];
  metrics: ScheduleMetrics;
  loading: boolean;
  error: string | null;
  loadSchedule: (projectId: string) => Promise<void>;
  createPhase: (input: CreatePhaseInput) => Promise<{ error: string | null }>;
  createPhaseWithDependencies: (
    input: CreatePhaseInput,
    predecessorIds: string[],
  ) => Promise<{ error: string | null }>;
  updatePhase: (id: string, updates: Partial<CreatePhaseInput>) => Promise<{ error: string | null }>;
  transitionStatus: (phaseId: string, newStatus: ScheduleStatus) => Promise<{ error: string | null }>;
  transitionTaskStatus: (phaseId: string, newTaskStatus: TaskLifecycleStatus) => Promise<{ error: string | null }>;
  approvePhase: (phaseId: string) => Promise<{ error: string | null }>;
  deletePhase: (phaseId: string) => Promise<{ error: string | null }>;
  updateDependencies: (phaseId: string, predecessorIds: string[]) => Promise<{ error: string | null }>;
  reorderPhases: (projectId: string, orderedIds: string[]) => Promise<{ error: string | null }>;
  getGanttData: (projectId: string) => Promise<{ data: GanttTask[] | null; error: string | null }>;
}

// Tracks the most recently-requested project so legacy `loadSchedule(id)` calls
// can steer which project the hook subscribes to.
let activeProjectId: string | null = null;

function useActiveScheduleProjectId(): string | null {
  const { data } = useQuery({
    queryKey: ['schedule_active_project'],
    queryFn: () => activeProjectId,
    staleTime: Infinity,
  });
  return data ?? activeProjectId;
}

/**
 * Backwards-compatible hook. Reads phases via React Query (single source of
 * truth); mutations invalidate the cache. The `loadSchedule(projectId)` method
 * is retained for legacy call sites — it simply (re)points the active query.
 */
export function useScheduleStore<T = ScheduleHookState>(
  selector?: (s: ScheduleHookState) => T,
): T {
  const queryClient = useQueryClient();
  const projectId = useActiveScheduleProjectId();

  const query = useQuery({
    queryKey: ['schedule_phases_mapped', projectId],
    queryFn: async () => {
      if (!projectId) return [] as SchedulePhase[];
      const { data, error } = await scheduleService.loadPhases(projectId);
      if (error) throw new Error(error);
      const mapped = ((data ?? []) as Record<string, unknown>[]).map(mapToMappedPhase);
      return mapped;
    },
    enabled: !!projectId,
  });

  const phases = query.data ?? [];
  const metrics = phases.length ? deriveMetrics(phases) : DEFAULT_METRICS;

  const loadSchedule = useCallback(async (id: string) => {
    activeProjectId = id;
    queryClient.setQueryData(['schedule_active_project'], id);
    await queryClient.invalidateQueries({ queryKey: ['schedule_phases_mapped', id] });
  }, [queryClient]);

  const invalidate = useCallback(() => {
    if (activeProjectId) {
      queryClient.invalidateQueries({ queryKey: ['schedule_phases_mapped', activeProjectId] });
    }
  }, [queryClient]);

  const createPhase = useCallback(async (input: CreatePhaseInput) => {
    const { error } = await scheduleService.createPhase(input);
    if (!error) invalidate();
    return { error };
  }, [invalidate]);

  const createPhaseWithDependencies = useCallback(async (
    input: CreatePhaseInput,
    predecessorIds: string[],
  ) => {
    const { error } = await scheduleService.createPhaseWithDependencies(input, predecessorIds);
    if (!error) invalidate();
    return { error };
  }, [invalidate]);

  const updatePhase = useCallback(async (id: string, updates: Partial<CreatePhaseInput>) => {
    const { error } = await scheduleService.updatePhase(id, updates);
    if (!error) invalidate();
    return { error };
  }, [invalidate]);

  const transitionStatus = useCallback(async (phaseId: string, newStatus: ScheduleStatus) => {
    const { error } = await scheduleService.transitionStatus(phaseId, newStatus);
    if (!error) invalidate();
    return { error };
  }, [invalidate]);

  const transitionTaskStatus = useCallback(async (
    phaseId: string,
    newTaskStatus: TaskLifecycleStatus,
  ) => {
    const { error } = await scheduleService.transitionTaskStatus(phaseId, newTaskStatus);
    if (!error) invalidate();
    return { error };
  }, [invalidate]);

  const approvePhase = useCallback(async (phaseId: string) => {
    const { error } = await scheduleService.approvePhase(phaseId);
    if (!error) invalidate();
    return { error };
  }, [invalidate]);

  const deletePhase = useCallback(async (phaseId: string) => {
    const { error } = await scheduleService.deletePhase(phaseId);
    if (!error) invalidate();
    return { error };
  }, [invalidate]);

  const updateDependencies = useCallback(async (phaseId: string, predecessorIds: string[]) => {
    const { error } = await scheduleService.updateDependencies(phaseId, predecessorIds);
    if (!error) invalidate();
    return { error };
  }, [invalidate]);

  /**
   * Optimistic reorder: immediately reorders phases in the React Query cache,
   * then persists to the server.  Rolls back to the previous order on failure.
   */
  const reorderPhases = useCallback(async (pid: string, orderedIds: string[]) => {
    const cacheKey = ['schedule_phases_mapped', pid];

    // Snapshot current state for rollback
    const previous = queryClient.getQueryData<SchedulePhase[]>(cacheKey);

    if (previous) {
      const idToPhase = new Map(previous.map((p) => [p.id, p]));
      const reordered = orderedIds
        .map((id) => idToPhase.get(id))
        .filter((p): p is SchedulePhase => p !== undefined);

      // Optimistically apply the new order
      queryClient.setQueryData(cacheKey, reordered);
    }

    const { error } = await scheduleService.reorderPhases(pid, orderedIds);

    if (error) {
      // Conflict resolution: roll back to server state
      if (previous) queryClient.setQueryData(cacheKey, previous);
      return { error };
    }

    // Sync with server to pick up any concurrent changes
    await queryClient.invalidateQueries({ queryKey: cacheKey });
    return { error: null };
  }, [queryClient]);

  const getGanttData = useCallback(async (pid: string) => {
    return scheduleService.getGanttData(pid);
  }, []);

  const state: ScheduleHookState = {
    phases,
    metrics,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    loadSchedule,
    createPhase,
    createPhaseWithDependencies,
    updatePhase,
    transitionStatus,
    transitionTaskStatus,
    approvePhase,
    deletePhase,
    updateDependencies,
    reorderPhases,
    getGanttData,
  };

  return selector ? selector(state) : (state as unknown as T);
}

// Silence unused-import warnings in case downstream refactors remove callers.
void supabase;

export { useScheduleStore as default };
