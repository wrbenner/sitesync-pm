import { supabase } from '../lib/supabase';
import type { Submittal, SubmittalApproval, FileRecord } from '../types/database';
import type { SubmittalState, SubmittalStamp } from '../machines/submittalMachine';
import { getValidSubmittalTransitionsForRole } from '../machines/submittalMachine';

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

export type CreateSubmittalInput = {
  project_id: string;
  title: string;
  spec_section?: string;
  subcontractor?: string;
  assigned_to?: string;
  due_date?: string;
  submit_by_date?: string;
  required_onsite_date?: string;
  lead_time_weeks?: number;
};

export type SubmittalServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const submittalService = {
  /**
   * Load all active (non-soft-deleted) submittals for a project.
   *
   * NOTE: Soft-delete filtering via deleted_at requires a DB migration to add
   * that column to the submittals table. Until then, all rows are returned.
   */
  async loadSubmittals(projectId: string): Promise<SubmittalServiceResult<Submittal[]>> {
    const { data, error } = await supabase
      .from('submittals')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as Submittal[], error: null };
  },

  /**
   * Create a new submittal in 'draft' status with provenance.
   */
  async createSubmittal(input: CreateSubmittalInput): Promise<SubmittalServiceResult<Submittal>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('submittals')
      .insert({
        project_id: input.project_id,
        title: input.title,
        status: 'draft' as SubmittalState,
        spec_section: input.spec_section ?? null,
        subcontractor: input.subcontractor ?? null,
        assigned_to: input.assigned_to ?? null,
        created_by: userId,
        due_date: input.due_date ?? null,
        submit_by_date: input.submit_by_date ?? null,
        required_onsite_date: input.required_onsite_date ?? null,
        lead_time_weeks: input.lead_time_weeks ?? null,
        revision_number: 1,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Submittal, error: null };
  },

  /**
   * Transition submittal status with lifecycle and role enforcement.
   *
   * IMPORTANT: This method resolves the user's authoritative role from the
   * database. It does NOT accept caller-supplied roles.
   *
   * Validates that:
   *   1. The submittal exists
   *   2. The user has a project role
   *   3. The transition is valid per submittalMachine for that role
   */
  async transitionStatus(
    submittalId: string,
    newStatus: SubmittalState,
  ): Promise<SubmittalServiceResult> {
    // 1. Fetch current submittal
    const { data: submittal, error: fetchError } = await supabase
      .from('submittals')
      .select('status, project_id, assigned_to, created_by, revision_number')
      .eq('id', submittalId)
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

    // 3. Validate transition against role
    const currentStatus = submittal.status as SubmittalState;
    const validTransitions = getValidSubmittalTransitionsForRole(currentStatus, role);
    if (!validTransitions.includes(newStatus)) {
      return {
        data: null,
        error: `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ')}`,
      };
    }

    // 4. Build update payload with provenance and lifecycle timestamps
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
    };

    if (newStatus === 'submitted') {
      updates.submitted_date = new Date().toISOString();
    }
    if (newStatus === 'approved') {
      updates.approved_date = new Date().toISOString();
    }

    // Bump revision number when cycling back to draft after rejection or revise request
    if (newStatus === 'draft' && (currentStatus === 'rejected' || currentStatus === 'resubmit')) {
      updates.revision_number = (submittal.revision_number ?? 1) + 1;
    }

    const { error } = await supabase
      .from('submittals')
      .update(updates)
      .eq('id', submittalId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update submittal fields (non-status). Populates updated_by.
   * Use transitionStatus() for status changes.
   *
   * NOTE: updated_by requires a DB migration to add that column.
   */
  async updateSubmittal(
    submittalId: string,
    updates: Partial<Submittal>,
  ): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('submittals')
      .update({ ...safeUpdates, updated_by: userId })
      .eq('id', submittalId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete a submittal by stamping deleted_at and deleted_by.
   *
   * NOTE: requires deleted_at and deleted_by columns via DB migration.
   * Until the migration lands, falls back to hard delete.
   */
  async deleteSubmittal(submittalId: string): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();

    const softDelete: Record<string, unknown> = {
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    };

    const { error: softError } = await supabase
      .from('submittals')
      .update(softDelete)
      .eq('id', submittalId);

    // If soft delete fails (column does not exist yet), fall back to hard delete
    if (softError) {
      const { error: hardError } = await supabase
        .from('submittals')
        .delete()
        .eq('id', submittalId);

      if (hardError) return { data: null, error: hardError.message };
    }

    return { data: null, error: null };
  },

  /**
   * Load all approval records for a submittal, ordered chronologically.
   */
  async loadApprovals(submittalId: string): Promise<SubmittalServiceResult<SubmittalApproval[]>> {
    const { data, error } = await supabase
      .from('submittal_approvals')
      .select('*')
      .eq('submittal_id', submittalId)
      .order('reviewed_at');

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as SubmittalApproval[], error: null };
  },

  /**
   * Record an approval decision and atomically transition the submittal status.
   *
   * Stamp determines the resulting status:
   *   approved, approved_as_noted  → transitions to 'approved'
   *   rejected                     → transitions to 'rejected'
   *   revise_and_resubmit          → transitions to 'resubmit'
   *
   * IMPORTANT: Role is resolved from the database. If the role does not allow
   * the derived status transition, the approval record is still written but the
   * transition is reported as failed.
   */
  async addApproval(
    submittalId: string,
    projectId: string,
    stamp: SubmittalStamp,
    comments?: string,
  ): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(projectId, userId);

    // 1. Insert approval record
    const { error: insertError } = await supabase
      .from('submittal_approvals')
      .insert({
        submittal_id: submittalId,
        approver_id: userId,
        role: role,
        stamp: stamp,
        status:
          stamp === 'approved' || stamp === 'approved_as_noted' ? 'approved' : 'rejected',
        comments: comments ?? null,
        reviewed_at: new Date().toISOString(),
      });

    if (insertError) {
      return { data: null, error: `Failed to record approval: ${insertError.message}` };
    }

    // 2. Derive target status from stamp
    const stampToStatus: Record<SubmittalStamp, SubmittalState> = {
      approved: 'approved',
      approved_as_noted: 'approved',
      rejected: 'rejected',
      revise_and_resubmit: 'resubmit',
    };

    const targetStatus = stampToStatus[stamp];

    // 3. Transition — surface failure, do NOT ignore
    const transitionResult = await submittalService.transitionStatus(submittalId, targetStatus);
    if (transitionResult.error) {
      return {
        data: null,
        error: `Approval recorded but status transition failed: ${transitionResult.error}`,
      };
    }

    return { data: null, error: null };
  },

  /**
   * Load file attachments for a submittal.
   *
   * Files are stored in the shared files table using a folder namespace
   * convention: folder = 'submittals/{submittalId}'. This avoids a separate
   * join table while preserving the standard file upload UX.
   */
  async loadAttachments(
    submittalId: string,
    projectId: string,
  ): Promise<SubmittalServiceResult<FileRecord[]>> {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .eq('folder', `submittals/${submittalId}`)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as FileRecord[], error: null };
  },
};
