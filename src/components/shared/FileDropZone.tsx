import React, { useCallback, useRef, useState } from 'react'
import { Upload, File as FileIcon, X, Image as ImageIcon, AlertCircle, Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'

export interface FileItem {
  file: File
  id: string
  previewUrl?: string
  progress: number // 0..100
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
}

export interface FileDropZoneProps {
  accept?: string // comma-separated mime types or extensions, e.g. "application/pdf,image/*"
  maxSizeMB?: number
  multiple?: boolean
  maxFiles?: number
  disabled?: boolean
  label?: string
  helper?: string
  onFilesSelected?: (files: File[]) => void
  onUpload?: (file: File, onProgress: (pct: number) => void) => Promise<void>
  showPreviews?: boolean
  compact?: boolean
}

const DEFAULT_LABEL = 'Drag & drop files here'
const DEFAULT_HELPER = 'or click to browse'

function fileId(f: File): string {
  return `${f.name}-${f.size}-${f.lastModified}-${crypto.randomUUID().slice(0, 5)}`
}

function isImage(f: File): boolean {
  return f.type.startsWith('image/')
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true
  const tokens = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0) return true
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()
  return tokens.some((t) => {
    if (t.startsWith('.')) return fileName.endsWith(t)
    if (t.endsWith('/*')) return fileType.startsWith(t.slice(0, -1))
    return fileType === t
  })
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  accept,
  maxSizeMB = 50,
  multiple = true,
  maxFiles = 20,
  disabled = false,
  label = DEFAULT_LABEL,
  helper = DEFAULT_HELPER,
  onFilesSelected,
  onUpload,
  showPreviews = true,
  compact = false,
}) => {
  const [items, setItems] = useState<FileItem[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const validate = (files: File[]): { accepted: FileItem[]; rejected: string[] } => {
    const accepted: FileItem[] = []
    const rejected: string[] = []
    for (const f of files) {
      if (!matchesAccept(f, accept)) {
        rejected.push(`${f.name}: unsupported file type`)
        continue
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        rejected.push(`${f.name}: exceeds ${maxSizeMB} MB limit`)
        continue
      }
      const item: FileItem = {
        file: f,
        id: fileId(f),
        progress: 0,
        status: 'queued',
        previewUrl: isImage(f) && showPreviews ? URL.createObjectURL(f) : undefined,
      }
      accepted.push(item)
    }
    return { accepted, rejected }
  }

  const startUploads = useCallback(
    async (newItems: FileItem[]) => {
      if (!onUpload) return
      for (const item of newItems) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading' } : i)))
        try {
          await onUpload(item.file, (pct) => {
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: pct } : i)))
          })
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: 'done', progress: 100 } : i)),
          )
        } catch (err) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
                : i,
            ),
          )
        }
      }
    },
    [onUpload],
  )

  const handleFiles = (fileList: FileList | File[]) => {
    setGlobalError(null)
    const arr = Array.from(fileList)
    if (!multiple && arr.length > 1) {
      setGlobalError('Only one file allowed')
      return
    }
    if (items.length + arr.length > maxFiles) {
      setGlobalError(`Maximum ${maxFiles} files`)
      return
    }
    const { accepted, rejected } = validate(arr)
    if (rejected.length > 0) setGlobalError(rejected.join('; '))
    if (accepted.length === 0) return
    setItems((prev) => [...prev, ...accepted])
    onFilesSelected?.(accepted.map((a) => a.file))
    if (onUpload) void startUploads(accepted)
  }

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragCounterRef.current += 1
    setDragActive(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) setDragActive(false)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setDragActive(false)
    if (disabled) return
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  const onBrowse = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files)
    e.target.value = ''
  }

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  return (
    <div style={{ width: '100%', fontFamily: typography.fontFamily }}>
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={onBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onBrowse()
          }
        }}
        aria-disabled={disabled}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          padding: compact ? spacing.md : spacing.xl,
          border: `2px dashed ${dragActive ? colors.primaryOrange : colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          background: dragActive ? colors.orangeSubtle : colors.surfacePage,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: transitions.quick,
          opacity: disabled ? 0.6 : 1,
          textAlign: 'center',
        }}
      >
        <Upload size={compact ? 22 : 32} color={dragActive ? colors.primaryOrange : colors.textTertiary} />
        <div style={{ color: colors.textPrimary, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium }}>
          {label}
        </div>
        <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>{helper}</div>
        {accept && (
          <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
            Accepted: {accept}
          </div>
        )}
        {maxSizeMB && (
          <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
            Max {maxSizeMB} MB per file
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          onChange={onInputChange}
        />
      </div>

      {globalError && (
        <div
          role="alert"
          style={{
            marginTop: spacing.sm,
            padding: '6px 10px',
            background: colors.errorBannerBg,
            color: colors.statusCritical,
            borderRadius: borderRadius.base,
            fontSize: typography.fontSize.sm,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertCircle size={14} />
          {globalError}
        </div>
      )}

      {items.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: `${spacing.sm} 0 0`,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.xs,
          }}
        >
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                background: colors.surfaceRaised,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.base,
                boxShadow: shadows.sm,
              }}
            >
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt=""
                  style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: borderRadius.sm }}
                />
              ) : isImage(item.file) ? (
                <ImageIcon size={24} color={colors.textSecondary} />
              ) : (
                <FileIcon size={24} color={colors.textSecondary} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.file.name}
                </div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {humanSize(item.file.size)}
                  {item.status === 'error' && item.error ? ` — ${item.error}` : ''}
                </div>
                {(item.status === 'uploading' || item.status === 'done') && (
                  <div
                    style={{
                      marginTop: 4,
                      height: 4,
                      background: colors.surfaceInset,
                      borderRadius: borderRadius.full,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${item.progress}%`,
                        height: '100%',
                        background:
                          item.status === 'done' ? colors.statusActive : colors.primaryOrange,
                        transition: transitions.smooth,
                      }}
                    />
                  </div>
                )}
              </div>
              {item.status === 'done' ? (
                <Check size={16} color={colors.statusActive} />
              ) : item.status === 'error' ? (
                <AlertCircle size={16} color={colors.statusCritical} />
              ) : null}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeItem(item.id)
                }}
                aria-label={`Remove ${item.file.name}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textTertiary,
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default FileDropZone
