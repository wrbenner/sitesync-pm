/**
 * MarginRecoveryWidget
 *
 * Quiet brag for the dashboard. Shows the running tally of $ recovered via
 * auto-CO drafting — drafted COs that the PM approved that started life as
 * an RFI scope change. The number is the proof the feature is paying for
 * itself, and it goes on the marketing page when the ROI is undeniable.
 *
 * Compact card. Reads three numbers from props:
 *   • $ recovered this period (default: this month)
 *   • drafted-COs approved count
 *   • total drafted (so you can see acceptance rate)
 *
 * The parent fetches via:
 *
 *   select sum(estimated_cost), count(*) filter (where status='approved'),
 *          count(*) total
 *   from change_orders
 *   where source_rfi_id is not null
 *     and project_id = $1
 *     and approved_date >= date_trunc('month', current_date)
 */

import React from 'react'
import { TrendingUp, ArrowUpRight, Sparkles } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { Eyebrow } from '../atoms'

export interface MarginRecoveryWidgetProps {
  /** USD recovered through approved auto-drafted COs in the period. */
  recoveredAmount: number
  /** Approved count over the period. */
  approvedCount: number
  /** Total drafted (approved + rejected + still-pending) over the period. */
  totalDrafted: number
  /** Period label, e.g. "this month", "last 30 days". Default "this month". */
  periodLabel?: string
  /** Click → navigate to a filtered list of source-from-RFI COs. */
  onClick?: () => void
}

function formatUsdShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `$${(n / 1_000).toFixed(0)}K`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

export const MarginRecoveryWidget: React.FC<MarginRecoveryWidgetProps> = ({
  recoveredAmount,
  approvedCount,
  totalDrafted,
  periodLabel = 'this month',
  onClick,
}) => {
  const acceptanceRate = totalDrafted > 0 ? Math.round((approvedCount / totalDrafted) * 100) : 0
  const Wrapper: React.ElementType = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['2'],
        padding: spacing['4'],
        backgroundColor: 'var(--color-surfaceRaised, #FFFFFF)',
        border: '1px solid var(--hairline)',
        borderRadius: 12,
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        width: '100%',
        transition: 'border-color 120ms ease',
      }}
      onMouseEnter={onClick ? (e: React.MouseEvent<HTMLElement>) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--hairline-2)'
      } : undefined}
      onMouseLeave={onClick ? (e: React.MouseEvent<HTMLElement>) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--hairline)'
      } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={11} aria-hidden="true" />
          Margin recovered
        </Eyebrow>
        {onClick && <ArrowUpRight size={14} style={{ color: colors.ink4 }} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'] }}>
        <span
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: 36,
            fontWeight: 400,
            color: colors.ink,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatUsdShort(recoveredAmount)}
        </span>
        <span style={{ fontFamily: typography.fontFamily, fontSize: 12, color: colors.ink3 }}>
          {periodLabel}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: typography.fontFamily,
          fontSize: 12,
          color: colors.ink2,
        }}
      >
        <TrendingUp size={12} style={{ color: colors.statusActive }} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {approvedCount} of {totalDrafted} auto-drafts approved
          {totalDrafted > 0 && (
            <span style={{ color: colors.ink3 }}>{' · '}{acceptanceRate}%</span>
          )}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: typography.fontFamilySerif,
          fontSize: 13,
          fontStyle: 'italic',
          color: colors.ink3,
          lineHeight: 1.45,
        }}
      >
        Scope changes caught at the RFI answer, not at the monthly review.
      </p>
    </Wrapper>
  )
}
