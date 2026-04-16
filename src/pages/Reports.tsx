import React, { useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Play, Calendar, Download, BarChart3, DollarSign, HardHat, ClipboardList, Shield, Users, Wrench, CalendarDays, Sparkles } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, TabBar, Skeleton, Tag } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, colorVars } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useCustomReports, useReportRuns } from '../hooks/queries'
import { REPORT_TYPES, type ReportType } from '../hooks/useReportData'
import { toast } from 'sonner'

const ExportCenter = lazy(() => import('../components/export/ExportCenter').then((m) => ({ default: m.ExportCenter })))

// ── Report Category Icons ───────────────────────────────

const reportIcons: Record<string, React.ReactNode> = {
  owner_report: <Sparkles size={18} />,
  executive_summary: <BarChart3 size={18} />,
  monthly_progress: <CalendarDays size={18} />,
  cost_report: <DollarSign size={18} />,
  schedule_report: <Calendar size={18} />,
  subcontractor_performance: <Users size={18} />,
  rfi_log: <ClipboardList size={18} />,
  submittal_log: <FileText size={18} />,
  punch_list: <Wrench size={18} />,
  daily_log_summary: <HardHat size={18} />,
  safety_report: <Shield size={18} />,
  budget_report: <DollarSign size={18} />,
}

const reportCategories: Record<string, string> = {
  owner_report: 'AI Powered',
  executive_summary: 'Overview',
  monthly_progress: 'Overview',
  cost_report: 'Financial',
  schedule_report: 'Schedule',
  subcontractor_performance: 'People',
  rfi_log: 'Documents',
  submittal_log: 'Documents',
  punch_list: 'Quality',
  daily_log_summary: 'Field',
  safety_report: 'Safety',
  budget_report: 'Financial',
}

// ── Helpers ─────────────────────────────────────────────

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type TabId = 'standard' | 'history'

const TABS = [
  { id: 'standard' as const, label: 'Standard Reports' },
  { id: 'history' as const, label: 'Run History' },
]

// ── Main Component ──────────────────────────────────────

