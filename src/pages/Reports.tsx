import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Play, Calendar, Download, BarChart3, DollarSign, HardHat,
  ClipboardList, Shield, Users, Wrench, CalendarDays, Sparkles, Loader2, Plus,
  TrendingUp, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { colors, spacing, typography, borderRadius, colorVars } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useCustomReports, useReportRuns } from '../hooks/queries'
import { REPORT_TYPES, type ReportType } from '../hooks/useReportData'
import { useActionStream } from '../hooks/useActionStream'
import { useProjectStore } from '../stores/projectStore'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

import { OwnerUpdateGenerator, prewarmIris } from '../components/reports/OwnerUpdateGenerator'
import { OwnerLinkButton } from '../components/reports/OwnerLinkButton'
import { ReportCard, ReportCardRow } from '../components/reports/ReportCard'
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

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

type ViewId = 'recent' | 'templates'

const VIEW_TABS: Array<{ id: ViewId; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'templates', label: 'Templates' },
]

// ── Schedule Health ─────────────────────────────────────────────────────────

interface SchedulePhaseLite {
  id: string
  name: string
  status: string | null
  is_critical_path: boolean | null
  is_critical: boolean | null
  end_date: string | null
  percent_complete: number | null
  float_days: number | null
}

interface ScheduleHealth {
  totalCritical: number
  onTrack: number
  slipRisk: SchedulePhaseLite[]
  loading: boolean
}

function useScheduleHealth(projectId: string | undefined): ScheduleHealth {
  const query = useQuery<SchedulePhaseLite[]>({
    queryKey: ['reports-schedule-health', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_phases')
        .select('id, name, status, is_critical_path, is_critical, end_date, percent_complete, float_days')
        .eq('project_id', projectId!)
        .is('deleted_at', null)
      if (error) {
        // Graceful degradation — table might be missing or RLS-blocked.
        console.warn('[Reports] schedule_phases unreadable:', error.message)
        return []
      }
      return (data ?? []) as unknown as SchedulePhaseLite[]
    },
  })

  const data = query.data ?? []
  const critical = data.filter((p) => p.is_critical_path || p.is_critical)
  const onTrack = critical.filter((p) => {
    if (p.status === 'completed' || p.status === 'in_progress') return true
    const float = p.float_days ?? 0
    return float >= 0
  }).length
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const slipRisk = critical
    .filter((p) => {
      if (p.status === 'completed') return false
      const end = p.end_date ? new Date(p.end_date) : null
      const past = end ? end.getTime() < today.getTime() : false
      const incomplete = (p.percent_complete ?? 0) < 100
      const negFloat = (p.float_days ?? 0) < 0
      return (past && incomplete) || negFloat
    })
    .slice(0, 5)

  return {
    totalCritical: critical.length,
    onTrack,
    slipRisk,
    loading: query.isLoading,
  }
}

// ── Budget Burn ─────────────────────────────────────────────────────────────

interface BudgetItemLite {
  id: string
  division: string
  description: string | null
  csi_division: string | null
  cost_code: string | null
  original_amount: number | null
  committed_amount: number | null
  actual_amount: number | null
}

interface BudgetBurn {
  totalOriginal: number
  totalCommitted: number
  percentCommitted: number
  /** Top 3 line items by committed amount. */
  topItems: BudgetItemLite[]
  loading: boolean
}

function useBudgetBurn(projectId: string | undefined): BudgetBurn {
  const query = useQuery<BudgetItemLite[]>({
    queryKey: ['reports-budget-burn', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('id, division, description, csi_division, cost_code, original_amount, committed_amount, actual_amount')
        .eq('project_id', projectId!)
      if (error) {
        console.warn('[Reports] budget_items unreadable:', error.message)
        return []
      }
      return (data ?? []) as unknown as BudgetItemLite[]
    },
  })

  const data = query.data ?? []
  const totalOriginal = data.reduce((s, i) => s + (i.original_amount ?? 0), 0)
  const totalCommitted = data.reduce((s, i) => s + (i.committed_amount ?? 0), 0)
  const percentCommitted = totalOriginal > 0 ? (totalCommitted / totalOriginal) * 100 : 0
  const topItems = [...data]
    .filter((i) => (i.committed_amount ?? 0) > 0)
    .sort((a, b) => (b.committed_amount ?? 0) - (a.committed_amount ?? 0))
    .slice(0, 3)

  return {
    totalOriginal,
    totalCommitted,
    percentCommitted,
    topItems,
    loading: query.isLoading,
  }
}

// ── Safety Pulse ────────────────────────────────────────────────────────────

interface IncidentLite {
  id: string
  date: string
  severity: string | null
  type: string | null
  description: string
  osha_recordable: boolean | null
}

interface SafetyPulse {
  thisWeek: number
  nearMissesThisWeek: number
  recordablesThisWeek: number
  daysSinceLast: number | null
  recent: IncidentLite[]
  loading: boolean
}

