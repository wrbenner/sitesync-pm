import React, { useState, useMemo, useEffect } from 'react'
import { Truck, Wrench, BarChart3, AlertTriangle, RefreshCw, LogIn, LogOut, Calendar, Plus } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useEquipmentStore } from '../stores/equipmentStore'
import type { Equipment, EquipmentMaintenance } from '../services/equipmentService'
import { getEquipmentStatusConfig, getMaintenanceStatusConfig } from '../machines/equipmentMachine'

type TabKey = 'fleet' | 'utilization' | 'maintenance'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'fleet',       label: 'Fleet',       icon: Truck     },
  { key: 'utilization', label: 'Utilization',  icon: BarChart3 },
  { key: 'maintenance', label: 'Maintenance',  icon: Wrench    },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? 'idle').toLowerCase().replace(/\s+/g, '_')
  const cfg = getEquipmentStatusConfig(key as Parameters<typeof getEquipmentStatusConfig>[0])
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function MaintenanceBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? 'scheduled').toLowerCase() as Parameters<typeof getMaintenanceStatusConfig>[0]
  const cfg = getMaintenanceStatusConfig(key)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function TypeBadge({ value }: { value: string | null | undefined }) {
  const v = (value ?? '').toLowerCase()
  let color = colors.statusInfo
  let bg = colors.statusInfoSubtle
  if (v === 'crane' || v === 'excavator' || v === 'loader') {
    color = colors.statusReview; bg = colors.statusReviewSubtle
  } else if (v === 'dump_truck' || v === 'forklift') {
    color = colors.statusActive; bg = colors.statusActiveSubtle
  } else if (v === 'saw' || v === 'welder') {
    color = colors.statusPending; bg = colors.statusPendingSubtle
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

// ── Column definitions ────────────────────────────────────────────────────────

const fleetCol = createColumnHelper<Equipment>()
const fleetColumns = [
  fleetCol.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  fleetCol.accessor('type', {
    header: 'Type',
    cell: (info) => <TypeBadge value={info.getValue()} />,
  }),
  fleetCol.accessor('make', {
    header: 'Make/Model',
    cell: (info) => {
      const row = info.row.original
      return (
        <span style={{ color: colors.textSecondary }}>
          {[row.make, row.model].filter(Boolean).join(' ') || '—'}
        </span>
      )
    },
  }),
  fleetCol.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  fleetCol.accessor('hours_meter', {
    header: 'Hours',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue() != null ? `${Number(info.getValue()).toLocaleString()} hrs` : '—'}
      </span>
    ),
  }),
  fleetCol.accessor('current_location', {
    header: 'Location',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>{info.getValue() ?? '—'}</span>
    ),
  }),
  fleetCol.accessor('ownership', {
    header: 'Ownership',
    cell: (info) => {
      const v = info.getValue()
      return (
        <span style={{ color: colors.textSecondary }}>
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : '—'}
        </span>
      )
    },
  }),
  fleetCol.accessor('rental_rate_daily', {
    header: 'Daily Rate',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
]

const utilizationCol = createColumnHelper<Equipment>()
const utilizationColumns = [
  utilizationCol.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  utilizationCol.accessor('type', {
    header: 'Type',
    cell: (info) => <TypeBadge value={info.getValue()} />,
  }),
  utilizationCol.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  utilizationCol.accessor('hours_meter', {
    header: 'Total Hours',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        {info.getValue() != null ? Number(info.getValue()).toLocaleString() : '0'}
      </span>
    ),
  }),
  utilizationCol.accessor('rental_rate_daily', {
    header: 'Daily Rate',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>{formatCurrency(info.getValue())}</span>
    ),
  }),
]

type MaintenanceRow = EquipmentMaintenance & { equipment_name?: string }

