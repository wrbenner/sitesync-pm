import React, { useState, useMemo } from 'react'
import { Calculator, Users, Ruler, Plus, DollarSign, Award } from 'lucide-react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions, touchTarget } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useEstimates, useBidPackages, useTakeoffItems } from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'estimates' | 'bids' | 'takeoffs'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'estimates', label: 'Estimates', icon: Calculator },
  { key: 'bids', label: 'Bid Packages', icon: Users },
  { key: 'takeoffs', label: 'Takeoffs', icon: Ruler },
]

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ── Column helpers ───────────────────────────────────────────

const estimateCol = createColumnHelper<any>()
const estimateColumns = [
  estimateCol.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  estimateCol.accessor('estimate_type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return <span style={{ color: colors.textSecondary }}>{v ? v.replace(/_/g, ' ') : ''}</span>
    },
  }),
  estimateCol.accessor('version', {
    header: 'Version',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>v{info.getValue() || 1}</span>
    ),
  }),
  estimateCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'awarded' ? colors.statusActive
        : v === 'lost' ? colors.statusCritical
        : v === 'submitted' ? colors.statusPending
        : v === 'in_review' ? colors.statusInfo
        : colors.textSecondary
      const statusBg = v === 'awarded' ? colors.statusActiveSubtle
        : v === 'lost' ? colors.statusCriticalSubtle
        : v === 'submitted' ? colors.statusPendingSubtle
        : v === 'in_review' ? colors.statusInfoSubtle
        : colors.surfaceInset
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : ''}
        </span>
      )
    },
  }),
  estimateCol.accessor('total_amount', {
    header: 'Total Amount',
    cell: (info) => {
      const v = info.getValue() as number | null
      if (v == null) return <span style={{ color: colors.textTertiary }}>N/A</span>
      return <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmtCurrency(v)}</span>
    },
  }),
  estimateCol.accessor('due_date', {
    header: 'Due Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  estimateCol.accessor('created_at', {
    header: 'Created',
    cell: (info) => (
      <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
]

const bidCol = createColumnHelper<any>()
const bidColumns = [
  bidCol.accessor('name', {
    header: 'Package Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  bidCol.accessor('trade', {
    header: 'Trade',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  bidCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'awarded' ? colors.statusActive
        : v === 'closed' ? colors.textTertiary
        : v === 'open' ? colors.statusInfo
        : v === 'evaluating' ? colors.statusPending
        : colors.textSecondary
      const statusBg = v === 'awarded' ? colors.statusActiveSubtle
        : v === 'closed' ? colors.surfaceInset
        : v === 'open' ? colors.statusInfoSubtle
        : v === 'evaluating' ? colors.statusPendingSubtle
        : colors.surfaceInset
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
  bidCol.accessor('issue_date', {
    header: 'Issue Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  bidCol.accessor('due_date', {
    header: 'Due Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  bidCol.accessor('response_count', {
    header: 'Responses',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textSecondary }}>{v ?? 0}</span>
    },
  }),
]

const takeoffCol = createColumnHelper<any>()
const takeoffColumns = [
  takeoffCol.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  takeoffCol.accessor('category', {
    header: 'Category',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  takeoffCol.accessor('takeoff_type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return <span style={{ color: colors.textSecondary }}>{v ? v.replace(/_/g, ' ') : ''}</span>
    },
  }),
  takeoffCol.accessor('quantity', {
    header: 'Quantity',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{v != null ? v.toLocaleString() : ''}</span>
    },
  }),
  takeoffCol.accessor('unit', {
    header: 'Unit',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  takeoffCol.accessor('drawing_ref', {
    header: 'Drawing',
    cell: (info) => <span style={{ color: colors.textTertiary }}>{info.getValue() || ''}</span>,
  }),
  takeoffCol.accessor('color', {
    header: 'Color',
    cell: (info) => {
      const v = info.getValue() as string | null
      if (!v) return <span style={{ color: colors.textTertiary }}>None</span>
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <div style={{ width: 12, height: 12, borderRadius: borderRadius.sm, backgroundColor: v, border: `1px solid ${colors.borderDefault}` }} />
          <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>{v}</span>
        </div>
      )
    },
  }),
]

// ── Main Component ───────────────────────────────────────────

const EstimatingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('estimates')
  const projectId = useProjectId()
  const { data: estimates, isPending: estimatesLoading } = useEstimates(projectId)
  const { data: bidPackages, isPending: bidsLoading } = useBidPackages(projectId)
  const { data: takeoffItems, isPending: takeoffsLoading } = useTakeoffItems(projectId)

  // ── KPIs ───────────────────────────────────────────────────

  const totalEstimateValue = useMemo(
    () => estimates?.reduce((s: number, e: any) => s + (e.total_amount || 0), 0) || 0,
    [estimates],
  )
  const activeEstimates = useMemo(
    () => estimates?.filter((e: any) => e.status === 'draft' || e.status === 'in_review' || e.status === 'submitted').length || 0,
    [estimates],
  )
  const awardedCount = useMemo(
    () => estimates?.filter((e: any) => e.status === 'awarded').length || 0,
    [estimates],
  )
  const activeBids = useMemo(
    () => bidPackages?.filter((b: any) => b.status !== 'awarded' && b.status !== 'draft').length || 0,
    [bidPackages],
  )

  // ── Tab actions ────────────────────────────────────────────

  const addButtonLabel: Record<TabKey, string> = {
    estimates: 'New Estimate',
    bids: 'Create Bid Package',
    takeoffs: 'New Takeoff',
  }

  const handleAdd = () => {
    toast.info('Submission requires backend configuration')
  }

  // ── Render ─────────────────────────────────────────────────

  const isLoading = estimatesLoading || bidsLoading || takeoffsLoading

  return (
    <PageContainer
      title="Estimating"
      subtitle="Preconstruction estimates, bid packages, and quantity takeoffs"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Estimating_Report" />
          <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd}>
            {addButtonLabel[activeTab]}
          </Btn>
        </div>
      }
    >
      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="Estimating sections"
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
          const Icon = tab.icon
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
              {React.createElement(Icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* Estimates Tab */}
      {activeTab === 'estimates' && !isLoading && (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox
              label="Total Pipeline Value"
              value={fmtCurrency(totalEstimateValue)}
              icon={<DollarSign size={18} />}
            />
            <MetricBox
              label="Active Estimates"
              value={activeEstimates}
              icon={<Calculator size={18} />}
            />
            <MetricBox
              label="Awarded"
              value={awardedCount}
              icon={<Award size={18} />}
            />
            <MetricBox
              label="Open Bid Packages"
              value={activeBids}
              icon={<Users size={18} />}
            />
          </div>

          <Card>
            <SectionHeader title="All Estimates" />
            <DataTable
              data={estimates || []}
              columns={estimateColumns}
              emptyMessage="No estimates yet. Create your first estimate to get started."
            />
          </Card>
        </>
      )}

      {/* Bids Tab */}
      {activeTab === 'bids' && !isLoading && (
        <Card>
          <SectionHeader title="Bid Packages" />
          <DataTable
            data={bidPackages || []}
            columns={bidColumns}
            emptyMessage="No bid packages yet. Create a bid package to start collecting proposals."
          />
        </Card>
      )}

      {/* Takeoffs Tab */}
      {activeTab === 'takeoffs' && !isLoading && (
        <Card>
          <SectionHeader title="Quantity Takeoffs" />
          <DataTable
            data={takeoffItems || []}
            columns={takeoffColumns}
            emptyMessage="No takeoff items yet. Start a new takeoff to measure quantities from drawings."
          />
        </Card>
      )}
    </PageContainer>
  )
}

export const Estimating: React.FC = () => (
  <ErrorBoundary message="Estimating could not be displayed. Check your connection and try again.">
    <EstimatingPage />
  </ErrorBoundary>
)

export default Estimating
