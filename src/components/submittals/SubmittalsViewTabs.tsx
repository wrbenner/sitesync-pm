// Phase 1 — view tab strip + EmptyTabPlaceholder for the 7 future surfaces.
//
// Spec: SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 1 §Scope.
// All 8 tabs render in the strip; only `items` is interactive in this PR.
// Every other tab renders <EmptyTabPlaceholder phase={N} /> with the phase
// number that ships it.

import React from 'react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  brandOrange: '#F47820',
  border: 'rgba(26, 22, 19, 0.10)',
  surfaceHover: '#F0EFEB',
  surface: '#FCFCFA',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export type SubmittalViewTab =
  | 'items'
  | 'packages'
  | 'spec_sections'
  | 'ball_in_court'
  | 'kanban'
  | 'timeline'
  | 'schedule'
  | 'recycle_bin'

interface TabDef {
  id: SubmittalViewTab
  label: string
  phase: number // which phase ships the interactive view
}

export const SUBMITTAL_TABS: TabDef[] = [
  { id: 'items',         label: 'Items',         phase: 1 },
  { id: 'packages',      label: 'Packages',      phase: 4 },
  { id: 'spec_sections', label: 'Spec Sections', phase: 4 },
  { id: 'ball_in_court', label: 'Ball in Court', phase: 4 },
  { id: 'kanban',        label: 'Kanban',        phase: 5 },
  { id: 'timeline',      label: 'Timeline',      phase: 5 },
  { id: 'schedule',      label: 'Schedule',      phase: 5 },
  { id: 'recycle_bin',   label: 'Recycle Bin',   phase: 8 },
]

export interface SubmittalsViewTabsProps {
  active: SubmittalViewTab
  onChange: (tab: SubmittalViewTab) => void
}

export const SubmittalsViewTabs: React.FC<SubmittalsViewTabsProps> = ({ active, onChange }) => (
  <div
    role="tablist"
    aria-label="Submittal views"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      borderBottom: `1px solid ${C.border}`,
      padding: '0 24px',
      overflowX: 'auto',
    }}
  >
    {SUBMITTAL_TABS.map((tab) => {
      const isActive = tab.id === active
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={isActive}
          aria-controls={`submittal-${tab.id}-panel`}
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
          {tab.phase > 1 && (
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

export interface EmptyTabPlaceholderProps {
  phase: number
  tabLabel: string
}

export const EmptyTabPlaceholder: React.FC<EmptyTabPlaceholderProps> = ({ phase, tabLabel }) => (
  <div
    role="status"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      padding: 32,
      gap: 8,
      backgroundColor: C.surface,
      fontFamily: FONT,
      textAlign: 'center',
    }}
  >
    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>
      {tabLabel} — coming in Phase {phase}
    </h2>
    <p style={{ margin: 0, fontSize: 13, color: C.ink3, maxWidth: 460 }}>
      See <code style={{ fontFamily: 'inherit' }}>docs/audits/SUBMITTALS_PAGE_REBUILD_PLAN.md</code>{' '}
      for the rollout plan.
    </p>
  </div>
)

export default SubmittalsViewTabs
