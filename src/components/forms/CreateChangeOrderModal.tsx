import React, { useState, useCallback, useRef } from 'react'
import { EntityFormModal } from './EntityFormModal'
import { changeOrderSchema } from './schemas'
import type { FieldConfig } from './EntityFormModal'
import { Btn } from '../Primitives'
import { Upload, FileText, X, Loader2
} from 'lucide-react'
import { colors, spacing, borderRadius } from '../../styles/theme'
import { supabase } from '../../lib/supabase'
import { useProjectId } from '../../hooks/useProjectId'
import { toast } from 'sonner'

interface CreateChangeOrderModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
}

const today = new Date().toISOString().split('T')[0]

const fields: FieldConfig[] = [
  { name: 'title', label: 'Title', type: 'text', placeholder: 'Brief title for this change', required: true },
  { name: 'type', label: 'Type', type: 'select', row: 1, options: [
    { value: 'pco', label: 'Potential Change Order (PCO)' },
    { value: 'cor', label: 'Change Order Request (COR)' },
    { value: 'co', label: 'Change Order (CO)' },
  ]},
  { name: 'reason', label: 'Reason', type: 'select', row: 1, options: [
    { value: 'owner_request', label: 'Owner Request' },
    { value: 'design_change', label: 'Design Change' },
    { value: 'unforeseen_condition', label: 'Unforeseen Condition' },
    { value: 'code_change', label: 'Code / Regulatory Change' },
    { value: 'value_engineering', label: 'Value Engineering' },
    { value: 'scope_addition', label: 'Scope Addition' },
    { value: 'error_omission', label: 'Error / Omission' },
    { value: 'other', label: 'Other' },
  ]},
  { name: 'amount', label: 'Estimated Amount', type: 'currency', row: 2 },
  { name: 'schedule_impact', label: 'Schedule Impact (days)', type: 'text', placeholder: 'e.g. +5, -3, or 0', row: 2 },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the scope change and what triggered it', required: true },
  { name: 'cost_codes', label: 'Cost Codes', type: 'text', placeholder: 'e.g. 03 30 00, 05 12 00', row: 3 },
  { name: 'justification', label: 'Justification', type: 'textarea', placeholder: 'Why is this change necessary?' },
  { name: 'requested_by', label: 'Requested By', type: 'text', placeholder: 'Name or company', row: 4 },
  { name: 'requested_date', label: 'Requested Date', type: 'date', row: 4 },
]

// ─── File Upload Component ──────────────────────────────────

interface UploadedFile {
  name: string
  size: number
  url: string
  path: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FileUploadSection: React.FC<{
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
  projectId: string | undefined
  uploading: boolean
  setUploading: (v: boolean) => void
}> = ({ files, onFilesChange, projectId, uploading, setUploading }) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return
    if (inputRef.current) inputRef.current.value = ''

    if (!projectId) {
      toast.error('No project selected')
      return
    }

    setUploading(true)
    const newFiles: UploadedFile[] = []

    for (const file of selected) {
      // Validate file type
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
      if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|doc|docx|xls|xlsx)$/i)) {
        toast.error(`Unsupported file type: ${file.name}`)
        continue
      }

      // 25MB limit
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`File too large (max 25MB): ${file.name}`)
        continue
      }

      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${projectId}/change-orders/${timestamp}-${safeName}`

      const { error } = await supabase.storage
        .from('project-files')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (error) {
        console.error('[CO Upload]', error)
        toast.error(`Upload failed: ${file.name}`)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(path)

      newFiles.push({
        name: file.name,
        size: file.size,
        url: urlData.publicUrl,
        path,
      })
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles])
      toast.success(`${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded`)
    }
    setUploading(false)
  }, [files, onFilesChange, projectId, setUploading])

  const handleRemove = useCallback((idx: number) => {
    const file = files[idx]
    // Delete from storage (fire and forget)
    supabase.storage.from('project-files').remove([file.path])
    onFilesChange(files.filter((_, i) => i !== idx))
  }, [files, onFilesChange])

  return (
    <div style={{ padding: `0 ${spacing.xl} ${spacing.md}` }}>
      <label style={{
        display: 'block', fontSize: '12px', fontWeight: 600,
        color: colors.textSecondary, marginBottom: '8px',
      }}>
        Backup Documentation
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {files.map((f, i) => (
            <div key={f.path} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`,
            }}>
              <FileText size={16} style={{ color: f.name.endsWith('.pdf') ? '#DC2626' : colors.textTertiary, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: colors.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </div>
                <div style={{ fontSize: '11px', color: colors.textTertiary }}>{formatFileSize(f.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.textTertiary, borderRadius: '4px', display: 'flex' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#DC2626')}
                onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
                aria-label={`Remove ${f.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone / Upload button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          width: '100%', padding: '14px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
          border: `1.5px dashed ${colors.borderDefault}`,
          borderRadius: borderRadius.md, backgroundColor: 'transparent',
          cursor: uploading ? 'wait' : 'pointer',
          transition: 'all 0.15s',
          color: colors.textTertiary,
        }}
        onMouseEnter={(e) => {
          if (!uploading) {
            e.currentTarget.style.borderColor = colors.primaryOrange
            e.currentTarget.style.backgroundColor = `${colors.primaryOrange}06`
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.borderDefault
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        {uploading ? (
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Upload size={20} />
        )}
        <span style={{ fontSize: '12px', fontWeight: 500 }}>
          {uploading ? 'Uploading...' : 'Upload PDF, photos, or documents'}
        </span>
        <span style={{ fontSize: '11px', color: colors.textTertiary }}>
          Proposals, cost breakdowns, sketches — max 25 MB each
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

const CreateChangeOrderModal: React.FC<CreateChangeOrderModalProps> = ({ open, onClose, onSubmit }) => {
  const projectId = useProjectId()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    // Attach file URLs to the change order data
    const fileUrls = uploadedFiles.map(f => ({ name: f.name, url: f.url, path: f.path }))
    await onSubmit({
      ...data,
      attachments: fileUrls.length > 0 ? fileUrls : undefined,
      attachment_urls: fileUrls.map(f => f.url),
    })
    setUploadedFiles([])
  }, [onSubmit, uploadedFiles])

  const handleClose = useCallback(() => {
    setUploadedFiles([])
    onClose()
  }, [onClose])

  return (
    <EntityFormModal
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title="New Change Order"
      schema={changeOrderSchema}
      fields={fields}
      defaults={{ type: 'pco', requested_date: today }}
      submitLabel={uploading ? 'Uploading...' : 'Create Change Order'}
      draftKey="draft_change_order"
      width={600}
      afterFields={
        <FileUploadSection
          files={uploadedFiles}
          onFilesChange={setUploadedFiles}
          projectId={projectId}
          uploading={uploading}
          setUploading={setUploading}
        />
      }
    />
  )
}

export default CreateChangeOrderModal
