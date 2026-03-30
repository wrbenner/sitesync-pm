import React, { useState } from 'react'
import { Briefcase, Plus, FileText, BarChart3 } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { usePortfolios, usePortfolioProjects, useExecutiveReports } from '../hooks/queries'
import { toast } from 'sonner'

// ── Column helpers ─────────────────────────────────────────

const projectCol = createColumnHelper<any>()
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

const reportCol = createColumnHelper<any>()
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

// ── Component ──────────────────────────────────────────────

export const Portfolio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const portfolioId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  const { data: portfolios } = usePortfolios('11111111-1111-1111-1111-111111111111')
  const { data: portfolioProjects, isPending: loading } = usePortfolioProjects(portfolioId)
  const { data: reports } = useExecutiveReports(portfolioId)

  const projects = (portfolioProjects || []).map((pp: any) => pp.projects).filter(Boolean)

  const totalValue = projects.reduce((s: number, p: any) => s + (p.contract_value || 0), 0)
  const activeCount = projects.filter((p: any) => p.status === 'active').length
  const currentPortfolio = (portfolios || []).find((p: any) => p.id === portfolioId)
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
              {portfolios.map((p: any) => (
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
                color: isActive ? colors.primaryOrange : colors.textSecondary,
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

      {/* KPI Row */}
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
          label="Portfolio"
          value={loading ? '...' : (currentPortfolio?.name || 'Default')}
        />
        <MetricBox
          label="Latest Report"
          value={latestReport ? (latestReport.type || 'Available') : 'None'}
        />
      </div>

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
              {projects.map((project: any) => {
                const statusColor = project.status === 'active' ? colors.statusActive
                  : project.status === 'completed' ? colors.statusInfo
                  : project.status === 'on_hold' ? colors.statusPending
                  : colors.textTertiary
                const statusBg = project.status === 'active' ? colors.statusActiveSubtle
                  : project.status === 'completed' ? colors.statusInfoSubtle
                  : project.status === 'on_hold' ? colors.statusPendingSubtle
                  : colors.surfaceInset
                return (
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
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange }}>
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

                      <Btn
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => { window.location.hash = '#/dashboard' }}
                      >View Project</Btn>
                    </div>
                  </Card>
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

          {latestReport && (latestReport as any).ai_narrative && (
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
                    {(latestReport as any).ai_narrative}
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
