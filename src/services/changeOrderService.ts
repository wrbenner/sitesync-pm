import { supabase } from '../lib/supabase';
import { fromTable, selectScoped } from '../lib/db/queries';
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

  const { data } = await fromTable('project_members')
    .select('role')
    .eq('project_id' as never, projectId)
    .eq('user_id' as never, userId)
    .single();

  return (data as unknown as { role?: string } | null)?.role ?? null;
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
    const { data, error } = await selectScoped('change_orders', projectId, '*')
      .order('number', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));

    // Filter soft-deleted records in-memory until database.ts is regenerated
    // post-migration 20260413000004 which added deleted_at to change_orders
    const active = ((data ?? []) as unknown as Array<{ deleted_at: string | null }>).filter((co) => {
      return !co.deleted_at;
    });

    return ok(active as unknown as ChangeOrder[]);
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

    const { data, error } = await fromTable('change_orders')
      .insert(payload as never)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as unknown as ChangeOrder);
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
    const { data: co, error: fetchError } = await fromTable('change_orders')
      .select('status, project_id, type')
      .eq('id' as never, coId)
      .single();

    if (fetchError || !co) {
      return fail(notFoundError('Change order', coId));
    }
    const coRow = co as unknown as { status: string | null; project_id: string; type: string | null };

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(coRow.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = coRow.status as ChangeOrderState;
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
      updated_by: userId,
    };

    if (newStatus === 'approved') {
      updates.approved_date = now;
      updates.approved_by = userId;
      if (comments) updates.approval_comments = comments;
    }
    if (newStatus === 'rejected') {
      updates.rejected_at = now;
      updates.rejected_by = userId;
      if (comments) updates.rejection_comments = comments;
    }

    const { error } = await fromTable('change_orders')
      .update(updates as never)
      .eq('id' as never, coId);

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
    const userId = await getCurrentUserId();
    const { status: _status, ...safeUpdates } = updates as unknown as Record<string, unknown>;

    const { error } = await fromTable('change_orders')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      } as never)
      .eq('id' as never, coId);

    if (error) return fail(dbError(error.message, { coId }));
    return { data: null, error: null };
  },

  async deleteChangeOrder(coId: string): Promise<Result> {
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await fromTable('change_orders')
      .update({
        deleted_at: now,
        deleted_by: userId,
      } as never)
      .eq('id' as never, coId);

    if (error) return fail(dbError(error.message, { coId }));
    return { data: null, error: null };
  },

  /**
   * Promote an approved change order to the next type in the PCO \u2192 COR \u2192 CO chain.
   * Creates a new record at the next stage linked back via promoted_from_id.
   */
  async promoteType(coId: string): Promise<Result<ChangeOrder>> {
    const { data: co, error: fetchError } = await fromTable('change_orders')
      .select('*')
      .eq('id' as never, coId)
      .single();

    if (fetchError || !co) {
      return fail(notFoundError('Change order', coId));
    }
    const coRow = co as unknown as ChangeOrder & { approved_amount?: number | null }

    const currentType = coRow.type as ChangeOrderType;
    if (currentType === 'co') {
      return fail(conflictError('Change orders cannot be promoted further', { coId, currentType }));
    }
    if (coRow.status !== 'approved') {
      return fail(
        conflictError('Only approved change orders can be promoted', { coId, status: coRow.status }),
      );
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(coRow.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const nextType: ChangeOrderType = currentType === 'pco' ? 'cor' : 'co';
    const now = new Date().toISOString();

    const promotedPayload: COInsertAugmented = {
      project_id: coRow.project_id,
      description: coRow.description,
      title: coRow.title,
      amount: coRow.amount,
      // Note: approved_amount in source row is preserved by promoting under amount; the
      // target schema's COInsert doesn't expose approved_amount as an Insert field.
      status: 'draft' as ChangeOrderState,
      type: nextType as string,
      reason: coRow.reason,
      cost_code: coRow.cost_code,
      schedule_impact: coRow.schedule_impact,
      parent_co_id: coRow.id,
      promoted_from_id: coRow.id,
      promoted_at: now,
      created_by: userId,
    };

    const { data: promoted, error: insertError } = await fromTable('change_orders')
      .insert(promotedPayload as never)
      .select()
      .single();

    if (insertError) return fail(dbError(insertError.message, { coId, nextType }));

    // Mark the source CO as promoted (best-effort, don't block on failure)
    await fromTable('change_orders')
      .update({
        promoted_to_id: (promoted as { id?: string } | null)?.id ?? null,
        promoted_at: now,
        updated_by: userId,
      } as never)
      .eq('id' as never, coRow.id);

    return ok(promoted as unknown as ChangeOrder);
  },
};
