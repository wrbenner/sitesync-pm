import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'
import { toast } from 'sonner'

export interface PunchItemFormData {
  title: string
  description: string
  location: string
  floor: string
  trade: string
  priority: string
  assigned_to: string
  due_date: string
}

interface CreatePunchItemModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: PunchItemFormData) => void
}

const emptyForm: PunchItemFormData = {
  title: '',
  description: '',
  location: '',
  floor: '',
  trade: '',
  priority: 'medium',
  assigned_to: '',
  due_date: '',
}

const floorOptions = [
  'Basement', 'Lobby', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4',
  'Floor 5', 'Floor 6', 'Floor 7', 'Floor 8', 'Floor 9', 'Floor 10',
  'Floor 11', 'Floor 12', 'Roof', 'Parking',
]

const tradeOptions = [
  'Structural', 'Mechanical', 'Electrical', 'Plumbing',
  'Fire Protection', 'Finishing', 'General',
]

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

const CreatePunchItemModal: React.FC<CreatePunchItemModalProps> = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState<PunchItemFormData>(emptyForm)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const handleChange = (field: keyof PunchItemFormData, value: string) => {
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
    toast.success('Punch item created: ' + form.title)
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
                Add Punch Item
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
                  placeholder="Brief description of the issue"
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
                  placeholder="Provide additional details about the deficiency"
                  style={textareaStyle}
                />
              </div>

              {/* Location */}
              <div>
                <label style={labelStyle}>Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="e.g. Unit 802, Corridor B"
                  style={inputStyle}
                />
              </div>

              {/* Floor and Trade row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
                <div>
                  <label style={labelStyle}>Floor</label>
                  <select
                    value={form.floor}
                    onChange={(e) => handleChange('floor', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select floor</option>
                    {floorOptions.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Trade</label>
                  <select
                    value={form.trade}
                    onChange={(e) => handleChange('trade', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select trade</option>
                    {tradeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
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
                  placeholder="Person or crew responsible"
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
                  Add Punch Item
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CreatePunchItemModal
