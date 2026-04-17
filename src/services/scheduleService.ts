import { supabase } from '../lib/supabase';
import type { SchedulePhaseInsert, SchedulePhaseUpdate } from '../types/api';
import type { ScheduleStatus } from '../machines/scheduleMachine';
import { getValidScheduleTransitions } from '../machines/scheduleMachine';
import type { TaskLifecycleStatus } from '../machines/scheduleStateMachine';
import { getValidTaskTransitions } from '../machines/scheduleStateMachine';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function resolveProjectRole(
  projectId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;

  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  return data?.role ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type CreatePhaseInput = {
  project_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  baseline_start?: string;
  baseline_end?: string;
  percent_complete?: number;
  is_critical_path?: boolean;
  is_milestone?: boolean;
  depends_on?: string | null;
  assigned_crew_id?: string | null;
  float_days?: number;
};

export type ScheduleServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

// Augmented insert type includes columns added by the schedule service migration.
// These exist in the DB after 20260416000003_schedule_service_layer.sql but are
// not yet reflected in the auto-generated database.ts.
type AugmentedInsert = SchedulePhaseInsert & {
  created_by?: string | null;
  is_milestone?: boolean;
};

type AugmentedUpdate = SchedulePhaseUpdate & {
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  is_milestone?: boolean;
  task_status?: TaskLifecycleStatus | null;
  sort_order?: number | null;
};

// Minimal phase shape needed for dependency graph operations.
type PhaseSummary = {
  id: string;
  depends_on: string | null;
  dependencies?: string[] | null;
};

// ── Gantt Chart Data Type ─────────────────────────────────────────────────────

export type GanttTask = {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string[];
  isCritical: boolean;
  isMilestone: boolean;
  status: string;
  assignedCrewId: string | null;
  floatDays: number;
  taskStatus: TaskLifecycleStatus | null;
};

// ── Dependency Validation ─────────────────────────────────────────────────────

/**
 * Check whether adding predecessorIds to phaseId would introduce a cycle in the
 * dependency graph.  Works by DFS: if any predecessor can transitively reach
 * phaseId via existing predecessor edges, the addition would close a cycle.
 */
export function wouldCreateCycle(
  phaseId: string,
  newPredecessorIds: string[],
  existingPhases: PhaseSummary[],
): boolean {
  // Build predecessor adjacency from existing phases (excluding phaseId's own entry
  // so we evaluate only the pre-existing graph).
  const depsOf = new Map<string, string[]>();
  for (const phase of existingPhases) {
    if (phase.id === phaseId) continue;
    const preds = (phase.dependencies as string[] | null) ??
      (phase.depends_on ? [phase.depends_on] : []);
    depsOf.set(phase.id, preds);
  }

  function canReach(start: string, target: string, visited: Set<string>): boolean {
    if (start === target) return true;
    if (visited.has(start)) return false;
    visited.add(start);
    for (const pred of depsOf.get(start) ?? []) {
      if (canReach(pred, target, visited)) return true;
    }
    return false;
  }

  // If any proposed predecessor already depends (transitively) on phaseId, adding
  // phaseId → predecessor would close a cycle.
  for (const predId of newPredecessorIds) {
    if (canReach(predId, phaseId, new Set())) return true;
  }
  return false;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const scheduleService = {
  /**
   * Load all active (non-deleted) phases for a project, ordered by start date.
   */
  async loadPhases(projectId: string): Promise<ScheduleServiceResult<unknown[]>> {
    const { data, error } = await supabase
      .from('schedule_phases')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('start_date', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  },

  /**
   * Load milestone phases (is_milestone = true) for a project.
   * Filters in-memory because is_milestone is a migration-added column not yet
   * in the generated Supabase types.
   */
  async loadMilestones(projectId: string): Promise<ScheduleServiceResult<unknown[]>> {
    const { data, error } = await supabase
      .from('schedule_phases')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('end_date', { ascending: true });

    if (error) return { data: null, error: error.message };
    const milestones = (data ?? []).filter((p) => (p as Record<string, unknown>)['is_milestone']);
    return { data: milestones, error: null };
  },

  /**
   * Create a new phase in 'planned' status with provenance.
   */
  async createPhase(input: CreatePhaseInput): Promise<ScheduleServiceResult<unknown>> {
    const userId = await getCurrentUserId();

    const payload: AugmentedInsert = {
      project_id: input.project_id,
      name: input.name,
      status: 'planned' satisfies ScheduleStatus,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      baseline_start: input.baseline_start ?? null,
      baseline_end: input.baseline_end ?? null,
      percent_complete: input.percent_complete ?? 0,
      is_critical_path: input.is_critical_path ?? false,
      depends_on: input.depends_on ?? null,
      assigned_crew_id: input.assigned_crew_id ?? null,
      float_days: input.float_days ?? null,
      created_by: userId,
      is_milestone: input.is_milestone ?? false,
    };

    const { data, error } = await supabase
      .from('schedule_phases')
      .insert(payload as unknown as SchedulePhaseInsert)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },

  /**
   * Create a phase and validate that the proposed predecessor IDs do not introduce
   * a circular dependency.  Fetches all existing phases first to build the graph.
   */
  async createPhaseWithDependencies(
    input: CreatePhaseInput,
    predecessorIds: string[],
  ): Promise<ScheduleServiceResult<unknown>> {
    if (predecessorIds.length > 0) {
      const { data: existing, error: loadErr } = await scheduleService.loadPhases(input.project_id);
      if (loadErr) return { data: null, error: loadErr };

      // A newly created phase has no ID yet — use a placeholder to test for cycles
      const placeholder = '__new__';
      const existingPhases = (existing ?? []) as PhaseSummary[];
      if (wouldCreateCycle(placeholder, predecessorIds, existingPhases)) {
        return { data: null, error: 'Adding these dependencies would create a circular dependency.' };
      }
    }

    const phaseInput: CreatePhaseInput = {
      ...input,
      depends_on: predecessorIds[0] ?? null,
    };

    const createResult = await scheduleService.createPhase(phaseInput);
    if (createResult.error || !createResult.data) return createResult;

    if (predecessorIds.length > 0) {
      const newId = (createResult.data as Record<string, unknown>)['id'] as string;
      const depResult = await scheduleService.updateDependencies(newId, predecessorIds);
      if (depResult.error) return { data: null, error: depResult.error };
    }

    return createResult;
  },

  /**
   * Transition phase status with lifecycle enforcement.
   *
   * Resolves the user's authoritative role from the database.
   * Validates the transition against scheduleMachine for that role.
   * Completing a phase automatically sets percent_complete to 100.
   */
  async transitionStatus(
    phaseId: string,
    newStatus: ScheduleStatus,
  ): Promise<ScheduleServiceResult> {
    // 1. Fetch current phase
    const { data: phase, error: fetchError } = await supabase
      .from('schedule_phases')
      .select('status, project_id')
      .eq('id', phaseId)
      .single();

    if (fetchError || !phase) {
      return { data: null, error: fetchError?.message ?? 'Phase not found' };
    }

    // 2. Resolve authoritative role — do NOT trust caller
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(phase.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Validate transition via state machine
    const currentStatus = (phase.status ?? 'planned') as ScheduleStatus;
    const validTargets = getValidScheduleTransitions(currentStatus, role);
    if (!validTargets.includes(newStatus)) {
      return {
        data: null,
        error: `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTargets.join(', ')}`,
      };
    }

    // 4. Execute transition with provenance
    const updates: AugmentedUpdate = {
      status: newStatus,
      updated_by: userId,
      ...(newStatus === 'completed' ? { percent_complete: 100 } : {}),
    };

    const { error } = await supabase
      .from('schedule_phases')
      .update(updates as unknown as SchedulePhaseUpdate)
      .eq('id', phaseId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Transition the task_status field following the planned→in_progress→completed→approved
   * lifecycle defined in scheduleStateMachine.
   */
  async transitionTaskStatus(
    phaseId: string,
    newTaskStatus: TaskLifecycleStatus,
  ): Promise<ScheduleServiceResult> {
    const { data: phase, error: fetchError } = await supabase
      .from('schedule_phases')
      .select('task_status, project_id')
      .eq('id', phaseId)
      .single();

    if (fetchError || !phase) {
      return { data: null, error: fetchError?.message ?? 'Phase not found' };
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(
      (phase as Record<string, unknown>)['project_id'] as string,
      userId,
    );
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    const currentTaskStatus = ((phase as Record<string, unknown>)['task_status'] as TaskLifecycleStatus | null) ?? 'planned';
    const validTargets = getValidTaskTransitions(currentTaskStatus, role);

    if (!validTargets.includes(newTaskStatus)) {
      return {
        data: null,
        error: `Invalid task transition: ${currentTaskStatus} \u2192 ${newTaskStatus} (role: ${role}). Valid: ${validTargets.join(', ')}`,
      };
    }

    const updates: AugmentedUpdate = {
      task_status: newTaskStatus,
      updated_by: userId,
    };

    const { error } = await supabase
      .from('schedule_phases')
      .update(updates as unknown as SchedulePhaseUpdate)
      .eq('id', phaseId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Approve a completed phase (transitions task_status from completed → approved).
   * Requires project_manager, admin, or owner role.
   */
  async approvePhase(phaseId: string): Promise<ScheduleServiceResult> {
    return scheduleService.transitionTaskStatus(phaseId, 'approved');
  },

  /**
   * Update phase fields (non-status). Populates updated_by.
   * Use transitionStatus() for status changes.
   */
  async updatePhase(
    phaseId: string,
    updates: Partial<CreatePhaseInput>,
  ): Promise<ScheduleServiceResult> {
    const userId = await getCurrentUserId();
    const { ...safeUpdates } = updates as Record<string, unknown>;

    const payload: AugmentedUpdate = {
      ...safeUpdates,
      updated_by: userId,
    };

    const { error } = await supabase
      .from('schedule_phases')
      .update(payload as unknown as SchedulePhaseUpdate)
      .eq('id', phaseId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete a phase. Sets deleted_at and deleted_by.
   */
  async deletePhase(phaseId: string): Promise<ScheduleServiceResult> {
    const userId = await getCurrentUserId();

    const payload: AugmentedUpdate = {
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    };

    const { error } = await supabase
      .from('schedule_phases')
      .update(payload as unknown as SchedulePhaseUpdate)
      .eq('id', phaseId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update the dependency graph for a phase.
   * Validates that the new predecessors do not create a cycle by fetching all
   * existing phases and running the graph check.
   */
  async updateDependencies(
    phaseId: string,
    predecessorIds: string[],
  ): Promise<ScheduleServiceResult> {
    if (predecessorIds.length > 0) {
      // Fetch project_id for this phase so we can load siblings
      const { data: phase, error: fetchErr } = await supabase
        .from('schedule_phases')
        .select('project_id')
        .eq('id', phaseId)
        .single();

      if (!fetchErr && phase) {
        const { data: allPhases, error: loadErr } = await scheduleService.loadPhases(
          (phase as Record<string, unknown>)['project_id'] as string,
        );
        if (!loadErr && allPhases) {
          if (wouldCreateCycle(phaseId, predecessorIds, allPhases as PhaseSummary[])) {
            return { data: null, error: 'Adding these dependencies would create a circular dependency.' };
          }
        }
      }
    }

    const userId = await getCurrentUserId();

    const payload: AugmentedUpdate = {
      dependencies: predecessorIds,
      depends_on: predecessorIds[0] ?? null,
      updated_by: userId,
    };

    const { error } = await supabase
      .from('schedule_phases')
      .update(payload as unknown as SchedulePhaseUpdate)
      .eq('id', phaseId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Detect resource allocation conflicts: phases with the same crew assigned that
   * overlap with the given date window.  Pass excludePhaseId when editing an
   * existing phase to skip self-comparison.
   */
  async detectResourceConflicts(
    projectId: string,
    crewId: string,
    startDate: string,
    endDate: string,
    excludePhaseId?: string,
  ): Promise<ScheduleServiceResult<unknown[]>> {
    // Overlap condition: existing.start < new.end AND existing.end > new.start
    const { data, error } = await supabase
      .from('schedule_phases')
      .select('id, name, start_date, end_date, assigned_crew_id, status')
      .eq('project_id', projectId)
      .eq('assigned_crew_id', crewId)
      .is('deleted_at', null)
      .lt('start_date', endDate)
      .gt('end_date', startDate);

    if (error) return { data: null, error: error.message };

    const conflicts = (data ?? []).filter((p) => {
      const record = p as Record<string, unknown>;
      return !excludePhaseId || record['id'] !== excludePhaseId;
    });

    return { data: conflicts, error: null };
  },

  /**
   * Bulk reorder phases by updating their sort_order field.
   * orderedIds must contain the full ordered list of phase IDs for the project.
   * Used by the Gantt drag-and-drop to persist visual order.
   */
  async reorderPhases(
    projectId: string,
    orderedIds: string[],
  ): Promise<ScheduleServiceResult> {
    const userId = await getCurrentUserId();

    // Execute updates sequentially — Supabase JS client v2 has no bulk upsert
    // that preserves per-row values; we issue one update per phase.
    for (let i = 0; i < orderedIds.length; i++) {
      const payload: AugmentedUpdate = {
        sort_order: i,
        updated_by: userId,
      };
      const { error } = await supabase
        .from('schedule_phases')
        .update(payload as unknown as SchedulePhaseUpdate)
        .eq('id', orderedIds[i])
        .eq('project_id', projectId); // RLS safety: scope to project

      if (error) return { data: null, error: error.message };
    }

    return { data: null, error: null };
  },

  /**
   * Return phases formatted for Gantt chart rendering.
   * Includes critical-path flag, milestone status, progress, and dependency links.
   */
  async getGanttData(projectId: string): Promise<ScheduleServiceResult<GanttTask[]>> {
    const { data, error } = await supabase
      .from('schedule_phases')
      .select('id, name, start_date, end_date, percent_complete, dependencies, is_critical_path, is_milestone, status, assigned_crew_id, float_days, task_status')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('start_date', { ascending: true });

    if (error) return { data: null, error: error.message };

    const ganttTasks: GanttTask[] = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r['id'] as string,
        name: r['name'] as string,
        start: (r['start_date'] as string | null) ?? '',
        end: (r['end_date'] as string | null) ?? '',
        progress: (r['percent_complete'] as number | null) ?? 0,
        dependencies: (r['dependencies'] as string[] | null) ?? [],
        isCritical: (r['is_critical_path'] as boolean | null) ?? false,
        isMilestone: (r['is_milestone'] as boolean | null) ?? false,
        status: (r['status'] as string | null) ?? 'planned',
        assignedCrewId: (r['assigned_crew_id'] as string | null) ?? null,
        floatDays: (r['float_days'] as number | null) ?? 0,
        taskStatus: (r['task_status'] as TaskLifecycleStatus | null) ?? null,
      };
    });

    return { data: ganttTasks, error: null };
  },

  /**
   * Notify milestone completion by inserting a notification record.
   * Called after transitioning a milestone phase to 'completed'.
   */
  async notifyMilestoneComplete(
    projectId: string,
    phaseId: string,
    phaseName: string,
  ): Promise<ScheduleServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await supabase.from('notifications').insert({
      project_id: projectId,
      user_id: userId,
      type: 'schedule.milestone_completed',
      title: `Milestone completed: ${phaseName}`,
      message: `The milestone "${phaseName}" has been marked as completed.`,
      entity_type: 'schedule_phase',
      entity_id: phaseId,
      read: false,
    });

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Transition a milestone phase to completed and emit a notification in one
   * logical operation.  If the notification fails the completion is still
   * considered successful (non-blocking side-effect).
   */
  async completeMilestone(
    phaseId: string,
    phaseName: string,
    projectId: string,
  ): Promise<ScheduleServiceResult> {
    const transitionResult = await scheduleService.transitionStatus(phaseId, 'completed');
    if (transitionResult.error) return transitionResult;

    // Fire-and-forget notification — failure is non-blocking
    scheduleService.notifyMilestoneComplete(projectId, phaseId, phaseName).catch(() => undefined);

    return { data: null, error: null };
  },
};
