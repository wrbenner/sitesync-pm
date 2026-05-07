// Phase 3 — bulk edit modal.
//
// Per SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 3 §B item 1.
// Currently scoped to: Status, Submittal Manager, Responsible Contractor.
// Saves via the D38 bulkUpdateSubmittals endpoint.
//
// Shows a confirm step ("This will update 12 submittals across 3 fields").
// PermissionGate is enforced by the parent menu — this modal trusts it
// is only opened when the user has submittals.edit.

import React, { useState } from 'react'
import { toast } from 'sonner'
import { X, AlertTriangle } from 'lucide-react'
import { submittalService } from '../../services/submittalService'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
  critical: '#C93B3B',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface BulkEditModalProps {
  open: boolean
  onClose: () => void
  selectedIds: string[]
  onComplete: () => void
}

interface BulkEditFields {
  current_reviewer_id?: string
  responsible_sub_id?: string
  is_critical_path?: boolean
  is_private?: boolean
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  open,
  onClose,
  selectedIds,
  onComplete,
}) => {
  const [fields, setFields] = useState<BulkEditFields>({})
  const [stage, setStage] = useState<'edit' | 'confirm' | 'saving'>('edit')

  if (!open) return null

  const fieldsTouched = Object.values(fields).some((v) => v !== undefined && v !== '')

  const apply = async () => {
    setStage('saving')
    const updates: BulkEditFields = {}
    if (fields.current_reviewer_id) updates.current_reviewer_id = fields.current_reviewer_id
    if (fields.responsible_sub_id) updates.responsible_sub_id = fields.responsible_sub_id
    if (fields.is_critical_path !== undefined) updates.is_critical_path = fields.is_critical_path
    if (fields.is_private !== undefined) updates.is_private = fields.is_private

    const result = await submittalService.bulkUpdate(selectedIds, updates)
    if (result.error) {
      toast.error(`Bulk update failed: ${result.error.message}`)
      setStage('edit')
      return
    }
    toast.success(`Updated ${result.data?.count ?? selectedIds.length} submittals.`)
    onComplete()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-edit-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '92vw',
          backgroundColor: '#fff',
          borderRadius: 8,
          boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONT,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${C.borderSubtle}`,
          }}
        >
          <h2
            id="bulk-edit-title"
            style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            Bulk edit · {selectedIds.length} submittal{selectedIds.length === 1 ? '' : 's'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: C.ink3,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
        </header>

        {stage !== 'confirm' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormRow label="Current reviewer (UUID)" hint="Reassign Ball-in-Court for all selected.">
              <input
                type="text"
                value={fields.current_reviewer_id ?? ''}
                onChange={(e) => setFields({ ...fields, current_reviewer_id: e.target.value || undefined })}
                placeholder="leave blank to skip"
                style={inputStyle}
              />
            </FormRow>
            <FormRow label="Responsible sub (UUID)" hint="Replace responsible_sub_id for all selected.">
              <input
                type="text"
                value={fields.responsible_sub_id ?? ''}
                onChange={(e) => setFields({ ...fields, responsible_sub_id: e.target.value || undefined })}
                placeholder="leave blank to skip"
                style={inputStyle}
              />
            </FormRow>
            <FormRow label="Critical path" hint="Toggle is_critical_path for all selected.">
              <TriToggle
                value={fields.is_critical_path}
                onChange={(v) => setFields({ ...fields, is_critical_path: v })}
              />
            </FormRow>
            <FormRow label="Private" hint="Toggle is_private for all selected.">
              <TriToggle
                value={fields.is_private}
                onChange={(v) => setFields({ ...fields, is_private: v })}
              />
            </FormRow>
          </div>
        )}

        {stage === 'confirm' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 12,
                background: 'rgba(196, 133, 12, 0.08)',
                color: '#7A5108',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <AlertTriangle size={14} />
              You are about to update {selectedIds.length} submittal
              {selectedIds.length === 1 ? '' : 's'}.
            </div>
            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: C.ink2 }}>
              {fields.current_reviewer_id && <li>Current reviewer → {fields.current_reviewer_id}</li>}
              {fields.responsible_sub_id && <li>Responsible sub → {fields.responsible_sub_id}</li>}
              {fields.is_critical_path !== undefined && (
                <li>Critical path → {fields.is_critical_path ? 'true' : 'false'}</li>
              )}
              {fields.is_private !== undefined && (
                <li>Private → {fields.is_private ? 'true' : 'false'}</li>
              )}
            </ul>
            <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
              Status transitions and approvals are handled per-submittal and aren't bulk-edited here.
            </p>
          </div>
        )}

        <footer
          style={{
            padding: 12,
            borderTop: `1px solid ${C.borderSubtle}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => (stage === 'confirm' ? setStage('edit') : onClose())}
            disabled={stage === 'saving'}
            style={secondaryBtnStyle}
          >
            {stage === 'confirm' ? 'Back' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => (stage === 'edit' ? setStage('confirm') : apply())}
            disabled={!fieldsTouched || stage === 'saving'}
            style={{
              ...primaryBtnStyle,
              opacity: !fieldsTouched || stage === 'saving' ? 0.6 : 1,
              cursor: !fieldsTouched || stage === 'saving' ? 'not-allowed' : 'pointer',
            }}
          >
            {stage === 'edit' ? 'Continue' : stage === 'confirm' ? 'Apply' : 'Saving…'}
          </button>
        </footer>
      </div>
    </div>
  )
}

const FormRow: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: C.ink2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </label>
    {children}
    {hint && <span style={{ fontSize: 11, color: C.ink3 }}>{hint}</span>}
  </div>
)

const TriToggle: React.FC<{ value?: boolean; onChange: (v: boolean | undefined) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 6 }}>
    {[
      { v: undefined, label: 'No change' },
      { v: true,      label: 'Set true' },
      { v: false,     label: 'Set false' },
    ].map((opt) => {
      const active = value === opt.v
      return (
        <button
          key={String(opt.v)}
          type="button"
          onClick={() => onChange(opt.v as boolean | undefined)}
          style={{
            padding: '5px 10px',
            border: `1px solid ${active ? C.brandOrange : C.border}`,
            borderRadius: 4,
            background: active ? 'rgba(244, 120, 32, 0.08)' : '#fff',
            color: active ? C.brandOrange : C.ink2,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {opt.label}
        </button>
      )
    })}
  </div>
)

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 12,
  fontFamily: FONT,
  outline: 'none',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  backgroundColor: C.brandOrange,
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FONT,
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '7px 12px',
  backgroundColor: '#fff',
  color: C.ink,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FONT,
}

export default BulkEditModal
