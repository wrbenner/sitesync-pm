import React from 'react'
import { Link } from 'react-router-dom'
import { Lock, ArrowRight } from 'lucide-react'
import { Card } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useActivePeriod } from '../../hooks/queries/financial-periods'

interface PeriodClosedBannerProps {
  projectId: string | undefined
  /** Optional className for callers that want to scope the banner differently. */
  style?: React.CSSProperties
}

/**
 * Warns users that the current financial period is closed. Renders nothing
 * when the period is open or the hook hasn't resolved. Consumed by pages
 * whose writes would be stale against a closed month (pay-apps, change
 * orders). The disable-controls behaviour lives in the consumer page — this
 * component only surfaces the state.
 *
 * Month label follows the "<Month YYYY>" format per spec
 * (e.g. "April 2026"). Interprets `period_month` as the first of the month
 * in UTC; hook helper `firstOfMonth` stores YYYY-MM-DD at UTC midnight.
 */
export const PeriodClosedBanner: React.FC<PeriodClosedBannerProps> = ({ projectId, style }) => {
  const { data: period } = useActivePeriod(projectId)

  if (!period || period.status !== 'closed') return null

  const label = formatMonthYear(period.period_month)

  return (
    <Card
      padding={spacing['4']}
      style={{
        marginBottom: spacing['4'],
        borderLeft: `3px solid ${colors.statusPending}`,
        backgroundColor: colors.statusPendingSubtle,
        ...style,
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          flexWrap: 'wrap',
        }}
      >
        <Lock size={16} color={colors.statusPending} aria-hidden="true" />
        <span
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textPrimary,
            fontWeight: typography.fontWeight.medium,
          }}
        >
          Period {label} is closed — edits restricted to owner/admin.
          Reopen in Budget → Period Close.
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Link
            to="/budget"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`,
              borderRadius: borderRadius.base,
              border: `1px solid ${colors.statusPending}`,
              color: colors.statusPending,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              textDecoration: 'none',
              backgroundColor: colors.surfaceRaised,
            }}
          >
            Open Budget
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Card>
  )
}

function formatMonthYear(isoDate: string): string {
  // period_month is "YYYY-MM-DD" at UTC midnight. Parse conservatively so a
  // timezone shift doesn't push us into the previous month.
  const match = /^(\d{4})-(\d{2})/.exec(isoDate)
  if (!match) return isoDate
  const year = Number(match[1])
  const monthIdx = Number(match[2]) - 1
  const d = new Date(Date.UTC(year, monthIdx, 1))
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
