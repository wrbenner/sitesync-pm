import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, Plus, Scale, Receipt, ShieldCheck, FileText, X, ArrowRight, CheckCircle2, Clock, ClipboardCheck, Unlock, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { PageContainer, Card, MetricBox, Btn, Skeleton, EmptyState, Modal, InputField } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { usePayApplications, useContracts, useRetainageLedger, useLienWaivers, useProject } from '../../hooks/queries'
import { useRetainageEntries, summarizeRetainage, summarizeRetainageByPayApp } from '../../hooks/queries/retainage'
import { useReleaseRetainageEntry } from '../../hooks/mutations/retainage'
import { useGenerateLienWaiver, WAIVER_TYPE_LABELS, type WaiverType } from '../../hooks/mutations/lien-waivers'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../hooks/useAuth'
import { useActivePeriod } from '../../hooks/queries/financial-periods'
import type { LienWaiverRow } from '../../types/api'
import { approvePayApplication, markPayApplicationAsPaid } from '../../api/endpoints/payApplications'
import { updateLienWaiverStatus, generateWaiversFromPayApp } from '../../api/endpoints/lienWaivers'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { PeriodClosedBanner } from '../../components/ui/PeriodClosedBanner'
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation'
import { PageInsightBanners } from '../../components/ai/PredictiveAlert'
import { useCopilotStore } from '../../stores/copilotStore'
import { fmtCurrency, type TabKey, type PayAppProject } from './types'
import {
  type Cents,
  addCents,
  dollarsToCents,
  fromCents,
  subtractCents,
} from '../../types/money'

// Local helper: sum a dollar field across rows on integer cents to prevent
// float drift, return the result as dollars to keep the existing display API.
function sumDollarsViaCents<T>(items: T[], pick: (item: T) => number): number {
  const totalC: Cents = items.reduce<Cents>(
    (acc, item) => addCents(acc, dollarsToCents(pick(item) || 0)),
    0 as Cents,
  )
  return fromCents(totalC) / 100
}
import { PayAppList } from './PayAppList'
import { PayAppDetail } from './PayAppDetail'
import { LienWaiverPanel, CashFlowPanel } from './LienWaiverPanel'
import { CreateEditPayAppDrawer } from './SOVEditor'
import { useIsMobile } from '../../hooks/useWindowSize'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'applications', label: 'Pay Applications', icon: Receipt },
  { key: 'retainage', label: 'Retainage', icon: ShieldCheck },
  { key: 'lien_waivers', label: 'Lien Waivers', icon: Scale },
  { key: 'cash_flow', label: 'Cash Flow', icon: DollarSign },
]

// ── Retainage Release Stages ─────────────────────────────
type RetainageStage = 'requested' | 'punch_complete' | 'inspected' | 'released'
const RETAINAGE_STAGES: { key: RetainageStage; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'requested', label: 'Requested', icon: Clock, color: colors.statusPending },
  { key: 'punch_complete', label: 'Punch Complete', icon: ClipboardCheck, color: colors.statusInfo },
  { key: 'inspected', label: 'Inspected', icon: CheckCircle2, color: colors.statusReview },
  { key: 'released', label: 'Released', icon: Unlock, color: colors.statusActive },
]

interface RetainageLineItem {
  id: string
  description: string
  scheduledValue: number
  retainageHeld: number
  retainageReleased: number
  stage: RetainageStage
  isCO: boolean
  coNumber?: number
}

// G702/G703 types for empty state
type G702Data = {
  projectName: string; ownerName: string; architectName: string; contractorName: string
  contractDate: string; applicationNumber: number; periodTo: string
  originalContractSum: number; netChangeByCOs: number; contractSumToDate: number
  totalCompletedAndStored: number; retainagePercent: number; retainageAmount: number
  totalEarnedLessRetainage: number; lessPreviousCertificates: number
  currentPaymentDue: number; balanceToFinish: number
}

type G703Line = {
  item: string; desc: string; scheduled: number; prevComplete: number
  thisPeriod: number; materialsStored: number; totalCompleted: number
  pct: number; balanceToFinish: number; retainage: number
}

