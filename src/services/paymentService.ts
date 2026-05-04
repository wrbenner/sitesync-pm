import { supabase } from '../lib/supabase';
import { fromTable } from '../lib/db/queries';
import type { PaymentStatus } from '../machines/paymentMachine';
import {
  type Result,
  dbError,
  fail,
  notFoundError,
  permissionError,
  validationError,
} from './errors';

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

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

/**
 * Role-gated transition map for pay applications, derived from paymentMachine.
 *
 *   draft          → submitted (any non-viewer), void (gc/owner/admin)
 *   submitted      → gc_review (gc roles), rejected (gc), void (gc/owner/admin)
 *   gc_review      → approved (owner/admin), owner_review (gc forwards), rejected (owner), void
 *   owner_review   → approved (owner/admin), rejected (owner), void
 *   approved       → paid (owner/admin), void (owner/admin)
 *   rejected       → draft (any non-viewer), void (gc/owner/admin)
 *   paid/void      → terminal
 */
function getValidPaymentTransitions(
  status: PaymentStatus,
  role: string,
): PaymentStatus[] {
  const isGC = ['project_manager', 'gc_member', 'admin', 'owner'].includes(role);
  const isOwner = ['owner', 'admin'].includes(role);
  const nonViewer = role !== 'viewer';
  const canVoid = isGC || isOwner;

  switch (status) {
    case 'draft':
      return [
        ...(nonViewer ? (['submitted'] as PaymentStatus[]) : []),
        ...(canVoid ? (['void'] as PaymentStatus[]) : []),
      ];
    case 'submitted':
      return [
        ...(isGC ? (['gc_review', 'rejected'] as PaymentStatus[]) : []),
        ...(canVoid ? (['void'] as PaymentStatus[]) : []),
      ];
    case 'gc_review':
      return [
        ...(isGC ? (['owner_review'] as PaymentStatus[]) : []),
        ...(isOwner ? (['approved', 'rejected'] as PaymentStatus[]) : []),
        ...(canVoid ? (['void'] as PaymentStatus[]) : []),
      ];
    case 'owner_review':
      return [
        ...(isOwner ? (['approved', 'rejected'] as PaymentStatus[]) : []),
        ...(canVoid ? (['void'] as PaymentStatus[]) : []),
      ];
    case 'approved':
      return [
        ...(isOwner ? (['paid'] as PaymentStatus[]) : []),
        ...(canVoid ? (['void'] as PaymentStatus[]) : []),
      ];
    case 'rejected':
      return [
        ...(nonViewer ? (['draft'] as PaymentStatus[]) : []),
        ...(canVoid ? (['void'] as PaymentStatus[]) : []),
      ];
    case 'paid':
    case 'void':
      return [];
    default:
      return [];
  }
}

export const paymentService = {
  /**
   * Transition pay application status with lifecycle enforcement.
   * Resolves user role from project_members. Does NOT trust caller-supplied roles.
   */
  async transitionStatus(
    payApplicationId: string,
    newStatus: PaymentStatus,
  ): Promise<Result> {
    const { data: app, error: fetchError } = await fromTable('pay_applications')
      .select('status, project_id')
      .eq('id' as never, payApplicationId)
      .single();

    if (fetchError || !app) {
      return fail(notFoundError('PayApplication', payApplicationId));
    }
    const appRow = app as unknown as { status: string | null; project_id: string };

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(appRow.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = (appRow.status ?? 'draft') as PaymentStatus;
    const valid = getValidPaymentTransitions(currentStatus, role);
    if (!valid.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid pay application transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${valid.join(', ') || '(none)'}`,
          { currentStatus, newStatus, role, valid },
        ),
      );
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'submitted') updates.submitted_date = new Date().toISOString();
    if (newStatus === 'approved') {
      updates.certified_date = new Date().toISOString();
      updates.certified_by = userId;
    }
    if (newStatus === 'paid') updates.paid_date = new Date().toISOString();

    const { error } = await fromTable('pay_applications')
      .update(updates as never)
      .eq('id' as never, payApplicationId);

    if (error) return fail(dbError(error.message, { payApplicationId, newStatus }));
    return { data: null, error: null };
  },

  /**
   * Update pay application fields (non-status). Strips status to prevent state machine bypass.
   * Use transitionStatus() for status changes.
   */
  async updatePayApplication(
    payApplicationId: string,
    updates: Record<string, unknown>,
  ): Promise<Result> {
     
    const { status: _status, ...safeUpdates } = updates;

    const { error } = await fromTable('pay_applications')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, payApplicationId);

    if (error) return fail(dbError(error.message, { payApplicationId }));
    return { data: null, error: null };
  },
};

export { getValidPaymentTransitions };
