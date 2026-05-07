// Phase 4 — Create Package dialog.
//
// Opens from BulkActionsMenu → "Create Package from Selected" with the
// currently-selected submittal ids passed in. The user enters name +
// description + responsible_sub + csi_section; the RPC creates the package
// and atomically attaches the selected submittals.
//
// Confirms with a diff preview: "X submittals will be moved to this package".

import React, { useState } from 'react'
import { toast } from 'sonner'
import { useCreateSubmittalPackage } from '../../../hooks/useSubmittalPackages'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface CreatePackageDialogProps {
  open: boolean
  projectId: string
  preselectedSubmittalIds: string[]
  onClose: () => void
}

export const CreatePackageDialog: React.FC<CreatePackageDialogProps> = ({
  open,
  projectId,
  preselectedSubmittalIds,
  onClose,
}) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [csiSection, setCsiSection] = useState('')
  const create = useCreateSubmittalPackage(projectId)

  if (!open) return null

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Package name is required')
      return
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        csiSection: csiSection.trim() || null,
        submittalIds: preselectedSubmittalIds,
      })
      toast.success(`Package created: ${title}`)
      setTitle('')
      setDescription('')
      setCsiSection('')
      onClose()
    } catch (err) {
      toast.error('Failed to create package: ' + (err as Error).message)
    }
  }

  return (
    <DialogShell title="Create Package" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Package name" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="Beacon Concrete"
            style={inputStyle}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
          />
        </Field>
        <Field label="CSI section">
          <input
            type="text"
            value={csiSection}
            onChange={(e) => setCsiSection(e.target.value)}
            placeholder="03 30 00"
            style={inputStyle}
          />
        </Field>
        <div
          role="status"
          style={{
            padding: '8px 10px',
            backgroundColor: C.surfaceInset,
            border: `1px solid ${C.borderSubtle}`,
            borderRadius: 4,
            fontSize: 12,
            color: C.ink2,
          }}
        >
          {preselectedSubmittalIds.length === 0
            ? 'No submittals will be moved. You can attach them later via Manage Members.'
            : `${preselectedSubmittalIds.length} submittal${preselectedSubmittalIds.length === 1 ? '' : 's'} will be moved to this package.`}
        </div>
        <DialogFooter>
          <SecondaryBtn type="button" onClick={onClose} disabled={create.isPending}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn type="submit" disabled={!title.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create Package'}
          </PrimaryBtn>
        </DialogFooter>
      </form>
    </DialogShell>
  )
}

// ── Shared dialog primitives ────────────────────────────────────────────────

export const DialogShell: React.FC<{
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: number
}> = ({ title, onClose, children, width = 480 }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={title}
    onClick={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(26, 22, 19, 0.30)',
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: FONT,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width,
        maxWidth: '100%',
        backgroundColor: '#fff',
        borderRadius: 6,
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.16)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${C.borderSubtle}`,
          backgroundColor: C.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          style={{ border: 'none', backgroundColor: 'transparent', color: C.ink2, fontSize: 18, cursor: 'pointer' }}
        >
          ×
        </button>
      </header>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  </div>
)

export const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 12, fontWeight: 600, color: C.ink2 }}>
      {label}
      {required && <span style={{ color: '#C93B3B', marginLeft: 2 }}>*</span>}
    </span>
    {children}
  </label>
)

export const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 13,
  fontFamily: FONT,
  color: C.ink,
  backgroundColor: '#fff',
  outline: 'none',
}

export const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>{children}</div>
)

export const PrimaryBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...rest }) => (
  <button
    {...rest}
    style={{
      padding: '7px 14px',
      backgroundColor: C.brandOrange,
      color: '#fff',
      border: 'none',
      borderRadius: 4,
      cursor: rest.disabled ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontWeight: 600,
      fontFamily: FONT,
      opacity: rest.disabled ? 0.55 : 1,
    }}
  >
    {children}
  </button>
)

export const SecondaryBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...rest }) => (
  <button
    {...rest}
    style={{
      padding: '7px 14px',
      backgroundColor: '#fff',
      color: C.ink,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      cursor: rest.disabled ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontWeight: 500,
      fontFamily: FONT,
      opacity: rest.disabled ? 0.55 : 1,
    }}
  >
    {children}
  </button>
)

export default CreatePackageDialog
