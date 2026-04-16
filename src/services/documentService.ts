import { supabase } from '../lib/supabase';
import type { DocumentStatus } from '../machines/documentMachine';
import { getValidTransitions } from '../machines/documentMachine';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  validationError,
} from './errors';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: DocumentStatus;
  file_url: string | null;
  file_size: number | null;
  content_type: string | null;
  folder: string | null;
  tags: string[] | null;
  discipline: string | null;
  trade: string | null;
  reviewer_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentInput {
  project_id: string;
  title: string;
  description?: string;
  file_url?: string;
  file_size?: number;
  content_type?: string;
  folder?: string;
  tags?: string[];
  discipline?: string;
  trade?: string;
  reviewer_id?: string;
}

export interface DocumentSearchHit {
  id: string;
  title: string;
  discipline: string | null;
  semanticScore?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Service ───────────────────────────────────────────────────────────────────

export const documentService = {
  async loadDocuments(projectId: string): Promise<Result<Document[]>> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as Document[]);
  },

  async createDocument(input: CreateDocumentInput): Promise<Result<Document>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('documents')
      .insert({
        project_id:  input.project_id,
        title:       input.title,
        description: input.description ?? null,
        status:      'draft' as DocumentStatus,
        file_url:    input.file_url ?? null,
        file_size:   input.file_size ?? null,
        content_type: input.content_type ?? null,
        folder:      input.folder ?? null,
        tags:        input.tags ?? null,
        discipline:  input.discipline ?? null,
        trade:       input.trade ?? null,
        reviewer_id: input.reviewer_id ?? null,
        created_by:  userId,
        updated_by:  userId,
      })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as Document);
  },

  /**
   * Update document fields (non-status). Use transitionStatus() for status changes.
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Omit<Document, 'id' | 'project_id' | 'status' | 'created_by' | 'created_at' | 'deleted_at' | 'deleted_by'>>,
  ): Promise<Result> {
    const userId = await getCurrentUserId();
    // Strip status to prevent bypassing the state machine
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...safeUpdates } = updates as Record<string, unknown>;

    const { error } = await supabase
      .from('documents')
      .update({ ...safeUpdates, updated_by: userId })
      .eq('id', documentId)
      .is('deleted_at', null);

    if (error) return fail(dbError(error.message, { documentId }));
    return { data: null, error: null };
  },

  /**
   * Transition document status with lifecycle enforcement.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   */
  async transitionStatus(
    documentId: string,
    newStatus: DocumentStatus,
  ): Promise<Result> {
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('status, project_id, created_by, reviewer_id')
      .eq('id', documentId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !doc) {
      return fail(notFoundError('Document', documentId));
    }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(doc.project_id as string, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = doc.status as DocumentStatus;
    const validTransitions = getValidTransitions(currentStatus, role);
    if (!validTransitions.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid transition: ${currentStatus} \u2192 ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ') || 'none'}`,
          { currentStatus, newStatus, role, validTransitions },
        ),
      );
    }

    const { error } = await supabase
      .from('documents')
      .update({ status: newStatus, updated_by: userId })
      .eq('id', documentId);

    if (error) return fail(dbError(error.message, { documentId, newStatus }));
    return { data: null, error: null };
  },

  async deleteDocument(documentId: string): Promise<Result> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('documents')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', documentId);

    if (error) return fail(dbError(error.message, { documentId }));
    return { data: null, error: null };
  },

  async moveToFolder(documentId: string, folder: string | null): Promise<Result> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('documents')
      .update({ folder, updated_by: userId })
      .eq('id', documentId)
      .is('deleted_at', null);

    if (error) return fail(dbError(error.message, { documentId, folder }));
    return { data: null, error: null };
  },

  /**
   * Keyword search on document titles within a project.
   * Used by DocumentSearch.tsx as the fallback when semantic embeddings are unavailable.
   */
  async searchDocuments(
    projectId: string,
    query: string,
  ): Promise<Result<DocumentSearchHit[]>> {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, discipline')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .ilike('title', `%${query}%`)
      .limit(10);

    if (error) return fail(dbError(error.message, { projectId, query }));
    return ok((data ?? []) as DocumentSearchHit[]);
  },
};
