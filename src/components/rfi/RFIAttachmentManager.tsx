// ── RFIAttachmentManager ────────────────────────────────────────────────
// P1b deliverable #2 — drag-drop attachment manager replacing the basic
// Photo / File buttons.
//
// Capabilities:
//   • Drag-drop zone (drop inside the panel, anywhere over the editor).
//   • Paste from clipboard (image-paste hook on the panel; Cmd+V wires up).
//   • Multi-select upload via the hidden <input type=file multiple>.
//   • List with reorder via drag handle (HTML5 drag, no library dep).
//   • Replace-in-place — picks a new file, updates the storage_path.
//   • Delete with confirm.
//   • Mark-as-Official toggle (writes is_official = true; UI shows badge).
//
// Audit & permissions:
//   • Every mutation flows through `useRFIAttachments` hooks which write
//     audit_log rows. Per Chain Audit Prep Check 5: one row per change.
//   • PermissionGate `rfis.edit` wraps all mutating affordances.

import React, { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Upload, FileText, Image as ImageIcon, Star, Trash2, Replace,
  GripVertical, Loader2, Check,
} from 'lucide-react'
import { PermissionGate } from '../auth/PermissionGate'
import {
  useRFIAttachments,
  useAddRFIAttachment,
  useUpdateRFIAttachment,
  useDeleteRFIAttachment,
  useReorderRFIAttachments,
  useReplaceRFIAttachment,
  type RFIAttachment,
} from '../../hooks/queries/useRFIAttachments'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIAttachmentManagerProps {
  rfiId: string
  projectId: string
  /** When set, the manager scopes to attachments on this response. */
  responseId?: string | null
  /** Compact mode trims spacing — used in response composer. */
  compact?: boolean
}

const ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'
const MAX_BYTES = 25 * 1024 * 1024

