// ── Smart Picker ─────────────────────────────────────────────
// Enhanced port of sitesyncai-web SearchableSelect. Entity-aware
// rendering, recent selections chip row, inline "create new" option,
// full keyboard navigation, and multi-select with removable tags.

import React, {
  useCallback, useEffect, useId, useMemo, useRef, useState,
} from 'react'
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../../styles/theme'

// ── Option type ──────────────────────────────────────────────
export interface SmartPickerOption<T = unknown> {
  value: string
  label: string
  /** Optional rich metadata used for entity-aware rendering */
  meta?: {
    avatar?: string
    role?: string
    discipline?: string
    thumbnail?: string
    status?: string
    subtitle?: string
  }
  data?: T
}

export interface SmartPickerProps<T = unknown> {
  options: SmartPickerOption<T>[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  placeholder?: string
  label?: string
  multi?: boolean
  disabled?: boolean
  /** Unique key for recent-selection memory (localStorage) */
  recentKey?: string
  /** Render the inline creator form. Returns the newly created option. */
  onCreateNew?: (query: string) => Promise<SmartPickerOption<T> | null>
  /** Label for the create option. Defaults to "Create new" */
  createLabel?: string
  /** Max recent chips to show */
  maxRecent?: number
}

const RECENT_MAX_STORAGE = 5

function loadRecent(key: string | undefined): string[] {
  if (!key) return []
  try { return JSON.parse(localStorage.getItem(`smartpicker-recent-${key}`) ?? '[]') } catch { return [] }
}
function saveRecent(key: string | undefined, value: string) {
  if (!key) return
  try {
    const cur: string[] = loadRecent(key)
    const next = [value, ...cur.filter((v) => v !== value)].slice(0, RECENT_MAX_STORAGE)
    localStorage.setItem(`smartpicker-recent-${key}`, JSON.stringify(next))
  } catch { /* ignore */ }
}

// ── Match helper ─────────────────────────────────────────────
function matches(opt: SmartPickerOption, q: string): boolean {
  if (!q) return true
  const query = q.toLowerCase()
  return opt.label.toLowerCase().includes(query)
    || opt.value.toLowerCase().includes(query)
    || (opt.meta?.subtitle?.toLowerCase().includes(query) ?? false)
}

// ── Option row renderer ──────────────────────────────────────
const OptionRow: React.FC<{
  opt: SmartPickerOption
  isSelected: boolean
  isActive: boolean
  onSelect: () => void
}> = ({ opt, isSelected, isActive, onSelect }) => {
  const m = opt.meta
  return (
    <li
      role="option"
      aria-selected={isSelected}
      onMouseDown={(e) => { e.preventDefault(); onSelect() }}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['3']}`, minHeight: 56,
        background: isActive ? colors.surfaceHover : 'transparent',
        cursor: 'pointer', listStyle: 'none',
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}
    >
      {m?.avatar && (
        <img src={m.avatar} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
      )}
      {m?.thumbnail && (
        <img src={m.thumbnail} alt="" width={32} height={40} style={{ borderRadius: borderRadius.sm, objectFit: 'cover' }} />
      )}
      {m?.discipline && !m.thumbnail && (
        <div style={{
          padding: `${spacing['1']} ${spacing['2']}`, background: colors.orangeSubtle,
          color: colors.orangeText, fontSize: 10, fontWeight: typography.fontWeight.bold,
          borderRadius: borderRadius.sm, textTransform: 'uppercase',
        }}>
          {m.discipline}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: typography.fontSize.body, color: colors.textPrimary,
          fontWeight: typography.fontWeight.medium,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {opt.label}
        </div>
        {(m?.role || m?.subtitle) && (
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {m.role || m.subtitle}
          </div>
        )}
      </div>
      {m?.status && (
        <span style={{
          padding: `2px ${spacing['2']}`, fontSize: 10, fontWeight: typography.fontWeight.bold,
          background: colors.statusInfoSubtle, color: colors.statusInfo,
          borderRadius: borderRadius.sm, textTransform: 'uppercase',
        }}>
          {m.status}
        </span>
      )}
      {isSelected && <Check size={16} color={colors.primaryOrange} />}
    </li>
  )
}

// ── Main ─────────────────────────────────────────────────────
export function SmartPicker<T = unknown>({
  options, value, onChange, placeholder = 'Select…', label,
  multi = false, disabled = false, recentKey, onCreateNew,
  createLabel = 'Create new', maxRecent = 5,
}: SmartPickerProps<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => {
    if (multi) return Array.isArray(value) ? value : []
    return typeof value === 'string' ? value : ''
  }, [value, multi])

  const selectedOptions = useMemo(() => {
    const vals = Array.isArray(selected) ? selected : [selected]
    return options.filter((o) => vals.includes(o.value))
  }, [selected, options])

  const recent = useMemo(() => {
    const ids = loadRecent(recentKey).slice(0, maxRecent)
    return ids.map((id) => options.find((o) => o.value === id)).filter(Boolean) as SmartPickerOption<T>[]
  }, [recentKey, options, maxRecent])

  const filtered = useMemo(
    () => options.filter((o) => matches(o, query)),
    [options, query]
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const choose = useCallback((val: string) => {
    if (multi) {
      const cur = Array.isArray(value) ? value : []
      const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val]
      onChange(next)
      saveRecent(recentKey, val)
    } else {
      onChange(val)
      saveRecent(recentKey, val)
      setOpen(false)
      setQuery('')
    }
  }, [multi, value, onChange, recentKey])

  const handleCreate = useCallback(async () => {
    if (!onCreateNew || !query.trim()) return
    setCreating(true)
    try {
      const created = await onCreateNew(query.trim())
      if (created) {
        choose(created.value)
        setQuery('')
      }
    } finally {
      setCreating(false)
    }
  }, [onCreateNew, query, choose])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'Enter' || e.key === 'ArrowDown')) { setOpen(true); return }
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[activeIdx]
      if (opt) choose(opt.value)
      else if (onCreateNew && query.trim()) handleCreate()
    }
  }

  // Reset activeIdx when query changes
  useEffect(() => { setActiveIdx(0) }, [query])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label htmlFor={id} style={{
          display: 'block', fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold, color: colors.textSecondary,
          marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>{label}</label>
      )}

      {/* Trigger */}
      <button
        id={id} type="button" disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox" aria-expanded={open}
        style={{
          width: '100%', minHeight: 56, padding: spacing['2'],
          background: colors.surfacePage, border: `1px solid ${open ? colors.primaryOrange : colors.borderDefault}`,
          borderRadius: borderRadius.base, color: colors.textPrimary,
          fontFamily: typography.fontFamily, fontSize: typography.fontSize.body,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap',
          transition: `border-color ${transitions.instant}`,
          textAlign: 'left',
        }}
      >
        {multi && selectedOptions.length > 0 ? (
          selectedOptions.map((opt) => (
            <span key={opt.value} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: `2px ${spacing['2']}`, background: colors.orangeSubtle, color: colors.orangeText,
              borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.medium,
            }}>
              {opt.label}
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${opt.label}`}
                onClick={(e) => { e.stopPropagation(); choose(opt.value) }}
                style={{ cursor: 'pointer', display: 'inline-flex' }}
              >
                <X size={12} />
              </span>
            </span>
          ))
        ) : !multi && selectedOptions[0] ? (
          <span style={{ color: colors.textPrimary }}>{selectedOptions[0].label}</span>
        ) : (
          <span style={{ color: colors.textTertiary }}>{placeholder}</span>
        )}
        <ChevronDown size={16} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
      </button>

      {/* Recent chips */}
      {!open && recent.length > 0 && (
        <div style={{ display: 'flex', gap: spacing['1'], flexWrap: 'wrap', marginTop: spacing['1'] }}>
          {recent.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose(opt.value)}
              style={{
                padding: `2px ${spacing['2']}`, fontSize: typography.fontSize.caption,
                background: colors.surfaceInset, color: colors.textSecondary,
                border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.full,
                cursor: 'pointer', fontFamily: typography.fontFamily,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4,
          background: colors.surfaceRaised, border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.base, boxShadow: shadows.lg,
          zIndex: zIndex.popover, maxHeight: 360, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`,
          }}>
            <Search size={16} color={colors.textTertiary} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: typography.fontFamily, fontSize: typography.fontSize.body,
                color: colors.textPrimary,
              }}
            />
          </div>
          <ul
            role="listbox"
            style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', flex: 1 }}
          >
            {filtered.length === 0 && !onCreateNew && (
              <li style={{ padding: spacing['3'], color: colors.textTertiary, textAlign: 'center' }}>
                No results
              </li>
            )}
            {filtered.map((opt, i) => {
              const vals = Array.isArray(selected) ? selected : [selected]
              return (
                <OptionRow
                  key={opt.value}
                  opt={opt}
                  isSelected={vals.includes(opt.value)}
                  isActive={i === activeIdx}
                  onSelect={() => choose(opt.value)}
                />
              )
            })}
            {onCreateNew && query.trim() && !filtered.some((o) => o.label.toLowerCase() === query.toLowerCase()) && (
              <li
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); handleCreate() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`, minHeight: 56,
                  cursor: 'pointer', listStyle: 'none',
                  background: colors.orangeSubtle, color: colors.orangeText,
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                <Plus size={16} />
                {creating ? 'Creating…' : `${createLabel}: "${query.trim()}"`}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SmartPicker
