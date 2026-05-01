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

    // Sanitise discipline: the DB constraint (construction_discipline domain)
    // only accepts a fixed set of values. Values outside the set (e.g.
    // food_service, laundry, vertical_transportation) must be mapped to
    // null so the insert succeeds — AI classification fills the real value
    // later anyway.
    const ALLOWED_DISCIPLINES = new Set([
      'architectural','structural','mechanical','electrical','plumbing',
      'civil','fire_protection','landscape','interior','interior_design',
      'mep','unclassified','cover','demolition','survey','geotechnical',
      'hazmat','telecommunications',
    ]);
    const safeDiscipline = input.discipline && ALLOWED_DISCIPLINES.has(input.discipline)
      ? input.discipline
      : null;

    // Build the row to insert. Only include pipeline columns when they have
    // a value — this avoids 400 errors if older migration hasn't run.
    const row: Record<string, unknown> = {
      project_id: input.project_id,
      title: input.title,
      // 'for_review' is in every version of the status CHECK constraint
      // (original 00019 + the wider 20260428100000 migration).
      status: 'for_review',
      file_url: input.file_url ?? null,
      discipline: safeDiscipline,
      sheet_number: input.sheet_number ?? null,
      revision: input.revision ?? null,
      uploaded_by: userId,
    };

    // Pipeline fields — columns added in migration 20260420000005.
    // Only add them when the caller provides a value.
    if (input.thumbnail_url != null) row.thumbnail_url = input.thumbnail_url;
    if (input.total_pages != null) row.total_pages = input.total_pages;
    if (input.source_filename != null) row.source_filename = input.source_filename;
    if (input.file_size_bytes != null) row.file_size_bytes = input.file_size_bytes;
    if (input.processing_status != null) row.processing_status = input.processing_status;

    const { data, error } = await supabase
      .from('drawings')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[drawingService.createDrawing] insert failed:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        row,
      });
      return fail(dbError(error.message, { project_id: input.project_id }));
    }

    // Cross-feature workflow: if this drawing was uploaded for a sheet number
    // that already exists in the project, treat it as a revision and flag
    // open RFIs that reference that sheet. Fire-and-forget — failures are
    // logged inside the chain, never surfaced to the upload UX.
    const inserted = data as { id?: string; sheet_number?: string | null } | null;
    if (inserted?.id && inserted.sheet_number) {
      void import('../lib/crossFeatureWorkflows')
        .then(({ runDrawingRevisedChain }) => runDrawingRevisedChain(inserted.id!))
        .then((result) => {
          if (result.error) console.warn('[drawing_revised chain]', result.error);
          else if (result.affectedRfiIds && result.affectedRfiIds.length > 0) {
            console.info(
              `[drawing_revised chain] flagged ${result.affectedRfiIds.length} affected RFI(s)`,
            );
          }
        })
        .catch((err) => console.warn('[drawing_revised chain] dispatch failed:', err));
    }

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
   * Update drawing fields. Status updates bypass lifecycle enforcement here;
   * use transitionStatus() when formal workflow transitions are needed.
   */
  async updateDrawing(drawingId: string, updates: Partial<Drawing>): Promise<Result> {
    const { uploaded_by: _uploaded_by, status: _status, ...safeUpdates } = updates as Record<
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
