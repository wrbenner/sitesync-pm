import { supabase } from '../lib/supabase';
import { fromTable, selectScopedActive } from '../lib/db/queries';
import type { DocumentStatus } from '../machines/documentMachine';
import { getValidDocumentTransitions } from '../machines/documentMachine';
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
  validationError,
} from './errors';

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

  const { data } = await fromTable('project_members')
    .select('role')
    .eq('project_id' as never, projectId)
    .eq('user_id' as never, userId)
    .single();

  return (data as unknown as { role?: string } | null)?.role ?? null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentRecord {
  id: string;
  project_id: string;
  name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  folder: string | null;
  description: string | null;
  discipline: string | null;
  trade: string | null;
  tags: Record<string, unknown> | null;
  version: number | null;
  previous_version_id: string | null;
  uploaded_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  document_status: DocumentStatus | null;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string | null;
}

export interface CreateDocumentInput {
  project_id: string;
  name: string;
  file_url: string;
  file_size?: number;
  content_type?: string;
  folder?: string;
  description?: string;
  discipline?: string;
  trade?: string;
  tags?: Record<string, unknown>;
}

export interface UploadDocumentInput {
  project_id: string;
  name: string;
  folder?: string;
  description?: string;
  discipline?: string;
  trade?: string;
  tags?: Record<string, unknown>;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const documentService = {
  /**
   * Load all active (non-soft-deleted) documents for a project.
   */
  async loadDocuments(projectId: string): Promise<Result<DocumentRecord[]>> {
    const { data, error } = await selectScopedActive('files', projectId, '*')
      .order('created_at', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as unknown as DocumentRecord[]);
  },

  /**
   * Load documents filtered by lifecycle status.
   */
  async loadDocumentsByStatus(
    projectId: string,
    status: DocumentStatus,
  ): Promise<Result<DocumentRecord[]>> {
    const { data, error } = await selectScopedActive('files', projectId, '*')
      .eq('document_status' as never, status)
      .order('created_at', { ascending: false });

    if (error) return fail(dbError(error.message, { projectId, status }));
    return ok((data ?? []) as unknown as DocumentRecord[]);
  },

  /**
   * Create a document record (file already uploaded externally).
   * Sets status to 'draft' and populates provenance.
   */
  async createDocument(input: CreateDocumentInput): Promise<Result<DocumentRecord>> {
    const userId = await getCurrentUserId();

    const { data, error } = await fromTable('files')
      .insert({
        project_id: input.project_id,
        name: input.name,
        file_url: input.file_url,
        file_size: input.file_size ?? null,
        content_type: input.content_type ?? null,
        folder: input.folder ?? null,
        description: input.description ?? null,
        discipline: input.discipline ?? null,
        trade: input.trade ?? null,
        tags: input.tags ?? null,
        version: 1,
        previous_version_id: null,
        uploaded_by: userId,
        created_by: userId,
        document_status: 'draft' as DocumentStatus,
      } as never)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: input.project_id }));
    return ok(data as unknown as DocumentRecord);
  },

  /**
   * Upload a file to Supabase Storage and create a document record.
   * Calls onProgress during the upload for UI progress indicators.
   */
  async uploadDocument(
    input: UploadDocumentInput,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<Result<DocumentRecord>> {
    const userId = await getCurrentUserId();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const storagePath = `${input.project_id}/${input.folder ?? 'Documents'}/${Date.now()}_${file.name}`;

    // Note: supabase.storage.upload no longer exposes onUploadProgress in
    // @supabase/supabase-js v2. The progress callback contract is preserved
    // at the UploadDocumentInput surface but progress UI is not driven by
    // the SDK at this layer; callers can compose progress at a higher level.
    void onProgress
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file);

    if (uploadError) {
      return fail(dbError(`Storage upload failed: ${uploadError.message}`, {
        project_id: input.project_id,
        name: file.name,
      }));
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    const { data, error: dbErr } = await fromTable('files')
      .insert({
        project_id: input.project_id,
        name: input.name || file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        content_type: file.type || `application/${ext}`,
        folder: input.folder ?? null,
        description: input.description ?? null,
        discipline: input.discipline ?? null,
        trade: input.trade ?? null,
        tags: input.tags ?? null,
        version: 1,
        previous_version_id: null,
        uploaded_by: userId,
        created_by: userId,
        document_status: 'draft' as DocumentStatus,
      } as never)
      .select()
      .single();

    if (dbErr) {
      await supabase.storage.from('documents').remove([storagePath]);
      return fail(dbError(`DB record failed after upload: ${dbErr.message}`, {
        project_id: input.project_id,
        storagePath,
      }));
    }

    return ok(data as unknown as DocumentRecord);
  },

  /**
   * Upload a new version of an existing document.
   * Creates a new file record linked to the parent via previous_version_id
   * and increments the version number.
   */
  async uploadVersion(
    parentDocumentId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<Result<DocumentRecord>> {
    const { data: parentRaw, error: fetchError } = await fromTable('files')
      .select('project_id, name, folder, description, discipline, trade, tags, version, document_status')
      .eq('id' as never, parentDocumentId)
      .single();
    const parent = parentRaw as unknown as { project_id: string; name: string; folder: string | null; description: string | null; discipline: string | null; trade: string | null; tags: Record<string, unknown> | null; version: number | null; document_status: DocumentStatus | null } | null

    if (fetchError || !parent) {
      return fail(notFoundError('Document', parentDocumentId));
    }

    const userId = await getCurrentUserId();
    const storagePath = `${parent.project_id}/${parent.folder ?? 'Documents'}/${Date.now()}_v${(parent.version ?? 1) + 1}_${file.name}`;

    // Note: supabase.storage.upload no longer exposes onUploadProgress in
    // @supabase/supabase-js v2. The progress callback contract is preserved
    // at the UploadDocumentInput surface but progress UI is not driven by
    // the SDK at this layer; callers can compose progress at a higher level.
    void onProgress
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file);

    if (uploadError) {
      return fail(dbError(`Storage upload failed: ${uploadError.message}`, { parentDocumentId }));
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    if (!parent) return fail(notFoundError('Document', parentDocumentId));
    const { data, error: dbErr } = await fromTable('files')
      .insert({
        project_id: parent.project_id,
        name: parent.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        content_type: file.type,
        folder: parent.folder ?? null,
        description: parent.description ?? null,
        discipline: parent.discipline ?? null,
        trade: parent.trade ?? null,
        tags: parent.tags ?? null,
        version: (parent.version ?? 1) + 1,
        previous_version_id: parentDocumentId,
        uploaded_by: userId,
        created_by: userId,
        document_status: 'draft' as DocumentStatus,
      } as never)
      .select()
      .single();

    if (dbErr) {
      await supabase.storage.from('documents').remove([storagePath]);
      return fail(dbError(`DB record failed after version upload: ${dbErr.message}`, { parentDocumentId }));
    }

    return ok(data as unknown as DocumentRecord);
  },

  /**
   * Load the full version chain for a document (all versions with same root).
   */
  async loadVersionHistory(documentId: string): Promise<Result<DocumentRecord[]>> {
    const { data: doc, error: fetchError } = await fromTable('files')
      .select('project_id, name')
      .eq('id' as never, documentId)
      .single();

    if (fetchError || !doc) {
      return fail(notFoundError('Document', documentId));
    }
    const docRow = doc as unknown as { project_id: string; name: string }

    const { data, error } = await selectScopedActive('files', docRow.project_id, '*')
      .eq('name' as never, docRow.name)
      .order('version', { ascending: false });

    if (error) return fail(dbError(error.message, { documentId }));
    return ok((data ?? []) as unknown as DocumentRecord[]);
  },

  /**
   * Transition document lifecycle status with role enforcement.
   *
   * IMPORTANT: Resolves the user's authoritative role from the database.
   * Does NOT accept caller-supplied roles.
   */
  async transitionStatus(
    documentId: string,
    newStatus: DocumentStatus,
  ): Promise<Result> {
    const { data: doc, error: fetchError } = await fromTable('files')
      .select('document_status, created_by, uploaded_by, project_id')
      .eq('id' as never, documentId)
      .single();

    if (fetchError || !doc) {
      return fail(notFoundError('Document', documentId));
    }
    const docRow = doc as unknown as { document_status: string | null; created_by: string | null; uploaded_by: string | null; project_id: string }

    const userId = await getCurrentUserId();
    const role = await resolveProjectRole(docRow.project_id, userId);
    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }

    const currentStatus = (docRow.document_status ?? 'draft') as DocumentStatus;
    const validTransitions = getValidDocumentTransitions(currentStatus, role);

    if (!validTransitions.includes(newStatus)) {
      return fail(
        validationError(
          `Invalid transition: ${currentStatus} → ${newStatus} (role: ${role}). Valid: ${validTransitions.join(', ')}`,
          { currentStatus, newStatus, role, validTransitions },
        ),
      );
    }

    const { error } = await fromTable('files')
      .update({
        document_status: newStatus,
      } as never)
      .eq('id' as never, documentId);
    void userId;

    if (error) return fail(dbError(error.message, { documentId, newStatus }));
    return { data: null, error: null };
  },

  /**
   * Update document metadata (non-status fields).
   * Use transitionStatus() for status changes.
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Omit<DocumentRecord, 'id' | 'project_id' | 'document_status' | 'created_by' | 'created_at'>>,
  ): Promise<Result> {
    const { document_status: _s, created_by: _c, created_at: _ca, ...safeUpdates } =
      updates as Record<string, unknown>;

    const { error } = await fromTable('files')
      .update(safeUpdates as never)
      .eq('id' as never, documentId);

    if (error) return fail(dbError(error.message, { documentId }));
    return { data: null, error: null };
  },

  /**
   * Delete a document.
   */
  async deleteDocument(documentId: string): Promise<Result> {
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await fromTable('files')
      .update({
        deleted_at: now,
        deleted_by: userId,
      } as never)
      .eq('id' as never, documentId);

    if (error) return fail(dbError(error.message, { documentId }));
    return { data: null, error: null };
  },

  /**
   * Get a signed (time-limited) download URL for a document stored in Supabase Storage.
   * The file_url on the record is the public URL; use this for private buckets.
   */
  async getDownloadUrl(
    storagePath: string,
    expiresInSeconds = 3600,
  ): Promise<Result<string>> {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) return fail(dbError(error.message, { storagePath }));
    return ok(data.signedUrl);
  },
};
