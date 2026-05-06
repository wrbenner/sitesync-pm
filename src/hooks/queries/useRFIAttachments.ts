// ── useRFIAttachments ───────────────────────────────────────────────────
// Read + add + reorder + replace + delete + mark-official for the new
// `rfi_attachments` table (P1b deliverable #2).
//
// Behavior:
//   • One row per file. `parent_kind` is determined by `response_id`:
//     null → attachment is on the RFI; non-null → on a specific response.
//   • Storage path = `${projectId}/rfis/${rfiId}/${ts}-${safeName}` for
//     RFI-level uploads, or `${projectId}/rfis/${rfiId}/responses/${rid}/...`
//     for response uploads.
//   • Mutations write per-row audit_log entries (Chain Audit Prep Check 5).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { logAuditEntry } from '../../lib/auditLogger'

export interface RFIAttachment {
  id: string
  rfi_id: string
  response_id: string | null
  storage_path: string
  filename: string
  content_type: string | null
  size_bytes: number | null
  is_official: boolean
  position: number
  uploaded_by: string | null
  created_at: string
  updated_at: string
  /** Public URL (computed client-side, not stored). */
  url?: string
}

const BUCKET = 'project-files'

const queryKey = (rfiId: string | undefined, responseId?: string | null) => [
  'rfi_attachments',
  rfiId,
  responseId ?? null,
]

function attachUrl(att: RFIAttachment): RFIAttachment {
  if (!att.storage_path) return att
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(att.storage_path)
  return { ...att, url: data.publicUrl }
}

export function useRFIAttachments(rfiId: string | undefined, responseId?: string | null) {
  return useQuery({
    queryKey: queryKey(rfiId, responseId),
    queryFn: async () => {
      if (!rfiId) return []
      let q = fromTable('rfi_attachments').select('*').eq('rfi_id' as never, rfiId)
      // When responseId is undefined, return all RFI-level (response_id IS NULL).
      if (responseId === undefined || responseId === null) {
        q = q.is('response_id' as never, null)
      } else {
        q = q.eq('response_id' as never, responseId)
      }
      const { data, error } = await q.order('position' as never, { ascending: true })
      if (error) throw error
      return (data ?? []).map((row) => attachUrl(row as unknown as RFIAttachment))
    },
    enabled: !!rfiId,
  })
}

interface AddAttachmentParams {
  rfiId: string
  projectId: string
  responseId?: string | null
  file: File
  isOfficial?: boolean
}

export function useAddRFIAttachment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: AddAttachmentParams) => {
      const { rfiId, projectId, responseId, file, isOfficial = false } = params
      const ts = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const subpath = responseId
        ? `responses/${responseId}/${ts}-${safeName}`
        : `${ts}-${safeName}`
      const storagePath = `${projectId}/rfis/${rfiId}/${subpath}`

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr

      // Append to the end of the parent's list.
      const { count } = await fromTable('rfi_attachments')
        .select('id' as never, { count: 'exact', head: true })
        .eq('rfi_id' as never, rfiId)
        .is('response_id' as never, responseId ?? null)

      const { data: { user } } = await supabase.auth.getUser()
      const { data: row, error: insertErr } = await fromTable('rfi_attachments')
        .insert({
          rfi_id: rfiId,
          response_id: responseId ?? null,
          storage_path: storagePath,
          filename: file.name,
          content_type: file.type || null,
          size_bytes: file.size,
          is_official: isOfficial,
          position: count ?? 0,
          uploaded_by: user?.id ?? null,
        } as never)
        .select()
        .single()
      if (insertErr) throw insertErr

      const inserted = row as unknown as RFIAttachment
      await logAuditEntry({
        projectId,
        entityType: 'rfi',
        entityId: rfiId,
        action: 'update',
        afterState: { attachment_added: inserted.id, filename: file.name },
        metadata: { kind: 'attachment_add', is_official: isOfficial },
      })
      return inserted
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId, vars.responseId ?? null) })
    },
  })
}

