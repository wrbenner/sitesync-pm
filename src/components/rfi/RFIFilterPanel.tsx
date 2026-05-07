// ── RFIFilterPanel ──────────────────────────────────────────────────────
// All-Filters side panel for the RFI list. Mirrors Procore's "All Filters"
// affordance with every facet from the RFI_EDIT_MANIPULATE_AUDIT.
//
// Boundary contract:
//   • Props in: current filters (controlled).
//   • Props out: onChange (debounced upstream via URL state).
//   • The panel doesn't write URL params itself — it bubbles a new
//     filters object up to the list page, which canonically owns the
//     URL state through filtersToSearchParams().
//
// PermissionGate: Save as View is gated to rfis.edit. The other
// affordances are read-only filters that any role can apply.

import React, { useState } from 'react'
import { X, Filter, Save as SaveIcon, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { DetailPanel } from '../Primitives'
import { PermissionGate } from '../auth/PermissionGate'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import type { RFIListFilters } from '../../lib/rfi/listFilters'
import { useCreateRFISavedView } from '../../hooks/queries/useRFISavedViews'
import type { RFIViewScope } from '../../hooks/queries/useRFISavedViews'

interface RFIFilterPanelProps {
  open: boolean
  onClose: () => void
  projectId: string
  filters: RFIListFilters
  onApply: (next: RFIListFilters) => void
  onClear: () => void
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'answered', label: 'Answered' },
  { value: 'closed', label: 'Closed' },
  { value: 'void', label: 'Void' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export const RFIFilterPanel: React.FC<RFIFilterPanelProps> = ({
  open,
  onClose,
  projectId,
  filters,
  onApply,
  onClear,
}) => {
  const [draft, setDraft] = useState<RFIListFilters>(filters)
  const [savingViewName, setSavingViewName] = useState<string>('')
  const [scope, setScope] = useState<RFIViewScope>('personal')
  const createView = useCreateRFISavedView()

  // Re-sync draft when the panel opens or props change.
  React.useEffect(() => {
    if (open) setDraft(filters)
  }, [open, filters])

  const setMulti = (key: keyof RFIListFilters, val: string, on: boolean) => {
    setDraft((d) => {
      const list = (d[key] as string[] | undefined) ?? []
      const next = on ? [...new Set([...list, val])] : list.filter((x) => x !== val)
      return { ...d, [key]: next.length === 0 ? undefined : next }
    })
  }

  const setField = <K extends keyof RFIListFilters>(key: K, value: RFIListFilters[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const handleApply = () => {
    onApply(draft)
    onClose()
  }

  const handleSaveAsView = async () => {
    const name = savingViewName.trim()
    if (!name) {
      toast.error('Name the view first')
      return
    }
    try {
      await createView.mutateAsync({
        projectId,
        scope,
        name,
        filters: draft,
      })
      toast.success(`Saved view "${name}"`)
      setSavingViewName('')
      onApply(draft)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save view')
    }
  }

  const handleClear = () => {
    setDraft({})
    onClear()
  }

  return (
    <DetailPanel open={open} onClose={onClose} title="All Filters" width="420px">
      <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        <Section label="Status">
          <ChipMulti
            options={STATUS_OPTIONS}
            value={draft.status ?? []}
            onToggle={(v, on) => setMulti('status', v, on)}
          />
        </Section>

        <Section label="Priority">
          <ChipMulti
            options={PRIORITY_OPTIONS}
            value={draft.priority ?? []}
            onToggle={(v, on) => setMulti('priority', v, on)}
          />
        </Section>

        <Section label="Schedule Impact">
          <TripleToggle
            value={draft.scheduleImpact}
            onChange={(v) => setField('scheduleImpact', v)}
          />
        </Section>

        <Section label="Cost Impact">
          <TripleToggle
            value={draft.costImpact}
            onChange={(v) => setField('costImpact', v)}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <NumInput
              label="Min $"
              value={draft.costMin}
              onChange={(n) => setField('costMin', n)}
            />
            <NumInput
              label="Max $"
              value={draft.costMax}
              onChange={(n) => setField('costMax', n)}
            />
          </div>
        </Section>

        <Section label="Due">
          <div style={{ display: 'flex', gap: 6 }}>
            <DateInput
              label="From"
              value={draft.dueFrom ?? ''}
              onChange={(v) => setField('dueFrom', v || undefined)}
            />
            <DateInput
              label="To"
              value={draft.dueTo ?? ''}
              onChange={(v) => setField('dueTo', v || undefined)}
            />
          </div>
        </Section>

        <Section label="Days Open">
          <div style={{ display: 'flex', gap: 6 }}>
            <NumInput
              label="Min"
              value={draft.daysOpenMin}
              onChange={(n) => setField('daysOpenMin', n)}
            />
            <NumInput
              label="Max"
              value={draft.daysOpenMax}
              onChange={(n) => setField('daysOpenMax', n)}
            />
          </div>
        </Section>

        <Section label="Created">
          <div style={{ display: 'flex', gap: 6 }}>
            <DateInput
              label="From"
              value={draft.createdFrom ?? ''}
              onChange={(v) => setField('createdFrom', v || undefined)}
            />
            <DateInput
              label="To"
              value={draft.createdTo ?? ''}
              onChange={(v) => setField('createdTo', v || undefined)}
            />
          </div>
        </Section>

        <Section label="Spec / Drawing / Cost Code">
          <TextInput
            placeholder="Spec section (e.g. 09 21 16)"
            value={draft.specSection ?? ''}
            onChange={(v) => setField('specSection', v || undefined)}
          />
          <TextInput
            placeholder="Drawing reference (e.g. A-101)"
            value={draft.drawingReference ?? ''}
            onChange={(v) => setField('drawingReference', v || undefined)}
          />
          <TextInput
            placeholder="Cost code"
            value={draft.costCode ?? ''}
            onChange={(v) => setField('costCode', v || undefined)}
          />
        </Section>

        <Section label="Flags">
          <CheckboxRow
            label="Has unread response"
            checked={!!draft.hasUnreadResponse}
            onChange={(b) => setField('hasUnreadResponse', b || undefined)}
          />
          <CheckboxRow
            label="Has chain gap (audit suspect)"
            checked={!!draft.hasChainGap}
            onChange={(b) => setField('hasChainGap', b || undefined)}
          />
          <CheckboxRow
            label="Private only"
            checked={!!draft.isPrivate}
            onChange={(b) => setField('isPrivate', b || undefined)}
          />
          <CheckboxRow
            label="Overdue (open + past due)"
            checked={!!draft.overdue}
            onChange={(b) => setField('overdue', b || undefined)}
          />
        </Section>

        {/* Save as View */}
        <div
          style={{
            paddingTop: spacing.md,
            borderTop: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <label style={labelStyle}>Save as View</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as RFIViewScope)}
              aria-label="View scope"
              style={{ ...inputStyle, flex: '0 0 110px' }}
            >
              <option value="personal">Personal</option>
              <option value="project">Project</option>
              <option value="company">Company</option>
            </select>
            <input
              type="text"
              value={savingViewName}
              onChange={(e) => setSavingViewName(e.target.value)}
              placeholder="View name"
              style={{ ...inputStyle, flex: 1 }}
            />
            <PermissionGate permission="rfis.edit">
              <button
                type="button"
                onClick={handleSaveAsView}
                disabled={createView.isPending || !savingViewName.trim()}
                style={{
                  ...buttonBaseStyle,
                  background: colors.primaryOrange,
                  color: 'white',
                  opacity: !savingViewName.trim() ? 0.5 : 1,
                }}
              >
                <SaveIcon size={13} />
                Save
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            paddingTop: spacing.md,
            borderTop: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <button type="button" onClick={handleClear} style={cancelBtnStyle}>
            <RotateCcw size={13} /> Clear All
          </button>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>
            <X size={13} /> Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{ ...buttonBaseStyle, background: colors.primaryOrange, color: 'white' }}
          >
            <Filter size={13} /> Apply
          </button>
        </div>
      </div>
    </DetailPanel>
  )
}

// ── Field primitives ─────────────────────────────────────────────────────

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
)

const ChipMulti: React.FC<{
  options: Array<{ value: string; label: string }>
  value: string[]
  onToggle: (v: string, on: boolean) => void
}> = ({ options, value, onToggle }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
    {options.map((o) => {
      const on = value.includes(o.value)
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onToggle(o.value, !on)}
          aria-pressed={on}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            border: `1px solid ${on ? colors.primaryOrange : colors.borderSubtle}`,
            backgroundColor: on ? colors.orangeSubtle : 'transparent',
            color: on ? colors.primaryOrange : colors.textSecondary,
            borderRadius: borderRadius.sm,
            fontSize: typography.fontSize.caption,
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      )
    })}
  </div>
)

