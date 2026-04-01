import React, { useState, useMemo, useEffect, useCallback, memo, lazy, Suspense } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, FileText, CheckCircle, Clock, AlertTriangle,
  CreditCard, Send, Eye, Plus, ChevronRight, Building2,
  Scale, Receipt, ArrowRight, X, Save, Download,
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { usePayApplications, useContracts, useRetainageLedger, useLienWaivers, usePayAppSOV, useProject } from '../hooks/queries'
import type { LienWaiverRow, LienWaiverStatus } from '../types/api'
import {
  getPaymentStatusConfig,
  getValidPaymentTransitions,
  calculateG702,
  calculateG703LineItem,
  getLienWaiverStatusConfig,
  LIEN_WAIVER_FORMS,
} from '../machines/paymentMachine'
import type { PaymentStatus, G702Data, G703LineItem, LienWaiverState } from '../machines/paymentMachine'
import { saveSOVProgress, approvePayApplication } from '../api/endpoints/budget'
import type { PayApplicationData } from '../api/endpoints/budget'
import { createLienWaiver, updateLienWaiverStatus } from '../api/endpoints/lienWaivers'
import { LienWaiverPDF, lienWaiverDataFromRow } from '../components/export/LienWaiverPDF'
import type { LienWaiverRowContext, WaiverState } from '../components/export/LienWaiverPDF'
import { G702ApplicationPDF } from '../components/export/G702ApplicationPDF'
import { G703ContinuationPDF } from '../components/export/G703ContinuationPDF'
import { PermissionGate } from '../components/auth/PermissionGate'
import { toast } from 'sonner'

const PDFDownloadLink = lazy(() =>
  import('@react-pdf/renderer').then((m) => ({ default: m.PDFDownloadLink })),
)

// ── Formatters ────────────────────────────────────────────────

const fmtCurrency = (n: number | null) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

// ── Tab Types ─────────────────────────────────────────────────

type TabKey = 'applications' | 'lien_waivers' | 'cash_flow'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'applications', label: 'Pay Applications', icon: Receipt },
  { key: 'lien_waivers', label: 'Lien Waivers', icon: Scale },
  { key: 'cash_flow', label: 'Cash Flow', icon: DollarSign },
]

// ── Pay App Table Columns ─────────────────────────────────────

const payAppCol = createColumnHelper<Record<string, unknown>>()
const payAppColumns = [
  payAppCol.accessor('application_number', {
    header: 'App #',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono, fontSize: typography.fontSize.sm }}>
        #{info.getValue() as number}
      </span>
    ),
  }),
  payAppCol.accessor('period_to', {
    header: 'Period To',
    cell: (info) => <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>{fmtDate(info.getValue() as string)}</span>,
  }),
  payAppCol.accessor('contract_sum_to_date', {
    header: 'Contract Sum',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{fmtCurrency(info.getValue() as number)}</span>,
  }),
  payAppCol.accessor('total_completed_and_stored', {
    header: 'Completed',
    cell: (info) => <span style={{ color: colors.textPrimary }}>{fmtCurrency(info.getValue() as number)}</span>,
  }),
  payAppCol.accessor('retainage', {
    header: 'Retainage',
    cell: (info) => <span style={{ color: colors.statusPending }}>{fmtCurrency(info.getValue() as number)}</span>,
  }),
  payAppCol.accessor('current_payment_due', {
    header: 'Payment Due',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.statusActive, fontSize: typography.fontSize.body }}>{fmtCurrency(info.getValue() as number)}</span>,
  }),
  payAppCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const status = info.getValue() as PaymentStatus
      const config = getPaymentStatusConfig(status)
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: config.color, backgroundColor: config.bg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: config.color }} />
          {config.label}
        </span>
      )
    },
  }),
  payAppCol.display({
    id: 'actions',
    header: '',
    cell: (info) => {
      const status = info.row.original.status as PaymentStatus
      const transitions = getValidPaymentTransitions(status)
      if (transitions.length === 0) return null
      return (
        <div style={{ display: 'flex', gap: spacing['1'] }}>
          {status === 'approved' && (
            <button
              onClick={() => toast.success('Payment flow initiated')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
                backgroundColor: colors.primaryOrange, color: colors.white,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                cursor: 'pointer', fontFamily: typography.fontFamily,
              }}
            >
              <CreditCard size={11} /> Pay Sub
            </button>
          )}
          {status === 'draft' && (
            <button
              onClick={() => toast.success('Application submitted for review')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
                backgroundColor: colors.statusInfoSubtle, color: colors.statusInfo,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                cursor: 'pointer', fontFamily: typography.fontFamily,
              }}
            >
              <Send size={11} /> Submit
            </button>
          )}
        </div>
      )
    },
  }),
]

// ── G702 Summary Card ─────────────────────────────────────────

