// ─────────────────────────────────────────────────────────────────────────────
// IrisLane — single horizontal strip at the top of the cockpit listing items
// Iris detected as worth the user's attention. NOT per-row sparkles. NOT a
// chat. A glanceable lane with one click to act.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { colors, typography, spacing, borderRadius } from '../../styles/theme'
import type { StreamItem } from '../../types/stream'

interface IrisLaneProps {
  items: StreamItem[]
  onChip: (item: StreamItem) => void
}

const IRIS_INDIGO = '#4F46E5'
const IRIS_INDIGO_BG = 'rgba(79, 70, 229, 0.06)'
const IRIS_INDIGO_BORDER = 'rgba(79, 70, 229, 0.20)'

function shortLabel(item: StreamItem): string {
  // Prefer the Iris summary; fall back to the item title trimmed.
  const summary = item.irisEnhancement?.summary
  if (summary && summary.length <= 80) return summary
  return item.title.length > 64 ? `${item.title.slice(0, 61)}…` : item.title
}

export const IrisLane: React.FC<IrisLaneProps> = ({ items, onChip }) => {
  const irisItems = items.filter((i) => i.irisEnhancement?.draftAvailable).slice(0, 8)
  if (irisItems.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Iris detected items"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[3],
        padding: `${spacing[2]} ${spacing[5]}`,
        borderBottom: `1px solid ${colors.borderDefault}`,
        background: IRIS_INDIGO_BG,
        minHeight: 44,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
          color: IRIS_INDIGO,
          fontFamily: typography.fontFamily,
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        <Sparkles size={14} strokeWidth={2} aria-hidden />
        <span>Iris detected</span>
        <span style={{ color: colors.ink3, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>
          {irisItems.length}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: spacing[2],
          alignItems: 'center',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flex: 1,
          minWidth: 0,
        }}
      >
        {irisItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChip(item)}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing[2],
              padding: `${spacing[1]} ${spacing[3]}`,
              background: colors.surfaceRaised,
              border: `1px solid ${IRIS_INDIGO_BORDER}`,
              borderRadius: borderRadius.full ?? 999,
              fontFamily: typography.fontFamily,
              fontSize: '12px',
              fontWeight: 500,
              color: colors.ink,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              lineHeight: 1.2,
            }}
          >
            <span style={{ color: IRIS_INDIGO, fontWeight: 600 }}>{labelForType(item.type)}</span>
            <span style={{ color: colors.ink2 }}>{shortLabel(item)}</span>
            <ArrowRight size={11} strokeWidth={2.25} color={colors.ink3} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  )
}

function labelForType(t: StreamItem['type']): string {
  switch (t) {
    case 'rfi': return 'RFI'
    case 'submittal': return 'SUB'
    case 'punch': return 'PUNCH'
    case 'change_order': return 'CO'
    case 'task': return 'TASK'
    case 'daily_log': return 'LOG'
    case 'incident': return 'SAFETY'
    case 'schedule': return 'SCHED'
    case 'commitment': return 'OWED'
    default: return ''
  }
}

export default IrisLane
