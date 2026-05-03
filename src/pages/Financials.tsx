import React, { useState, useMemo } from 'react'
import { DollarSign, Receipt, FileText, TrendingUp, Wallet, Check, X, BookOpen, BarChart3, Calculator, ClipboardList, Download, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Skeleton, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions, touchTarget } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useContracts, usePayApplications, useJobCostEntries, useInvoicesPayable, useWipReports, useRetainageLedger } from '../hooks/queries'
import { useBudgetRealtime } from '../hooks/queries/realtime'
import { MetricFlash } from '../components/ui/RealtimeFlash'

const fmtCurrency = (n: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
const fmtPct = (n: number | null) => `${(n || 0).toFixed(1)}%`

type TabKey = 'overview' | 'costs' | 'billing' | 'payables' | 'wip' | 'retainage' | 'cashflow' | 'revenue' | 'periodclose' | 'exports'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: TrendingUp },
  { key: 'costs', label: 'Job Costs', icon: DollarSign },
  { key: 'billing', label: 'Billing', icon: Receipt },
  { key: 'payables', label: 'Payables', icon: Wallet },
  { key: 'wip', label: 'WIP', icon: FileText },
  { key: 'retainage', label: 'Retainage', icon: DollarSign },
  { key: 'cashflow', label: 'Cash Flow', icon: BarChart3 },
  { key: 'revenue', label: 'Revenue', icon: Calculator },
  { key: 'periodclose', label: 'Period Close', icon: ClipboardList },
  { key: 'exports', label: 'Export Reports', icon: Download },
]

// ── Column helpers ───────────────────────────────────────────

const costCol = createColumnHelper<unknown>()
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

const billingCol = createColumnHelper<unknown>()
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

const payableCol = createColumnHelper<unknown>()
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

const wipCol = createColumnHelper<unknown>()
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

const retainageCol = createColumnHelper<unknown>()
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

// ── Cash Flow — Derived from Real Job Costs & Pay Apps ──────────────────────
// Computes monthly cash flow from actual job_cost_entries (expenses) and
// pay_applications (income). Falls back to empty if no data exists yet.
function buildCashFlowData(
  jobCosts: Array<Record<string, unknown>> | undefined,
  payApps: Array<Record<string, unknown>> | undefined,
) {
  const monthMap = new Map<string, { income: number; subcontractors: number; materials: number; labor: number; overhead: number }>()

  // Aggregate costs by month
  for (const entry of (jobCosts || [])) {
    const date = (entry.date as string) || (entry.created_at as string) || ''
    if (!date) continue
    const d = new Date(date)
    const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
    if (!monthMap.has(key)) monthMap.set(key, { income: 0, subcontractors: 0, materials: 0, labor: 0, overhead: 0 })
    const bucket = monthMap.get(key)!
    const costType = ((entry.cost_type as string) || '').toLowerCase()
    const amt = (entry.amount as number) || 0
    if (costType.includes('sub')) bucket.subcontractors += amt
    else if (costType.includes('material')) bucket.materials += amt
    else if (costType.includes('labor')) bucket.labor += amt
    else bucket.overhead += amt
  }

  // Aggregate income from pay apps by period
  for (const pa of (payApps || [])) {
    const periodTo = (pa.period_to as string) || ''
    if (!periodTo) continue
    const d = new Date(periodTo)
    const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
    if (!monthMap.has(key)) monthMap.set(key, { income: 0, subcontractors: 0, materials: 0, labor: 0, overhead: 0 })
    monthMap.get(key)!.income += (pa.current_payment_due as number) || (pa.total_completed_and_stored as number) || 0
  }

  // Sort by date and compute cumulative
  const sorted = Array.from(monthMap.entries())
    .sort((a, b) => new Date(`1 ${a[0]}`).getTime() - new Date(`1 ${b[0]}`).getTime())

  let cumulative = 0
  return sorted.map(([month, row]) => {
    const expenses = row.subcontractors + row.materials + row.labor + row.overhead
    const net = row.income - expenses
    cumulative += net
    return { month, ...row, expenses, net, cumulative }
  })
}

