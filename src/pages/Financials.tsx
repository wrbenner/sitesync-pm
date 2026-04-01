import React, { useState } from 'react'
import { DollarSign, Receipt, FileText, TrendingUp, Wallet, Plus, Check, X, BookOpen } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useContracts, usePayApplications, useJobCostEntries, useInvoicesPayable, useWipReports, useRetainageLedger } from '../hooks/queries'
import { useBudgetRealtime } from '../hooks/queries/realtime'
import { MetricFlash } from '../components/ui/RealtimeFlash'
import { toast } from 'sonner'

const fmtCurrency = (n: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
const fmtPct = (n: number | null) => `${(n || 0).toFixed(1)}%`

type TabKey = 'overview' | 'costs' | 'billing' | 'payables' | 'wip' | 'retainage'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: TrendingUp },
  { key: 'costs', label: 'Job Costs', icon: DollarSign },
  { key: 'billing', label: 'Billing', icon: Receipt },
  { key: 'payables', label: 'Payables', icon: Wallet },
  { key: 'wip', label: 'WIP', icon: FileText },
  { key: 'retainage', label: 'Retainage', icon: DollarSign },
]

// ── Column helpers ───────────────────────────────────────────

const costCol = createColumnHelper<any>()
const costColumns = [
  costCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  costCol.accessor('cost_code', {
    header: 'Cost Code',
    cell: (info) => (
      <span style={{ fontFamily: 'monospace', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
        {info.getValue()}
      </span>
    ),
  }),
  costCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
        {info.getValue()}
      </span>
    ),
  }),
  costCol.accessor('vendor', {
    header: 'Vendor',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  costCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      const typeColor = v === 'labor' ? colors.statusInfo
        : v === 'material' ? colors.statusActive
        : v === 'equipment' ? colors.statusPending
        : colors.textSecondary
      const typeBg = v === 'labor' ? colors.statusInfoSubtle
        : v === 'material' ? colors.statusActiveSubtle
        : v === 'equipment' ? colors.statusPendingSubtle
        : colors.surfaceInset
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: typeColor, backgroundColor: typeBg,
        }}>
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  costCol.accessor('amount', {
    header: 'Amount',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        {fmtCurrency(info.getValue())}
      </span>
    ),
  }),
  costCol.accessor('invoice_number', {
    header: 'Invoice #',
    cell: (info) => <span style={{ color: colors.textTertiary, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>{info.getValue() || ''}</span>,
  }),
  costCol.accessor('posted', {
    header: 'Posted',
    cell: (info) => {
      const v = info.getValue()
      return v
        ? React.createElement(Check, { size: 14, color: colors.statusActive })
        : React.createElement(X, { size: 14, color: colors.textTertiary })
    },
  }),
]

const billingCol = createColumnHelper<any>()
const billingColumns = [
  billingCol.accessor('application_number', {
    header: 'App #',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>
        #{info.getValue()}
      </span>
    ),
  }),
  billingCol.accessor('period_to', {
    header: 'Period To',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  billingCol.accessor('contract_sum', {
    header: 'Contract Sum',
    cell: (info) => <span style={{ color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  billingCol.accessor('total_completed_and_stored', {
    header: 'Completed',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  billingCol.accessor('retainage', {
    header: 'Retainage',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  billingCol.accessor('payment_due', {
    header: 'Payment Due',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{fmtCurrency(info.getValue())}</span>,
  }),
  billingCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'paid' ? colors.statusActive
        : v === 'submitted' ? colors.statusInfo
        : v === 'approved' ? colors.statusActive
        : v === 'rejected' ? colors.statusCritical
        : colors.statusPending
      const statusBg = v === 'paid' ? colors.statusActiveSubtle
        : v === 'submitted' ? colors.statusInfoSubtle
        : v === 'approved' ? colors.statusActiveSubtle
        : v === 'rejected' ? colors.statusCriticalSubtle
        : colors.statusPendingSubtle
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  billingCol.accessor('certified_date', {
    header: 'Certified Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
]

const payableCol = createColumnHelper<any>()
const payableColumns = [
  payableCol.accessor('vendor', {
    header: 'Vendor',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  payableCol.accessor('invoice_number', {
    header: 'Invoice #',
    cell: (info) => <span style={{ fontFamily: 'monospace', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{info.getValue()}</span>,
  }),
  payableCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  payableCol.accessor('due_date', {
    header: 'Due Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  payableCol.accessor('total', {
    header: 'Amount',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  payableCol.accessor('cost_code', {
    header: 'Cost Code',
    cell: (info) => <span style={{ fontFamily: 'monospace', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{info.getValue() || ''}</span>,
  }),
  payableCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'paid' ? colors.statusActive
        : v === 'approved' ? colors.statusInfo
        : v === 'overdue' ? colors.statusCritical
        : colors.statusPending
      const statusBg = v === 'paid' ? colors.statusActiveSubtle
        : v === 'approved' ? colors.statusInfoSubtle
        : v === 'overdue' ? colors.statusCriticalSubtle
        : colors.statusPendingSubtle
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  payableCol.display({
    id: 'aging',
    header: 'Aging',
    cell: (info) => {
      const dueDate = info.row.original.due_date
      if (!dueDate) return <span style={{ color: colors.textTertiary }}>N/A</span>
      const now = new Date()
      const due = new Date(dueDate)
      const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      if (days <= 0) return <span style={{ color: colors.statusActive }}>Current</span>
      const agingColor = days < 30 ? colors.statusActive : days <= 60 ? colors.statusPending : colors.statusCritical
      return <span style={{ fontWeight: typography.fontWeight.medium, color: agingColor }}>{days}d</span>
    },
  }),
]

const wipCol = createColumnHelper<any>()
const wipColumns = [
  wipCol.accessor('period_end', {
    header: 'Period End',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  wipCol.accessor('contract_amount', {
    header: 'Contract Amount',
    cell: (info) => <span style={{ color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  wipCol.accessor('costs_to_date', {
    header: 'Costs to Date',
    cell: (info) => <span style={{ color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  wipCol.accessor('est_costs_to_complete', {
    header: 'Est to Complete',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  wipCol.accessor('pct_complete', {
    header: '% Complete',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{fmtPct(info.getValue())}</span>,
  }),
  wipCol.accessor('earned_revenue', {
    header: 'Earned Revenue',
    cell: (info) => <span style={{ color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  wipCol.accessor('billed', {
    header: 'Billed',
    cell: (info) => <span style={{ color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  wipCol.display({
    id: 'over_under',
    header: 'Over/Under',
    cell: (info) => {
      const earned = info.row.original.earned_revenue || 0
      const billed = info.row.original.billed || 0
      const diff = billed - earned
      const isOver = diff > 0
      return (
        <span style={{
          fontWeight: typography.fontWeight.semibold,
          color: isOver ? colors.statusCritical : colors.statusActive,
        }}>
          {isOver ? '+' : ''}{fmtCurrency(diff)}
        </span>
      )
    },
  }),
]

const retainageCol = createColumnHelper<any>()
const retainageColumns = [
  retainageCol.accessor('contract_name', {
    header: 'Contract',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  retainageCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return <span style={{ color: colors.textSecondary }}>{v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : ''}</span>
    },
  }),
  retainageCol.accessor('amount_held', {
    header: 'Amount Held',
    cell: (info) => <span style={{ color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  retainageCol.accessor('released', {
    header: 'Released',
    cell: (info) => <span style={{ color: colors.statusActive }}>{fmtCurrency(info.getValue())}</span>,
  }),
  retainageCol.accessor('balance', {
    header: 'Balance',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmtCurrency(info.getValue())}</span>,
  }),
  retainageCol.accessor('release_date', {
    header: 'Release Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'TBD'}
      </span>
    ),
  }),
  retainageCol.accessor('conditions', {
    header: 'Conditions',
    cell: (info) => (
      <span style={{ color: colors.textSecondary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
        {info.getValue() || ''}
      </span>
    ),
  }),
]

// ── Main Component ───────────────────────────────────────────

export const Financials: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const projectId = useProjectId()
  const { isFlashing } = useBudgetRealtime(projectId)

  const { data: contracts, isLoading: loadingContracts } = useContracts(projectId)
  const { data: payApps, isLoading: loadingPayApps } = usePayApplications(projectId)
  const { data: jobCosts, isLoading: loadingCosts } = useJobCostEntries(projectId)
  const { data: invoices, isLoading: loadingInvoices } = useInvoicesPayable(projectId)
  const { data: wipReports, isLoading: loadingWip } = useWipReports(projectId)
  const { data: retainage, isLoading: loadingRetainage } = useRetainageLedger(projectId)

  // ── KPIs ───────────────────────────────────────────────────

  const contractValue = contracts
    ?.filter((c: any) => c.type === 'prime')
    .reduce((s: number, c: any) => s + (c.original_value || 0), 0) || 0

  const billedToDate = payApps
    ?.reduce((s: number, p: any) => s + (p.total_completed_and_stored || 0), 0) || 0

  const costsToDate = jobCosts
    ?.reduce((s: number, j: any) => s + (j.amount || 0), 0) || 0

  const retainageHeld = retainage
    ?.filter((r: any) => r.type === 'held_by_owner')
    .reduce((s: number, r: any) => s + (r.balance || 0), 0) || 0

  const apOutstanding = invoices
    ?.filter((i: any) => i.status !== 'paid')
    .reduce((s: number, i: any) => s + (i.total || 0), 0) || 0

  const grossMargin = billedToDate > 0
    ? ((billedToDate - costsToDate) / billedToDate) * 100
    : 0

  // Previous period billed: sum all pay apps except most recent (by period_to).
  // Falls back to 0 (no trend shown) when fewer than 2 pay apps exist.
  const previousBilledToDate = (() => {
    if (!payApps || payApps.length < 2) return 0;
    const sorted = [...payApps].sort((a: any, b: any) =>
      new Date(a.period_to || 0).getTime() - new Date(b.period_to || 0).getTime()
    );
    return sorted.slice(0, -1).reduce((s: number, p: any) => s + (p.total_completed_and_stored || 0), 0);
  })()

  // ── Tab actions ────────────────────────────────────────────

  const addButtonLabel: Record<TabKey, string> = {
    overview: '',
    costs: 'New Cost Entry',
    billing: 'New Pay App',
    payables: 'New Invoice',
    wip: 'New WIP Report',
    retainage: 'New Entry',
  }

  const handleAdd = () => {
    toast.info('Form submission requires backend configuration')
  }

  // ── Render ─────────────────────────────────────────────────

  const isLoading = loadingContracts || loadingPayApps || loadingCosts || loadingInvoices || loadingWip || loadingRetainage

  return (
    <PageContainer
      title="Financials"
      subtitle="Contracts, billing, job costs, payables, WIP reporting, and retainage tracking"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Financials_Report" />
          {activeTab !== 'overview' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd}>
              {addButtonLabel[activeTab]}
            </Btn>
          )}
        </div>
      }
    >
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: spacing['1'],
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        padding: spacing['1'],
        marginBottom: spacing['2xl'],
        overflowX: 'auto',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none',
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`,
                whiteSpace: 'nowrap',
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && !isLoading && contractValue === 0 && (
        <Card padding={spacing['5']}>
          <EmptyState
            icon={<BookOpen size={48} />}
            title="No Financial Data Yet"
            description="Once contracts are created and pay applications are submitted, your project financials will appear here."
          />
        </Card>
      )}

      {activeTab === 'overview' && !isLoading && contractValue > 0 && (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricFlash isFlashing={isFlashing}>
              <MetricBox
                label="Contract Value"
                value={contractValue}
                format="currency"
              />
            </MetricFlash>
            <MetricFlash isFlashing={isFlashing}>
              <MetricBox
                label="Billed to Date"
                value={billedToDate}
                format="currency"
                previousValue={previousBilledToDate}
              />
            </MetricFlash>
            <MetricFlash isFlashing={isFlashing}>
              <MetricBox
                label="Costs to Date"
                value={costsToDate}
                format="currency"
              />
            </MetricFlash>
            <MetricFlash isFlashing={isFlashing}>
              <MetricBox
                label="Retainage Held"
                value={retainageHeld}
                format="currency"
              />
            </MetricFlash>
            <MetricFlash isFlashing={isFlashing}>
              <MetricBox
                label="AP Outstanding"
                value={apOutstanding}
                format="currency"
                colorOverride={apOutstanding > 0 ? 'warning' : undefined}
              />
            </MetricFlash>
            <MetricFlash isFlashing={isFlashing}>
              <MetricBox
                label="Gross Margin"
                value={grossMargin}
                format="percent"
                colorOverride={grossMargin >= 10 ? 'success' : 'danger'}
                change={grossMargin >= 10 ? 1 : -1}
                changeLabel="billed vs costs"
              />
            </MetricFlash>
          </div>

          {/* Recent Pay Applications */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Recent Pay Applications" />
            {payApps && payApps.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                {payApps.slice(0, 5).map((pa: any, idx: number) => (
                  <div
                    key={pa.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing['3']} 0`,
                      borderBottom: idx < Math.min(payApps.length, 5) - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                        Pay App #{pa.application_number}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                        Period to {pa.period_to ? new Date(pa.period_to).toLocaleDateString() : ''} &middot; {fmtCurrency(pa.payment_due)}
                      </p>
                    </div>
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      color: pa.status === 'paid' ? colors.statusActive : pa.status === 'rejected' ? colors.statusCritical : colors.statusPending,
                    }}>
                      {pa.status ? pa.status.charAt(0).toUpperCase() + pa.status.slice(1) : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
                No pay applications submitted yet.
              </p>
            )}
          </Card>

          {/* Outstanding Payables */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Outstanding Payables" />
            {invoices && invoices.filter((i: any) => i.status !== 'paid').length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                {invoices.filter((i: any) => i.status !== 'paid').slice(0, 5).map((inv: any, idx: number) => (
                  <div
                    key={inv.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing['3']} 0`,
                      borderBottom: idx < 4 ? `1px solid ${colors.borderSubtle}` : 'none',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                        {inv.vendor}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                        Invoice #{inv.invoice_number} &middot; Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                    }}>
                      {fmtCurrency(inv.total)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
                No outstanding payables. All invoices are paid.
              </p>
            )}
          </Card>
        </>
      )}

      {/* Job Costs Tab */}
      {activeTab === 'costs' && !isLoading && (
        <Card>
          <DataTable
            columns={costColumns}
            data={jobCosts || []}
            enableSorting
          />
        </Card>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && !isLoading && (
        <Card>
          <DataTable
            columns={billingColumns}
            data={payApps || []}
            enableSorting
          />
        </Card>
      )}

      {/* Payables Tab */}
      {activeTab === 'payables' && !isLoading && (
        <Card>
          <DataTable
            columns={payableColumns}
            data={invoices || []}
            enableSorting
          />
        </Card>
      )}

      {/* WIP Tab */}
      {activeTab === 'wip' && !isLoading && (
        <Card>
          <DataTable
            columns={wipColumns}
            data={wipReports || []}
            enableSorting
          />
        </Card>
      )}

      {/* Retainage Tab */}
      {activeTab === 'retainage' && !isLoading && (
        <Card>
          <DataTable
            columns={retainageColumns}
            data={retainage || []}
            enableSorting
          />
        </Card>
      )}
    </PageContainer>
  )
}

export default Financials
