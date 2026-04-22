import React, { useState, useMemo } from 'react'
import { Send, Plus, ChevronRight, FileText, Search } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useTransmittals, useCreateTransmittal } from '../hooks/queries/enterprise-modules'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

interface TransmittalItem {
  name: string
  description: string
  copies: number
}

interface Transmittal {
  id: string
  transmittal_number: number
  to_company: string
  from_company: string
  subject: string
  status: string
  action_required: string | null
  purpose: string | null
  notes: string | null
  description: string | null
  items: TransmittalItem[]
  sent_at: string | null
  acknowledged_at: string | null
  responded_at: string | null
  due_date: string | null
  created_at: string
}

const ACTION_REQUIRED_OPTIONS = [
  { value: 'for_review', label: 'For Review' },
  { value: 'for_approval', label: 'For Approval' },
  { value: 'for_construction', label: 'For Construction' },
  { value: 'for_record', label: 'For Record' },
]

const STATUS_FLOW: Record<string, string> = {
  draft: 'sent',
  sent: 'received',
  received: 'responded',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  received: 'Received',
  acknowledged: 'Received',
  responded: 'Responded',
}

const col = createColumnHelper<Transmittal>()
const columns = [
  col.accessor('transmittal_number', {
    header: '#',
    cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>T-{String(info.getValue()).padStart(4, '0')}</span>,
  }),
  col.accessor('subject', { header: 'Subject', cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium }}>{info.getValue()}</span> }),
  col.accessor('to_company', { header: 'To', cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span> }),
  col.accessor('from_company', { header: 'From', cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span> }),
  col.accessor('action_required', {
    header: 'Action',
    cell: (info) => {
      const v = info.getValue()
      if (!v) return <span style={{ color: colors.textTertiary }}>--</span>
      return <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{v.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())}</span>
    },
  }),
  col.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue()
      const map: Record<string, { c: string; bg: string }> = {
        draft: { c: colors.textTertiary, bg: colors.surfaceInset },
        sent: { c: colors.statusInfo, bg: colors.statusInfoSubtle },
        received: { c: colors.statusPending, bg: colors.statusPendingSubtle },
        acknowledged: { c: colors.statusPending, bg: colors.statusPendingSubtle },
        responded: { c: colors.statusActive, bg: colors.statusActiveSubtle },
      }
      const s = map[v] || map.draft
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: s.c, backgroundColor: s.bg }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: s.c }} />
          {STATUS_LABELS[v] || v.replace(/\b\w/g, (ch: string) => ch.toUpperCase())}
        </span>
      )
    },
  }),
  col.accessor('sent_at', {
    header: 'Sent',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : '--'}</span>,
  }),
]

