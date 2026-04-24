import React, { useMemo, useState } from 'react'
import { Send, Plus, Mail, FileText } from 'lucide-react'
import { Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { useTransmittals, useCreateTransmittal } from '../../hooks/queries/enterprise-modules'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'

type TransmittalRow = {
  id: string
  transmittal_number: number | null
  to_company: string
  from_company: string | null
  subject: string
  description: string | null
  status: string | null
  sent_date: string | null
  due_date: string | null
  acknowledged_date: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, { c: string; bg: string }> = {
  draft: { c: colors.textTertiary, bg: colors.surfaceInset },
  sent: { c: colors.statusInfo, bg: colors.statusInfoSubtle },
  acknowledged: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  overdue: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

function statusPill(status: string | null) {
  const key = (status || 'draft').toLowerCase()
  const s = STATUS_STYLES[key] || STATUS_STYLES.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color: s.c, backgroundColor: s.bg, textTransform: 'capitalize',
    }}>{key}</span>
  )
}

export const TransmittalsPanel: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data, isLoading } = useTransmittals(projectId ?? undefined)
  const createMut = useCreateTransmittal()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    to_company: '',
    from_company: '',
    subject: '',
    description: '',
    status: 'draft',
  })

  const list = (data ?? []) as TransmittalRow[]

  const stats = useMemo(() => {
    const total = list.length
    const sent = list.filter((t) => (t.status || '').toLowerCase() === 'sent').length
    const acknowledged = list.filter((t) => (t.status || '').toLowerCase() === 'acknowledged').length
    const pendingAck = list.filter((t) => !t.acknowledged_date && (t.status || '').toLowerCase() === 'sent').length
    return { total, sent, acknowledged, pendingAck }
  }, [list])

  const handleCreate = async () => {
    if (!projectId) return
    if (!form.to_company.trim() || !form.subject.trim()) {
      toast.error('Recipient and subject are required')
      return
    }
    try {
      await createMut.mutateAsync({
        project_id: projectId,
        to_company: form.to_company.trim(),
        from_company: form.from_company || null,
        subject: form.subject.trim(),
        description: form.description || null,
        status: form.status,
        sent_date: form.status === 'sent' ? new Date().toISOString() : null,
        created_by: user?.id || null,
      })
      toast.success('Transmittal logged')
      setModalOpen(false)
      setForm({ to_company: '', from_company: '', subject: '', description: '', status: 'draft' })
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`)
    }
  }

  if (!projectId) {
    return <EmptyState icon={<Mail size={32} />} title="No project selected" description="Select a project to view transmittals." />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
        <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          Log of document distributions to outside parties (owner, architect, subs)
        </div>
        <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
          New Transmittal
        </Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing['4'], marginBottom: spacing['4'] }}>
        <MetricBox label="Total" value={stats.total} />
        <MetricBox label="Sent" value={stats.sent} />
        <MetricBox label="Acknowledged" value={stats.acknowledged} />
        <MetricBox label="Awaiting Reply" value={stats.pendingAck} />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="56px" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Send size={32} />}
          title="No transmittals yet"
          description="Log outgoing document distributions to track what was sent and when it was acknowledged."
          actionLabel="Log Transmittal"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <Card padding={spacing['3']}>
          <SectionHeader title="Transmittal Log" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
            {list.map((t) => (
              <div key={t.id} style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr 120px 120px',
                gap: spacing['3'],
                alignItems: 'center',
                padding: spacing['3'],
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.base,
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: typography.fontSize.sm, color: colors.orangeText, fontWeight: typography.fontWeight.medium }}>
                  #{t.transmittal_number ?? '-'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.subject}
                  </div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                    To: {t.to_company}
                  </div>
                </div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.description || '—'}
                </div>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {t.sent_date ? new Date(t.sent_date).toLocaleDateString() : 'Not sent'}
                </span>
                {statusPill(t.status)}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Transmittal" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="To (Company)" value={form.to_company} onChange={(v) => setForm({ ...form, to_company: v })} placeholder="Architect / Owner / Sub" />
          <InputField label="From (Company)" value={form.from_company} onChange={(v) => setForm({ ...form, from_company: v })} placeholder="Your company" />
          <InputField label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="Drawings Rev C issued for construction" />
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
              placeholder="What documents are being transmitted..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm }}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="acknowledged">Acknowledged</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} loading={createMut.isPending} icon={<FileText size={14} />}>Create</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TransmittalsPanel
