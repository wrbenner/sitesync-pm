import React, { useState, useMemo, useEffect, useCallback, memo, lazy, Suspense } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, FileText, CheckCircle, Clock, AlertTriangle,
  CreditCard, Send, Eye, Plus, ChevronRight, Building2,
  Scale, Receipt, ArrowRight, X, Save, Download,
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius, transitions, shadows, touchTarget } from '../styles/theme'
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
import { saveSOVProgress } from '../api/endpoints/budget'
import type { PayApplicationData } from '../api/endpoints/budget'
import { upsertPayApplication, approvePayApplication } from '../api/endpoints/payApplications'
import type { UpsertPayAppPayload } from '../api/endpoints/payApplications'
import { updateLienWaiverStatus, generateWaiversFromPayApp } from '../api/endpoints/lienWaivers'
import { generatePayAppPdfFromData, type PayAppPdfData } from '../services/pdf/paymentAppPdf'
import { LienWaiverPDF, lienWaiverDataFromRow } from '../components/export/LienWaiverPDF'
import type { LienWaiverRowContext, WaiverState } from '../components/export/LienWaiverPDF'
import { G702ApplicationPDF } from '../components/export/G702ApplicationPDF'
import { G703ContinuationPDF } from '../components/export/G703ContinuationPDF'
import { PermissionGate } from '../components/auth/PermissionGate'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useCopilotStore } from '../stores/copilotStore'
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

