// ─────────────────────────────────────────────────────────────────────────────
// ZonePanel — a single instrument panel in the dashboard cockpit.
// ─────────────────────────────────────────────────────────────────────────────
// Hardware-grade alignment, hairline border, no shadows. Title row with count
// badge + optional action; content fills below. Designed to live inside a CSS
// grid alongside other ZonePanels with no surrounding card chrome.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { colors, typography, spacing, borderRadius } from '../../styles/theme'

interface ZonePanelProps {
  title: string
  count?: number
  action?: React.ReactNode
  subtitle?: React.ReactNode
  /** Suppress the hairline border (used for top-level lanes). */
  flush?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
  contentStyle?: React.CSSProperties
}

export const ZonePanel: React.FC<ZonePanelProps> = ({
  title,
  count,
  action,
  subtitle,
  flush = false,
  children,
  style,
  contentStyle,
}) => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      background: colors.surfaceRaised,
      border: flush ? 'none' : `1px solid ${colors.borderDefault}`,
      borderRadius: flush ? 0 : borderRadius.md,
      overflow: 'hidden',
      ...style,
    }}
  >
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[3],
        padding: `${spacing[3]} ${spacing[4]}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        background: colors.surfaceInset,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing[2], minWidth: 0 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: typography.fontFamily,
            fontSize: '12px',
            fontWeight: 600,
            color: colors.ink,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          {title}
        </h2>
        {typeof count === 'number' && (
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontVariantNumeric: 'tabular-nums',
              fontSize: '12px',
              fontWeight: 500,
              color: colors.ink3,
              lineHeight: 1,
            }}
          >
            {count}
          </span>
        )}
        {subtitle && (
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '12px',
              color: colors.ink3,
              lineHeight: 1.3,
              marginLeft: spacing[2],
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {action}
    </header>
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', ...contentStyle }}>
      {children}
    </div>
  </section>
)

export default ZonePanel
