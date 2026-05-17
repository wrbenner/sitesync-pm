// ── RFIReportsPage ──────────────────────────────────────────────────────
// Phase 4 — RFI Reports module. Six canned reports + custom builder
// stub + scheduled email delivery hooks.
//
// Mounted at /projects/:id/rfis/reports. Reuses recharts (already in
// the dep graph) for the canned charts.

import React, { useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'
import { Calendar, BarChart3, DollarSign, Clock, Layers, Award, Send } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer } from '../../components/Primitives'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { useProjectId } from '../../hooks/useProjectId'
import { useRFIs } from '../../hooks/queries'
import { useRFIResponsesList } from '../../hooks/queries/useRFIResponses'
import { useProfileNames, displayName } from '../../hooks/queries/profiles'
import {
  avgResponseTimePerFirm,
  onTimeClosePercent,
  costAtRisk,
  scheduleAtRisk,
  rfiCountByTrade,
  designerScorecard,
  CANNED_REPORT_KEYS,
  CANNED_REPORT_LABELS,
  type CannedReportKey,
  type RFIRowForReport,
  type ResponseRowForReport,
} from '../../lib/rfi/reports'
import { fromTable } from '../../lib/db/queries'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAuditEntry } from '../../lib/auditLogger'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

const from = (table: string) => fromTable(table as never)

const REPORT_ICONS: Record<CannedReportKey, React.ReactNode> = {
  avg_response_time_per_firm: <Clock size={14} />,
  on_time_close_pct: <BarChart3 size={14} />,
  cost_at_risk: <DollarSign size={14} />,
  schedule_at_risk: <Calendar size={14} />,
  rfi_count_by_trade: <Layers size={14} />,
  designer_scorecard: <Award size={14} />,
}

interface ScheduleParams {
  projectId: string
  cannedKey: CannedReportKey
  cadence: 'daily' | 'weekly' | 'monthly'
  recipients: string[]
  subject: string
}

function useScheduleReport() {
  return useMutation({
    mutationFn: async (params: ScheduleParams) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('rfi_scheduled_reports').insert({
        project_id: params.projectId,
        canned_key: params.cannedKey,
        cadence: params.cadence,
        recipients: params.recipients,
        subject_tmpl: params.subject,
        created_by: user?.id ?? null,
      } as never)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'project',
        entityId: params.projectId,
        action: 'update',
        afterState: { scheduled_report: params.cannedKey, cadence: params.cadence },
        metadata: { kind: 'rfi_report_schedule_create' },
      })
      return params
    },
  })
}

