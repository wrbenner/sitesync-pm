import { supabase } from '../lib/supabase';
import type { Submittal } from '../types/database';
import type { SubmittalApproval } from '../types/entities';
import type { SubmittalStatus, CreateSubmittalInput, SubmittalServiceResult } from '../types/submittal';
import { getValidSubmittalStatusTransitions } from '../machines/submittalMachine';

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

// ── Service ──────────────────────────────────────────────────────────────────

export const submittalService = {
  /**
   * Load all active (non-deleted) submittals for a project.
   * Filters on deleted_at IS NULL (column added via migration 20260413000004).
   */
  async loadSubmittals(projectId: string): Promise<SubmittalServiceResult<Submittal[]>> {
    const { data, error } = await supabase
      .from('submittals')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('number', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as Submittal[], error: null };
  },

  /**
   * Create a new submittal in 'draft' status with provenance.
   * Status is always 'draft' at creation — use transitionStatus() to advance.
   */
  async createSubmittal(
    input: CreateSubmittalInput,
  ): Promise<SubmittalServiceResult<Submittal>> {
    const userId = await getCurrentUserId();

    const insert: Record<string, unknown> = {
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
    };

    const { data, error } = await supabase
      .from('submittals')
      .insert(insert)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Submittal, error: null };
  },

  /**
   * Transition submittal status with lifecycle enforcement.
   *
   * IMPORTANT: This method resolves the user's authoritative role from the
   * database. It does NOT accept caller-supplied roles.
   *
   * Validates that:
   *   1. The submittal exists and is not deleted
   *   2. The user has a project role
   *   3. The transition is valid per submittalMachine for that role
   *
   * Writes provenance timestamps on key transitions:
   *   submitted_date when entering 'submitted'
   *   approved_date when entering 'approved'
   */
  async transitionStatus(
    submittalId: string,
    newStatus: SubmittalStatus,
  ): Promise<SubmittalServiceResult> {
    // 1. Fetch current submittal
    const { data: submittal, error: fetchError } = await supabase
      .from('submittals')
      .select('status, created_by, assigned_to, project_id')
      .eq('id', submittalId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !submittal) {
      return { data: null, error: fetchError?.message ?? 'Submittal not found' };
    }

    // 2. Resolve authoritative role — do NOT trust caller
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(submittal.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Validate transition against machine rules for this role
    const currentStatus = submittal.status as SubmittalStatus;
    const validTransitions = getValidSubmittalStatusTransitions(currentStatus, role);
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
      updated_at: new Date().toISOString(),
    };

    // Lifecycle timestamps
    if (newStatus === 'submitted') {
      updates.submitted_date = new Date().toISOString();
    }
    if (newStatus === 'approved') {
      updates.approved_date = new Date().toISOString();
    }
    // Revision: reset to draft increments revision_number — handled by createRevision()

    const { error } = await supabase
      .from('submittals')
      .update(updates)
      .eq('id', submittalId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update submittal fields (non-status). Populates updated_by and updated_at.
   * Use transitionStatus() for status changes.
   */
  async updateSubmittal(
    submittalId: string,
    updates: Partial<Submittal>,
  ): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();
    // Strip status to prevent bypassing the state machine
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('submittals')
      .update({ ...safeUpdates, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', submittalId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete a submittal.
   * Sets deleted_at and deleted_by (columns added via migration 20260413000004).
   */
  async deleteSubmittal(submittalId: string): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('submittals')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      } as Record<string, unknown>)
      .eq('id', submittalId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Load approval records for a submittal (GC and architect stamps).
   */
  async loadApprovals(
    submittalId: string,
  ): Promise<SubmittalServiceResult<SubmittalApproval[]>> {
    const { data, error } = await supabase
      .from('submittal_approvals')
      .select('*')
      .eq('submittal_id', submittalId)
      .order('reviewed_at');

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as SubmittalApproval[], error: null };
  },

  /**
   * Record an approval, rejection, or revision stamp on a submittal.
   *
   * Atomically:
   *   1. Inserts the approval record with reviewer provenance.
   *   2. Transitions the submittal status to match the stamp outcome.
   *
   * IMPORTANT: If the approval inserts but the status transition fails, the
   * operation is reported as an error. The approval record will exist in the
   * DB (no cross-table transactions in Supabase client), but the caller
   * knows the transition needs attention.
   */
  async addApproval(
    submittalId: string,
    stamp: 'approved' | 'approved_as_noted' | 'rejected' | 'revise_and_resubmit',
    comments?: string,
  ): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();

    // 1. Resolve role to record on the approval
    const { data: submittal, error: fetchError } = await supabase
      .from('submittals')
      .select('project_id')
      .eq('id', submittalId)
      .single();

    if (fetchError || !submittal) {
      return { data: null, error: fetchError?.message ?? 'Submittal not found' };
    }

    const role = await resolveProjectRole(submittal.project_id, userId);

    // 2. Insert approval record
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
      return { data: null, error: `Failed to record approval: ${insertError.message}` };
    }

    // 3. Derive new submittal status from stamp and transition
    const targetStatus: SubmittalStatus =
      stamp === 'approved' || stamp === 'approved_as_noted'
        ? 'approved'
        : stamp === 'revise_and_resubmit'
        ? 'resubmit'
        : 'rejected';

    const transitionResult = await submittalService.transitionStatus(
      submittalId,
      targetStatus,
    );
    if (transitionResult.error) {
      return {
        data: null,
        error: `Approval recorded but status transition failed: ${transitionResult.error}`,
      };
    }

    return { data: null, error: null };
  },

  /**
   * Create a new revision of a rejected or revise-and-resubmit submittal.
   *
   * Creates a new submittal record in 'draft' linked to the parent via
   * parent_submittal_id, incrementing revision_number. The parent submittal
   * is left in its current state for audit history.
   */
  async createRevision(
    parentSubmittalId: string,
  ): Promise<SubmittalServiceResult<Submittal>> {
    // 1. Fetch parent
    const { data: parent, error: fetchError } = await supabase
      .from('submittals')
      .select('*')
      .eq('id', parentSubmittalId)
      .single();

    if (fetchError || !parent) {
      return { data: null, error: fetchError?.message ?? 'Parent submittal not found' };
    }

    const userId = await getCurrentUserId();
    const nextRevision = (parent.revision_number ?? 1) + 1;

    const insert: Record<string, unknown> = {
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
    };

    const { data, error } = await supabase
      .from('submittals')
      .insert(insert)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Submittal, error: null };
  },
};
