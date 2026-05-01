import React, { useCallback, useMemo, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Play, Calendar, Download, BarChart3, DollarSign, HardHat,
  ClipboardList, Shield, Users, Wrench, CalendarDays, Sparkles, Loader2, Plus,
} from 'lucide-react'
import { toast } from 'sonner'

import { colors, spacing, typography, borderRadius, colorVars } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useCustomReports, useReportRuns } from '../hooks/queries'
import { REPORT_TYPES, type ReportType } from '../hooks/useReportData'
import { useActionStream } from '../hooks/useActionStream'
import { useProjectContext } from '../stores/projectContextStore'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

import { OwnerUpdateGenerator } from '../components/reports/OwnerUpdateGenerator'
import { OwnerLinkButton } from '../components/reports/OwnerLinkButton'
import type {
  OwnerUpdateRisk,
  OwnerUpdateDecision,
  ProjectContextSnapshot,
} from '../services/iris/types'

const ExportCenter = lazy(() =>
  import('../components/export/ExportCenter').then((m) => ({ default: m.ExportCenter })),
)

// ── Report category metadata ────────────────────────────────────────────────

const reportIcons: Record<string, React.ReactNode> = {
  owner_report: <Sparkles size={16} />,
  executive_summary: <BarChart3 size={16} />,
  monthly_progress: <CalendarDays size={16} />,
  cost_report: <DollarSign size={16} />,
  schedule_report: <Calendar size={16} />,
  subcontractor_performance: <Users size={16} />,
  rfi_log: <ClipboardList size={16} />,
  submittal_log: <FileText size={16} />,
  punch_list: <Wrench size={16} />,
  daily_log_summary: <HardHat size={16} />,
  safety_report: <Shield size={16} />,
  budget_report: <DollarSign size={16} />,
}

const reportCategories: Record<string, string> = {
  owner_report: 'AI',
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type ViewId = 'recent' | 'templates'

const VIEW_TABS: Array<{ id: ViewId; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'templates', label: 'Templates' },
]

// ── Owner-update context assembler ──────────────────────────────────────────
//
// Pulls the most readily-available signals for the Iris owner-update template.
// Sections we don't have wiring for (schedule status, budget status, lookahead,
// progress) are intentionally left undefined — the template renders
// "No material change" rather than inventing.

function useOwnerUpdateContext(): ProjectContextSnapshot {
  const { activeProject } = useProjectContext()
  const { user } = useAuth()
  // Action stream feeds risks + decisions from one place. PM lens — that's
  // who's filing the owner update.
  const stream = useActionStream('pm')

  return useMemo<ProjectContextSnapshot>(() => {
    const firstName = (user?.user_metadata?.first_name as string | undefined) ?? null
    const userName = firstName
      ?? (user?.email ? user.email.split('@')[0] : null)

    const topRisks: OwnerUpdateRisk[] = (stream.items ?? [])
      .filter((i) => i.cardType === 'risk')
      .slice(0, 3)
      .map((i) => ({
        title: i.title,
        summary: i.reason,
        sourceLabel: `Risk: ${i.type} ${i.id}`,
      }))

    const decisionsNeeded: OwnerUpdateDecision[] = (stream.items ?? [])
      .filter((i) => i.cardType === 'decision')
      .slice(0, 5)
      .map((i) => ({
        title: i.title,
        summary: i.reason,
        sourceLabel: `Decision: ${i.type} ${i.id}`,
      }))

    return {
      projectId: activeProject?.id ?? null,
      projectName: activeProject?.name ?? null,
      userName,
      reportingPeriodDays: 7,
      // Schedule / budget / progress / lookahead intentionally absent —
      // the template fills them with "No material change" until a future
      // pass wires real schedule/budget signals.
      topRisks: topRisks.length > 0 ? topRisks : undefined,
      decisionsNeeded: decisionsNeeded.length > 0 ? decisionsNeeded : undefined,
    }
  }, [activeProject, user, stream.items])
}

// ── Main component ──────────────────────────────────────────────────────────

