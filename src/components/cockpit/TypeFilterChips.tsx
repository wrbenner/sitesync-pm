// ─────────────────────────────────────────────────────────────────────────────
// TypeFilterChips — a single horizontal row of toggle chips above the
// NeedsYouTable. PM/Super sliced their inbox by item type (RFI / Sub / Punch /
// CO / Task / Log / Safety / Schedule). Click a chip to focus, click again
// to release. "All" returns to the unfiltered view.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { colors, typography, spacing } from '../../styles/theme'
import type { StreamItem, StreamItemType } from '../../types/stream'

interface TypeFilterChipsProps {
  items: StreamItem[]
  selected: StreamItemType | 'all'
  onSelect: (type: StreamItemType | 'all') => void
}

const TYPE_ORDER: StreamItemType[] = [
  'rfi',
  'submittal',
  'punch',
  'change_order',
  'task',
  'daily_log',
  'incident',
  'schedule',
  'commitment',
]

const TYPE_LABEL: Record<StreamItemType, string> = {
  rfi: 'RFIs',
  submittal: 'Submittals',
  punch: 'Punch',
  change_order: 'COs',
  task: 'Tasks',
  daily_log: 'Logs',
  incident: 'Safety',
  schedule: 'Schedule',
  commitment: 'Owed',
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: active ? colors.ink : colors.surfaceRaised,
        color: active ? colors.parchment ?? '#FAF7F0' : colors.ink2,
        border: `1px solid ${active ? colors.ink : colors.borderDefault}`,
        borderRadius: 999,
        fontFamily: typography.fontFamily,
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: 0,
        cursor: 'pointer',
        flexShrink: 0,
        lineHeight: 1.2,
      }}
    >
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: '11px',
            color: active ? 'rgba(250, 247, 240, 0.65)' : colors.ink3,
            fontWeight: 500,
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export const TypeFilterChips: React.FC<TypeFilterChipsProps> = ({
  items,
  selected,
  onSelect,
}) => {
  const counts: Record<StreamItemType, number> = {
    rfi: 0,
    submittal: 0,
    punch: 0,
    change_order: 0,
    task: 0,
    daily_log: 0,
    incident: 0,
    schedule: 0,
    commitment: 0,
  }
  for (const i of items) counts[i.type] = (counts[i.type] ?? 0) + 1

  const visibleTypes = TYPE_ORDER.filter((t) => counts[t] > 0)
  if (visibleTypes.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: spacing[2],
        alignItems: 'center',
        padding: `${spacing[2]} ${spacing[4]}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      <Chip
        label="All"
        count={items.length}
        active={selected === 'all'}
        onClick={() => onSelect('all')}
      />
      {visibleTypes.map((t) => (
        <Chip
          key={t}
          label={TYPE_LABEL[t]}
          count={counts[t]}
          active={selected === t}
          onClick={() => onSelect(selected === t ? 'all' : t)}
        />
      ))}
    </div>
  )
}

export default TypeFilterChips
