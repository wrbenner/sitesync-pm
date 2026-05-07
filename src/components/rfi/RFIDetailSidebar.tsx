/**
 * RFIDetailSidebar — right rail for the RFI detail page.
 *
 * Procore's detail page reads as an enterprise record because the
 * metadata sits in a glanceable side rail; SiteSync's pre-2026-05-08
 * detail page was a 720-px scroll where everything blended into the
 * conversation flow. The May-7 audit's item #6 calls this out.
 *
 * Minimal-viable scope here (per Bugatti split — the full sidebar with
 * inline editors lands in PR #2.5):
 *   - Ball-in-court: avatar + UserName, never the UUID
 *   - SLA pill (due date, overdue/at-risk colour)
 *   - Watchers count
 *   - Linked items count
 *   - Schedule impact strip (status + days)
 *   - Cost impact strip (status + $)
 *
 * Each strip is read-only here; mutations go through the existing
 * RFIEditPanel slide-in (Edit button in the page header).
 */

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Eye, Link2, AlertTriangle, DollarSign, Timer, User } from 'lucide-react'
import { fromTable } from '../../lib/db/queries'
import { UserName } from '../UserName'
import { Avatar } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useProfileNames, displayName } from '../../hooks/queries/profiles'

interface Props {
  rfiId: string
  ballInCourt: string | null
  status: string | null
  dueDate: string | null
  scheduleImpactStatus: string | null
  scheduleDaysImpact: number | null
  costImpactStatus: string | null
  costImpactCents: number | null
}

const formatDate = (d: string | null): string => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const dueClass = (
  due: string | null,
  status: string | null,
): { color: string; bg: string; label: string } => {
  if (!due) return { color: colors.textTertiary, bg: colors.surfaceInset, label: 'No due date' }
  if (status === 'closed' || status === 'void')
    return { color: colors.textTertiary, bg: colors.surfaceInset, label: formatDate(due) }
  const d = new Date(due).getTime()
  const now = Date.now()
  const days = Math.ceil((d - now) / 86_400_000)
  if (days < 0) return { color: colors.red, bg: '#fee2e2', label: `Overdue · due ${formatDate(due)}` }
  if (days <= 2) return { color: '#b45309', bg: '#fef3c7', label: `Due in ${days}d` }
  return { color: colors.textSecondary, bg: colors.surfaceInset, label: `Due in ${days}d` }
}

const initialsFromName = (name: string): string =>
  (name || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || 'U'

const formatCents = (cents: number | null): string => {
  if (cents == null) return '—'
  const dollars = cents / 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(dollars)
}

const impactPillColor = (statusValue: string | null): { color: string; bg: string } => {
  switch (statusValue) {
    case 'yes':
      return { color: colors.red, bg: '#fee2e2' }
    case 'no':
      return { color: colors.textSecondary, bg: colors.surfaceInset }
    case 'tbd':
      return { color: '#b45309', bg: '#fef3c7' }
    default:
      return { color: colors.textTertiary, bg: colors.surfaceInset }
  }
}

const Strip: React.FC<{
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}> = ({ icon, label, children }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: `${spacing['2']} ${spacing['3']}`,
      borderRadius: 10,
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderSubtle}`,
    }}
  >
    <span
      style={{
        fontSize: 10,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {icon} {label}
    </span>
    <div style={{ fontSize: 13, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
      {children}
    </div>
  </div>
)

export const RFIDetailSidebar: React.FC<Props> = ({
  rfiId,
  ballInCourt,
  status,
  dueDate,
  scheduleImpactStatus,
  scheduleDaysImpact,
  costImpactStatus,
  costImpactCents,
}) => {
  const { data: profileMap } = useProfileNames(ballInCourt ? [ballInCourt] : [])
  const bicName = ballInCourt ? displayName(profileMap, ballInCourt, '') : ''

  const { data: watcherCount = 0 } = useQuery({
    queryKey: ['rfi_watchers_count', rfiId],
    queryFn: async () => {
      const { count, error } = await fromTable('rfi_watchers')
        .select('id', { count: 'exact', head: true })
        .eq('rfi_id' as never, rfiId)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!rfiId,
  })

  const { data: linkCount = 0 } = useQuery({
    queryKey: ['rfi_links_count', rfiId],
    queryFn: async () => {
      const { count, error } = await fromTable('rfi_links')
        .select('id', { count: 'exact', head: true })
        .eq('rfi_id' as never, rfiId)
      if (error) {
        // rfi_links may not exist in older envs; degrade silently.
        return 0
      }
      return count ?? 0
    },
    enabled: !!rfiId,
  })

  const due = dueClass(dueDate, status)
  const sched = impactPillColor(scheduleImpactStatus)
  const cost = impactPillColor(costImpactStatus)

  return (
    <aside
      aria-label="RFI summary sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['3'],
      }}
    >
      <Strip icon={<User size={11} />} label="Ball in court">
        {ballInCourt ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Avatar initials={initialsFromName(bicName)} size={26} />
            <UserName userId={ballInCourt} fallback="—" />
          </div>
        ) : (
          <span style={{ color: colors.textTertiary }}>Unassigned</span>
        )}
      </Strip>

      <Strip icon={<Calendar size={11} />} label="Due">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: borderRadius.full,
            backgroundColor: due.bg,
            color: due.color,
            fontSize: 12,
            fontWeight: typography.fontWeight.semibold,
          }}
        >
          <Timer size={10} /> {due.label}
        </span>
      </Strip>

      <Strip icon={<AlertTriangle size={11} />} label="Schedule impact">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: borderRadius.full,
            backgroundColor: sched.bg,
            color: sched.color,
            fontSize: 12,
            fontWeight: typography.fontWeight.semibold,
          }}
        >
          {scheduleImpactStatus
            ? `${scheduleImpactStatus.toUpperCase()}${
                scheduleDaysImpact != null ? ` · ${scheduleDaysImpact}d` : ''
              }`
            : '—'}
        </span>
      </Strip>

      <Strip icon={<DollarSign size={11} />} label="Cost impact">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: borderRadius.full,
            backgroundColor: cost.bg,
            color: cost.color,
            fontSize: 12,
            fontWeight: typography.fontWeight.semibold,
          }}
        >
          {costImpactStatus
            ? `${costImpactStatus.toUpperCase()}${
                costImpactCents != null ? ` · ${formatCents(costImpactCents)}` : ''
              }`
            : '—'}
        </span>
      </Strip>

      <Strip icon={<Eye size={11} />} label="Watchers">
        <span style={{ fontSize: 13, color: colors.textPrimary }}>
          {watcherCount === 0 ? <span style={{ color: colors.textTertiary }}>None</span> : `${watcherCount} watching`}
        </span>
      </Strip>

      <Strip icon={<Link2 size={11} />} label="Linked items">
        <span style={{ fontSize: 13, color: colors.textPrimary }}>
          {linkCount === 0 ? <span style={{ color: colors.textTertiary }}>None</span> : `${linkCount} linked`}
        </span>
      </Strip>
    </aside>
  )
}

export default RFIDetailSidebar
