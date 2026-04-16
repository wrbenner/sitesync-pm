import { supabase } from '../lib/supabase';
import type { Drawing } from '../types/database';
import type { DrawingStatus, DrawingMarkup, CreateDrawingInput, CreateMarkupInput } from '../types/drawing';
import { getValidTransitions, getNextStatus } from '../machines/drawingMachine';
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

// ── Service ──────────────────────────────────────────────────────────────────

export const drawingService = {
  /**
   * Load all non-archived drawings for a project.
   * Archived drawings are the soft-delete state.
   */
  async loadDrawings(projectId: string): Promise<Result<Drawing[]>> {
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'archived')
      .order('title', { ascending: true });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as Drawing[]);
  },

  /**
   * Create a new drawing record in draft status.
   * uploaded_by is set server-side to the authenticated user.
   */
  async createDrawing(input: CreateDrawingInput): Promise<Result<Drawing>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('drawings')
      .insert({
        project_id: input.project_id,
        title: input.title,
        status: 'draft' as DrawingStatus,
        file_url: input.file_url ?? null,
        discipline: input.discipline ?? null,
        set_name: input.set_name ?? null,
        sheet_number: input.sheet_number ?? null,
        revision: input.revision ?? null,
        received_date: input.received_date ?? null,
        previous_revision_id: input.previous_revision_id ?? null,
        change_description: input.change_description ?? null,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as Drawing);
  },

  /**
   * Transition drawing status with lifecycle enforcement.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   */
  async transitionStatus(
    drawingId: string,
    action: string,
  ): Promise<Result> {
    const { data: drawing, error: fetchError } = await supabase
      .from('drawings')
      .select('status, project_id, uploaded_by')
      .eq('id', drawingId)
      .single();

    if (fetchError || !drawing) {
      return fail(notFoundError('Drawing', drawingId));
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(drawing.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = (drawing.status ?? 'draft') as DrawingStatus;
    const validActions = getValidTransitions(currentStatus, role);
    if (!validActions.includes(action)) {
      return fail(
        validationError(
          `Invalid action: "${action}" from "${currentStatus}" (role: ${role}). Valid: ${validActions.join(', ')}`,
          { currentStatus, action, role, validActions },
        ),
      );
    }

    const newStatus = getNextStatus(currentStatus, action);
    if (!newStatus) {
      return fail(
        validationError(`No target status for action "${action}" from "${currentStatus}"`, {
          currentStatus,
          action,
        }),
      );
    }

    const { error } = await supabase
      .from('drawings')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', drawingId);

    if (error) return fail(dbError(error.message, { drawingId, action, newStatus }));
    return { data: null, error: null };
  },

  /**
   * Update drawing fields (non-status). Use transitionStatus() for status changes.
   */
  async updateDrawing(drawingId: string, updates: Partial<Drawing>): Promise<Result> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, uploaded_by: _uploaded_by, ...safeUpdates } = updates as Record<
      string,
      unknown
    >;

    const { error } = await supabase
      .from('drawings')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('id', drawingId);

    if (error) return fail(dbError(error.message, { drawingId }));
    return { data: null, error: null };
  },

  /**
   * Soft-delete a drawing by transitioning it to the 'archived' status.
   * Archived drawings are excluded from loadDrawings results.
   */
  async deleteDrawing(drawingId: string): Promise<Result> {
    const userId = await getCurrentUserId();
    const role = userId ? await resolveProjectRoleById(drawingId, userId) : null;

    if (!role || (role !== 'admin' && role !== 'owner')) {
      return fail(permissionError('Only admins and owners can delete drawings'));
    }

    const { error } = await supabase
      .from('drawings')
      .update({
        status: 'archived' as DrawingStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', drawingId);

    if (error) return fail(dbError(error.message, { drawingId }));
    return { data: null, error: null };
  },

  // ── Markups ────────────────────────────────────────────────────────────────

  async loadMarkups(drawingId: string): Promise<Result<DrawingMarkup[]>> {
    const { data, error } = await supabase
      .from('drawing_markups')
      .select('*')
      .eq('drawing_id', drawingId)
      .order('created_at', { ascending: true });

    if (error) return fail(dbError(error.message, { drawingId }));
    return ok((data ?? []) as DrawingMarkup[]);
  },

  async createMarkup(input: CreateMarkupInput): Promise<Result<DrawingMarkup>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('drawing_markups')
      .insert({
        drawing_id: input.drawing_id,
        project_id: input.project_id,
        type: input.type ?? null,
        data: input.data,
        layer: input.layer ?? null,
        note: input.note ?? null,
        linked_rfi_id: input.linked_rfi_id ?? null,
        linked_punch_item_id: input.linked_punch_item_id ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { drawing_id: input.drawing_id }));
    return ok(data as DrawingMarkup);
  },

  async updateMarkup(
    markupId: string,
    updates: Partial<Pick<DrawingMarkup, 'data' | 'note' | 'layer' | 'type'>>,
  ): Promise<Result> {
    const { error } = await supabase
      .from('drawing_markups')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', markupId);

    if (error) return fail(dbError(error.message, { markupId }));
    return { data: null, error: null };
  },

  async deleteMarkup(markupId: string): Promise<Result> {
    const { error } = await supabase.from('drawing_markups').delete().eq('id', markupId);

    if (error) return fail(dbError(error.message, { markupId }));
    return { data: null, error: null };
  },

  async linkMarkupToRfi(markupId: string, rfiId: string): Promise<Result> {
    const { error } = await supabase
      .from('drawing_markups')
      .update({ linked_rfi_id: rfiId, updated_at: new Date().toISOString() })
      .eq('id', markupId);

    if (error) return fail(dbError(error.message, { markupId, rfiId }));
    return { data: null, error: null };
  },

  async linkMarkupToPunchItem(markupId: string, punchItemId: string): Promise<Result> {
    const { error } = await supabase
      .from('drawing_markups')
      .update({ linked_punch_item_id: punchItemId, updated_at: new Date().toISOString() })
      .eq('id', markupId);

    if (error) return fail(dbError(error.message, { markupId, punchItemId }));
    return { data: null, error: null };
  },

  async unlinkMarkup(markupId: string): Promise<Result> {
    const { error } = await supabase
      .from('drawing_markups')
      .update({
        linked_rfi_id: null,
        linked_punch_item_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', markupId);

    if (error) return fail(dbError(error.message, { markupId }));
    return { data: null, error: null };
  },
};

// ── Private helpers ──────────────────────────────────────────────────────────

async function resolveProjectRoleById(
  drawingId: string,
  userId: string,
): Promise<string | null> {
  const { data: drawing } = await supabase
    .from('drawings')
    .select('project_id')
    .eq('id', drawingId)
    .single();

  if (!drawing?.project_id) return null;

  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', drawing.project_id)
    .eq('user_id', userId)
    .single();

  return data?.role ?? null;
}
