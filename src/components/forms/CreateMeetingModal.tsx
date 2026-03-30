import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'
import { toast } from 'sonner'

export interface MeetingFormData {
  title: string
  type: string
  date: string
  time: string
  location: string
  duration_minutes: string
}

interface CreateMeetingModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: MeetingFormData) => void
}

const emptyForm: MeetingFormData = {
  title: '',
  type: 'oac',
  date: '',
  time: '',
  location: '',
  duration_minutes: '60',
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

const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState<MeetingFormData>(emptyForm)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const handleChange = (field: keyof MeetingFormData, value: string) => {
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
    toast.success('Meeting created: ' + form.title)
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
                Create New Meeting
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
                  placeholder="Enter the meeting title"
                  style={{ ...inputStyle, borderColor: errors.title ? colors.statusCritical : colors.borderDefault }}
                />
                {errors.title && <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, marginTop: spacing['1'], display: 'block' }}>Title is required</span>}
              </div>

              {/* Type */}
              <div>
                <label style={labelStyle}>Type</label>
                <select
                  value={form.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  style={selectStyle}
                >
                  <option value="oac">OAC</option>
                  <option value="safety">Safety</option>
                  <option value="coordination">Coordination</option>
                  <option value="progress">Progress</option>
                  <option value="subcontractor">Subcontractor</option>
                </select>
              </div>

              {/* Date */}
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Time */}
              <div>
                <label style={labelStyle}>Time</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => handleChange('time', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Location */}
              <div>
                <label style={labelStyle}>Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="e.g. Jobsite Trailer, Conference Room"
                  style={inputStyle}
                />
              </div>

              {/* Duration in Minutes */}
              <div>
                <label style={labelStyle}>Duration in Minutes</label>
                <input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => handleChange('duration_minutes', e.target.value)}
                  placeholder="60"
                  min="1"
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
                  Create Meeting
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CreateMeetingModal
