// ── Intelligent Upload Hub ───────────────────────────────────
// Enhanced port of sitesyncai-web DirectFileInput. Auto-routes by
// file type, shows per-file + overall progress, detects ZIPs and
// duplicates, and renders PDF thumbnail previews.

import React, { useCallback, useRef, useState, useEffect, useMemo, memo } from 'react'
import {
  Upload, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive,
  CheckCircle2, AlertTriangle, X, Loader2, ArrowRight,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

// ── File type routing ────────────────────────────────────────
export type UploadTarget = 'drawings' | 'field-capture' | 'budget' | 'files' | 'safety' | 'unknown'

function detectTarget(file: File): UploadTarget {
  const name = file.name.toLowerCase()
  const ext = name.split('.').pop() ?? ''
  if (ext === 'pdf') {
    if (/sheet|plan|drawing|a-?\d|s-?\d|m-?\d|e-?\d|p-?\d/i.test(name)) return 'drawings'
    return 'files'
  }
  if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)) return 'field-capture'
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'budget'
  if (['zip'].includes(ext)) return 'drawings'
  return 'files'
}

function iconForFile(file: File): React.ElementType {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return FileText
  if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)) return ImageIcon
  if (['csv', 'xlsx', 'xls'].includes(ext)) return FileSpreadsheet
  if (ext === 'zip') return FileArchive
  return FileText
}

// ── Hashing for duplicate detection ──────────────────────────
async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── PDF first-page thumbnail via browser PDF.js if available ─
async function pdfThumbnail(file: File): Promise<string | null> {
  try {
    const w = window as unknown as { pdfjsLib?: { getDocument: (d: unknown) => { promise: Promise<unknown> } } }
    if (!w.pdfjsLib) return null
    const buf = await file.arrayBuffer()
    const pdf = (await (w.pdfjsLib.getDocument({ data: buf }).promise)) as {
      getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } }>
    }
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 0.3 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return null
  }
}

// ── File record ──────────────────────────────────────────────
interface UploadRecord {
  id: string
  file: File
  target: UploadTarget
  thumbnail?: string
  hash?: string
  isDuplicate?: boolean
  isZip: boolean
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
  remoteUrl?: string
}

// ── Props ────────────────────────────────────────────────────
export interface IntelligentUploadHubProps {
  projectId?: string
  bucket?: string
  pathPrefix?: string
  accept?: string
  maxSize?: number
  allowMultiple?: boolean
  onComplete?: (records: UploadRecord[]) => void
  /** Called when ZIP detected — returns true to upload as-is, false to trigger extraction workflow */
  onZipDetected?: (file: File) => Promise<boolean>
  /** Overrides auto-routing confirmation. If returns false, file is removed from queue. */
  onRouteConfirm?: (file: File, suggested: UploadTarget) => Promise<UploadTarget | false>
  /** Existing file hashes for duplicate check */
  existingHashes?: Set<string>
}