export const Reports: React.FC = () => {
  const projectId = useProjectId()
  const navigate = useNavigate()
  const { data: customReports } = useCustomReports(projectId)
  const { data: recentRuns, isLoading: runsLoading } = useReportRuns(projectId)
  const ownerUpdateContext = useOwnerUpdateContext()

  const [view, setView] = useState<ViewId>('recent')
  const [exportOpen, setExportOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ReportType | null>(null)
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null)

  const totalReports = REPORT_TYPES.length + (customReports?.length ?? 0)

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
        const { data, error } = await supabase.storage.from('reports').download(storagePath)
        if (error) throw error
        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url
        a.download = storagePath.split('/').pop() || `report_${runId}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Report downloaded')
      } else {
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
        page.drawText('SiteSync PM — Report', { x: 50, y, font: fontBold, size: 20, color: rgb(0.96, 0.47, 0.13) })
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
        const pdfBytes = await pdfDoc.save()
        // pdf-lib returns Uint8Array<ArrayBufferLike>; Blob wants a plain
        // ArrayBuffer slice, which we get via .buffer + slice over byteOffset/length.
        const blob = new Blob(
          [pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer],
          { type: 'application/pdf' },
        )
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `SiteSync_${reportLabel.replace(/\s+/g, '_')}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Report PDF generated')
      }
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('Failed to download report')
    } finally {
      setDownloadingRunId(null)
    }
  }, [])

  return (
    <div
      role="region"
      aria-label="Reports"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.surfacePage,
        overflow: 'hidden',
      }}
    >
      {/* ── Sticky page header ──────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          backgroundColor: colors.surfacePage,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          padding: `${spacing['4']} ${spacing['6']}`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing['4'],
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            fontFamily: typography.fontFamily,
            color: colors.textPrimary,
            letterSpacing: '-0.005em',
          }}
        >
          Reports
        </h1>
        <span
          style={{
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {totalReports} templates
        </span>

        {/* View toggle */}
        <div
          role="tablist"
          aria-label="Reports view"
          style={{
            marginLeft: spacing['4'],
            display: 'inline-flex',
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.md,
            overflow: 'hidden',
          }}
        >
          {VIEW_TABS.map((t) => {
            const active = view === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setView(t.id)}
                style={{
                  padding: '6px 14px',
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  fontWeight: active ? 600 : 500,
                  color: active ? colors.textPrimary : colors.textSecondary,
                  backgroundColor: active ? colors.surfaceInset : 'transparent',
                  border: 'none',
                  borderRight: t.id === VIEW_TABS[0].id ? `1px solid ${colors.borderSubtle}` : 'none',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => setExportOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} strokeWidth={2.5} />
          New Report
        </button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: spacing['6'],
        }}
      >
        {/* Demo finale — Iris Owner Update */}
        <OwnerUpdateGenerator
          context={ownerUpdateContext}
          secondaryAction={projectId ? <OwnerLinkButton projectId={projectId} /> : null}
        />

        {/* Recent runs (dense table) */}
        {view === 'recent' && (
          <div
            style={{
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              overflow: 'hidden',
              backgroundColor: colors.white,
            }}
          >
            <RunsTable
              runs={(recentRuns ?? []) as unknown as Array<Record<string, unknown>>}
              loading={runsLoading}
              downloadingId={downloadingRunId}
              onDownload={handleDownloadRun}
            />
          </div>
        )}

        {/* Templates gallery */}
        {view === 'templates' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: spacing['3'],
            }}
          >
            {REPORT_TYPES.map((report) => (
              <TemplateCard
                key={report.type}
                type={report.type}
                label={report.label}
                description={report.description}
                category={reportCategories[report.type] ?? 'General'}
                icon={reportIcons[report.type] ?? <FileText size={16} />}
                onRun={() => handleRunReport(report.type)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Export Center modal */}
      <Suspense fallback={null}>
        {exportOpen && (
          <ExportCenter
            open={exportOpen}
            initialReport={selectedType ?? undefined}
            onClose={() => { setExportOpen(false); setSelectedType(null) }}
          />
        )}
      </Suspense>
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────

const RunsTable: React.FC<{
  runs: Array<Record<string, unknown>>
  loading: boolean
  downloadingId: string | null
  onDownload: (run: Record<string, unknown>) => void
}> = ({ runs, loading, downloadingId, onDownload }) => {
  if (loading) {
    return (
      <div style={{ padding: spacing['6'], color: colorVars.textTertiary, fontSize: typography.fontSize.sm }}>
        Loading recent runs…
      </div>
    )
  }
  if (runs.length === 0) {
    return (
      <div
        style={{
          padding: spacing['8'],
          textAlign: 'center',
          color: colorVars.textTertiary,
          fontSize: typography.fontSize.sm,
        }}
      >
        No reports generated yet. Run one from the Templates tab to populate this list.
      </div>
    )
  }

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSize.sm,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <thead>
        <tr style={{ backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <Th>Title</Th>
          <Th>Type</Th>
          <Th>Generated</Th>
          <Th>By</Th>
          <Th>Status</Th>
          <Th align="right">{''}</Th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => {
          const reportConfig = REPORT_TYPES.find((r) => r.type === run.report_type)
          const status = (run.status as string) || 'completed'
          const statusColor = status === 'completed' ? colors.statusActive
            : status === 'generating' ? colors.statusInfo
            : status === 'failed' ? colors.statusCritical
            : colors.textTertiary
          const isDownloading = downloadingId === run.id
          return (
            <tr
              key={run.id as string}
              style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
            >
              <Td>
                <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  {reportConfig?.label ?? (run.report_type as string)}
                </span>
              </Td>
              <Td color={colors.textSecondary}>
                {reportCategories[run.report_type as string] ?? 'General'}
              </Td>
              <Td color={colors.textSecondary}>
                {formatTimeAgo(run.generated_at as string | null)}
              </Td>
              <Td color={colors.textSecondary}>
                {(run.generated_by_name as string) ?? '—'}
              </Td>
              <Td>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: typography.fontSize.caption,
                    color: statusColor,
                    fontWeight: typography.fontWeight.medium,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusColor }} />
                  {status}
                </span>
              </Td>
              <Td align="right">
                {status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => onDownload(run)}
                    disabled={isDownloading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      fontSize: typography.fontSize.caption,
                      color: colors.textSecondary,
                      border: `1px solid ${colors.borderSubtle}`,
                      backgroundColor: colors.white,
                      borderRadius: borderRadius.sm,
                      cursor: isDownloading ? 'wait' : 'pointer',
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    {isDownloading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={11} />}
                    {isDownloading ? 'Downloading' : 'Download'}
                  </button>
                )}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align = 'left' }) => (
  <th
    style={{
      textAlign: align,
      padding: `${spacing['2']} ${spacing['3']}`,
      fontSize: 11,
      fontWeight: 600,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}
  >
    {children}
  </th>
)

const Td: React.FC<{ children: React.ReactNode; align?: 'left' | 'right'; color?: string }> = ({ children, align = 'left', color }) => (
  <td
    style={{
      textAlign: align,
      padding: `${spacing['2']} ${spacing['3']}`,
      color: color ?? colors.textPrimary,
      verticalAlign: 'middle',
    }}
  >
    {children}
  </td>
)

const TemplateCard: React.FC<{
  type: string
  label: string
  description: string
  category: string
  icon: React.ReactNode
  onRun: () => void
}> = ({ label, description, category, icon, onRun }) => (
  <div
    style={{
      border: `1px solid ${colors.borderSubtle}`,
      borderRadius: borderRadius.md,
      backgroundColor: colors.white,
      padding: spacing['4'],
      display: 'flex',
      flexDirection: 'column',
      gap: spacing['2'],
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceInset,
          color: colors.textSecondary,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: colors.textTertiary,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {category}
      </span>
    </div>
    <div
      style={{
        fontSize: typography.fontSize.body,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
      }}
    >
      {label}
    </div>
    <p
      style={{
        margin: 0,
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 1.5,
        flex: 1,
      }}
    >
      {description}
    </p>
    <button
      type="button"
      onClick={onRun}
      style={{
        alignSelf: 'flex-start',
        marginTop: spacing['1'],
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        backgroundColor: colors.surfaceInset,
        color: colors.textPrimary,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.sm,
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        fontFamily: typography.fontFamily,
        cursor: 'pointer',
      }}
    >
      <Play size={11} />
      Generate
    </button>
  </div>
)

export default Reports