const G702SummaryCard = memo<{
  app: Record<string, unknown>
  liveG702?: G702Data
  liveG703?: G703LineItem[]
  onApprove?: () => void
  isApproving?: boolean
}>(({ app, liveG702, liveG703, onApprove, isApproving }) => {
  const g = liveG702
  const rows = [
    { label: '1. Original Contract Sum', value: fmtCurrency(g ? g.originalContractSum : (app.original_contract_sum as number)) },
    { label: '2. Net Change by Change Orders', value: fmtCurrency(g ? g.netChangeOrders : (app.net_change_orders as number)) },
    { label: '3. Contract Sum to Date (1 + 2)', value: fmtCurrency(g ? g.contractSumToDate : (app.contract_sum_to_date as number)), bold: true },
    { label: '4. Total Completed and Stored to Date', value: fmtCurrency(g ? g.totalCompletedAndStored : (app.total_completed_and_stored as number)) },
    { label: `5. Retainage${g ? ` (${g.retainagePercent.toFixed(0)}%)` : ''}`, value: fmtCurrency(g ? g.retainageAmount : (app.retainage as number)) },
    { label: '6. Total Earned Less Retainage (4 − 5)', value: fmtCurrency(g ? g.totalEarnedLessRetainage : (app.total_earned_less_retainage as number)) },
    { label: '7. Less Previous Certificates for Payment', value: fmtCurrency(g ? g.lessPreviousCertificates : (app.less_previous_certificates as number)) },
    { label: '8. Current Payment Due (6 − 7)', value: fmtCurrency(g ? g.currentPaymentDue : (app.current_payment_due as number)), bold: true, highlight: true },
    { label: '9. Balance to Finish (3 − 4)', value: fmtCurrency(g ? g.balanceToFinish : (app.balance_to_finish as number)) },
  ]

  const appNum = app.application_number as number
  const periodTo = fmtDate(app.period_to as string)

  return (
    <Card padding={spacing['5']}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <FileText size={16} color={colors.primaryOrange} />
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          AIA G702 Summary
        </span>
        {liveG702 && (
          <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive, backgroundColor: colors.statusActiveSubtle, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full }}>
            Live
          </span>
        )}
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>
          Application #{appNum} · Period to {periodTo}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: `${spacing['2.5']} 0`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              backgroundColor: row.highlight ? colors.orangeSubtle : 'transparent',
              paddingLeft: row.highlight ? spacing['3'] : 0,
              paddingRight: row.highlight ? spacing['3'] : 0,
              borderRadius: row.highlight ? borderRadius.base : 0,
            }}
          >
            <span style={{
              fontSize: typography.fontSize.sm,
              color: row.bold ? colors.textPrimary : colors.textSecondary,
              fontWeight: row.bold ? typography.fontWeight.semibold : typography.fontWeight.normal,
            }}>
              {row.label}
            </span>
            <span style={{
              fontSize: row.highlight ? typography.fontSize.title : typography.fontSize.sm,
              color: row.highlight ? colors.primaryOrange : row.bold ? colors.textPrimary : colors.textSecondary,
              fontWeight: row.bold || row.highlight ? typography.fontWeight.bold : typography.fontWeight.medium,
              fontFeatureSettings: '"tnum"',
            }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['4'], flexWrap: 'wrap' }}>
        {(['submitted', 'gc_review', 'owner_review'] as string[]).includes(app.status as string) && onApprove && (
          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={onApprove}
              disabled={isApproving}
            >
              <CheckCircle size={14} /> {isApproving ? 'Approving...' : 'Approve Pay App'}
            </Btn>
          </PermissionGate>
        )}
        {(app.status as string) === 'approved' && (
          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={() => toast.success('Opening payment flow...')}
            >
              <CreditCard size={14} /> Process Payment
            </Btn>
          </PermissionGate>
        )}
        {liveG702 ? (
          <Suspense fallback={<Btn variant="ghost" size="sm"><FileText size={14} /> Preparing G702...</Btn>}>
            <PDFDownloadLink
              document={<G702ApplicationPDF data={liveG702} />}
              fileName={`G702_App${appNum}_${new Date().toISOString().slice(0, 10)}.pdf`}
            >
              {({ loading }: { loading: boolean }) => (
                <Btn variant="ghost" size="sm">
                  <FileText size={14} /> {loading ? 'Generating...' : 'Export G702 PDF'}
                </Btn>
              )}
            </PDFDownloadLink>
          </Suspense>
        ) : (
          <Btn variant="ghost" size="sm" onClick={() => toast.info('Load SOV data to export G702 PDF')}>
            <FileText size={14} /> Export G702 PDF
          </Btn>
        )}
        {liveG702 && liveG703 ? (
          <Suspense fallback={<Btn variant="ghost" size="sm"><Receipt size={14} /> Preparing G703...</Btn>}>
            <PDFDownloadLink
              document={
                <G703ContinuationPDF
                  projectName={liveG702.projectName}
                  applicationNumber={liveG702.applicationNumber}
                  periodTo={liveG702.periodTo}
                  lineItems={liveG703}
                  summary={liveG702}
                />
              }
              fileName={`G703_App${appNum}_${new Date().toISOString().slice(0, 10)}.pdf`}
            >
              {({ loading }: { loading: boolean }) => (
                <Btn variant="ghost" size="sm">
                  <Receipt size={14} /> {loading ? 'Generating...' : 'Export G703'}
                </Btn>
              )}
            </PDFDownloadLink>
          </Suspense>
        ) : (
          <Btn variant="ghost" size="sm" onClick={() => toast.info('Load SOV data to export G703')}>
            <Receipt size={14} /> Export G703
          </Btn>
        )}
      </div>
    </Card>
  )
})
G702SummaryCard.displayName = 'G702SummaryCard'