// Module-level ref allows the static column definitions to call into the component.
const _editPayAppCb: { current: (app: Record<string, unknown>) => void } = { current: () => {} }

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
          {(status === 'draft') && (
            <button
              aria-label="Edit Schedule of Values"
              title="Edit Schedule of Values"
              onClick={(e) => { e.stopPropagation(); _editPayAppCb.current(info.row.original) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                padding: `0 ${spacing['3']}`, minHeight: touchTarget.field, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base,
                backgroundColor: 'transparent', color: colors.textSecondary,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                cursor: 'pointer', fontFamily: typography.fontFamily,
              }}
            >
              Edit SOV
            </button>
          )}
          {status === 'approved' && (
            <button
              aria-label="Pay subcontractor"
              title="Pay subcontractor"
              onClick={() => toast.success('Payment flow initiated')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                padding: `0 ${spacing['3']}`, minHeight: touchTarget.field, border: 'none', borderRadius: borderRadius.base,
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
              aria-label="Submit application for review"
              title="Submit application for review"
              onClick={() => toast.success('Application submitted for review')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                padding: `0 ${spacing['3']}`, minHeight: touchTarget.field, border: 'none', borderRadius: borderRadius.base,
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

// ── G703 Drawer Types and Helpers ────────────────────────────

interface DraftSOVRow {
  key: string
  description: string
  scheduledValue: string
  prevPct: number
  thisPct: string
  storedMaterials: string
  error: string | null
}

function newBlankRow(index: number): DraftSOVRow {
  return {
    key: `row-${Date.now()}-${index}`,
    description: '',
    scheduledValue: '',
    prevPct: 0,
    thisPct: '0',
    storedMaterials: '0',
    error: null,
  }
}

function computeRowTotals(row: DraftSOVRow, retainageRatePct: number) {
  const sv = Math.max(0, parseFloat(row.scheduledValue) || 0)
  const prevPct = row.prevPct
  const thisPct = Math.min(100, Math.max(0, parseFloat(row.thisPct) || 0))
  const mats = Math.max(0, parseFloat(row.storedMaterials) || 0)
  const prevAmt = sv * (prevPct / 100)
  const thisAmt = sv * (thisPct / 100)
  const workThisPeriod = thisAmt - prevAmt
  const totalCompleted = thisAmt + mats
  const retainage = totalCompleted * (retainageRatePct / 100)
  const netPayment = totalCompleted - retainage - prevAmt
  return { sv, prevPct, thisPct, mats, prevAmt, workThisPeriod, thisAmt, totalCompleted, retainage, netPayment }
}

function computeG702FromRows(
  rows: DraftSOVRow[],
  retainageRatePct: number,
  originalContractSum: number,
  netChangeOrders: number,
  lessPrevCerts: number,
): G702Data {
  const totalCompletedAndStored = rows.reduce(
    (s, r) => s + computeRowTotals(r, retainageRatePct).totalCompleted, 0,
  )
  const contractSumToDate = originalContractSum + netChangeOrders
  const retainageAmount = Math.round(totalCompletedAndStored * (retainageRatePct / 100) * 100) / 100
  const totalEarnedLessRetainage = totalCompletedAndStored - retainageAmount
  const currentPaymentDue = totalEarnedLessRetainage - lessPrevCerts
  const balanceToFinish = contractSumToDate - totalCompletedAndStored
  return {
    applicationNumber: 0,
    periodTo: '',
    projectName: '',
    contractorName: '',
    originalContractSum,
    netChangeOrders,
    contractSumToDate,
    totalCompletedAndStored,
    retainagePercent: retainageRatePct,
    retainageAmount,
    totalEarnedLessRetainage,
    lessPreviousCertificates: lessPrevCerts,
    currentPaymentDue,
    balanceToFinish,
  }
}

// ── CreateEditPayAppDrawer ─────────────────────────────────────

interface CreateEditPayAppDrawerProps {
  open: boolean
  onClose: () => void
  projectId: string
  contracts: Array<Record<string, unknown>>
  editApp: Record<string, unknown> | null
  projectName: string
  onSaved: () => void
}

const DRAWER_WIDTH = 900

const CreateEditPayAppDrawer = memo<CreateEditPayAppDrawerProps>(({
  open, onClose, projectId, contracts, editApp, projectName, onSaved,
}) => {
  const queryClient = useQueryClient()
  const isEdit = editApp !== null

  // Load existing SOV when editing
  const appNumber = isEdit ? (editApp.application_number as number) : null
  const { data: existingSOV, isLoading: sovLoading } = usePayAppSOV(
    isEdit ? projectId : undefined,
    appNumber,
  )

  // Header form state
  const [periodTo, setPeriodTo] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [contractId, setContractId] = useState(() => contracts[0]?.id as string ?? '')
  const [retainageRate, setRetainageRate] = useState(10)
  const [originalContractSum, setOriginalContractSum] = useState(0)
  const [netChangeOrders, setNetChangeOrders] = useState(0)
  const [lessPrevCerts, setLessPrevCerts] = useState(0)

  // SOV rows
  const [rows, setRows] = useState<DraftSOVRow[]>(() =>
    Array.from({ length: 4 }, (_, i) => newBlankRow(i + 1)),
  )

  // Sync state from edit app / loaded SOV
  useEffect(() => {
    if (!open) return
    if (isEdit && editApp) {
      setPeriodTo((editApp.period_to as string) ?? '')
      setPeriodFrom((editApp.period_from as string) ?? '')
      setContractId((editApp.contract_id as string) ?? (contracts[0]?.id as string ?? ''))
      setOriginalContractSum((editApp.original_contract_sum as number) ?? 0)
      setNetChangeOrders((editApp.net_change_orders as number) ?? 0)
      setLessPrevCerts((editApp.less_previous_certificates as number) ?? 0)
    } else {
      setPeriodTo('')
      setPeriodFrom('')
      setContractId(contracts[0]?.id as string ?? '')
      setRetainageRate(10)
      setOriginalContractSum(0)
      setNetChangeOrders(0)
      setLessPrevCerts(0)
      setRows(Array.from({ length: 4 }, (_, i) => newBlankRow(i + 1)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit])

  // Once SOV loads for edit mode, populate rows and retainage
  useEffect(() => {
    if (!existingSOV) return
    setRetainageRate(existingSOV.retainageRate * 100)
    setOriginalContractSum(existingSOV.originalContractSum)
    setNetChangeOrders(existingSOV.netChangeOrders)
    setLessPrevCerts(existingSOV.lessPreviousCertificates)
    if (existingSOV.lineItems.length > 0) {
      setRows(existingSOV.lineItems.map((item) => ({
        key: item.id,
        description: item.description,
        scheduledValue: String(item.scheduled_value),
        prevPct: item.prev_pct_complete,
        thisPct: String(item.current_pct_complete),
        storedMaterials: String(item.stored_materials),
        error: null,
      })))
    }
  }, [existingSOV])

  // Live G702
  const g702 = useMemo(
    () => computeG702FromRows(rows, retainageRate, originalContractSum, netChangeOrders, lessPrevCerts),
    [rows, retainageRate, originalContractSum, netChangeOrders, lessPrevCerts],
  )

  // G703 items for PDF
  const g703Items = useMemo((): G703LineItem[] =>
    rows.map((row, i) => {
      const { sv, prevAmt, workThisPeriod, mats, totalCompleted, retainage } = computeRowTotals(row, retainageRate)
      return {
        itemNumber: String(i + 1),
        costCode: '',
        description: row.description || `Line Item ${i + 1}`,
        scheduledValue: sv,
        previousCompleted: prevAmt,
        thisPeroid: workThisPeriod,
        materialsStored: mats,
        totalCompletedAndStored: totalCompleted,
        percentComplete: sv > 0 ? (totalCompleted / sv) * 100 : 0,
        balanceToFinish: sv - totalCompleted,
        retainage,
      }
    }),
  [rows, retainageRate])

  const selectedContract = contracts.find((c) => c.id === contractId)

  const pdfG702: G702Data = useMemo(() => ({
    ...g702,
    applicationNumber: (editApp?.application_number as number) ?? 1,
    periodTo,
    projectName,
    contractorName: (selectedContract?.counterparty as string) ?? '',
  }), [g702, editApp, periodTo, projectName, selectedContract])

  // Row mutation handlers
  const handleRowField = useCallback((key: string, field: 'description' | 'scheduledValue' | 'storedMaterials', value: string) => {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, [field]: value } : r))
  }, [])

  const handleThisPct = useCallback((key: string, value: string) => {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r
      const pct = parseFloat(value) || 0
      let error: string | null = null
      if (pct < r.prevPct) {
        error = `Cannot decrease below prev application (${r.prevPct.toFixed(1)}%)`
      } else if (pct > 100) {
        error = 'Cannot exceed 100%'
      }
      return { ...r, thisPct: value, error }
    }))
  }, [])

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, newBlankRow(prev.length + 1)])
  }, [])

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }, [])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const hasErrors = rows.some((r) => r.error !== null)
      if (hasErrors) throw new Error('Fix validation errors before saving')
      if (!periodTo) throw new Error('Period To date is required')
      if (!contractId) throw new Error('A contract must be selected')

      const payload: UpsertPayAppPayload = {
        ...(editApp?.id ? { id: editApp.id as string } : {}),
        contract_id: contractId,
        period_to: periodTo,
        period_from: periodFrom || null,
        original_contract_sum: originalContractSum,
        net_change_orders: netChangeOrders,
        total_completed_and_stored: g702.totalCompletedAndStored,
        retainage: g702.retainageAmount,
        total_earned_less_retainage: g702.totalEarnedLessRetainage,
        less_previous_certificates: lessPrevCerts,
        current_payment_due: g702.currentPaymentDue,
        balance_to_finish: g702.balanceToFinish,
      }
      return upsertPayApplication(projectId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay_applications', projectId] })
      toast.success(isEdit ? 'Pay application updated' : 'Pay application created')
      onSaved()
      onClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save pay application'),
  })

  // Block background scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const hasRowErrors = rows.some((r) => r.error !== null)

  // ── G702 summary rows ──
  const g702Rows: Array<{ label: string; value: number; bold?: boolean; highlight?: boolean }> = [
    { label: '1. Original Contract Sum', value: g702.originalContractSum },
    { label: '2. Net Change by Change Orders', value: g702.netChangeOrders },
    { label: '3. Contract Sum to Date (1+2)', value: g702.contractSumToDate, bold: true },
    { label: '4. Total Completed and Stored to Date', value: g702.totalCompletedAndStored },
    { label: `5. Retainage (${retainageRate.toFixed(0)}% of Line 4)`, value: g702.retainageAmount },
    { label: '6. Total Earned Less Retainage (4−5)', value: g702.totalEarnedLessRetainage, bold: true },
    { label: '7. Less Previous Certificates for Payment', value: g702.lessPreviousCertificates },
    { label: '8. Current Payment Due (6−7)', value: g702.currentPaymentDue, bold: true, highlight: true },
    { label: '9. Balance to Finish (3−4)', value: g702.balanceToFinish },
  ]

  // ── Styles (shared with outer file conventions) ──
  const thStyle = (w: number | string, align: 'left' | 'right' | 'center' = 'right'): React.CSSProperties => ({
    width: typeof w === 'number' ? w : w,
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.semibold,
    textAlign: align,
    padding: `${spacing['2']} ${spacing['2']}`,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  })

  const tdStyle = (w: number | string, align: 'left' | 'right' | 'center' = 'right', extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: typeof w === 'number' ? w : w,
    fontSize: typography.fontSize.sm,
    textAlign: align,
    padding: `${spacing['1.5']} ${spacing['2']}`,
    flexShrink: 0,
    ...extra,
  })

  const inputStyle = (highlight = false): React.CSSProperties => ({
    width: '100%',
    padding: `${spacing['1']} ${spacing['2']}`,
    border: `1px solid ${highlight ? colors.primaryOrange : colors.borderDefault}`,
    borderRadius: borderRadius.base,
    fontSize: typography.fontSize.sm,
    fontFamily: highlight ? typography.fontFamilyMono : typography.fontFamily,
    textAlign: highlight ? 'right' as const : 'left' as const,
    color: colors.textPrimary,
    backgroundColor: highlight ? colors.orangeSubtle : colors.white,
    outline: 'none',
  })

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15,22,41,0.45)',
          zIndex: 1000,
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Edit Pay Application #${editApp?.application_number as number}` : 'New Pay Application'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: DRAWER_WIDTH,
          backgroundColor: colors.white,
          boxShadow: shadows.xl,
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['4']} ${spacing['5']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.white,
          flexShrink: 0,
        }}>
          <Receipt size={18} color={colors.primaryOrange} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              {isEdit ? `Edit Pay Application #${editApp?.application_number as number}` : 'New Pay Application'}
            </h2>
            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              AIA G702/G703 Schedule of Values
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: touchTarget.field, minHeight: touchTarget.field, border: 'none', borderRadius: borderRadius.base,
              backgroundColor: 'transparent', cursor: 'pointer', color: colors.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: spacing['5'], display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>

          {isEdit && sovLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="40px" />)}
            </div>
          )}

          {/* ── Section 1: Setup ── */}
          <Card padding={spacing['4']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
              <FileText size={14} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Application Details
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
              {/* Contract */}
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing['1'], fontWeight: typography.fontWeight.medium }}>
                  Contract *
                </label>
                <select
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.white, outline: 'none' }}
                >
                  {contracts.map((c) => (
                    <option key={c.id as string} value={c.id as string}>{c.counterparty as string}</option>
                  ))}
                  {contracts.length === 0 && <option value="">No contracts</option>}
                </select>
              </div>

              {/* Period From */}
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing['1'], fontWeight: typography.fontWeight.medium }}>
                  Period From
                </label>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.white, outline: 'none' }}
                />
              </div>

              {/* Period To */}
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing['1'], fontWeight: typography.fontWeight.medium }}>
                  Period To *
                </label>
                <input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${!periodTo ? colors.statusCritical : colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.white, outline: 'none' }}
                />
              </div>

              {/* Original Contract Sum */}
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing['1'], fontWeight: typography.fontWeight.medium }}>
                  Original Contract Sum
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={originalContractSum}
                  onChange={(e) => setOriginalContractSum(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary, backgroundColor: colors.white, outline: 'none', textAlign: 'right' }}
                />
              </div>

              {/* Net Change Orders */}
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing['1'], fontWeight: typography.fontWeight.medium }}>
                  Net Change by COs
                </label>
                <input
                  type="number"
                  step={100}
                  value={netChangeOrders}
                  onChange={(e) => setNetChangeOrders(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary, backgroundColor: colors.white, outline: 'none', textAlign: 'right' }}
                />
              </div>

              {/* Retainage Rate */}
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing['1'], fontWeight: typography.fontWeight.medium }}>
                  Retainage Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={retainageRate}
                  onChange={(e) => setRetainageRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary, backgroundColor: colors.white, outline: 'none', textAlign: 'right' }}
                />
              </div>
            </div>
          </Card>

          {/* ── Section 2: G703 SOV Table ── */}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <Receipt size={14} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                G703 Schedule of Values
              </span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>
                {rows.length} line item{rows.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 860 }}>
                {/* Header row */}
                <div style={{ display: 'flex', backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <span style={thStyle(32, 'center')}>#</span>
                  <span style={thStyle(180, 'left')}>Line Item</span>
                  <span style={thStyle(100)}>Sched. Value</span>
                  <span style={thStyle(72)}>Prev %</span>
                  <span style={{ ...thStyle(96), color: colors.primaryOrange }}>This Period %</span>
                  <span style={thStyle(100)}>Stored Mats</span>
                  <span style={thStyle(108)}>Total Completed</span>
                  <span style={thStyle(88)}>Retainage</span>
                  <span style={thStyle(96)}>Net Payment</span>
                  <span style={thStyle(36, 'center')} />
                </div>

                {rows.map((row, i) => {
                  const calc = computeRowTotals(row, retainageRate)
                  return (
                    <div key={row.key}>
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        borderBottom: row.error ? 'none' : `1px solid ${colors.borderSubtle}`,
                        backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage,
                      }}>
                        {/* # */}
                        <span style={tdStyle(32, 'center', { color: colors.textTertiary, fontFamily: typography.fontFamilyMono })}>
                          {i + 1}
                        </span>
                        {/* Description */}
                        <div style={tdStyle(180, 'left')}>
                          <input
                            type="text"
                            placeholder="Description of work"
                            aria-label={`Line item ${i + 1} description`}
                            value={row.description}
                            onChange={(e) => handleRowField(row.key, 'description', e.target.value)}
                            style={{ ...inputStyle(false), textAlign: 'left' }}
                          />
                        </div>
                        {/* Scheduled Value */}
                        <div style={tdStyle(100)}>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            placeholder="0"
                            aria-label={`Line item ${i + 1} scheduled value`}
                            value={row.scheduledValue}
                            onChange={(e) => handleRowField(row.key, 'scheduledValue', e.target.value)}
                            style={{ ...inputStyle(false), textAlign: 'right', fontFamily: typography.fontFamilyMono }}
                          />
                        </div>
                        {/* Prev % (readonly) */}
                        <span style={tdStyle(72, 'right', { color: colors.textSecondary, fontFamily: typography.fontFamilyMono })}>
                          {row.prevPct.toFixed(1)}%
                        </span>
                        {/* This Period % (editable, validated) */}
                        <div style={tdStyle(96)}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            placeholder="0"
                            aria-label={`Line item ${i + 1} percent complete this period`}
                            aria-invalid={!!row.error}
                            value={row.thisPct}
                            onChange={(e) => handleThisPct(row.key, e.target.value)}
                            style={{
                              ...inputStyle(true),
                              borderColor: row.error ? colors.statusCritical : colors.primaryOrange,
                              backgroundColor: row.error ? colors.statusCriticalSubtle : colors.orangeSubtle,
                            }}
                          />
                        </div>
                        {/* Stored Materials */}
                        <div style={tdStyle(100)}>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            placeholder="0"
                            aria-label={`Line item ${i + 1} stored materials`}
                            value={row.storedMaterials}
                            onChange={(e) => handleRowField(row.key, 'storedMaterials', e.target.value)}
                            style={{ ...inputStyle(false), textAlign: 'right', fontFamily: typography.fontFamilyMono }}
                          />
                        </div>
                        {/* Total Completed (calculated) */}
                        <span style={tdStyle(108, 'right', { fontFamily: typography.fontFamilyMono, color: colors.textPrimary })}>
                          {fmtCurrency(calc.totalCompleted)}
                        </span>
                        {/* Retainage (calculated) */}
                        <span style={tdStyle(88, 'right', { fontFamily: typography.fontFamilyMono, color: colors.statusPending })}>
                          {fmtCurrency(calc.retainage)}
                        </span>
                        {/* Net Payment (calculated) */}
                        <span style={tdStyle(96, 'right', { fontFamily: typography.fontFamilyMono, color: calc.netPayment >= 0 ? colors.statusActive : colors.statusCritical })}>
                          {fmtCurrency(calc.netPayment)}
                        </span>
                        {/* Remove */}
                        <div style={tdStyle(36, 'center')}>
                          <button
                            onClick={() => removeRow(row.key)}
                            aria-label="Remove row"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: touchTarget.field, minHeight: touchTarget.field, border: 'none', borderRadius: borderRadius.base, backgroundColor: 'transparent', cursor: 'pointer', color: colors.textTertiary }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      {/* Validation error row */}
                      {row.error && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2'],
                          padding: `${spacing['1']} ${spacing['4']}`,
                          backgroundColor: colors.statusCriticalSubtle,
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                        }}>
                          <AlertTriangle size={11} color={colors.statusCritical} />
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
                            {row.error}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Add row button */}
            <div style={{ padding: `${spacing['2']} ${spacing['4']}`, borderTop: `1px solid ${colors.borderSubtle}` }}>
              <button
                onClick={addRow}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['1.5']} ${spacing['3']}`,
                  border: `1px dashed ${colors.borderDefault}`,
                  borderRadius: borderRadius.base, backgroundColor: 'transparent',
                  color: colors.textSecondary, fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                }}
              >
                <Plus size={13} /> Add Line Item
              </button>
            </div>
          </Card>

          {/* ── Section 3: G702 Summary ── */}
          <Card padding={spacing['4']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
              <Scale size={14} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                AIA G702 Summary
              </span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive, backgroundColor: colors.statusActiveSubtle, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full, marginLeft: spacing['2'] }}>
                Live
              </span>
            </div>

            {/* Less Previous Certs (editable) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                7. Less Previous Certificates for Payment
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={lessPrevCerts}
                onChange={(e) => setLessPrevCerts(Math.max(0, parseFloat(e.target.value) || 0))}
                style={{ width: 140, padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, textAlign: 'right', color: colors.textPrimary, backgroundColor: colors.white, outline: 'none' }}
              />
            </div>

            {/* Read-only summary rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {g702Rows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: `${spacing['2']} ${row.highlight ? spacing['3'] : 0}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: row.highlight ? colors.orangeSubtle : 'transparent',
                    borderRadius: row.highlight ? borderRadius.base : 0,
                    marginBottom: row.highlight ? spacing['1'] : 0,
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
                    fontFamily: typography.fontFamilyMono,
                    color: row.highlight ? colors.primaryOrange : row.bold ? colors.textPrimary : colors.textSecondary,
                    fontWeight: row.bold || row.highlight ? typography.fontWeight.bold : typography.fontWeight.medium,
                  }}>
                    {fmtCurrency(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

        </div>

        {/* ── Drawer Footer ── */}
        <div style={{
          flexShrink: 0,
          borderTop: `1px solid ${colors.borderSubtle}`,
          padding: `${spacing['3']} ${spacing['5']}`,
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          backgroundColor: colors.white,
        }}>
          {/* Payment Due callout */}
          <div>
            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Current Payment Due</p>
            <p style={{ margin: 0, fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>
              {fmtCurrency(g702.currentPaymentDue)}
            </p>
          </div>

          <div style={{ flex: 1 }} />

          {/* PDF export buttons */}
          <Suspense fallback={<Btn variant="ghost" size="sm"><FileText size={14} /> G702 PDF</Btn>}>
            <PDFDownloadLink
              document={<G702ApplicationPDF data={pdfG702} />}
              fileName={`G702_App${pdfG702.applicationNumber}_${new Date().toISOString().slice(0, 10)}.pdf`}
            >
              {({ loading }: { loading: boolean }) => (
                <Btn variant="ghost" size="sm">
                  <FileText size={14} /> {loading ? 'Building...' : 'Export G702'}
                </Btn>
              )}
            </PDFDownloadLink>
          </Suspense>

          <Suspense fallback={<Btn variant="ghost" size="sm"><Receipt size={14} /> G703 PDF</Btn>}>
            <PDFDownloadLink
              document={
                <G703ContinuationPDF
                  projectName={pdfG702.projectName}
                  applicationNumber={pdfG702.applicationNumber}
                  periodTo={pdfG702.periodTo}
                  lineItems={g703Items}
                  summary={pdfG702}
                />
              }
              fileName={`G703_App${pdfG702.applicationNumber}_${new Date().toISOString().slice(0, 10)}.pdf`}
            >
              {({ loading }: { loading: boolean }) => (
                <Btn variant="ghost" size="sm">
                  <Receipt size={14} /> {loading ? 'Building...' : 'Export G703'}
                </Btn>
              )}
            </PDFDownloadLink>
          </Suspense>

          <Btn variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Btn>

          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || hasRowErrors || !periodTo}
            >
              <Save size={14} />
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Pay App' : 'Save Draft'}
            </Btn>
          </PermissionGate>
        </div>
      </div>
    </>
  )
})
CreateEditPayAppDrawer.displayName = 'CreateEditPayAppDrawer'

