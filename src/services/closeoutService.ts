import { supabase } from '../lib/supabase';
import type { CloseoutItemStatus } from '../machines/closeoutMachine';
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
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();
  return data?.role ?? null;
}

/**
 * Role-gated transition map for closeout items, derived from closeoutItemMachine.
 *
 *   required      → requested   (gc/pm)
 *   requested     → submitted   (any non-viewer — sub marks their doc submitted)
 *   submitted     → under_review / approved   (gc/owner/admin/architect)
 *   under_review  → approved / rejected       (gc/owner/admin/architect)
 *   rejected      → submitted                  (any non-viewer — resubmit)
 *   approved      → terminal
 */
function getValidCloseoutTransitions(
  status: CloseoutItemStatus,
  role: string,
): CloseoutItemStatus[] {
  const isGC = [
    'project_manager',
    'superintendent',
    'gc_member',
    'admin',
    'owner',
  ].includes(role);
  const isReviewer = isGC || ['architect', 'designer'].includes(role);
  const nonViewer = role !== 'viewer';

  switch (status) {
    case 'required':
      return isGC ? ['requested'] : [];
    case 'requested':
      return nonViewer ? ['submitted'] : [];
    case 'submitted':
      return isReviewer ? ['under_review', 'approved'] : [];
    case 'under_review':
      return isReviewer ? ['approved', 'rejected'] : [];
    case 'rejected':
      return nonViewer ? ['submitted'] : [];
    case 'approved':
      return [];
    default:
      return [];
  }
}

export const closeoutService = {
  async transitionStatus(
    closeoutItemId: string,
    newStatus: CloseoutItemStatus,
  ): Promise<Result> {
    const { data: item, error: fetchError } = await supabase
      .from('closeout_items')
      .select('status, project_id')
      .eq('id', closeoutItemId)
      .single();

    if (fetchError || !item) {
      return fail(notFoundError('CloseoutItem', closeoutItemId));
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(item.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = (item.status ?? 'required') as CloseoutItemStatus;
    const valid = getValidCloseoutTransitions(currentStatus, role);
    if (!valid.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid closeout transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${valid.join(', ') || '(none)'}`,
          { currentStatus, newStatus, role, valid },
        ),
      );
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'approved') {
      updates.completed_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('closeout_items')
      .update(updates)
      .eq('id', closeoutItemId);

    if (error) return fail(dbError(error.message, { closeoutItemId, newStatus }));
    return { data: null, error: null };
  },

  /**
   * Update closeout item fields (non-status). Strips status to prevent bypass.
   */
  async updateCloseoutItem(
    closeoutItemId: string,
    updates: Record<string, unknown>,
  ): Promise<Result> {
     
    const { status: _status, ...safeUpdates } = updates;

    const { error } = await supabase
      .from('closeout_items')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('id', closeoutItemId);

    if (error) return fail(dbError(error.message, { closeoutItemId }));
    return { data: null, error: null };
  },
};

export { getValidCloseoutTransitions };
