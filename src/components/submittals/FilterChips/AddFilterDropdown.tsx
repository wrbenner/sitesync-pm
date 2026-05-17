// Phase 3 — Add Filter ▾ dropdown.
//
// Shows all 20 chips grouped by ChipGroup. Clicking a chip opens its operand
// picker (renderer family per ChipDefinition.inputKind). Selecting a value
// pushes it onto the active filter set via useSubmittalFilters.setChip.
//
// Phase 3 ships a "thin operand picker" for every input kind — text input,
// boolean toggle, multi-select with comma-typed entries, range inputs, etc.
// Phase 4+ can replace specific chips with richer pickers (people picker,
// org picker, hierarchical location picker) without changing the registry.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Filter, ChevronDown, Search, X } from 'lucide-react'
import {
  CHIPS,
  type ChipDefinition,
  type ChipGroup,
} from './filterDefinitions'
import { useSubmittalFilters } from '../../../hooks/useSubmittalFilters'
import { CSI_DIVISIONS } from '../../../machines/submittalMachine'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  surfaceHover: '#F0EFEB',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const GROUP_LABEL: Record<ChipGroup, string> = {
  people: 'People',
  taxonomy: 'Taxonomy',
  date: 'Dates',
  flag: 'Flags',
  iris: 'Iris',
}

interface AddFilterDropdownProps {
  className?: string
  /** Disabled when there's no project context. */
  disabled?: boolean
}