const PaymentApplicationsPage: React.FC = () => {
  const { setPageContext } = useCopilotStore()
  useEffect(() => { setPageContext('payment-applications') }, [setPageContext])

  const projectId = useProjectId()
  useRealtimeInvalidation(projectId ?? undefined)
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabKey>('applications')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [markingWaiverId, setMarkingWaiverId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerEditApp, setDrawerEditApp] = useState<Record<string, unknown> | null>(null)
  const [g702ModalOpen, setG702ModalOpen] = useState(false)
  const [g702ModalAppId, setG702ModalAppId] = useState<string | null>(null)
  const [retainageItems, setRetainageItems] = useState<RetainageLineItem[]>([])
  // REACT-03 FIX: Shared hook replaces a per-page resize listener.
  const isMobile = useIsMobile()

  const openCreateDrawer = useCallback(() => {
    setDrawerEditApp(null)
    setDrawerOpen(true)
  }, [])

  const openEditDrawer = useCallback((app: Record<string, unknown>) => {
    setDrawerEditApp(app)
    setDrawerOpen(true)
  }, [])

  const openG702Modal = useCallback((appId: string) => {
    setG702ModalAppId(appId)
    setG702ModalOpen(true)
  }, [])

  const _handleRetainageRelease = useCallback(async (itemId: string) => {
    setRetainageItems((prev) => prev.map((item) =>
      item.id === itemId
        ? { ...item, stage: 'requested' as RetainageStage }
        : item
    ))
    const { error } = await supabase
      .from('retainage_ledger')
      .update({ stage: 'requested', updated_at: new Date().toISOString() } as never)
      .eq('id', itemId)
    if (error) {
      toast.error('Failed to save retainage release request')
    } else {
      toast.success('Retainage release requested')
      queryClient.invalidateQueries({ queryKey: ['retainage_ledger', projectId] })
    }
  }, [projectId, queryClient])

  const handleRetainageStageAdvance = useCallback(async (itemId: string) => {
    let nextStage: RetainageStage | null = null
    let released = 0
    setRetainageItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item
      const stageOrder: RetainageStage[] = ['requested', 'punch_complete', 'inspected', 'released']
      const idx = stageOrder.indexOf(item.stage)
      if (idx >= stageOrder.length - 1) return item
      nextStage = stageOrder[idx + 1]
      released = nextStage === 'released' ? item.retainageHeld : item.retainageReleased
      return { ...item, stage: nextStage, retainageReleased: released }
    }))
    if (nextStage) {
      const updatePayload: Record<string, unknown> = { stage: nextStage, updated_at: new Date().toISOString() }
      if (nextStage === 'released') {
        updatePayload.released_amount = released
      }
      const { error } = await supabase
        .from('retainage_ledger')
        .update(updatePayload)
        .eq('id', itemId)
      if (error) {
        toast.error('Failed to advance retainage stage')
      } else {
        toast.success('Retainage stage advanced')
        queryClient.invalidateQueries({ queryKey: ['retainage_ledger', projectId] })
      }
    }
  }, [projectId, queryClient])

  const { data: payApps, isLoading: loadingApps } = usePayApplications(projectId)
  const { data: contracts, isLoading: loadingContracts } = useContracts(projectId)
  const { data: retainage, isLoading: loadingRetainage } = useRetainageLedger(projectId)
  const { data: retainageEntries } = useRetainageEntries(projectId)
  const { data: lienWaivers } = useLienWaivers(projectId)
  const { data: project } = useProject(projectId)

  // Role gating for retainage release (owner/admin/project_manager).
  const { role } = usePermissions()
  const { user } = useAuth()
  const canReleaseRetainage = role === 'owner' || role === 'admin' || role === 'project_manager'

  // Period-close gating: when the current financial period is closed, lock
  // writes for everyone except owner/admin. The banner renders for all roles
  // so the state is visible; only the disabled flag varies.
  const { data: activePeriod } = useActivePeriod(projectId ?? undefined)
  const periodClosed = activePeriod?.status === 'closed'
  const canBypassPeriodLock = role === 'owner' || role === 'admin'
  const writesLocked = periodClosed && !canBypassPeriodLock
  const lockTooltip = writesLocked
    ? 'Current period is closed — edits restricted to owner/admin'
    : undefined

  // Generate Waiver modal state
  const [genWaiverOpen, setGenWaiverOpen] = useState(false)
  const [genWaiverForm, setGenWaiverForm] = useState<{
    type: WaiverType
    contractor_name: string
    application_id: string
    amount: string
    through_date: string
    notes: string
  }>({
    type: 'conditional_partial',
    contractor_name: '',
    application_id: '',
    amount: '',
    through_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const generateWaiver = useGenerateLienWaiver()

  // Release Retainage modal state
  const [releaseTarget, setReleaseTarget] = useState<{
    id: string
    contract_id: string
    amount_held: number
    released_amount: number
  } | null>(null)
  const [releaseAmount, setReleaseAmount] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const releaseRetainage = useReleaseRetainageEntry()

  // Retainage summaries
  const retainageSummary = useMemo(
    () => summarizeRetainage(retainageEntries ?? []),
    [retainageEntries],
  )
  const retainageByPayApp = useMemo(
    () => summarizeRetainageByPayApp(retainageEntries ?? []),
    [retainageEntries],
  )

  const apps = (payApps ?? []) as Array<Record<string, unknown>>
  const contractList = (contracts ?? []) as Array<Record<string, unknown>>
  const waivers = (lienWaivers ?? []) as LienWaiverRow[]
  const selectedApp = apps.find((a) => a.id === selectedAppId)

  const isLoading = loadingApps || loadingContracts || loadingRetainage

  // Derive G702 data from the pay app selected in the modal
  const g702ModalApp = apps.find((a) => a.id === g702ModalAppId)
  const g702Data = useMemo((): G702Data | null => {
    if (!g702ModalApp) return null
    const ocs = (g702ModalApp.original_contract_sum as number) || 0
    const nco = (g702ModalApp.net_change_orders as number) || 0
    const cstd = (g702ModalApp.contract_sum_to_date as number) || (ocs + nco)
    const totalComp = (g702ModalApp.total_completed_and_stored as number) || 0
    const ret = (g702ModalApp.retainage as number) || 0
    const retPct = totalComp > 0 ? (ret / totalComp) * 100 : 10
    const earnedLessRet = (g702ModalApp.total_earned_less_retainage as number) || (totalComp - ret)
    const lessPrev = (g702ModalApp.less_previous_certificates as number) || 0
    const payDue = (g702ModalApp.current_payment_due as number) || (earnedLessRet - lessPrev)
    const balToFinish = (g702ModalApp.balance_to_finish as number) || (cstd - totalComp)
    const contract = contractList.find((c) => c.id === g702ModalApp.contract_id)
    return {
      projectName: (project?.name as string) ?? '',
      ownerName: (project as Record<string, unknown>)?.owner_name as string ?? '',
      architectName: '',
      contractorName: (contract?.counterparty as string) ?? '',
      contractDate: '',
      applicationNumber: (g702ModalApp.application_number as number) || 0,
      periodTo: (g702ModalApp.period_to as string) || '',
      originalContractSum: ocs,
      netChangeByCOs: nco,
      contractSumToDate: cstd,
      totalCompletedAndStored: totalComp,
      retainagePercent: Math.round(retPct * 10) / 10,
      retainageAmount: ret,
      totalEarnedLessRetainage: earnedLessRet,
      lessPreviousCertificates: lessPrev,
      currentPaymentDue: payDue,
      balanceToFinish: balToFinish,
    }
  }, [g702ModalApp, contractList, project])

  // Derive G703 lines from retainage / SOV items on the pay app
  const g703Lines = useMemo((): G703Line[] => {
    if (!g702ModalApp) return []
    // Use retainage ledger data scoped to this pay app if available
    const retainageArr = (retainage ?? []) as Array<Record<string, unknown>>
    return retainageArr
      .filter((r) => (r.pay_application_id as string) === g702ModalAppId || !r.pay_application_id)
      .map((r, i) => {
        const sched = (r.scheduled_value as number) || (r.amount as number) || 0
        const prev = (r.previous_completed as number) || 0
        const thisPeriod = (r.this_period as number) || 0
        const materials = (r.stored_materials as number) || 0
        const total = prev + thisPeriod + materials
        const pct = sched > 0 ? (total / sched) * 100 : 0
        return {
          item: String(i + 1),
          desc: (r.description as string) || `Item ${i + 1}`,
          scheduled: sched,
          prevComplete: prev,
          thisPeriod,
          materialsStored: materials,
          totalCompleted: total,
          pct,
          balanceToFinish: sched - total,
          retainage: (r.retainage_held as number) || (r.released_amount != null ? ((r.amount as number) || 0) - ((r.released_amount as number) || 0) : 0),
        }
      })
  }, [g702ModalApp, g702ModalAppId, retainage])

  // Populate retainageItems from the retainage ledger when data arrives
  useEffect(() => {
    const retainageArr = (retainage ?? []) as Array<Record<string, unknown>>
    if (retainageArr.length > 0 && retainageItems.length === 0) {
      setRetainageItems(retainageArr.map((r) => ({
        id: (r.id as string) || crypto.randomUUID(),
        description: (r.description as string) || 'SOV Item',
        scheduledValue: (r.scheduled_value as number) || (r.amount as number) || 0,
        retainageHeld: ((r.amount as number) || 0) - ((r.released_amount as number) || 0),
        retainageReleased: (r.released_amount as number) || 0,
        stage: ((r.stage as RetainageStage) || 'requested'),
        isCO: (r.is_change_order as boolean) || false,
        coNumber: (r.co_number as number) || undefined,
      })))
    }
  }, [retainage]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const markPaidMutation = useMutation({
    mutationFn: async (app: Record<string, unknown>) => {
      return markPayApplicationAsPaid(projectId!, app.id as string)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay_applications', projectId] })
      toast.success('Payment recorded — pay app marked as paid')
    },
    onError: () => toast.error('Failed to record payment'),
  })

  const handleApprove = useCallback(() => {
    if (selectedApp) approvePayAppMutation.mutate(selectedApp)
  }, [selectedApp, approvePayAppMutation])

  const handleMarkPaid = useCallback(() => {
    if (selectedApp) markPaidMutation.mutate(selectedApp)
  }, [selectedApp, markPaidMutation])

  const kpis = useMemo(() => {
    const total = apps.length
    const totalDue = sumDollarsViaCents(apps, (a) => (a.current_payment_due as number) || 0)
    const totalPaid = sumDollarsViaCents(
      apps.filter((a) => a.status === 'paid'),
      (a) => (a.current_payment_due as number) || 0,
    )
    const pending = apps.filter((a) => a.status !== 'paid' && a.status !== 'void' && a.status !== 'draft').length
    const totalRetainage = sumDollarsViaCents(apps, (a) => (a.retainage as number) || 0)
    return { total, totalDue, totalPaid, pending, totalRetainage }
  }, [apps])

  return (
    <PageContainer
      title="Payment Applications"
      subtitle="AIA G702/G703 payment applications, lien waivers, and cash flow management"
    >
      <div style={{ position: 'relative', marginBottom: spacing['2xl'] }}>
        <div style={{
          display: 'flex', gap: spacing['2'],
          backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
          padding: spacing['1'], overflowX: 'auto',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
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
                  flexShrink: 0,
                }}
              >
                {React.createElement(tab.icon, { size: 14 })}
                {tab.label}
              </button>
            )
          })}
        </div>
        <div aria-hidden style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 28,
          background: `linear-gradient(to right, ${colors.surfaceInset}, transparent)`,
          borderTopLeftRadius: borderRadius.lg,
          borderBottomLeftRadius: borderRadius.lg,
          pointerEvents: 'none',
        }} />
        <div aria-hidden style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 28,
          background: `linear-gradient(to left, ${colors.surfaceInset}, transparent)`,
          borderTopRightRadius: borderRadius.lg,
          borderBottomRightRadius: borderRadius.lg,
          pointerEvents: 'none',
        }} />
      </div>

      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {!isLoading && apps.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          <MetricBox label="Total Applications" value={kpis.total} />
          <MetricBox label="Total Billed" value={fmtCurrency(kpis.totalDue)} />
          <MetricBox label="Total Paid" value={fmtCurrency(kpis.totalPaid)} />
          <MetricBox label="Retainage Held" value={fmtCurrency(kpis.totalRetainage)} />
        </div>
      )}

      <PeriodClosedBanner projectId={projectId ?? undefined} />

      <PageInsightBanners page="payment_applications" />

      {!isLoading && apps.length === 0 && activeTab === 'applications' && (
        <Card padding={spacing['5']}>
          <EmptyState
            icon={<Receipt size={48} />}
            title="No Pay Applications Yet"
            description="Create your first AIA G702 pay application to start tracking billing, retainage, and lien waivers for this project."
            actionLabel="New Pay Application"
            onAction={openCreateDrawer}
          />
        </Card>
      )}

      {activeTab === 'applications' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {selectedApp && projectId && (
            <PayAppDetail
              app={selectedApp}
              projectId={projectId}
              waivers={waivers}
              contracts={contractList}
              onApprove={handleApprove}
              onMarkPaid={handleMarkPaid}
              isApproving={approvePayAppMutation.isPending}
              isMarkingPaid={markPaidMutation.isPending}
              onMarkReceived={(id) => markReceivedMutation.mutate(id)}
              onMarkExecuted={(id) => markExecutedMutation.mutate(id)}
              markingWaiverId={markingWaiverId}
            />
          )}

          {/* Generate AIA G702/G703 button for selected app */}
          {selectedApp && (
            <div style={{ display: 'flex', gap: spacing['2'] }}>
              <Btn
                variant="ghost"
                icon={<FileText size={14} />}
                onClick={() => openG702Modal(selectedApp.id as string)}
              >
                Generate AIA G702/G703
              </Btn>
            </div>
          )}

          {apps.length > 0 && retainageByPayApp.size > 0 && (
            <Card padding={spacing['4']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
                <ShieldCheck size={14} color={colors.primaryOrange} />
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  Cumulative Retainage Held by Pay App
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: spacing['2'] }}>
                {apps.map((a) => {
                  const r = retainageByPayApp.get(a.id as string)
                  if (!r) return null
                  const outstanding = r.held - r.released
                  return (
                    <div key={a.id as string} style={{
                      padding: `${spacing['2']} ${spacing['3']}`,
                      borderRadius: borderRadius.base,
                      backgroundColor: colors.surfaceInset,
                      border: `1px solid ${colors.borderSubtle}`,
                    }}>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        App #{String(a.application_number ?? '?')}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, fontFamily: typography.fontFamilyMono }}>
                        {fmtCurrency(r.held)} held
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: outstanding > 0 ? colors.textSecondary : colors.statusActive, fontFamily: typography.fontFamilyMono }}>
                        {outstanding > 0 ? `${fmtCurrency(outstanding)} outstanding` : 'Fully released'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {apps.length > 0 && (
            <PayAppList
              apps={apps}
              selectedAppId={selectedAppId}
              onSelectApp={setSelectedAppId}
              onCreateApp={openCreateDrawer}
              onEditApp={openEditDrawer}
            />
          )}
        </div>
      )}

      {activeTab === 'lien_waivers' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PermissionGate permission="budget.edit">
              <Btn
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setGenWaiverOpen(true)}
                disabled={writesLocked}
                aria-disabled={writesLocked}
                title={lockTooltip}
              >
                Generate Waiver
              </Btn>
            </PermissionGate>
          </div>
          <LienWaiverPanel
            payApps={apps}
            waivers={waivers}
            contracts={contractList}
            project={project as PayAppProject | undefined}
            onMarkReceived={(id) => markReceivedMutation.mutate(id)}
            onMarkExecuted={(id) => markExecutedMutation.mutate(id)}
            isMarkingReceived={markingWaiverId}
            onGenerateAll={(payAppId) => generateAllMutation.mutate(payAppId)}
            isGenerating={generateAllMutation.isPending}
          />
        </div>
      )}

      {activeTab === 'cash_flow' && !isLoading && (
        <CashFlowPanel payApps={apps} retainage={(retainage ?? []) as Array<Record<string, unknown>>} />
      )}

      {/* ── Retainage Ledger (retainage_entries) ────────────── */}
      {activeTab === 'retainage' && !isLoading && (
        <Card padding={spacing['5']} style={{ marginBottom: spacing['4'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
            <ShieldCheck size={16} color={colors.primaryOrange} />
            <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Retainage Ledger (per contract)
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['4'] }}>
            <MetricBox label="Total Held" value={fmtCurrency(retainageSummary.totals.held)} />
            <MetricBox label="Total Released" value={fmtCurrency(retainageSummary.totals.released)} change={retainageSummary.totals.released > 0 ? 1 : 0} />
            <MetricBox label="Outstanding" value={fmtCurrency(retainageSummary.totals.outstanding)} />
          </div>
          {(retainageEntries ?? []).length === 0 ? (
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              No retainage entries yet. Entries appear here once pay apps are approved with retainage held.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 720 }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 160px',
                  backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}`,
                  padding: `${spacing['2']} ${spacing['3']}`, gap: spacing['2'],
                }}>
                  {['Contract', 'Held', 'Released', 'Outstanding', 'Actions'].map((h) => (
                    <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>{h}</span>
                  ))}
                </div>
                {(retainageEntries ?? []).map((e, i) => {
                  const contract = contractList.find((c) => c.id === e.contract_id) as Record<string, unknown> | undefined
                  const label = (contract?.counterparty as string) || (contract?.description as string) || `Contract ${String(e.contract_id).slice(0, 8)}`
                  const outstanding = (e.amount_held ?? 0) - (e.released_amount ?? 0)
                  const fullyReleased = !!e.released_at || outstanding <= 0.005
                  return (
                    <div key={e.id} style={{
                      display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 160px',
                      padding: `${spacing['2']} ${spacing['3']}`, gap: spacing['2'],
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                      backgroundColor: i % 2 === 0 ? colors.white : colors.surfacePage,
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                        {label}
                        {e.percent_held != null && (
                          <span style={{ marginLeft: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                            {e.percent_held}%
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.statusPending }}>
                        {fmtCurrency(e.amount_held ?? 0)}
                      </span>
                      <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: e.released_amount > 0 ? colors.statusActive : colors.textTertiary }}>
                        {fmtCurrency(e.released_amount ?? 0)}
                      </span>
                      <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>
                        {fmtCurrency(outstanding)}
                      </span>
                      <div>
                        {fullyReleased ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>
                            <CheckCircle2 size={12} /> Released
                          </span>
                        ) : canReleaseRetainage ? (
                          <Btn
                            size="sm"
                            variant="secondary"
                            icon={<Unlock size={12} />}
                            disabled={writesLocked}
                            aria-disabled={writesLocked}
                            title={lockTooltip}
                            onClick={() => {
                              setReleaseTarget({
                                id: e.id,
                                contract_id: e.contract_id,
                                amount_held: e.amount_held ?? 0,
                                released_amount: e.released_amount ?? 0,
                              })
                              setReleaseAmount(String(outstanding))
                              setReleaseNotes('')
                            }}
                          >
                            Release
                          </Btn>
                        ) : (
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                            PM/admin only
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Retainage Release Workflow Tab (legacy ledger pipeline) ── */}
      {activeTab === 'retainage' && !isLoading && (() => {
        const totalHeld = sumDollarsViaCents(retainageItems, (i) => i.retainageHeld)
        const totalReleased = sumDollarsViaCents(retainageItems, (i) => i.retainageReleased)
        const totalUnreleased = fromCents(
          subtractCents(dollarsToCents(totalHeld), dollarsToCents(totalReleased)),
        ) / 100
        const releasedPct = totalHeld > 0 ? (totalReleased / totalHeld) * 100 : 0
        const originalSubtotal = sumDollarsViaCents(
          retainageItems.filter((i) => !i.isCO),
          (i) => i.retainageHeld,
        )
        const coSubtotal = sumDollarsViaCents(
          retainageItems.filter((i) => i.isCO),
          (i) => i.retainageHeld,
        )

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            {/* Summary metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: spacing['4'] }}>
              <MetricBox label="Total Retainage Held" value={fmtCurrency(totalHeld)} />
              <MetricBox label="Released" value={fmtCurrency(totalReleased)} change={1} />
              <MetricBox label="Unreleased" value={fmtCurrency(totalUnreleased)} />
              <MetricBox label="Original SOV Retainage" value={fmtCurrency(originalSubtotal)} />
            </div>

            {/* Progress bar */}
            <Card padding={spacing['5']}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  Retainage Release Progress
                </span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  {releasedPct.toFixed(1)}% released
                </span>
              </div>
              <div style={{ height: 12, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%', width: `${releasedPct}%`,
                  background: `linear-gradient(90deg, ${colors.statusActive}, ${colors.chartGreen})`,
                  borderRadius: borderRadius.full,
                  transition: `width ${transitions.smooth}`,
                }} />
              </div>
              <div style={{ display: 'flex', gap: spacing['6'], marginTop: spacing['3'] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: colors.statusActive }} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Released ({fmtCurrency(totalReleased)})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: colors.surfaceInset }} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Unreleased ({fmtCurrency(totalUnreleased)})</span>
                </div>
                {coSubtotal > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: colors.badgeAmber }} />
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>CO Retainage ({fmtCurrency(coSubtotal)})</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Stage pipeline */}
            <Card padding={spacing['5']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
                <ShieldCheck size={16} color={colors.primaryOrange} />
                <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  Release Pipeline
                </span>
              </div>
              <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['5'], flexWrap: 'wrap' }}>
                {RETAINAGE_STAGES.map((stage, idx) => {
                  const count = retainageItems.filter((i) => i.stage === stage.key).length
                  return (
                    <React.Fragment key={stage.key}>
                      {idx > 0 && <ArrowRight size={16} color={colors.textTertiary} style={{ alignSelf: 'center' }} />}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: spacing['2'],
                        padding: `${spacing['2']} ${spacing['4']}`,
                        backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
                        border: `1px solid ${colors.borderSubtle}`,
                      }}>
                        {React.createElement(stage.icon, { size: 14, color: stage.color })}
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                          {stage.label}
                        </span>
                        <span style={{
                          fontSize: typography.fontSize.caption, color: stage.color,
                          backgroundColor: `${stage.color}15`, padding: `1px ${spacing['2']}`,
                          borderRadius: borderRadius.full, fontWeight: typography.fontWeight.semibold,
                        }}>
                          {count}
                        </span>
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>

              {/* Line item table */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 800 }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 130px 140px',
                    backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}`,
                    padding: `${spacing['2']} ${spacing['4']}`,
                  }}>
                    {['Description', 'Sched. Value', 'Held', 'Released', 'Stage', 'Actions'].map((h) => (
                      <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>{h}</span>
                    ))}
                  </div>
                  {retainageItems.map((item, i) => {
                    const stageCfg = RETAINAGE_STAGES.find((s) => s.key === item.stage)!
                    return (
                      <div key={item.id} style={{
                        display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 130px 140px',
                        padding: `${spacing['3']} ${spacing['4']}`, alignItems: 'center',
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                        backgroundColor: item.isCO ? colors.badgeAmberBg : (i % 2 === 0 ? colors.white : colors.surfacePage),
                      }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                          {item.isCO && (
                            <span style={{
                              display: 'inline-block', marginRight: spacing['2'],
                              padding: `1px ${spacing['2']}`, borderRadius: borderRadius.sm,
                              backgroundColor: colors.badgeAmber, color: colors.white,
                              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                            }}>CO#{item.coNumber}</span>
                          )}
                          {item.description}
                        </span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textSecondary }}>{fmtCurrency(item.scheduledValue)}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.statusPending }}>{fmtCurrency(item.retainageHeld)}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: item.retainageReleased > 0 ? colors.statusActive : colors.textTertiary }}>
                          {fmtCurrency(item.retainageReleased)}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                          padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                          color: stageCfg.color, backgroundColor: `${stageCfg.color}15`, width: 'fit-content',
                        }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: stageCfg.color }} />
                          {stageCfg.label}
                        </span>
                        <div style={{ display: 'flex', gap: spacing['2'] }}>
                          {item.stage === 'released' ? (
                            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>Complete</span>
                          ) : (
                            <>
                              {item.stage !== 'requested' && (
                                <PermissionGate permission="financials.edit">
                                  <button
                                    onClick={() => handleRetainageStageAdvance(item.id)}
                                    style={{
                                      padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.statusInfo}`,
                                      borderRadius: borderRadius.base, backgroundColor: colors.statusInfoSubtle,
                                      color: colors.statusInfo, fontSize: typography.fontSize.caption,
                                      fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                                      cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Advance
                                  </button>
                                </PermissionGate>
                              )}
                              {item.stage === 'requested' && (
                                <PermissionGate permission="financials.edit">
                                  <button
                                    onClick={() => handleRetainageStageAdvance(item.id)}
                                    style={{
                                      padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
                                      borderRadius: borderRadius.base, backgroundColor: 'transparent',
                                      color: colors.textSecondary, fontSize: typography.fontSize.caption,
                                      fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                                      cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Mark Punch Done
                                  </button>
                                </PermissionGate>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          </div>
        )
      })()}

      {/* ── AIA G702/G703 Document Generation Modal ─────────── */}
      {g702ModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: zIndex.modal,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.overlayDark, padding: spacing['4'],
          }}
          onClick={() => setG702ModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
              boxShadow: shadows.panel, width: '100%', maxWidth: 960,
              maxHeight: '90vh', overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: `${spacing['5']} ${spacing['6']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: 0, backgroundColor: colors.surfaceRaised, zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                <FileText size={20} color={colors.primaryOrange} />
                <div>
                  <h2 style={{ margin: 0, fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    AIA G702 / G703 Document Preview
                  </h2>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    Application #{g702Data?.applicationNumber ?? '—'} &middot; Period to {g702Data?.periodTo ? new Date(g702Data.periodTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
              <button onClick={() => setG702ModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: spacing['2'] }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            {/* G702 Cover Sheet */}
            <div style={{ padding: `${spacing['5']} ${spacing['6']}` }}>
              <h3 style={{ margin: `0 0 ${spacing['4']}`, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                G702 - Application and Certificate for Payment
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing['3']} ${spacing['6']}`, marginBottom: spacing['5'] }}>
                {[
                  { label: 'Project', value: g702Data?.projectName ?? '—' },
                  { label: 'Owner', value: g702Data?.ownerName ?? '—' },
                  { label: 'Architect', value: g702Data?.architectName ?? '—' },
                  { label: 'Contractor', value: g702Data?.contractorName ?? '—' },
                  { label: 'Contract Date', value: g702Data?.contractDate ? new Date(g702Data.contractDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
                  { label: 'Application Number', value: g702Data ? `#${g702Data.applicationNumber}` : '—' },
                ].map((f) => (
                  <div key={f.label}>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</p>
                    <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{f.value}</p>
                  </div>
                ))}
              </div>

              {/* G702 financial summary */}
              <div style={{ border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, overflow: 'hidden' }}>
                {[
                  { label: '1. Original Contract Sum', value: fmtCurrency(g702Data?.originalContractSum ?? 0) },
                  { label: '2. Net Change by Change Orders', value: fmtCurrency(g702Data?.netChangeByCOs ?? 0) },
                  { label: '3. Contract Sum to Date (1 + 2)', value: fmtCurrency(g702Data?.contractSumToDate ?? 0), bold: true },
                  { label: '4. Total Completed & Stored to Date', value: fmtCurrency(g702Data?.totalCompletedAndStored ?? 0) },
                  { label: `5. Retainage (${g702Data?.retainagePercent ?? 0}%)`, value: fmtCurrency(g702Data?.retainageAmount ?? 0) },
                  { label: '6. Total Earned Less Retainage (4 - 5)', value: fmtCurrency(g702Data?.totalEarnedLessRetainage ?? 0) },
                  { label: '7. Less Previous Certificates', value: fmtCurrency(g702Data?.lessPreviousCertificates ?? 0) },
                  { label: '8. Current Payment Due (6 - 7)', value: fmtCurrency(g702Data?.currentPaymentDue ?? 0), bold: true, highlight: true },
                  { label: '9. Balance to Finish (3 - 4)', value: fmtCurrency(g702Data?.balanceToFinish ?? 0) },
                ].map((row, i) => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: `${spacing['2.5']} ${spacing['4']}`,
                    backgroundColor: row.highlight ? colors.orangeSubtle : (i % 2 === 0 ? colors.white : colors.surfacePage),
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: row.bold ? colors.textPrimary : colors.textSecondary, fontWeight: row.bold ? typography.fontWeight.semibold : typography.fontWeight.normal }}>
                      {row.label}
                    </span>
                    <span style={{
                      fontSize: row.highlight ? typography.fontSize.title : typography.fontSize.sm,
                      color: row.highlight ? colors.primaryOrange : row.bold ? colors.textPrimary : colors.textSecondary,
                      fontWeight: row.bold ? typography.fontWeight.bold : typography.fontWeight.medium,
                      fontFamily: typography.fontFamilyMono,
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* G703 Continuation Sheet */}
              <h3 style={{ margin: `${spacing['6']} 0 ${spacing['4']}`, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                G703 - Continuation Sheet (Schedule of Values)
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 900 }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '50px 1fr 100px 100px 100px 100px 100px 65px 100px 90px',
                    backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}`,
                    padding: `${spacing['2']} ${spacing['3']}`, gap: spacing['1'],
                  }}>
                    {['#', 'Description', 'Sched. Value', 'Previous', 'This Period', 'Materials', 'Total Comp.', '%', 'Balance', 'Retainage'].map((h) => (
                      <span key={h} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold, textAlign: h === 'Description' ? 'left' : 'right' }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  {g703Lines.map((line, i) => {
                    const isCO = line.item.startsWith('CO#')
                    return (
                      <div key={line.item} style={{
                        display: 'grid', gridTemplateColumns: '50px 1fr 100px 100px 100px 100px 100px 65px 100px 90px',
                        padding: `${spacing['2']} ${spacing['3']}`, gap: spacing['1'],
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                        backgroundColor: isCO ? colors.badgeAmberBg : (i % 2 === 0 ? colors.white : colors.surfacePage),
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: isCO ? colors.badgeAmber : colors.textTertiary, fontWeight: isCO ? typography.fontWeight.semibold : typography.fontWeight.normal }}>
                          {line.item}
                        </span>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, textAlign: 'left' }}>{line.desc}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary, textAlign: 'right' }}>{fmtCurrency(line.scheduled)}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textSecondary, textAlign: 'right' }}>{fmtCurrency(line.prevComplete)}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.primaryOrange, textAlign: 'right' }}>{fmtCurrency(line.thisPeriod)}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textSecondary, textAlign: 'right' }}>{fmtCurrency(line.materialsStored)}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary, textAlign: 'right' }}>{fmtCurrency(line.totalCompleted)}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: line.pct >= 100 ? colors.statusActive : colors.textPrimary, textAlign: 'right' }}>{line.pct.toFixed(1)}%</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textSecondary, textAlign: 'right' }}>{fmtCurrency(line.balanceToFinish)}</span>
                        <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.statusPending, textAlign: 'right' }}>{fmtCurrency(line.retainage)}</span>
                      </div>
                    )
                  })}
                  {/* Totals row */}
                  {(() => {
                    const totals = {
                      scheduled: sumDollarsViaCents(g703Lines, (l) => l.scheduled),
                      prevComplete: sumDollarsViaCents(g703Lines, (l) => l.prevComplete),
                      thisPeriod: sumDollarsViaCents(g703Lines, (l) => l.thisPeriod),
                      materialsStored: sumDollarsViaCents(g703Lines, (l) => l.materialsStored),
                      totalCompleted: sumDollarsViaCents(g703Lines, (l) => l.totalCompleted),
                      balanceToFinish: sumDollarsViaCents(g703Lines, (l) => l.balanceToFinish),
                      retainage: sumDollarsViaCents(g703Lines, (l) => l.retainage),
                    }
                    const origTotal = sumDollarsViaCents(
                      g703Lines.filter((l) => !l.item.startsWith('CO#')),
                      (l) => l.scheduled,
                    )
                    const coTotal = sumDollarsViaCents(
                      g703Lines.filter((l) => l.item.startsWith('CO#')),
                      (l) => l.scheduled,
                    )
                    return (
                      <>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '50px 1fr 100px 100px 100px 100px 100px 65px 100px 90px',
                          padding: `${spacing['3']} ${spacing['3']}`, gap: spacing['1'],
                          backgroundColor: colors.darkNavy, color: colors.white,
                        }}>
                          <span />
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold }}>GRAND TOTAL</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, fontWeight: typography.fontWeight.bold, textAlign: 'right' }}>{fmtCurrency(totals.scheduled)}</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, textAlign: 'right' }}>{fmtCurrency(totals.prevComplete)}</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, textAlign: 'right', color: colors.primaryOrange }}>{fmtCurrency(totals.thisPeriod)}</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, textAlign: 'right' }}>{fmtCurrency(totals.materialsStored)}</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, fontWeight: typography.fontWeight.bold, textAlign: 'right' }}>{fmtCurrency(totals.totalCompleted)}</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, textAlign: 'right' }}>{totals.scheduled > 0 ? ((totals.totalCompleted / totals.scheduled) * 100).toFixed(1) : '0'}%</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, textAlign: 'right' }}>{fmtCurrency(totals.balanceToFinish)}</span>
                          <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, textAlign: 'right', color: colors.statusPending }}>{fmtCurrency(totals.retainage)}</span>
                        </div>
                        {/* CO summary breakdown */}
                        <div style={{ padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.surfaceInset, display: 'flex', gap: spacing['6'], flexWrap: 'wrap' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Original SOV Subtotal</p>
                            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontFamily: typography.fontFamilyMono }}>{fmtCurrency(origTotal)}</p>
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.badgeAmber }}>CO Additions</p>
                            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.badgeAmber, fontFamily: typography.fontFamilyMono }}>+{fmtCurrency(coTotal)}</p>
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Current Contract Total</p>
                            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>{fmtCurrency(origTotal + coTotal)}</p>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Export button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['5'] }}>
                <Btn variant="ghost" onClick={() => setG702ModalOpen(false)}>
                  Close
                </Btn>
                <Btn
                  variant="primary"
                  icon={<FileText size={14} />}
                  onClick={() => {
                    window.print()
                    toast.success('AIA G702/G703 PDF exported successfully')
                  }}
                >
                  Export PDF
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Generate Lien Waiver Modal ───────────────────────── */}
      <Modal open={genWaiverOpen} onClose={() => setGenWaiverOpen(false)} title="Generate Lien Waiver">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Waiver Type</label>
            <select
              value={genWaiverForm.type}
              onChange={(e) => setGenWaiverForm((f) => ({ ...f, type: e.target.value as WaiverType }))}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              {(Object.keys(WAIVER_TYPE_LABELS) as WaiverType[]).map((t) => (
                <option key={t} value={t}>{WAIVER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <InputField
            label="Subcontractor / Contractor Name *"
            value={genWaiverForm.contractor_name}
            onChange={(v) => setGenWaiverForm((f) => ({ ...f, contractor_name: v }))}
            placeholder="e.g. Acme Electrical Inc."
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField
              label="Amount ($) *"
              value={genWaiverForm.amount}
              onChange={(v) => setGenWaiverForm((f) => ({ ...f, amount: v }))}
              type="number"
              placeholder="0.00"
            />
            <InputField
              label="Through Date *"
              value={genWaiverForm.through_date}
              onChange={(v) => setGenWaiverForm((f) => ({ ...f, through_date: v }))}
              type="date"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Associated Pay Application</label>
            <select
              value={genWaiverForm.application_id}
              onChange={(e) => setGenWaiverForm((f) => ({ ...f, application_id: e.target.value }))}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              <option value="">— None —</option>
              {apps.map((a) => (
                <option key={a.id as string} value={a.id as string}>
                  #{(a.application_number as number) ?? '?'} · {new Date((a.period_to as string) ?? '').toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Notes</label>
            <textarea
              value={genWaiverForm.notes}
              onChange={(e) => setGenWaiverForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setGenWaiverOpen(false)}>Cancel</Btn>
            <Btn
              variant="primary"
              loading={generateWaiver.isPending}
              onClick={() => {
                if (!projectId) return
                const amountNum = parseFloat(genWaiverForm.amount)
                if (!(amountNum > 0)) { toast.error('Amount must be greater than 0'); return }
                generateWaiver.mutate(
                  {
                    project_id: projectId,
                    application_id: genWaiverForm.application_id || null,
                    contractor_name: genWaiverForm.contractor_name,
                    amount: amountNum,
                    through_date: genWaiverForm.through_date,
                    type: genWaiverForm.type,
                    notes: genWaiverForm.notes || null,
                  },
                  {
                    onSuccess: () => {
                      setGenWaiverOpen(false)
                      setGenWaiverForm((f) => ({ ...f, contractor_name: '', amount: '', notes: '' }))
                    },
                  },
                )
              }}
            >
              {generateWaiver.isPending ? 'Generating…' : 'Generate Waiver'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Release Retainage Modal (owner/admin/PM only) ────── */}
      <Modal open={!!releaseTarget} onClose={() => setReleaseTarget(null)} title="Release Retainage">
        {releaseTarget && (() => {
          const outstanding = releaseTarget.amount_held - releaseTarget.released_amount
          const amt = parseFloat(releaseAmount) || 0
          const invalid = !(amt > 0) || amt > outstanding + 0.005
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              {!canReleaseRetainage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base }}>
                  <AlertTriangle size={14} color={colors.statusCritical} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
                    Only owners, admins, and project managers can release retainage.
                  </span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
                <div>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Held</p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamilyMono }}>
                    {fmtCurrency(releaseTarget.amount_held)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Already Released</p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamilyMono, color: colors.statusActive }}>
                    {fmtCurrency(releaseTarget.released_amount)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Outstanding</p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamilyMono, color: colors.statusPending }}>
                    {fmtCurrency(outstanding)}
                  </p>
                </div>
              </div>
              <InputField
                label="Release Amount ($)"
                value={releaseAmount}
                onChange={setReleaseAmount}
                type="number"
                placeholder="0.00"
              />
              <div style={{ display: 'flex', gap: spacing['2'] }}>
                <Btn variant="ghost" size="sm" onClick={() => setReleaseAmount(String(outstanding / 2))}>Release 50%</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setReleaseAmount(String(outstanding))}>Release Full</Btn>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Notes</label>
                <textarea
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
                <Btn variant="secondary" onClick={() => setReleaseTarget(null)}>Cancel</Btn>
                <Btn
                  variant="primary"
                  disabled={invalid || !canReleaseRetainage}
                  loading={releaseRetainage.isPending}
                  onClick={() => {
                    if (!projectId || !releaseTarget) return
                    releaseRetainage.mutate(
                      {
                        id: releaseTarget.id,
                        project_id: projectId,
                        release_amount: amt,
                        released_by: user?.id ?? null,
                        notes: releaseNotes || null,
                      },
                      {
                        onSuccess: () => {
                          setReleaseTarget(null)
                          setReleaseAmount('')
                          setReleaseNotes('')
                        },
                      },
                    )
                  }}
                >
                  {releaseRetainage.isPending ? 'Releasing…' : 'Release'}
                </Btn>
              </div>
            </div>
          )
        })()}
      </Modal>
    </PageContainer>
  )
}

export const PaymentApplications: React.FC = () => (
  <ErrorBoundary message="Payment applications could not be displayed. Check your connection and try again.">
    <PaymentApplicationsPage />
  </ErrorBoundary>
)

export default PaymentApplications
