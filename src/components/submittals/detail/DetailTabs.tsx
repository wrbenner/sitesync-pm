// Phase 6 — Submittal detail tab strip + EmptyTabPlaceholder.
//
// Per spec Part 2.4 IA: 7 tabs across the top of the detail page. Phase 6
// makes Overview live; the other 6 render an EmptyTabPlaceholder pointing
// to the phase that wires them.
//
// Spatial memory principle (per plan §7): the same noun is in the same
// place on every screen. The tab strip mirrors the log-page tab strip
// (same height, same border bottom, same active-underline color).

import React from 'react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  brandOrange: '#F47820',
  border: 'rgba(26, 22, 19, 0.10)',
  surface: '#FCFCFA',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export type DetailTab =
  | 'overview'
  | 'markup'
  | 'revisions'
  | 'citations'
  | 'history'
  | 'distribute'
  | 'emails'

interface TabDef {
  id: DetailTab
  label: string
  /** Phase that wires the tab. Phase 6 ships Overview; others point forward. */
  phase: number
}

export const DETAIL_TABS: TabDef[] = [
  { id: 'overview',   label: 'Overview',   phase: 6 },
  { id: 'markup',     label: 'Markup',     phase: 8 },
  { id: 'revisions',  label: 'Revisions',  phase: 8 },
  { id: 'citations',  label: 'Citations',  phase: 7 },
  { id: 'history',    label: 'History',    phase: 6 }, // EntityAuditViewer drop-in (already supports submittal)
  { id: 'distribute', label: 'Distribute', phase: 8 },
  { id: 'emails',     label: 'Emails',     phase: 8 },
]

export interface DetailTabsProps {
  active: DetailTab
  onChange: (tab: DetailTab) => void
}

export const DetailTabs: React.FC<DetailTabsProps> = ({ active, onChange }) => (
  <div
    role="tablist"
    aria-label="Submittal detail views"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      borderBottom: `1px solid ${C.border}`,
      padding: '0 24px',
      backgroundColor: C.surface,
      overflowX: 'auto',
    }}
  >
    {DETAIL_TABS.map((tab) => {
      const isActive = tab.id === active
      const isLive = tab.phase <= 6 // Overview + History live in Phase 6
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={isActive}
          aria-controls={`submittal-detail-${tab.id}-panel`}
          onClick={() => onChange(tab.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 14px',
            minHeight: 36,
            border: 'none',
            backgroundColor: 'transparent',
            color: isActive ? C.ink : C.ink2,
            borderBottom: isActive ? `2px solid ${C.brandOrange}` : '2px solid transparent',
            cursor: 'pointer',
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            letterSpacing: '-0.005em',
            whiteSpace: 'nowrap',
            transition: 'color 80ms ease',
          }}
          onMouseEnter={(e) => {
            if (!isActive) e.currentTarget.style.color = C.ink
          }}
          onMouseLeave={(e) => {
            if (!isActive) e.currentTarget.style.color = C.ink2
          }}
        >
          {tab.label}
          {!isLive && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: C.ink4,
                marginLeft: 2,
              }}
              title={`Coming in Phase ${tab.phase}`}
            >
              P{tab.phase}
            </span>
          )}
        </button>
      )
    })}
  </div>
)

export interface EmptyDetailTabProps {
  phase: number
  tabLabel: string
}

export const EmptyDetailTab: React.FC<EmptyDetailTabProps> = ({ phase, tabLabel }) => (
  <div
    role="status"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 8,
      backgroundColor: C.surface,
      fontFamily: FONT,
      textAlign: 'center',
      minHeight: '40vh',
    }}
  >
    <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>
      {tabLabel} — coming in Phase {phase}
    </h2>
    <p style={{ margin: 0, fontSize: 12, color: C.ink3, maxWidth: 460 }}>
      See <code style={{ fontFamily: 'inherit' }}>/Users/walkerbenner/.claude/plans/stateful-greeting-book.md</code>{' '}
      for the rollout plan.
    </p>
  </div>
)

export default DetailTabs
