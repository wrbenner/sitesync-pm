import { supabase } from '../lib/supabase';
import type { ChangeOrder } from '../types/database';
import { getValidCOStatusTransitions } from '../machines/changeOrderMachine';
import type { ChangeOrderState, ChangeOrderType } from '../machines/changeOrderMachine';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the current authenticated user ID from Supabase session.
 * Returns null if no session (unauthenticated).
 */
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Resolve the user's authoritative project role from the database.
 * Does NOT trust caller-supplied role values.
 *
 * Returns the role string from project_members, or null if the user
 * is not a member of the project.
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

export type CreateChangeOrderInput = {
  project_id: string;
  title: string;
  description: string;
  /** Cost impact in integer cents. Positive = cost increase, negative = savings. */
  cost_impact?: number;
  schedule_impact?: string;
  requested_date?: string;
  type?: ChangeOrderType;
  reason?: string;
  cost_code?: string;
};

export type ChangeOrderServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const changeOrderService = {
  /**
   * Load all active (non-deleted) change orders for a project.
   */
  async loadChangeOrders(projectId: string): Promise<ChangeOrderServiceResult<ChangeOrder[]>> {
    const { data, error } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('number', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ChangeOrder[], error: null };
  },

  /**
   * Create a new change order in 'draft' status with provenance.
   */
  async createChangeOrder(input: CreateChangeOrderInput): Promise<ChangeOrderServiceResult<ChangeOrder>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('change_orders')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description,
        status: 'draft' as ChangeOrderState,
        type: input.type ?? 'pco',
        schedule_impact: input.schedule_impact ?? null,
        requested_date: input.requested_date ?? null,
        requested_by: userId,
        reason: input.reason ?? null,
        cost_code: input.cost_code ?? null,
        created_by: userId,
        // cost_impact stored as integer cents per Architecture Law §9
        cost_impact: input.cost_impact ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as ChangeOrder, error: null };
  },

  /**
   * Transition change order status with lifecycle enforcement.
   *
   * IMPORTANT: This method resolves the user's authoritative role from the
   * database. It does NOT accept caller-supplied roles.
   *
   * Validates that:
   *   1. The change order exists
   *   2. The user has a project role
   *   3. The transition is valid per changeOrderMachine for that role
   */
  async transitionStatus(
    changeOrderId: string,
    newStatus: ChangeOrderState,
  ): Promise<ChangeOrderServiceResult> {
    // 1. Fetch current change order
    const { data: co, error: fetchError } = await supabase
      .from('change_orders')
      .select('status, project_id, requested_by')
      .eq('id', changeOrderId)
      .single();

    if (fetchError || !co) {
      return { data: null, error: fetchError?.message ?? 'Change order not found' };
    }

    // 2. Resolve authoritative role — do NOT trust caller
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(co.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Validate transition
    const currentStatus = co.status as ChangeOrderState;
    const validTransitions = getValidCOStatusTransitions(currentStatus, role);
    if (!validTransitions.includes(newStatus)) {
      return {
        data: null,
        error: `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ')}`,
      };
    }

    // 4. Execute transition with provenance
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
    };

    if (newStatus === 'approved') {
      updates.approved_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('change_orders')
      .update(updates)
      .eq('id', changeOrderId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update change order fields (non-status). Populates updated_by.
   * Use transitionStatus() for status changes.
   */
  async updateChangeOrder(
    changeOrderId: string,
    updates: Partial<ChangeOrder>,
  ): Promise<ChangeOrderServiceResult> {
    const userId = await getCurrentUserId();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('change_orders')
      .update({ ...safeUpdates, updated_by: userId })
      .eq('id', changeOrderId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete a change order.
   */
  async deleteChangeOrder(changeOrderId: string): Promise<ChangeOrderServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('change_orders')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', changeOrderId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },
};
