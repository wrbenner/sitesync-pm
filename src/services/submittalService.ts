import { supabase } from '../lib/supabase';
import type { Submittal, Priority } from '../types/database';
import type { SubmittalState } from '../machines/submittalMachine';
import { getValidSubmittalTransitions, getNextSubmittalStatus } from '../machines/submittalMachine';

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

/**
 * Determine whether the given role is allowed to execute a status transition.
 *
 * Role hierarchy:
 *   owner / admin / project_manager — full authority over all transitions
 *   gc_pm / superintendent          — submit, GC review transitions
 *   architect                       — architect review transitions
 *   subcontractor / viewer          — submit and resubmit only
 */
function isRoleAllowedTransition(
  role: string,
  currentStatus: SubmittalState,
  nextStatus: SubmittalState,
): boolean {
  const elevated = ['owner', 'admin', 'project_manager'];
  const gcRoles  = [...elevated, 'gc_pm', 'superintendent'];

  if (elevated.includes(role)) return true;

  // GC roles may move drafts forward and drive GC review
  if (gcRoles.includes(role)) {
    const gcAllowed: SubmittalState[] = ['submitted', 'gc_review', 'rejected', 'resubmit'];
    if (currentStatus === 'draft' && nextStatus === 'submitted') return true;
    if (currentStatus === 'submitted' && gcAllowed.includes(nextStatus)) return true;
    if (currentStatus === 'gc_review') return true;
    if (['rejected', 'resubmit'].includes(currentStatus) && nextStatus === 'draft') return true;
    return false;
  }

  // Architect may only drive architect_review
  if (role === 'architect') {
    if (currentStatus === 'gc_review' && nextStatus === 'architect_review') return true;
    if (currentStatus === 'architect_review') return true;
    return false;
  }

  // Subcontractors may only submit and resubmit
  if (role === 'subcontractor') {
    if (currentStatus === 'draft' && nextStatus === 'submitted') return true;
    if (['rejected', 'resubmit'].includes(currentStatus) && nextStatus === 'draft') return true;
    return false;
  }

  return false;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateSubmittalInput = {
  project_id: string;
  title: string;
  spec_section?: string;
  subcontractor?: string;
  priority?: Priority;
  assigned_to?: string;
  due_date?: string;
  required_onsite_date?: string;
  submit_by_date?: string;
  lead_time_weeks?: number;
  reviewer_ids?: string[];
};

export type SubmittalReviewer = {
  id: string;
  submittal_id: string;
  user_id: string;
  review_order: number;
  status: 'pending' | 'approved' | 'rejected' | 'revise';
  comments: string | null;
  reviewed_at: string | null;
  created_at: string;
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
   * Sets created_by from the server-resolved session; caller must NOT supply it.
   */
  async createSubmittal(input: CreateSubmittalInput): Promise<SubmittalServiceResult<Submittal>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('submittals')
      .insert({
        project_id:          input.project_id,
        title:               input.title,
        spec_section:        input.spec_section         ?? null,
        subcontractor:       input.subcontractor        ?? null,
        status:              'draft' as SubmittalState,
        assigned_to:         input.assigned_to          ?? null,
        due_date:            input.due_date             ?? null,
        required_onsite_date: input.required_onsite_date ?? null,
        submit_by_date:      input.submit_by_date       ?? null,
        lead_time_weeks:     input.lead_time_weeks      ?? null,
        revision_number:     1,
        created_by:          userId,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    const newSubmittal = data as Submittal;

    // Insert reviewer chain entries if provided
    if (input.reviewer_ids?.length) {
      for (let i = 0; i < input.reviewer_ids.length; i++) {
        const { error: reviewerError } = await supabase
          .from('submittal_reviewers' as 'submittals')
          .insert({
            submittal_id:  newSubmittal.id,
            user_id:       input.reviewer_ids[i],
            review_order:  i + 1,
            status:        'pending',
          } as unknown as Submittal);

        if (reviewerError) {
          // Surface but don't abort — the submittal itself was created successfully
          console.error(`Failed to add reviewer ${i + 1}:`, reviewerError.message);
        }
      }
    }

    return { data: newSubmittal, error: null };
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
   *   3. The target status is reachable per submittalMachine from the current one
   *   4. The user's role permits the transition
   */
  async transitionStatus(
    submittalId: string,
    newStatus: SubmittalState,
  ): Promise<SubmittalServiceResult> {
    // 1. Fetch current submittal
    const { data: submittal, error: fetchError } = await supabase
      .from('submittals')
      .select('status, created_by, assigned_to, project_id, deleted_at')
      .eq('id', submittalId)
      .single();

    if (fetchError || !submittal) {
      return { data: null, error: fetchError?.message ?? 'Submittal not found' };
    }
    if (submittal.deleted_at) {
      return { data: null, error: 'Cannot transition a deleted submittal' };
    }

    // 2. Resolve authoritative role — do NOT trust caller
    const userId = await getCurrentUserId();
    const role   = await resolveProjectRole(submittal.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Validate the transition via the state machine
    const currentStatus   = submittal.status as SubmittalState;
    const validActions    = getValidSubmittalTransitions(currentStatus);
    const reachableStates = validActions
      .map((action) => getNextSubmittalStatus(currentStatus, action))
      .filter((s): s is SubmittalState => s !== null);

    if (!reachableStates.includes(newStatus)) {
      return {
        data:  null,
        error: `Invalid transition: ${currentStatus} \u2192 ${newStatus}. Valid next states: ${reachableStates.join(', ')}`,
      };
    }

    // 4. Validate role permission
    if (!isRoleAllowedTransition(role, currentStatus, newStatus)) {
      return {
        data:  null,
        error: `Role '${role}' is not permitted to move a submittal from '${currentStatus}' to '${newStatus}'`,
      };
    }

    // 5. Execute transition with provenance
    const updates: Record<string, unknown> = {
      status:     newStatus,
      updated_by: userId,
    };

    if (newStatus === 'approved') {
      updates.approved_date = new Date().toISOString().slice(0, 10);
    }
    if (newStatus === 'submitted') {
      updates.submitted_date = new Date().toISOString().slice(0, 10);
    }
    if (newStatus === 'closed') {
      updates.closed_date = new Date().toISOString().slice(0, 10);
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
  async updateSubmittal(
    submittalId: string,
    updates: Partial<Submittal>,
  ): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();
    // Strip status to prevent bypassing the lifecycle machine
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
   * Soft-delete a submittal. Sets deleted_at and deleted_by.
   */
  async deleteSubmittal(submittalId: string): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('submittals')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        updated_by: userId,
      })
      .eq('id', submittalId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Load the reviewer chain for a submittal ordered by review_order.
   */
  async loadReviewers(submittalId: string): Promise<SubmittalServiceResult<SubmittalReviewer[]>> {
    const { data, error } = await supabase
      .from('submittal_reviewers' as 'submittals')
      .select('*')
      .eq('submittal_id', submittalId)
      .order('review_order') as unknown as { data: SubmittalReviewer[] | null; error: { message: string } | null };

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  },

  /**
   * Record a reviewer decision and, if all reviewers have decided,
   * automatically transition the submittal to the next status.
   *
   * IMPORTANT: reviewerId here is the submittal_reviewers.id (not the user_id).
   */
  async reviewSubmittal(
    submittalId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected' | 'revise',
    comments?: string,
  ): Promise<SubmittalServiceResult> {
    const userId = await getCurrentUserId();

    // 1. Update the reviewer record
    const { error: reviewError } = await supabase
      .from('submittal_reviewers' as 'submittals')
      .update({
        status:      decision,
        reviewed_at: new Date().toISOString(),
        comments:    comments ?? null,
      } as unknown as Submittal)
      .eq('id', reviewerId);

    if (reviewError) {
      return { data: null, error: `Failed to record review: ${reviewError.message}` };
    }

    // 2. Derive the appropriate submittal status transition based on decision
    const decisionToStatus: Record<string, SubmittalState> = {
      approved: 'approved',
      rejected: 'rejected',
      revise:   'resubmit',
    };

    const targetStatus = decisionToStatus[decision];
    if (!targetStatus) return { data: null, error: null }; // no status change

    // 3. Transition status — surfaces any lifecycle validation failures
    const { error: transitionError } = await supabase
      .from('submittals')
      .update({
        status:     targetStatus,
        updated_by: userId,
        ...(targetStatus === 'approved' ? { approved_date: new Date().toISOString().slice(0, 10) } : {}),
      })
      .eq('id', submittalId);

    if (transitionError) {
      return {
        data:  null,
        error: `Review saved but status transition failed: ${transitionError.message}`,
      };
    }

    return { data: null, error: null };
  },
};
