// Phase 4 — shared GroupHeader for the Packages / Spec Sections / BIC views.
// Renders: chevron expand/collapse, label, mini stats (overdue badge if any,
// "{n} total", "{approved}/{total}" mini progress bar).

import React from 'react'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  active: '#2D8A6E',
  critical: '#C93B3B',
  pending: '#C4850C',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface GroupHeaderProps {
  expanded: boolean
  onToggle: () => void
  label: React.ReactNode
  subtitle?: React.ReactNode
  total: number
  approved: number
  overdue: number
  /** Click handler for the label (e.g. open the reviewer side panel). */
  onLabelClick?: () => void
  /** Optional inline action cluster on the right (e.g. package Edit / View). */
  actions?: React.ReactNode
}

export const GroupHeader: React.FC<GroupHeaderProps> = ({
  expanded,
  onToggle,
  label,
  subtitle,
  total,
  approved,
  overdue,
  onLabelClick,
  actions,
}) => {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0

  return (
    <div
      role="row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        backgroundColor: C.surfaceInset,
        borderBottom: `1px solid ${C.border}`,
        borderTop: `1px solid ${C.border}`,
        fontFamily: FONT,
        fontSize: 12,
        color: C.ink,
      }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse group' : 'Expand group'}
        onClick={onToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 18px',
          width: 18,
          height: 18,
          border: 'none',
          backgroundColor: 'transparent',
          color: C.ink2,
          cursor: 'pointer',
          padding: 0,
          borderRadius: 3,
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <button
          type="button"
          onClick={onLabelClick}
          disabled={!onLabelClick}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            padding: 0,
            margin: 0,
            color: C.ink,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: onLabelClick ? 'pointer' : 'default',
            textAlign: 'left',
            textDecoration: onLabelClick ? 'none' : 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.005em',
          }}
          onMouseEnter={(e) => { if (onLabelClick) e.currentTarget.style.color = C.brandOrange }}
          onMouseLeave={(e) => { if (onLabelClick) e.currentTarget.style.color = C.ink }}
        >
          {label}
        </button>
        {subtitle && (
          <div
            style={{
              fontSize: 11,
              color: C.ink3,
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
        {overdue > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: 600,
              color: C.critical,
              padding: '2px 6px',
              borderRadius: 3,
              backgroundColor: 'rgba(201, 59, 59, 0.08)',
            }}
            aria-label={`${overdue} overdue`}
            title={`${overdue} overdue`}
          >
            <AlertTriangle size={10} /> {overdue}
          </span>
        )}
        <span style={{ fontSize: 11, color: C.ink2, fontWeight: 500 }}>
          {total} total
        </span>
        <div
          aria-label={`${approved} of ${total} approved`}
          title={`${approved} of ${total} approved (${pct}%)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              width: 64,
              height: 4,
              backgroundColor: C.borderSubtle,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: pct >= 80 ? C.active : pct >= 40 ? C.pending : C.ink3,
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: C.ink3, minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>
            {approved}/{total}
          </span>
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{actions}</div>}
      </div>
    </div>
  )
}

export default GroupHeader
