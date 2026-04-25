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
  percent_complete?: number;
  is_critical_path?: boolean;
  depends_on?: string | null;
  assigned_crew_id?: string | null;
};

export type ScheduleServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

type AugmentedInsert = SchedulePhaseInsert;

type AugmentedUpdate = SchedulePhaseUpdate & {
  deleted_at?: string | null;
  deleted_by?: string | null;
};

/** Columns that actually exist on schedule_phases — writes get filtered against this allowlist. */
const SCHEDULE_PHASE_COLUMNS = new Set([
  'project_id', 'name', 'description', 'status',
  'start_date', 'end_date', 'actual_start', 'actual_end',
  'baseline_start', 'baseline_end',
  'percent_complete', 'float_days', 'lag_days', 'total_float',
  'is_critical', 'is_critical_path', 'is_milestone',
  'assigned_crew_id', 'depends_on', 'dependencies', 'dependency_type', 'predecessor_ids',
  'created_by', 'updated_by',
  'updated_at', 'deleted_at', 'deleted_by',
]);

function sanitizeSchedulePhaseData(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SCHEDULE_PHASE_COLUMNS.has(key)) clean[key] = value;
  }
  return clean;
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
   * Load critical-path phases for a project.
   * Filters in-memory on is_critical_path.
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
   * Create a new phase in 'upcoming' status with provenance.
   */
  async createPhase(input: CreatePhaseInput): Promise<ScheduleServiceResult<unknown>> {
    const userId = await getCurrentUserId();
    const extras = input as Record<string, unknown>;
    const payload: AugmentedInsert = {
      project_id: input.project_id,
      name: input.name,
      status: 'upcoming' satisfies ScheduleStatus,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      percent_complete: input.percent_complete ?? 0,
      is_critical_path: input.is_critical_path ?? false,
      is_milestone: (extras.is_milestone as boolean | undefined) ?? false,
      depends_on: input.depends_on ?? null,
      assigned_crew_id: input.assigned_crew_id ?? null,
      baseline_start: (extras.baseline_start as string | undefined) ?? null,
      baseline_end: (extras.baseline_end as string | undefined) ?? null,
      float_days: (extras.float_days as number | undefined) ?? null,
      created_by: userId,
      updated_by: userId,
    } as AugmentedInsert;

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
    const currentStatus = (phase.status ?? 'upcoming') as ScheduleStatus;
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
    } as AugmentedUpdate;

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
    const payload = sanitizeSchedulePhaseData({
      ...(updates as Record<string, unknown>),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });

    const { error } = await supabase
      .from('schedule_phases')
      .update(payload as unknown as SchedulePhaseUpdate)
      .eq('id', phaseId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete a phase by setting deleted_at + deleted_by.
   */
  async deletePhase(phaseId: string): Promise<ScheduleServiceResult> {
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('schedule_phases')
      .update({
        deleted_at: now,
        deleted_by: userId,
      } as unknown as SchedulePhaseUpdate)
      .eq('id', phaseId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update phase dependencies. Writes the full array to `dependencies`
   * and mirrors the first one to `depends_on` for legacy single-FK readers.
   */
  async updateDependencies(
    phaseId: string,
    predecessorIds: string[],
  ): Promise<ScheduleServiceResult> {
    const userId = await getCurrentUserId();
    const payload: AugmentedUpdate = {
      depends_on: predecessorIds[0] ?? null,
      dependencies: predecessorIds.length > 0 ? predecessorIds : [],
      updated_by: userId,
    } as AugmentedUpdate;

    const { error } = await supabase
      .from('schedule_phases')
      .update(payload as unknown as SchedulePhaseUpdate)
      .eq('id', phaseId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },
};
