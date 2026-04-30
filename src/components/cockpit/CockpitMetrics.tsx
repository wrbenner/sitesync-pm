// ─────────────────────────────────────────────────────────────────────────────
// CockpitMetrics — the four numbers that tell project posture in one glance.
// ─────────────────────────────────────────────────────────────────────────────
// Sits between the page header and the Iris lane. Big tabular numbers, tight
// uppercase labels. Each metric is clickable to deep-link the relevant view.
//
// Four metrics by design (more competes with itself):
//   1. NEEDS YOU — count of items waiting on the user
//   2. CRITICAL — count at urgency='critical' (the "what's on fire" answer)
//   3. AT RISK $ — sum of cost impact across at-risk items
//   4. SCHEDULE — count of critical-path activities behind
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { colors, typography, spacing } from '../../styles/theme'
import { useScheduleActivities } from '../../hooks/useScheduleActivities'
import { useProjectId } from '../../hooks/useProjectId'
import type { StreamItem } from '../../types/stream'

interface CockpitMetricsProps {
  items: StreamItem[]
}

function formatDollars(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

interface Metric {
  value: string
  label: string
  tone: 'critical' | 'high' | 'neutral' | 'positive'
  href?: string
}

function Cell({ metric, onClick }: { metric: Metric; onClick?: () => void }) {
  const valueColor =
    metric.tone === 'critical'
      ? '#C93B3B'
      : metric.tone === 'high'
        ? '#B8472E'
        : metric.tone === 'positive'
          ? '#2D8A6E'
          : colors.ink
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 4,
        padding: `${spacing[3]} ${spacing[5]}`,
        background: 'transparent',
        border: 'none',
        borderRight: `1px solid ${colors.borderSubtle}`,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '26px',
          fontWeight: 600,
          color: valueColor,
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
        }}
      >
        {metric.value}
      </span>
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: colors.ink3,
          lineHeight: 1.2,
        }}
      >
        {metric.label}
      </span>
    </button>
  )
}

export const CockpitMetrics: React.FC<CockpitMetricsProps> = ({ items }) => {
  const navigate = useNavigate()
  const projectId = useProjectId()
  const { data: scheduleActs } = useScheduleActivities(projectId ?? '')

  const metrics = useMemo<Metric[]>(() => {
    const total = items.length
    const critical = items.filter((i) => i.urgency === 'critical').length
    const atRiskDollars = items
      .filter((i) => i.urgency === 'critical' || i.urgency === 'high' || i.cardType === 'risk')
      .reduce((sum, i) => sum + (i.costImpact ?? 0), 0)
    const todayIso = new Date().toISOString().split('T')[0]
    const scheduleBehind = (scheduleActs ?? []).filter(
      (a) =>
        a.is_critical_path &&
        a.end_date &&
        a.end_date < todayIso &&
        (a.percent_complete ?? 0) < 100,
    ).length

    return [
      {
        value: total.toString(),
        label: 'Needs You',
        tone: total > 0 ? 'neutral' : 'positive',
      },
      {
        value: critical.toString(),
        label: 'Critical',
        tone: critical > 0 ? 'critical' : 'positive',
      },
      {
        value: formatDollars(atRiskDollars),
        label: 'At Risk $',
        tone: atRiskDollars > 0 ? 'high' : 'neutral',
        href: '/budget',
      },
      {
        value: scheduleBehind.toString(),
        label: 'Behind Schedule',
        tone: scheduleBehind > 0 ? 'critical' : 'positive',
        href: '/schedule',
      },
    ]
  }, [items, scheduleActs])

  return (
    <div
      role="region"
      aria-label="Project posture"
      style={{
        display: 'flex',
        background: colors.surfaceRaised,
        borderBottom: `1px solid ${colors.borderDefault}`,
      }}
    >
      {metrics.map((m) => (
        <Cell
          key={m.label}
          metric={m}
          onClick={m.href ? () => navigate(m.href!) : undefined}
        />
      ))}
    </div>
  )
}

export default CockpitMetrics
