import { supabase } from '../lib/supabase';
import type { SchedulePhaseInsert, SchedulePhaseUpdate } from '../types/api';
import type { ScheduleStatus } from '../machines/scheduleMachine';
import { getValidScheduleTransitions } from '../machines/scheduleMachine';

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
};

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
   * Sets both depends_on (primary predecessor) and dependencies (full list).
   */
  async updateDependencies(
    phaseId: string,
    predecessorIds: string[],
  ): Promise<ScheduleServiceResult> {
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
};
