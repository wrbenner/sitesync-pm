// ─────────────────────────────────────────────────────────────────────────────
// ReportCard — instrument-panel surface for the /reports landing matrix.
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors the visual language of the cockpit ZonePanel (hairline border,
// uppercase title, count badge, dense content area) without importing it —
// ZonePanel is owned by /day cockpit and Reports is intentionally decoupled.
//
// Layout intent: three of these sit in a CSS grid below the Iris hero card.
// Each is read-only data, no actions. Loading + empty states are baked in.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { colors, typography, spacing, borderRadius } from '../../styles/theme'

export interface ReportCardProps {
  title: string
  /** One-line subtitle/period e.g. "Last 7 days" */
  subtitle?: string
  /** Big foreground number rendered in the header. */
  metric?: string
  /** Optional delta token shown next to the metric (e.g. "+1.4% WoW"). */
  delta?: {
    label: string
    tone: 'positive' | 'negative' | 'neutral'
  }
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
  children?: React.ReactNode
  /** Optional action rendered in the right slot of the header. */
  action?: React.ReactNode
}

const DELTA_COLOR: Record<NonNullable<ReportCardProps['delta']>['tone'], string> = {
  positive: colors.statusActive,
  negative: colors.statusCritical,
  neutral: colors.textTertiary,
}

export const ReportCard: React.FC<ReportCardProps> = ({
  title,
  subtitle,
  metric,
  delta,
  loading,
  empty,
  emptyMessage,
  children,
  action,
}) => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderDefault}`,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      fontFamily: typography.fontFamily,
    }}
  >
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing[3],
        padding: `${spacing[3]} ${spacing[4]}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        backgroundColor: colors.surfaceInset,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing[2] }}>
          <h3
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              color: colors.ink,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <span
              style={{
                fontSize: typography.fontSize.caption,
                color: colors.textTertiary,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
        {(metric || delta) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing[2] }}>
            {metric && (
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {metric}
              </span>
            )}
            {delta && (
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: 600,
                  color: DELTA_COLOR[delta.tone],
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {delta.label}
              </span>
            )}
          </div>
        )}
      </div>
      {action}
    </header>
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
      }}
    >
      {loading ? (
        <CardMessage>Loading…</CardMessage>
      ) : empty ? (
        <CardMessage>{emptyMessage ?? 'No data for this period.'}</CardMessage>
      ) : (
        children
      )}
    </div>
  </section>
)

const CardMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: `${spacing[5]} ${spacing[4]}`,
      fontSize: typography.fontSize.sm,
      color: colors.textTertiary,
      textAlign: 'center',
    }}
  >
    {children}
  </div>
)

// ── Matrix row primitive ─────────────────────────────────────────────────────
// Tight key/value row designed for the dense card body. Public so the page
// can compose its own content rows without redefining the same flex stack.

export const ReportCardRow: React.FC<{
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'positive' | 'negative' | 'neutral'
}> = ({ label, value, hint, tone = 'neutral' }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing[3],
      padding: `6px ${spacing[4]}`,
      borderBottom: `1px solid ${colors.borderSubtle}`,
      fontSize: typography.fontSize.sm,
    }}
  >
    <span
      style={{
        color: colors.textSecondary,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 0,
        flex: 1,
      }}
    >
      {label}
    </span>
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: spacing[2],
        flexShrink: 0,
        color: colors.textPrimary,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 600,
      }}
    >
      <span style={{ color: DELTA_COLOR[tone] === colors.textTertiary ? colors.textPrimary : DELTA_COLOR[tone] }}>
        {value}
      </span>
      {hint && (
        <span
          style={{
            color: colors.textTertiary,
            fontWeight: 500,
            fontSize: typography.fontSize.caption,
          }}
        >
          {hint}
        </span>
      )}
    </span>
  </div>
)

export default ReportCard
