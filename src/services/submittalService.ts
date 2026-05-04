import { supabase } from '../lib/supabase';
import { fromTable } from '../lib/db/queries';
import type { Submittal } from '../types/database';
import type { SubmittalApproval } from '../types/entities';
import type { SubmittalStatus, CreateSubmittalInput } from '../types/submittal';
import { getValidSubmittalStatusTransitions } from '../machines/submittalMachine';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  validationError,
} from './errors';

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

// ── Service ──────────────────────────────────────────────────────────────────

export const submittalService = {
  async loadSubmittals(projectId: string): Promise<Result<Submittal[]>> {
    const { data, error } = await fromTable('submittals')
      .select('*')
      .eq('project_id' as never, projectId)
      .is('deleted_at' as never, null)
      .order('number', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as unknown as Submittal[]);
  },

  async createSubmittal(input: CreateSubmittalInput): Promise<Result<Submittal>> {
    const userId = await getCurrentUserId();

    const { data, error } = await fromTable('submittals')
      .insert({
        project_id: input.project_id,
        title: input.title,
        status: 'draft' as SubmittalStatus,
        spec_section: input.spec_section ?? null,
        assigned_to: input.assigned_to ?? null,
        subcontractor: input.subcontractor ?? null,
        due_date: input.due_date ?? null,
        submit_by_date: input.submit_by_date ?? null,
        required_onsite_date: input.required_onsite_date ?? null,
        lead_time_weeks: input.lead_time_weeks ?? null,
        parent_submittal_id: input.parent_submittal_id ?? null,
        revision_number: input.parent_submittal_id ? null : 1,
        created_by: userId,
      } as never)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as unknown as Submittal);
  },

  /**
   * Transition submittal status with lifecycle enforcement.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   *
   * Validates that:
   *   1. The submittal exists and is not deleted
   *   2. The user has a project role
   *   3. The transition is valid per submittalMachine for that role
   */
  async transitionStatus(
    submittalId: string,
    newStatus: SubmittalStatus,
  ): Promise<Result> {
    const { data: submittal, error: fetchError } = await fromTable('submittals')
      .select('status, created_by, assigned_to, project_id')
      .eq('id' as never, submittalId)
      .is('deleted_at' as never, null)
      .single();

    if (fetchError || !submittal) {
      return fail(notFoundError('Submittal', submittalId));
    }
    const submittalRow = submittal as unknown as { status: string | null; created_by: string | null; assigned_to: string | null; project_id: string }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(submittalRow.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = submittalRow.status as SubmittalStatus;
    const validTransitions = getValidSubmittalStatusTransitions(currentStatus, role);
    if (!validTransitions.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid transition: ${currentStatus} to ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ')}`,
          { currentStatus, newStatus, role, validTransitions },
        ),
      );
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    if (newStatus === 'submitted') {
      updates.submitted_date = new Date().toISOString();
    }
    if (newStatus === 'approved') {
      updates.approved_date = new Date().toISOString();
    }

    const { error } = await fromTable('submittals')
      .update(updates as never)
      .eq('id' as never, submittalId);

    if (error) return fail(dbError(error.message, { submittalId, newStatus }));

    // Cross-feature workflows: a rejected submittal drafts an RFI; an
    // approved submittal posts a procurement suggestion. Fire-and-forget.
    if (newStatus === 'rejected') {
      void import('../lib/crossFeatureWorkflows')
        .then(({ runSubmittalRejectedChain }) => runSubmittalRejectedChain(submittalId))
        .then((result) => {
          if (result.error) console.warn('[submittal_rejected chain]', result.error);
          else if (result.created) console.info('[submittal_rejected chain] created', result.created);
        })
        .catch((err) => console.warn('[submittal_rejected chain] dispatch failed:', err));
    } else if (newStatus === 'approved') {
      void import('../lib/crossFeatureWorkflows')
        .then(({ runSubmittalApprovedChain }) => runSubmittalApprovedChain(submittalId))
        .then((result) => {
          if (result.error) console.warn('[submittal_approved chain]', result.error);
          else if (result.created) console.info('[submittal_approved chain] created', result.created);
        })
        .catch((err) => console.warn('[submittal_approved chain] dispatch failed:', err));
    }

    return { data: null, error: null };
  },

  /**
   * Update submittal fields (non-status). Strips status to prevent state machine bypass.
   * Use transitionStatus() for status changes.
   */
  async updateSubmittal(
    submittalId: string,
    updates: Partial<Submittal>,
  ): Promise<Result> {
    const { status: _status, ...safeUpdates } = updates as unknown as Record<string, unknown>;

    const { error } = await fromTable('submittals')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, submittalId);

    if (error) return fail(dbError(error.message, { submittalId }));
    return { data: null, error: null };
  },

  async deleteSubmittal(submittalId: string): Promise<Result> {
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await fromTable('submittals')
      .update({
        deleted_at: now,
        deleted_by: userId,
      } as never)
      .eq('id' as never, submittalId);

    if (error) return fail(dbError(error.message, { submittalId }));
    return { data: null, error: null };
  },

  async loadApprovals(submittalId: string): Promise<Result<SubmittalApproval[]>> {
    const { data, error } = await fromTable('submittal_approvals')
      .select('*')
      .eq('submittal_id' as never, submittalId)
      .order('reviewed_at');

    if (error) return fail(dbError(error.message, { submittalId }));
    return ok((data ?? []) as unknown as SubmittalApproval[]);
  },

  /**
   * Record an approval stamp and atomically transition submittal status.
   *
   * IMPORTANT: If the approval inserts but the status transition fails, the
   * caller receives an error describing the partial failure. The approval
   * record will exist (no cross-table transactions in Supabase client).
   */
  async addApproval(
    submittalId: string,
    stamp: 'approved' | 'approved_as_noted' | 'rejected' | 'revise_and_resubmit',
    comments?: string,
  ): Promise<Result> {
    const userId = await getCurrentUserId();

    const { data: submittal, error: fetchError } = await fromTable('submittals')
      .select('project_id')
      .eq('id' as never, submittalId)
      .single();

    if (fetchError || !submittal) {
      return fail(notFoundError('Submittal', submittalId));
    }
    const submittalRow = submittal as unknown as { project_id: string }

    const role = await resolveProjectRole(submittalRow.project_id, userId);

    const { error: insertError } = await fromTable('submittal_approvals')
      .insert({
        submittal_id: submittalId,
        approver_id: userId,
        stamp,
        role,
        status: stamp === 'approved' || stamp === 'approved_as_noted' ? 'approved' : 'rejected',
        comments: comments ?? null,
        reviewed_at: new Date().toISOString(),
      } as never);

    if (insertError) {
      return fail(dbError(`Failed to record approval: ${insertError.message}`, { submittalId }));
    }

    const targetStatus: SubmittalStatus =
      stamp === 'approved' || stamp === 'approved_as_noted'
        ? 'approved'
        : stamp === 'revise_and_resubmit'
        ? 'resubmit'
        : 'rejected';

    const transitionResult = await submittalService.transitionStatus(submittalId, targetStatus);
    if (transitionResult.error) {
      return fail({
        ...transitionResult.error,
        message: `Approval recorded but status transition failed: ${transitionResult.error.message}`,
        userMessage:
          'Approval saved but the status could not be updated. Please refresh and retry.',
      });
    }

    return { data: null, error: null };
  },

  /**
   * Create a new revision of a rejected or revise-and-resubmit submittal.
   * Links to parent via parent_submittal_id and increments revision_number.
   */
  async createRevision(parentSubmittalId: string): Promise<Result<Submittal>> {
    const { data: parent, error: fetchError } = await fromTable('submittals')
      .select('*')
      .eq('id' as never, parentSubmittalId)
      .single();

    if (fetchError || !parent) {
      return fail(notFoundError('Submittal', parentSubmittalId));
    }
    const parentRow = parent as unknown as Submittal

    const userId = await getCurrentUserId();
    const nextRevision = (parentRow.revision_number ?? 1) + 1;

    const { data, error } = await fromTable('submittals')
      .insert({
        project_id: parentRow.project_id,
        title: parentRow.title,
        status: 'draft' as SubmittalStatus,
        spec_section: parentRow.spec_section,
        assigned_to: parentRow.assigned_to,
        subcontractor: parentRow.subcontractor,
        due_date: parentRow.due_date,
        submit_by_date: parentRow.submit_by_date,
        required_onsite_date: parentRow.required_onsite_date,
        lead_time_weeks: parentRow.lead_time_weeks,
        parent_submittal_id: parentSubmittalId,
        revision_number: nextRevision,
        created_by: userId,
      } as never)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { parentSubmittalId }));
    return ok(data as unknown as Submittal);
  },
};