export const AddFilterDropdown: React.FC<AddFilterDropdownProps> = ({ disabled }) => {
  const [open, setOpen] = useState(false)
  const [activeChip, setActiveChip] = useState<ChipDefinition | null>(null)
  const [chipQuery, setChipQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const filters = useSubmittalFilters()

  // Close on outside-click.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null
      if (!t || !triggerRef.current) return
      if (triggerRef.current.contains(t)) return
      // Closest dropdown panel — bail if clicking inside it.
      const panel = document.getElementById('add-filter-panel')
      if (panel && panel.contains(t)) return
      setOpen(false)
      setActiveChip(null)
    }
    window.addEventListener('mousedown', onDocClick)
    return () => window.removeEventListener('mousedown', onDocClick)
  }, [open])

  const groupedChips = useMemo(() => {
    const q = chipQuery.trim().toLowerCase()
    const groups: Record<ChipGroup, ChipDefinition[]> = { people: [], taxonomy: [], date: [], flag: [], iris: [] }
    for (const c of CHIPS) {
      if (q && !c.label.toLowerCase().includes(q)) continue
      groups[c.group].push(c)
    }
    return groups
  }, [chipQuery])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Add filter"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v)
          setActiveChip(null)
          setChipQuery('')
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          minHeight: 30,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          backgroundColor: '#fff',
          color: disabled ? C.ink4 : C.ink,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 500,
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <Filter size={12} />
        Add Filter
        <ChevronDown size={11} />
      </button>

      {open && (
        <div
          id="add-filter-panel"
          role="menu"
          aria-label="Add filter chips"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            minWidth: 320,
            maxHeight: 'min(70vh, 520px)',
            background: '#fff',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            boxShadow: '0 10px 24px rgba(0,0,0,0.10)',
            zIndex: 30,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONT,
            fontSize: 13,
          }}
        >
          {!activeChip && (
            <>
              <div style={{ padding: 8, borderBottom: `1px solid ${C.borderSubtle}` }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={12}
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: C.ink3,
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="search"
                    autoFocus
                    value={chipQuery}
                    onChange={(e) => setChipQuery(e.target.value)}
                    placeholder="Search filters…"
                    aria-label="Search filters"
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 26px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: FONT,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ overflow: 'auto', padding: 4 }}>
                {(Object.keys(groupedChips) as ChipGroup[]).map((g) => {
                  const list = groupedChips[g]
                  if (!list.length) return null
                  return (
                    <div key={g} style={{ marginBottom: 4 }}>
                      <div
                        style={{
                          padding: '6px 8px 4px',
                          fontSize: 10,
                          fontWeight: 600,
                          color: C.ink3,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {GROUP_LABEL[g]}
                      </div>
                      {list.map((chip) => {
                        const applied = chip.id in filters.filters
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            role="menuitem"
                            onClick={() => setActiveChip(chip)}
                            style={{
                              display: 'flex',
                              width: '100%',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: 4,
                              border: 'none',
                              background: 'transparent',
                              color: C.ink,
                              cursor: 'pointer',
                              fontSize: 12,
                              fontFamily: FONT,
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surfaceInset }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                          >
                            <span>
                              {chip.label}
                              {!chip.procoreParity && (
                                <span style={{ marginLeft: 6, color: C.brandOrange, fontSize: 10 }} title="SiteSync-only">
                                  ✦
                                </span>
                              )}
                            </span>
                            {applied && (
                              <span style={{ color: C.ink3, fontSize: 10 }}>active</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {activeChip && (
            <ChipOperandPanel
              chip={activeChip}
              onBack={() => setActiveChip(null)}
              onApply={(value) => {
                filters.setChip(activeChip.id, value)
                setActiveChip(null)
                setOpen(false)
              }}
              onClear={() => {
                filters.clearChip(activeChip.id)
                setActiveChip(null)
                setOpen(false)
              }}
              currentValue={filters.filters[activeChip.id]}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Operand panel — thin pickers per inputKind ───────────────────────────────

interface ChipOperandPanelProps {
  chip: ChipDefinition
  currentValue: unknown
  onBack: () => void
  onApply: (value: unknown) => void
  onClear: () => void
}

const ChipOperandPanel: React.FC<ChipOperandPanelProps> = ({
  chip,
  currentValue,
  onBack,
  onApply,
  onClear,
}) => {
  const [draft, setDraft] = useState<unknown>(currentValue)

  const apply = () => {
    if (draft === undefined || draft === null) {
      onClear()
      return
    }
    if (Array.isArray(draft) && draft.length === 0) {
      onClear()
      return
    }
    onApply(draft)
  }

  return (
    <>
      <div
        style={{
          padding: '8px 10px',
          borderBottom: `1px solid ${C.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          aria-label="Back to filter list"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.ink2,
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
          }}
        >
          ← back
        </button>
        <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{chip.label}</div>
      </div>

      <div style={{ padding: 12, overflow: 'auto', maxHeight: 360 }}>
        <OperandInput chip={chip} value={draft} onChange={setDraft} />
      </div>

      <div
        style={{
          padding: 8,
          borderTop: `1px solid ${C.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onClear}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.ink3,
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
          }}
        >
          Clear filter
        </button>
        <button
          type="button"
          onClick={apply}
          style={{
            padding: '5px 12px',
            backgroundColor: C.brandOrange,
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: FONT,
          }}
        >
          Apply
        </button>
      </div>
    </>
  )
}

// ── Operand input renderers per inputKind ───────────────────────────────────

const OperandInput: React.FC<{
  chip: ChipDefinition
  value: unknown
  onChange: (next: unknown) => void
}> = ({ chip, value, onChange }) => {
  switch (chip.inputKind) {
    case 'boolean':
      return (
        <BooleanInput
          value={value as boolean | undefined}
          onChange={(v) => onChange(v)}
        />
      )
    case 'text-contains':
      return (
        <TextInput
          value={(value as string) ?? ''}
          placeholder={`Contains…`}
          onChange={(v) => onChange(v || undefined)}
        />
      )
    case 'days-input':
      return (
        <DaysInput
          value={value as number | undefined}
          onChange={(v) => onChange(v)}
        />
      )
    case 'rev-number-range':
      return (
        <RevRangeInput
          value={(value as { min?: number; max?: number } | undefined) ?? {}}
          onChange={(v) => onChange(v)}
        />
      )
    case 'iris-finding':
      return (
        <PresetSelect
          value={(value as string) ?? ''}
          onChange={(v) => onChange(v || undefined)}
          presets={[
            { value: 'has_p0', label: 'Has P0 finding' },
            { value: 'has_p1', label: 'Has P1 finding' },
            { value: 'none', label: 'No findings' },
          ]}
        />
      )
    case 'status-multi':
      return (
        <MultiSelect
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v.length ? v : undefined)}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'sub_uploading', label: 'Sub Uploading' },
            { value: 'gc_review', label: 'GC Review' },
            { value: 'preflight', label: 'Pre-flight' },
            { value: 'sent_to_reviewer', label: 'Sent to Reviewer' },
            { value: 'in_review', label: 'In Review' },
            { value: 'returned', label: 'Returned' },
            { value: 'distribute', label: 'Distribute' },
            { value: 'closed', label: 'Closed' },
            { value: 'void', label: 'Void' },
            // legacy
            { value: 'submitted', label: 'Submitted (legacy)' },
            { value: 'approved', label: 'Approved (legacy)' },
            { value: 'rejected', label: 'Rejected (legacy)' },
          ]}
        />
      )
    case 'kind-multi':
      return (
        <MultiSelect
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v.length ? v : undefined)}
          options={[
            { value: 'shop_drawing', label: 'Shop Drawing' },
            { value: 'product_data', label: 'Product Data' },
            { value: 'sample', label: 'Sample' },
            { value: 'mockup', label: 'Mockup' },
            { value: 'test_report', label: 'Test Report' },
            { value: 'certification', label: 'Certification' },
            { value: 'qualification', label: 'Qualification' },
            { value: 'closeout', label: 'Closeout' },
            { value: 'warranty', label: 'Warranty' },
            { value: 'leed_credit', label: 'LEED Credit' },
            { value: 'coordination_drawing', label: 'Coordination Drawing' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'other', label: 'Other' },
          ]}
        />
      )
    case 'csi-division-multi':
      return (
        <MultiSelect
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v.length ? v : undefined)}
          options={CSI_DIVISIONS.map((d) => ({ value: d.code, label: `${d.code}: ${d.name}` }))}
        />
      )
    case 'disposition-multi':
      return (
        <MultiSelect
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v.length ? v : undefined)}
          options={[
            { value: 'A_no_exceptions_taken', label: 'A: No Exceptions Taken (EJCDC)' },
            { value: 'B_make_corrections_noted', label: 'B: Make Corrections Noted (EJCDC)' },
            { value: 'C_revise_and_resubmit', label: 'C: Revise & Resubmit (EJCDC)' },
            { value: 'D_rejected', label: 'D: Rejected (EJCDC)' },
            { value: 'E_for_reference_only', label: 'E: For Reference Only (EJCDC)' },
            { value: 'F_submit_specified_item', label: 'F: Submit Specified Item (EJCDC)' },
            { value: 'approved', label: 'Approved (AIA)' },
            { value: 'approved_as_noted', label: 'Approved as Noted (AIA)' },
            { value: 'revise_and_resubmit', label: 'Revise & Resubmit (AIA)' },
            { value: 'rejected', label: 'Rejected (AIA)' },
            { value: 'for_record_only', label: 'For Record Only (AIA)' },
          ]}
        />
      )
    case 'csi-section-multi':
    case 'people-multi':
    case 'org-multi':
    case 'package-multi':
    case 'location-hierarchy':
      return (
        <CommaListInput
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v.length ? v : undefined)}
          placeholder={
            chip.inputKind === 'csi-section-multi'
              ? '08 41 13, 03 30 00, 08* (prefix match)'
              : 'Enter ids comma-separated'
          }
        />
      )
    default:
      return <div style={{ color: C.ink3, fontSize: 11 }}>Operand picker not yet built.</div>
  }
}

// ── Reusable thin pickers ───────────────────────────────────────────────────

const BooleanInput: React.FC<{ value?: boolean; onChange: (v: boolean | undefined) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 8 }}>
    {[
      { v: true,  label: 'Yes' },
      { v: false, label: 'No' },
    ].map(({ v, label }) => {
      const active = value === v
      return (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(active ? undefined : v)}
          style={{
            padding: '6px 12px',
            border: `1px solid ${active ? C.brandOrange : C.border}`,
            borderRadius: 4,
            background: active ? 'rgba(244, 120, 32, 0.08)' : '#fff',
            color: active ? C.brandOrange : C.ink2,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: FONT,
          }}
        >
          {label}
        </button>
      )
    })}
  </div>
)

