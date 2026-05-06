/**
 * _kit — small shared visual primitives for the compliance cockpit.
 *
 * Not an export of new abstractions to the rest of the app — kept private
 * to this directory (underscore prefix). The rules say "use existing
 * primitives; no new Card/Btn abstractions" — these are panel-internal
 * helpers that compose Card + theme tokens into the operational-density
 * patterns every panel repeats (KPI tile, status pill, table headers).
 */

import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import { Card } from '../../../components/Primitives'

export interface KpiTileProps {
  label: string
  value: string | number
  /** Small caption beneath the number (e.g. "of 16 contractors"). */
  hint?: string
  /** Optional severity tone — drives the value color. */
  tone?: 'default' | 'info' | 'warn' | 'critical' | 'success'
}

const TONE_COLOR: Record<NonNullable<KpiTileProps['tone']>, string> = {
  default: colors.textPrimary,
  info: colors.statusInfo,
  warn: colors.statusPending,
  critical: colors.statusCritical,
  success: colors.statusActive,
}

export const KpiTile: React.FC<KpiTileProps> = ({ label, value, hint, tone = 'default' }) => (
  <Card padding={spacing['5']}>
    <div style={{
      fontSize: typography.fontSize.caption,
      fontWeight: typography.fontWeight.semibold,
      color: colors.textTertiary,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      marginBottom: spacing['2'],
    }}>
      {label}
    </div>
    <div style={{
      fontSize: typography.fontSize.display,
      fontWeight: typography.fontWeight.semibold,
      color: TONE_COLOR[tone],
      lineHeight: typography.lineHeight.none,
      fontVariantNumeric: 'tabular-nums' as const,
    }}>
      {value}
    </div>
    {hint && (
      <div style={{
        fontSize: typography.fontSize.xs,
        color: colors.textTertiary,
        marginTop: spacing['1'],
      }}>
        {hint}
      </div>
    )}
  </Card>
)

export type StatusPillTone = 'success' | 'warn' | 'critical' | 'info' | 'neutral'

const PILL_BG: Record<StatusPillTone, string> = {
  success: colors.statusActiveSubtle,
  warn: colors.statusPendingSubtle,
  critical: colors.statusCriticalSubtle,
  info: colors.statusInfoSubtle,
  neutral: colors.surfaceInset,
}
const PILL_FG: Record<StatusPillTone, string> = {
  success: colors.statusActive,
  warn: colors.statusPending,
  critical: colors.statusCritical,
  info: colors.statusInfo,
  neutral: colors.textSecondary,
}

export const StatusPill: React.FC<{ tone: StatusPillTone; label: string }> = ({ tone, label }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing['1'],
    padding: `2px ${spacing['2']}`,
    borderRadius: borderRadius.full,
    backgroundColor: PILL_BG[tone],
    color: PILL_FG[tone],
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily,
  }}>
    <span style={{
      width: 5, height: 5, borderRadius: '50%',
      backgroundColor: PILL_FG[tone],
    }} />
    {label}
  </span>
)

/** Banner for graceful-degradation cases (table missing, edge fn 404). */
export const DegradedBanner: React.FC<{ message: string }> = ({ message }) => (
  <div style={{
    padding: `${spacing['2']} ${spacing['3']}`,
    backgroundColor: colors.statusPendingSubtle,
    border: `1px solid ${colors.statusPending}`,
    borderRadius: borderRadius.base,
    color: colors.statusPending,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily,
  }}>
    {message}
  </div>
)

/** Operational-density table header row. */
export const TableHeaderRow: React.FC<{
  columns: string[]
  template: string  // CSS grid-template-columns
}> = ({ columns, template }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: template,
    gap: 0,
    padding: `${spacing['2']} ${spacing['4']}`,
    backgroundColor: colors.surfaceInset,
    borderBottom: `1px solid ${colors.borderSubtle}`,
  }}>
    {columns.map(c => (
      <span key={c} style={{
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textSecondary,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
      }}>{c}</span>
    ))}
  </div>
)

export const TableBodyRow: React.FC<{
  template: string
  alt?: boolean
  children: React.ReactNode
}> = ({ template, alt, children }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: template,
    gap: 0,
    padding: `${spacing['3']} ${spacing['4']}`,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    backgroundColor: alt ? colors.surfacePage : colors.surfaceRaised,
    alignItems: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  }}>
    {children}
  </div>
)