const maintCol = createColumnHelper<MaintenanceRow>()
const maintenanceColumns = [
  maintCol.accessor('equipment_name', {
    header: 'Equipment',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue() ?? '—'}
      </span>
    ),
  }),
  maintCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue()
      return (
        <span style={{ color: colors.textSecondary }}>
          {v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : '—'}
        </span>
      )
    },
  }),
  maintCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span style={{
        color: colors.textSecondary,
        maxWidth: 280,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
      }}>
        {info.getValue()}
      </span>
    ),
  }),
  maintCol.accessor('status', {
    header: 'Status',
    cell: (info) => <MaintenanceBadge status={info.getValue()} />,
  }),
  maintCol.accessor('scheduled_date', {
    header: 'Scheduled',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : '—'}
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

// ── Actions row ───────────────────────────────────────────────────────────────

function CheckoutCheckinActions({
  equipment,
  onCheckin,
  onCheckout,
}: {
  equipment: Equipment
  onCheckin: (id: string) => void
  onCheckout: (id: string) => void
}) {
  if (equipment.status === 'active') {
    return (
      <Btn
        variant="secondary"
        size="sm"
        icon={<LogIn size={13} />}
        onClick={() => onCheckin(equipment.id)}
      >
        Check In
      </Btn>
    )
  }
  if (equipment.status === 'idle') {
    return (
      <Btn
        variant="primary"
        size="sm"
        icon={<LogOut size={13} />}
        onClick={() => onCheckout(equipment.id)}
      >
        Check Out
      </Btn>
    )
  }
  return null
}

// ── Main Component ────────────────────────────────────────────────────────────

export const EquipmentPage: React.FC = () => {
  const projectId = useProjectId()
  const {
    equipment,
    maintenanceRecords,
    loading,
    maintenanceLoading,
    error,
    loadEquipment,
    loadMaintenanceRecords,
    checkin,
    checkout,
  } = useEquipmentStore()

  const [activeTab, setActiveTab] = useState<TabKey>('fleet')
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadEquipment(projectId)
      loadMaintenanceRecords(projectId)
    }
  }, [projectId, loadEquipment, loadMaintenanceRecords])

  const handleRefresh = () => {
    if (projectId) {
      loadEquipment(projectId)
      loadMaintenanceRecords(projectId)
    }
  }

  const handleCheckin = async (equipmentId: string) => {
    await checkin(equipmentId)
  }

  const handleCheckout = async (equipmentId: string) => {
    if (!projectId) return
    await checkout(equipmentId, { target_project_id: projectId })
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalEquipment = equipment.length

  const activeCount = useMemo(
    () => equipment.filter((e) => e.status === 'active').length,
    [equipment],
  )

  const idleCount = useMemo(
    () => equipment.filter((e) => e.status === 'idle').length,
    [equipment],
  )

  const maintenanceDue = useMemo(
    () => equipment.filter((e) => e.status === 'maintenance').length,
    [equipment],
  )

  const totalHours = useMemo(
    () => equipment.reduce((sum, e) => sum + (e.hours_meter ?? 0), 0),
    [equipment],
  )

  const utilizationData = useMemo(
    () => [...equipment].sort((a, b) => (b.hours_meter ?? 0) - (a.hours_meter ?? 0)),
    [equipment],
  )

  // ── Fleet columns with actions ─────────────────────────────────────────────

  const fleetColumnsWithActions = useMemo(() => [
    ...fleetColumns,
    fleetCol.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <CheckoutCheckinActions
          equipment={info.row.original}
          onCheckin={handleCheckin}
          onCheckout={handleCheckout}
        />
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [projectId])

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <PageContainer title="Equipment" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: spacing['4'], padding: spacing['6'], textAlign: 'center',
          }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{
                fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary, margin: 0, marginBottom: spacing['2'],
              }}>
                Failed to load equipment
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>
                {error}
              </p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={handleRefresh}>
              Try Again
            </Btn>
          </div>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title="Equipment"
      subtitle="Fleet management, utilization tracking, and maintenance scheduling"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <Btn variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={handleRefresh}>
            Refresh
          </Btn>
          <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>Add Equipment</Btn>
          <ExportButton pdfFilename="SiteSync_Equipment_Report" />
        </div>
      }
    >
      {/* KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: spacing['4'],
        marginBottom: spacing['2xl'],
      }}>
        <MetricBox label="Total Equipment" value={loading ? '—' : totalEquipment} />
        <MetricBox label="Active" value={loading ? '—' : activeCount} change={1} changeLabel="operational" />
        <MetricBox label="Idle" value={loading ? '—' : idleCount} change={idleCount > 0 ? -1 : 0} />
        <MetricBox
          label="Maintenance Due"
          value={loading ? '—' : maintenanceDue}
          change={maintenanceDue > 0 ? -1 : 1}
          changeLabel={maintenanceDue > 0 ? 'needs service' : 'all clear'}
        />
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
              aria-pressed={isActive}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['3']} ${spacing['4']}`,
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
                minHeight: '56px',
              }}
            >
              <Icon size={14} />
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
            {equipment.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['3'], textAlign: 'center',
              }}>
                <Truck size={40} style={{ color: colors.textTertiary }} />
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 320 }}>
                  No equipment tracked on this project yet. Add your first piece of equipment to start managing your fleet.
                </p>
              </div>
            ) : (
              <DataTable columns={fleetColumnsWithActions} data={equipment} />
            )}
          </div>
        </Card>
      )}

      {/* Utilization Tab */}
      {activeTab === 'utilization' && !loading && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: spacing['4'],
            marginBottom: spacing['4'],
          }}>
            <MetricBox label="Total Hours Logged" value={totalHours.toLocaleString()} />
            <MetricBox label="Active Units" value={activeCount} />
          </div>
          <Card padding={spacing['4']}>
            <SectionHeader title="Utilization by Equipment" />
            <div style={{ marginTop: spacing['3'] }}>
              {utilizationData.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['3'], textAlign: 'center',
                }}>
                  <BarChart3 size={40} style={{ color: colors.textTertiary }} />
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 320 }}>
                    No utilization data available. Add equipment and log hours to see tracking here.
                  </p>
                </div>
              ) : (
                <DataTable columns={utilizationColumns} data={utilizationData} />
              )}
            </div>
          </Card>
        </>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <Card padding={spacing['4']}>
          <SectionHeader
            title="Maintenance Schedule"
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {maintenanceLoading && (
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    Loading...
                  </span>
                )}
                <Calendar size={16} style={{ color: colors.textTertiary }} />
              </div>
            }
          />
          <div style={{ marginTop: spacing['3'] }}>
            {!maintenanceLoading && maintenanceRecords.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['3'], textAlign: 'center',
              }}>
                <Wrench size={40} style={{ color: colors.textTertiary }} />
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 320 }}>
                  No maintenance records found. Schedule a service to keep your fleet running smoothly.
                </p>
              </div>
            ) : (
              <DataTable
                columns={maintenanceColumns}
                data={maintenanceRecords as MaintenanceRow[]}
              />
            )}
          </div>
        </Card>
      )}
      {addOpen && projectId && (
        <AddEquipmentModal projectId={projectId} onClose={() => setAddOpen(false)} onCreated={() => loadEquipment(projectId)} />
      )}
    </PageContainer>
  )
}

