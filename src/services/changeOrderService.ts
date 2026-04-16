import { supabase } from '../lib/supabase';
import {
  getValidCOTransitions,
  getNextCOStatus,
  getNextCOType,
} from '../machines/changeOrderMachine';
import type { ChangeOrderState, ChangeOrderType, ReasonCode } from '../machines/changeOrderMachine';

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

/**
 * Full change order record including all pipeline and provenance fields.
 *
 * Includes fields from:
 *   - Initial schema (id, project_id, number, type, status, title, etc.)
 *   - 00030_change_order_pipeline (reason_code, cost tracking, approval chain)
 *   - 20260413000003_provenance_columns (created_by, updated_by)
 *   - 20260413000004_soft_delete_groundwork (deleted_at, deleted_by)
 *
 * The database types in src/types/database.ts are auto-generated from an
 * older schema snapshot and do not include the pipeline columns. This
 * interface is the authoritative TypeScript representation of the full row.
 *
 * Financial note: estimated_cost, submitted_cost, approved_cost, and
 * approved_amount are stored as NUMERIC in PostgreSQL (arbitrary precision).
 * They surface as number in JavaScript. Always round to 2 decimal places
 * before display and never use floating-point arithmetic on these values
 * for accumulation. Use integer cents for summation if needed.
 */
export interface ChangeOrderRecord {
  // Base fields
  id: string;
  project_id: string;
  number: number;
  type: string | null;
  status: string | null;
  title: string | null;
  description: string;
  amount: number | null;
  approved_amount: number | null;
  approved_date: string | null;
  cost_code: string | null;
  reason: string | null;
  requested_by: string | null;
  requested_date: string | null;
  schedule_impact: string | null;
  parent_co_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Pipeline fields (00030_change_order_pipeline)
  reason_code: ReasonCode | null;
  estimated_cost: number | null;
  submitted_cost: number | null;
  approved_cost: number | null;
  schedule_impact_days: number | null;
  budget_line_item_id: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_comments: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_comments: string | null;
  promoted_from_id: string | null;
  promoted_at: string | null;
  // Provenance (20260413000003_provenance_columns)
  created_by: string | null;
  updated_by: string | null;
  // Soft-delete (20260413000004_soft_delete_groundwork)
  deleted_at: string | null;
  deleted_by: string | null;
}