const TextInput: React.FC<{ value: string; placeholder?: string; onChange: (v: string) => void }> = ({ value, placeholder, onChange }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: '100%',
      padding: '6px 10px',
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      fontSize: 12,
      fontFamily: FONT,
      outline: 'none',
    }}
  />
)

const DaysInput: React.FC<{ value?: number; onChange: (v: number | undefined) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {[1, 7, 14, 30].map((n) => {
        const active = value === n
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(active ? undefined : n)}
            style={{
              padding: '4px 10px',
              border: `1px solid ${active ? C.brandOrange : C.border}`,
              borderRadius: 999,
              background: active ? 'rgba(244, 120, 32, 0.08)' : '#fff',
              color: active ? C.brandOrange : C.ink2,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            {n}d
          </button>
        )
      })}
    </div>
    <input
      type="number"
      min={1}
      max={365}
      value={value ?? ''}
      onChange={(e) => {
        const n = Number(e.target.value)
        onChange(Number.isFinite(n) && n > 0 ? n : undefined)
      }}
      placeholder="Custom (days)"
      style={{
        width: '100%',
        padding: '6px 10px',
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        fontSize: 12,
        fontFamily: FONT,
        outline: 'none',
      }}
    />
  </div>
)

const RevRangeInput: React.FC<{ value: { min?: number; max?: number }; onChange: (v: { min?: number; max?: number }) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <input
      type="number"
      min={0}
      value={value.min ?? ''}
      placeholder="Min"
      onChange={(e) => {
        const n = Number(e.target.value)
        onChange({ ...value, min: Number.isFinite(n) ? n : undefined })
      }}
      style={{ width: 72, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
    />
    <span style={{ color: C.ink3 }}>–</span>
    <input
      type="number"
      min={0}
      value={value.max ?? ''}
      placeholder="Max"
      onChange={(e) => {
        const n = Number(e.target.value)
        onChange({ ...value, max: Number.isFinite(n) ? n : undefined })
      }}
      style={{ width: 72, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}
    />
  </div>
)

const PresetSelect: React.FC<{
  value: string
  onChange: (v: string | undefined) => void
  presets: Array<{ value: string; label: string }>
}> = ({ value, onChange, presets }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {presets.map((p) => {
      const active = value === p.value
      return (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(active ? undefined : p.value)}
          style={{
            display: 'flex',
            width: '100%',
            padding: '6px 8px',
            border: `1px solid ${active ? C.brandOrange : C.border}`,
            borderRadius: 4,
            background: active ? 'rgba(244, 120, 32, 0.08)' : '#fff',
            color: active ? C.brandOrange : C.ink,
            cursor: 'pointer',
            fontSize: 12,
            textAlign: 'left',
          }}
        >
          {p.label}
        </button>
      )
    })}
  </div>
)

const MultiSelect: React.FC<{
  value: string[]
  onChange: (v: string[]) => void
  options: Array<{ value: string; label: string }>
}> = ({ value, onChange, options }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflow: 'auto' }}>
    {options.map((o) => {
      const active = value.includes(o.value)
      return (
        <label
          key={o.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 6px',
            cursor: 'pointer',
            fontSize: 12,
            color: active ? C.brandOrange : C.ink,
            fontWeight: active ? 600 : 500,
            borderRadius: 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surfaceInset }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <input
            type="checkbox"
            checked={active}
            onChange={() => {
              const next = active ? value.filter((v) => v !== o.value) : [...value, o.value]
              onChange(next)
            }}
            style={{ cursor: 'pointer' }}
          />
          {o.label}
        </label>
      )
    })}
  </div>
)

