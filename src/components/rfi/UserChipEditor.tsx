// ── UserChipEditor ──────────────────────────────────────────────────────
// Multi-select chip editor for both distribution recipients and watchers.
// Procore-parity affordance: typeahead + chip-with-X for each picked entity,
// optional role-group quick-add to apply N members at once.
//
// Bugatti choices baked in:
//   • Decoupled from the storage model. Caller controls what counts as a
//     "value" (email string for distributions, user_id for watchers) by
//     passing in `valueOf` and `optionsKey`.
//   • Role groups expand inline (no popover gymnastics) so the visible
//     state matches the persisted state — no surprise.
//   • Adding a duplicate is a no-op, not an error.
//   • Removing a chip is reversible until Save (caller controls Save).
//   • Keyboard: Enter on an option adds it; Backspace on empty input
//     removes the last chip.
//   • PermissionGate-aware: caller passes `readOnly` to disable the editor
//     and render only the chip list.

import React, { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

export interface UserChipOption {
  /** Stable identity for dedupe. */
  value: string
  /** Display text on the chip + the typeahead row. */
  label: string
  /** Optional subline on the typeahead row (email, role, etc.). */
  sublabel?: string
}

export interface UserChipRoleGroup {
  /** Stable id for React keys. */
  id: string
  name: string
  /** Member identities that get added when the group is picked. */
  values: string[]
  /** Optional pretty labels paralleling `values`; falls back to `value`. */
  labels?: string[]
}

export interface UserChipEditorProps {
  /** Currently picked values. Render order matches insertion order. */
  value: string[]
  onChange: (next: string[]) => void
  /** Search-the-directory pool. Filtered locally by `label` + `sublabel`. */
  options: UserChipOption[]
  /** Optional role-group quick-add chips above the typeahead. */
  roleGroups?: UserChipRoleGroup[]
  /** Placeholder for the input. */
  placeholder?: string
  /** When true, renders only the chip list (no typeahead). */
  readOnly?: boolean
  /** Aria-label for the wrapper. */
  ariaLabel?: string
  /** When the chip list is empty AND read-only, render this string. */
  emptyText?: string
  /** Optional callback for when an option missing from the directory is added (free-typed email). */
  onFreeText?: (raw: string) => UserChipOption | null
}

export const UserChipEditor: React.FC<UserChipEditorProps> = ({
  value,
  onChange,
  options,
  roleGroups,
  placeholder = 'Add…',
  readOnly = false,
  ariaLabel,
  emptyText = 'No recipients',
  onFreeText,
}) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of options) map.set(o.value, o.label)
    return map
  }, [options])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const picked = new Set(value)
    return options
      .filter((o) => !picked.has(o.value))
      .filter((o) => {
        if (!q) return true
        return o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q)
      })
      .slice(0, 8)
  }, [options, value, query])

  const add = (next: string) => {
    if (!next) return
    if (value.includes(next)) return
    onChange([...value, next])
  }

  const addMany = (group: UserChipRoleGroup) => {
    const dedup = [...value]
    for (const v of group.values) {
      if (!dedup.includes(v)) dedup.push(v)
    }
    onChange(dedup)
  }

  const remove = (v: string) => {
    onChange(value.filter((x) => x !== v))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !query && value.length > 0) {
      e.preventDefault()
      onChange(value.slice(0, -1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[0]) {
        add(filtered[0].value)
        setQuery('')
        return
      }
      // Free-text: accept the literal text if `onFreeText` reshapes it
      // (typically used to wrap a typed email into an option).
      if (onFreeText) {
        const created = onFreeText(query)
        if (created) {
          add(created.value)
          setQuery('')
        }
      }
    }
  }

  // Read-only mode — show chips, no input
  if (readOnly) {
    if (value.length === 0) {
      return (
        <span aria-label={ariaLabel} style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontStyle: 'italic' }}>
          {emptyText}
        </span>
      )
    }
    return (
      <span aria-label={ariaLabel} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
        {value.map((v) => (
          <span key={v} style={chipStyle}>{labelByValue.get(v) ?? v}</span>
        ))}
      </span>
    )
  }

  return (
    <div aria-label={ariaLabel} style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      {/* Role-group quick-add row (collapsed when no groups) */}
      {roleGroups && roleGroups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {roleGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => addMany(g)}
              style={groupChipStyle}
              aria-label={`Add ${g.name} group`}
            >
              + {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Chip + input row */}
      <div
        style={chipRowStyle}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((v) => (
          <span key={v} style={chipStyle}>
            <span>{labelByValue.get(v) ?? v}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(v) }}
              style={chipRemoveBtn}
              aria-label={`Remove ${labelByValue.get(v) ?? v}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          style={inputStyle}
        />
      </div>

      {/* Typeahead dropdown */}
      {open && filtered.length > 0 && (
        <div style={dropdownStyle} role="listbox">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); add(o.value); setQuery(''); inputRef.current?.focus() }}
              style={dropdownRowStyle}
            >
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{o.label}</span>
              {o.sublabel && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{o.sublabel}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  alignItems: 'center',
  padding: '4px 6px',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  backgroundColor: colors.surfaceRaised,
  minHeight: 36,
  cursor: 'text',
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px 2px 8px',
  fontSize: typography.fontSize.caption,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceInset,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.full,
}

const groupChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  fontSize: typography.fontSize.caption,
  color: colors.primaryOrange,
  backgroundColor: 'transparent',
  border: `1px dashed ${colors.primaryOrange}80`,
  borderRadius: borderRadius.full,
  cursor: 'pointer',
}

const chipRemoveBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  border: 'none',
  background: 'transparent',
  color: colors.textTertiary,
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  flex: '1 1 120px',
  minWidth: 80,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: typography.fontSize.sm,
  color: colors.textPrimary,
  padding: '4px 0',
}

const dropdownStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  backgroundColor: colors.surfaceRaised,
  overflow: 'hidden',
  boxShadow: '0 6px 24px -10px rgba(0,0,0,0.18)',
}

const dropdownRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  textAlign: 'left',
  padding: '8px 12px',
  border: 'none',
  borderTop: `1px solid ${colors.borderSubtle}`,
  background: 'transparent',
  cursor: 'pointer',
}

export default UserChipEditor
