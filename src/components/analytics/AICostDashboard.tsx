// Phase 4, Module 8: AI Cost Dashboard
// Adapts the cost-analytics microservice patterns for the sitesync-pm frontend.
// Renders daily spend by service, cost per project, ROI summary, and a trend
// line chart. Uses inline styles and theme tokens exclusively.

import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { DollarSign, TrendingUp, Activity, AlertTriangle } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import { useAICostTracking, type AICostSummary } from '../../hooks/useAICostTracking'

// ── Helpers ──────────────────────────────────────────────

function formatCents(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(2)}K`
  if (dollars >= 1) return `$${dollars.toFixed(2)}`
  return `$${dollars.toFixed(4)}`
}

function formatROI(multiple: number): string {
  if (multiple === 0) return '—'
  return `${multiple.toFixed(1)}x`
}

// ── Subcomponents ────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sublabel?: string
  icon: React.ReactNode
  accent?: string
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sublabel, icon, accent = colors.statusReview }) => (
  <div
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      padding: spacing['4'],
      minHeight: 96,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing['2'],
      boxShadow: shadows.card,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span
        style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: typography.letterSpacing.wider,
        }}
      >
        {label}
      </span>
      <span style={{ color: accent, display: 'flex' }}>{icon}</span>
    </div>
    <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
      {value}
    </span>
    {sublabel ? (
      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{sublabel}</span>
    ) : null}
  </div>
)

const ServiceBreakdown: React.FC<{ summary: AICostSummary }> = ({ summary }) => {
  const max = summary.byService[0]?.cost_cents ?? 0
  return (
    <div
      style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        padding: spacing['4'],
      }}
    >
      <h3
        style={{
          margin: 0,
          marginBottom: spacing['3'],
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
        }}
      >
        Cost by service
      </h3>
      {summary.byService.length === 0 ? (
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
          No AI calls recorded in this window.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {summary.byService.map((svc) => {
            const pct = max > 0 ? (svc.cost_cents / max) * 100 : 0
            return (
              <div key={svc.service}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: spacing['1'],
                    fontSize: typography.fontSize.sm,
                  }}
                >
                  <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                    {svc.service}
                  </span>
                  <span style={{ color: colors.textTertiary }}>
                    {formatCents(svc.cost_cents)} • {svc.calls} calls
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: borderRadius.full,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: colors.statusReview,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const TrendChart: React.FC<{ summary: AICostSummary }> = ({ summary }) => {
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>()
    for (const d of summary.daily) {
      if (!byDate.has(d.date)) byDate.set(d.date, { date_key: 0 })
      const row = byDate.get(d.date)!
      row[d.service] = (row[d.service] ?? 0) + d.cost_cents / 100
    }
    return Array.from(byDate.entries())
      .map(([date, services]) => ({ date, ...services }))
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
  }, [summary.daily])

  const services = useMemo(() => summary.byService.map((s) => s.service).slice(0, 6), [summary.byService])

  const lineColors = [
    colors.statusReview,
    colors.statusActive,
    colors.indigo,
    colors.statusPending,
    colors.statusNeutral,
    colors.statusReviewSubtle,
  ]

  return (
    <div
      style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        padding: spacing['4'],
      }}
    >
      <h3
        style={{
          margin: 0,
          marginBottom: spacing['3'],
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
        }}
      >
        Daily cost trend
      </h3>
      {chartData.length === 0 ? (
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
          No data in this window yet.
        </p>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={colors.borderSubtle} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.textTertiary }} />
              <YAxis tick={{ fontSize: 11, fill: colors.textTertiary }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={((value: number) => `$${value.toFixed(4)}`) as never} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {services.map((service, idx) => (
                <Line
                  key={service}
                  type="monotone"
                  dataKey={service}
                  stroke={lineColors[idx % lineColors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const ProjectCostTable: React.FC<{ summary: AICostSummary }> = ({ summary }) => (
  <div
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      padding: spacing['4'],
    }}
  >
    <h3
      style={{
        margin: 0,
        marginBottom: spacing['3'],
        fontSize: typography.fontSize.body,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
      }}
    >
      Cost per project
    </h3>
    {summary.byProject.length === 0 ? (
      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
        No project level spending recorded.
      </p>
    ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: colors.textTertiary, padding: spacing['2'] }}>Project</th>
            <th style={{ textAlign: 'right', color: colors.textTertiary, padding: spacing['2'] }}>Calls</th>
            <th style={{ textAlign: 'right', color: colors.textTertiary, padding: spacing['2'] }}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {summary.byProject.slice(0, 10).map((p) => (
            <tr key={p.project_id ?? 'global'} style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
              <td style={{ padding: spacing['2'], color: colors.textPrimary }}>
                {p.project_id ? p.project_id.slice(0, 8) : 'Global'}
              </td>
              <td style={{ padding: spacing['2'], color: colors.textTertiary, textAlign: 'right' }}>
                {p.calls}
              </td>
              <td
                style={{
                  padding: spacing['2'],
                  color: colors.textPrimary,
                  fontWeight: typography.fontWeight.semibold,
                  textAlign: 'right',
                }}
              >
                {formatCents(p.cost_cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
)

// ── Main component ───────────────────────────────────────

export interface AICostDashboardProps {
  projectId?: string | null
  sinceDays?: number
}

export const AICostDashboard: React.FC<AICostDashboardProps> = ({ projectId, sinceDays = 30 }) => {
  const { data, isLoading, isError, refetch } = useAICostTracking({ projectId, sinceDays })

  if (isLoading) {
    return (
      <div
        style={{
          padding: spacing['6'],
          textAlign: 'center',
          color: colors.textTertiary,
          fontSize: typography.fontSize.sm,
        }}
      >
        Loading AI cost data…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div
        style={{
          padding: spacing['6'],
          textAlign: 'center',
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <AlertTriangle size={20} color={colors.statusReview} style={{ marginBottom: spacing['2'] }} />
        <p style={{ color: colors.textPrimary, fontSize: typography.fontSize.sm, margin: 0 }}>
          Unable to load AI cost tracking data.
        </p>
        <button
          onClick={() => refetch()}
          style={{
            marginTop: spacing['3'],
            minHeight: 56,
            padding: `${spacing['2']} ${spacing['4']}`,
            backgroundColor: colors.statusReview,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.base,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (data.totalCalls === 0) {
    return (
      <div
        style={{
          padding: spacing['6'],
          textAlign: 'center',
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          border: `1px dashed ${colors.borderSubtle}`,
        }}
      >
        <p style={{ color: colors.textPrimary, fontSize: typography.fontSize.body, margin: 0 }}>
          No AI spending recorded yet.
        </p>
        <p
          style={{
            color: colors.textTertiary,
            fontSize: typography.fontSize.sm,
            marginTop: spacing['2'],
            marginBottom: 0,
          }}
        >
          Once the classification, edge detection, or copilot pipelines run, spend will appear here.
        </p>
      </div>
    )
  }

  const estimatedValueCents = Math.round(data.estimatedHoursSaved * data.hourlyRateCents)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: spacing['3'],
        }}
      >
        <StatCard
          label="Total spend"
          value={formatCents(data.totalCents)}
          sublabel={`${data.totalCalls} AI calls`}
          icon={<DollarSign size={16} />}
          accent={colors.statusReview}
        />
        <StatCard
          label="Hours saved"
          value={`${data.estimatedHoursSaved.toFixed(1)}h`}
          sublabel={`worth ${formatCents(estimatedValueCents)}`}
          icon={<Activity size={16} />}
          accent={colors.statusActive}
        />
        <StatCard
          label="ROI"
          value={formatROI(data.roiMultiple)}
          sublabel="estimated value per dollar"
          icon={<TrendingUp size={16} />}
          accent={colors.indigo}
        />
        <StatCard
          label="Services tracked"
          value={`${data.byService.length}`}
          sublabel={data.byService[0]?.service ?? ''}
          icon={<Activity size={16} />}
        />
      </div>

      <TrendChart summary={data} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: spacing['3'],
        }}
      >
        <ServiceBreakdown summary={data} />
        <ProjectCostTable summary={data} />
      </div>
    </div>
  )
}

export default AICostDashboard