const CommaListInput: React.FC<{
  value: string[]
  placeholder?: string
  onChange: (v: string[]) => void
}> = ({ value, placeholder, onChange }) => (
  <textarea
    value={value.join(', ')}
    placeholder={placeholder}
    onChange={(e) => {
      const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
      onChange(parts)
    }}
    rows={3}
    style={{
      width: '100%',
      padding: '6px 10px',
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      fontSize: 12,
      fontFamily: FONT,
      outline: 'none',
      resize: 'vertical',
    }}
  />
)

// ── FilterPill — applied chip rendered next to the Add Filter button ────────

export interface FilterPillProps {
  chipId: string
  className?: string
}

export const FilterPill: React.FC<FilterPillProps> = ({ chipId }) => {
  const filters = useSubmittalFilters()
  const chip = CHIPS.find((c) => c.id === chipId)
  if (!chip) return null
  const value = filters.filters[chipId]
  if (value === undefined || value === null) return null
  const summary = (chip as ChipDefinition<unknown>).pillSummary(value)
  return (
    <span
      role="status"
      aria-label={summary}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 4px 3px 10px',
        border: `1px solid ${C.border}`,
        borderRadius: 999,
        backgroundColor: 'rgba(244, 120, 32, 0.06)',
        color: C.ink,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      {summary}
      <button
        type="button"
        aria-label={`Clear ${chip.label} filter`}
        onClick={() => filters.clearChip(chipId)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          border: 'none',
          background: 'transparent',
          color: C.ink2,
          cursor: 'pointer',
          borderRadius: 999,
        }}
      >
        <X size={11} />
      </button>
    </span>
  )
}

// ── Active-filter pill rail (rendered in the toolbar) ───────────────────────

export const FilterPillRail: React.FC = () => {
  const filters = useSubmittalFilters()
  if (!filters.hasAny) return null
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {filters.activeChips.map((chip) => (
        <FilterPill key={chip.id} chipId={chip.id} />
      ))}
      <button
        type="button"
        onClick={filters.clearAll}
        style={{
          background: 'transparent',
          border: 'none',
          color: C.ink2,
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: FONT,
          textDecoration: 'underline',
          padding: 0,
          marginLeft: 4,
        }}
      >
        Clear all
      </button>
    </div>
  )
}

export default AddFilterDropdown
