// ─────────────────────────────────────────────────────────────────────────────
// IrisLane — single horizontal strip at the top of the cockpit.
// ─────────────────────────────────────────────────────────────────────────────
// Two-tier layout:
//   1. PRIMARY recommendation chip — the single item Iris thinks the user
//      should start with. Bigger, with explicit reasoning. Has its own
//      "Start here" button.
//   2. SECONDARY chips — the rest of Iris-detected items, smaller, scrolling.
//
// NOT per-row sparkles. NOT a chat. A glanceable lane with one click to act.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { colors, typography, spacing, borderRadius } from '../../styles/theme'
import type { StreamItem, Urgency } from '../../types/stream'

interface IrisLaneProps {
  items: StreamItem[]
  onChip: (item: StreamItem) => void
}

const IRIS_INDIGO = '#4F46E5'
const IRIS_INDIGO_BG = 'rgba(79, 70, 229, 0.06)'
const IRIS_INDIGO_BORDER = 'rgba(79, 70, 229, 0.20)'
const IRIS_INDIGO_STRONG = 'rgba(79, 70, 229, 0.40)'

const URGENCY_RANK: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function shortLabel(item: StreamItem): string {
  const summary = item.irisEnhancement?.summary
  if (summary && summary.length <= 80) return summary
  return item.title.length > 64 ? `${item.title.slice(0, 61)}…` : item.title
}

function reasoningFor(item: StreamItem): string {
  // Compose a one-line "why" from the data we have. Specific is better than
  // generic — investors should hear "3 days overdue, $42K at risk" not "AI
  // detected something."
  const parts: string[] = []
  if (item.overdue) {
    parts.push(item.reason || 'Overdue')
  } else if (item.dueDate) {
    parts.push(item.reason)
  }
  if (item.assignedTo || item.party) {
    parts.push(`ball-in-court: ${item.assignedTo ?? item.party}`)
  }
  if (item.costImpact && item.costImpact > 0) {
    const fmt =
      Math.abs(item.costImpact) >= 1_000_000
        ? `$${(item.costImpact / 1_000_000).toFixed(1)}M`
        : Math.abs(item.costImpact) >= 1_000
          ? `$${Math.round(item.costImpact / 1_000)}K`
          : `$${Math.round(item.costImpact)}`
    parts.push(`${fmt} at risk`)
  }
  if (item.scheduleImpactDays && item.scheduleImpactDays > 0) {
    parts.push(`+${item.scheduleImpactDays}d schedule impact`)
  }
  return parts.join(' · ')
}

export const IrisLane: React.FC<IrisLaneProps> = ({ items, onChip }) => {
  const { primary, secondary } = useMemo(() => {
    const irisItems = items
      .filter((i) => i.irisEnhancement?.draftAvailable)
      .sort((a, b) => {
        const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]
        if (u !== 0) return u
        return (b.costImpact ?? 0) - (a.costImpact ?? 0)
      })
    const [head, ...rest] = irisItems
    return { primary: head, secondary: rest.slice(0, 6) }
  }, [items])

  if (!primary) return null

  return (
    <div
      role="region"
      aria-label="Iris recommendations"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: IRIS_INDIGO_BG,
        borderBottom: `1px solid ${colors.borderDefault}`,
        minHeight: 64,
      }}
    >
      {/* Eyebrow rail */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
          padding: `0 ${spacing[5]}`,
          background: IRIS_INDIGO_BG,
          color: IRIS_INDIGO,
          fontFamily: typography.fontFamily,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderRight: `1px solid ${IRIS_INDIGO_BORDER}`,
          flexShrink: 0,
        }}
      >
        <Sparkles size={14} strokeWidth={2} aria-hidden />
        <span>Iris</span>
      </div>

      {/* Primary recommendation */}
      <button
        type="button"
        onClick={() => onChip(primary)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          padding: `${spacing[2]} ${spacing[4]}`,
          background: colors.surfaceRaised,
          border: 'none',
          borderRight: `1px solid ${IRIS_INDIGO_BORDER}`,
          textAlign: 'left',
          cursor: 'pointer',
          flexShrink: 0,
          maxWidth: '50%',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: IRIS_INDIGO,
            background: 'rgba(79, 70, 229, 0.10)',
            padding: '3px 7px',
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          Start here
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}
          >
            {primary.title}
          </span>
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '12px',
              color: colors.ink2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            {reasoningFor(primary) || shortLabel(primary)}
          </span>
        </span>
        <ArrowRight size={14} strokeWidth={2.25} color={IRIS_INDIGO_STRONG} aria-hidden />
      </button>

      {/* Secondary chips */}
      <div
        style={{
          display: 'flex',
          gap: spacing[2],
          alignItems: 'center',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: `0 ${spacing[4]}`,
          flex: 1,
          minWidth: 0,
        }}
      >
        {secondary.length > 0 && (
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: colors.ink3,
              flexShrink: 0,
            }}
          >
            Also detected
          </span>
        )}
        {secondary.map((item) => (
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
