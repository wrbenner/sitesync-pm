import React, { useState, useEffect } from 'react'
import { Briefcase, Plus, FileText, BarChart3, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { usePortfolios, usePortfolioProjects, useExecutiveReports, useOrgPortfolioMetrics } from '../hooks/queries'
import { usePortfolioMetrics } from '../hooks/useProjectMetrics'
import { captureException } from '../lib/errorTracking'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

// ── Column helpers ─────────────────────────────────────────

const projectCol = createColumnHelper<unknown>()
const projectColumns = [
  projectCol.accessor('name', {
    header: 'Project Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  projectCol.accessor('contract_value', {
    header: 'Contract Value',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? fmtCurrency(info.getValue()) : 'N/A'}
      </span>
    ),
  }),
  projectCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
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
    },
  }),
  projectCol.accessor('city', {
    header: 'City',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  projectCol.accessor('start_date', {
    header: 'Start Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  projectCol.accessor('target_completion', {
    header: 'Target Completion',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
]

const reportCol = createColumnHelper<unknown>()
const reportColumns = [
  reportCol.accessor('report_type', {
    header: 'Type',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, textTransform: 'capitalize' }}>
        {(info.getValue() || '').replace(/_/g, ' ')}
      </span>
    ),
  }),
  reportCol.accessor('period_start', {
    header: 'Period Start',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  reportCol.accessor('period_end', {
    header: 'Period End',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  reportCol.accessor('created_at', {
    header: 'Created',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
]

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ── Tabs ───────────────────────────────────────────────────

type TabKey = 'overview' | 'analytics' | 'reports'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Briefcase },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'reports', label: 'Reports', icon: FileText },
]

// ── Error Fallbacks ────────────────────────────────────────

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
      Portfolio data temporarily unavailable. Some projects may have sync issues.
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

interface ProjectCardErrorProps {
  projectId: string
}

const ProjectCardError: React.FC<ProjectCardErrorProps> = () => (
  <Card>
    <div style={{
      padding: spacing['4'],
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['2'],
      minHeight: '160px',
    }}>
      <AlertTriangle size={20} color={colors.statusCritical} />
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center' }}>
        Project data could not be loaded.
      </span>
    </div>
  </Card>
)

// ── Portfolio Metrics Section ──────────────────────────────
// Rendered inside an ErrorBoundary so a total metrics failure shows
// a targeted error state rather than crashing the whole page.

interface PortfolioMetricsSectionProps {
  totalValue: number
  activeCount: number
  currentPortfolioName: string
  latestReportLabel: string
  loading: boolean
  orgId: string | undefined
}

const PortfolioMetricsSection: React.FC<PortfolioMetricsSectionProps> = ({
  totalValue,
  activeCount,


  loading,
  orgId,
}) => {
  const { data: orgMetrics } = useOrgPortfolioMetrics(orgId ?? '')
  const warnings = orgMetrics?.warnings ?? []

  const rfiWarning = warnings.find((w) => w.includes('RFI'))
  const punchWarning = warnings.find((w) => w.includes('Punch'))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
      <MetricBox
        label="Total Contract Value"
        value={loading ? '...' : fmtCurrency(totalValue)}
      />
      <MetricBox
        label="Active Projects"
        value={loading ? '...' : String(activeCount)}
      />
      <MetricBox
        label="Open RFIs"
        value={orgMetrics === undefined ? '...' : (orgMetrics.open_rfis !== undefined ? String(orgMetrics.open_rfis) : 'N/A')}
        warning={rfiWarning}
      />
      <MetricBox
        label="Open Punch Items"
        value={orgMetrics === undefined ? '...' : (orgMetrics.open_punch_items !== undefined ? String(orgMetrics.open_punch_items) : 'N/A')}
        warning={punchWarning}
      />
    </div>
  )
}

// ── Component ──────────────────────────────────────────────

export const Portfolio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const orgId = useAuthStore((s) => s.profile?.organization_id) || undefined
  const queryClient = useQueryClient()

  const { data: portfolios } = usePortfolios(orgId ?? '')
  const portfolioId = (portfolios && portfolios[0]?.id) as string | undefined
  const { data: portfolioProjects, isPending: loading } = usePortfolioProjects(portfolioId ?? '')
  const { data: reports } = useExecutiveReports(portfolioId ?? '')

  useEffect(() => {
    if (!portfolioId) return
    const channel = supabase
      .channel(`portfolio-${portfolioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['portfolio_projects', portfolioId] })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [portfolioId, queryClient])

  const projects = (portfolioProjects || []).map((pp: unknown) => pp.projects).filter(Boolean)

  const projectIds: string[] = projects.map((p: unknown) => p.id as string)
  const { metricsMap, isLoading: metricsLoading } = usePortfolioMetrics(projectIds)

  const totalValue = projects.reduce((s: number, p: unknown) => s + (p.contract_value || 0), 0)
  const activeCount = projects.filter((p: unknown) => p.status === 'active').length
  const currentPortfolio = (portfolios || []).find((p: unknown) => p.id === portfolioId)
  const latestReport = (reports || [])[0]

  return (
    <PageContainer
      title="Portfolio Dashboard"
      subtitle="Aggregated view across all projects in your portfolio"
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          {portfolios && portfolios.length > 1 && (
            <select
              style={{
                padding: `${spacing['2']} ${spacing['3']}`,
                borderRadius: borderRadius.base,
                border: `1px solid ${colors.borderDefault}`,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                color: colors.textPrimary,
                backgroundColor: colors.surfaceRaised,
                cursor: 'pointer',
              }}
              value={portfolioId}
              onChange={() => {}}
            >
              {portfolios.map((p: unknown) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      }
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
              }}
            >
              {React.createElement(Icon, { size: 15 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* KPI Row — wrapped in ErrorBoundary so a total metrics failure shows a targeted error state */}
      <ErrorBoundary
        fallback={<PortfolioErrorFallback />}
        onError={(error) => captureException(error, { action: 'portfolio_metrics_error' })}
      >
        <PortfolioMetricsSection
          totalValue={totalValue}
          activeCount={activeCount}
          currentPortfolioName={currentPortfolio?.name || 'Default'}
          latestReportLabel={latestReport ? (latestReport.type || 'Available') : 'None'}
          loading={loading}
          orgId={orgId}
        />
      </ErrorBoundary>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          <SectionHeader title="Projects" />
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} width="100%" height="180px" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: spacing['8'], color: colors.textTertiary }}>
                <Briefcase size={40} style={{ marginBottom: spacing['3'], opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: typography.fontSize.base }}>No projects in this portfolio yet.</p>
                <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.sm }}>Add projects to see aggregated data here.</p>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: projects.length === 1 ? '1fr' : projects.length === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: spacing['4'] }}>
              {projects.map((project: unknown) => {
                const statusColor = project.status === 'active' ? colors.statusActive
                  : project.status === 'completed' ? colors.statusInfo
                  : project.status === 'on_hold' ? colors.statusPending
                  : colors.textTertiary
                const statusBg = project.status === 'active' ? colors.statusActiveSubtle
                  : project.status === 'completed' ? colors.statusInfoSubtle
                  : project.status === 'on_hold' ? colors.statusPendingSubtle
                  : colors.surfaceInset
                return (
                  <ErrorBoundary
                    key={project.id}
                    fallback={<ProjectCardError projectId={project.id} />}
                    onError={(error) => captureException(error, { projectId: project.id, action: 'project_card_error' })}
                  >
                  <Card key={project.id}>
                    <div style={{ padding: spacing['4'] }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
                        <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                          {project.name}
                        </h3>
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
                          {(project.status || '').replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginBottom: spacing['4'] }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Contract Value</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>
                            {project.contract_value ? fmtCurrency(project.contract_value) : 'N/A'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Location</span>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                            {[project.city, project.state].filter(Boolean).join(', ') || 'Not set'}
                          </span>
                        </div>
                        {project.start_date && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Start Date</span>
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                              {new Date(project.start_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {project.target_completion && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Target Completion</span>
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                              {new Date(project.target_completion).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Metrics row — single bulk fetch, not per-project */}
                      {metricsLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['2'], marginBottom: spacing['4'] }}>
                          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="40px" />)}
                        </div>
                      ) : metricsMap[project.id] ? (() => {
                        const m = metricsMap[project.id]
                        const budgetVariancePct = m.budget_total > 0
                          ? ((m.budget_spent - m.budget_total) / m.budget_total) * 100
                          : null
                        const healthColor = (m.aiHealthScore ?? 0) >= 75 ? colors.statusActive
                          : (m.aiHealthScore ?? 0) >= 50 ? colors.statusPending
                          : colors.statusCritical
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['2'], marginBottom: spacing['4'] }}>
                            <div style={{ textAlign: 'center', padding: `${spacing['2']} 0`, borderTop: `1px solid ${colors.borderSubtle}` }}>
                              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: '2px' }}>Health</div>
                              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: healthColor }}>
                                {m.aiHealthScore != null ? `${Math.round(m.aiHealthScore)}` : 'N/A'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: `${spacing['2']} 0`, borderTop: `1px solid ${colors.borderSubtle}` }}>
                              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: '2px' }}>Budget Var.</div>
                              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: budgetVariancePct != null && budgetVariancePct > 5 ? colors.statusCritical : colors.textPrimary }}>
                                {budgetVariancePct != null ? `${budgetVariancePct > 0 ? '+' : ''}${budgetVariancePct.toFixed(1)}%` : 'N/A'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: `${spacing['2']} 0`, borderTop: `1px solid ${colors.borderSubtle}` }}>
                              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: '2px' }}>Open RFIs</div>
                              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: m.rfis_open > 0 ? colors.statusPending : colors.textPrimary }}>
                                {m.rfis_open}
                              </div>
                            </div>
                          </div>
                        )
                      })() : null}

                      <Btn
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => { window.location.hash = '#/dashboard' }}
                      >View Project</Btn>
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
              data={projects}
              columns={projectColumns}
              loading={loading}
              enableSorting
              enableGlobalFilter
              emptyMessage="No projects in this portfolio."
            />
          </Card>
        </>
      )}

      {activeTab === 'reports' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
            <SectionHeader title="Executive Reports" />
            <Btn
              icon={<Plus size={15} />}
              onClick={() => { toast.success('Report generation started. This may take a moment.') }}
            >Generate Report</Btn>
          </div>

          <Card>
            <DataTable
              data={reports || []}
              columns={reportColumns}
              loading={!reports}
              enableSorting
              emptyMessage="No executive reports yet."
            />
          </Card>

          {latestReport && latestReport.ai_narrative && (
            <div style={{ marginTop: spacing['4'] }}>
              <SectionHeader title="Latest AI Narrative" />
              <Card>
                <div style={{ padding: spacing['4'] }}>
                  <p style={{
                    margin: 0,
                    fontSize: typography.fontSize.sm,
                    lineHeight: 1.6,
                    color: colors.textSecondary,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {latestReport.ai_narrative}
                  </p>
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