interface UpdateAttachmentParams {
  attachmentId: string
  rfiId: string
  projectId: string
  responseId?: string | null
  patch: Partial<Pick<RFIAttachment, 'is_official' | 'position' | 'filename'>>
}

export function useUpdateRFIAttachment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: UpdateAttachmentParams) => {
      const { attachmentId, rfiId, projectId, patch } = params
      const { error } = await fromTable('rfi_attachments')
        .update(patch as never)
        .eq('id' as never, attachmentId)
      if (error) throw error
      await logAuditEntry({
        projectId,
        entityType: 'rfi',
        entityId: rfiId,
        action: 'update',
        afterState: { attachment_id: attachmentId, ...patch },
        metadata: { kind: 'attachment_update' },
      })
      return { attachmentId }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId, vars.responseId ?? null) })
    },
  })
}

interface DeleteAttachmentParams {
  attachmentId: string
  rfiId: string
  projectId: string
  responseId?: string | null
  storagePath: string
}

export function useDeleteRFIAttachment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: DeleteAttachmentParams) => {
      const { attachmentId, rfiId, projectId, storagePath } = params
      const { error } = await fromTable('rfi_attachments')
        .delete()
        .eq('id' as never, attachmentId)
      if (error) throw error
      // Best-effort storage cleanup; row deletion is the contractual fact.
      void supabase.storage.from(BUCKET).remove([storagePath])
      await logAuditEntry({
        projectId,
        entityType: 'rfi',
        entityId: rfiId,
        action: 'update',
        beforeState: { attachment_id: attachmentId },
        metadata: { kind: 'attachment_delete' },
      })
      return { attachmentId }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId, vars.responseId ?? null) })
    },
  })
}

interface ReorderParams {
  rfiId: string
  projectId: string
  responseId?: string | null
  /** New ordering — full array of attachment IDs in desired order. */
  orderedIds: string[]
}

export function useReorderRFIAttachments() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: ReorderParams) => {
      const { rfiId, projectId, orderedIds } = params
      // Per-row update so the audit chain stays intact.
      const results = await Promise.allSettled(
        orderedIds.map((id, idx) =>
          fromTable('rfi_attachments')
            .update({ position: idx } as never)
            .eq('id' as never, id),
        ),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      await logAuditEntry({
        projectId,
        entityType: 'rfi',
        entityId: rfiId,
        action: 'update',
        afterState: { attachment_order: orderedIds },
        metadata: { kind: 'attachment_reorder', failed_count: failed },
      })
      return { failed }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId, vars.responseId ?? null) })
    },
  })
}

interface ReplaceParams {
  attachmentId: string
  rfiId: string
  projectId: string
  responseId?: string | null
  oldStoragePath: string
  newFile: File
}

export function useReplaceRFIAttachment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: ReplaceParams) => {
      const { attachmentId, rfiId, projectId, oldStoragePath, newFile } = params
      const ts = Date.now()
      const safeName = newFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const dir = oldStoragePath.substring(0, oldStoragePath.lastIndexOf('/'))
      const newStoragePath = `${dir}/${ts}-${safeName}`

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(newStoragePath, newFile, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr

      const { error: updateErr } = await fromTable('rfi_attachments')
        .update({
          storage_path: newStoragePath,
          filename: newFile.name,
          content_type: newFile.type || null,
          size_bytes: newFile.size,
        } as never)
        .eq('id' as never, attachmentId)
      if (updateErr) throw updateErr

      void supabase.storage.from(BUCKET).remove([oldStoragePath])

      await logAuditEntry({
        projectId,
        entityType: 'rfi',
        entityId: rfiId,
        action: 'update',
        afterState: { attachment_id: attachmentId, replaced_with: newFile.name },
        metadata: { kind: 'attachment_replace' },
      })
      return { attachmentId }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKey(vars.rfiId, vars.responseId ?? null) })
    },
  })
}
