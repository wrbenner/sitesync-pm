import React, { useState } from 'react'
import { Briefcase, BarChart3, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjects } from '../hooks/queries/projects'
import { captureException } from '../lib/errorTracking'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'

// ── Currency formatter ───────────────────────────────────────
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ── Aggregate metrics hook ───────────────────────────────────
// Fetches counts from rfis, punch_items, tasks across all user-visible projects.
// Each query is RLS-scoped so only projects the user belongs to are counted.

interface PortfolioAggregates {
  openRfis: number
  openPunchItems: number
  openTasks: number
  overdueRfis: number
}

function usePortfolioAggregates(projectIds: string[]) {
  return useQuery({
    queryKey: ['portfolio_aggregates', projectIds.sort().join(',')],
    queryFn: async (): Promise<PortfolioAggregates> => {
      if (projectIds.length === 0) return { openRfis: 0, openPunchItems: 0, openTasks: 0, overdueRfis: 0 }

      const now = new Date().toISOString()
      const [rfiRes, punchRes, taskRes, overdueRes] = await Promise.all([
        supabase.from('rfis').select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .not('status', 'in', '("closed","answered")'),
        supabase.from('punch_items').select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .not('status', 'in', '("complete","closed")'),
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .not('status', 'in', '("completed","cancelled")'),
        supabase.from('rfis').select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .neq('status', 'closed')
          .lt('due_date', now),
      ])

      return {
        openRfis: rfiRes.count ?? 0,
        openPunchItems: punchRes.count ?? 0,
        openTasks: taskRes.count ?? 0,
        overdueRfis: overdueRes.count ?? 0,
      }
    },
    enabled: projectIds.length > 0,
    staleTime: 30_000,
  })
}

// ── Per-project quick metrics ────────────────────────────────
interface ProjectQuickMetrics {
  rfis: number
  punch: number
  tasks: number
}

function usePerProjectMetrics(projectIds: string[]) {
  return useQuery({
    queryKey: ['per_project_metrics', projectIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, ProjectQuickMetrics>> => {
      if (projectIds.length === 0) return {}

      const [rfiRes, punchRes, taskRes] = await Promise.all([
        supabase.from('rfis').select('project_id')
          .in('project_id', projectIds)
          .not('status', 'in', '("closed","answered")'),
        supabase.from('punch_items').select('project_id')
          .in('project_id', projectIds)
          .not('status', 'in', '("complete","closed")'),
        supabase.from('tasks').select('project_id')
          .in('project_id', projectIds)
          .not('status', 'in', '("completed","cancelled")'),
      ])

      const map: Record<string, ProjectQuickMetrics> = {}
      for (const id of projectIds) {
        map[id] = { rfis: 0, punch: 0, tasks: 0 }
      }

      for (const r of rfiRes.data ?? []) {
        if (map[r.project_id]) map[r.project_id].rfis++
      }
      for (const r of punchRes.data ?? []) {
        if (map[r.project_id]) map[r.project_id].punch++
      }
      for (const r of taskRes.data ?? []) {
        if (map[r.project_id]) map[r.project_id].tasks++
      }

      return map
    },
    enabled: projectIds.length > 0,
    staleTime: 30_000,
  })
}

// ── Column helpers ─────────────────────────────────────────
const projectCol = createColumnHelper<Record<string, unknown>>()

const statusBadge = (v: string) => {
  const statusColor = v === 'active' ? colors.statusActive
    : v === 'completed' ? colors.statusInfo
    : v === 'on_hold' ? colors.statusPending
    : colors.textTertiary
  const statusBg = v === 'active' ? colors.statusActiveSubtle
    : v === 'completed' ? colors.statusInfoSubtle
    : v === 'on_hold' ? colors.statusPendingSubtle
    : colors.surfaceInset
  return (
    <span style={{
      display: 'inline-block',
      padding: `2px 10px`,
      borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption,
      fontWeight: typography.fontWeight.medium,
      color: statusColor,
      backgroundColor: statusBg,
      textTransform: 'capitalize',
    }}>
      {(v || '').replace(/_/g, ' ')}
    </span>
  )
}

const projectColumns = [
  projectCol.accessor('name', {
    header: 'Project Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue() as string}
      </span>
    ),
  }),
  projectCol.accessor('contract_value', {
    header: 'Contract Value',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? fmtCurrency(info.getValue() as number) : 'N/A'}
      </span>
    ),
  }),
  projectCol.accessor('status', {
    header: 'Status',
    cell: (info) => statusBadge(info.getValue() as string),
  }),
  projectCol.accessor('city', {
    header: 'Location',
    cell: (info) => {
      const row = info.row.original
      const parts = [row.city, row.state].filter(Boolean)
      return <span style={{ color: colors.textSecondary }}>{parts.join(', ') || 'Not set'}</span>
    },
  }),
  projectCol.accessor('start_date', {
    header: 'Start',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : '—'}
      </span>
    ),
  }),
  projectCol.accessor('target_completion', {
    header: 'Target End',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : '—'}
      </span>
    ),
  }),
]

