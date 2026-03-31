import React, { useState, useMemo, useCallback, memo } from 'react'
import {
  DollarSign, FileText, CheckCircle, Clock, AlertTriangle,
  CreditCard, Send, Eye, Plus, ChevronRight, Building2,
  Scale, Receipt, ArrowRight, X,
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { usePayApplications, useContracts, useRetainageLedger } from '../hooks/queries'
import {
  getPaymentStatusConfig,
  getValidPaymentTransitions,
  calculateG702,
  calculateG703LineItem,
  getLienWaiverStatusConfig,
  LIEN_WAIVER_FORMS,
} from '../machines/paymentMachine'
import type { PaymentStatus, G702Data, G703LineItem, LienWaiverState } from '../machines/paymentMachine'
import { PermissionGate } from '../components/auth/PermissionGate'
import { toast } from 'sonner'

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

const G702SummaryCard = memo<{ app: Record<string, unknown> }>(({ app }) => {
  const rows = [
    { label: '1. Original Contract Sum', value: fmtCurrency(app.original_contract_sum as number) },
    { label: '2. Net Change by Change Orders', value: fmtCurrency(app.net_change_orders as number) },
    { label: '3. Contract Sum to Date (1 + 2)', value: fmtCurrency(app.contract_sum_to_date as number), bold: true },
    { label: '4. Total Completed and Stored to Date', value: fmtCurrency(app.total_completed_and_stored as number) },
    { label: '5. Retainage', value: fmtCurrency(app.retainage as number) },
    { label: '6. Total Earned Less Retainage (4 − 5)', value: fmtCurrency(app.total_earned_less_retainage as number) },
    { label: '7. Less Previous Certificates for Payment', value: fmtCurrency(app.less_previous_certificates as number) },
    { label: '8. Current Payment Due (6 − 7)', value: fmtCurrency(app.current_payment_due as number), bold: true, highlight: true },
    { label: '9. Balance to Finish (3 − 4)', value: fmtCurrency(app.balance_to_finish as number) },
  ]

  return (
    <Card padding={spacing['5']}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <FileText size={16} color={colors.primaryOrange} />
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          AIA G702 Summary
        </span>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>
          Application #{app.application_number as number} · Period to {fmtDate(app.period_to as string)}
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
      <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['4'] }}>
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
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => toast.info('Generating PDF...')}
        >
          <FileText size={14} /> Export G702 PDF
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => toast.info('Opening G703 continuation sheet...')}
        >
          <Receipt size={14} /> View G703
        </Btn>
      </div>
    </Card>
  )
})
G702SummaryCard.displayName = 'G702SummaryCard'

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

// ── Lien Waiver Panel ─────────────────────────────────────────

const LienWaiverPanel = memo<{ payApps: Array<Record<string, unknown>> }>(({ payApps }) => {
  const approvedApps = payApps.filter((a) => a.status === 'approved' || a.status === 'paid')

  const stateOptions: { value: LienWaiverState; label: string }[] = [
    { value: 'california', label: 'California' },
    { value: 'texas', label: 'Texas' },
    { value: 'florida', label: 'Florida' },
    { value: 'new_york', label: 'New York' },
    { value: 'generic', label: 'Generic' },
  ]

  return (
    <div>
      <Card padding={spacing['5']}>
        <SectionHeader title="Lien Waiver Compliance" />
        <div style={{ marginTop: spacing['4'] }}>
          {approvedApps.length > 0 ? approvedApps.map((app) => {
            const isPaid = app.status === 'paid'
            const waiverStatus = isPaid ? 'unconditional' : 'conditional'
            const statusConfig = getLienWaiverStatusConfig(waiverStatus)

            return (
              <div
                key={app.id as string}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                  padding: `${spacing['3']} 0`,
                  borderBottom: `1px solid ${colors.borderSubtle}`,
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
                  </p>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                  padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                  color: statusConfig.color, backgroundColor: statusConfig.bg,
                }}>
                  {statusConfig.label}
                </span>
                <button
                  onClick={() => toast.success(`Generating ${waiverStatus} lien waiver...`)}
                  style={{
                    padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base, backgroundColor: 'transparent',
                    color: colors.textSecondary, fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                  }}
                >
                  Generate
                </button>
              </div>
            )
          }) : (
            <EmptyState
              icon={<Scale size={28} color={colors.textTertiary} />}
              title="No waivers required"
              description="Lien waivers will appear here when payment applications are approved."
            />
          )}
        </div>
      </Card>

      {/* State Selector */}
      <Card padding={spacing['5']} style={{ marginTop: spacing['4'] }}>
        <SectionHeader title="Waiver Form Templates" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: spacing['3'], marginTop: spacing['3'] }}>
          {stateOptions.map((state) => {
            const forms = LIEN_WAIVER_FORMS[state.value]
            return (
              <div key={state.value} style={{
                padding: spacing['4'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
              }}>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['2'] }}>
                  {state.label}
                </p>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, lineHeight: typography.lineHeight.normal }}>
                  {forms.conditional.substring(0, 60)}...
                </p>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
})
LienWaiverPanel.displayName = 'LienWaiverPanel'

// ── Main Page ─────────────────────────────────────────────────

export const PaymentApplications: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('applications')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const projectId = useProjectId()
  const { data: payApps, isLoading: loadingApps } = usePayApplications(projectId)
  const { data: contracts, isLoading: loadingContracts } = useContracts(projectId)
  const { data: retainage, isLoading: loadingRetainage } = useRetainageLedger(projectId)

  const apps = (payApps ?? []) as Array<Record<string, unknown>>
  const selectedApp = apps.find((a) => a.id === selectedAppId)

  const isLoading = loadingApps || loadingContracts || loadingRetainage

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

      {/* KPIs */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          <MetricBox label="Total Applications" value={kpis.total} />
          <MetricBox label="Total Billed" value={fmtCurrency(kpis.totalDue)} />
          <MetricBox label="Total Paid" value={fmtCurrency(kpis.totalPaid)} change={1} />
          <MetricBox label="Retainage Held" value={fmtCurrency(kpis.totalRetainage)} />
        </div>
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

          {/* Selected app G702 detail */}
          {selectedApp && <G702SummaryCard app={selectedApp} />}

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
      {activeTab === 'lien_waivers' && !isLoading && <LienWaiverPanel payApps={apps} />}

      {/* Cash Flow Tab */}
      {activeTab === 'cash_flow' && !isLoading && (
        <CashFlowPanel payApps={apps} retainage={(retainage ?? []) as Array<Record<string, unknown>>} />
      )}
    </PageContainer>
  )
}

export default PaymentApplications