const formatBytes = (n: number | null) => {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const isImage = (att: RFIAttachment) =>
  (att.content_type ?? '').startsWith('image/')

export const RFIAttachmentManager: React.FC<RFIAttachmentManagerProps> = ({
  rfiId,
  projectId,
  responseId = null,
  compact = false,
}) => {
  const { data: attachments = [], isLoading } = useRFIAttachments(rfiId, responseId)
  const addAttachment = useAddRFIAttachment()
  const updateAttachment = useUpdateRFIAttachment()
  const deleteAttachment = useDeleteRFIAttachment()
  const reorderAttachments = useReorderRFIAttachments()
  const replaceAttachment = useReplaceRFIAttachment()

  const [dragOver, setDragOver] = useState(false)
  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<RFIAttachment | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return
      const valid = list.filter((f) => {
        if (f.size > MAX_BYTES) {
          toast.error(`Too large (max 25 MB): ${f.name}`)
          return false
        }
        return true
      })
      const results = await Promise.allSettled(
        valid.map((file) => addAttachment.mutateAsync({ rfiId, projectId, responseId, file })),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - ok
      if (ok > 0) toast.success(`Uploaded ${ok} file${ok > 1 ? 's' : ''}`)
      if (failed > 0) toast.error(`${failed} upload${failed > 1 ? 's' : ''} failed`)
    },
    [rfiId, projectId, responseId, addAttachment],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      if (e.dataTransfer?.files?.length) {
        void handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles],
  )

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files: File[] = []
      const items = e.clipboardData?.items ?? []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        void handleFiles(files)
      }
    },
    [handleFiles],
  )

  const onRowDragStart = (idx: number) => () => setDragRowIndex(idx)
  const onRowDragOver = (idx: number) => (e: React.DragEvent) => {
    if (dragRowIndex == null || dragRowIndex === idx) return
    e.preventDefault()
  }
  const onRowDrop = (idx: number) => () => {
    if (dragRowIndex == null || dragRowIndex === idx) {
      setDragRowIndex(null)
      return
    }
    const next = [...attachments]
    const [moved] = next.splice(dragRowIndex, 1)
    next.splice(idx, 0, moved)
    setDragRowIndex(null)
    void reorderAttachments
      .mutateAsync({ rfiId, projectId, responseId, orderedIds: next.map((a) => a.id) })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Reorder failed'))
  }

  const handleToggleOfficial = (att: RFIAttachment) => {
    void updateAttachment
      .mutateAsync({
        attachmentId: att.id,
        rfiId,
        projectId,
        responseId,
        patch: { is_official: !att.is_official },
      })
      .then(() => toast.success(att.is_official ? 'Removed Official mark' : 'Marked Official'))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Update failed'))
  }

  const handleDelete = (att: RFIAttachment) => {
    if (!window.confirm(`Delete ${att.filename}?`)) return
    void deleteAttachment
      .mutateAsync({
        attachmentId: att.id,
        rfiId,
        projectId,
        responseId,
        storagePath: att.storage_path,
      })
      .then(() => toast.success('Deleted'))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Delete failed'))
  }

  const handleReplaceClick = (att: RFIAttachment) => {
    replaceTargetRef.current = att
    replaceInputRef.current?.click()
  }

  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const target = replaceTargetRef.current
    e.target.value = ''
    if (!file || !target) return
    void replaceAttachment
      .mutateAsync({
        attachmentId: target.id,
        rfiId,
        projectId,
        responseId,
        oldStoragePath: target.storage_path,
        newFile: file,
      })
      .then(() => toast.success(`Replaced with ${file.name}`))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Replace failed'))
  }

  return (
    <div onPaste={onPaste}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files)
          e.target.value = ''
        }}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleReplaceFile}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Drop zone — uploaders only see this when permitted. */}
      <PermissionGate permission="rfis.edit">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          aria-label="Upload attachments. Drop, click, or paste."
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            padding: compact ? spacing['3'] : spacing['4'],
            border: `1.5px dashed ${dragOver ? colors.primaryOrange : colors.borderSubtle}`,
            borderRadius: borderRadius.base,
            backgroundColor: dragOver ? colors.orangeSubtle : 'transparent',
            color: dragOver ? colors.primaryOrange : colors.textTertiary,
            fontSize: typography.fontSize.sm,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {addAttachment.isPending ? (
            <Loader2 size={14} className="rfi-spin" />
          ) : (
            <Upload size={14} />
          )}
          <span>
            {addAttachment.isPending
              ? 'Uploading…'
              : 'Drop files, click to browse, or paste an image'}
          </span>
        </button>
      </PermissionGate>

      {/* Attachment list */}
      {isLoading ? (
        <div style={{ marginTop: spacing['3'], color: colors.textTertiary, fontSize: 12 }}>
          Loading attachments…
        </div>
      ) : attachments.length === 0 ? null : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: `${spacing['3']} 0 0`,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['1'],
          }}
        >
          {attachments.map((att, idx) => (
            <li
              key={att.id}
              draggable
              onDragStart={onRowDragStart(idx)}
              onDragOver={onRowDragOver(idx)}
              onDrop={onRowDrop(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                border: `1px solid ${att.is_official ? colors.primaryOrange : colors.borderSubtle}`,
                borderRadius: borderRadius.base,
                backgroundColor: att.is_official ? colors.orangeSubtle : colors.surfaceRaised,
                cursor: 'grab',
              }}
            >
              <GripVertical size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} aria-hidden="true" />
              {isImage(att) ? (
                <ImageIcon size={14} style={{ color: colors.primaryOrange, flexShrink: 0 }} />
              ) : (
                <FileText size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} />
              )}
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: typography.fontSize.sm,
                  color: colors.textPrimary,
                  textDecoration: 'none',
                }}
              >
                {att.filename}
                {att.size_bytes != null && (
                  <span style={{ marginLeft: 6, color: colors.textTertiary, fontSize: 11 }}>
                    {formatBytes(att.size_bytes)}
                  </span>
                )}
              </a>

              {att.is_official && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '1px 6px',
                    borderRadius: 6,
                    backgroundColor: colors.primaryOrange,
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  <Check size={9} /> Official
                </span>
              )}

              <PermissionGate permission="rfis.edit">
                <button
                  type="button"
                  onClick={() => handleToggleOfficial(att)}
                  aria-label={att.is_official ? 'Remove Official mark' : 'Mark Official'}
                  title={att.is_official ? 'Remove Official mark' : 'Mark Official'}
                  style={iconBtnStyle(att.is_official ? colors.primaryOrange : colors.textTertiary)}
                >
                  <Star size={13} fill={att.is_official ? colors.primaryOrange : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={() => handleReplaceClick(att)}
                  aria-label="Replace file"
                  title="Replace file"
                  style={iconBtnStyle(colors.textTertiary)}
                >
                  <Replace size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(att)}
                  aria-label="Delete attachment"
                  title="Delete"
                  style={iconBtnStyle(colors.statusCritical)}
                >
                  <Trash2 size={13} />
                </button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}

      <style>{`@keyframes rfi-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .rfi-spin { animation: rfi-spin 1s linear infinite; }`}</style>
    </div>
  )
}

const iconBtnStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  border: 'none',
  borderRadius: 6,
  backgroundColor: 'transparent',
  color,
  cursor: 'pointer',
})

export default RFIAttachmentManager
