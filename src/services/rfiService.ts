import { supabase } from '../lib/supabase';
import type { RFI, RFIResponse, Priority } from '../types/database';
import type { RfiStatus } from '../types/database';
import { getValidTransitions, getBallInCourt } from '../machines/rfiMachine';

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

export type CreateRfiInput = {
  project_id: string;
  title: string;
  description?: string;
  priority: Priority;
  assigned_to?: string;
  due_date?: string;
  linked_drawing_id?: string;
};

export type RfiServiceResult<T = void> = {
  data: T | null;
  error: string | null;
};

// ── Service ──────────────────────────────────────────────────────────────────

export const rfiService = {
  /**
   * Load all active (non-deleted) RFIs for a project.
   */
  async loadRfis(projectId: string): Promise<RfiServiceResult<RFI[]>> {
    const { data, error } = await supabase
      .from('rfis')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('rfi_number', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as RFI[], error: null };
  },

  /**
   * Create a new RFI in 'draft' status with provenance.
   */
  async createRfi(input: CreateRfiInput): Promise<RfiServiceResult<RFI>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.from('rfis')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description ?? null,
        status: 'draft' as RfiStatus,
        priority: input.priority,
        created_by: userId,
        assigned_to: input.assigned_to ?? null,
        due_date: input.due_date ?? null,
        ball_in_court_id: input.assigned_to ?? null,
        linked_drawing_id: input.linked_drawing_id ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as RFI, error: null };
  },

  /**
   * Transition RFI status with lifecycle enforcement.
   *
   * IMPORTANT: This method resolves the user's authoritative role from the
   * database. It does NOT accept caller-supplied roles.
   *
   * Validates that:
   *   1. The RFI exists
   *   2. The user has a project role
   *   3. The transition is valid per rfiMachine for that role
   */
  async transitionStatus(
    rfiId: string,
    newStatus: RfiStatus,
  ): Promise<RfiServiceResult> {
    // 1. Fetch current RFI
    const { data: rfi, error: fetchError } = await supabase
      .from('rfis')
      .select('status, created_by, assigned_to, project_id')
      .eq('id', rfiId)
      .single();

    if (fetchError || !rfi) {
      return { data: null, error: fetchError?.message ?? 'RFI not found' };
    }

    // 2. Resolve authoritative role — do NOT trust caller
    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(rfi.project_id, userId);
    if (!role) {
      return { data: null, error: 'User is not a member of this project' };
    }

    // 3. Validate transition
    const currentStatus = rfi.status as RfiStatus;
    const validTransitions = getValidTransitions(currentStatus, role);
    if (!validTransitions.includes(newStatus)) {
      return {
        data: null,
        error: `Invalid transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ')}`,
      };
    }

    // 4. Execute transition with provenance
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
      ball_in_court_id: getBallInCourt(newStatus, rfi.created_by, rfi.assigned_to),
    };

    if (newStatus === 'closed') {
      updates.closed_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('rfis')
      .update(updates)
      .eq('id', rfiId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Update RFI fields (non-status). Populates updated_by.
   * Use transitionStatus() for status changes.
   */
  async updateRfi(rfiId: string, updates: Partial<RFI>): Promise<RfiServiceResult> {
    const userId = await getCurrentUserId();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('rfis')
      .update({ ...safeUpdates, updated_by: userId })
      .eq('id', rfiId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Soft-delete an RFI.
   */
  async deleteRfi(rfiId: string): Promise<RfiServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('rfis')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', rfiId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  },

  /**
   * Load responses for an RFI.
   */
  async loadResponses(rfiId: string): Promise<RfiServiceResult<RFIResponse[]>> {
    const { data, error } = await supabase
      .from('rfi_responses')
      .select('*')
      .eq('rfi_id', rfiId)
      .order('created_at');

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as RFIResponse[], error: null };
  },

  /**
   * Add a response to an RFI and atomically transition to 'answered'.
   *
   * IMPORTANT: If the response inserts successfully but the status
   * transition fails, the ENTIRE operation is reported as an error.
   * The response will exist in the database (Supabase doesn't support
   * client-side transactions across tables), but the caller will know
   * the transition failed and can retry or handle it.
   */
  async addResponse(
    rfiId: string,
    text: string,
    attachments?: string[]
  ): Promise<RfiServiceResult> {
    const userId = await getCurrentUserId();

    // 1. Insert response
    const { error: insertError } = await supabase.from('rfi_responses').insert({
      rfi_id: rfiId,
      user_id: userId,
      response_text: text,
      attachments: attachments ?? null,
    });

    if (insertError) {
      return { data: null, error: `Failed to insert response: ${insertError.message}` };
    }

    // 2. Transition to 'answered' — surface failure, do NOT ignore
    const transitionResult = await rfiService.transitionStatus(rfiId, 'answered' as RfiStatus);
    if (transitionResult.error) {
      return {
        data: null,
        error: `Response saved but status transition failed: ${transitionResult.error}`,
      };
    }

    return { data: null, error: null };
  },
};
