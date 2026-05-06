import { supabase } from '../lib/supabase';
import { fromTable } from '../lib/db/queries';
import type { Submittal } from '../types/database';
import type { SubmittalApproval } from '../types/entities';
import type {
  SubmittalStatus,
  CreateSubmittalInput,
  SubmittalDisposition,
  SubmittalRequiredOnSiteCalc,
} from '../types/submittal';
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

  /**
   * Read from the materialized log view (D37). Used by the Phase 1 page shell
   * to populate the slim inline strip + Items list. The view is project-
   * scoped; the underlying submittals RLS already gates row visibility, but
   * the view itself exposes a convenient denormalised shape (sub_name,
   * current_reviewer_name, days_in_court, risk_band).
   */
  async loadSubmittalsLogView(projectId: string): Promise<Result<Array<Record<string, unknown>>>> {
    const { data, error } = await fromTable('submittals_log_mv')
      .select('*')
      .eq('project_id' as never, projectId)
      .order('number', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as unknown as Array<Record<string, unknown>>);
  },

  async createSubmittal(input: CreateSubmittalInput): Promise<Result<Submittal>> {
    const userId = await getCurrentUserId();

    const { data, error } = await fromTable('submittals')
      .insert({
        project_id: input.project_id,
        title: input.title,
        status: 'draft' as SubmittalStatus,
        spec_section: input.spec_section ?? null,
        csi_division: input.csi_division ?? null,
        csi_section: input.csi_section ?? null,
        spec_section_paragraph: input.spec_section_paragraph ?? null,
        spec_pdf_page: input.spec_pdf_page ?? null,
        kind: input.kind ?? null,
        assigned_to: input.assigned_to ?? null,
        subcontractor: input.subcontractor ?? null,
        responsible_sub_id: input.responsible_sub_id ?? null,
        due_date: input.due_date ?? null,
        submit_by_date: input.submit_by_date ?? null,
        required_onsite_date: input.required_onsite_date ?? null,
        required_on_site_date: input.required_on_site_date ?? input.required_onsite_date ?? null,
        lead_time_weeks: input.lead_time_weeks ?? null,
        schedule_activity_id: input.schedule_activity_id ?? null,
        is_critical_path: input.is_critical_path ?? false,
        is_federal: input.is_federal ?? false,
        is_private: input.is_private ?? false,
        parent_submittal_id: input.parent_submittal_id ?? null,
        revision_number: input.parent_submittal_id ? null : 1,
        rev_number: 0,
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
   * Calls the D37 RPC `submittal_advance_status` which is hash-chained,
   * audit-logged, and emits a telemetry event. The XState machine defines
   * which transitions are valid for which roles; this service enforces it
   * client-side BEFORE the RPC so the user sees a clear error message
   * (the RPC trusts the caller and only enforces RLS + integrity).
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
    const submittalRow = submittal as unknown as { status: string | null; created_by: string | null; assigned_to: string | null; project_id: string };

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

    const { error } = await supabase.rpc('submittal_advance_status' as never, {
      p_id: submittalId,
      p_to: newStatus,
      p_actor: userId,
      p_reason: null,
    } as never);

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
    void _status;

    const { error } = await fromTable('submittals')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, submittalId);

    if (error) return fail(dbError(error.message, { submittalId }));
    return { data: null, error: null };
  },

  /**
   * Bulk update — D38. Restricted to a small set of columns the server
   * has explicit consent to change in batch. Status is excluded (use
   * transitionStatus per row).
   */
  async bulkUpdate(
    ids: string[],
    updates: Partial<Pick<Submittal, 'current_reviewer_id' | 'responsible_sub_id' | 'submittal_package_id' | 'is_private' | 'is_critical_path'>>,
  ): Promise<Result<{ count: number }>> {
    if (ids.length === 0) return ok({ count: 0 });
    const { error, count } = await fromTable('submittals')
      .update({ ...updates, updated_at: new Date().toISOString() } as never, { count: 'exact' })
      .in('id' as never, ids);

    if (error) return fail(dbError(error.message, { ids: ids.length }));
    return ok({ count: count ?? 0 });
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
   * Legacy entry point used by the existing detail page. The newer
   * recordDisposition() call (below) writes through the D37
   * `submittal_record_disposition` RPC against the canonical
   * `submittal_reviewers` table; the legacy `submittal_approvals` table
   * is preserved alongside until the data migration in D39+ ships.
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
    const submittalRow = submittal as unknown as { project_id: string };

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
   * D38: write a disposition through the D37 RPC. The reviewerId targets a
   * row in `submittal_reviewers` (the canonical chain table from D36).
   */
  async recordDisposition(
    reviewerId: string,
    disposition: SubmittalDisposition,
    comment?: string,
    stampUrl?: string,
  ): Promise<Result> {
    const { error } = await supabase.rpc('submittal_record_disposition' as never, {
      p_reviewer_id: reviewerId,
      p_disposition: disposition,
      p_comment: comment ?? null,
      p_stamp_url: stampUrl ?? null,
    } as never);

    if (error) return fail(dbError(error.message, { reviewerId }));
    return { data: null, error: null };
  },

  async distribute(submittalId: string, toUserIds: string[]): Promise<Result> {
    const { error } = await supabase.rpc('submittal_distribute' as never, {
      p_id: submittalId,
      p_to_user_ids: toUserIds,
    } as never);
    if (error) return fail(dbError(error.message, { submittalId }));
    return { data: null, error: null };
  },

  async close(submittalId: string, reason?: string): Promise<Result> {
    const { error } = await supabase.rpc('submittal_close' as never, {
      p_id: submittalId,
      p_reason: reason ?? null,
    } as never);
    if (error) return fail(dbError(error.message, { submittalId }));
    return { data: null, error: null };
  },

  async computeRequiredOnSite(submittalId: string): Promise<Result<SubmittalRequiredOnSiteCalc>> {
    const { data, error } = await supabase.rpc('submittal_compute_required_on_site' as never, {
      p_id: submittalId,
    } as never);
    if (error) return fail(dbError(error.message, { submittalId }));
    return ok(data as unknown as SubmittalRequiredOnSiteCalc);
  },

  async replaceUser(oldUserId: string, newUserId: string): Promise<Result<{ count: number }>> {
    const { data, error } = await supabase.rpc('submittal_replace_user' as never, {
      p_old: oldUserId,
      p_new: newUserId,
    } as never);
    if (error) return fail(dbError(error.message, { oldUserId, newUserId }));
    return ok({ count: (data as unknown as number) ?? 0 });
  },

  /**
   * Create a new revision. Uses the D37 `submittal_create_revision` RPC
   * which atomically copies the parent fields and increments the chain.
   */
  async createRevision(parentSubmittalId: string): Promise<Result<Submittal>> {
    const { data, error } = await supabase.rpc('submittal_create_revision' as never, {
      p_parent_id: parentSubmittalId,
    } as never);

    if (error) return fail(dbError(error.message, { parentSubmittalId }));
    return ok(data as unknown as Submittal);
  },
};
