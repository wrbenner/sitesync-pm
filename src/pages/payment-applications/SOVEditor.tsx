import React, { useState, useMemo, useEffect, useCallback, memo, lazy, Suspense } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, AlertTriangle, Send, Plus, Scale, Receipt, X, Save, WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { syncManager } from '../../lib/syncManager'
import { useIsOnline } from '../../hooks/useOfflineStatus'
import { Card, Btn, Skeleton, EmptyState } from '../../components/Primitives'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { colors, spacing, typography, borderRadius, shadows, touchTarget } from '../../styles/theme'
import { usePayAppSOV } from '../../hooks/queries'
import {
  calculateG702,
  calculateG703LineItem,
} from '../../machines/paymentMachine'
import type { G702Data, G703LineItem } from '../../machines/paymentMachine'
import { saveSOVProgress } from '../../api/endpoints/budget'
import type { PayApplicationData } from '../../api/endpoints/budget'
import { upsertPayApplication } from '../../api/endpoints/payApplications'
import type { UpsertPayAppPayload } from '../../api/endpoints/payApplications'
// Lazy-loaded so vendor-pdf-gen (~1.8MB; @react-pdf/renderer) stays out of
// the SOVEditor chunk and only loads when the user opens the PDF preview /
// download link. Day 27 — bundle attack.
const G702ApplicationPDF = lazy(() =>
  import('../../components/export/G702ApplicationPDF').then((m) => ({ default: m.G702ApplicationPDF })),
)
const G703ContinuationPDF = lazy(() =>
  import('../../components/export/G703ContinuationPDF').then((m) => ({ default: m.G703ContinuationPDF })),
)
import {
  fmtCurrency,
  newBlankRow,
  computeRowTotals,
  computeG702FromRows,
  type DraftSOVRow,
} from './types'
import { useIsMobile } from '../../hooks/useWindowSize'

const PDFDownloadLink = lazy(() =>
  import('@react-pdf/renderer').then((m) => ({ default: m.PDFDownloadLink })),
)

// ── SOVEditorPanel: edit SOV for an existing pay app ──────────

interface SOVEditorPanelProps {
  sovData: PayApplicationData
  appStatus: string
  projectId: string
  onLiveDataChange: (g702: G702Data, g703: G703LineItem[]) => void
}

