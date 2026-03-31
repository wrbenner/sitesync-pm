import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions, focusRing } from '../../styles/theme'

// ── Shared Form Modal Shell ──────────────────────────────

interface FormModalProps {
  open: boolean
  onClose: () => void
  title: string
  width?: number
  children: React.ReactNode
}

export const FormModal: React.FC<FormModalProps> = ({ open, onClose, title, width = 520, children }) => (
  <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay style={overlayStyle}>
        <Dialog.Content
          style={{ ...contentStyle, width }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['5'] }}>
            <Dialog.Title style={{
              margin: 0, fontSize: typography.fontSize.subtitle,
              fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
              fontFamily: typography.fontFamily,
            }}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  padding: spacing['1'], borderRadius: borderRadius.sm,
                  color: colors.textTertiary, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Portal>
  </Dialog.Root>
)

// ── Form Layout ──────────────────────────────────────────

export const FormBody: React.FC<{
  onSubmit: (e: React.FormEvent) => void
  children: React.ReactNode
}> = ({ onSubmit, children }) => (
  <form
    onSubmit={onSubmit}
    style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}
  >
    {children}
  </form>
)

export const FormRow: React.FC<{
  columns?: number
  children: React.ReactNode
}> = ({ columns = 2, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: spacing['3'] }}>
    {children}
  </div>
)

export const FormFooter: React.FC<{
  onCancel: () => void
  submitLabel: string
  cancelLabel?: string
}> = ({ onCancel, submitLabel, cancelLabel = 'Cancel' }) => (
  <div style={{
    display: 'flex', justifyContent: 'flex-end', gap: spacing['3'],
    marginTop: spacing['2'], paddingTop: spacing['4'],
    borderTop: `1px solid ${colors.borderSubtle}`,
  }}>
    <button
      type="button"
      onClick={onCancel}
      style={cancelBtnStyle}
    >
      {cancelLabel}
    </button>
    <button type="submit" style={submitBtnStyle}>
      {submitLabel}
    </button>
  </div>
)

// ── Field Components ─────────────────────────────────────

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

export const FormField: React.FC<FieldProps> = ({ label, required, error, children }) => (
  <div>
    <label style={labelStyle}>
      {label}{required && ' *'}
    </label>
    {children}
    {error && (
      <span
        role="alert"
        style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, marginTop: spacing['1'], display: 'block' }}
      >
        {error}
      </span>
    )}
  </div>
)

export const FormInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }
> = ({ hasError, style, ...props }) => (
  <input
    {...props}
    style={{
      ...inputStyle,
      borderColor: hasError ? colors.statusCritical : colors.borderDefault,
      ...style,
    }}
  />
)

export const FormTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }
> = ({ hasError, style, ...props }) => (
  <textarea
    {...props}
    style={{
      ...textareaStyle,
      borderColor: hasError ? colors.statusCritical : colors.borderDefault,
      ...style,
    }}
  />
)

export const FormSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }
> = ({ children, style, ...props }) => (
  <select {...props} style={{ ...selectStyle, ...style }}>
    {children}
  </select>
)

export const FormCheckbox: React.FC<{
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}> = ({ id, label, checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: 18, height: 18, accentColor: colors.primaryOrange, cursor: 'pointer' }}
    />
    <label
      htmlFor={id}
      style={{
        fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
        color: colors.textPrimary, fontWeight: typography.fontWeight.medium,
        cursor: 'pointer',
      }}
    >
      {label}
    </label>
  </div>
)

// ── Shared Styles ────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: colors.overlayDark,
  backdropFilter: 'blur(4px)',
  zIndex: zIndex.modal as number,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'fadeIn 200ms ease-out',
}

const contentStyle: React.CSSProperties = {
  maxHeight: '90vh',
  overflowY: 'auto',
  backgroundColor: colors.white,
  borderRadius: borderRadius.xl,
  boxShadow: shadows.panel,
  padding: spacing['6'],
  position: 'relative',
  fontFamily: typography.fontFamily,
  animation: 'scaleIn 200ms ease-out',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: typography.fontSize.label,
  fontWeight: typography.fontWeight.medium,
  color: colors.textSecondary,
  marginBottom: spacing['1'],
  letterSpacing: typography.letterSpacing.wider,
  textTransform: 'uppercase',
  fontFamily: typography.fontFamily,
}

export const inputStyle: React.CSSProperties = {
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
  transition: `border-color ${transitions.instant}`,
}

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto' as React.CSSProperties['appearance'],
}

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 100,
  resize: 'vertical',
  lineHeight: typography.lineHeight.normal,
}

const cancelBtnStyle: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['5']}`,
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.medium,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.md,
  backgroundColor: colors.white,
  color: colors.textSecondary,
  cursor: 'pointer',
  transition: `background-color ${transitions.instant}`,
}

const submitBtnStyle: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['5']}`,
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.semibold,
  border: 'none',
  borderRadius: borderRadius.md,
  backgroundColor: colors.primaryOrange,
  color: colors.white,
  cursor: 'pointer',
  transition: `background-color ${transitions.instant}`,
}