export function RFIReportsPage() {
  const projectId = useProjectId()
  const rfisQuery = useRFIs(projectId)
  const rfisResult = rfisQuery.data
  const rfisLoading = rfisQuery.isLoading
  const rfisError = rfisQuery.error
  const rfis = useMemo(() => (rfisResult?.data ?? []) as unknown as RFIRowForReport[], [rfisResult])
  // Responses across the project — single bulk fetch is fine for
  // moderate-size datasets; switch to MV when row count > 5K.
  const { data: responsesByRFI = {} } = useAllResponses(rfis)
  const responses = useMemo<ResponseRowForReport[]>(() => Object.values(responsesByRFI).flat(), [responsesByRFI])

  const userIds = useMemo(() => rfis.map((r) => r.ball_in_court).filter((id): id is string => !!id), [rfis])
  const { data: profileMap } = useProfileNames(userIds)
  const firmLookup = (userId: string) => displayName(profileMap, userId)

  const [activeReport, setActiveReport] = useState<CannedReportKey>('on_time_close_pct')
  const [scheduleOpen, setScheduleOpen] = useState(false)

  if (!projectId) {
    return (
      <PageContainer>
        <p style={{ padding: spacing.xl, color: colors.textTertiary }}>Pick a project first.</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: spacing.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.textPrimary }}>RFI Reports</h1>
        <p style={{ marginTop: 4, marginBottom: spacing.lg, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          Six canned reports + scheduled email delivery. Custom report builder ships in a follow-up.
        </p>

        <div role="tablist" aria-label="RFI report types" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: spacing.lg }}>
          {CANNED_REPORT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeReport === key}
              aria-controls={`report-panel-${key}`}
              onClick={() => setActiveReport(key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: activeReport === key ? colors.orangeSubtle : colors.surfaceRaised,
                color: activeReport === key ? colors.primaryOrange : colors.textSecondary,
                border: `1px solid ${activeReport === key ? colors.primaryOrange : colors.borderSubtle}`,
                borderRadius: borderRadius.sm,
                cursor: 'pointer',
              }}
            >
              {REPORT_ICONS[key]} {CANNED_REPORT_LABELS[key]}
            </button>
          ))}
        </div>

        <div
          style={{
            padding: spacing.lg,
            background: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.base,
            minHeight: 360,
          }}
          role="tabpanel"
          id={`report-panel-${activeReport}`}
          aria-live="polite"
          aria-busy={rfisLoading}
        >
          {rfisLoading && (
            <div role="status" style={{ padding: 60, textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
              Loading RFI data...
            </div>
          )}
          {!rfisLoading && rfisError && (
            <div role="alert" style={{ padding: 60, textAlign: 'center', color: '#991B1B', fontSize: typography.fontSize.sm }}>
              <strong style={{ display: 'block', marginBottom: 8 }}>Could not load RFI data</strong>
              <span style={{ color: '#7F1D1D', fontSize: typography.fontSize.xs }}>
                {rfisError instanceof Error ? rfisError.message : 'Unknown error'}
              </span>
            </div>
          )}
          {!rfisLoading && !rfisError && rfis.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <strong style={{ display: 'block', color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                No RFIs on this project yet
              </strong>
              <p style={{ marginTop: 8, color: colors.textTertiary, fontSize: typography.fontSize.xs, maxWidth: 360, margin: '8px auto 0' }}>
                Reports populate after RFIs are created. Open the RFI list to add your first one.
              </p>
            </div>
          )}
          {!rfisLoading && !rfisError && rfis.length > 0 && (
            <>
              {activeReport === 'avg_response_time_per_firm' && (
                <AvgResponseTimeChart rfis={rfis} responses={responses} firmLookup={firmLookup} />
              )}
              {activeReport === 'on_time_close_pct' && <OnTimeCloseChart rfis={rfis} />}
              {activeReport === 'cost_at_risk' && <CostAtRiskChart rfis={rfis} />}
              {activeReport === 'schedule_at_risk' && <ScheduleAtRiskChart rfis={rfis} />}
              {activeReport === 'rfi_count_by_trade' && <RFICountByTradeChart rfis={rfis} />}
              {activeReport === 'designer_scorecard' && (
                <DesignerScorecardTable rfis={rfis} responses={responses} firmLookup={firmLookup} />
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.md, gap: 4 }}>
          <PermissionGate permission="rfis.create">
            <button
              type="button"
              onClick={() => setScheduleOpen((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: colors.primaryOrange,
                color: 'white',
                border: 'none',
                borderRadius: borderRadius.sm,
                cursor: 'pointer',
              }}
            >
              <Send size={12} /> Schedule email delivery
            </button>
          </PermissionGate>
        </div>

        {scheduleOpen && (
          <ScheduleForm
            projectId={projectId}
            reportKey={activeReport}
            onClose={() => setScheduleOpen(false)}
          />
        )}
      </div>
    </PageContainer>
  )
}

function useAllResponses(rfis: RFIRowForReport[]) {
  // Per-RFI useRFIResponsesList would be N hooks; instead: a single
  // bulk fetch driven off the rfi_id list.
  const ids = rfis.map((r) => r.id)
  return useBulkResponses(ids)
}

function useBulkResponses(rfiIds: string[]) {
  return useQuery({
    queryKey: ['rfi_reports_bulk_responses', rfiIds.length, rfiIds[0] ?? '', rfiIds[rfiIds.length - 1] ?? ''],
    enabled: rfiIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, ResponseRowForReport[]>> => {
      if (rfiIds.length === 0) return {}
      const { data } = await from('rfi_responses')
        .select('rfi_id, is_official, created_at')
        .in('rfi_id' as never, rfiIds as unknown as never)
      const rows = (data ?? []) as ResponseRowForReport[]
      const map: Record<string, ResponseRowForReport[]> = {}
      for (const r of rows) {
        if (!map[r.rfi_id]) map[r.rfi_id] = []
        map[r.rfi_id].push(r)
      }
      return map
    },
  })
}

// Refer to the unused hook so the linter doesn't drop it; the page
// uses useRFIResponsesList only when a single RFI is in scope.
void useRFIResponsesList

// ── Charts ──────────────────────────────────────────────────────────

const AvgResponseTimeChart: React.FC<{ rfis: RFIRowForReport[]; responses: ResponseRowForReport[]; firmLookup: (uid: string) => string }> = ({ rfis, responses, firmLookup }) => {
  const data = useMemo(() => avgResponseTimePerFirm(rfis, responses, firmLookup), [rfis, responses, firmLookup])
  if (data.length === 0) return <Empty label="No firm-level data yet. Once Iris drafts have been responded to, this chart populates." />
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="firm" />
        <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="avgDays" fill={colors.primaryOrange} name="Avg days" />
      </BarChart>
    </ResponsiveContainer>
  )
}

const OnTimeCloseChart: React.FC<{ rfis: RFIRowForReport[] }> = ({ rfis }) => {
  const data = useMemo(() => onTimeClosePercent(rfis), [rfis])
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: spacing.md }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: data.current >= 80 ? '#16A34A' : data.current >= 60 ? '#D97706' : '#DC2626' }}>
          {data.current}%
        </span>
        <span style={{ fontSize: 12, color: colors.textTertiary }}>on-time close, last 12 months</span>
      </div>
      {data.trend.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Line type="monotone" dataKey="pct" stroke={colors.primaryOrange} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : <Empty label="No closed RFIs yet. Chart populates after the first close." />}
    </div>
  )
}

