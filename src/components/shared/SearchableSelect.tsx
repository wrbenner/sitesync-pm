import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X, Check, Loader2 } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme'

export interface SearchableOption<T = string> {
  value: T
  label: string
  description?: string
  disabled?: boolean
}

type BaseProps<T> = {
  options?: SearchableOption<T>[]
  loadOptions?: (query: string) => Promise<SearchableOption<T>[]>
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  clearable?: boolean
  label?: string
  id?: string
  loading?: boolean
}

type SingleProps<T> = BaseProps<T> & {
  multi?: false
  value: T | null
  onChange: (value: T | null) => void
}

type MultiProps<T> = BaseProps<T> & {
  multi: true
  value: T[]
  onChange: (value: T[]) => void
}

export type SearchableSelectProps<T> = SingleProps<T> | MultiProps<T>

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside])
}

export function SearchableSelect<T extends string | number>(props: SearchableSelectProps<T>) {
  const {
    options: staticOptions,
    loadOptions,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyMessage = 'No results',
    disabled = false,
    clearable = true,
    label,
    id,
    loading: externalLoading,
  } = props

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [asyncOptions, setAsyncOptions] = useState<SearchableOption<T>[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState<number>(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useOutsideClick(rootRef, () => setOpen(false))

  // Async loading
  useEffect(() => {
    if (!loadOptions || !open) return
    let cancelled = false
    setLoading(true)
    const t = window.setTimeout(() => {
      loadOptions(query)
        .then((opts) => {
          if (!cancelled) setAsyncOptions(opts)
        })
        .catch(() => {
          if (!cancelled) setAsyncOptions([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, loadOptions, open])

  const filtered = useMemo(() => {
    const base = asyncOptions ?? staticOptions ?? []
    if (loadOptions) return base
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false) ||
        String(o.value).toLowerCase().includes(q),
    )
  }, [asyncOptions, staticOptions, loadOptions, query])

  const selectedValues: T[] = props.multi
    ? (props.value as T[])
    : props.value !== null && props.value !== undefined
      ? [props.value as T]
      : []

  const displayLabel = (() => {
    if (props.multi) {
      if (selectedValues.length === 0) return placeholder
      if (selectedValues.length <= 2) {
        return selectedValues
          .map((v) => (staticOptions ?? asyncOptions ?? []).find((o) => o.value === v)?.label ?? String(v))
          .join(', ')
      }
      return `${selectedValues.length} selected`
    }
    if (props.value === null || props.value === undefined) return placeholder
    const match = (staticOptions ?? asyncOptions ?? []).find((o) => o.value === props.value)
    return match?.label ?? String(props.value)
  })()

  const isSelected = useCallback((v: T) => selectedValues.includes(v), [selectedValues])

  const choose = (opt: SearchableOption<T>) => {
    if (opt.disabled) return
    if (props.multi) {
      const next = isSelected(opt.value)
        ? (props.value as T[]).filter((v) => v !== opt.value)
        : [...(props.value as T[]), opt.value]
      props.onChange(next)
    } else {
      props.onChange(opt.value)
      setOpen(false)
      setQuery('')
    }
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (props.multi) props.onChange([] as T[])
    else props.onChange(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && filtered[activeIdx]) {
        e.preventDefault()
        choose(filtered[activeIdx])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    if (open) {
      setActiveIdx(-1)
      window.setTimeout(() => searchRef.current?.focus(), 20)
    }
  }, [open])

  const showLoading = externalLoading || loading
  const hasSelection = selectedValues.length > 0

  return (
    <div
      ref={rootRef}
      style={{ position: 'relative', width: '100%', fontFamily: typography.fontFamily }}
    >
      {label && (
        <label
          htmlFor={id}
          style={{
            display: 'block',
            marginBottom: 4,
            fontSize: typography.fontSize.label,
            fontWeight: typography.fontWeight.medium,
            color: colors.textSecondary,
          }}
        >
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: '8px 12px',
          minHeight: 40,
          border: `1px solid ${open ? colors.borderFocus : colors.borderDefault}`,
          borderRadius: borderRadius.md,
          background: disabled ? colors.surfaceDisabled : colors.surfaceRaised,
          color: colors.textPrimary,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: typography.fontSize.body,
          textAlign: 'left',
          transition: transitions.quick,
        }}
      >
        <span
          style={{
            flex: 1,
            color: hasSelection ? colors.textPrimary : colors.textTertiary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayLabel}
        </span>
        {clearable && hasSelection && !disabled && (
          <span
            role="button"
            aria-label="Clear selection"
            tabIndex={0}
            onClick={clearAll}
            onKeyDown={(e) => {
              if (e.key === 'Enter') clearAll(e as unknown as React.MouseEvent)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: colors.textTertiary,
            }}
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown
          size={16}
          color={colors.textTertiary}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: transitions.quick,
          }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.md,
            boxShadow: shadows.dropdown,
            zIndex: zIndex.dropdown,
            maxHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderBottom: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <Search size={14} color={colors.textTertiary} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: typography.fontSize.body,
                fontFamily: typography.fontFamily,
                color: colors.textPrimary,
              }}
            />
            {showLoading && (
              <Loader2 size={14} color={colors.textTertiary} style={{ animation: 'ss-spin 1s linear infinite' }} />
            )}
          </div>
          <style>{`@keyframes ss-spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>
          <div style={{ overflowY: 'auto', maxHeight: 240 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: spacing.md,
                  color: colors.textTertiary,
                  fontSize: typography.fontSize.sm,
                  textAlign: 'center',
                }}
              >
                {showLoading ? 'Loading…' : emptyMessage}
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const selected = isSelected(opt.value)
                const active = idx === activeIdx
                return (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={opt.disabled}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => choose(opt)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      background: active ? colors.surfaceHover : 'transparent',
                      color: opt.disabled ? colors.textTertiary : colors.textPrimary,
                      fontSize: typography.fontSize.body,
                      minHeight: 36,
                    }}
                  >
                    {props.multi && (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: `1px solid ${selected ? colors.primaryOrange : colors.borderDefault}`,
                          borderRadius: 3,
                          background: selected ? colors.primaryOrange : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {selected && <Check size={12} color={colors.white} />}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: selected ? typography.fontWeight.medium : typography.fontWeight.normal }}>
                        {opt.label}
                      </div>
                      {opt.description && (
                        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {opt.description}
                        </div>
                      )}
                    </div>
                    {!props.multi && selected && <Check size={14} color={colors.primaryOrange} />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
