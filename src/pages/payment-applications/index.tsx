import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, Plus, Scale, Receipt, ShieldCheck, FileText, X, ArrowRight, CheckCircle2, Clock, ClipboardCheck, Unlock,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { PageContainer, Card, MetricBox, Btn, Skeleton, EmptyState } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { usePayApplications, useContracts, useRetainageLedger, useLienWaivers, useProject } from '../../hooks/queries'
import type { LienWaiverRow } from '../../types/api'
import { approvePayApplication, markPayApplicationAsPaid } from '../../api/endpoints/payApplications'
import { updateLienWaiverStatus, generateWaiversFromPayApp } from '../../api/endpoints/lienWaivers'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation'
import { PageInsightBanners } from '../../components/ai/PredictiveAlert'
import { useCopilotStore } from '../../stores/copilotStore'
import { fmtCurrency, type TabKey, type PayAppProject } from './types'
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

  const handleRetainageRelease = useCallback(async (itemId: string) => {
    setRetainageItems((prev) => prev.map((item) =>
      item.id === itemId
        ? { ...item, stage: 'requested' as RetainageStage }
        : item
    ))
    const { error } = await supabase
      .from('retainage_ledger')
      .update({ stage: 'requested', updated_at: new Date().toISOString() })
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
  const { data: lienWaivers } = useLienWaivers(projectId)
  const { data: project } = useProject(projectId)

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
        id: (r.id as string) || String(Math.random()),
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
      )}

      {activeTab === 'cash_flow' && !isLoading && (
        <CashFlowPanel payApps={apps} retainage={(retainage ?? []) as Array<Record<string, unknown>>} />
      )}

      {/* ── Retainage Release Workflow Tab ──────────────────── */}
      {activeTab === 'retainage' && !isLoading && (() => {
        const totalHeld = retainageItems.reduce((s, i) => s + i.retainageHeld, 0)
        const totalReleased = retainageItems.reduce((s, i) => s + i.retainageReleased, 0)
        const totalUnreleased = totalHeld - totalReleased
        const releasedPct = totalHeld > 0 ? (totalReleased / totalHeld) * 100 : 0
        const originalSubtotal = retainageItems.filter((i) => !i.isCO).reduce((s, i) => s + i.retainageHeld, 0)
        const coSubtotal = retainageItems.filter((i) => i.isCO).reduce((s, i) => s + i.retainageHeld, 0)

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
                              )}
                              {item.stage === 'requested' && (
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
                    const totals = g703Lines.reduce((acc, l) => ({
                      scheduled: acc.scheduled + l.scheduled,
                      prevComplete: acc.prevComplete + l.prevComplete,
                      thisPeriod: acc.thisPeriod + l.thisPeriod,
                      materialsStored: acc.materialsStored + l.materialsStored,
                      totalCompleted: acc.totalCompleted + l.totalCompleted,
                      balanceToFinish: acc.balanceToFinish + l.balanceToFinish,
                      retainage: acc.retainage + l.retainage,
                    }), { scheduled: 0, prevComplete: 0, thisPeriod: 0, materialsStored: 0, totalCompleted: 0, balanceToFinish: 0, retainage: 0 })
                    const origTotal = g703Lines.filter((l) => !l.item.startsWith('CO#')).reduce((s, l) => s + l.scheduled, 0)
                    const coTotal = g703Lines.filter((l) => l.item.startsWith('CO#')).reduce((s, l) => s + l.scheduled, 0)
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
    </PageContainer>
  )
}

export const PaymentApplications: React.FC = () => (
  <ErrorBoundary message="Payment applications could not be displayed. Check your connection and try again.">
    <PaymentApplicationsPage />
  </ErrorBoundary>
)

export default PaymentApplications
