// ─────────────────────────────────────────────────────────────────────────────
// Cockpit — the layout shell of the dashboard.
// ─────────────────────────────────────────────────────────────────────────────
// Desktop (≥ 1024): sidebar (handled outside) + main grid:
//   ┌────────────────────────────────────────────────────────────┐
//   │ Header (project · date · weather)                          │
//   ├────────────────────────────────────────────────────────────┤
//   │ Iris lane (8 chips)                                        │
//   ├──────────────────────────────────┬─────────────────────────┤
//   │ Needs You (table)                │ Project Now (panel)     │
//   │                                  │                         │
//   └──────────────────────────────────┴─────────────────────────┘
//
// Mobile (< 1024): everything stacks vertically. Iris lane → Project Now →
// Needs You (so the field user sees status before drilling into the inbox).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { colors, spacing } from '../../styles/theme'

interface CockpitProps {
  header: React.ReactNode
  metrics?: React.ReactNode
  irisLane?: React.ReactNode
  needsYou: React.ReactNode
  projectNow: React.ReactNode
  isMobile: boolean
}

const PANEL_GAP = spacing[4]
const RAIL_WIDTH = 360
const HEADER_HEIGHT = 56

export const Cockpit: React.FC<CockpitProps> = ({
  header,
  metrics,
  irisLane,
  needsYou,
  projectNow,
  isMobile,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: colors.surfacePage,
    }}
  >
    <div style={{ flexShrink: 0 }}>{header}</div>
    {metrics}
    {irisLane}

    {isMobile ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: PANEL_GAP,
          padding: PANEL_GAP,
        }}
      >
        <div>{projectNow}</div>
        <div>{needsYou}</div>
      </div>
    ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `minmax(0, 1fr) ${RAIL_WIDTH}px`,
          gap: PANEL_GAP,
          padding: PANEL_GAP,
          minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        }}
      >
        <div style={{ minWidth: 0, display: 'flex' }}>{needsYou}</div>
        <div style={{ minWidth: 0, display: 'flex' }}>{projectNow}</div>
      </div>
    )}
  </div>
)

export default Cockpit