// ── SOV Editor Panel ──────────────────────────────────────────

const SOVEditorPanel = memo<{
  sovData: PayApplicationData
  appStatus: string
  projectId: string
  onLiveDataChange: (g702: G702Data, g703: G703LineItem[]) => void
}>(({ sovData, appStatus, projectId, onLiveDataChange }) => {
  // Local edit state: keyed by SOV row id
  const [edits, setEdits] = useState<Record<string, { pct: number; materials: number }>>({})
  const [isDirty, setIsDirty] = useState(false)
  const queryClient = useQueryClient()

  // Initialize edits from server data
  useEffect(() => {
    const initial: Record<string, { pct: number; materials: number }> = {}
    for (const item of sovData.lineItems) {
      initial[item.id] = { pct: item.current_pct_complete, materials: item.stored_materials }
    }
    setEdits(initial)
    setIsDirty(false)
  }, [sovData])

  // Live G703 line items
  const g703Items = useMemo((): G703LineItem[] =>
    sovData.lineItems.map((item, i) => {
      const edit = edits[item.id]
      const currentPct = edit?.pct ?? item.current_pct_complete
      const materials = edit?.materials ?? item.stored_materials
      const prevAmount = item.scheduled_value * (item.prev_pct_complete / 100)
      const thisPeriodAmount = item.scheduled_value * (currentPct / 100)
      const computed = calculateG703LineItem(
        item.scheduled_value,
        prevAmount,
        thisPeriodAmount,
        materials,
        sovData.retainageRate * 100,
      )
      return {
        itemNumber: item.item_number || String(i + 1),
        costCode: item.cost_code || '',
        description: item.description,
        ...computed,
      }
    }),
  [sovData, edits])

  // Live G702 totals
  const liveG702 = useMemo((): G702Data => {
    const computed = calculateG702(
      g703Items,
      sovData.retainageRate * 100,
      sovData.lessPreviousCertificates,
      sovData.originalContractSum,
      sovData.netChangeOrders,
    )
    return {
      ...computed,
      applicationNumber: sovData.applicationNumber,
      periodTo: sovData.periodTo,
      projectName: sovData.projectName,
      contractorName: sovData.contractorName,
    }
  }, [sovData, g703Items])

  // Propagate live data upward for PDF buttons
  useEffect(() => {
    onLiveDataChange(liveG702, g703Items)
  }, [liveG702, g703Items, onLiveDataChange])

  const saveMutation = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      const updates = sovData.lineItems.map((item) => {
        const edit = edits[item.id]
        const currentPct = edit?.pct ?? item.current_pct_complete
        const materials = edit?.materials ?? item.stored_materials
        const prevAmt = item.scheduled_value * (item.prev_pct_complete / 100)
        const thisAmt = item.scheduled_value * (currentPct / 100)
        const totalCompleted = prevAmt + thisAmt + materials
        const percentComplete = item.scheduled_value > 0
          ? (totalCompleted / item.scheduled_value) * 100 : 0
        return { id: item.id, this_period_completed: thisAmt, materials_stored: materials, total_completed: totalCompleted, percent_complete: percentComplete }
      })
      await saveSOVProgress(
        sovData.payAppId,
        updates,
        {
          totalCompletedAndStored: liveG702.totalCompletedAndStored,
          retainageAmount: liveG702.retainageAmount,
          totalEarnedLessRetainage: liveG702.totalEarnedLessRetainage,
          currentPaymentDue: liveG702.currentPaymentDue,
          balanceToFinish: liveG702.balanceToFinish,
        },
        submit,
      )
    },
    onSuccess: (_, { submit }) => {
      queryClient.invalidateQueries({ queryKey: ['pay_app_sov', projectId, sovData.applicationNumber] })
      queryClient.invalidateQueries({ queryKey: ['pay_applications', projectId] })
      setIsDirty(false)
      toast.success(submit ? 'Application submitted for review' : 'SOV progress saved')
    },
    onError: () => toast.error('Failed to save SOV progress'),
  })

  const handlePctChange = useCallback((id: string, value: string) => {
    const pct = Math.min(100, Math.max(0, parseFloat(value) || 0))
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], pct } }))
    setIsDirty(true)
  }, [])

  const handleMaterialsChange = useCallback((id: string, value: string) => {
    const materials = Math.max(0, parseFloat(value) || 0)
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], materials } }))
    setIsDirty(true)
  }, [])

  if (sovData.lineItems.length === 0) {
    return (
      <Card padding={spacing['5']}>
        <EmptyState
          icon={<Receipt size={28} color={colors.textTertiary} />}
          title="No schedule of values"
          description="Add SOV line items to the contract to enable G702/G703 billing."
        />
      </Card>
    )
  }

  const colStyle = (width: string, align: 'left' | 'right' | 'center' = 'right'): React.CSSProperties => ({
    width,
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    textAlign: align,
    padding: `${spacing['2']} ${spacing['2']}`,
    flexShrink: 0,
  })

  const cellStyle = (width: string, align: 'left' | 'right' | 'center' = 'right', opts: React.CSSProperties = {}): React.CSSProperties => ({
    width,
    fontSize: typography.fontSize.sm,
    textAlign: align,
    padding: `${spacing['2']} ${spacing['2']}`,
    flexShrink: 0,
    ...opts,
  })

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <Receipt size={16} color={colors.primaryOrange} />
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Schedule of Values
        </span>
        {isDirty && (
          <span style={{ fontSize: typography.fontSize.caption, color: colors.statusPending, backgroundColor: colors.statusPendingSubtle, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full }}>
            Unsaved changes
          </span>
        )}
      </div>

      {/* Table header */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 820 }}>
          <div style={{ display: 'flex', backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <span style={colStyle('4%', 'center')}>#</span>
            <span style={colStyle('22%', 'left')}>Description</span>
            <span style={colStyle('11%')}>Sched. Value</span>
            <span style={colStyle('8%')}>Prev %</span>
            <span style={{ ...colStyle('10%'), color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold }}>This Period %</span>
            <span style={colStyle('12%')}>Stored Materials</span>
            <span style={colStyle('11%')}>Total Earned</span>
            <span style={colStyle('8%')}>% Done</span>
            <span style={colStyle('14%')}>Retainage</span>
          </div>

          {/* Rows */}
          {sovData.lineItems.map((item, i) => {
            const edit = edits[item.id]
            const g703 = g703Items[i]
            if (!g703) return null
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage,
                }}
              >
                <span style={cellStyle('4%', 'center', { color: colors.textTertiary, fontFamily: typography.fontFamilyMono })}>{item.item_number}</span>
                <span style={cellStyle('22%', 'left', { color: colors.textPrimary })} title={item.description}>
                  {item.description.length > 32 ? `${item.description.slice(0, 32)}...` : item.description}
                </span>
                <span style={cellStyle('11%', 'right', { fontFamily: typography.fontFamilyMono, color: colors.textPrimary })}>{fmtCurrency(item.scheduled_value)}</span>
                <span style={cellStyle('8%', 'right', { color: colors.textSecondary })}>{item.prev_pct_complete.toFixed(1)}%</span>
                {/* Editable current % */}
                <div style={{ width: '10%', padding: `${spacing['1']} ${spacing['2']}`, flexShrink: 0 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={edit?.pct ?? item.current_pct_complete}
                    onChange={(e) => handlePctChange(item.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: `${spacing['1']} ${spacing['2']}`,
                      border: `1px solid ${colors.primaryOrange}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm,
                      fontFamily: typography.fontFamilyMono,
                      textAlign: 'right',
                      color: colors.textPrimary,
                      backgroundColor: colors.orangeSubtle,
                      outline: 'none',
                    }}
                  />
                </div>
                {/* Editable stored materials */}
                <div style={{ width: '12%', padding: `${spacing['1']} ${spacing['2']}`, flexShrink: 0 }}>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={edit?.materials ?? item.stored_materials}
                    onChange={(e) => handleMaterialsChange(item.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: `${spacing['1']} ${spacing['2']}`,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm,
                      fontFamily: typography.fontFamilyMono,
                      textAlign: 'right',
                      color: colors.textPrimary,
                      backgroundColor: colors.white,
                      outline: 'none',
                    }}
                  />
                </div>
                <span style={cellStyle('11%', 'right', { fontFamily: typography.fontFamilyMono, color: colors.textPrimary })}>{fmtCurrency(g703.totalCompletedAndStored)}</span>
                <span style={cellStyle('8%', 'right', { color: g703.percentComplete >= 100 ? colors.statusActive : colors.textPrimary })}>{g703.percentComplete.toFixed(1)}%</span>
                <span style={cellStyle('14%', 'right', { fontFamily: typography.fontFamilyMono, color: colors.statusPending })}>{fmtCurrency(g703.retainage)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sticky footer with live totals */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: colors.darkNavy,
        padding: `${spacing['4']} ${spacing['5']}`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing['6'],
        flexWrap: 'wrap',
        borderTop: `2px solid ${colors.primaryOrange}`,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: 'rgba(255,255,255,0.5)' }}>Total Earned</p>
          <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.white, fontFamily: typography.fontFamilyMono }}>{fmtCurrency(liveG702.totalCompletedAndStored)}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: 'rgba(255,255,255,0.5)' }}>Retainage</p>
          <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, fontFamily: typography.fontFamilyMono }}>{fmtCurrency(liveG702.retainageAmount)}</p>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: 'rgba(255,255,255,0.5)' }}>Current Payment Due</p>
          <p style={{ margin: 0, fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>{fmtCurrency(liveG702.currentPaymentDue)}</p>
        </div>
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => saveMutation.mutate({ submit: false })}
            disabled={saveMutation.isPending || !isDirty}
            style={{ color: colors.white, borderColor: 'rgba(255,255,255,0.3)' }}
          >
            <Save size={13} /> {saveMutation.isPending ? 'Saving...' : 'Save Draft'}
          </Btn>
          {(appStatus === 'draft' || appStatus === 'in_review') && (
            <PermissionGate permission="payments.create">
              <Btn
                variant="primary"
                size="sm"
                onClick={() => saveMutation.mutate({ submit: true })}
                disabled={saveMutation.isPending}
              >
                <Send size={13} /> Submit
              </Btn>
            </PermissionGate>
          )}
        </div>
      </div>
    </Card>
  )
})
SOVEditorPanel.displayName = 'SOVEditorPanel'

// ── Pay App Detail (G702 + SOV combined) ─────────────────────

const PayAppDetail = memo<{
  app: Record<string, unknown>
  projectId: string
  waivers: LienWaiverRow[]
  contracts: Array<Record<string, unknown>>
  onApprove: () => void
  isApproving: boolean
}>(({ app, projectId, waivers, contracts, onApprove, isApproving }) => {
  const appNumber = app.application_number as number
  const { data: sovData, isLoading: sovLoading } = usePayAppSOV(projectId, appNumber)
  const [liveG702, setLiveG702] = useState<G702Data | undefined>()
  const [liveG703, setLiveG703] = useState<G703LineItem[] | undefined>()

  // Compute which active subs are missing a lien waiver for this pay app
  const appWaivers = waivers.filter((w) => w.pay_app_id === (app.id as string))
  const subsWithWaivers = new Set(appWaivers.map((w) => w.sub_id).filter(Boolean))
  const activeSubs = contracts.filter((c) => c.status !== 'terminated')
  const missingSubs = activeSubs.filter((c) => !subsWithWaivers.has(c.id as string))
  const showMissingWarning = missingSubs.length > 0 &&
    !(['approved', 'paid', 'void'] as string[]).includes(app.status as string)

  const handleLiveData = useCallback((g702: G702Data, g703: G703LineItem[]) => {
    setLiveG702(g702)
    setLiveG703(g703)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {showMissingWarning && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
          padding: spacing['4'], backgroundColor: colors.statusCriticalSubtle,
          borderRadius: borderRadius.base, borderLeft: `3px solid ${colors.statusCritical}`,
        }}>
          <AlertTriangle size={16} color={colors.statusCritical} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Missing Lien Waivers
            </p>
            <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
              {missingSubs.length} sub{missingSubs.length !== 1 ? 'contractor' : 'contractor'}{missingSubs.length !== 1 ? 's are' : ' is'} missing a required lien waiver before this can be submitted to the owner:{' '}
              <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                {missingSubs.map((s) => s.counterparty as string).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}
      <G702SummaryCard
        app={app}
        liveG702={liveG702}
        liveG703={liveG703}
        onApprove={onApprove}
        isApproving={isApproving}
      />
      {sovLoading && <Skeleton width="100%" height="200px" />}
      {sovData && (
        <SOVEditorPanel
          sovData={sovData}
          appStatus={(app.status as string) || 'draft'}
          projectId={projectId}
          onLiveDataChange={handleLiveData}
        />
      )}
    </div>
  )
})
PayAppDetail.displayName = 'PayAppDetail'

// ── Cash Flow Summary ─────────────────────────────────────────

const CashFlowPanel = memo<{
  payApps: Array<Record<string, unknown>>
  retainage: Array<Record<string, unknown>>
}>(({ payApps, retainage }) => {
  const metrics = useMemo(() => {
    const totalBilled = payApps.reduce((s, a) => s + ((a.total_completed_and_stored as number) || 0), 0)
    const totalPaid = payApps.filter((a) => a.status === 'paid').reduce((s, a) => s + ((a.current_payment_due as number) || 0), 0)
    const totalRetainage = retainage.reduce((s, r) => s + (((r.amount as number) || 0) - ((r.released_amount as number) || 0)), 0)
    const outstanding = totalBilled - totalPaid - totalRetainage
    const pendingApps = payApps.filter((a) => a.status !== 'paid' && a.status !== 'void' && a.status !== 'draft')
    const pendingAmount = pendingApps.reduce((s, a) => s + ((a.current_payment_due as number) || 0), 0)

    return { totalBilled, totalPaid, totalRetainage, outstanding, pendingAmount }
  }, [payApps, retainage])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['6'] }}>
        <MetricBox label="Total Billed" value={fmtCurrency(metrics.totalBilled)} />
        <MetricBox label="Total Paid" value={fmtCurrency(metrics.totalPaid)} change={1} />
        <MetricBox label="Retainage Held" value={fmtCurrency(metrics.totalRetainage)} />
        <MetricBox label="Pending Payment" value={fmtCurrency(metrics.pendingAmount)} change={metrics.pendingAmount > 0 ? -1 : 0} />
      </div>

      {/* Cash Flow Timeline */}
      <Card padding={spacing['5']}>
        <SectionHeader title="Cash Flow Projection" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], marginTop: spacing['4'] }}>
          {/* Money In */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusActive }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 100 }}>Money In</span>
            <div style={{ flex: 1, height: 24, backgroundColor: colors.statusActiveSubtle, borderRadius: borderRadius.base, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (metrics.totalPaid / Math.max(metrics.totalBilled, 1)) * 100)}%`, backgroundColor: colors.statusActive, borderRadius: borderRadius.base }} />
            </div>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, minWidth: 90, textAlign: 'right' }}>{fmtCurrency(metrics.totalPaid)}</span>
          </div>

          {/* Money Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusCritical }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 100 }}>Money Out</span>
            <div style={{ flex: 1, height: 24, backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (metrics.outstanding / Math.max(metrics.totalBilled, 1)) * 100)}%`, backgroundColor: colors.statusCritical, borderRadius: borderRadius.base }} />
            </div>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, minWidth: 90, textAlign: 'right' }}>{fmtCurrency(metrics.outstanding)}</span>
          </div>

          {/* Retainage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.statusPending }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 100 }}>Retainage</span>
            <div style={{ flex: 1, height: 24, backgroundColor: colors.statusPendingSubtle, borderRadius: borderRadius.base, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (metrics.totalRetainage / Math.max(metrics.totalBilled, 1)) * 100)}%`, backgroundColor: colors.statusPending, borderRadius: borderRadius.base }} />
            </div>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, minWidth: 90, textAlign: 'right' }}>{fmtCurrency(metrics.totalRetainage)}</span>
          </div>
        </div>

        {/* AI Prediction */}
        {metrics.pendingAmount > 50000 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
            padding: spacing['4'], marginTop: spacing['4'],
            backgroundColor: colors.statusPendingSubtle, borderRadius: borderRadius.base,
            borderLeft: `3px solid ${colors.statusPending}`,
          }}>
            <AlertTriangle size={16} color={colors.statusPending} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Cash Flow Gap Detected
              </p>
              <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
                You have {fmtCurrency(metrics.pendingAmount)} in approved payments due to subcontractors. Owner payment may not arrive for 15 to 20 days. Consider requesting early payment or using SiteSync Bridge Financing.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
})
CashFlowPanel.displayName = 'CashFlowPanel'