interface SafetyPulseFetched {
  raw: IncidentLite[]
  fetchedAtMs: number
}

function useSafetyPulse(projectId: string | undefined): SafetyPulse {
  const query = useQuery<SafetyPulseFetched>({
    queryKey: ['reports-safety-pulse', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('id, date, severity, type, description, osha_recordable')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
        .limit(30)
      if (error) {
        console.warn('[Reports] incidents unreadable:', error.message)
        return { raw: [], fetchedAtMs: Date.now() }
      }
      return { raw: (data ?? []) as unknown as IncidentLite[], fetchedAtMs: Date.now() }
    },
  })

  return useMemo<SafetyPulse>(() => {
    const data = query.data?.raw ?? []
    const now = query.data?.fetchedAtMs ?? 0
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const thisWeek = now > 0
      ? data.filter((i) => new Date(i.date).getTime() >= sevenDaysAgo)
      : []
    const nearMissesThisWeek = thisWeek.filter(
      (i) => (i.severity ?? '').toLowerCase().includes('near') || (i.type ?? '').toLowerCase().includes('near'),
    ).length
    const recordablesThisWeek = thisWeek.filter((i) => i.osha_recordable === true).length
    const last = data[0]
    const daysSinceLast = last && now > 0
      ? Math.floor((now - new Date(last.date).getTime()) / (24 * 60 * 60 * 1000))
      : null

    return {
      thisWeek: thisWeek.length,
      nearMissesThisWeek,
      recordablesThisWeek,
      daysSinceLast,
      recent: thisWeek.slice(0, 3),
      loading: query.isLoading,
    }
  }, [query.data, query.isLoading])
}

// ── Owner-update context assembler ──────────────────────────────────────────
//
// Pulls the most readily-available signals for the Iris owner-update template.
// Sections we don't have wiring for (lookahead, progress) are intentionally
// left undefined — the template renders "No material change" rather than
// inventing.

function useOwnerUpdateContext(
  schedule: ScheduleHealth,
  budget: BudgetBurn,
): ProjectContextSnapshot {
  const { activeProject } = useProjectStore()
  const { user } = useAuth()
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

    const scheduleStatus = schedule.slipRisk.length > 0
      ? {
          behindActivities: schedule.slipRisk.map((p) => ({
            name: p.name,
            daysBehind: Math.max(1, Math.abs(p.float_days ?? 1)),
            sourceLabel: `Schedule activity: ${p.name}`,
          })),
          milestonesHit: [],
          milestonesMissed: [],
        }
      : undefined

    const budgetStatus = budget.totalOriginal > 0
      ? {
          percentCommitted: budget.percentCommitted,
          approvedTotal: budget.totalOriginal,
          sourceLabel: 'Budget items — committed vs original',
        }
      : undefined

    return {
      projectId: activeProject?.id ?? null,
      projectName: activeProject?.name ?? null,
      userName,
      reportingPeriodDays: 7,
      scheduleStatus,
      budgetStatus,
      topRisks: topRisks.length > 0 ? topRisks : undefined,
      decisionsNeeded: decisionsNeeded.length > 0 ? decisionsNeeded : undefined,
    }
  }, [activeProject, user, stream.items, schedule, budget])
}

// ── Main component ──────────────────────────────────────────────────────────

export const Reports: React.FC = () => {
  const projectId = useProjectId()
  const navigate = useNavigate()
  const { data: customReports } = useCustomReports(projectId)
  const { data: recentRuns, isLoading: runsLoading } = useReportRuns(projectId)

  const schedule = useScheduleHealth(projectId)
  const budget = useBudgetBurn(projectId)
  const safety = useSafetyPulse(projectId)
  const ownerUpdateContext = useOwnerUpdateContext(schedule, budget)

  const [view, setView] = useState<ViewId>('recent')
  const [exportOpen, setExportOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ReportType | null>(null)
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null)

  const totalReports = REPORT_TYPES.length + (customReports?.length ?? 0)

  // Risk mitigation: pre-warm Anthropic prompt cache once on mount so the
  // demo's "Generate update" hits a warm cache. Fire-and-forget — never blocks.
  useEffect(() => {
    prewarmIris()
  }, [])

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
        {/* Hero — Iris owner update */}
        <OwnerUpdateGenerator
          context={ownerUpdateContext}
          secondaryAction={projectId ? <OwnerLinkButton projectId={projectId} /> : null}
        />

        {/* Three secondary deterministic cards — cockpit instrument matrix */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: spacing['3'],
            marginBottom: spacing['5'],
          }}
        >
          <ScheduleHealthCard health={schedule} />
          <BudgetBurnCard burn={budget} />
          <SafetyPulseCard pulse={safety} />
        </div>

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

// ── Secondary cards ─────────────────────────────────────────────────────────

