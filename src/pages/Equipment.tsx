import React, { useState, useMemo, useEffect } from 'react'
import { Truck, Wrench, BarChart3, AlertTriangle, RefreshCw, LogIn, LogOut, Calendar, Plus, Gauge, Clock } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField } from '../components/Primitives'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useEquipmentStore } from '../stores/equipmentStore'
import type { Equipment, EquipmentMaintenance } from '../services/equipmentService'
import { getEquipmentStatusConfig, getMaintenanceStatusConfig } from '../machines/equipmentMachine'
import { usePMSchedules, useCreatePMSchedule, useDeletePMSchedule, type PMSchedule } from '../hooks/queries/preventive-maintenance'
import { useMeterReadingsByProject, useCreateMeterReading, type MeterReading } from '../hooks/queries/meter-readings'

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
  fleetCol.accessor('serial_number', {
    header: 'Serial',
    cell: (info) => (
      <span style={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>
        {info.getValue() ?? '—'}
      </span>
    ),
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
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [editForm, setEditForm] = useState({ name: '', type: '', serial_number: '', status: 'idle', make: '', model: '', current_location: '' })

  // PM Schedules
  const [pmModalOpen, setPmModalOpen] = useState(false)
  const pmSchedulesQuery = usePMSchedules(projectId)
  const createPMSchedule = useCreatePMSchedule()
  const deletePMSchedule = useDeletePMSchedule()
  const [pmForm, setPmForm] = useState({
    equipment_id: '', title: '', description: '', priority: 'medium',
    recurrence_type: 'monthly', recurrence_interval: '1', starts_on: new Date().toISOString().split('T')[0],
    next_due_date: '', estimated_duration_hours: '', meter_trigger_value: '', meter_trigger_unit: '',
    based_on: 'scheduled_date',
  })

  // Meter Readings
  const [meterModalOpen, setMeterModalOpen] = useState(false)
  const meterReadingsQuery = useMeterReadingsByProject(projectId)
  const createMeterReading = useCreateMeterReading()
  const [meterForm, setMeterForm] = useState({
    equipment_id: '', meter_name: 'hours', reading_value: '', unit: 'hours', notes: '',
  })

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase.from('equipment').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Equipment updated')
      setEditingEquipment(null)
      if (projectId) loadEquipment(projectId)
    },
    onError: (err: Error) => { toast.error(err.message || 'Failed to update equipment') },
  })

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('equipment').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Equipment deleted')
      if (projectId) loadEquipment(projectId)
    },
    onError: (err: Error) => { toast.error(err.message || 'Failed to delete equipment') },
  })

  const openEditEquipment = (eq: Equipment) => {
    setEditForm({
      name: eq.name ?? '',
      type: eq.type ?? '',
      serial_number: eq.serial_number ?? '',
      status: eq.status ?? 'idle',
      make: eq.make ?? '',
      model: eq.model ?? '',
      current_location: eq.current_location ?? '',
    })
    setEditingEquipment(eq)
  }

  const handleEditEquipmentSave = () => {
    if (!editingEquipment) return
    updateEquipmentMutation.mutate({
      id: editingEquipment.id,
      updates: {
        name: editForm.name || null,
        type: editForm.type || null,
        serial_number: editForm.serial_number || null,
        status: editForm.status,
        make: editForm.make || null,
        model: editForm.model || null,
        current_location: editForm.current_location || null,
      },
    })
  }

  const handleDeleteEquipment = (eq: Equipment) => {
    if (!window.confirm(`Delete "${eq.name}"? This cannot be undone.`)) return
    deleteEquipmentMutation.mutate(eq.id)
  }

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

  // ── PM Schedule handlers ──────────────────────────────────────────────────

  const handleCreatePMSchedule = () => {
    if (!projectId || !pmForm.equipment_id || !pmForm.title.trim()) {
      toast.error('Equipment and title are required')
      return
    }
    createPMSchedule.mutate({
      project_id: projectId,
      equipment_id: pmForm.equipment_id,
      title: pmForm.title,
      description: pmForm.description || null,
      priority: pmForm.priority,
      recurrence_type: pmForm.recurrence_type,
      recurrence_interval: parseInt(pmForm.recurrence_interval) || 1,
      starts_on: pmForm.starts_on,
      next_due_date: pmForm.next_due_date || pmForm.starts_on,
      estimated_duration_hours: pmForm.estimated_duration_hours ? parseFloat(pmForm.estimated_duration_hours) : null,
      meter_trigger_value: pmForm.meter_trigger_value ? parseFloat(pmForm.meter_trigger_value) : null,
      meter_trigger_unit: pmForm.meter_trigger_unit || null,
      based_on: pmForm.based_on,
      is_active: true,
    }, {
      onSuccess: () => {
        toast.success('PM schedule created')
        setPmModalOpen(false)
        setPmForm({ equipment_id: '', title: '', description: '', priority: 'medium', recurrence_type: 'monthly', recurrence_interval: '1', starts_on: new Date().toISOString().split('T')[0], next_due_date: '', estimated_duration_hours: '', meter_trigger_value: '', meter_trigger_unit: '', based_on: 'scheduled_date' })
      },
      onError: (err: Error) => toast.error(err.message || 'Failed to create PM schedule'),
    })
  }

  const handleDeletePMSchedule = (pm: PMSchedule) => {
    if (!window.confirm(`Delete PM schedule "${pm.title}"?`)) return
    deletePMSchedule.mutate({ id: pm.id, projectId: pm.project_id, equipmentId: pm.equipment_id }, {
      onSuccess: () => toast.success('PM schedule deleted'),
      onError: (err: Error) => toast.error(err.message || 'Failed to delete'),
    })
  }

  // ── Meter Reading handlers ──────────────────────────────────────────────

  const handleCreateMeterReading = () => {
    if (!projectId || !meterForm.equipment_id || !meterForm.reading_value) {
      toast.error('Equipment and reading value are required')
      return
    }
    createMeterReading.mutate({
      project_id: projectId,
      equipment_id: meterForm.equipment_id,
      meter_name: meterForm.meter_name,
      reading_value: parseFloat(meterForm.reading_value),
      unit: meterForm.unit,
      notes: meterForm.notes || null,
    }, {
      onSuccess: () => {
        toast.success('Meter reading logged')
        setMeterModalOpen(false)
        setMeterForm({ equipment_id: '', meter_name: 'hours', reading_value: '', unit: 'hours', notes: '' })
      },
      onError: (err: Error) => toast.error(err.message || 'Failed to log reading'),
    })
  }

  // Helper to get latest meter reading per equipment
  const latestMeterByEquipment = useMemo(() => {
    const map = new Map<string, MeterReading>()
    if (meterReadingsQuery.data) {
      for (const r of meterReadingsQuery.data) {
        if (!map.has(r.equipment_id)) map.set(r.equipment_id, r)
      }
    }
    return map
  }, [meterReadingsQuery.data])

  // Helper to get equipment name by id
  const equipmentNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const eq of equipment) map.set(eq.id, eq.name)
    return map
  }, [equipment])

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
        <div style={{ display: 'flex', gap: spacing['1'], alignItems: 'center' }}>
          <CheckoutCheckinActions
            equipment={info.row.original}
            onCheckin={handleCheckin}
            onCheckout={handleCheckout}
          />
          <Btn size="sm" variant="secondary" onClick={() => openEditEquipment(info.row.original)}>
            Edit
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteEquipment(info.row.original)}
            disabled={deleteEquipmentMutation.isPending}
          >
            Delete
          </Btn>
        </div>
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [projectId, deleteEquipmentMutation.isPending])

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
        <MetricBox
          label="Active"
          value={loading ? '—' : activeCount}
          change={activeCount > 0 ? 1 : undefined}
          changeLabel={activeCount > 0 ? 'operational' : undefined}
        />
        <MetricBox label="Idle" value={loading ? '—' : idleCount} change={idleCount > 0 ? -1 : undefined} />
        <MetricBox
          label="Maintenance Due"
          value={loading ? '—' : maintenanceDue}
          change={maintenanceDue > 0 ? -1 : undefined}
          changeLabel={maintenanceDue > 0 ? 'needs service' : undefined}
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
        <>
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

          {/* Meter Readings Sub-section */}
          {equipment.length > 0 && (
            <Card padding={spacing['4']} style={{ marginTop: spacing['4'] }}>
              <SectionHeader
                title="Latest Meter Readings"
                action={
                  <Btn variant="primary" size="sm" icon={<Gauge size={14} />} onClick={() => setMeterModalOpen(true)}>
                    Log Reading
                  </Btn>
                }
              />
              <div style={{ marginTop: spacing['3'], display: 'grid', gap: spacing['2'] }}>
                {equipment.map((eq) => {
                  const latest = latestMeterByEquipment.get(eq.id)
                  return (
                    <div key={eq.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: `${spacing['2']} ${spacing['3']}`,
                      borderRadius: borderRadius.base,
                      backgroundColor: colors.surfaceInset,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                        <Gauge size={14} style={{ color: colors.textTertiary }} />
                        <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                          {eq.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                        {latest ? (
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                            {latest.meter_name}: <strong style={{ color: colors.textPrimary }}>{Number(latest.reading_value).toLocaleString()} {latest.unit}</strong>
                            <span style={{ marginLeft: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                              ({new Date(latest.reading_date).toLocaleDateString()})
                            </span>
                          </span>
                        ) : (
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No readings</span>
                        )}
                        <Btn variant="ghost" size="sm" onClick={() => { setMeterForm({ ...meterForm, equipment_id: eq.id }); setMeterModalOpen(true); }}>
                          Log
                        </Btn>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
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
        <>
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

          {/* PM Schedules Section */}
          <Card padding={spacing['4']} style={{ marginTop: spacing['4'] }}>
            <SectionHeader
              title="Preventive Maintenance Schedules"
              action={
                <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setPmModalOpen(true)}>
                  Create PM Schedule
                </Btn>
              }
            />
            <div style={{ marginTop: spacing['3'] }}>
              {pmSchedulesQuery.isLoading ? (
                <div style={{ display: 'grid', gap: spacing['2'] }}>
                  {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="60px" />)}
                </div>
              ) : !pmSchedulesQuery.data || pmSchedulesQuery.data.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['3'], textAlign: 'center',
                }}>
                  <Clock size={40} style={{ color: colors.textTertiary }} />
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 320 }}>
                    No preventive maintenance schedules yet. Create one to automate recurring maintenance tasks.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: spacing['2'] }}>
                  {pmSchedulesQuery.data.map((pm) => {
                    const eqName = equipmentNameMap.get(pm.equipment_id) ?? 'Unknown'
                    const isOverdue = pm.next_due_date && new Date(pm.next_due_date) < new Date()
                    const priorityColors: Record<string, { color: string; bg: string }> = {
                      high: { color: colors.statusCritical, bg: colors.statusCriticalSubtle },
                      medium: { color: colors.statusPending, bg: colors.statusPendingSubtle },
                      low: { color: colors.statusInfo, bg: colors.statusInfoSubtle },
                      none: { color: colors.textTertiary, bg: colors.surfaceInset },
                    }
                    const pCfg = priorityColors[pm.priority ?? 'medium'] ?? priorityColors.medium
                    return (
                      <div key={pm.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: spacing['3'],
                        borderRadius: borderRadius.base,
                        border: `1px solid ${isOverdue ? colors.statusCritical : colors.borderDefault}`,
                        backgroundColor: isOverdue ? colors.statusCriticalSubtle : colors.surfaceRaised,
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                            <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                              {pm.title}
                            </span>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', padding: `1px ${spacing['sm']}`,
                              borderRadius: borderRadius.full, fontSize: typography.fontSize.caption,
                              fontWeight: typography.fontWeight.medium, color: pCfg.color, backgroundColor: pCfg.bg,
                            }}>
                              {pm.priority ?? 'medium'}
                            </span>
                            {!pm.is_active && (
                              <span style={{
                                display: 'inline-flex', padding: `1px ${spacing['sm']}`,
                                borderRadius: borderRadius.full, fontSize: typography.fontSize.caption,
                                color: colors.textTertiary, backgroundColor: colors.surfaceInset,
                              }}>
                                inactive
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                            <span>{eqName}</span>
                            <span>Every {pm.recurrence_interval ?? 1} {pm.recurrence_type}</span>
                            {pm.meter_trigger_value && (
                              <span>or at {Number(pm.meter_trigger_value).toLocaleString()} {pm.meter_trigger_unit ?? 'hours'}</span>
                            )}
                            {pm.estimated_duration_hours && (
                              <span>~{pm.estimated_duration_hours}h</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Next Due</div>
                            <div style={{
                              fontSize: typography.fontSize.sm,
                              fontWeight: typography.fontWeight.medium,
                              color: isOverdue ? colors.statusCritical : colors.textPrimary,
                            }}>
                              {pm.next_due_date ? new Date(pm.next_due_date).toLocaleDateString() : '—'}
                            </div>
                          </div>
                          <Btn variant="ghost" size="sm" onClick={() => handleDeletePMSchedule(pm)}>Delete</Btn>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Meter Readings Log in Maintenance Tab */}
          <Card padding={spacing['4']} style={{ marginTop: spacing['4'] }}>
            <SectionHeader
              title="Meter Readings"
              action={
                <Btn variant="primary" size="sm" icon={<Gauge size={14} />} onClick={() => setMeterModalOpen(true)}>
                  Log Reading
                </Btn>
              }
            />
            <div style={{ marginTop: spacing['3'] }}>
              {meterReadingsQuery.isLoading ? (
                <Skeleton width="100%" height="60px" />
              ) : !meterReadingsQuery.data || meterReadingsQuery.data.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: `${spacing['6']} ${spacing['4']}`, gap: spacing['2'], textAlign: 'center',
                }}>
                  <Gauge size={32} style={{ color: colors.textTertiary }} />
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    No meter readings recorded yet.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: spacing['1'] }}>
                  {meterReadingsQuery.data.slice(0, 20).map((r) => (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: `${spacing['2']} ${spacing['3']}`,
                      borderRadius: borderRadius.base,
                      backgroundColor: colors.surfaceInset,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                        <Gauge size={13} style={{ color: colors.textTertiary }} />
                        <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                          {equipmentNameMap.get(r.equipment_id) ?? 'Unknown'}
                        </span>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                          {r.meter_name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                        <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                          {Number(r.reading_value).toLocaleString()} {r.unit}
                        </span>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {new Date(r.reading_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
      {addOpen && projectId && (
        <AddEquipmentModal projectId={projectId} onClose={() => setAddOpen(false)} onCreated={() => loadEquipment(projectId)} />
      )}

      {/* Create PM Schedule Modal */}
      <Modal open={pmModalOpen} onClose={() => setPmModalOpen(false)} title="Create PM Schedule">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Equipment *</label>
            <select
              value={pmForm.equipment_id}
              onChange={(e) => setPmForm({ ...pmForm, equipment_id: e.target.value })}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              <option value="">Select equipment...</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
          <InputField label="Title *" value={pmForm.title} onChange={(v) => setPmForm({ ...pmForm, title: v })} placeholder="e.g. Oil Change" />
          <InputField label="Description" value={pmForm.description} onChange={(v) => setPmForm({ ...pmForm, description: v })} placeholder="Details about this maintenance task" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Priority</label>
              <select
                value={pmForm.priority}
                onChange={(e) => setPmForm({ ...pmForm, priority: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Based On</label>
              <select
                value={pmForm.based_on}
                onChange={(e) => setPmForm({ ...pmForm, based_on: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                <option value="scheduled_date">Scheduled Date</option>
                <option value="completed_date">Completed Date</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Recurrence</label>
              <select
                value={pmForm.recurrence_type}
                onChange={(e) => setPmForm({ ...pmForm, recurrence_type: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <InputField label="Interval" value={pmForm.recurrence_interval} onChange={(v) => setPmForm({ ...pmForm, recurrence_interval: v })} placeholder="1" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Starts On" value={pmForm.starts_on} onChange={(v) => setPmForm({ ...pmForm, starts_on: v })} placeholder="YYYY-MM-DD" />
            <InputField label="Next Due Date" value={pmForm.next_due_date} onChange={(v) => setPmForm({ ...pmForm, next_due_date: v })} placeholder="YYYY-MM-DD" />
          </div>
          <InputField label="Estimated Duration (hours)" value={pmForm.estimated_duration_hours} onChange={(v) => setPmForm({ ...pmForm, estimated_duration_hours: v })} placeholder="e.g. 2.5" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Meter Trigger Value" value={pmForm.meter_trigger_value} onChange={(v) => setPmForm({ ...pmForm, meter_trigger_value: v })} placeholder="e.g. 500" />
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Meter Unit</label>
              <select
                value={pmForm.meter_trigger_unit}
                onChange={(e) => setPmForm({ ...pmForm, meter_trigger_unit: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                <option value="">None</option>
                <option value="hours">Hours</option>
                <option value="miles">Miles</option>
                <option value="cycles">Cycles</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setPmModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreatePMSchedule} loading={createPMSchedule.isPending}>
              {createPMSchedule.isPending ? 'Creating...' : 'Create Schedule'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Log Meter Reading Modal */}
      <Modal open={meterModalOpen} onClose={() => setMeterModalOpen(false)} title="Log Meter Reading">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Equipment *</label>
            <select
              value={meterForm.equipment_id}
              onChange={(e) => setMeterForm({ ...meterForm, equipment_id: e.target.value })}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              <option value="">Select equipment...</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Meter Name</label>
              <select
                value={meterForm.meter_name}
                onChange={(e) => setMeterForm({ ...meterForm, meter_name: e.target.value, unit: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                <option value="hours">Hours</option>
                <option value="miles">Miles</option>
                <option value="cycles">Cycles</option>
                <option value="fuel">Fuel</option>
              </select>
            </div>
            <InputField label="Reading Value *" value={meterForm.reading_value} onChange={(v) => setMeterForm({ ...meterForm, reading_value: v })} placeholder="e.g. 1250" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Unit</label>
            <select
              value={meterForm.unit}
              onChange={(e) => setMeterForm({ ...meterForm, unit: e.target.value })}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              <option value="hours">Hours</option>
              <option value="miles">Miles</option>
              <option value="km">Kilometers</option>
              <option value="cycles">Cycles</option>
              <option value="gallons">Gallons</option>
              <option value="liters">Liters</option>
            </select>
          </div>
          <InputField label="Notes" value={meterForm.notes} onChange={(v) => setMeterForm({ ...meterForm, notes: v })} placeholder="Optional notes" />
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setMeterModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateMeterReading} loading={createMeterReading.isPending}>
              {createMeterReading.isPending ? 'Saving...' : 'Log Reading'}
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!editingEquipment} onClose={() => setEditingEquipment(null)} title="Edit Equipment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Name" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Type" value={editForm.type} onChange={(v) => setEditForm({ ...editForm, type: v })} placeholder="e.g. crane, excavator" />
            <InputField label="Serial Number" value={editForm.serial_number} onChange={(v) => setEditForm({ ...editForm, serial_number: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Make" value={editForm.make} onChange={(v) => setEditForm({ ...editForm, make: v })} />
            <InputField label="Model" value={editForm.model} onChange={(v) => setEditForm({ ...editForm, model: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Location" value={editForm.current_location} onChange={(v) => setEditForm({ ...editForm, current_location: v })} />
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                <option value="idle">Idle</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="out_of_service">Out of Service</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setEditingEquipment(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleEditEquipmentSave} loading={updateEquipmentMutation.isPending}>{updateEquipmentMutation.isPending ? 'Saving...' : 'Save'}</Btn>
          </div>
        </div>
      </Modal>
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
