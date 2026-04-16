import { supabase } from '../lib/supabase';
import type { RFI, RFIResponse, Priority } from '../types/database';
import type { RfiStatus } from '../types/database';
import { getValidTransitions, getBallInCourt } from '../machines/rfiMachine';
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

/** @deprecated Use Result<T> from services/errors instead */
export type RfiServiceResult<T = void> = Result<T>;

// ── Service ──────────────────────────────────────────────────────────────────

export const rfiService = {
  async loadRfis(projectId: string): Promise<Result<RFI[]>> {
    const { data, error } = await supabase
      .from('rfis')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('rfi_number', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as RFI[]);
  },

  async createRfi(input: CreateRfiInput): Promise<Result<RFI>> {
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

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as RFI);
  },

  /**
   * Transition RFI status with lifecycle enforcement.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   */
  async transitionStatus(
    rfiId: string,
    newStatus: RfiStatus,
  ): Promise<Result> {
    const { data: rfi, error: fetchError } = await supabase
      .from('rfis')
      .select('status, created_by, assigned_to, project_id')
      .eq('id', rfiId)
      .single();

    if (fetchError || !rfi) {
      return fail(notFoundError('RFI', rfiId));
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(rfi.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = rfi.status as RfiStatus;
    const validTransitions = getValidTransitions(currentStatus, role);
    if (!validTransitions.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ')}`,
          { currentStatus, newStatus, role, validTransitions },
        ),
      );
    }

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

    if (error) return fail(dbError(error.message, { rfiId, newStatus }));
    return { data: null, error: null };
  },

  /**
   * Update RFI fields (non-status). Use transitionStatus() for status changes.
   */
  async updateRfi(rfiId: string, updates: Partial<RFI>): Promise<Result> {
    const userId = await getCurrentUserId();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('rfis')
      .update({ ...safeUpdates, updated_by: userId })
      .eq('id', rfiId);

    if (error) return fail(dbError(error.message, { rfiId }));
    return { data: null, error: null };
  },

  async deleteRfi(rfiId: string): Promise<Result> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('rfis')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', rfiId);

    if (error) return fail(dbError(error.message, { rfiId }));
    return { data: null, error: null };
  },

  async loadResponses(rfiId: string): Promise<Result<RFIResponse[]>> {
    const { data, error } = await supabase
      .from('rfi_responses')
      .select('*')
      .eq('rfi_id', rfiId)
      .order('created_at');

    if (error) return fail(dbError(error.message, { rfiId }));
    return ok((data ?? []) as RFIResponse[]);
  },

  /**
   * Add a response and atomically transition to 'answered'.
   *
   * IMPORTANT: Supabase has no client-side cross-table transactions.
   * If the response inserts but the status transition fails, the caller
   * receives an error describing the partial failure.
   */
  async addResponse(
    rfiId: string,
    text: string,
    attachments?: string[],
  ): Promise<Result> {
    const userId = await getCurrentUserId();

    const { error: insertError } = await supabase.from('rfi_responses').insert({
      rfi_id: rfiId,
      user_id: userId,
      response_text: text,
      attachments: attachments ?? null,
    });

    if (insertError) {
      return fail(dbError(`Failed to insert response: ${insertError.message}`, { rfiId }));
    }

    const transitionResult = await rfiService.transitionStatus(rfiId, 'answered' as RfiStatus);
    if (transitionResult.error) {
      return fail({
        ...transitionResult.error,
        message: `Response saved but status transition failed: ${transitionResult.error.message}`,
        userMessage: 'Response saved but the status could not be updated. Please refresh and retry.',
      });
    }

    return { data: null, error: null };
  },
};
