import { supabase } from '../lib/supabase';
import type { ChangeOrder } from '../types/database';
import type { Database } from '../types/database';
import {
  getValidCOTransitionsForRole,
  type ChangeOrderState,
  type ChangeOrderType,
  type ReasonCode,
} from '../machines/changeOrderMachine';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  validationError,
  conflictError,
} from './errors';

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

/** @deprecated Use Result<T> from services/errors instead */
export type ChangeOrderServiceResult<T = void> = Result<T>;

// ── Service ──────────────────────────────────────────────────────────────────

export const changeOrderService = {
  async loadChangeOrders(projectId: string): Promise<Result<ChangeOrder[]>> {
    const { data, error } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));

    // Filter soft-deleted records in-memory until database.ts is regenerated
    // post-migration 20260413000004 which added deleted_at to change_orders
    const active = (data ?? []).filter((co) => {
      const ext = co as typeof co & { deleted_at: string | null };
      return !ext.deleted_at;
    });

    return ok(active as ChangeOrder[]);
  },

  async createChangeOrder(input: CreateChangeOrderInput): Promise<Result<ChangeOrder>> {
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

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as ChangeOrder);
  },

  /**
   * Transition change order status with lifecycle enforcement.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   */
  async transitionStatus(
    coId: string,
    newStatus: ChangeOrderState,
    comments?: string,
  ): Promise<Result> {
    const { data: co, error: fetchError } = await supabase
      .from('change_orders')
      .select('status, project_id, type')
      .eq('id', coId)
      .single();

    if (fetchError || !co) {
      return fail(notFoundError('Change order', coId));
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(co.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = co.status as ChangeOrderState;
    const validTargets = getValidCOTransitionsForRole(currentStatus, role);
    if (!validTargets.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTargets.join(', ')}`,
          { currentStatus, newStatus, role, validTargets },
        ),
      );
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
    };
    void userId;
    void comments;

    if (newStatus === 'approved') {
      updates.approved_date = now;
    }

    const { error } = await supabase
      .from('change_orders')
      .update(updates)
      .eq('id', coId);

    if (error) return fail(dbError(error.message, { coId, newStatus }));
    return { data: null, error: null };
  },

  /**
   * Update change order fields (non-status). Use transitionStatus() for status changes.
   */
  async updateChangeOrder(
    coId: string,
    updates: Partial<ChangeOrder>,
  ): Promise<Result> {
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('change_orders')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('id', coId);

    if (error) return fail(dbError(error.message, { coId }));
    return { data: null, error: null };
  },

  async deleteChangeOrder(coId: string): Promise<Result> {
    const { error } = await supabase
      .from('change_orders')
      .delete()
      .eq('id', coId);

    if (error) return fail(dbError(error.message, { coId }));
    return { data: null, error: null };
  },

  /**
   * Promote an approved change order to the next type in the PCO \u2192 COR \u2192 CO chain.
   * Creates a new record at the next stage linked back via promoted_from_id.
   */
  async promoteType(coId: string): Promise<Result<ChangeOrder>> {
    const { data: co, error: fetchError } = await supabase
      .from('change_orders')
      .select('*')
      .eq('id', coId)
      .single();

    if (fetchError || !co) {
      return fail(notFoundError('Change order', coId));
    }

    const currentType = co.type as ChangeOrderType;
    if (currentType === 'co') {
      return fail(conflictError('Change orders cannot be promoted further', { coId, currentType }));
    }
    if (co.status !== 'approved') {
      return fail(
        conflictError('Only approved change orders can be promoted', { coId, status: co.status }),
      );
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(co.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const nextType: ChangeOrderType = currentType === 'pco' ? 'cor' : 'co';
    const now = new Date().toISOString();

    const promotedPayload: COInsertAugmented = {
      project_id: co.project_id,
      description: co.description,
      title: co.title,
      amount: co.amount,
      approved_amount: (co as Record<string, unknown>).approved_amount as number | null,
      status: 'draft' as ChangeOrderState,
      type: nextType as string,
      reason: co.reason,
      cost_code: co.cost_code,
      schedule_impact: co.schedule_impact,
      parent_co_id: co.id,
    };
    void userId;
    void now;

    const { data: promoted, error: insertError } = await supabase
      .from('change_orders')
      .insert(promotedPayload)
      .select()
      .single();

    if (insertError) return fail(dbError(insertError.message, { coId, nextType }));

    return ok(promoted as ChangeOrder);
  },
};
