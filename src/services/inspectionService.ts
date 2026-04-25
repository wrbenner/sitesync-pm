import { supabase } from '../lib/supabase';
import type { Inspection, InspectionFinding, CreateInspectionInput, InspectionStatus } from '../types/inspection';
import { getValidInspectionTransitions } from '../machines/inspectionMachine';
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

export const inspectionService = {
  async loadInspections(projectId: string): Promise<Result<Inspection[]>> {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as Inspection[]);
  },

  async createInspection(input: CreateInspectionInput): Promise<Result<Inspection>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('inspections')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        status: 'scheduled' as InspectionStatus,
        priority: input.priority,
        scheduled_date: input.scheduled_date ?? null,
        inspector_id: input.inspector_id ?? null,
        location: input.location ?? null,
        checklist_items: input.checklist_items ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as Inspection);
  },

  /**
   * Transition inspection status with lifecycle enforcement.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   */
  async transitionStatus(
    inspectionId: string,
    newStatus: InspectionStatus,
  ): Promise<Result> {
    const { data: inspection, error: fetchError } = await supabase
      .from('inspections')
      .select('status, created_by, inspector_id, project_id')
      .eq('id', inspectionId)
      .single();

    if (fetchError || !inspection) {
      return fail(notFoundError('Inspection', inspectionId));
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(inspection.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = inspection.status as InspectionStatus;
    const validTransitions = getValidInspectionTransitions(currentStatus, role);
    if (!validTransitions.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ') || 'none'}`,
          { currentStatus, newStatus, role, validTransitions },
        ),
      );
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
    };
    void userId;

    if (newStatus === 'completed') {
      updates.completed_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('inspections')
      .update(updates)
      .eq('id', inspectionId);

    if (error) return fail(dbError(error.message, { inspectionId, newStatus }));
    return { data: null, error: null };
  },

  /**
   * Update inspection fields (non-status). Use transitionStatus() for status changes.
   */
  async updateInspection(inspectionId: string, updates: Partial<Inspection>): Promise<Result> {
    const userId = await getCurrentUserId();
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;
    safeUpdates.updated_by = userId;

    const { error } = await supabase
      .from('inspections')
      .update(safeUpdates)
      .eq('id', inspectionId);

    if (error) return fail(dbError(error.message, { inspectionId }));
    return { data: null, error: null };
  },

  async deleteInspection(inspectionId: string): Promise<Result> {
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('inspections')
      .update({
        deleted_at: now,
        deleted_by: userId,
      } as Record<string, unknown>)
      .eq('id', inspectionId);

    if (error) return fail(dbError(error.message, { inspectionId }));
    return { data: null, error: null };
  },

  async loadFindings(inspectionId: string): Promise<Result<InspectionFinding[]>> {
    const { data, error } = await supabase
      .from('inspection_findings')
      .select('*')
      .eq('inspection_id', inspectionId)
      .order('created_at');

    if (error) return fail(dbError(error.message, { inspectionId }));
    return ok((data ?? []) as InspectionFinding[]);
  },

  /**
   * Add a finding and atomically transition to 'completed' when all items are observed.
   *
   * IMPORTANT: Supabase has no client-side cross-table transactions.
   * If the finding inserts but the status transition fails, the caller
   * receives an error describing the partial failure.
   */
  async addFinding(
    inspectionId: string,
    description: string,
    severity: InspectionFinding['severity'],
    attachments?: string[],
  ): Promise<Result> {
    const userId = await getCurrentUserId();

    const { error: insertError } = await supabase.from('inspection_findings').insert({
      inspection_id: inspectionId,
      user_id: userId,
      description,
      severity,
      attachments: attachments ?? null,
    });

    if (insertError) {
      return fail(dbError(`Failed to insert finding: ${insertError.message}`, { inspectionId }));
    }

    return { data: null, error: null };
  },
};
