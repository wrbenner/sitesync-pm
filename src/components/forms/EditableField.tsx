import React, { useState, useRef, useEffect, useCallback } from 'react'
import { } from 'zod'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'
import {   Pencil, Loader2 } from 'lucide-react'

// ── Inline Edit Cell ────────────────────────────────────
// Click a cell to edit. Enter saves, Escape cancels. Tab moves to next.

interface InlineEditCellProps {
  value: string
  onSave: (value: string) => Promise<void>
  type?: 'text' | 'select'
  options?: Array<{ value: string; label: string }>
  validate?: (v: string) => string | null
  disabled?: boolean
  displayComponent?: React.ReactNode
}

export const InlineEditCell: React.FC<InlineEditCellProps> = ({
  value,
  onSave,
  type = 'text',
  options,
  validate,
  disabled,
  displayComponent,
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [editing, value])

  const handleSave = useCallback(async () => {
    if (draft === value) {
      setEditing(false)
      return
    }
    if (validate) {
      const err = validate(draft)
      if (err) {
        setError(err)
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [draft, value, validate, onSave])

  const handleCancel = useCallback(() => {
    setDraft(value)
    setError(null)
    setEditing(false)
  }, [value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    } else if (e.key === 'Tab') {
      handleSave()
    }
  }, [handleSave, handleCancel])

  if (disabled) {
    return <>{displayComponent ?? <span>{value}</span>}</>
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing['1'],
          padding: `${spacing['1']} ${spacing['2']}`,
          borderRadius: borderRadius.sm,
          transition: `background-color ${transitions.instant}`,
          minHeight: 28,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        aria-label={`Edit ${value}`}
        title="Click to edit"
      >
        {displayComponent ?? <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{value || '\u2014'}</span>}
        <Pencil size={11} color={colors.textTertiary} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>
    )
  }

  if (type === 'select' && options) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
        <select
          ref={inputRef as React.Ref<HTMLSelectElement>}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            // Auto-save on select change
            const newVal = e.target.value
            if (newVal !== value) {
              setSaving(true)
              onSave(newVal).then(() => {
                setEditing(false)
              }).catch(() => {
                setError('Save failed')
              }).finally(() => setSaving(false))
            } else {
              setEditing(false)
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleCancel}
          disabled={saving}
          style={{
            padding: `${spacing['1']} ${spacing['2']}`,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            border: `1px solid ${colors.borderFocus}`,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.white,
            color: colors.textPrimary,
            outline: 'none',
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: colors.textTertiary }} />}
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        disabled={saving}
        style={{
          padding: `${spacing['1']} ${spacing['2']}`,
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          border: `1px solid ${error ? colors.statusCritical : colors.borderFocus}`,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.white,
          color: colors.textPrimary,
          outline: 'none',
          width: '100%',
          minWidth: 80,
        }}
      />
      {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: colors.textTertiary }} />}
      {error && (
        <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical }}>{error}</span>
      )}
    </div>
  )
}

// ── Editable Detail Field ───────────────────────────────
// For use inside detail panels. Renders as display, then switches to edit mode.

interface EditableDetailFieldProps {
  label: string
  value: string
  onSave: (value: string) => Promise<void>
  type?: 'text' | 'textarea' | 'select' | 'date'
  options?: Array<{ value: string; label: string }>
  editing: boolean
  displayContent?: React.ReactNode
}

export const EditableDetailField: React.FC<EditableDetailFieldProps> = ({
  label,
  value,
  onSave,
  type = 'text',
  options,
  editing,
  displayContent,
}) => {
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(value)
  }, [value, editing])

  const handleBlurSave = useCallback(async () => {
    if (draft !== value) {
      setSaving(true)
      try {
        await onSave(draft)
      } catch {
        setDraft(value)
      } finally {
        setSaving(false)
      }
    }
  }, [draft, value, onSave])

  const labelStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: typography.fontWeight.medium,
  }

  if (!editing) {
    return (
      <div>
        <div style={labelStyle}>{label}</div>
        <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary }}>
          {displayContent ?? (value || '\u2014')}
        </div>
      </div>
    )
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: spacing['2'],
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    color: colors.textPrimary,
    outline: 'none',
    boxSizing: 'border-box',
    transition: `border-color ${transitions.instant}`,
  }

  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {type === 'select' && options ? (
        <select
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setSaving(true)
            onSave(e.target.value).finally(() => setSaving(false))
          }}
          disabled={saving}
          style={{ ...inputBase, cursor: 'pointer' }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlurSave}
          disabled={saving}
          style={{ ...inputBase, minHeight: 60, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlurSave}
          disabled={saving}
          style={inputBase}
        />
      )}
    </div>
  )
}
