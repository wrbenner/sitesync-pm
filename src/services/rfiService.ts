import { supabase } from '../lib/supabase';
import type { RFI, RFIResponse, Priority } from '../types/database';
import type { RfiStatus } from '../types/database';
import { getValidTransitions, getBallInCourt } from '../machines/rfiMachine';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
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
   * Validates the transition is allowed by rfiMachine before executing.
   */
  async transitionStatus(
    rfiId: string,
    newStatus: RfiStatus,
    userRole: string = 'viewer'
  ): Promise<RfiServiceResult> {
    const { data: rfi, error: fetchError } = await supabase
      .from('rfis')
      .select('status, created_by, assigned_to')
      .eq('id', rfiId)
      .single();

    if (fetchError || !rfi) {
      return { data: null, error: fetchError?.message ?? 'RFI not found' };
    }

    const currentStatus = rfi.status as RfiStatus;
    const validTransitions = getValidTransitions(currentStatus, userRole);
    if (!validTransitions.includes(newStatus)) {
      return {
        data: null,
        error: `Invalid transition: ${currentStatus} → ${newStatus}. Valid: ${validTransitions.join(', ')}`,
      };
    }

    const ballInCourt = getBallInCourt(newStatus, rfi.created_by, rfi.assigned_to);
    const userId = await getCurrentUserId();
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_by: userId,
      ball_in_court_id: ballInCourt,
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
   */
  async updateRfi(rfiId: string, updates: Partial<RFI>): Promise<RfiServiceResult> {
    const userId = await getCurrentUserId();
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
   * Add a response and auto-transition to 'answered'.
   */
  async addResponse(
    rfiId: string,
    text: string,
    attachments?: string[]
  ): Promise<RfiServiceResult> {
    const userId = await getCurrentUserId();

    const { error } = await supabase.from('rfi_responses').insert({
      rfi_id: rfiId,
      user_id: userId,
      response_text: text,
      attachments: attachments ?? null,
    });

    if (error) return { data: null, error: error.message };

    await rfiService.transitionStatus(rfiId, 'answered' as RfiStatus);
    return { data: null, error: null };
  },
};