// ── Waiver Collection Status ──────────────────────────────

type WaiverCollectionStatus = 'received' | 'pending' | 'missing'

function getWaiverCollectionStatus(waivers: LienWaiverRow[]): WaiverCollectionStatus {
  if (waivers.length === 0) return 'missing'
  if (waivers.some((w) => w.status === 'received' || w.status === 'verified')) return 'received'
  return 'pending'
}

function stateToWaiverState(state: string | null | undefined): WaiverState {
  const map: Record<string, WaiverState> = {
    CA: 'california', TX: 'texas', FL: 'florida', NY: 'new_york',
  }
  return (state && map[state.toUpperCase()]) || 'generic'
}

const LIEN_WAIVER_STATUS_CONFIG: Record<LienWaiverStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: colors.statusPending, bg: colors.statusPendingSubtle },
  received: { label: 'Received', color: colors.statusInfo, bg: colors.statusInfoSubtle },
  verified: { label: 'Verified', color: colors.statusActive, bg: colors.statusActiveSubtle },
}

const WAIVER_COLLECTION_CONFIG: Record<WaiverCollectionStatus, { label: string; color: string; bg: string }> = {
  received: { label: 'Conditional Received', color: colors.statusActive, bg: colors.statusActiveSubtle },
  pending: { label: 'Unconditional Pending', color: colors.statusPending, bg: colors.statusPendingSubtle },
  missing: { label: 'Missing', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

// ── Lien Waiver Panel ─────────────────────────────────────────

const LienWaiverPanel = memo<{
  payApps: Array<Record<string, unknown>>
  waivers: LienWaiverRow[]
  contracts: Array<Record<string, unknown>>
  project: { name: string; address: string | null; owner_name: string | null; general_contractor: string | null; state: string | null } | undefined
  onMarkReceived: (id: string) => void
  isMarkingReceived: string | null
}>(({ payApps, waivers, contracts, project, onMarkReceived, isMarkingReceived }) => {
  const approvedApps = payApps.filter((a) => a.status === 'approved' || a.status === 'paid')

  // Summary metrics
  const totalWaivers = waivers.length
  const receivedCount = waivers.filter((w) => w.status === 'received' || w.status === 'verified').length
  const pendingCount = waivers.filter((w) => w.status === 'pending').length
  const activeSubs = contracts.filter((c) => c.status !== 'terminated')

  const pdfContext: LienWaiverRowContext = {
    projectName: project?.name ?? '',
    projectAddress: project?.address ?? '',
    ownerName: project?.owner_name ?? '',
    contractorName: project?.general_contractor ?? '',
    waiverState: stateToWaiverState(project?.state),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: spacing['4'] }}>
        <MetricBox label="Total Waivers" value={totalWaivers} />
        <MetricBox label="Received" value={receivedCount} change={1} />
        <MetricBox label="Pending" value={pendingCount} change={pendingCount > 0 ? -1 : 0} />
        <MetricBox label="Active Subs" value={activeSubs.length} />
      </div>

      {/* Waiver table */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Scale size={16} color={colors.primaryOrange} />
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Lien Waiver Tracker
          </span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>
            {totalWaivers} total · {receivedCount} received
          </span>
        </div>

        {waivers.length === 0 ? (
          <div style={{ padding: spacing['6'] }}>
            <EmptyState
              icon={<Scale size={28} color={colors.textTertiary} />}
              title="No lien waivers yet"
              description="Approve a pay application to auto-generate lien waiver requests for all active subs."
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 160px 110px 200px',
              gap: 0,
              backgroundColor: colors.surfaceInset,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              padding: `${spacing['2']} ${spacing['5']}`,
            }}>
              {['Sub Name', 'Pay Period', 'Waiver Type', 'Status', 'Actions'].map((h) => (
                <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                  {h}
                </span>
              ))}
            </div>

            {waivers.map((waiver, i) => {
              const statusCfg = LIEN_WAIVER_STATUS_CONFIG[waiver.status] ?? LIEN_WAIVER_STATUS_CONFIG.pending
              const payApp = payApps.find((a) => a.id === waiver.pay_app_id)
              const periodLabel = payApp ? fmtDate(payApp.period_to as string) : fmtDate(waiver.through_date)
              const typeLabel: Record<string, string> = {
                conditional_progress: 'Conditional Progress',
                unconditional_progress: 'Unconditional Progress',
                conditional_final: 'Conditional Final',
                unconditional_final: 'Unconditional Final',
              }
              const pdfData = lienWaiverDataFromRow(waiver, pdfContext)
              const pdfFileName = `LienWaiver_${(waiver.sub_name ?? 'sub').replace(/\s+/g, '_')}_${payApp?.application_number ?? 'PA'}.pdf`

              return (
                <div
                  key={waiver.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 160px 110px 200px',
                    gap: 0,
                    padding: `${spacing['3']} ${spacing['5']}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage,
                    alignItems: 'center',
                  }}
                >
                  {/* Sub Name */}
                  <div>
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      {waiver.sub_name ?? 'Unknown Sub'}
                    </p>
                    {waiver.amount != null && (
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {fmtCurrency(waiver.amount)}
                      </p>
                    )}
                  </div>

                  {/* Pay Period */}
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {periodLabel}
                  </span>

                  {/* Waiver Type */}
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {typeLabel[waiver.type] ?? waiver.type}
                  </span>

                  {/* Status */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                    padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                    color: statusCfg.color, backgroundColor: statusCfg.bg, width: 'fit-content',
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusCfg.color }} />
                    {statusCfg.label}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: spacing['2'] }}>
                    {waiver.status === 'pending' && (
                      <button
                        onClick={() => onMarkReceived(waiver.id)}
                        disabled={isMarkingReceived === waiver.id}
                        style={{
                          padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`,
                          borderRadius: borderRadius.base, backgroundColor: 'transparent',
                          color: colors.textSecondary, fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {isMarkingReceived === waiver.id ? 'Saving...' : 'Mark Received'}
                      </button>
                    )}
                    <Suspense fallback={
                      <button
                        style={{
                          padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`,
                          borderRadius: borderRadius.base, backgroundColor: 'transparent',
                          color: colors.textSecondary, fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                          cursor: 'default',
                        }}
                      >
                        <Download size={11} /> PDF
                      </button>
                    }>
                      <PDFDownloadLink document={<LienWaiverPDF data={pdfData} />} fileName={pdfFileName}>
                        {({ loading }: { loading: boolean }) => (
                          <button
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                              padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.primaryOrange}`,
                              borderRadius: borderRadius.base, backgroundColor: colors.orangeSubtle,
                              color: colors.orangeText, fontSize: typography.fontSize.caption,
                              fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            <Download size={11} /> {loading ? 'Building...' : 'Generate PDF'}
                          </button>
                        )}
                      </PDFDownloadLink>
                    </Suspense>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Compliance by pay app */}
      {approvedApps.length > 0 && (
        <Card padding={spacing['5']}>
          <SectionHeader title="Compliance by Pay Application" />
          <div style={{ marginTop: spacing['4'] }}>
            {approvedApps.map((app) => {
              const appWaivers = waivers.filter((w) => w.pay_app_id === (app.id as string))
              const collectionStatus = getWaiverCollectionStatus(appWaivers)
              const statusConfig = WAIVER_COLLECTION_CONFIG[collectionStatus]
              return (
                <div
                  key={app.id as string}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['3']} 0`, borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: borderRadius.base,
                    backgroundColor: statusConfig.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Scale size={14} color={statusConfig.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      Pay App #{app.application_number as number}
                    </p>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {fmtCurrency(app.current_payment_due as number)} · {fmtDate(app.period_to as string)}
                      {appWaivers.length > 0 && ` · ${appWaivers.length} waiver${appWaivers.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                    padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                    color: statusConfig.color, backgroundColor: statusConfig.bg,
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusConfig.color }} />
                    {statusConfig.label}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
})
LienWaiverPanel.displayName = 'LienWaiverPanel'

// ── Main Page ─────────────────────────────────────────────────

export const PaymentApplications: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('applications')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [markingWaiverId, setMarkingWaiverId] = useState<string | null>(null)
  const projectId = useProjectId()
  const queryClient = useQueryClient()
  const { data: payApps, isLoading: loadingApps } = usePayApplications(projectId)
  const { data: contracts, isLoading: loadingContracts } = useContracts(projectId)
  const { data: retainage, isLoading: loadingRetainage } = useRetainageLedger(projectId)
  const { data: lienWaivers } = useLienWaivers(projectId)
  const { data: project } = useProject(projectId)

  const apps = (payApps ?? []) as Array<Record<string, unknown>>
  const contractList = (contracts ?? []) as Array<Record<string, unknown>>
  const waivers = (lienWaivers ?? []) as LienWaiverRow[]
  const selectedApp = apps.find((a) => a.id === selectedAppId)

  const isLoading = loadingApps || loadingContracts || loadingRetainage

  // ── Approve pay app + auto-create lien waivers ──
  const approvePayAppMutation = useMutation({
    mutationFn: async (app: Record<string, unknown>) => {
      await approvePayApplication(app.id as string)
      const activeSubs = contractList.filter((c) => c.status !== 'terminated')
      await Promise.all(
        activeSubs.map((sub) =>
          createLienWaiver(
            projectId!,
            sub.id as string,
            app.id as string,
            'conditional_progress',
            {
              subName: sub.counterparty as string,
              amount: (sub.revised_value ?? sub.original_value) as number,
              throughDate: app.period_to as string,
            },
          ),
        ),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay_applications', projectId] })
      queryClient.invalidateQueries({ queryKey: ['lien_waivers', projectId] })
      toast.success('Pay app approved. Lien waiver requests created for all active subs.')
    },
    onError: () => toast.error('Failed to approve pay application'),
  })

  // ── Mark waiver received ──
  const markReceivedMutation = useMutation({
    mutationFn: async (waiverId: string) => {
      setMarkingWaiverId(waiverId)
      return updateLienWaiverStatus(waiverId, 'received')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lien_waivers', projectId] })
      toast.success('Lien waiver marked as received')
    },
    onError: () => toast.error('Failed to update waiver status'),
    onSettled: () => setMarkingWaiverId(null),
  })

  const handleApprove = useCallback(() => {
    if (selectedApp) approvePayAppMutation.mutate(selectedApp)
  }, [selectedApp, approvePayAppMutation])

  // Compute KPIs
  const kpis = useMemo(() => {
    const total = apps.length
    const totalDue = apps.reduce((s, a) => s + ((a.current_payment_due as number) || 0), 0)
    const totalPaid = apps.filter((a) => a.status === 'paid').reduce((s, a) => s + ((a.current_payment_due as number) || 0), 0)
    const pending = apps.filter((a) => a.status !== 'paid' && a.status !== 'void' && a.status !== 'draft').length
    const totalRetainage = apps.reduce((s, a) => s + ((a.retainage as number) || 0), 0)
    return { total, totalDue, totalPaid, pending, totalRetainage }
  }, [apps])

  return (
    <PageContainer
      title="Payment Applications"
      subtitle="AIA G702/G703 payment applications, lien waivers, and cash flow management"
    >
      {/* Tab Switcher */}
      <div style={{
        display: 'flex', gap: spacing['1'],
        backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
        padding: spacing['1'], marginBottom: spacing['2xl'], overflowX: 'auto',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none', borderRadius: borderRadius.base, cursor: 'pointer',
                fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`, whiteSpace: 'nowrap',
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* KPIs — only shown when there are real pay applications */}
      {!isLoading && apps.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          <MetricBox label="Total Applications" value={kpis.total} />
          <MetricBox label="Total Billed" value={fmtCurrency(kpis.totalDue)} />
          <MetricBox label="Total Paid" value={fmtCurrency(kpis.totalPaid)} change={1} />
          <MetricBox label="Retainage Held" value={fmtCurrency(kpis.totalRetainage)} />
        </div>
      )}

      {/* Empty state — no pay applications yet */}
      {!isLoading && apps.length === 0 && activeTab === 'applications' && (
        <Card padding={spacing['5']}>
          <EmptyState
            icon={<Receipt size={48} />}
            title="No Pay Applications Yet"
            description="Create your first AIA G702 pay application to start tracking billing, retainage, and lien waivers for this project."
            action={
              <PermissionGate permission="payments.create">
                <Btn variant="primary" icon={<Plus size={14} />} onClick={() => toast.info('Opening pay app generator...')}>New Pay Application</Btn>
              </PermissionGate>
            }
          />
        </Card>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* Create button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PermissionGate permission="payments.create">
              <Btn onClick={() => toast.info('Opening pay app generator...')} size="sm">
                <Plus size={14} /> New Pay Application
              </Btn>
            </PermissionGate>
          </div>

          {/* Selected app detail: G702 summary + SOV editor */}
          {selectedApp && projectId && (
            <PayAppDetail
              app={selectedApp}
              projectId={projectId}
              waivers={waivers}
              contracts={contractList}
              onApprove={handleApprove}
              isApproving={approvePayAppMutation.isPending}
            />
          )}

          {/* Table */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Payment Applications" />
            {apps.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                <DataTable
                  columns={payAppColumns}
                  data={apps}
                  onRowClick={(row) => setSelectedAppId(
                    selectedAppId === (row.id as string) ? null : (row.id as string),
                  )}
                />
              </div>
            ) : (
              <EmptyState
                icon={<Receipt size={32} color={colors.textTertiary} />}
                title="No payment applications"
                description="Create your first AIA G702 payment application from the schedule of values."
                action={
                  <Btn onClick={() => toast.info('Opening pay app generator...')} size="sm">
                    <Plus size={14} /> Create Pay App
                  </Btn>
                }
              />
            )}
          </Card>
        </div>
      )}

      {/* Lien Waivers Tab */}
      {activeTab === 'lien_waivers' && !isLoading && (
        <LienWaiverPanel
          payApps={apps}
          waivers={waivers}
          contracts={contractList}
          project={project as { name: string; address: string | null; owner_name: string | null; general_contractor: string | null; state: string | null } | undefined}
          onMarkReceived={(id) => markReceivedMutation.mutate(id)}
          isMarkingReceived={markingWaiverId}
        />
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cash_flow' && !isLoading && (
        <CashFlowPanel payApps={apps} retainage={(retainage ?? []) as Array<Record<string, unknown>>} />
      )}
    </PageContainer>
  )
}

export default PaymentApplications