const TripleToggle: React.FC<{
  value: 'yes' | 'no' | 'tbd' | undefined
  onChange: (v: 'yes' | 'no' | 'tbd' | undefined) => void
}> = ({ value, onChange }) => {
  const opts: Array<'yes' | 'no' | 'tbd'> = ['yes', 'no', 'tbd']
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {opts.map((o) => {
        const on = value === o
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? undefined : o)}
            style={{
              padding: '4px 12px',
              border: `1px solid ${on ? colors.primaryOrange : colors.borderSubtle}`,
              backgroundColor: on ? colors.orangeSubtle : 'transparent',
              color: on ? colors.primaryOrange : colors.textSecondary,
              borderRadius: borderRadius.sm,
              fontSize: typography.fontSize.caption,
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

const NumInput: React.FC<{
  label: string
  value: number | undefined
  onChange: (n: number | undefined) => void
}> = ({ label, value, onChange }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
    <span style={{ fontSize: 10, color: colors.textTertiary }}>{label}</span>
    <input
      type="number"
      value={value == null ? '' : value}
      onChange={(e) => {
        const v = e.target.value.trim() === '' ? undefined : Number(e.target.value)
        onChange(Number.isFinite(v as number) ? (v as number) : undefined)
      }}
      style={inputStyle}
    />
  </label>
)

const DateInput: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
}> = ({ label, value, onChange }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
    <span style={{ fontSize: 10, color: colors.textTertiary }}>{label}</span>
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
  </label>
)

const TextInput: React.FC<{
  placeholder: string
  value: string
  onChange: (v: string) => void
}> = ({ placeholder, value, onChange }) => (
  <input
    type="text"
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={inputStyle}
  />
)

const CheckboxRow: React.FC<{
  label: string
  checked: boolean
  onChange: (b: boolean) => void
}> = ({ label, checked, onChange }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 14, height: 14 }} />
    {label}
  </label>
)

const labelStyle: React.CSSProperties = {
  fontSize: typography.fontSize.caption,
  fontWeight: 600,
  color: colors.textSecondary,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: typography.fontSize.sm,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  outline: 'none',
  fontFamily: 'inherit',
}

const buttonBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  fontSize: typography.fontSize.caption,
  fontWeight: 600,
  border: 'none',
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  background: 'transparent',
  color: colors.textSecondary,
  border: `1px solid ${colors.borderSubtle}`,
}

export default RFIFilterPanel
