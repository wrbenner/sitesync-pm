// Phase 1 — slim page header. Replaces the previous oversized "Submittals"
// title + 4-card KPI strip with a tight title row, settings gear, and the
// inline four-count strip below.
//
// Spec: SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 1 §Scope.
// Visual audit gap: SUBMITTAL_VISUAL_AUDIT_2026-05-06.md §K, §L, §H.

import React from 'react'
import { Settings } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  surfaceHover: '#F0EFEB',
  critical: '#C93B3B',
  pending: '#C4850C',
  active: '#2D8A6E',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface SubmittalsHeaderProps {
  /** Project name for the breadcrumb hint. */
  projectName?: string
  /** {N} active. */
  activeCount: number
  /** {N} overdue. */
  overdueCount: number
  /** {N} awaiting your response (current user is the BIC). */
  awaitingMineCount: number
  /** {N} architect-late (BIC = architect, days_in_court > SLA). */
  architectLateCount: number
  /** Right-aligned action cluster: + New Submittal · Export ▾ · Reports ▾. */
  actions?: React.ReactNode
  /** Click → /submittals/settings (placeholder Phase 8). */
  onOpenSettings?: () => void
}

export const SubmittalsHeader: React.FC<SubmittalsHeaderProps> = ({
  projectName,
  activeCount,
  overdueCount,
  awaitingMineCount,
  architectLateCount,
  actions,
  onOpenSettings,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '14px 24px 10px',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: C.ink,
          fontFamily: FONT,
        }}
      >
        Submittals
      </h1>

      <button
        type="button"
        aria-label="Submittal settings"
        title="Submittal settings"
        onClick={onOpenSettings}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          padding: 0,
          backgroundColor: 'transparent',
          color: C.ink3,
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = C.surfaceHover
          e.currentTarget.style.color = C.ink
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = C.ink3
        }}
      >
        <Settings size={14} />
      </button>

      {projectName && (
        <span
          style={{
            fontSize: 12,
            color: C.ink3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 280,
            fontFamily: FONT,
          }}
        >
          {projectName}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
        </div>
      )}
    </div>

    {/* Slim inline strip — replaces the 4 KPI cards from the old shell.
        The "5 active · 5 overdue" subtitle is also removed; this row
        carries that information instead, at higher density. */}
    <div
      role="status"
      aria-label="Submittal counts"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        fontFamily: FONT,
        color: C.ink2,
        fontVariantNumeric: 'tabular-nums',
        flexWrap: 'wrap',
      }}
    >
      <Count value={activeCount} label="active" tone="default" />
      <Sep />
      <Count value={overdueCount} label="overdue" tone={overdueCount > 0 ? 'critical' : 'default'} />
      <Sep />
      <Count
        value={awaitingMineCount}
        label="awaiting your response"
        tone={awaitingMineCount > 0 ? 'pending' : 'default'}
      />
      <Sep />
      <Count
        value={architectLateCount}
        label="architect-late"
        tone={architectLateCount > 0 ? 'critical' : 'default'}
      />
    </div>
  </div>
)

const Count: React.FC<{
  value: number
  label: string
  tone: 'default' | 'critical' | 'pending' | 'active'
}> = ({ value, label, tone }) => {
  const color =
    tone === 'critical' ? C.critical : tone === 'pending' ? C.pending : tone === 'active' ? C.active : C.ink
  return (
    <span>
      <strong style={{ color, fontWeight: 600 }}>{value}</strong>{' '}
      <span style={{ color: C.ink3 }}>{label}</span>
    </span>
  )
}

const Sep: React.FC = () => (
  <span aria-hidden style={{ color: C.ink3, opacity: 0.45 }}>
    ·
  </span>
)

export default SubmittalsHeader