export const Transmittals: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: transmittals, isLoading } = useTransmittals(projectId ?? undefined)
  const createTransmittal = useCreateTransmittal()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    to_company: '', from_company: '', subject: '', description: '', due_date: '',
    action_required: 'for_review', notes: '',
    items: [{ name: '', description: '', copies: 1 }] as TransmittalItem[],
  })

  const list = (transmittals ?? []) as Transmittal[]

  const filtered = useMemo(() => {
    let result = list
    if (statusFilter !== 'all') result = result.filter((t) => t.status === statusFilter)
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter((t) =>
        t.subject.toLowerCase().includes(q) ||
        t.to_company.toLowerCase().includes(q) ||
        t.from_company.toLowerCase().includes(q) ||
        String(t.transmittal_number).includes(q)
      )
    }
    return result
  }, [list, statusFilter, searchText])

  const sentCount = list.filter((t) => t.status === 'sent').length
  const receivedCount = list.filter((t) => t.status === 'received' || t.status === 'acknowledged').length
  const respondedCount = list.filter((t) => t.status === 'responded').length
  const draftCount = list.filter((t) => t.status === 'draft').length

  const detailTransmittal = detailId ? list.find((t) => t.id === detailId) : null

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { name: '', description: '', copies: 1 }] })
  }

  const updateItem = (idx: number, field: keyof TransmittalItem, value: string | number) => {
    const items = [...form.items]
    items[idx] = { ...items[idx], [field]: value }
    setForm({ ...form, items })
  }

  const removeItem = (idx: number) => {
    if (form.items.length <= 1) return
    const items = form.items.filter((_, i) => i !== idx)
    setForm({ ...form, items })
  }

  const handleSubmit = async () => {
    if (!projectId || !form.to_company || !form.from_company || !form.subject) {
      toast.error('To, From, Subject required')
      return
    }
    try {
      const validItems = form.items.filter((i) => i.name.trim())
      await createTransmittal.mutateAsync({
        project_id: projectId,
        to_company: form.to_company,
        from_company: form.from_company,
        subject: form.subject,
        description: form.description || null,
        due_date: form.due_date || null,
        action_required: form.action_required || null,
        notes: form.notes || null,
        items: validItems.length > 0 ? validItems : [],
        created_by: user?.id,
      })
      toast.success('Transmittal created')
      setModalOpen(false)
      setForm({ to_company: '', from_company: '', subject: '', description: '', due_date: '', action_required: 'for_review', notes: '', items: [{ name: '', description: '', copies: 1 }] })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const advanceStatus = async (transmittal: Transmittal) => {
    const nextStatus = STATUS_FLOW[transmittal.status]
    if (!nextStatus) return
    try {
      const updatePayload: Record<string, unknown> = { status: nextStatus, updated_at: new Date().toISOString() }
      if (nextStatus === 'sent') updatePayload.sent_at = new Date().toISOString()
      if (nextStatus === 'received') updatePayload.acknowledged_at = new Date().toISOString()
      if (nextStatus === 'responded') updatePayload.responded_at = new Date().toISOString()

      const { error } = await supabase
        .from('transmittals')
        .update(updatePayload)
        .eq('id', transmittal.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['transmittals', projectId] })
      toast.success(`Status updated to ${STATUS_LABELS[nextStatus]}`)
      setDetailId(null)
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  return (
    <PageContainer
      title="Transmittals"
      subtitle="Documents sent to and from subs, architects, and owners"
      actions={
        <PermissionGate
          permission="project.settings"
          fallback={<span title="Your role doesn't allow creating transmittals. Request access from your admin."><Btn variant="primary" icon={<Plus size={16} />} disabled>New Transmittal</Btn></span>}
        >
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>New Transmittal</Btn>
        </PermissionGate>
      }
    >
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total" value={list.length} />
            <MetricBox label="Draft" value={draftCount} />
            <MetricBox label="Sent" value={sentCount} />
            <MetricBox label="Received" value={receivedCount} />
            <MetricBox label="Responded" value={respondedCount} />
          </div>

          <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <InputField value={searchText} onChange={setSearchText} placeholder="Search transmittals..." icon={<Search size={16} />} />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
              <option value="responded">Responded</option>
            </select>
          </div>

          <Card padding={spacing['4']}>
            <SectionHeader title="All Transmittals" />
            {filtered.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                <DataTable
                  columns={columns}
                  data={filtered}
                  onRowClick={(row) => setDetailId(row.id)}
                />
              </div>
            ) : (
              <EmptyState icon={<Send size={48} />} title="No transmittals" description="Create a transmittal to log a document exchange." />
            )}
          </Card>
        </>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Transmittal" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="From Company" value={form.from_company} onChange={(v) => setForm({ ...form, from_company: v })} placeholder="Your company" />
            <InputField label="To Company" value={form.to_company} onChange={(v) => setForm({ ...form, to_company: v })} placeholder="Recipient company" />
          </div>
          <InputField label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="Brief subject" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Action Required</label>
              <select
                value={form.action_required}
                onChange={(e) => setForm({ ...form, action_required: e.target.value })}
                style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
              >
                {ACTION_REQUIRED_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <InputField label="Due Date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
            />
          </div>

          {/* Items section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] }}>
              <label style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Items / Documents</label>
              <button
                type="button"
                onClick={addItem}
                style={{ background: 'none', border: 'none', color: colors.orangeText, cursor: 'pointer', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium }}
              >
                + Add Item
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {form.items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 60px 30px', gap: spacing['2'], alignItems: 'center' }}>
                  <input
                    placeholder="Document name"
                    value={item.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    style={{ padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
                  />
                  <input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    style={{ padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.copies}
                    onChange={(e) => updateItem(idx, 'copies', parseInt(e.target.value, 10) || 1)}
                    style={{ padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, textAlign: 'center' }}
                    title="Copies"
                  />
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      style={{ background: 'none', border: 'none', color: colors.textTertiary, cursor: 'pointer', fontSize: '16px' }}
                      title="Remove item"
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
              placeholder="Additional notes..."
            />
          </div>

          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSubmit} loading={createTransmittal.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailTransmittal} onClose={() => setDetailId(null)} title={detailTransmittal ? `T-${String(detailTransmittal.transmittal_number).padStart(4, '0')}: ${detailTransmittal.subject}` : ''} width="600px">
        {detailTransmittal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
              <div>
                <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>From</label>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{detailTransmittal.from_company}</div>
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>To</label>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{detailTransmittal.to_company}</div>
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Action Required</label>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                  {detailTransmittal.action_required ? detailTransmittal.action_required.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase()) : '--'}
                </div>
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Status</label>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{STATUS_LABELS[detailTransmittal.status] || detailTransmittal.status}</div>
              </div>
              {detailTransmittal.due_date && (
                <div>
                  <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Due Date</label>
                  <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{new Date(detailTransmittal.due_date).toLocaleDateString()}</div>
                </div>
              )}
              <div>
                <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Created</label>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{new Date(detailTransmittal.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {detailTransmittal.description && (
              <div>
                <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Description</label>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, marginTop: spacing['1'] }}>{detailTransmittal.description}</div>
              </div>
            )}

            {/* Items */}
            {Array.isArray(detailTransmittal.items) && detailTransmittal.items.length > 0 && (
              <div>
                <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['2'], display: 'block' }}>Items / Documents</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                  {detailTransmittal.items.map((item: TransmittalItem, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['2'], borderRadius: borderRadius.base, backgroundColor: colors.surfaceInset }}>
                      <FileText size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} />
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{item.name}</span>
                      {item.description && <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>-- {item.description}</span>}
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>{item.copies} copy</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailTransmittal.notes && (
              <div>
                <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Notes</label>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, marginTop: spacing['1'] }}>{detailTransmittal.notes}</div>
              </div>
            )}

            {/* Status timeline */}
            <div>
              <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['2'], display: 'block' }}>Status Timeline</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {(['draft', 'sent', 'received', 'responded'] as const).map((s, i) => {
                  const isActive = ['draft', 'sent', 'received', 'responded'].indexOf(detailTransmittal.status) >= i ||
                    (detailTransmittal.status === 'acknowledged' && i <= 2)
                  return (
                    <React.Fragment key={s}>
                      {i > 0 && <ChevronRight size={14} style={{ color: colors.textTertiary }} />}
                      <span style={{
                        padding: `2px ${spacing.sm}`,
                        borderRadius: borderRadius.full,
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        backgroundColor: isActive ? colors.statusActiveSubtle : colors.surfaceInset,
                        color: isActive ? colors.statusActive : colors.textTertiary,
                      }}>
                        {STATUS_LABELS[s]}
                      </span>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* Advance status button */}
            {STATUS_FLOW[detailTransmittal.status] && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing['2'] }}>
                <Btn variant="primary" onClick={() => advanceStatus(detailTransmittal)}>
                  Mark as {STATUS_LABELS[STATUS_FLOW[detailTransmittal.status]]}
                </Btn>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}

export default Transmittals