export type CreateChangeOrderInput = {
  project_id: string;
  title: string;
  description: string;
  type: ChangeOrderType;
  reason_code?: ReasonCode;
  cost_code?: string;
  estimated_cost?: number;
  schedule_impact_days?: number;
  budget_line_item_id?: string;
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
   * Ordered by number descending so newest appears first.
   */
  async loadChangeOrders(
    projectId: string,
  ): Promise<ChangeOrderServiceResult<ChangeOrderRecord[]>> {
    const { data, error } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('number', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as unknown as ChangeOrderRecord[], error: null };
  },

  /**
   * Create a new change order in 'draft' status with provenance.
   * The auto_number_change_order trigger assigns the sequence number.
   */
  async createChangeOrder(
    input: CreateChangeOrderInput,
  ): Promise<ChangeOrderServiceResult<ChangeOrderRecord>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('change_orders')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description,
        type: input.type,
        status: 'draft',
        reason_code: input.reason_code ?? null,
        cost_code: input.cost_code ?? null,
        estimated_cost: input.estimated_cost ?? 0,
        schedule_impact_days: input.schedule_impact_days ?? 0,
        budget_line_item_id: input.budget_line_item_id ?? null,
        parent_co_id: input.parent_co_id ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as unknown as ChangeOrderRecord, error: null };
  },

  /**
   * Transition a change order's status via a named action.
   *
   * IMPORTANT: This method resolves the user's authoritative role from the
   * database. It does NOT accept caller-supplied roles.
   *
   * Validates that:
   *   1. The change order exists
   *   2. The user has a project role
   *   3. The action is valid per changeOrderMachine for the current state and type
   *
   * Actions: 'Submit for Review', 'Void', 'Revise and Resubmit',
   *          'Return to PCO', 'Return to COR'
   * Use approveChangeOrder() or rejectChangeOrder() for Approve/Reject
   * because those transitions require additional financial/comment data.
   */
  async transitionStatus(
    coId: string,
    action: string,
  ): Promise<ChangeOrderServiceResult> {
    // 1. Fetch current state
    const { data: co, error: fetchError } = await supabase
      .from('change_orders')
      .select('status, type, project_id, created_by')
      .eq('id', coId)
      .single();

    if (fetchError || !co) {
      return { data: null, error: fetchError?.message ?? 'Change order not found' };
    }

    // 2. Resolve authoritative role
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(co.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Validate action against state machine
    const currentStatus = co.status as ChangeOrderState;
    const coType = co.type as ChangeOrderType;
    const validActions = getValidCOTransitions(currentStatus, coType);

    if (!validActions.includes(action)) {
      return {
        data: null,
        error: `Invalid action: "${action}" from ${currentStatus} (role: ${role}). Valid: ${validActions.join(', ')}`,
      };
    }

    const newStatus = getNextCOStatus(currentStatus, action);
    if (!newStatus) {
      return { data: null, error: `Could not determine next status for action: ${action}` };
    }

    // 4. Execute transition with provenance
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (action === 'Submit for Review') {
      updates.submitted_by = userId;
      updates.submitted_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('change_orders')
      .update(updates)
      .eq('id', coId);

    if (updateError) return { data: null, error: updateError.message };
    return { data: null, error: null };
  },

  /**
   * Approve a change order with optional final cost override.
   *
   * Records approved_by, approved_at, and optionally approved_cost.
   * Financial values are stored as NUMERIC (arbitrary precision).
   * Pass integer cents or a well-bounded decimal. Do NOT pass accumulated
   * floating-point sums directly.
   *
   * Only valid from 'pending_review' status.
   */
  async approveChangeOrder(
    coId: string,
    approvedCost?: number,
    comments?: string,
  ): Promise<ChangeOrderServiceResult> {
    const { data: co, error: fetchError } = await supabase
      .from('change_orders')
      .select('status, project_id, estimated_cost, amount')
      .eq('id', coId)
      .single();

    if (fetchError || !co) {
      return { data: null, error: fetchError?.message ?? 'Change order not found' };
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(co.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    const currentStatus = co.status as ChangeOrderState;
    if (currentStatus !== 'pending_review') {
      return {
        data: null,
        error: `Cannot approve from status: ${currentStatus}. Must be pending_review.`,
      };
    }

    // Resolve final cost: caller override > estimated_cost > amount > 0
    const finalCost = approvedCost ??
      (co as Record<string, unknown>).estimated_cost as number ??
      co.amount ??
      0;

    const updates: Record<string, unknown> = {
      status: 'approved' as ChangeOrderState,
      approved_by: userId,
      approved_at: new Date().toISOString(),
      approved_date: new Date().toISOString(),
      approved_cost: finalCost,
      approved_amount: finalCost,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (comments) {
      updates.approval_comments = comments;
    }

    const { error: updateError } = await supabase
      .from('change_orders')
      .update(updates)
      .eq('id', coId);

    if (updateError) return { data: null, error: updateError.message };
    return { data: null, error: null };
  },

  /**
   * Reject a change order. Rejection comments are required by construction
   * workflow — the GC must document the reason for owner traceability.
   *
   * Only valid from 'pending_review' status.
   */
  async rejectChangeOrder(
    coId: string,
    comments: string,
  ): Promise<ChangeOrderServiceResult> {
    if (!comments?.trim()) {
      return { data: null, error: 'Rejection comments are required' };
    }

    const { data: co, error: fetchError } = await supabase
      .from('change_orders')
      .select('status, project_id')
      .eq('id', coId)
      .single();

    if (fetchError || !co) {
      return { data: null, error: fetchError?.message ?? 'Change order not found' };
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(co.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    const currentStatus = co.status as ChangeOrderState;
    if (currentStatus !== 'pending_review') {
      return {
        data: null,
        error: `Cannot reject from status: ${currentStatus}. Must be pending_review.`,
      };
    }

    const { error: updateError } = await supabase
      .from('change_orders')
      .update({
        status: 'rejected' as ChangeOrderState,
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_comments: comments,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coId);

    if (updateError) return { data: null, error: updateError.message };
    return { data: null, error: null };
  },

  /**
   * Promote an approved CO to the next pipeline stage (PCO > COR > CO).
   *
   * Creates a new CO at the next type with:
   *   - Status reset to 'draft' for the new approval cycle
   *   - estimated_cost pre-populated from the source's approved_cost
   *   - promoted_from_id linking back to the source
   *
   * Marks the source CO with promoted_at so the pipeline view can show it
   * as promoted rather than simply approved.
   *
   * Returns the newly created promoted CO.
   * Only valid on approved PCOs and CORs.
   */
  async promoteChangeOrder(
    coId: string,
  ): Promise<ChangeOrderServiceResult<ChangeOrderRecord>> {
    const { data: source, error: fetchError } = await supabase
      .from('change_orders')
      .select('*')
      .eq('id', coId)
      .single();

    if (fetchError || !source) {
      return { data: null, error: fetchError?.message ?? 'Change order not found' };
    }

    const coType = source.type as ChangeOrderType;
    const nextType = getNextCOType(coType);

    if (!nextType) {
      return {
        data: null,
        error: `Cannot promote: "${coType}" is the final stage in the pipeline`,
      };
    }

    if (source.status !== 'approved') {
      return {
        data: null,
        error: `Only approved change orders can be promoted. Current status: ${source.status}`,
      };
    }

    const userId = await getCurrentUserId();
    const sourceRecord = source as unknown as ChangeOrderRecord;

    // Carry over the approved cost as the new estimated cost
    const nextEstimatedCost = sourceRecord.approved_cost ?? source.amount ?? 0;

    const { data: promoted, error: insertError } = await supabase
      .from('change_orders')
      .insert({
        project_id: source.project_id,
        title: source.title,
        description: source.description,
        type: nextType,
        status: 'draft',
        reason_code: sourceRecord.reason_code,
        cost_code: source.cost_code,
        estimated_cost: nextEstimatedCost,
        submitted_cost: nextEstimatedCost,
        schedule_impact_days: sourceRecord.schedule_impact_days ?? 0,
        budget_line_item_id: sourceRecord.budget_line_item_id,
        parent_co_id: source.id,
        promoted_from_id: source.id,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      return {
        data: null,
        error: `Failed to create promoted change order: ${insertError.message}`,
      };
    }

    // Mark source as promoted (non-fatal if this update fails — log but continue)
    const { error: markError } = await supabase
      .from('change_orders')
      .update({
        promoted_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coId);

    if (markError) {
      console.warn('[changeOrderService.promoteChangeOrder] Could not mark source as promoted:', markError.message);
    }

    return { data: promoted as unknown as ChangeOrderRecord, error: null };
  },

  /**
   * Update change order fields (non-status). Populates updated_by.
   *
   * Status changes are intentionally blocked. Use:
   *   transitionStatus()    for Submit/Void/Revise
   *   approveChangeOrder()  for Approve (with financial data)
   *   rejectChangeOrder()   for Reject (with required comments)
   *   promoteChangeOrder()  for PCO > COR > CO promotion
   */
  async updateChangeOrder(
    coId: string,
    updates: Partial<ChangeOrderRecord>,
  ): Promise<ChangeOrderServiceResult> {
    const userId = await getCurrentUserId();

    // Strip status to prevent accidental status bypass via this method
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('change_orders')
      .update({
        ...safeUpdates,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete a change order.
   * The RLS SELECT policy filters deleted_at IS NOT NULL, so soft-deleted
   * rows are invisible to subsequent loadChangeOrders() calls.
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
};