// ── Revenue Recognition — Derived from WIP Reports ──────────────────────
function buildRevenueData(wipReports: Array<Record<string, unknown>> | undefined) {
  if (!wipReports || wipReports.length === 0) return []
  // Sort by period/date
  const sorted = [...wipReports].sort((a, b) =>
    new Date((a.period_end as string) || (a.created_at as string) || 0).getTime() -
    new Date((b.period_end as string) || (b.created_at as string) || 0).getTime()
  )
  let prevRecognized = 0
  return sorted.map((wip, i) => {
    const estTotal = (wip.estimated_total_revenue as number) || (wip.contract_value as number) || 0
    const pctComplete = (wip.percent_complete as number) || 0
    const revenueRecognized = (wip.earned_revenue as number) || (estTotal * pctComplete / 100)
    const currentRecognition = revenueRecognized - prevRecognized
    const billedToDate = (wip.billed_to_date as number) || revenueRecognized
    const result = {
      period: `Period ${i + 1}`,
      estTotalRevenue: estTotal,
      pctComplete,
      revenueRecognized,
      prevRecognized,
      currentRecognition,
      billedToDate,
      overUnder: billedToDate - revenueRecognized,
    }
    prevRecognized = revenueRecognized
    return result
  })
}

// ── Period Close Checklist — Standard GC close steps (state-driven) ──────
const DEFAULT_CLOSE_CHECKLIST = [
  { id: 1, step: 'Reconcile subcontractor invoices', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
  { id: 2, step: 'Verify pay application amounts', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
  { id: 3, step: 'Post journal entries', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
  { id: 4, step: 'Review accruals', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
  { id: 5, step: 'Reconcile retainage', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
  { id: 6, step: 'Review commitments vs actuals', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
  { id: 7, step: 'Generate WIP report', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
  { id: 8, step: 'Manager review & sign-off', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
  { id: 9, step: 'Final close', responsible: '', dueDate: '', completionDate: null as string | null, status: 'pending' as const },
]

// ── Main Component ───────────────────────────────────────────

export const Financials: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const projectId = useProjectId()
  const { isFlashing } = useBudgetRealtime(projectId)
  const [revenueMethod, setRevenueMethod] = useState<'poc' | 'completed' | 'input'>('poc')
  const [periodStatus, setPeriodStatus] = useState<'Open' | 'In Progress' | 'Under Review' | 'Closed'>('In Progress')
  const [exportDateFrom, setExportDateFrom] = useState('2026-01-01')
  const [exportDateTo, setExportDateTo] = useState('2026-04-19')
  const [exportOwnerFacing, setExportOwnerFacing] = useState(false)
  const [closeChecklist, setCloseChecklist] = useState(DEFAULT_CLOSE_CHECKLIST)

  const { data: contracts, isLoading: loadingContracts } = useContracts(projectId)
  const { data: payApps, isLoading: loadingPayApps } = usePayApplications(projectId)
  const { data: jobCosts, isLoading: loadingCosts } = useJobCostEntries(projectId)
  const { data: invoices, isLoading: loadingInvoices } = useInvoicesPayable(projectId)
  const { data: wipReports, isLoading: loadingWip } = useWipReports(projectId)
  const { data: retainage, isLoading: loadingRetainage } = useRetainageLedger(projectId)

  // ── Derived data ───────────────────────────────────────────
  const cashFlowData = useMemo(() => buildCashFlowData(jobCosts, payApps), [jobCosts, payApps])
  const revenueData = useMemo(() => buildRevenueData(wipReports), [wipReports])

  // Build closed periods from WIP reports that have a closed/finalized status
  const closedPeriods = useMemo(() => {
    if (!wipReports || wipReports.length === 0) return []
    return wipReports
      .filter((w: Record<string, unknown>) => (w.status as string)?.toLowerCase() === 'closed' || (w.status as string)?.toLowerCase() === 'finalized')
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date((a.period_end as string) || 0).getTime() - new Date((b.period_end as string) || 0).getTime()
      )
      .map((w: Record<string, unknown>) => {
        const revenue = (w.earned_revenue as number) || 0
        const costs = (w.total_cost as number) || (w.cost_to_date as number) || 0
        const margin = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0
        return {
          period: (w.period_end as string) ? new Date(w.period_end as string).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown',
          status: 'Closed',
          closedBy: (w.closed_by_name as string) || (w.prepared_by as string) || '—',
          closedDate: (w.closed_at as string) || (w.updated_at as string) || '',
          revenue,
          costs,
          margin,
        }
      })
  }, [wipReports])

  // ── KPIs ───────────────────────────────────────────────────

  const contractValue = contracts
    ?.filter((c: unknown) => c.type === 'prime')
    .reduce((s: number, c: unknown) => s + (c.original_value || 0), 0) || 0

  const billedToDate = payApps
    ?.reduce((s: number, p: unknown) => s + (p.total_completed_and_stored || 0), 0) || 0

  const costsToDate = jobCosts
    ?.reduce((s: number, j: unknown) => s + (j.amount || 0), 0) || 0

  const retainageHeld = retainage
    ?.filter((r: unknown) => r.type === 'held_by_owner')
    .reduce((s: number, r: unknown) => s + (r.balance || 0), 0) || 0

  const apOutstanding = invoices
    ?.filter((i: unknown) => i.status !== 'paid')
    .reduce((s: number, i: unknown) => s + (i.total || 0), 0) || 0

  const grossMargin = billedToDate > 0
    ? ((billedToDate - costsToDate) / billedToDate) * 100
    : 0

  // Previous period billed: sum all pay apps except most recent (by period_to).
  // Falls back to 0 (no trend shown) when fewer than 2 pay apps exist.
  const previousBilledToDate = (() => {
    if (!payApps || payApps.length < 2) return 0;
    const sorted = [...payApps].sort((a: unknown, b: unknown) =>
      new Date(a.period_to || 0).getTime() - new Date(b.period_to || 0).getTime()
    );
    return sorted.slice(0, -1).reduce((s: number, p: unknown) => s + (p.total_completed_and_stored || 0), 0);
  })()

  // ── Render ─────────────────────────────────────────────────

  const isLoading = loadingContracts || loadingPayApps || loadingCosts || loadingInvoices || loadingWip || loadingRetainage

  return (
    <PageContainer
      title="Financials"
      subtitle="Contracts, billing, job costs, payables, WIP reporting, and retainage tracking"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Financials_Report" />
        </div>
      }
    >
      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="Financial sections"
        style={{
          display: 'flex',
          gap: spacing['1'],
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.lg,
          padding: spacing['1'],
          marginBottom: spacing['2xl'],
          overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `0 ${spacing['4']}`,
                minHeight: touchTarget.field,
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
                {payApps.slice(0, 5).map((pa: unknown, idx: number) => (
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
            {invoices && invoices.filter((i: unknown) => i.status !== 'paid').length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                {invoices.filter((i: unknown) => i.status !== 'paid').slice(0, 5).map((inv: unknown, idx: number) => (
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

      {/* ── Cash Flow Tab ─────────────────────────────────────── */}
      {activeTab === 'cashflow' && !isLoading && (
        <>
          {/* Cash Position Indicator */}
          {(() => {
            const currentCumulative = cashFlowData[cashFlowData.length - 1]?.cumulative || 0
            const contractTotal = contractValue || 1
            const pctOfContract = (currentCumulative / contractTotal) * 100
            const posColor = currentCumulative < 0 ? colors.statusCritical : pctOfContract < 10 ? colors.statusPending : colors.statusActive
            const posBg = currentCumulative < 0 ? colors.statusCriticalSubtle : pctOfContract < 10 ? colors.statusPendingSubtle : colors.statusActiveSubtle
            const posLabel = currentCumulative < 0 ? 'Negative' : pctOfContract < 10 ? 'Tight' : 'Positive'
            return (
              <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
                <Card padding={spacing['4']}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                    <div style={{ width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: posBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {currentCumulative < 0 ? <AlertTriangle size={18} color={posColor} /> : <CheckCircle2 size={18} color={posColor} />}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Cash Position</p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: posColor }}>{posLabel}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Cumulative Balance</p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmtCurrency(currentCumulative)}</p>
                    </div>
                  </div>
                </Card>
              </div>
            )
          })()}

          {/* Cash Flow Chart (Bar visualization) */}
          <Card padding={spacing['4']}>
            <SectionHeader title="12-Month Cash Flow Projection" />
            <div style={{ marginTop: spacing['4'], overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, minWidth: 800, height: 200, padding: `0 ${spacing['2']}` }}>
                {cashFlowData.map((row) => {
                  const maxVal = Math.max(...cashFlowData.map(r => Math.max(r.income, r.expenses)))
                  const incH = (row.income / maxVal) * 160
                  const expH = (row.expenses / maxVal) * 160
                  return (
                    <div key={row.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 170 }}>
                        <div style={{ width: 14, height: incH, backgroundColor: colors.statusActive, borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`, opacity: 0.85 }} title={`Income: ${fmtCurrency(row.income)}`} />
                        <div style={{ width: 14, height: expH, backgroundColor: colors.statusCritical, borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`, opacity: 0.7 }} title={`Expenses: ${fmtCurrency(row.expenses)}`} />
                      </div>
                      <span style={{ fontSize: 9, color: colors.textTertiary, transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>{row.month.slice(0, 3)}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: spacing['4'], justifyContent: 'center', marginTop: spacing['3'] }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                  <div style={{ width: 10, height: 10, backgroundColor: colors.statusActive, borderRadius: 2 }} /> Income
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                  <div style={{ width: 10, height: 10, backgroundColor: colors.statusCritical, borderRadius: 2 }} /> Expenses
                </span>
              </div>
            </div>
          </Card>

          {/* Cash Flow Table */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Monthly Cash Flow Detail" />
            <div style={{ overflowX: 'auto', marginTop: spacing['3'] }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.borderDefault}` }}>
                    {['Month', 'Income', 'Subcontractors', 'Materials', 'Labor', 'Overhead', 'Total Expenses', 'Net Cash Flow', 'Cumulative'].map((h) => (
                      <th key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: h === 'Month' ? 'left' : 'right', color: colors.textTertiary, fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.caption, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashFlowData.map((row) => (
                    <tr key={row.month} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, whiteSpace: 'nowrap' }}>{row.month}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.statusActive }}>{fmtCurrency(row.income)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textSecondary }}>{fmtCurrency(row.subcontractors)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textSecondary }}>{fmtCurrency(row.materials)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textSecondary }}>{fmtCurrency(row.labor)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textSecondary }}>{fmtCurrency(row.overhead)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>{fmtCurrency(row.expenses)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', fontWeight: typography.fontWeight.semibold, color: row.net >= 0 ? colors.statusActive : colors.statusCritical }}>{fmtCurrency(row.net)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', fontWeight: typography.fontWeight.semibold, color: row.cumulative >= 0 ? colors.textPrimary : colors.statusCritical }}>{fmtCurrency(row.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Revenue Recognition Tab ───────────────────────────── */}
      {activeTab === 'revenue' && !isLoading && (
        <>
          {/* Method Selector */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Revenue Recognition Method" />
            <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['3'], flexWrap: 'wrap' }}>
              {([
                { key: 'poc' as const, label: 'Percentage of Completion', desc: 'Revenue recognized proportional to costs incurred' },
                { key: 'completed' as const, label: 'Completed Contract', desc: 'Revenue deferred until project completion' },
                { key: 'input' as const, label: 'Input Method', desc: 'Revenue based on inputs (labor hours, costs)' },
              ]).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setRevenueMethod(m.key)}
                  style={{
                    flex: '1 1 200px', padding: spacing['3'], border: `2px solid ${revenueMethod === m.key ? colors.orangeText : colors.borderSubtle}`,
                    borderRadius: borderRadius.lg, backgroundColor: revenueMethod === m.key ? colors.surfaceRaised : 'transparent',
                    cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontFamily, transition: `all ${transitions.instant}`,
                  }}
                >
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: revenueMethod === m.key ? colors.orangeText : colors.textPrimary }}>{m.label}</p>
                  <p style={{ margin: `4px 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{m.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Revenue Table */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Revenue Recognition Schedule" />
            <div style={{ overflowX: 'auto', marginTop: spacing['3'] }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.borderDefault}` }}>
                    {['Period', 'Est. Total Revenue', '% Complete', 'Revenue Recognized', 'Previously Recognized', 'Current Period', 'Billed to Date', 'Over/Under Billing'].map((h) => (
                      <th key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: h === 'Period' ? 'left' : 'right', color: colors.textTertiary, fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.caption, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revenueData.map((row) => (
                    <tr key={row.period} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{row.period}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textSecondary }}>{fmtCurrency(row.estTotalRevenue)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{fmtPct(row.pctComplete)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textPrimary }}>{fmtCurrency(row.revenueRecognized)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textTertiary }}>{fmtCurrency(row.prevRecognized)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{fmtCurrency(row.currentRecognition)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textSecondary }}>{fmtCurrency(row.billedToDate)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', fontWeight: typography.fontWeight.semibold, color: row.overUnder > 0 ? colors.statusCritical : colors.statusActive }}>
                        {row.overUnder > 0 ? '+' : ''}{fmtCurrency(row.overUnder)}
                        <span style={{ fontSize: typography.fontSize.caption, marginLeft: 4, color: row.overUnder > 0 ? colors.statusCritical : colors.statusActive }}>
                          {row.overUnder > 0 ? 'Over' : 'Under'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ASC 606 Compliance */}
          <Card padding={spacing['4']}>
            <SectionHeader title="ASC 606 Compliance Notes" />
            <div style={{ marginTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {[
                { step: 'Step 1: Identify the Contract', note: 'Prime contract identified with enforceable rights and obligations. Contract value: $25.4M.' },
                { step: 'Step 2: Identify Performance Obligations', note: 'Single performance obligation — construction of commercial building per plans and specifications.' },
                { step: 'Step 3: Determine Transaction Price', note: 'Transaction price of $25,400,000 includes base contract plus approved change orders. Variable consideration (incentives/penalties) constrained.' },
                { step: 'Step 4: Allocate Transaction Price', note: 'Allocated entirely to single performance obligation.' },
                { step: 'Step 5: Recognize Revenue', note: 'Revenue recognized over time using cost-to-cost input method. Control transfers continuously as construction progresses on owner\'s property.' },
              ].map((item) => (
                <div key={item.step} style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, borderLeft: `3px solid ${colors.orangeText}` }}>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{item.step}</p>
                  <p style={{ margin: `4px 0 0`, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{item.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ── Period Close Tab ───────────────────────────────────── */}
      {activeTab === 'periodclose' && !isLoading && (
        <>
          {/* Period Status */}
          <Card padding={spacing['4']}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <SectionHeader title="April 2026 — Period Close" />
                <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['2'] }}>
                  {(['Open', 'In Progress', 'Under Review', 'Closed'] as const).map((s) => {
                    const isActive = s === periodStatus
                    const isPast = ['Open', 'In Progress', 'Under Review', 'Closed'].indexOf(s) < ['Open', 'In Progress', 'Under Review', 'Closed'].indexOf(periodStatus)
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: borderRadius.full, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isActive ? colors.orangeText : isPast ? colors.statusActive : colors.surfaceInset,
                          color: isActive || isPast ? '#fff' : colors.textTertiary, fontSize: 10, fontWeight: typography.fontWeight.semibold,
                        }}>
                          {isPast ? <Check size={10} /> : ['Open', 'In Progress', 'Under Review', 'Closed'].indexOf(s) + 1}
                        </div>
                        <span style={{ fontSize: typography.fontSize.caption, color: isActive ? colors.orangeText : isPast ? colors.statusActive : colors.textTertiary, fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal }}>{s}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <button
                onClick={() => {
                  const allComplete = closeChecklist.every((c) => c.status === 'complete')
                  if (allComplete) {
                    setPeriodStatus('Closed')
                    alert('Period closed successfully.')
                  } else {
                    alert('All checklist items must be complete before closing the period.')
                  }
                }}
                disabled={periodStatus === 'Closed'}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['4']}`,
                  backgroundColor: periodStatus === 'Closed' ? colors.surfaceInset : colors.orangeText, color: periodStatus === 'Closed' ? colors.textTertiary : '#fff',
                  border: 'none', borderRadius: borderRadius.base, cursor: periodStatus === 'Closed' ? 'not-allowed' : 'pointer',
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily,
                }}
              >
                <Lock size={14} />
                Close Period
              </button>
            </div>
          </Card>

          {/* Close Checklist */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Close Checklist" />
            <div style={{ marginTop: spacing['3'] }}>
              {closeChecklist.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '32px 1fr 150px 110px 110px', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    borderBottom: idx < closeChecklist.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                  }}
                >
                  <button
                    onClick={() => {
                      setCloseChecklist((prev) => prev.map((c) => c.id === item.id ? { ...c, status: c.status === 'complete' ? 'pending' as const : 'complete' as const, completionDate: c.status === 'complete' ? null : new Date().toISOString().split('T')[0] } : c))
                    }}
                    style={{
                      width: 24, height: 24, borderRadius: borderRadius.full, border: `2px solid ${item.status === 'complete' ? colors.statusActive : colors.borderDefault}`,
                      backgroundColor: item.status === 'complete' ? colors.statusActive : 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    {item.status === 'complete' && <Check size={12} color="#fff" />}
                  </button>
                  <span style={{ fontSize: typography.fontSize.sm, color: item.status === 'complete' ? colors.textTertiary : colors.textPrimary, textDecoration: item.status === 'complete' ? 'line-through' : 'none' }}>{item.step}</span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{item.responsible}</span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                  <span style={{ fontSize: typography.fontSize.caption, color: item.completionDate ? colors.statusActive : colors.textTertiary }}>
                    {item.completionDate ? new Date(item.completionDate).toLocaleDateString() : '--'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Historical Closed Periods */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Historical Closed Periods" />
            <div style={{ overflowX: 'auto', marginTop: spacing['3'] }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.borderDefault}` }}>
                    {['Period', 'Status', 'Closed By', 'Closed Date', 'Revenue', 'Costs', 'Margin'].map((h) => (
                      <th key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: h === 'Period' || h === 'Status' || h === 'Closed By' || h === 'Closed Date' ? 'left' : 'right', color: colors.textTertiary, fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.caption }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closedPeriods.map((p) => (
                    <tr key={p.period} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{p.period}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.statusActive, backgroundColor: colors.statusActiveSubtle }}>
                          <Lock size={10} /> {p.status}
                        </span>
                      </td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{p.closedBy}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{new Date(p.closedDate).toLocaleDateString()}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textPrimary }}>{fmtCurrency(p.revenue)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textSecondary }}>{fmtCurrency(p.costs)}</td>
                      <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', fontWeight: typography.fontWeight.semibold, color: p.margin >= 20 ? colors.statusActive : colors.statusPending }}>{fmtPct(p.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Export Reports Tab ─────────────────────────────────── */}
      {activeTab === 'exports' && !isLoading && (
        <Card padding={spacing['5']}>
          <SectionHeader title="Financial Report Generation" />
          <p style={{ margin: `${spacing['2']} 0 ${spacing['4']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            Generate enterprise financial reports for internal review or owner distribution.
          </p>

          {/* Date Range & Toggle */}
          <div style={{ display: 'flex', gap: spacing['4'], alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing['4'], padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
            <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              From:
              <input type="date" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)} style={{ marginLeft: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: colors.surfaceRaised, color: colors.textPrimary }} />
            </label>
            <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              To:
              <input type="date" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)} style={{ marginLeft: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: colors.surfaceRaised, color: colors.textPrimary }} />
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Internal</span>
              <button
                onClick={() => setExportOwnerFacing(!exportOwnerFacing)}
                style={{
                  width: 40, height: 22, borderRadius: borderRadius.full, border: 'none', cursor: 'pointer', position: 'relative',
                  backgroundColor: exportOwnerFacing ? colors.orangeText : colors.borderDefault, transition: `background ${transitions.instant}`,
                }}
              >
                <div style={{ width: 16, height: 16, borderRadius: borderRadius.full, backgroundColor: '#fff', position: 'absolute', top: 3, left: exportOwnerFacing ? 21 : 3, transition: `left ${transitions.instant}` }} />
              </button>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Owner-Facing</span>
            </div>
          </div>

          {/* Report Types */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: spacing['3'] }}>
            {[
              { name: 'Job Cost Report', desc: 'Detailed cost breakdown by code, vendor, and type with budget vs actual analysis', icon: DollarSign },
              { name: 'WIP Schedule', desc: 'Work-in-progress schedule with earned revenue, over/under billing, and completion %', icon: FileText },
              { name: 'Cash Flow Statement', desc: '12-month cash flow with income, expenses, and cumulative balance projections', icon: BarChart3 },
              { name: 'Revenue Recognition Schedule', desc: 'ASC 606 compliant revenue recognition with period-by-period breakdown', icon: Calculator },
            ].map((report) => (
              <div key={report.name} style={{ padding: spacing['4'], border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  {React.createElement(report.icon, { size: 16, color: colors.orangeText })}
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{report.name}</span>
                </div>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, lineHeight: 1.4 }}>{report.desc}</p>
                <p style={{ margin: 0, fontSize: 10, color: colors.textTertiary }}>
                  {exportDateFrom} to {exportDateTo} &middot; {exportOwnerFacing ? 'Owner-Facing' : 'Internal'}
                </p>
                <button
                  onClick={() => alert(`Generating ${report.name}...\nDate range: ${exportDateFrom} to ${exportDateTo}\nFormat: ${exportOwnerFacing ? 'Owner-Facing' : 'Internal'}`)}
                  style={{
                    marginTop: 'auto', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.orangeText}`, borderRadius: borderRadius.base,
                    backgroundColor: 'transparent', color: colors.orangeText, cursor: 'pointer', fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, transition: `all ${transitions.instant}`,
                  }}
                >
                  Generate Report
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  )
}

export default Financials
