import { supabase } from '../lib/supabase';
import type { PunchItem } from '../types/database';
import type { PunchItemState } from '../machines/punchItemMachine';
import { getValidPunchTargetStates, getNextPunchStatus } from '../machines/punchItemMachine';
import { validateTransition, logTransition } from './stateMachineUtils';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Resolve the user's authoritative project role from the database.
 * Does NOT trust caller-supplied role values.
 */
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

export type CreatePunchItemInput = {
  project_id: string;
  title: string;
  description?: string;
  priority?: string;
  area?: string;
  floor?: string;
  location?: string;
  trade?: string;
  assigned_to?: string;
  due_date?: string;
  photos?: string[];
};

export type PunchItemServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const punchItemService = {
  /**
   * Load all active punch items for a project.
   * Soft-delete filtering is applied when the column exists via RLS policy.
   */
  async loadPunchItems(projectId: string): Promise<PunchItemServiceResult<PunchItem[]>> {
    const { data, error } = await supabase
      .from('punch_items')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as PunchItem[], error: null };
  },

  /**
   * Create a new punch item in 'open' status.
   * Populates reported_by as creation provenance.
   */
  async createPunchItem(input: CreatePunchItemInput): Promise<PunchItemServiceResult<PunchItem>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('punch_items')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description ?? null,
        status: 'open' as PunchItemState,
        priority: input.priority ?? null,
        area: input.area ?? null,
        floor: input.floor ?? null,
        location: input.location ?? null,
        trade: input.trade ?? null,
        assigned_to: input.assigned_to ?? null,
        due_date: input.due_date ?? null,
        photos: input.photos ? (input.photos as unknown as import('../types/database').Json) : null,
        reported_by: userId,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as PunchItem, error: null };
  },

  /**
   * Transition punch item status using a named action.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   *
   * Validates:
   *   1. The punch item exists
   *   2. The user is a project member
   *   3. The action is valid per punchItemMachine for the current status
   */
  async transitionStatus(
    punchItemId: string,
    action: string,
  ): Promise<PunchItemServiceResult> {
    // 1. Fetch current item
    const { data: item, error: fetchError } = await supabase
      .from('punch_items')
      .select('status, reported_by, assigned_to, project_id')
      .eq('id', punchItemId)
      .single();

    if (fetchError || !item) {
      return { data: null, error: fetchError?.message ?? 'Punch item not found' };
    }

    // 2. Resolve authoritative role — do NOT trust caller
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(item.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Resolve next status from action, then validate the state transition
    const currentStatus = (item.status ?? 'open') as PunchItemState;
    const newStatus = getNextPunchStatus(currentStatus, action);
    if (!newStatus) {
      const validTargets = getValidPunchTargetStates(currentStatus);
      return {
        data: null,
        error: `Invalid action: "${action}" from status "${currentStatus}" (role: ${role}). Valid targets: [${validTargets.join(', ')}]`,
      };
    }

    const validTargets = getValidPunchTargetStates(currentStatus);
    const transitionError = validateTransition('punch_item', currentStatus, newStatus, validTargets);
    if (transitionError) {
      return { data: null, error: transitionError.message };
    }

    // 4. Execute transition with provenance and lifecycle timestamps
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'resolved') {
      updates.resolved_date = new Date().toISOString();
    }
    if (newStatus === 'verified') {
      updates.verified_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('punch_items')
      .update(updates)
      .eq('id', punchItemId);

    if (error) return { data: null, error: error.message };

    await logTransition({
      entityType: 'punch_items',
      entityId: punchItemId,
      projectId: item.project_id,
      userId,
      currentState: currentStatus,
      newState: newStatus,
      role,
    });

    return { data: null, error: null };
  },

  /**
   * Update punch item fields (non-status). Tracks updated_at.
   * Use transitionStatus() for status changes.
   */
  async updatePunchItem(
    punchItemId: string,
    updates: Partial<PunchItem>,
  ): Promise<PunchItemServiceResult> {
    // Strip status to prevent bypassing lifecycle machine
     
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('punch_items')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('id', punchItemId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Delete a punch item.
   * Note: punch_items lacks deleted_at/deleted_by columns for soft-delete.
   * A migration adding those columns would enable soft-delete here.
   */
  async deletePunchItem(punchItemId: string): Promise<PunchItemServiceResult> {
    const { error } = await supabase
      .from('punch_items')
      .delete()
      .eq('id', punchItemId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },
};
