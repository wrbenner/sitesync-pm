import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, Plus, Scale, Receipt,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer, Card, MetricBox, Btn, Skeleton, EmptyState } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { usePayApplications, useContracts, useRetainageLedger, useLienWaivers, useProject } from '../../hooks/queries'
import type { LienWaiverRow } from '../../types/api'
import { approvePayApplication } from '../../api/endpoints/payApplications'
import { updateLienWaiverStatus, generateWaiversFromPayApp } from '../../api/endpoints/lienWaivers'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { useCopilotStore } from '../../stores/copilotStore'
import { fmtCurrency, type TabKey, type PayAppProject } from './types'
import { PayAppList } from './PayAppList'
import { PayAppDetail } from './PayAppDetail'
import { LienWaiverPanel, CashFlowPanel } from './LienWaiverPanel'
import { CreateEditPayAppDrawer } from './SOVEditor'
import { useIsMobile } from '../../hooks/useWindowSize'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'applications', label: 'Pay Applications', icon: Receipt },
  { key: 'lien_waivers', label: 'Lien Waivers', icon: Scale },
  { key: 'cash_flow', label: 'Cash Flow', icon: DollarSign },
]

const PaymentApplicationsPage: React.FC = () => {
  const { setPageContext } = useCopilotStore()
  useEffect(() => { setPageContext('payment-applications') }, [setPageContext])

  const [activeTab, setActiveTab] = useState<TabKey>('applications')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [markingWaiverId, setMarkingWaiverId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerEditApp, setDrawerEditApp] = useState<Record<string, unknown> | null>(null)
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

  const handleApprove = useCallback(() => {
    if (selectedApp) approvePayAppMutation.mutate(selectedApp)
  }, [selectedApp, approvePayAppMutation])

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
          <MetricBox label="Total Paid" value={fmtCurrency(kpis.totalPaid)} change={1} />
          <MetricBox label="Retainage Held" value={fmtCurrency(kpis.totalRetainage)} />
        </div>
      )}

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

      {activeTab === 'applications' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
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