// ── G702 Summary Card ─────────────────────────────────────────

const G702SummaryCard = memo<{
  app: Record<string, unknown>
  liveG702?: G702Data
  liveG703?: G703LineItem[]
  onApprove?: () => void
  isApproving?: boolean
  hasPendingWaivers?: boolean
}>(({ app, liveG702, liveG703, onApprove, isApproving, hasPendingWaivers }) => {
  const [isPdfExporting, setIsPdfExporting] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150)
    }
    window.addEventListener('resize', handleResize)
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize) }
  }, [])

  const handleExportG702G703 = useCallback(async () => {
    setIsPdfExporting(true)
    try {
      const appNum = app.application_number as number
      const pdfData: PayAppPdfData = liveG702
        ? {
            applicationNumber: liveG702.applicationNumber,
            periodTo: liveG702.periodTo,
            periodFrom: app.period_from as string | null,
            status: app.status as string,
            projectName: liveG702.projectName,
            contractorName: liveG702.contractorName,
            originalContractSum: liveG702.originalContractSum,
            netChangeOrders: liveG702.netChangeOrders,
            contractSumToDate: liveG702.contractSumToDate,
            totalCompletedAndStored: liveG702.totalCompletedAndStored,
            retainagePercent: liveG702.retainagePercent,
            retainageAmount: liveG702.retainageAmount,
            totalEarnedLessRetainage: liveG702.totalEarnedLessRetainage,
            lessPreviousCertificates: liveG702.lessPreviousCertificates,
            currentPaymentDue: liveG702.currentPaymentDue,
            balanceToFinish: liveG702.balanceToFinish,
            sovLines: liveG703?.map((l) => ({
              itemNumber: l.itemNumber,
              description: l.description,
              scheduledValue: l.scheduledValue,
              previousCompleted: l.previousCompleted,
              thisPeroid: l.thisPeroid,
              materialsStored: l.materialsStored,
              totalCompletedAndStored: l.totalCompletedAndStored,
              percentComplete: l.percentComplete,
              balanceToFinish: l.balanceToFinish,
              retainage: l.retainage,
            })),
          }
        : {
            applicationNumber: appNum,
            periodTo: app.period_to as string,
            periodFrom: app.period_from as string | null,
            status: app.status as string,
            projectName: 'Project',
            originalContractSum: (app.original_contract_sum as number) ?? 0,
            netChangeOrders: (app.net_change_orders as number) ?? 0,
            contractSumToDate: (app.contract_sum_to_date as number) ?? 0,
            totalCompletedAndStored: (app.total_completed_and_stored as number) ?? 0,
            retainagePercent: 10,
            retainageAmount: (app.retainage as number) ?? 0,
            totalEarnedLessRetainage: (app.total_earned_less_retainage as number) ?? 0,
            lessPreviousCertificates: (app.less_previous_certificates as number) ?? 0,
            currentPaymentDue: (app.current_payment_due as number) ?? 0,
            balanceToFinish: (app.balance_to_finish as number) ?? 0,
          }
      const blob = await generatePayAppPdfFromData(pdfData)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `G702_G703_App${appNum}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setIsPdfExporting(false)
    }
  }, [app, liveG702, liveG703])

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
    <>
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
        <button
          onClick={handleExportG702G703}
          disabled={isPdfExporting || (app.status as string) === 'draft'}
          title={(app.status as string) === 'draft' ? 'Submit pay app before exporting' : undefined}
          aria-label="Export AIA G702 G703 payment application as PDF"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['1.5'],
            height: '40px',
            padding: `0 ${spacing['4']}`,
            backgroundColor:
              isPdfExporting || (app.status as string) === 'draft'
                ? colors.textTertiary
                : colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor:
              isPdfExporting || (app.status as string) === 'draft' ? 'not-allowed' : 'pointer',
            opacity: (app.status as string) === 'draft' ? 0.5 : 1,
            transition: transitions.base,
            flexShrink: 0,
          }}
        >
          {isPdfExporting ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <Download size={14} />
              Export G702/G703
            </>
          )}
        </button>
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
        {/* Approval buttons — hidden on mobile, shown in sticky bottom bar instead */}
        {!isMobile && (['submitted', 'gc_review', 'owner_review'] as string[]).includes(app.status as string) && onApprove && (
          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={onApprove}
              disabled={isApproving || hasPendingWaivers}
              title={hasPendingWaivers ? 'Collect all lien waivers before approving' : undefined}
            >
              <CheckCircle size={14} /> {isApproving ? 'Approving...' : 'Approve Pay App'}
            </Btn>
          </PermissionGate>
        )}
        {!isMobile && (app.status as string) === 'approved' && (
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

    {/* Mobile sticky bottom bar for approval buttons */}
    {isMobile && (
      <div style={{
        position: 'sticky',
        bottom: 0,
        padding: spacing['3'],
        backgroundColor: colors.white,
        borderTop: '1px solid ' + colors.borderDefault,
        display: 'flex',
        gap: spacing['2'],
        zIndex: 10,
      }}>
        {(['submitted', 'gc_review', 'owner_review'] as string[]).includes(app.status as string) && onApprove && (
          <PermissionGate permission="payments.create">
            <Btn
              variant="primary"
              size="sm"
              onClick={onApprove}
              disabled={isApproving || hasPendingWaivers}
              title={hasPendingWaivers ? 'Collect all lien waivers before approving' : undefined}
              style={{ minHeight: 56, minWidth: 56 }}
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
              style={{ minHeight: 56, minWidth: 56 }}
            >
              <CreditCard size={14} /> Process Payment
            </Btn>
          </PermissionGate>
        )}
      </div>
    )}
  </>
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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const queryClient = useQueryClient()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150)
    }
    window.addEventListener('resize', handleResize)
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize) }
  }, [])

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
      <div style={{ overflowX: 'auto', ...(isMobile ? { WebkitOverflowScrolling: 'touch' } as React.CSSProperties : {}) }}>
        <div style={{ minWidth: 820 }}>
          <div style={{ display: 'flex', backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <span style={colStyle('4%', 'center')}>#</span>
            <span style={{ ...colStyle('22%', 'left'), ...(isMobile ? { position: 'sticky', left: 0, zIndex: 2, backgroundColor: colors.surfaceInset, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' } : {}) }}>Description</span>
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
                <span style={{ ...cellStyle('22%', 'left', { color: colors.textPrimary }), ...(isMobile ? { position: 'sticky', left: 0, zIndex: 2, backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' } : {}) }} title={item.description}>
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
  onMarkReceived: (id: string) => void
  onMarkExecuted: (id: string) => void
  markingWaiverId: string | null
}>(({ app, projectId, waivers, contracts, onApprove, isApproving, onMarkReceived, onMarkExecuted, markingWaiverId }) => {
  const appNumber = app.application_number as number
  const { data: sovData, isLoading: sovLoading } = usePayAppSOV(projectId, appNumber)
  const [liveG702, setLiveG702] = useState<G702Data | undefined>()
  const [liveG703, setLiveG703] = useState<G703LineItem[] | undefined>()
  const [detailTab, setDetailTab] = useState<'g702' | 'lien_waivers'>('g702')

  const appWaivers = waivers.filter((w) => w.pay_application_id === (app.id as string))
  const pendingWaivers = appWaivers.filter((w) => w.status === 'pending')
  // Show blocking warning whenever this pay app has pending waivers
  const showMissingWarning = pendingWaivers.length > 0

  const handleLiveData = useCallback((g702: G702Data, g703: G703LineItem[]) => {
    setLiveG702(g702)
    setLiveG703(g703)
  }, [])

  const typeLabel: Record<string, string> = {
    conditional_progress: 'Conditional Progress',
    unconditional_progress: 'Unconditional Progress',
    conditional_final: 'Conditional Final',
    unconditional_final: 'Unconditional Final',
  }

  const appStatus = app.status as string

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {/* Detail header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Pay Application #{appNumber}
        </span>
        {(appStatus === 'submitted' || appStatus === 'approved') && (
          <PermissionGate permission="financials.edit">
            <button
              onClick={() => toast.info('PDF generation coming soon')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none', borderRadius: borderRadius.md,
                backgroundColor: colors.primaryOrange, color: colors.white,
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                cursor: 'pointer', fontFamily: typography.fontFamily,
              }}
            >
              <FileText size={14} /> Generate AIA G702/G703
            </button>
          </PermissionGate>
        )}
      </div>

      {showMissingWarning && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
          padding: spacing['4'], backgroundColor: colors.statusCriticalSubtle,
          borderRadius: borderRadius.base, borderLeft: `3px solid ${colors.statusCritical}`,
        }}>
          <AlertTriangle size={16} color={colors.statusCritical} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Pending Lien Waivers
            </p>
            <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
              {pendingWaivers.length} waiver{pendingWaivers.length !== 1 ? 's' : ''} missing. Cannot submit pay app to owner until all waivers are received or executed.
            </p>
          </div>
        </div>
      )}

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: spacing['1'], borderBottom: `1px solid ${colors.borderSubtle}`, paddingBottom: spacing['3'] }}>
        {([
          { key: 'g702', label: 'G702 / SOV' },
          { key: 'lien_waivers', label: `Lien Waivers${appWaivers.length > 0 ? ` (${appWaivers.length})` : ''}` },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            style={{
              padding: `${spacing['1.5']} ${spacing['3']}`,
              border: 'none',
              borderRadius: borderRadius.base,
              backgroundColor: detailTab === t.key ? colors.primaryOrange : 'transparent',
              color: detailTab === t.key ? colors.white : colors.textSecondary,
              fontSize: typography.fontSize.sm,
              fontWeight: detailTab === t.key ? typography.fontWeight.semibold : typography.fontWeight.normal,
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* G702 / SOV tab */}
      {detailTab === 'g702' && (
        <>
          <G702SummaryCard
            app={app}
            liveG702={liveG702}
            liveG703={liveG703}
            onApprove={onApprove}
            isApproving={isApproving}
            hasPendingWaivers={pendingWaivers.length > 0}
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
        </>
      )}

      {/* Lien Waivers tab */}
      {detailTab === 'lien_waivers' && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{
            padding: `${spacing['4']} ${spacing['5']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            display: 'flex', alignItems: 'center', gap: spacing['2'],
          }}>
            <Scale size={16} color={colors.primaryOrange} />
            <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Lien Waivers
            </span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>
              {appWaivers.length} total · {appWaivers.filter((w) => w.status !== 'pending').length} collected
            </span>
          </div>

          {/* Blocking warning banner */}
          {pendingWaivers.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['3']} ${spacing['5']}`,
              backgroundColor: colors.statusCriticalSubtle,
              borderBottom: `1px solid ${colors.statusCritical}`,
            }}>
              <AlertTriangle size={14} color={colors.statusCritical} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
                {pendingWaivers.length} waiver{pendingWaivers.length !== 1 ? 's' : ''} missing. Cannot submit pay app to owner.
              </span>
            </div>
          )}

          {appWaivers.length === 0 ? (
            <div style={{ padding: spacing['6'] }}>
              <EmptyState
                icon={<Scale size={28} color={colors.textTertiary} />}
                title="No lien waivers yet"
                description={
                  (['approved', 'paid'] as string[]).includes(app.status as string)
                    ? 'No subcontractor line items with payment were found on this pay app.'
                    : 'Approve this pay app to auto-generate conditional lien waiver requests for all subs with payment.'
                }
              />
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 110px 110px 180px', gap: 0,
                backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}`,
                padding: `${spacing['2']} ${spacing['5']}`,
              }}>
                {['Sub Name', 'Type', 'Amount', 'Status', 'Actions'].map((h) => (
                  <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                    {h}
                  </span>
                ))}
              </div>

              {appWaivers.map((waiver, i) => {
                const sub = contracts.find((c) => c.id === waiver.subcontractor_id)
                const subName = (sub?.counterparty as string) ?? waiver.subcontractor_id
                const isOverdue = waiver.status === 'pending' &&
                  new Date(waiver.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now()
                const displayStatus: LienWaiverStatus | 'overdue' = isOverdue ? 'overdue' : waiver.status
                const statusCfg = LIEN_WAIVER_STATUS_CONFIG[displayStatus] ?? LIEN_WAIVER_STATUS_CONFIG.pending
                const busy = markingWaiverId === waiver.id

                return (
                  <div
                    key={waiver.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 140px 110px 110px 180px', gap: 0,
                      padding: `${spacing['3']} ${spacing['5']}`,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                      backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage,
                      alignItems: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      {subName}
                    </p>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      {typeLabel[waiver.waiver_type] ?? waiver.waiver_type}
                    </span>
                    <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>
                      {fmtCurrency(waiver.amount)}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                      color: statusCfg.color, backgroundColor: statusCfg.bg, width: 'fit-content',
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusCfg.color }} />
                      {statusCfg.label}
                    </span>
                    <div style={{ display: 'flex', gap: spacing['2'] }}>
                      {waiver.status === 'pending' && (
                        <button
                          onClick={() => onMarkReceived(waiver.id)}
                          disabled={busy}
                          style={{
                            padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
                            borderRadius: borderRadius.base, backgroundColor: 'transparent',
                            color: colors.textSecondary, fontSize: typography.fontSize.caption,
                            fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                            cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {busy ? 'Saving...' : 'Mark Received'}
                        </button>
                      )}
                      {waiver.status === 'received' && (
                        <button
                          onClick={() => onMarkExecuted(waiver.id)}
                          disabled={busy}
                          style={{
                            padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.statusInfo}`,
                            borderRadius: borderRadius.base, backgroundColor: colors.statusInfoSubtle,
                            color: colors.statusInfo, fontSize: typography.fontSize.caption,
                            fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                            cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {busy ? 'Saving...' : 'Mark Executed'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
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
  if (waivers.some((w) => w.status === 'received')) return 'received'
  return 'pending'
}

function stateToWaiverState(state: string | null | undefined): WaiverState {
  const map: Record<string, WaiverState> = {
    CA: 'california', TX: 'texas', FL: 'florida', NY: 'new_york',
  }
  return (state && map[state.toUpperCase()]) || 'generic'
}

const LIEN_WAIVER_STATUS_CONFIG: Record<LienWaiverStatus | 'overdue', { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: colors.statusPending,  bg: colors.statusPendingSubtle },
  received: { label: 'Received', color: colors.statusActive,   bg: colors.statusActiveSubtle },
  executed: { label: 'Executed', color: colors.statusInfo,     bg: colors.statusInfoSubtle },
  overdue:  { label: 'Overdue',  color: colors.statusCritical, bg: colors.statusCriticalSubtle },
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
  onMarkExecuted: (id: string) => void
  isMarkingReceived: string | null
  onGenerateAll: (payAppId: string) => void
  isGenerating: boolean
}>(({ payApps, waivers, contracts, project, onMarkReceived, onMarkExecuted, isMarkingReceived, onGenerateAll, isGenerating }) => {
  const [selectedPayAppId, setSelectedPayAppId] = React.useState<string>('')
  const approvedApps = payApps.filter((a) => a.status === 'approved' || a.status === 'paid')

  // Summary metrics
  const totalWaivers = waivers.length
  const receivedCount = waivers.filter((w) => w.status === 'received' || w.status === 'executed').length
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

      {/* Blocking warning banner */}
      {pendingCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          backgroundColor: colors.statusCriticalSubtle,
          borderRadius: borderRadius.base,
          borderLeft: `3px solid ${colors.statusCritical}`,
        }}>
          <AlertTriangle size={14} color={colors.statusCritical} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
            {pendingCount} waiver{pendingCount !== 1 ? 's' : ''} missing. Cannot submit pay app to owner.
          </span>
        </div>
      )}

      {/* Waiver table */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
          <Scale size={16} color={colors.primaryOrange} />
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Lien Waiver Tracker
          </span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {totalWaivers} total · {receivedCount} collected
          </span>
          {/* Generate All controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            {approvedApps.length > 0 && (
              <>
                <select
                  value={selectedPayAppId}
                  onChange={(e) => setSelectedPayAppId(e.target.value)}
                  style={{
                    padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base, fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily, color: colors.textPrimary,
                    backgroundColor: colors.white, cursor: 'pointer',
                  }}
                >
                  <option value="">Select pay app...</option>
                  {approvedApps.map((a) => (
                    <option key={a.id as string} value={a.id as string}>
                      Pay App #{a.application_number as number} ({fmtDate(a.period_to as string)})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => selectedPayAppId && onGenerateAll(selectedPayAppId)}
                  disabled={!selectedPayAppId || isGenerating}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                    padding: `${spacing['1.5']} ${spacing['3']}`,
                    border: `1px solid ${colors.primaryOrange}`, borderRadius: borderRadius.base,
                    backgroundColor: selectedPayAppId ? colors.orangeSubtle : colors.surfaceInset,
                    color: selectedPayAppId ? colors.orangeText : colors.textTertiary,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    cursor: selectedPayAppId && !isGenerating ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={13} />
                  {isGenerating ? 'Generating...' : 'Generate All'}
                </button>
              </>
            )}
          </div>
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
              gridTemplateColumns: '1fr 140px 110px 110px 110px 220px',
              gap: 0,
              backgroundColor: colors.surfaceInset,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              padding: `${spacing['2']} ${spacing['5']}`,
            }}>
              {['Sub Name', 'Type', 'Amount', 'Status', 'Waiver Date', 'Actions'].map((h) => (
                <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                  {h}
                </span>
              ))}
            </div>

            {waivers.map((waiver, i) => {
              const isOverdue = waiver.status === 'pending' && new Date(waiver.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now()
              const displayStatus: LienWaiverStatus | 'overdue' = isOverdue ? 'overdue' : waiver.status
              const statusCfg = LIEN_WAIVER_STATUS_CONFIG[displayStatus] ?? LIEN_WAIVER_STATUS_CONFIG.pending
              const payApp = payApps.find((a) => a.id === waiver.pay_application_id)
              const typeLabel: Record<string, string> = {
                conditional_progress: 'Conditional Progress',
                unconditional_progress: 'Unconditional Progress',
                conditional_final: 'Conditional Final',
                unconditional_final: 'Unconditional Final',
              }
              const subName = (contracts.find((c) => c.id === waiver.subcontractor_id)?.counterparty as string) ?? null
              const pdfData = lienWaiverDataFromRow({
                type: waiver.waiver_type,
                sub_name: subName,
                amount: waiver.amount,
                through_date: waiver.payment_period,
                signed_by: null,
                signed_date: waiver.waiver_date,
              }, pdfContext)
              const pdfFileName = `LienWaiver_${(subName ?? 'sub').replace(/\s+/g, '_')}_${payApp?.application_number ?? 'PA'}.pdf`
              const busy = isMarkingReceived === waiver.id

              return (
                <div
                  key={waiver.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 110px 110px 110px 220px',
                    gap: 0,
                    padding: `${spacing['3']} ${spacing['5']}`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage,
                    alignItems: 'center',
                  }}
                >
                  {/* Sub Name */}
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    {subName ?? 'Unknown Sub'}
                  </p>

                  {/* Type */}
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                    {typeLabel[waiver.waiver_type] ?? waiver.waiver_type}
                  </span>

                  {/* Amount */}
                  <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>
                    {fmtCurrency(waiver.amount)}
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

                  {/* Waiver Date */}
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                    {waiver.waiver_date ? fmtDate(waiver.waiver_date) : (waiver.received_at ? fmtDate(waiver.received_at) : '')}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
                    {waiver.status === 'pending' && (
                      <button
                        onClick={() => onMarkReceived(waiver.id)}
                        disabled={busy}
                        style={{
                          padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
                          borderRadius: borderRadius.base, backgroundColor: 'transparent',
                          color: colors.textSecondary, fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                          cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {busy ? 'Saving...' : 'Mark Received'}
                      </button>
                    )}
                    {waiver.status === 'received' && (
                      <button
                        onClick={() => onMarkExecuted(waiver.id)}
                        disabled={busy}
                        style={{
                          padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.statusInfo}`,
                          borderRadius: borderRadius.base, backgroundColor: colors.statusInfoSubtle,
                          color: colors.statusInfo, fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                          cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {busy ? 'Saving...' : 'Mark Executed'}
                      </button>
                    )}
                    <Suspense fallback={
                      <button
                        style={{
                          padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
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
                              padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.primaryOrange}`,
                              borderRadius: borderRadius.base, backgroundColor: colors.orangeSubtle,
                              color: colors.orangeText, fontSize: typography.fontSize.caption,
                              fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            <Download size={11} /> {loading ? 'Building...' : 'PDF'}
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
              const appWaivers = waivers.filter((w) => w.pay_application_id === (app.id as string))
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

const PaymentApplicationsPage: React.FC = () => {
  const { setPageContext } = useCopilotStore()
  useEffect(() => { setPageContext('payment-applications') }, [setPageContext])

  const [activeTab, setActiveTab] = useState<TabKey>('applications')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [markingWaiverId, setMarkingWaiverId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerEditApp, setDrawerEditApp] = useState<Record<string, unknown> | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150)
    }
    window.addEventListener('resize', handleResize)
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize) }
  }, [])

  const openCreateDrawer = useCallback(() => {
    setDrawerEditApp(null)
    setDrawerOpen(true)
  }, [])

  const openEditDrawer = useCallback((app: Record<string, unknown>) => {
    setDrawerEditApp(app)
    setDrawerOpen(true)
  }, [])

  // Keep module-level ref in sync so static column definitions can invoke the drawer.
  _editPayAppCb.current = openEditDrawer
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
      return approvePayApplication(projectId!, app.id as string)
    },
    onSuccess: ({ waivers: created }) => {
      queryClient.invalidateQueries({ queryKey: ['pay_applications', projectId] })
      queryClient.invalidateQueries({ queryKey: ['lien_waivers', projectId] })
      toast.success(
        created.length > 0
          ? `Pay app approved. ${created.length} lien waiver${created.length !== 1 ? 's' : ''} generated.`
          : 'Pay app approved.',
      )
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

  // ── Mark waiver executed ──
  const markExecutedMutation = useMutation({
    mutationFn: async (waiverId: string) => {
      setMarkingWaiverId(waiverId)
      return updateLienWaiverStatus(waiverId, 'executed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lien_waivers', projectId] })
      toast.success('Lien waiver marked as executed')
    },
    onError: () => toast.error('Failed to update waiver status'),
    onSettled: () => setMarkingWaiverId(null),
  })

  // ── Generate waivers for a pay app ──
  const generateAllMutation = useMutation({
    mutationFn: async (payAppId: string) => {
      if (!projectId) throw new Error('No project selected')
      return generateWaiversFromPayApp(projectId, payAppId)
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['lien_waivers', projectId] })
      toast.success(
        created.length > 0
          ? `${created.length} conditional waiver${created.length !== 1 ? 's' : ''} generated`
          : 'Waivers already exist for this pay app',
      )
    },
    onError: () => toast.error('Failed to generate waivers'),
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* KPIs — only shown when there are real pay applications */}
      {!isLoading && apps.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
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
                <Btn variant="primary" icon={<Plus size={14} />} onClick={openCreateDrawer}>New Pay Application</Btn>
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
              <Btn onClick={openCreateDrawer} size="sm">
                <Plus size={14} /> New Pay Application
              </Btn>
            </PermissionGate>
          </div>

          {/* Selected app detail: G702 summary + SOV editor + lien waivers */}
          {selectedApp && projectId && (
            <PayAppDetail
              app={selectedApp}
              projectId={projectId}
              waivers={waivers}
              contracts={contractList}
              onApprove={handleApprove}
              isApproving={approvePayAppMutation.isPending}
              onMarkReceived={(id) => markReceivedMutation.mutate(id)}
              onMarkExecuted={(id) => markExecutedMutation.mutate(id)}
              markingWaiverId={markingWaiverId}
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
                  <Btn onClick={openCreateDrawer} size="sm">
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
          onMarkExecuted={(id) => markExecutedMutation.mutate(id)}
          isMarkingReceived={markingWaiverId}
          onGenerateAll={(payAppId) => generateAllMutation.mutate(payAppId)}
          isGenerating={generateAllMutation.isPending}
        />
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cash_flow' && !isLoading && (
        <CashFlowPanel payApps={apps} retainage={(retainage ?? []) as Array<Record<string, unknown>>} />
      )}

      {/* Create / Edit Pay App Drawer */}
      <CreateEditPayAppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projectId={projectId ?? ''}
        contracts={contractList}
        editApp={drawerEditApp}
        projectName={project?.name ?? ''}
        onSaved={() => {
          setSelectedAppId(null)
        }}
      />
    </PageContainer>
  )
}

export const PaymentApplications: React.FC = () => (
  <ErrorBoundary message="Payment applications could not be displayed. Check your connection and try again.">
    <PaymentApplicationsPage />
  </ErrorBoundary>
)

export default PaymentApplications
