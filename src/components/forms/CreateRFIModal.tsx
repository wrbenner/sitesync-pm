import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'
import { toast } from 'sonner'

export interface RFIFormData {
  title: string
  description: string
  priority: string
  assigned_to: string
  drawing_reference: string
  due_date: string
}

interface CreateRFIModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: RFIFormData) => void
}

const emptyForm: RFIFormData = {
  title: '',
  description: '',
  priority: 'medium',
  assigned_to: '',
  drawing_reference: '',
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto' as React.CSSProperties['appearance'],
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 100,
  resize: 'vertical',
  lineHeight: typography.lineHeight.normal,
}

const CreateRFIModal: React.FC<CreateRFIModalProps> = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState<RFIFormData>(emptyForm)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const handleChange = (field: keyof RFIFormData, value: string) => {
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
    toast.success('RFI created: ' + form.title)
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
                Create New RFI
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
                  placeholder="Enter the RFI title"
                  style={{ ...inputStyle, borderColor: errors.title ? colors.statusCritical : colors.borderDefault }}
                />
                {errors.title && <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, marginTop: spacing['1'], display: 'block' }}>Title is required</span>}
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe the information needed and any relevant context"
                  style={textareaStyle}
                />
              </div>

              {/* Priority */}
              <div>
                <label style={labelStyle}>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  style={selectStyle}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Assigned To */}
              <div>
                <label style={labelStyle}>Assigned To</label>
                <input
                  type="text"
                  value={form.assigned_to}
                  onChange={(e) => handleChange('assigned_to', e.target.value)}
                  placeholder="Name or company to respond"
                  style={inputStyle}
                />
              </div>

              {/* Drawing Reference */}
              <div>
                <label style={labelStyle}>Drawing Reference</label>
                <input
                  type="text"
                  value={form.drawing_reference}
                  onChange={(e) => handleChange('drawing_reference', e.target.value)}
                  placeholder="e.g. A 001, S 201"
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
                  Create RFI
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CreateRFIModal
