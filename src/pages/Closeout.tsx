import React, { useState, useMemo } from 'react'
import { CheckCircle2, Plus, Shield, Book, Package, FileSignature, Search, FileCheck, Award } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState, ProgressBar } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useCloseoutItems, useCreateCloseoutItem, useUpdateCloseoutStatus } from '../hooks/queries/enterprise-modules'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'

interface CloseoutItem {
  id: string
  item_type: string
  title: string
  description: string | null
  responsible_party: string | null
  due_date: string | null
  status: string
  expiration_date: string | null
}

const ITEM_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  warranty: { label: 'Warranties', icon: Shield, color: '#8B5CF6' },
  om_manual: { label: 'O&M Manuals', icon: Book, color: '#3B82F6' },
  attic_stock: { label: 'Attic Stock', icon: Package, color: '#F59E0B' },
  lien_waiver: { label: 'Lien Waivers', icon: FileSignature, color: '#10B981' },
  final_inspection: { label: 'Final Inspections', icon: Search, color: '#EF4444' },
  as_built: { label: 'As-Builts', icon: FileCheck, color: '#EC4899' },
  certificate_of_occupancy: { label: 'Certificates of Occupancy', icon: Award, color: '#14B8A6' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: colors.textTertiary, bg: colors.surfaceInset },
  in_progress: { label: 'In Progress', color: colors.statusPending, bg: colors.statusPendingSubtle },
  submitted: { label: 'Submitted', color: colors.statusInfo, bg: colors.statusInfoSubtle },
  approved: { label: 'Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
  na: { label: 'N/A', color: colors.textTertiary, bg: colors.surfaceInset },
}

export const Closeout: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: items, isLoading } = useCloseoutItems(projectId ?? undefined)
  const createItem = useCreateCloseoutItem()
  const updateStatus = useUpdateCloseoutStatus()

  const [form, setForm] = useState({
    item_type: 'warranty', title: '', description: '', responsible_party: '', due_date: '', expiration_date: '',
  })

  const list = (items ?? []) as CloseoutItem[]

  const grouped = useMemo(() => {
    return list.reduce<Record<string, CloseoutItem[]>>((acc, item) => {
      acc[item.item_type] = acc[item.item_type] || []
      acc[item.item_type].push(item)
      return acc
    }, {})
  }, [list])

  const totalItems = list.length
  const approved = list.filter((i) => i.status === 'approved').length
  const pending = list.filter((i) => i.status === 'pending').length
  const inProgress = list.filter((i) => i.status === 'in_progress').length
  const pctComplete = totalItems > 0 ? Math.round((approved / totalItems) * 100) : 0

  const handleSubmit = async () => {
    if (!projectId || !form.title) {
      toast.error('Title required')
      return
    }
    try {
      await createItem.mutateAsync({
        project_id: projectId,
        item_type: form.item_type,
        title: form.title,
        description: form.description || null,
        responsible_party: form.responsible_party || null,
        due_date: form.due_date || null,
        expiration_date: form.expiration_date || null,
        created_by: user?.id,
      })
      toast.success('Item added')
      setModalOpen(false)
      setForm({ item_type: 'warranty', title: '', description: '', responsible_party: '', due_date: '', expiration_date: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status })
      toast.success('Status updated')
    } catch {
      toast.error('Update failed')
    }
  }

  return (
    <PageContainer
      title="Closeout"
      subtitle="Warranties, O&M manuals, lien waivers, and project handover items"
      actions={
        <PermissionGate permission="project.settings">
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>New Item</Btn>
        </PermissionGate>
      }
    >
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total Items" value={totalItems} />
            <MetricBox label="Approved" value={approved} />
            <MetricBox label="In Progress" value={inProgress} />
            <MetricBox label="Pending" value={pending} />
          </div>

          <Card padding={spacing['4']}>
            <SectionHeader title="Overall Progress" />
            <div style={{ marginTop: spacing['3'], marginBottom: spacing['2'] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{approved} of {totalItems} complete</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium }}>{pctComplete}%</span>
              </div>
              <ProgressBar value={pctComplete} />
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'], marginTop: spacing['2xl'] }}>
            {Object.keys(ITEM_TYPE_META).map((type) => {
              const meta = ITEM_TYPE_META[type]
              const groupItems = grouped[type] || []
              if (groupItems.length === 0) return null
              const Icon = meta.icon
              return (
                <Card key={type} padding={spacing['4']}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
                    <Icon size={18} color={meta.color} />
                    <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold }}>{meta.label}</h3>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>({groupItems.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                    {groupItems.map((item) => {
                      const statusMeta = STATUS_META[item.status] || STATUS_META.pending
                      return (
                        <div key={item.id} style={{
                          display: 'flex', alignItems: 'center', gap: spacing['3'],
                          padding: spacing['3'], borderRadius: borderRadius.base, backgroundColor: colors.surfaceInset,
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{item.title}</p>
                            {item.responsible_party && (
                              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.responsible_party}</p>
                            )}
                          </div>
                          {item.due_date && (
                            <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                              Due {new Date(item.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {item.expiration_date && (
                            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusPending }}>
                              Expires {new Date(item.expiration_date).toLocaleDateString()}
                            </span>
                          )}
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            style={{
                              padding: `4px ${spacing['2']}`, borderRadius: borderRadius.full,
                              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                              color: statusMeta.color, backgroundColor: statusMeta.bg, border: 'none', cursor: 'pointer',
                            }}
                          >
                            {Object.keys(STATUS_META).map((s) => (
                              <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
            {totalItems === 0 && (
              <Card padding={spacing['4']}>
                <EmptyState icon={<CheckCircle2 size={48} />} title="No closeout items" description="Add closeout items to track project handover." />
              </Card>
            )}
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Closeout Item" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Type</label>
            <select
              value={form.item_type}
              onChange={(e) => setForm({ ...form, item_type: e.target.value })}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              {Object.keys(ITEM_TYPE_META).map((t) => (
                <option key={t} value={t}>{ITEM_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>
          <InputField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="HVAC warranty" />
          <InputField label="Responsible Party" value={form.responsible_party} onChange={(v) => setForm({ ...form, responsible_party: v })} placeholder="Vendor name" />
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Due Date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
            <InputField label="Expiration Date" type="date" value={form.expiration_date} onChange={(v) => setForm({ ...form, expiration_date: v })} />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSubmit} loading={createItem.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Closeout
