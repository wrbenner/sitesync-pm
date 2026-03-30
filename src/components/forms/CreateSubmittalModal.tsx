import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'
import { toast } from 'sonner'

export interface SubmittalFormData {
  title: string
  spec_section: string
  subcontractor: string
  lead_time_weeks: string
  due_date: string
}

interface CreateSubmittalModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: SubmittalFormData) => void
}

const emptyForm: SubmittalFormData = {
  title: '',
  spec_section: '',
  subcontractor: '',
  lead_time_weeks: '',
  due_date: '',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(4px)',
  zIndex: zIndex.modal as number,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const contentStyle: React.CSSProperties = {
  width: 520,
  maxHeight: '90vh',
  overflowY: 'auto',
  backgroundColor: colors.white,
  borderRadius: borderRadius.xl,
  boxShadow: shadows.panel,
  padding: spacing['6'],
  position: 'relative',
  fontFamily: typography.fontFamily,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: typography.fontSize.label,
  fontWeight: typography.fontWeight.medium,
  color: colors.textSecondary,
  marginBottom: spacing['1'],
  letterSpacing: typography.letterSpacing.wider,
  textTransform: 'uppercase',
  fontFamily: typography.fontFamily,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.md,
  padding: spacing['3'],
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  color: colors.textPrimary,
  backgroundColor: colors.white,
  outline: 'none',
  boxSizing: 'border-box',
}

const CreateSubmittalModal: React.FC<CreateSubmittalModalProps> = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState<SubmittalFormData>(emptyForm)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const handleChange = (field: keyof SubmittalFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, boolean> = {}
    if (!form.title.trim()) newErrors.title = true
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    onSubmit(form)
    toast.success('Submittal created: ' + form.title)
    setForm(emptyForm)
    setErrors({})
    onClose()
  }

  const handleClose = () => {
    setForm(emptyForm)
    setErrors({})
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle}>
          <Dialog.Content style={contentStyle} onOpenAutoFocus={(e) => e.preventDefault()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['5'] }}>
              <Dialog.Title style={{ margin: 0, fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontFamily: typography.fontFamily }}>
                Create New Submittal
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: spacing['1'], borderRadius: borderRadius.sm, color: colors.textTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              {/* Title */}
              <div>
                <label style={labelStyle}>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Enter the submittal title"
                  style={{ ...inputStyle, borderColor: errors.title ? colors.statusCritical : colors.borderDefault }}
                />
                {errors.title && <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, marginTop: spacing['1'], display: 'block' }}>Title is required</span>}
              </div>

              {/* Spec Section */}
              <div>
                <label style={labelStyle}>Spec Section</label>
                <input
                  type="text"
                  value={form.spec_section}
                  onChange={(e) => handleChange('spec_section', e.target.value)}
                  placeholder="e.g. 05 12 00"
                  style={inputStyle}
                />
              </div>

              {/* Subcontractor */}
              <div>
                <label style={labelStyle}>Subcontractor</label>
                <input
                  type="text"
                  value={form.subcontractor}
                  onChange={(e) => handleChange('subcontractor', e.target.value)}
                  placeholder="Subcontractor or supplier name"
                  style={inputStyle}
                />
              </div>

              {/* Lead Time in Weeks */}
              <div>
                <label style={labelStyle}>Lead Time in Weeks</label>
                <input
                  type="number"
                  value={form.lead_time_weeks}
                  onChange={(e) => handleChange('lead_time_weeks', e.target.value)}
                  placeholder="e.g. 6"
                  min="0"
                  style={inputStyle}
                />
              </div>

              {/* Due Date */}
              <div>
                <label style={labelStyle}>Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['2'], paddingTop: spacing['4'], borderTop: `1px solid ${colors.borderSubtle}` }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: `${spacing['2']} ${spacing['5']}`,
                    fontSize: typography.fontSize.body,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.white,
                    color: colors.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: `${spacing['2']} ${spacing['5']}`,
                    fontSize: typography.fontSize.body,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.semibold,
                    border: 'none',
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.primaryOrange,
                    color: colors.white,
                    cursor: 'pointer',
                  }}
                >
                  Create Submittal
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CreateSubmittalModal