// ── Component ────────────────────────────────────────────────
export function IntelligentUploadHub({
  projectId,
  bucket = 'project-files',
  pathPrefix = '',
  accept,
  maxSize = 100 * 1024 * 1024,
  allowMultiple = true,
  onComplete,
  onZipDetected,
  onRouteConfirm,
  existingHashes,
}: IntelligentUploadHubProps) {
  const [records, setRecords] = useState<UploadRecord[]>([])
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const overallProgress = useMemo(() => {
    if (records.length === 0) return 0
    return Math.round(records.reduce((s, r) => s + r.progress, 0) / records.length)
  }, [records])

  const analyze = useCallback(async (file: File): Promise<UploadRecord> => {
    const target = detectTarget(file)
    const isZip = file.name.toLowerCase().endsWith('.zip')
    const hash = await sha256(file).catch(() => undefined)
    const isDuplicate = hash && existingHashes?.has(hash) ? true : false
    const thumbnail = file.type === 'application/pdf' ? (await pdfThumbnail(file)) ?? undefined : undefined
    return {
      id: crypto.randomUUID(),
      file, target, isZip, hash, isDuplicate, thumbnail,
      progress: 0, status: 'pending',
    }
  }, [existingHashes])

  const handleFiles = useCallback(async (list: FileList | File[]) => {
    const arr = Array.from(list).filter((f) => f.size <= maxSize)
    if (arr.length < list.length) {
      toast.warning(`${list.length - arr.length} file(s) exceed size limit`)
    }
    const analyzed = await Promise.all(arr.map(analyze))

    // Confirm targets
    const confirmed: UploadRecord[] = []
    for (const r of analyzed) {
      if (r.isZip && onZipDetected) {
        const useAsIs = await onZipDetected(r.file)
        if (!useAsIs) continue
      }
      if (onRouteConfirm) {
        const chosen = await onRouteConfirm(r.file, r.target)
        if (chosen === false) continue
        confirmed.push({ ...r, target: chosen })
      } else {
        confirmed.push(r)
      }
    }
    setRecords((cur) => [...cur, ...confirmed])
  }, [analyze, maxSize, onZipDetected, onRouteConfirm])

  const upload = useCallback(async (rec: UploadRecord) => {
    if (rec.isDuplicate) {
      setRecords((cur) => cur.map((r) => r.id === rec.id ? { ...r, status: 'error', error: 'Duplicate (same file already uploaded)' } : r))
      return
    }
    setRecords((cur) => cur.map((r) => r.id === rec.id ? { ...r, status: 'uploading', progress: 5 } : r))
    try {
      const path = `${pathPrefix || projectId || 'uploads'}/${Date.now()}-${rec.file.name}`
      const { data, error } = await supabase.storage.from(bucket).upload(path, rec.file, {
        cacheControl: '3600', upsert: false,
      })
      if (error) throw error
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path)
      setRecords((cur) => cur.map((r) =>
        r.id === rec.id ? { ...r, status: 'complete', progress: 100, remoteUrl: pub.publicUrl } : r
      ))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setRecords((cur) => cur.map((r) => r.id === rec.id ? { ...r, status: 'error', error: msg } : r))
    }
  }, [bucket, pathPrefix, projectId])

  // Trigger uploads for new pending records
  useEffect(() => {
    const pending = records.filter((r) => r.status === 'pending')
    if (pending.length > 0) {
      pending.forEach(upload)
    }
    // Completion callback
    if (records.length > 0 && records.every((r) => r.status === 'complete' || r.status === 'error')) {
      onComplete?.(records)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(true)
  }
  const onDragLeave = () => setDragActive(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  const remove = (id: string) => setRecords((cur) => cur.filter((r) => r.id !== id))

  return (
    <div>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="File upload drop zone"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragActive ? colors.primaryOrange : colors.borderDefault}`,
          background: dragActive ? colors.orangeSubtle : colors.surfaceInset,
          borderRadius: borderRadius.lg,
          padding: spacing['6'], textAlign: 'center',
          cursor: 'pointer', minHeight: 120,
          transition: `all ${transitions.instant}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: spacing['2'],
        }}
      >
        <Upload size={32} color={dragActive ? colors.primaryOrange : colors.textTertiary} />
        <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
          {dragActive ? 'Drop to upload' : 'Drag files here or click to browse'}
        </div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          Drawings, photos, spreadsheets, and ZIPs auto-route to the right page
        </div>
        <input
          ref={inputRef} type="file" hidden multiple={allowMultiple} accept={accept}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Overall progress */}
      {records.length > 0 && (
        <div style={{ marginTop: spacing['3'], display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <div style={{ flex: 1, height: 6, background: colors.surfaceInset, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${overallProgress}%`,
              background: colors.primaryOrange, transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, minWidth: 40 }}>
            {overallProgress}%
          </span>
        </div>
      )}

      {/* File rows */}
      <div style={{ marginTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
        {records.map((r) => <FileRow key={r.id} rec={r} onRemove={remove} />)}
      </div>
    </div>
  )
}

const FileRow = memo<{ rec: UploadRecord; onRemove: (id: string) => void }>(({ rec, onRemove }) => {
  const Icon = iconForFile(rec.file)
  const targetLabel: Record<UploadTarget, string> = {
    drawings: 'Drawings', 'field-capture': 'Field Capture', budget: 'Budget',
    files: 'Files', safety: 'Safety', unknown: 'Files',
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['3'],
      padding: spacing['3'], background: colors.surfaceRaised,
      border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base,
    }}>
      {rec.thumbnail ? (
        <img src={rec.thumbnail} alt="" width={48} height={64} style={{ borderRadius: borderRadius.sm, objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: 48, height: 64, borderRadius: borderRadius.sm,
          background: colors.surfaceInset, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* eslint-disable-next-line react-hooks/static-components -- Icon is a stable lucide-react component reference, not dynamically created */}
          <Icon size={24} color={colors.textTertiary} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <span style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rec.file.name}
          </span>
          {rec.isDuplicate && (
            <span style={{
              fontSize: typography.fontSize.caption, padding: `2px ${spacing['2']}`,
              background: colors.statusWarningSubtle, color: colors.statusWarning,
              borderRadius: borderRadius.sm,
            }}>Duplicate</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: 2, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          <span>{(rec.file.size / 1024 / 1024).toFixed(2)} MB</span>
          <ArrowRight size={10} />
          <span style={{ color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>{targetLabel[rec.target]}</span>
        </div>
        {rec.status === 'uploading' && (
          <div style={{ marginTop: spacing['2'], height: 4, background: colors.surfaceInset, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${rec.progress}%`, background: colors.primaryOrange, transition: 'width 0.2s' }} />
          </div>
        )}
        {rec.error && (
          <div style={{ marginTop: spacing['1'], fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
            {rec.error}
          </div>
        )}
      </div>
      {rec.status === 'complete' && <CheckCircle2 size={20} color={colors.statusSuccess} />}
      {rec.status === 'error' && <AlertTriangle size={20} color={colors.statusCritical} />}
      {rec.status === 'uploading' && <Loader2 size={20} color={colors.primaryOrange} style={{ animation: 'spin 1s linear infinite' }} />}
      <button
        onClick={() => onRemove(rec.id)}
        aria-label="Remove file"
        style={{
          width: 32, height: 32, minWidth: 32,
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textTertiary, borderRadius: borderRadius.sm,
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
})
FileRow.displayName = 'FileRow'

export default IntelligentUploadHub
