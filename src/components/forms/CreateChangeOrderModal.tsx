import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'
import { toast } from 'sonner'

export interface ChangeOrderFormData {
  description: string
  amount: string
  requested_by: string
  requested_date: string
}

interface CreateChangeOrderModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: ChangeOrderFormData) => void
}

const today = new Date().toISOString().split('T')[0]

const emptyForm: ChangeOrderFormData = {
  description: '',
  amount: '',
  requested_by: '',
  requested_date: today,
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

const CreateChangeOrderModal: React.FC<CreateChangeOrderModalProps> = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState<ChangeOrderFormData>(emptyForm)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const handleChange = (field: keyof ChangeOrderFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, boolean> = {}
    if (!form.description.trim()) newErrors.description = true
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    onSubmit(form)
    toast.success('Change order created: ' + form.description)
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
                New Change Order
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
              {/* Description */}
              <div>
                <label style={labelStyle}>Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe the change order"
                  style={{ ...inputStyle, borderColor: errors.description ? colors.statusCritical : colors.borderDefault }}
                />
                {errors.description && <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, marginTop: spacing['1'], display: 'block' }}>Description is required</span>}
              </div>

              {/* Amount */}
              <div>
                <label style={labelStyle}>Amount</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)', fontSize: typography.fontSize.body, color: colors.textTertiary }}>$</span>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => handleChange('amount', e.target.value)}
                    placeholder="0"
                    min="0"
                    style={{ ...inputStyle, paddingLeft: spacing['6'] }}
                  />
                </div>
              </div>

              {/* Requested By */}
              <div>
                <label style={labelStyle}>Requested By</label>
                <input
                  type="text"
                  value={form.requested_by}
                  onChange={(e) => handleChange('requested_by', e.target.value)}
                  placeholder="Name or company"
                  style={inputStyle}
                />
              </div>

              {/* Requested Date */}
              <div>
                <label style={labelStyle}>Requested Date</label>
                <input
                  type="date"
                  value={form.requested_date}
                  onChange={(e) => handleChange('requested_date', e.target.value)}
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
                  Create Change Order
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CreateChangeOrderModal