export const Reports: React.FC = () => {
  const projectId = useProjectId()
  const navigate = useNavigate()
  const { data: customReports } = useCustomReports(projectId)
  const { data: recentRuns, isLoading: runsLoading } = useReportRuns(projectId)

  const [activeTab, setActiveTab] = useState<TabId>('standard')
  const [exportOpen, setExportOpen] = useState(false)

  // Metrics
  const totalReports = REPORT_TYPES.length + (customReports?.length ?? 0)
  const scheduledCount = customReports?.filter((r: Record<string, unknown>) => r.schedule != null).length ?? 0
  const recentRunCount = recentRuns?.length ?? 0

  const handleRunReport = (type: ReportType) => {
    if (type === 'owner_report') {
      navigate('/reports/owner')
      return
    }
    setSelectedType(type)
    setExportOpen(true)
  }

  return (
    <PageContainer
      title="Reports"
      subtitle="Generate, schedule, and export construction reports"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <Btn variant="primary" icon={<Download size={16} />} onClick={() => setExportOpen(true)}>
            Export Report
          </Btn>
        </div>
      }
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['5'] }}>
        <MetricBox label="Available Reports" value={totalReports} />
        <MetricBox label="Scheduled" value={scheduledCount} />
        <MetricBox label="Recent Runs" value={recentRunCount} />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: spacing['5'] }}>
        <TabBar
          tabs={TABS}
          activeId={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />
      </div>

      {/* Standard Reports Gallery */}
      {activeTab === 'standard' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing['4'] }}>
          {REPORT_TYPES.map((report) => {
            const isOwner = report.type === 'owner_report'
            return (
              <Card
                key={report.type}
                padding={spacing['5']}
              >
                {isOwner && (
                  <div style={{
                    margin: `-${spacing['5']}`,
                    marginBottom: spacing['4'],
                    padding: `${spacing['2']} ${spacing['5']}`,
                    background: `linear-gradient(135deg, ${colors.primaryOrange}, #FF9C42)`,
                    borderRadius: `${borderRadius.lg} ${borderRadius.lg} 0 0`,
                  }}>
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.white,
                      letterSpacing: typography.letterSpacing.wider,
                      textTransform: 'uppercase',
                    }}>
                      Recommended for OAC Meetings
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: borderRadius.md,
                    backgroundColor: isOwner ? colors.primaryOrange : colors.orangeSubtle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isOwner ? colors.white : colors.orangeText,
                  }}>
                    {reportIcons[report.type] ?? <FileText size={18} />}
                  </div>
                  <Tag
                    label={reportCategories[report.type] ?? 'General'}
                    color={isOwner ? colors.primaryOrange : undefined}
                    backgroundColor={isOwner ? colors.orangeSubtle : undefined}
                  />
                </div>

                <h3 style={{
                  fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                  color: colorVars.textPrimary, margin: 0, marginBottom: spacing['1'],
                }}>
                  {report.label}
                </h3>
                <p style={{
                  fontSize: typography.fontSize.sm, color: colorVars.textTertiary,
                  margin: 0, marginBottom: spacing['2'], lineHeight: '1.5',
                }}>
                  {report.description}
                </p>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  fontSize: typography.fontSize.caption, color: colorVars.textTertiary,
                  marginBottom: spacing['3'],
                }}>
                  <FileText size={11} /> {report.estimatedPages} pages
                </div>

                <div style={{ display: 'flex', gap: spacing['2'] }}>
                  <Btn
                    variant="primary" size="sm"
                    icon={isOwner ? <Sparkles size={14} /> : <Play size={14} />}
                    onClick={() => handleRunReport(report.type)}
                  >
                    {isOwner ? 'Open Report' : 'Generate'}
                  </Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Run History */}
      {activeTab === 'history' && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Recent Report Runs" />

          {runsLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="56px" />)}
            </div>
          )}

          {!runsLoading && (!recentRuns || recentRuns.length === 0) && (
            <div style={{ textAlign: 'center', padding: spacing['8'], color: colorVars.textTertiary }}>
              <FileText size={32} style={{ marginBottom: spacing['3'], opacity: 0.3 }} />
              <p style={{ fontSize: typography.fontSize.body, margin: 0, marginBottom: spacing['1'] }}>No reports generated yet</p>
              <p style={{ fontSize: typography.fontSize.sm, margin: 0 }}>Run a report from the Standard Reports tab to get started</p>
            </div>
          )}

          {recentRuns && recentRuns.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
              {recentRuns.map((run: Record<string, unknown>) => {
                const statusColor = run.status === 'completed' ? colors.statusActive
                  : run.status === 'generating' ? colors.statusInfo
                  : run.status === 'failed' ? colors.statusCritical
                  : colors.textTertiary
                const reportConfig = REPORT_TYPES.find((r) => r.type === run.report_type)

                return (
                  <div
                    key={run.id as string}
                    style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      padding: spacing['3'], backgroundColor: colorVars.surfaceInset,
                      borderRadius: borderRadius.md,
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                          color: colorVars.textPrimary,
                        }}>
                          {reportConfig?.label ?? (run.report_type as string)}
                        </span>
                        <span style={{ fontSize: typography.fontSize.caption, color: colorVars.textTertiary }}>
                          {formatTimeAgo(run.generated_at as string)}
                        </span>
                      </div>
                      <div style={{ fontSize: typography.fontSize.caption, color: colorVars.textTertiary, marginTop: '2px' }}>
                        {(run.format as string).toUpperCase()} · {(run.status as string)}
                      </div>
                    </div>
                    {run.status === 'completed' && (
                      <Btn variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => toast.info('Download from Storage')}>
                        Download
                      </Btn>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* Export Center Modal */}
      <Suspense fallback={null}>
        {exportOpen && <ExportCenter open={exportOpen} onClose={() => { setExportOpen(false); setSelectedType(null); }} />}
      </Suspense>
    </PageContainer>
  )
}

export default Reports
