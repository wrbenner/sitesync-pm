import React, { useState } from 'react'
import { Send, Plus } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useTransmittals, useCreateTransmittal } from '../hooks/queries/enterprise-modules'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'

interface Transmittal {
  id: string
  transmittal_number: number
  to_company: string
  from_company: string
  subject: string
  status: string
  sent_date: string | null
  due_date: string | null
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
  col.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue()
      const map: Record<string, { c: string; bg: string }> = {
        draft: { c: colors.textTertiary, bg: colors.surfaceInset },
        sent: { c: colors.statusInfo, bg: colors.statusInfoSubtle },
        acknowledged: { c: colors.statusPending, bg: colors.statusPendingSubtle },
        responded: { c: colors.statusActive, bg: colors.statusActiveSubtle },
      }
      const s = map[v] || map.draft
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: s.c, backgroundColor: s.bg }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: s.c }} />
          {v.replace(/\b\w/g, (ch: string) => ch.toUpperCase())}
        </span>
      )
    },
  }),
  col.accessor('sent_date', {
    header: 'Sent',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : '—'}</span>,
  }),
]

export const Transmittals: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: transmittals, isLoading } = useTransmittals(projectId ?? undefined)
  const createTransmittal = useCreateTransmittal()

  const [form, setForm] = useState({
    to_company: '', from_company: '', subject: '', description: '', due_date: '',
  })

  const list = (transmittals ?? []) as Transmittal[]
  const sentCount = list.filter((t) => t.status === 'sent').length
  const respondedCount = list.filter((t) => t.status === 'responded').length

  const handleSubmit = async () => {
    if (!projectId || !form.to_company || !form.from_company || !form.subject) {
      toast.error('To, From, Subject required')
      return
    }
    try {
      await createTransmittal.mutateAsync({
        project_id: projectId,
        to_company: form.to_company,
        from_company: form.from_company,
        subject: form.subject,
        description: form.description || null,
        due_date: form.due_date || null,
        created_by: user?.id,
      })
      toast.success('Transmittal created')
      setModalOpen(false)
      setForm({ to_company: '', from_company: '', subject: '', description: '', due_date: '' })
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total" value={list.length} />
            <MetricBox label="Sent" value={sentCount} />
            <MetricBox label="Responded" value={respondedCount} />
          </div>

          <Card padding={spacing['4']}>
            <SectionHeader title="All Transmittals" />
            {list.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                <DataTable columns={columns} data={list} />
              </div>
            ) : (
              <EmptyState icon={<Send size={48} />} title="No transmittals" description="Create a transmittal to log a document exchange." />
            )}
          </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Transmittal" width="580px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="From" value={form.from_company} onChange={(v) => setForm({ ...form, from_company: v })} placeholder="Your company" />
            <InputField label="To" value={form.to_company} onChange={(v) => setForm({ ...form, to_company: v })} placeholder="Recipient company" />
          </div>
          <InputField label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="Brief subject" />
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
            />
          </div>
          <InputField label="Due Date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSubmit} loading={createTransmittal.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Transmittals