// ── Tabs ───────────────────────────────────────────────────
type TabKey = 'overview' | 'analytics'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Briefcase },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

// ── Error Fallback ──────────────────────────────────────────
const PortfolioErrorFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: spacing['3'],
    padding: spacing['4'],
    backgroundColor: colors.statusCriticalSubtle,
    borderRadius: borderRadius.base,
    marginBottom: spacing['6'],
  }}>
    <AlertTriangle size={20} color={colors.statusCritical} style={{ flexShrink: 0 }} />
    <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, flex: 1 }}>
      Portfolio data temporarily unavailable.
    </span>
    <button
      onClick={() => window.location.reload()}
      style={{
        padding: `${spacing['1']} ${spacing['3']}`,
        backgroundColor: 'transparent',
        border: `1px solid ${colors.statusCritical}`,
        borderRadius: borderRadius.base,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily,
        color: colors.statusCritical,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      Retry
    </button>
  </div>
)

// ── Main Component ──────────────────────────────────────────
export const Portfolio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const navigate = useNavigate()

  // Fetch ALL projects the user can access (RLS handles scoping)
  const { data: projects, isPending: loading } = useProjects()
  const allProjects = projects ?? []

  const projectIds = allProjects.map((p) => p.id)
  const { data: aggregates } = usePortfolioAggregates(projectIds)
  const { data: perProjectMetrics, isPending: metricsLoading } = usePerProjectMetrics(projectIds)

  const totalValue = allProjects.reduce((s, p) => s + ((p as Record<string, unknown>).contract_value as number || 0), 0)
  const activeCount = allProjects.filter((p) => p.status === 'active').length

  return (
    <PageContainer
      title="Portfolio Dashboard"
      subtitle="Aggregated view across all your projects"
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['6'], borderBottom: `1px solid ${colors.borderSubtle}`, paddingBottom: 0 }}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                paddingBottom: spacing['3'],
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
                color: isActive ? colors.orangeText : colors.textSecondary,
                fontSize: typography.fontSize.sm,
                fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
                transition: `color ${transitions.instant}, border-color ${transitions.instant}`,
                marginBottom: '-1px',
                minHeight: '44px',
              }}
            >
              {React.createElement(Icon, { size: 15 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* KPI Row */}
      <ErrorBoundary
        fallback={<PortfolioErrorFallback />}
        onError={(error) => captureException(error, { action: 'portfolio_metrics_error' })}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
          <MetricBox
            label="Total Contract Value"
            value={loading ? '...' : (totalValue > 0 ? fmtCurrency(totalValue) : '$0')}
          />
          <MetricBox
            label="Active Projects"
            value={loading ? '...' : String(activeCount)}
          />
          <MetricBox
            label="Open RFIs"
            value={aggregates ? String(aggregates.openRfis) : '...'}
            warning={aggregates && aggregates.overdueRfis > 0 ? `${aggregates.overdueRfis} overdue` : undefined}
          />
          <MetricBox
            label="Open Punch Items"
            value={aggregates ? String(aggregates.openPunchItems) : '...'}
          />
        </div>
      </ErrorBoundary>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          <SectionHeader title="Projects" />
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} width="100%" height="200px" />
              ))}
            </div>
          ) : allProjects.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: spacing['8'], color: colors.textTertiary }}>
                <Briefcase size={40} style={{ marginBottom: spacing['3'], opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: typography.fontSize.base }}>No projects yet.</p>
                <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.sm }}>Create a project to get started.</p>
              </div>
            </Card>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: allProjects.length === 1 ? '1fr' : allProjects.length === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: spacing['4'],
            }}>
              {allProjects.map((project) => {
                const p = project as Record<string, unknown>
                const status = (p.status as string) || ''
                const statusColor = status === 'active' ? colors.statusActive
                  : status === 'completed' ? colors.statusInfo
                  : status === 'on_hold' ? colors.statusPending
                  : colors.textTertiary
                const statusBgColor = status === 'active' ? colors.statusActiveSubtle
                  : status === 'completed' ? colors.statusInfoSubtle
                  : status === 'on_hold' ? colors.statusPendingSubtle
                  : colors.surfaceInset
                const metrics = perProjectMetrics?.[p.id as string]

                return (
                  <ErrorBoundary
                    key={p.id as string}
                    fallback={<Card><div style={{ padding: spacing['4'], textAlign: 'center', color: colors.textTertiary }}>
                      <AlertTriangle size={20} color={colors.statusCritical} /><br/>Project data could not be loaded.
                    </div></Card>}
                    onError={(error) => captureException(error, { projectId: p.id, action: 'project_card_error' })}
                  >
                    <Card>
                      <div style={{ padding: spacing['4'] }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
                          <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                            {p.name as string}
                          </h3>
                          <span style={{
                            display: 'inline-block',
                            padding: `2px 10px`,
                            borderRadius: borderRadius.full,
                            fontSize: typography.fontSize.caption,
                            fontWeight: typography.fontWeight.medium,
                            color: statusColor,
                            backgroundColor: statusBgColor,
                            textTransform: 'capitalize',
                            flexShrink: 0,
                          }}>
                            {status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginBottom: spacing['3'] }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Contract Value</span>
                            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>
                              {p.contract_value ? fmtCurrency(p.contract_value as number) : 'N/A'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Location</span>
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                              {[p.city, p.state].filter(Boolean).join(', ') || 'Not set'}
                            </span>
                          </div>
                          {p.start_date && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Timeline</span>
                              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                                {new Date(p.start_date as string).toLocaleDateString()}
                                {p.target_completion ? ` → ${new Date(p.target_completion as string).toLocaleDateString()}` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Quick Metrics */}
                        {metricsLoading ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['2'], marginBottom: spacing['3'] }}>
                            {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="40px" />)}
                          </div>
                        ) : metrics ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['2'], marginBottom: spacing['3'] }}>
                            <div style={{ textAlign: 'center', padding: `${spacing['2']} 0`, borderTop: `1px solid ${colors.borderSubtle}` }}>
                              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: '2px' }}>Open RFIs</div>
                              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: metrics.rfis > 0 ? colors.statusPending : colors.textPrimary }}>
                                {metrics.rfis}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: `${spacing['2']} 0`, borderTop: `1px solid ${colors.borderSubtle}` }}>
                              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: '2px' }}>Punch Items</div>
                              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: metrics.punch > 0 ? colors.statusCritical : colors.textPrimary }}>
                                {metrics.punch}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: `${spacing['2']} 0`, borderTop: `1px solid ${colors.borderSubtle}` }}>
                              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: '2px' }}>Open Tasks</div>
                              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                                {metrics.tasks}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* View Project Button */}
                        <Btn
                          variant="ghost"
                          size="sm"
                          fullWidth
                          onClick={() => {
                            // Store the selected project id and navigate
                            window.localStorage.setItem('lastProjectId', p.id as string)
                            navigate('/dashboard')
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                            View Project <ArrowRight size={14} />
                          </span>
                        </Btn>
                      </div>
                    </Card>
                  </ErrorBoundary>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'analytics' && (
        <>
          <SectionHeader title="Comparative Project Metrics" />
          <Card>
            <DataTable
              data={allProjects as unknown as Record<string, unknown>[]}
              columns={projectColumns}
              loading={loading}
              enableSorting
              enableGlobalFilter
              emptyMessage="No projects to display."
            />
          </Card>

          {/* Summary Cards */}
          {!loading && allProjects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginTop: spacing['4'] }}>
              <Card>
                <div style={{ padding: spacing['4'] }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Open Tasks
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
                    {aggregates?.openTasks ?? '—'}
                  </div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>
                    Across {allProjects.length} project{allProjects.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </Card>
              <Card>
                <div style={{ padding: spacing['4'] }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Overdue RFIs
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: typography.fontWeight.bold, color: (aggregates?.overdueRfis ?? 0) > 0 ? colors.statusCritical : colors.statusActive }}>
                    {aggregates?.overdueRfis ?? '—'}
                  </div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>
                    {(aggregates?.overdueRfis ?? 0) === 0 ? 'All RFIs on track' : 'Need attention'}
                  </div>
                </div>
              </Card>
              <Card>
                <div style={{ padding: spacing['4'] }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Avg. Contract Value
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: typography.fontWeight.bold, color: colors.orangeText }}>
                    {allProjects.length > 0 ? fmtCurrency(totalValue / allProjects.length) : '$0'}
                  </div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>
                    Total: {fmtCurrency(totalValue)}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </PageContainer>
  )
}

export default Portfolio
