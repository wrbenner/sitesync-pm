// ── InlineEditField ─────────────────────────────────────────────────────
// Universal inline-edit primitive for RFI Detail sidebars and any other
// per-record metadata field. Required by RFI Module Build Spec Part 8 +
// Part 17 (P0 item #7): subject, ball-in-court, due date, priority,
// drawing ref, and spec section all need direct edit on the detail page,
// not a separate edit modal.
//
// Behavior contract (Bugatti grade — do not relax):
//   • Click value → enters edit mode (or focus-then-press-Enter for kbd).
//   • Esc cancels (no save), Enter commits, blur commits.
//   • Pending state shown via spinner/disabled while save is in flight.
//   • Server error reverts the optimistic state and surfaces a toast.
//   • PermissionGate wraps the trigger when `permission` is provided.
//   • Empty values render the placeholder ("—" by default).
//   • Read-only fallback when `disabled` or no `onSave` provided.
//
// Anti-patterns this primitive prevents:
//   • Custom inline editors per field (drift, inconsistent UX).
//   • Forgetting the Esc-to-cancel keyboard contract.
//   • Saving on every keystroke (we save once on commit, not per char).

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/todo */
import React, { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { PermissionGate } from '../auth/PermissionGate'
import type { Permission } from '../../hooks/usePermissions'

export type InlineEditFieldType = 'text' | 'textarea' | 'date' | 'select'

export interface InlineSelectOption {
  value: string
  label: string
}

export interface InlineEditFieldProps {
  /** Current value (string for all types — date is ISO yyyy-mm-dd). */
  value: string | null | undefined
  /** Save handler. Throw to surface an error toast and revert. */
  onSave: (next: string) => Promise<void> | void
  /** Field display label, shown above the value in detail-row layout. */
  label?: string
  /** Field type — determines the edit input. Default: 'text'. */
  type?: InlineEditFieldType
  /** Options for type='select'. */
  options?: InlineSelectOption[]
  /** Render the value as plaintext when no save handler / read-only. */
  disabled?: boolean
  /** Placeholder shown when value is empty. Default: "—". */
  placeholder?: string
  /** PermissionGate wraps the trigger when set; non-permitted users see a static read-only display. */
  permission?: Permission
  /** Optional formatter for read-state display (e.g. format dates, lookup user names). */
  format?: (value: string) => React.ReactNode
  /** Maxlength for text/textarea inputs. */
  maxLength?: number
  /** Aria-label override; falls back to `label`. */
  ariaLabel?: string
}

export const InlineEditField: React.FC<InlineEditFieldProps> = ({
  value,
  onSave,
  label,
  type = 'text',
  options = [],
  disabled = false,
  placeholder = '—',
  permission,
  format,
  maxLength,
  ariaLabel,
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      // Select all so the user can replace immediately.
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select()
      }
    }
  }, [editing])

  const commit = async () => {
    const next = draft.trim()
    const current = (value ?? '').trim()
    if (next === current) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(next)
      setEditing(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast.error(`Could not save: ${msg}`)
      // Don't exit edit mode on error — let the user retry or Esc.
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  // ── Read-mode rendering ────────────────────────────────────────────
  const readDisplay = (() => {
    const raw = (value ?? '').toString()
    if (!raw) {
      return (
        <span style={{ color: colors.textTertiary, fontStyle: 'italic' }}>
          {placeholder}
        </span>
      )
    }
    if (format) return format(raw)
    if (type === 'select') {
      const match = options.find((o) => o.value === raw)
      return match ? match.label : raw
    }
    return raw
  })()

  if (disabled || !onSave) {
    return (
      <span aria-label={ariaLabel ?? label} style={{ color: colors.textPrimary }}>
        {readDisplay}
      </span>
    )
  }

  // ── Edit-mode rendering ────────────────────────────────────────────
  const renderEditor = () => {
    const sharedStyle: React.CSSProperties = {
      flex: 1,
      padding: '6px 10px',
      fontSize: typography.fontSize.sm,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceRaised,
      border: `1.5px solid ${colors.primaryOrange}`,
      borderRadius: borderRadius.base,
      outline: 'none',
      fontFamily: 'inherit',
    }
    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && type !== 'textarea') {
        e.preventDefault()
        commit()
      } else if (e.key === 'Enter' && type === 'textarea' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        commit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }
    if (type === 'textarea') {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          maxLength={maxLength}
          aria-label={ariaLabel ?? label}
          style={{ ...sharedStyle, resize: 'vertical', minHeight: 64 }}
          disabled={saving}
        />
      )
    }
    if (type === 'select') {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          aria-label={ariaLabel ?? label}
          style={sharedStyle}
          disabled={saving}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === 'date' ? 'date' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        maxLength={maxLength}
        aria-label={ariaLabel ?? label}
        style={sharedStyle}
        disabled={saving}
      />
    )
  }

  const trigger = editing ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['2'], width: '100%' }}>
      {renderEditor()}
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); commit() }}
        disabled={saving}
        aria-label="Save"
        style={iconBtnStyle(colors.statusActive)}
      >
        <Check size={12} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); cancel() }}
        disabled={saving}
        aria-label="Cancel"
        style={iconBtnStyle(colors.textTertiary)}
      >
        <X size={12} />
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Edit ${ariaLabel ?? label ?? 'value'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        margin: '-2px -6px',
        borderRadius: borderRadius.base,
        border: 'none',
        background: 'transparent',
        color: colors.textPrimary,
        fontFamily: 'inherit',
        fontSize: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background-color 0.12s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {readDisplay}
    </button>
  )

  if (permission) {
    return (
      <PermissionGate permission={permission} fallback={<span style={{ color: colors.textPrimary }}>{readDisplay}</span>}>
        {trigger}
      </PermissionGate>
    )
  }

  return trigger
}

const iconBtnStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: borderRadius.base,
  border: 'none',
  background: 'transparent',
  color,
  cursor: 'pointer',
})

export default InlineEditField
