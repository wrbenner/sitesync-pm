import React, { useState, useMemo } from 'react'
import { Truck, Wrench, BarChart3, Plus } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useEquipment } from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'fleet' | 'utilization' | 'maintenance'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'fleet', label: 'Fleet', icon: Truck },
  { key: 'utilization', label: 'Utilization', icon: BarChart3 },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
]

// ── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function statusBadge(value: string | null | undefined) {
  const v = (value || '').toLowerCase()
  let color = colors.statusNeutral
  let bg = colors.statusNeutralSubtle
  if (v === 'active' || v === 'operational') {
    color = colors.statusActive
    bg = colors.statusActiveSubtle
  } else if (v === 'idle') {
    color = colors.statusPending
    bg = colors.statusPendingSubtle
  } else if (v === 'maintenance' || v === 'down') {
    color = colors.statusCritical
    bg = colors.statusCriticalSubtle
  } else if (v === 'transit' || v === 'in_transit') {
    color = colors.statusInfo
    bg = colors.statusInfoSubtle
  } else if (v === 'off_site') {
    color = colors.statusNeutral
    bg = colors.statusNeutralSubtle
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

function maintenanceStatusBadge(value: string | null | undefined) {
  const v = (value || '').toLowerCase()
  let color = colors.statusInfo
  let bg = colors.statusInfoSubtle
  if (v === 'completed' || v === 'complete') {
    color = colors.statusActive
    bg = colors.statusActiveSubtle
  } else if (v === 'scheduled' || v === 'pending') {
    color = colors.statusPending
    bg = colors.statusPendingSubtle
  } else if (v === 'overdue') {
    color = colors.statusCritical
    bg = colors.statusCriticalSubtle
  } else if (v === 'in_progress') {
    color = colors.statusInfo
    bg = colors.statusInfoSubtle
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

function typeBadge(value: string | null | undefined) {
  const v = (value || '').toLowerCase()
  let color = colors.statusInfo
  let bg = colors.statusInfoSubtle
  if (v === 'heavy' || v === 'crane') {
    color = colors.statusReview
    bg = colors.statusReviewSubtle
  } else if (v === 'vehicle' || v === 'truck') {
    color = colors.statusActive
    bg = colors.statusActiveSubtle
  } else if (v === 'tool' || v === 'hand_tool') {
    color = colors.statusPending
    bg = colors.statusPendingSubtle
  }
  const label = v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : ''
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color, backgroundColor: bg,
    }}>
      {label}
    </span>
  )
}

// ── Column definitions ───────────────────────────────────────

