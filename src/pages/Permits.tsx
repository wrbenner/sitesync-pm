import React, { useMemo, useState } from 'react'
import { ClipboardCheck, Calendar, Plus, FileText } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { usePermits, useCreatePermit, useDeletePermit } from '../hooks/queries/permits'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'
import { EntityFormModal, type FieldConfig } from '../components/forms/EntityFormModal'
import { permitSchema } from '../components/forms/schemas'
import { supabase } from '../lib/supabase'

type TabKey = 'permits' | 'inspections'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'permits', label: 'Permits', icon: ClipboardCheck },
  { key: 'inspections', label: 'Inspections', icon: Calendar },
]

// ── Permit Create Form ───────────────────────────────────────

const permitFields: FieldConfig[] = [
  { name: 'type', label: 'Permit Type', type: 'select', required: true, options: [
    { value: 'building', label: 'Building' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'mechanical', label: 'Mechanical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'fire', label: 'Fire' },
    { value: 'demolition', label: 'Demolition' },
    { value: 'grading', label: 'Grading' },
    { value: 'environmental', label: 'Environmental' },
    { value: 'occupancy', label: 'Occupancy' },
    { value: 'other', label: 'Other' },
  ]},
  { name: 'permit_number', label: 'Permit #', type: 'text', placeholder: 'e.g. BP-2026-12345', row: 1 },
  { name: 'jurisdiction', label: 'Jurisdiction', type: 'text', placeholder: 'e.g. City of Dallas', row: 1 },
  { name: 'status', label: 'Status', type: 'select', row: 2, options: [
    { value: 'not_applied', label: 'Not Applied' },
    { value: 'application_submitted', label: 'Application Submitted' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
    { value: 'expired', label: 'Expired' },
  ]},
  { name: 'fee', label: 'Fee ($)', type: 'currency', row: 2 },
  { name: 'applied_date', label: 'Applied Date', type: 'date', row: 3 },
  { name: 'expiration_date', label: 'Expiration Date', type: 'date', row: 3 },
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Conditions, scope, inspector notes…' },
]

// ── Column helpers ───────────────────────────────────────────

const permitCol = createColumnHelper<unknown>()
const permitColumns = [
  permitCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: colors.statusInfo, backgroundColor: colors.statusInfoSubtle,
        }}>
          {v ? v.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}
        </span>
      )
    },
  }),
  permitCol.accessor('permit_number', {
    header: 'Permit #',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>
        {info.getValue()}
      </span>
    ),
  }),
  permitCol.accessor('jurisdiction', {
    header: 'Jurisdiction',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  permitCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      let statusColor = colors.textTertiary
      let statusBg = colors.surfaceInset
      if (v === 'not_applied') { statusColor = colors.textTertiary; statusBg = colors.surfaceInset }
      else if (v === 'application_submitted') { statusColor = colors.statusInfo; statusBg = colors.statusInfoSubtle }
      else if (v === 'under_review') { statusColor = colors.statusPending; statusBg = colors.statusPendingSubtle }
      else if (v === 'approved') { statusColor = colors.statusActive; statusBg = colors.statusActiveSubtle }
      else if (v === 'denied' || v === 'expired') { statusColor = colors.statusCritical; statusBg = colors.statusCriticalSubtle }

      const label = v ? v.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {label}
        </span>
      )
    },
  }),
  permitCol.accessor('applied_date', {
    header: 'Applied',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  permitCol.accessor('issued_date', {
    header: 'Issued',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  permitCol.accessor('expiration_date', {
    header: 'Expires',
    cell: (info) => {
      const v = info.getValue()
      if (!v) return <span style={{ color: colors.textTertiary }}>N/A</span>
      const exp = new Date(v)
      const daysUntil = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      const expColor = daysUntil < 0 ? colors.statusCritical : daysUntil <= 30 ? colors.statusPending : colors.textSecondary
      return <span style={{ color: expColor }}>{exp.toLocaleDateString()}</span>
    },
  }),
  permitCol.accessor('fee', {
    header: 'Fee',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{v != null ? `$${v.toLocaleString()}` : ''}</span>
    },
  }),
  permitCol.accessor('paid', {
    header: 'Paid',
    cell: (info) => {
      const v = info.getValue()
      return v
        ? <span style={{ color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>&#10003;</span>
        : <span style={{ color: colors.textTertiary }}>&#10005;</span>
    },
  }),
]

// ── Main Component ───────────────────────────────────────────

export const Permits: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('permits')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPermit, setEditingPermit] = useState<Record<string, unknown> | null>(null)
  const [editForm, setEditForm] = useState({ type: '', permit_number: '', jurisdiction: '', status: '', fee: '', applied_date: '', expiration_date: '', notes: '' })
  const projectId = useProjectId()
  const queryClient = useQueryClient()
  const { data: permits, isLoading } = usePermits(projectId)
  const createPermit = useCreatePermit()
  const deletePermit = useDeletePermit()

  const updatePermitMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase.from('permits').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permits', projectId] })
      toast.success('Permit updated')
      setEditingPermit(null)
    },
    onError: (err: Error) => { toast.error(err.message || 'Failed to update permit') },
  })

  const openEditPermit = (permit: Record<string, unknown>) => {
    setEditForm({
      type: String(permit.type ?? ''),
      permit_number: String(permit.permit_number ?? ''),
      jurisdiction: String(permit.jurisdiction ?? ''),
      status: String(permit.status ?? ''),
      fee: String(permit.fee ?? ''),
      applied_date: String(permit.applied_date ?? ''),
      expiration_date: String(permit.expiration_date ?? ''),
      notes: String(permit.notes ?? ''),
    })
    setEditingPermit(permit)
  }

  const handleEditPermitSave = () => {
    if (!editingPermit) return
    updatePermitMutation.mutate({
      id: String(editingPermit.id),
      updates: {
        type: editForm.type || null,
        permit_number: editForm.permit_number || null,
        jurisdiction: editForm.jurisdiction || null,
        status: editForm.status || null,
        fee: editForm.fee ? parseFloat(editForm.fee) : null,
        applied_date: editForm.applied_date || null,
        expiration_date: editForm.expiration_date || null,
        notes: editForm.notes || null,
      },
    })
  }

  const totalPermits = permits?.length || 0
  const activePermits = permits?.filter((p: unknown) => p.status === 'approved').length || 0
  const pendingReview = permits?.filter((p: unknown) => p.status === 'under_review' || p.status === 'application_submitted').length || 0

  // Count permits with upcoming inspections (use expiration within 60 days as proxy)
  const now = new Date()
  const upcomingInspections = permits?.filter((p: unknown) => {
    if (!p.expiration_date) return false
    const exp = new Date(p.expiration_date)
    const daysUntil = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 60
  }).length || 0

  const handleAdd = () => {
    if (!projectId) {
      toast.error('Select a project first')
      return
    }
    setModalOpen(true)
  }

  const handleCreate = async (data: Record<string, unknown>) => {
    if (!projectId) return
    try {
      await createPermit.mutateAsync({ projectId, data })
      toast.success('Permit created')
      setModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create permit')
    }
  }

  const handleDelete = async (permit: Record<string, unknown>) => {
    if (!projectId) return
    const label = (permit.permit_number as string) || (permit.type as string) || 'this permit'
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    try {
      await deletePermit.mutateAsync({ id: String(permit.id), projectId })
      toast.success('Permit deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete permit')
    }
  }

  const permitColumnsWithActions = useMemo(
    () => [
      ...permitColumns,
      permitCol.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <div style={{ display: 'flex', gap: spacing['1'] }}>
            <Btn
              size="sm"
              variant="secondary"
              onClick={() => openEditPermit(info.row.original as Record<string, unknown>)}
            >
              Edit
            </Btn>
            <PermissionGate permission="project.settings">
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(info.row.original as Record<string, unknown>)}
                disabled={deletePermit.isPending}
                aria-label="Delete this permit"
                data-testid="delete-permit-button"
              >
                Delete
              </Btn>
            </PermissionGate>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletePermit.isPending, projectId],
  )

  return (
    <PageContainer
      title="Permits"
      subtitle="Track building permits, applications, and inspection scheduling"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Permits_Report" />
          <PermissionGate permission="project.settings">
          <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd} data-testid="create-permit-button">
            New Permit
          </Btn>
          </PermissionGate>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* KPIs */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          <MetricBox label="Total Permits" value={totalPermits} />
          <MetricBox label="Active" value={activePermits} change={activePermits > 0 ? 1 : 0} />
          <MetricBox label="Pending Review" value={pendingReview} change={pendingReview > 3 ? -1 : 0} />
          <MetricBox label="Upcoming Inspections" value={upcomingInspections} changeLabel="within 60 days" />
        </div>
      )}

      {/* Permits Tab */}
      {activeTab === 'permits' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="All Permits" />
          {permits && permits.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={permitColumnsWithActions} data={permits} />
            </div>
          ) : (
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
              No permits added yet.
            </p>
          )}
        </Card>
      )}

      {/* Inspections Tab */}
      {activeTab === 'inspections' && !isLoading && (
        <>
          <SectionHeader title="Upcoming Inspections" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing['4'], marginTop: spacing['3'] }}>
            {permits && permits.filter((p: unknown) => p.status === 'approved').length > 0 ? (
              permits.filter((p: unknown) => p.status === 'approved').map((permit: unknown) => (
                <Card key={permit.id} padding={spacing['4']}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: borderRadius.base,
                      backgroundColor: colors.statusInfoSubtle,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FileText size={16} color={colors.statusInfo} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                        {permit.permit_number}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {permit.type ? permit.type.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {permit.jurisdiction || 'No jurisdiction'}
                    </span>
                    {permit.expiration_date && (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.statusPending }}>
                        Expires {new Date(permit.expiration_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <Card padding={spacing['4']}>
                <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: 0 }}>
                  No approved permits with upcoming inspections.
                </p>
              </Card>
            )}
          </div>
        </>
      )}

      <EntityFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        title="New Permit"
        schema={permitSchema}
        fields={permitFields}
        defaults={{ status: 'not_applied' }}
        submitLabel="Create Permit"
        submittingLabel="Creating…"
        draftKey="draft_permit"
      />

      <Modal open={!!editingPermit} onClose={() => setEditingPermit(null)} title="Edit Permit">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Permit Type</label>
              <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                <option value="building">Building</option>
                <option value="electrical">Electrical</option>
                <option value="mechanical">Mechanical</option>
                <option value="plumbing">Plumbing</option>
                <option value="fire">Fire</option>
                <option value="demolition">Demolition</option>
                <option value="grading">Grading</option>
                <option value="environmental">Environmental</option>
                <option value="occupancy">Occupancy</option>
                <option value="other">Other</option>
              </select>
            </div>
            <InputField label="Permit #" value={editForm.permit_number} onChange={(v) => setEditForm({ ...editForm, permit_number: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Jurisdiction" value={editForm.jurisdiction} onChange={(v) => setEditForm({ ...editForm, jurisdiction: v })} />
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                <option value="not_applied">Not Applied</option>
                <option value="application_submitted">Application Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Fee ($)" value={editForm.fee} onChange={(v) => setEditForm({ ...editForm, fee: v })} type="number" />
            <InputField label="Applied Date" value={editForm.applied_date} onChange={(v) => setEditForm({ ...editForm, applied_date: v })} type="date" />
          </div>
          <InputField label="Expiration Date" value={editForm.expiration_date} onChange={(v) => setEditForm({ ...editForm, expiration_date: v })} type="date" />
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Notes</label>
            <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setEditingPermit(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleEditPermitSave} loading={updatePermitMutation.isPending}>{updatePermitMutation.isPending ? 'Saving...' : 'Save'}</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Permits
