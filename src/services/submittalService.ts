import { supabase } from '../lib/supabase';
import type { Submittal } from '../types/database';
import type { SubmittalState } from '../machines/submittalMachine';
import { getValidSubmittalTransitions } from '../machines/submittalMachine';

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
  description?: string;
  spec_section?: string;
  assigned_to?: string;
  due_date?: string;
  submitted_date?: string;
  subcontractor?: string;
  lead_time_weeks?: number;
  required_onsite_date?: string;
};

export type SubmittalServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const submittalService = {
  /**
   * Load all active (non-deleted) submittals for a project.
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
   */
  async createSubmittal(input: CreateSubmittalInput): Promise<SubmittalServiceResult<Submittal>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('submittals')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description ?? null,
        spec_section: input.spec_section ?? null,
        status: 'draft' as SubmittalState,
        created_by: userId,
        assigned_to: input.assigned_to ?? null,
        due_date: input.due_date ?? null,
        submitted_date: input.submitted_date ?? null,
        subcontractor: input.subcontractor ?? null,
        lead_time_weeks: input.lead_time_weeks ?? null,
        required_onsite_date: input.required_onsite_date ?? null,
        revision_number: 1,
      })
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
      .select('status, created_by, assigned_to, project_id')
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

    // 3. Validate transition against machine
    const currentStatus = submittal.status as SubmittalState;
    const validTransitions = getValidSubmittalTransitions(currentStatus, role);

    // Map status values to their action labels for lookup
    const statusToAction: Record<string, string> = {
      submitted: 'Submit for Review',
      gc_review: 'GC Approve',
      architect_review: 'Forward to Architect',
      approved: 'Architect Approve',
      rejected: 'GC Reject',
      resubmit: 'Revise and Resubmit',
      draft: 'Revise and Resubmit',
      closed: 'Close Out',
    };

    const actionLabel = statusToAction[newStatus] ?? newStatus;
    if (!validTransitions.includes(actionLabel)) {
      return {
        data: null,
        error: `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid actions: ${validTransitions.join(', ')}`,
      };
    }

    // 4. Execute transition with provenance
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
   */
  async updateSubmittal(submittalId: string, updates: Partial<Submittal>): Promise<SubmittalServiceResult> {
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
   * Soft-delete a submittal.
   */
  async deleteSubmittal(submittalId: string): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('submittals')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', submittalId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Load approvals for a submittal.
   */
  async loadApprovals(submittalId: string): Promise<SubmittalServiceResult<Record<string, unknown>[]>> {
    const { data, error } = await supabase
      .from('submittal_approvals')
      .select('*')
      .eq('submittal_id', submittalId)
      .order('chain_order');

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as Record<string, unknown>[], error: null };
  },

  /**
   * Record an approval decision (stamp) for a submittal and transition status.
   *
   * IMPORTANT: If the approval inserts successfully but the status
   * transition fails, the operation is reported as an error.
   */
  async recordApproval(
    submittalId: string,
    stamp: 'approved' | 'approved_as_noted' | 'rejected' | 'revise_and_resubmit',
    comments?: string,
  ): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();

    // 1. Fetch current submittal for project_id and role
    const { data: submittal, error: fetchError } = await supabase
      .from('submittals')
      .select('project_id, status')
      .eq('id', submittalId)
      .single();

    if (fetchError || !submittal) {
      return { data: null, error: fetchError?.message ?? 'Submittal not found' };
    }

    // 2. Resolve role
    const role = await resolveProjectRole(submittal.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Insert approval record
    const { error: insertError } = await supabase.from('submittal_approvals').insert({
      submittal_id: submittalId,
      approver_id: userId,
      stamp,
      status: stamp,
      comments: comments ?? null,
      reviewed_at: new Date().toISOString(),
      role,
    });

    if (insertError) {
      return { data: null, error: `Failed to record approval: ${insertError.message}` };
    }

    // 4. Derive next status from stamp
    const nextStatusMap: Record<string, SubmittalState> = {
      approved: 'approved',
      approved_as_noted: 'approved',
      rejected: 'rejected',
      revise_and_resubmit: 'resubmit',
    };
    const nextStatus = nextStatusMap[stamp];

    if (nextStatus) {
      const transitionResult = await submittalService.transitionStatus(submittalId, nextStatus);
      if (transitionResult.error) {
        return {
          data: null,
          error: `Approval recorded but status transition failed: ${transitionResult.error}`,
        };
      }
    }

    return { data: null, error: null };
  },
};