export const SOVEditorPanel = memo<SOVEditorPanelProps>(({ sovData, appStatus, projectId, onLiveDataChange }) => {
  const [edits, setEdits] = useState<Record<string, { pct: number; materials: number }>>({})
  const [isDirty, setIsDirty] = useState(false)
  // REACT-03 FIX: Shared hook replaces a per-page resize listener.
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const isOnline = useIsOnline()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`pay-apps-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pay_applications', filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pay_app_sov', projectId, sovData.applicationNumber] })
          queryClient.invalidateQueries({ queryKey: ['pay_applications', projectId] })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, sovData.applicationNumber, queryClient])

  useEffect(() => {
    const initial: Record<string, { pct: number; materials: number }> = {}
    for (const item of sovData.lineItems) {
      initial[item.id] = { pct: item.current_pct_complete, materials: item.stored_materials }
    }
    setTimeout(() => {
      setEdits(initial)
      setIsDirty(false)
    }, 0)
  }, [sovData])

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
      if (!navigator.onLine) {
        await syncManager.queueOfflineMutation('pay_applications', 'update', {
          id: sovData.payAppId,
          total_completed_and_stored: liveG702.totalCompletedAndStored,
          retainage: liveG702.retainageAmount,
          total_earned_less_retainage: liveG702.totalEarnedLessRetainage,
          current_payment_due: liveG702.currentPaymentDue,
          balance_to_finish: liveG702.balanceToFinish,
          status: submit ? 'in_review' : undefined,
          line_items: updates,
        })
        return { queuedOffline: true }
      }
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
      return { queuedOffline: false }
    },
    onSuccess: (result, { submit }) => {
      queryClient.invalidateQueries({ queryKey: ['pay_app_sov', projectId, sovData.applicationNumber] })
      queryClient.invalidateQueries({ queryKey: ['pay_applications', projectId] })
      setIsDirty(false)
      if (result?.queuedOffline) {
        toast.info('Saved offline \u2014 will sync when connected')
      } else {
        toast.success(submit ? 'Application submitted for review' : 'SOV progress saved')
      }
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
    <Card padding="0" style={{ overflow: 'hidden' }}>
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
        {!isOnline && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.statusCritical, backgroundColor: colors.statusCriticalSubtle, padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full }}>
            <WifiOff size={11} /> Offline
          </span>
        )}
      </div>

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
          <p style={{ margin: 0, fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>{fmtCurrency(liveG702.currentPaymentDue)}</p>
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
            <PermissionGate permission="financials.edit">
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

// ── CreateEditPayAppDrawer: create or edit a pay app with SOV ────

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

export const CreateEditPayAppDrawer = memo<CreateEditPayAppDrawerProps>(({
  open, onClose, projectId, contracts, editApp, projectName, onSaved,
}) => {
  const queryClient = useQueryClient()
  const isEdit = editApp !== null

  const appNumber = isEdit ? (editApp.application_number as number) : null
  const { data: existingSOV, isLoading: sovLoading } = usePayAppSOV(
    isEdit ? projectId : undefined,
    appNumber,
  )

  const [periodTo, setPeriodTo] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [contractId, setContractId] = useState(() => contracts[0]?.id as string ?? '')
  const [retainageRate, setRetainageRate] = useState(10)
  const [originalContractSum, setOriginalContractSum] = useState(0)
  const [netChangeOrders, setNetChangeOrders] = useState(0)
  const [lessPrevCerts, setLessPrevCerts] = useState(0)

  const [rows, setRows] = useState<DraftSOVRow[]>(() =>
    Array.from({ length: 4 }, (_, i) => newBlankRow(i + 1)),
  )

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
  }, [open, isEdit, contracts, editApp])

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

  const g702 = useMemo(
    () => computeG702FromRows(rows, retainageRate, originalContractSum, netChangeOrders, lessPrevCerts),
    [rows, retainageRate, originalContractSum, netChangeOrders, lessPrevCerts],
  )

  const g703Items = useMemo((): G703LineItem[] =>
    rows.map((row, i) => {
      const { sv, prevAmt, workThisPeriod, mats, totalCompleted, retainage } = computeRowTotals(row, retainageRate)
      return {
        itemNumber: String(i + 1),
        costCode: '',
        description: row.description || `Line Item ${i + 1}`,
        scheduledValue: sv,
        previousCompleted: prevAmt,
        thisPeriod: workThisPeriod,
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
        original_contract_sum: originalContractSum,
        net_change_orders: netChangeOrders,
        contract_sum_to_date: originalContractSum + netChangeOrders,
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

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const hasRowErrors = rows.some((r) => r.error !== null)

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
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15,22,41,0.45)',
          zIndex: 1000,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Edit Pay Application #${editApp?.application_number as number}` : 'New Pay Application'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: DRAWER_WIDTH,
          backgroundColor: colors.white,
          boxShadow: shadows.lg,
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['4']} ${spacing['5']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.white,
          flexShrink: 0,
        }}>
          <Receipt size={18} color={colors.primaryOrange} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: spacing['5'], display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>

          {isEdit && sovLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="40px" />)}
            </div>
          )}

          <Card padding={spacing['4']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
              <FileText size={14} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Application Details
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
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

          <Card padding="0" style={{ overflow: 'hidden' }}>
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
                        <span style={tdStyle(32, 'center', { color: colors.textTertiary, fontFamily: typography.fontFamilyMono })}>
                          {i + 1}
                        </span>
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
                        <span style={tdStyle(72, 'right', { color: colors.textSecondary, fontFamily: typography.fontFamilyMono })}>
                          {row.prevPct.toFixed(1)}%
                        </span>
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
                        <span style={tdStyle(108, 'right', { fontFamily: typography.fontFamilyMono, color: colors.textPrimary })}>
                          {fmtCurrency(calc.totalCompleted)}
                        </span>
                        <span style={tdStyle(88, 'right', { fontFamily: typography.fontFamilyMono, color: colors.statusPending })}>
                          {fmtCurrency(calc.retainage)}
                        </span>
                        <span style={tdStyle(96, 'right', { fontFamily: typography.fontFamilyMono, color: calc.netPayment >= 0 ? colors.statusActive : colors.statusCritical })}>
                          {fmtCurrency(calc.netPayment)}
                        </span>
                        <div style={tdStyle(36, 'center')}>
                          <PermissionGate permission="financials.edit">
                            <button
                              onClick={() => removeRow(row.key)}
                              aria-label="Remove row"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: touchTarget.field, minHeight: touchTarget.field, border: 'none', borderRadius: borderRadius.base, backgroundColor: 'transparent', cursor: 'pointer', color: colors.textTertiary }}
                            >
                              <X size={12} />
                            </button>
                          </PermissionGate>
                        </div>
                      </div>
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

            <div style={{ padding: `${spacing['2']} ${spacing['4']}`, borderTop: `1px solid ${colors.borderSubtle}` }}>
              <PermissionGate permission="financials.edit">
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
              </PermissionGate>
            </div>
          </Card>

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

        <div style={{
          flexShrink: 0,
          borderTop: `1px solid ${colors.borderSubtle}`,
          padding: `${spacing['3']} ${spacing['5']}`,
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          backgroundColor: colors.white,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Current Payment Due</p>
            <p style={{ margin: 0, fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>
              {fmtCurrency(g702.currentPaymentDue)}
            </p>
          </div>

          <div style={{ flex: 1 }} />

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

          <PermissionGate permission="financials.edit">
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
