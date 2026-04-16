import { supabase } from '../lib/supabase';
import type { ChangeOrder } from '../types/database';
import type { Database } from '../types/database';
import {
  getValidCOTransitionsForRole,
  type ChangeOrderState,
  type ChangeOrderType,
  type ReasonCode,
} from '../machines/changeOrderMachine';

// Augmented insert type — created_by added via migration 20260413000003
type COInsert = Database['public']['Tables']['change_orders']['Insert'];
type COInsertAugmented = COInsert & {
  created_by?: string | null;
  promoted_from_id?: string | null;
  promoted_at?: string | null;
};

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

export type CreateChangeOrderInput = {
  project_id: string;
  description: string;
  title?: string;
  amount?: number;
  type?: ChangeOrderType;
  reason?: ReasonCode;
  cost_code?: string;
  schedule_impact?: string;
  parent_co_id?: string;
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
      .order('number', { ascending: false });

    if (error) return { data: null, error: error.message };

    // Filter soft-deleted records in-memory until database.ts is regenerated
    // post-migration 20260413000004 which added deleted_at to change_orders
    const active = (data ?? []).filter((co) => {
      const ext = co as typeof co & { deleted_at: string | null };
      return !ext.deleted_at;
    });

    return { data: active as ChangeOrder[], error: null };
  },

  /**
   * Create a new change order in 'draft' status with provenance.
   */
  async createChangeOrder(input: CreateChangeOrderInput): Promise<ChangeOrderServiceResult<ChangeOrder>> {
    const userId = await getCurrentUserId();

    const payload: COInsertAugmented = {
      project_id: input.project_id,
      description: input.description,
      title: input.title ?? null,
      amount: input.amount ?? null,
      status: 'draft' as ChangeOrderState,
      type: (input.type ?? 'pco') as string,
      reason: input.reason ?? null,
      cost_code: input.cost_code ?? null,
      schedule_impact: input.schedule_impact ?? null,
      parent_co_id: input.parent_co_id ?? null,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('change_orders')
      .insert(payload)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as ChangeOrder, error: null };
  },

  /**
   * Transition change order status with lifecycle enforcement.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   *
   * Validates that:
   *   1. The change order exists
   *   2. The user has a project role
   *   3. The transition is valid per changeOrderMachine for that role
   */
  async transitionStatus(
    coId: string,
    newStatus: ChangeOrderState,
    comments?: string,
  ): Promise<ChangeOrderServiceResult> {
    // 1. Fetch current change order
    const { data: co, error: fetchError } = await supabase
      .from('change_orders')
      .select('status, project_id, type')
      .eq('id', coId)
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
    const validTargets = getValidCOTransitionsForRole(currentStatus, role);
    if (!validTargets.includes(newStatus)) {
      return {
        data: null,
        error: `Invalid transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${validTargets.join(', ')}`,
      };
    }

    // 4. Execute transition with provenance
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
    };

    if (newStatus === 'pending_review') {
      updates.submitted_by = userId;
      updates.submitted_at = now;
    } else if (newStatus === 'approved') {
      updates.approved_by = userId;
      updates.approved_at = now;
      if (comments) updates.approval_comments = comments;
    } else if (newStatus === 'rejected') {
      updates.rejected_by = userId;
      updates.rejected_at = now;
      if (comments) updates.rejection_comments = comments;
    }

    const { error } = await supabase
      .from('change_orders')
      .update(updates)
      .eq('id', coId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update change order fields (non-status). Populates updated_by.
   * Use transitionStatus() for status changes.
   */
  async updateChangeOrder(
    coId: string,
    updates: Partial<ChangeOrder>,
  ): Promise<ChangeOrderServiceResult> {
    const userId = await getCurrentUserId();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('change_orders')
      .update({ ...safeUpdates, updated_by: userId })
      .eq('id', coId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete a change order.
   */
  async deleteChangeOrder(coId: string): Promise<ChangeOrderServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('change_orders')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', coId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Promote an approved change order to the next type in the PCO → COR → CO chain.
   * Creates a new record at the next stage linked back via promoted_from_id.
   */
  async promoteType(coId: string): Promise<ChangeOrderServiceResult<ChangeOrder>> {
    // 1. Fetch current change order
    const { data: co, error: fetchError } = await supabase
      .from('change_orders')
      .select('*')
      .eq('id', coId)
      .single();

    if (fetchError || !co) {
      return { data: null, error: fetchError?.message ?? 'Change order not found' };
    }

    const currentType = co.type as ChangeOrderType;
    if (currentType === 'co') {
      return { data: null, error: 'Change orders cannot be promoted further' };
    }
    if (co.status !== 'approved') {
      return { data: null, error: 'Only approved change orders can be promoted' };
    }

    // 2. Resolve authoritative role
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(co.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    const nextType: ChangeOrderType = currentType === 'pco' ? 'cor' : 'co';
    const now = new Date().toISOString();

    const promotedPayload: COInsertAugmented = {
      project_id: co.project_id,
      description: co.description,
      title: co.title,
      amount: co.amount,
      approved_amount: co.approved_amount,
      status: 'draft' as ChangeOrderState,
      type: nextType as string,
      reason: co.reason,
      cost_code: co.cost_code,
      schedule_impact: co.schedule_impact,
      parent_co_id: co.id,
      created_by: userId,
      promoted_from_id: coId,
      promoted_at: now,
    };

    const { data: promoted, error: insertError } = await supabase
      .from('change_orders')
      .insert(promotedPayload)
      .select()
      .single();

    if (insertError) return { data: null, error: insertError.message };

    // Mark source as promoted
    await supabase
      .from('change_orders')
      .update({ promoted_at: now, updated_by: userId } as Record<string, unknown>)
      .eq('id', coId);

    return { data: promoted as ChangeOrder, error: null };
  },
};
