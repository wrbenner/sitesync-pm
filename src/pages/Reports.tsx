import React, { useState, useCallback, lazy, Suspense } from 'react'
import { useIsMobile } from '../hooks/useWindowSize'
import { useNavigate } from 'react-router-dom'
import { FileText, Play, Calendar, Download, BarChart3, DollarSign, HardHat, ClipboardList, Shield, Users, Wrench, CalendarDays, Sparkles, Loader2 } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, TabBar, Skeleton, Tag } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, colorVars } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useCustomReports, useReportRuns } from '../hooks/queries'
import { REPORT_TYPES, type ReportType } from '../hooks/useReportData'
import { supabase } from '../lib/supabase'
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
  const isMobile = useIsMobile()
  const { data: customReports } = useCustomReports(projectId)
  const { data: recentRuns, isLoading: runsLoading } = useReportRuns(projectId)

  const [activeTab, setActiveTab] = useState<TabId>('standard')
  const [exportOpen, setExportOpen] = useState(false)
  const [, setSelectedType] = useState<string | null>(null)
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null)

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

  const handleDownloadRun = useCallback(async (run: Record<string, unknown>) => {
    const runId = run.id as string
    setDownloadingRunId(runId)

    try {
      const storagePath = run.storage_path as string | null
      if (storagePath) {
        // Download from Supabase storage
        const { data, error } = await supabase.storage
          .from('reports')
          .download(storagePath)
        if (error) throw error

        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url
        const fileName = storagePath.split('/').pop() || `report_${runId}.pdf`
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Report downloaded')
      } else {
        // Generate a simple summary PDF on the fly using pdf-lib
        const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
        const pdfDoc = await PDFDocument.create()
        const page = pdfDoc.addPage([612, 792])
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

        const reportConfig = REPORT_TYPES.find((r) => r.type === run.report_type)
        const reportLabel = reportConfig?.label ?? (run.report_type as string)
        const format = ((run.format as string) || 'pdf').toUpperCase()
        const status = (run.status as string) || 'completed'
        const generatedAt = run.generated_at
          ? new Date(run.generated_at as string).toLocaleString()
          : 'N/A'

        let y = 720
        page.drawText('SiteSync PM - Report', { x: 50, y, font: fontBold, size: 20, color: rgb(0.96, 0.47, 0.13) })
        y -= 30
        page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) })
        y -= 30

        const rows: Array<[string, string]> = [
          ['Report Type:', reportLabel],
          ['Format:', format],
          ['Status:', status],
          ['Generated:', generatedAt],
          ['Run ID:', runId],
        ]

        for (const [label, value] of rows) {
          page.drawText(label, { x: 50, y, font: fontBold, size: 11, color: rgb(0.3, 0.3, 0.3) })
          page.drawText(value, { x: 170, y, font: fontReg, size: 11, color: rgb(0.1, 0.1, 0.1) })
          y -= 22
        }

        y -= 20
        page.drawText(
          'This report was generated by SiteSync PM. For full report content, run a new',
          { x: 50, y, font: fontReg, size: 10, color: rgb(0.5, 0.5, 0.5) },
        )
        y -= 14
        page.drawText(
          'report from the Standard Reports tab using the Export Center.',
          { x: 50, y, font: fontReg, size: 10, color: rgb(0.5, 0.5, 0.5) },
        )

        // Footer
        page.drawText(
          `Generated by SiteSync PM on ${new Date().toLocaleDateString()}`,
          { x: 50, y: 30, font: fontReg, size: 8, color: rgb(0.6, 0.6, 0.6) },
        )

        const pdfBytes = await pdfDoc.save()
        const blob = new Blob([pdfBytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `SiteSync_${reportLabel.replace(/\s+/g, '_')}_${(run.generated_at as string)?.slice(0, 10) || 'report'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Report PDF generated and downloaded')
      }
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('Failed to download report')
    } finally {
      setDownloadingRunId(null)
    }
  }, [])

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

      {/* Owner Portal featured card */}
      <div
        onClick={() => navigate('/reports/owner')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/reports/owner') }}
        style={{
          background: `linear-gradient(135deg, ${colors.primaryOrange}, #FF9C42)`,
          borderRadius: borderRadius.lg,
          padding: spacing['5'],
          // Add bottom padding on mobile so the AI sparkle FAB
          // (fixed bottom-right at zIndex.popover) doesn't crash into
          // the Open Portal CTA when this card is at the bottom of the
          // viewport.
          marginBottom: isMobile ? spacing['8'] : spacing['5'],
          cursor: 'pointer',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: spacing['4'],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
          <div style={{
            width: 48, height: 48, borderRadius: borderRadius.md,
            backgroundColor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: colors.white, flexShrink: 0,
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: colors.white, letterSpacing: typography.letterSpacing.wider,
              textTransform: 'uppercase', opacity: 0.9, marginBottom: spacing['1'],
            }}>
              Owner Portal
            </div>
            <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.white, marginBottom: spacing['1'] }}>
              Interactive Owner Report
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.9)' }}>
              Progress ring, milestone timeline, owner updates — everything the owner needs in one place.
            </div>
          </div>
        </div>
        <Btn variant="secondary" size="sm" icon={<Sparkles size={14} />} onClick={() => navigate('/reports/owner')}>
          Open Portal
        </Btn>
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
                      <Btn
                        variant="ghost"
                        size="sm"
                        icon={downloadingRunId === (run.id as string) ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                        disabled={downloadingRunId === (run.id as string)}
                        onClick={() => handleDownloadRun(run)}
                      >
                        {downloadingRunId === (run.id as string) ? 'Downloading...' : 'Download'}
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