interface AddEquipmentModalProps { projectId: string; onClose: () => void; onCreated: () => void }
const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({ projectId, onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', type: '', serial_number: '', status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const submit = async () => {
    if (!form.name.trim()) { setErr('Name required'); return; }
    setSaving(true); setErr(null);
    try {
      const { error } = await supabase.from('equipment').insert({
        project_id: projectId,
        name: form.name,
        type: form.type || null,
        serial_number: form.serial_number || null,
        status: form.status,
      })
      if (error) throw error
      toast.success('Equipment added')
      onCreated(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
  }
  const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, marginBottom: 12, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: 24, width: '100%', maxWidth: 480 }}>
        <h2 style={{ margin: 0, marginBottom: 16, fontSize: 18 }}>Add Equipment</h2>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Name *</label>
        <input style={input} value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
        <label style={{ fontSize: 13, fontWeight: 500 }}>Type</label>
        <input style={input} value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))} placeholder="e.g. crane, excavator" />
        <label style={{ fontSize: 13, fontWeight: 500 }}>Serial Number</label>
        <input style={input} value={form.serial_number} onChange={(e) => setForm(p => ({ ...p, serial_number: e.target.value }))} />
        <label style={{ fontSize: 13, fontWeight: 500 }}>Status</label>
        <select style={input} value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}>
          <option value="idle">Idle</option>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
        </select>
        {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Add'}</Btn>
        </div>
      </div>
    </div>
  )
}

export default EquipmentPage