const fleetCol = createColumnHelper<any>()
const fleetColumns = [
  fleetCol.accessor('name', {
    header: 'Name',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue()}</span>,
  }),
  fleetCol.accessor('type', {
    header: 'Type',
    cell: (info) => typeBadge(info.getValue()),
  }),
  fleetCol.accessor('make_model', {
    header: 'Make/Model',
    cell: (info) => {
      const row = info.row.original
      const make = row.make || ''
      const model = row.model || ''
      return <span style={{ color: colors.textSecondary }}>{make} {model}</span>
    },
  }),
  fleetCol.accessor('status', {
    header: 'Status',
    cell: (info) => statusBadge(info.getValue()),
  }),
  fleetCol.accessor('hours', {
    header: 'Hours',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue() != null ? `${Number(info.getValue()).toLocaleString()} hrs` : 'N/A'}
      </span>
    ),
  }),
  fleetCol.accessor('location', {
    header: 'Location',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  fleetCol.accessor('ownership', {
    header: 'Ownership',
    cell: (info) => {
      const v = info.getValue() as string | null
      return <span style={{ color: colors.textSecondary }}>{v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}</span>
    },
  }),
  fleetCol.accessor('daily_rate', {
    header: 'Daily Rate',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
]

const utilizationCol = createColumnHelper<any>()
const utilizationColumns = [
  utilizationCol.accessor('name', {
    header: 'Name',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue()}</span>,
  }),
  utilizationCol.accessor('type', {
    header: 'Type',
    cell: (info) => typeBadge(info.getValue()),
  }),
  utilizationCol.accessor('status', {
    header: 'Status',
    cell: (info) => statusBadge(info.getValue()),
  }),
  utilizationCol.accessor('hours', {
    header: 'Total Hours',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        {info.getValue() != null ? Number(info.getValue()).toLocaleString() : '0'}
      </span>
    ),
  }),
  utilizationCol.accessor('utilization_rate', {
    header: 'Utilization',
    cell: (info) => {
      const rate = info.getValue() as number | null
      if (rate == null) return <span style={{ color: colors.textTertiary }}>N/A</span>
      const color = rate >= 70 ? colors.statusActive : rate >= 40 ? colors.statusPending : colors.statusCritical
      return <span style={{ fontWeight: typography.fontWeight.semibold, color }}>{rate}%</span>
    },
  }),
  utilizationCol.accessor('daily_rate', {
    header: 'Daily Rate',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
]

const maintCol = createColumnHelper<any>()
const maintenanceColumns = [
  maintCol.accessor('equipment_name', {
    header: 'Equipment',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue()}</span>,
  }),
  maintCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string | null
      return <span style={{ color: colors.textSecondary }}>{v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : ''}</span>
    },
  }),
  maintCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span style={{ color: colors.textSecondary, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
        {info.getValue()}
      </span>
    ),
  }),
  maintCol.accessor('status', {
    header: 'Status',
    cell: (info) => maintenanceStatusBadge(info.getValue()),
  }),
  maintCol.accessor('scheduled_date', {
    header: 'Scheduled Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  maintCol.accessor('cost', {
    header: 'Cost',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
]

// ── Main Component ───────────────────────────────────────────

export const EquipmentPage: React.FC = () => {
  const projectId = useProjectId()
  const { data: equipment, isPending: loading } = useEquipment(projectId)
  const [activeTab, setActiveTab] = useState<TabKey>('fleet')

  // ── KPIs ────────────────────────────────────────────────────

  const totalEquipment = equipment?.length || 0

  const activeCount = useMemo(() => {
    return equipment?.filter((e: any) => e.status === 'active' || e.status === 'operational').length || 0
  }, [equipment])

  const idleCount = useMemo(() => {
    return equipment?.filter((e: any) => e.status === 'idle').length || 0
  }, [equipment])

  const maintenanceDue = useMemo(() => {
    return equipment?.filter((e: any) => e.status === 'maintenance' || e.maintenance_due === true).length || 0
  }, [equipment])

  // Derive maintenance records from equipment data (each item with maintenance info)
  const maintenanceRecords = useMemo(() => {
    if (!equipment) return []
    return equipment
      .filter((e: any) => e.next_maintenance_date || e.last_maintenance_date || e.status === 'maintenance')
      .map((e: any) => ({
        equipment_name: e.name,
        type: e.maintenance_type || 'scheduled',
        description: e.maintenance_description || `Scheduled service for ${e.name}`,
        status: e.maintenance_status || (e.status === 'maintenance' ? 'in_progress' : 'scheduled'),
        scheduled_date: e.next_maintenance_date || e.last_maintenance_date,
        cost: e.maintenance_cost || null,
      }))
  }, [equipment])

  // Utilization data sorted by hours
  const utilizationData = useMemo(() => {
    if (!equipment) return []
    return [...equipment].sort((a: any, b: any) => (b.hours || 0) - (a.hours || 0))
  }, [equipment])

  // Utilization summary
  const avgUtilization = useMemo(() => {
    if (!equipment || equipment.length === 0) return 0
    const rates = equipment.map((e: any) => e.utilization_rate || 0)
    return Math.round(rates.reduce((sum: number, r: number) => sum + r, 0) / rates.length)
  }, [equipment])

  const totalHours = useMemo(() => {
    return equipment?.reduce((sum: number, e: any) => sum + (e.hours || 0), 0) || 0
  }, [equipment])

  // ── Tab actions ─────────────────────────────────────────────

  const addButtonLabel: Record<TabKey, string> = {
    fleet: 'Add Equipment',
    utilization: 'Log Hours',
    maintenance: 'Schedule Service',
  }

  const handleAdd = () => {
    toast.info('Form submission requires backend configuration')
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <PageContainer
      title="Equipment"
      subtitle="Fleet management, utilization tracking, and maintenance scheduling"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Equipment_Report" />
          <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd}>
            {addButtonLabel[activeTab]}
          </Btn>
        </div>
      }
    >
      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
        <MetricBox label="Total Equipment" value={totalEquipment} />
        <MetricBox label="Active" value={activeCount} change={1} changeLabel="operational" />
        <MetricBox label="Idle" value={idleCount} change={idleCount > 0 ? -1 : 0} />
        <MetricBox label="Maintenance Due" value={maintenanceDue} change={maintenanceDue > 0 ? -1 : 1} changeLabel={maintenanceDue > 0 ? 'needs service' : 'all clear'} />
      </div>

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
          const Icon = tab.icon
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
              {React.createElement(Icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* Fleet Tab */}
      {activeTab === 'fleet' && !loading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Equipment Fleet" />
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable columns={fleetColumns} data={equipment || []} />
          </div>
        </Card>
      )}

      {/* Utilization Tab */}
      {activeTab === 'utilization' && !loading && (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing['4'], marginBottom: spacing['4'] }}>
            <MetricBox label="Avg Utilization" value={`${avgUtilization}%`} change={avgUtilization >= 60 ? 1 : -1} />
            <MetricBox label="Total Hours Logged" value={totalHours.toLocaleString()} />
          </div>
          <Card padding={spacing['4']}>
            <SectionHeader title="Utilization by Equipment" />
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={utilizationColumns} data={utilizationData} />
            </div>
          </Card>
        </>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && !loading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Maintenance Schedule" />
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable columns={maintenanceColumns} data={maintenanceRecords} />
          </div>
        </Card>
      )}
    </PageContainer>
  )
}

export default EquipmentPage
