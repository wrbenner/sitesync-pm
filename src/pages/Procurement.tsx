import React, { useState, useMemo } from 'react'
import { Truck, Warehouse, Plus, DollarSign } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions, touchTarget } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { usePurchaseOrders, useDeliveries, useMaterialInventory } from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'orders' | 'deliveries' | 'inventory'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'orders', label: 'Purchase Orders', icon: DollarSign },
  { key: 'deliveries', label: 'Deliveries', icon: Truck },
  { key: 'inventory', label: 'Inventory', icon: Warehouse },
]

// ── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function statusBadge(value: string | null | undefined) {
  const v = (value || '').toLowerCase()
  let color = colors.statusInfo
  let bg = colors.statusInfoSubtle
  if (v === 'approved' || v === 'received' || v === 'complete' || v === 'delivered') {
    color = colors.statusActive
    bg = colors.statusActiveSubtle
  } else if (v === 'pending' || v === 'in_transit' || v === 'partial') {
    color = colors.statusPending
    bg = colors.statusPendingSubtle
  } else if (v === 'rejected' || v === 'cancelled' || v === 'overdue') {
    color = colors.statusCritical
    bg = colors.statusCriticalSubtle
  }
  const label = v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : ''
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color, backgroundColor: bg,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color }} />
      {label}
    </span>
  )
}

// ── Column definitions ───────────────────────────────────────

const poCol = createColumnHelper<any>()
const poColumns = [
  poCol.accessor('po_number', {
    header: 'PO #',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>
        {info.getValue()}
      </span>
    ),
  }),
  poCol.accessor('vendor', {
    header: 'Vendor',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue()}</span>,
  }),
  poCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span style={{ color: colors.textSecondary, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
        {info.getValue()}
      </span>
    ),
  }),
  poCol.accessor('status', {
    header: 'Status',
    cell: (info) => statusBadge(info.getValue()),
  }),
  poCol.accessor('total', {
    header: 'Total',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
  poCol.accessor('required_date', {
    header: 'Required Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  poCol.accessor('received_date', {
    header: 'Received Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
]

const deliveryCol = createColumnHelper<any>()
const deliveryColumns = [
  deliveryCol.accessor('delivery_date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  deliveryCol.accessor('carrier', {
    header: 'Carrier',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue()}</span>,
  }),
  deliveryCol.accessor('tracking_number', {
    header: 'Tracking',
    cell: (info) => (
      <span style={{ color: colors.textTertiary, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>
        {info.getValue() || 'N/A'}
      </span>
    ),
  }),
  deliveryCol.accessor('po_number', {
    header: 'PO #',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>
        {info.getValue()}
      </span>
    ),
  }),
  deliveryCol.accessor('status', {
    header: 'Status',
    cell: (info) => statusBadge(info.getValue()),
  }),
]

const inventoryCol = createColumnHelper<any>()
const inventoryColumns = [
  inventoryCol.accessor('name', {
    header: 'Name',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue()}</span>,
  }),
  inventoryCol.accessor('category', {
    header: 'Category',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  inventoryCol.accessor('quantity', {
    header: 'Quantity',
    cell: (info) => {
      const row = info.row.original
      const qty = info.getValue() as number | null
      const minQty = row.min_quantity as number | null
      const isLow = qty != null && minQty != null && qty < minQty
      return (
        <span style={{ fontWeight: typography.fontWeight.semibold, color: isLow ? colors.statusCritical : colors.textPrimary }}>
          {qty ?? 0}
        </span>
      )
    },
  }),
  inventoryCol.accessor('unit', {
    header: 'Unit',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  inventoryCol.accessor('location', {
    header: 'Location',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  inventoryCol.accessor('min_quantity', {
    header: 'Min Qty',
    cell: (info) => <span style={{ color: colors.textTertiary }}>{info.getValue() ?? 'N/A'}</span>,
  }),
  inventoryCol.accessor('last_counted', {
    header: 'Last Counted',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'Never'}
      </span>
    ),
  }),
]

// ── Main Component ───────────────────────────────────────────

export const Procurement: React.FC = () => {
  const projectId = useProjectId()
  const { data: pos, isPending: posLoading } = usePurchaseOrders(projectId)
  const { data: deliveries, isPending: delLoading } = useDeliveries(projectId)
  const { data: inventory, isPending: invLoading } = useMaterialInventory(projectId)
  const [activeTab, setActiveTab] = useState<TabKey>('orders')

  const isLoading = posLoading || delLoading || invLoading

  // ── KPIs ────────────────────────────────────────────────────

  const totalPOValue = useMemo(() => {
    return pos?.reduce((sum: number, po: any) => sum + (po.total || 0), 0) || 0
  }, [pos])

  const openOrders = useMemo(() => {
    return pos?.filter((po: any) => po.status !== 'received' && po.status !== 'complete' && po.status !== 'cancelled').length || 0
  }, [pos])

  const pendingDeliveries = useMemo(() => {
    return deliveries?.filter((d: any) => d.status !== 'delivered' && d.status !== 'received').length || 0
  }, [deliveries])

  const lowStockItems = useMemo(() => {
    return inventory?.filter((item: any) => item.quantity != null && item.min_quantity != null && item.quantity < item.min_quantity).length || 0
  }, [inventory])

  // ── Tab actions ─────────────────────────────────────────────

  const addButtonLabel: Record<TabKey, string> = {
    orders: 'New PO',
    deliveries: 'Log Delivery',
    inventory: 'Add Material',
  }

  const handleAdd = () => {
    toast.info('Submission requires backend configuration')
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <PageContainer
      title="Procurement"
      subtitle="Purchase orders, deliveries, and material inventory tracking"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Procurement_Report" />
          <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd}>
            {addButtonLabel[activeTab]}
          </Btn>
        </div>
      }
    >
      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
        <MetricBox label="Total PO Value" value={formatCurrency(totalPOValue)} />
        <MetricBox label="Open Orders" value={openOrders} change={openOrders > 5 ? -1 : 1} />
        <MetricBox label="Pending Deliveries" value={pendingDeliveries} />
        <MetricBox label="Low Stock Items" value={lowStockItems} change={lowStockItems > 0 ? -1 : 1} changeLabel={lowStockItems > 0 ? 'below minimum' : 'all stocked'} />
      </div>

      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="Procurement sections"
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* Purchase Orders Tab */}
      {activeTab === 'orders' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Purchase Orders" />
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable
              columns={poColumns}
              data={pos || []}
              emptyMessage="No purchase orders yet. Create your first PO to start tracking materials and services."
            />
          </div>
        </Card>
      )}

      {/* Deliveries Tab */}
      {activeTab === 'deliveries' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Deliveries" />
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable
              columns={deliveryColumns}
              data={deliveries || []}
              emptyMessage="No deliveries logged yet. Deliveries appear here once purchase orders are fulfilled."
            />
          </div>
        </Card>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Material Inventory" />
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable
              columns={inventoryColumns}
              data={inventory || []}
              emptyMessage="No inventory items tracked. Add materials to monitor stock levels and flag low quantities."
            />
          </div>
        </Card>
      )}
    </PageContainer>
  )
}

const ProcurementWithBoundary: React.FC = () => (
  <ErrorBoundary>
    <Procurement />
  </ErrorBoundary>
)

export default ProcurementWithBoundary
