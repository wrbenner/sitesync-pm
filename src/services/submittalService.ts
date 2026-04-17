import { supabase } from '../lib/supabase';
import type { Submittal } from '../types/database';
import type { SubmittalApproval } from '../types/entities';
import type { SubmittalStatus, CreateSubmittalInput } from '../types/submittal';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
} from './errors';
import { validateStatusTransition } from './shared/stateMachineValidator';

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

// ── Service ──────────────────────────────────────────────────────────────────

export const submittalService = {
  async loadSubmittals(projectId: string): Promise<Result<Submittal[]>> {
    const { data, error } = await supabase
      .from('submittals')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('number', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as Submittal[]);
  },

  async createSubmittal(input: CreateSubmittalInput): Promise<Result<Submittal>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('submittals')
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
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as Submittal);
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
    const { data: submittal, error: fetchError } = await supabase
      .from('submittals')
      .select('status, created_by, assigned_to, project_id')
      .eq('id', submittalId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !submittal) {
      return fail(notFoundError('Submittal', submittalId));
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(submittal.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = submittal.status as SubmittalStatus;
    const transitionError = validateStatusTransition('submittal', currentStatus, newStatus, role);
    if (transitionError) return fail(transitionError);

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'submitted') {
      updates.submitted_date = new Date().toISOString();
    }
    if (newStatus === 'approved') {
      updates.approved_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('submittals')
      .update(updates)
      .eq('id', submittalId);

    if (error) return fail(dbError(error.message, { submittalId, newStatus }));
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
    const userId = await getCurrentUserId();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('submittals')
      .update({ ...safeUpdates, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', submittalId);

    if (error) return fail(dbError(error.message, { submittalId }));
    return { data: null, error: null };
  },

  async deleteSubmittal(submittalId: string): Promise<Result> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('submittals')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      } as Record<string, unknown>)
      .eq('id', submittalId);

    if (error) return fail(dbError(error.message, { submittalId }));
    return { data: null, error: null };
  },

  async loadApprovals(submittalId: string): Promise<Result<SubmittalApproval[]>> {
    const { data, error } = await supabase
      .from('submittal_approvals')
      .select('*')
      .eq('submittal_id', submittalId)
      .order('reviewed_at');

    if (error) return fail(dbError(error.message, { submittalId }));
    return ok((data ?? []) as SubmittalApproval[]);
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

    const { data: submittal, error: fetchError } = await supabase
      .from('submittals')
      .select('project_id')
      .eq('id', submittalId)
      .single();

    if (fetchError || !submittal) {
      return fail(notFoundError('Submittal', submittalId));
    }

    const role = await resolveProjectRole(submittal.project_id, userId);

    const { error: insertError } = await supabase
      .from('submittal_approvals')
      .insert({
        submittal_id: submittalId,
        approver_id: userId,
        stamp,
        role,
        status: stamp === 'approved' || stamp === 'approved_as_noted' ? 'approved' : 'rejected',
        comments: comments ?? null,
        reviewed_at: new Date().toISOString(),
      });

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
    const { data: parent, error: fetchError } = await supabase
      .from('submittals')
      .select('*')
      .eq('id', parentSubmittalId)
      .single();

    if (fetchError || !parent) {
      return fail(notFoundError('Submittal', parentSubmittalId));
    }

    const userId = await getCurrentUserId();
    const nextRevision = (parent.revision_number ?? 1) + 1;

    const { data, error } = await supabase
      .from('submittals')
      .insert({
        project_id: parent.project_id,
        title: parent.title,
        status: 'draft' as SubmittalStatus,
        spec_section: parent.spec_section,
        assigned_to: parent.assigned_to,
        subcontractor: parent.subcontractor,
        due_date: parent.due_date,
        submit_by_date: parent.submit_by_date,
        required_onsite_date: parent.required_onsite_date,
        lead_time_weeks: parent.lead_time_weeks,
        parent_submittal_id: parentSubmittalId,
        revision_number: nextRevision,
        created_by: userId,
      } as Record<string, unknown>)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { parentSubmittalId }));
    return ok(data as Submittal);
  },
};