const ScheduleHealthCard: React.FC<{ health: ScheduleHealth }> = ({ health }) => {
  const pct = health.totalCritical > 0
    ? Math.round((health.onTrack / health.totalCritical) * 100)
    : 100
  const slipCount = health.slipRisk.length
  const empty = !health.loading && health.totalCritical === 0
  return (
    <ReportCard
      title="Schedule Health"
      subtitle="Critical path"
      metric={health.totalCritical > 0 ? `${pct}%` : '—'}
      delta={
        health.totalCritical > 0
          ? {
              label: slipCount > 0 ? `${slipCount} at risk` : 'Clean',
              tone: slipCount > 0 ? 'negative' : 'positive',
            }
          : undefined
      }
      loading={health.loading}
      empty={empty}
      emptyMessage="No critical-path activities defined."
    >
      {health.totalCritical > 0 && (
        <>
          <ReportCardRow
            label="On track"
            value={`${health.onTrack}/${health.totalCritical}`}
            tone="positive"
          />
          <ReportCardRow
            label="Slip risk"
            value={String(slipCount)}
            tone={slipCount > 0 ? 'negative' : 'neutral'}
          />
          {health.slipRisk.slice(0, 3).map((p) => (
            <ReportCardRow
              key={p.id}
              label={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={11} color={colors.statusCritical} />
                  {p.name}
                </span>
              }
              value={
                typeof p.float_days === 'number'
                  ? `${p.float_days >= 0 ? '+' : ''}${p.float_days}d`
                  : '—'
              }
              hint={p.percent_complete != null ? `${Math.round(p.percent_complete)}%` : undefined}
              tone="negative"
            />
          ))}
        </>
      )}
    </ReportCard>
  )
}

const BudgetBurnCard: React.FC<{ burn: BudgetBurn }> = ({ burn }) => {
  const empty = !burn.loading && burn.totalOriginal === 0
  return (
    <ReportCard
      title="Budget Burn"
      subtitle="Committed vs approved"
      metric={burn.totalOriginal > 0 ? `${burn.percentCommitted.toFixed(1)}%` : '—'}
      delta={
        burn.totalOriginal > 0
          ? {
              label: fmtMoney(burn.totalCommitted),
              tone: burn.percentCommitted > 100 ? 'negative' : 'neutral',
            }
          : undefined
      }
      loading={burn.loading}
      empty={empty}
      emptyMessage="No budget items configured."
    >
      {burn.totalOriginal > 0 && (
        <>
          <ReportCardRow
            label="Approved total"
            value={fmtMoney(burn.totalOriginal)}
          />
          <ReportCardRow
            label="Committed"
            value={fmtMoney(burn.totalCommitted)}
            tone={burn.percentCommitted > 100 ? 'negative' : 'positive'}
          />
          {burn.topItems.map((item) => {
            const label = item.cost_code
              ? `${item.cost_code} · ${item.description ?? item.division}`
              : item.description ?? item.division
            return (
              <ReportCardRow
                key={item.id}
                label={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={11} color={colors.textTertiary} />
                    {label}
                  </span>
                }
                value={fmtMoney(item.committed_amount ?? 0)}
              />
            )
          })}
        </>
      )}
    </ReportCard>
  )
}

const SafetyPulseCard: React.FC<{ pulse: SafetyPulse }> = ({ pulse }) => {
  const empty = !pulse.loading && pulse.daysSinceLast === null && pulse.thisWeek === 0
  const sinceLast = pulse.daysSinceLast == null
    ? '—'
    : pulse.daysSinceLast === 0
      ? 'Today'
      : `${pulse.daysSinceLast}d`
  const tone: 'positive' | 'negative' | 'neutral' =
    pulse.recordablesThisWeek > 0
      ? 'negative'
      : pulse.thisWeek === 0
        ? 'positive'
        : 'neutral'
  return (
    <ReportCard
      title="Safety Pulse"
      subtitle="Last 7 days"
      metric={String(pulse.thisWeek)}
      delta={{
        label: sinceLast === '—' ? 'No incidents on record' : `${sinceLast} since last`,
        tone,
      }}
      loading={pulse.loading}
      empty={empty}
      emptyMessage="No incidents on record."
    >
      <ReportCardRow
        label="Incidents this week"
        value={String(pulse.thisWeek)}
        tone={pulse.thisWeek > 0 ? 'negative' : 'positive'}
      />
      <ReportCardRow
        label="Near-misses"
        value={String(pulse.nearMissesThisWeek)}
        tone={pulse.nearMissesThisWeek > 0 ? 'negative' : 'neutral'}
      />
      <ReportCardRow
        label="OSHA recordable"
        value={String(pulse.recordablesThisWeek)}
        tone={pulse.recordablesThisWeek > 0 ? 'negative' : 'neutral'}
      />
      <ReportCardRow
        label="Days since last"
        value={sinceLast}
        tone={tone}
      />
    </ReportCard>
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