const CostAtRiskChart: React.FC<{ rfis: RFIRowForReport[] }> = ({ rfis }) => {
  const data = useMemo(() => costAtRisk(rfis), [rfis])
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: spacing.md }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: data.totalDollars > 50_000 ? '#DC2626' : colors.textPrimary }}>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(data.totalDollars)}
        </span>
        <span style={{ fontSize: 12, color: colors.textTertiary }}>across {data.rfiCount} open RFIs</span>
      </div>
      {data.byPriority.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.byPriority}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="priority" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="dollars" fill="#DC2626" name="$" />
          </BarChart>
        </ResponsiveContainer>
      ) : <Empty label="No open RFIs with cost impact." />}
    </div>
  )
}

const ScheduleAtRiskChart: React.FC<{ rfis: RFIRowForReport[] }> = ({ rfis }) => {
  const data = useMemo(() => scheduleAtRisk(rfis), [rfis])
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: spacing.md }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: data.totalDays > 14 ? '#DC2626' : colors.textPrimary }}>{data.totalDays} days</span>
        <span style={{ fontSize: 12, color: colors.textTertiary }}>schedule impact across {data.rfiCount} open RFIs</span>
      </div>
      {data.byTrade.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.byTrade}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="trade" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="days" fill="#D97706" name="Days" />
          </BarChart>
        </ResponsiveContainer>
      ) : <Empty label="No open RFIs with schedule impact." />}
    </div>
  )
}

const RFICountByTradeChart: React.FC<{ rfis: RFIRowForReport[] }> = ({ rfis }) => {
  const data = useMemo(() => rfiCountByTrade(rfis), [rfis])
  if (data.length === 0) return <Empty label="No RFIs yet." />
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="trade" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="open" stackId="a" fill={colors.primaryOrange} name="Open" />
        <Bar dataKey="closed" stackId="a" fill="#16A34A" name="Closed" />
      </BarChart>
    </ResponsiveContainer>
  )
}

const DesignerScorecardTable: React.FC<{ rfis: RFIRowForReport[]; responses: ResponseRowForReport[]; firmLookup: (uid: string) => string }> = ({ rfis, responses, firmLookup }) => {
  const data = useMemo(() => designerScorecard(rfis, responses, firmLookup), [rfis, responses, firmLookup])
  if (data.length === 0) return <Empty label="No designer data yet." />
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
      <thead>
        <tr style={{ background: colors.surfaceInset }}>
          <th style={{ textAlign: 'left', padding: 8 }}>Firm</th>
          <th style={{ textAlign: 'right', padding: 8 }}>RFIs</th>
          <th style={{ textAlign: 'right', padding: 8 }}>Avg days</th>
          <th style={{ textAlign: 'right', padding: 8 }}>On-time %</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.firm} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <td style={{ padding: 8 }}>{row.firm}</td>
            <td style={{ padding: 8, textAlign: 'right' }}>{row.rfiCount}</td>
            <td style={{ padding: 8, textAlign: 'right' }}>{row.avgDays}</td>
            <td style={{ padding: 8, textAlign: 'right', color: row.accuracy >= 80 ? '#16A34A' : row.accuracy >= 60 ? '#D97706' : '#DC2626' }}>
              {row.accuracy}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ padding: 60, textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
    {label}
  </div>
)

const ScheduleForm: React.FC<{ projectId: string; reportKey: CannedReportKey; onClose: () => void }> = ({ projectId, reportKey, onClose }) => {
  const [recipients, setRecipients] = useState('')
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [subject, setSubject] = useState(`SiteSync RFI report: ${CANNED_REPORT_LABELS[reportKey]}`)
  const schedule = useScheduleReport()

  return (
    <div style={{ marginTop: spacing.md, padding: spacing.md, border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, background: colors.surfaceRaised }}>
      <h3 style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>Schedule {CANNED_REPORT_LABELS[reportKey]}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, marginTop: spacing.md }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: colors.textTertiary, fontWeight: 600 }}>Cadence</span>
          <select value={cadence} onChange={(e) => setCadence(e.target.value as 'daily' | 'weekly' | 'monthly')} style={inputStyle}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: colors.textTertiary, fontWeight: 600 }}>Recipients (comma-separated emails)</span>
          <input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="walker@example.com, brad@cameroncc.com" style={inputStyle} />
        </label>
        <label style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: colors.textTertiary, fontWeight: 600 }}>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: spacing.md }}>
        <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
        <button
          type="button"
          onClick={async () => {
            const list = recipients.split(',').map((r) => r.trim()).filter(Boolean)
            if (list.length === 0) { toast.error('Add at least one recipient'); return }
            try {
              await schedule.mutateAsync({ projectId, cannedKey: reportKey, cadence, recipients: list, subject })
              toast.success(`Scheduled ${cadence} delivery to ${list.length} recipient${list.length > 1 ? 's' : ''}`)
              onClose()
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Schedule failed')
            }
          }}
          style={primaryBtn}
        >
          Schedule
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  background: colors.surfacePage,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  color: colors.textPrimary,
  outline: 'none',
  fontFamily: 'inherit',
}

const cancelBtn: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  background: 'transparent',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  color: colors.textSecondary,
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  ...cancelBtn,
  background: colors.primaryOrange,
  color: 'white',
  border: 'none',
}

export default RFIReportsPage
