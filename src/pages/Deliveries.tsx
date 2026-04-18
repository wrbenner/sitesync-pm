import React, { useMemo, useState } from 'react'
import { Truck, Plus, Sparkles, Calendar as CalendarIcon, AlertCircle, CheckCircle2 } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import {
  useDeliveries,
  useCreateDelivery,
  useUpdateDelivery,
  type Delivery,
  type DeliveryItem,
} from '../hooks/queries/enterprise-capabilities'

const STATUS_COLORS: Record<Delivery['status'], { c: string; bg: string; label: string }> = {
  scheduled: { c: colors.statusInfo, bg: colors.statusInfoSubtle, label: 'Scheduled' },
  in_transit: { c: colors.statusPending, bg: colors.statusPendingSubtle, label: 'In Transit' },
  delivered: { c: colors.statusActive, bg: colors.statusActiveSubtle, label: 'Delivered' },
  partial: { c: colors.statusPending, bg: colors.statusPendingSubtle, label: 'Partial' },
  rejected: { c: colors.statusCritical, bg: colors.statusCriticalSubtle, label: 'Rejected' },
  cancelled: { c: colors.textTertiary, bg: colors.surfaceInset, label: 'Cancelled' },
}

function isLate(d: Delivery): boolean {
  if (d.status === 'delivered' || d.status === 'cancelled') return false
  const expected = new Date(d.expected_date)
  expected.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.getTime() > expected.getTime()
}

const Deliveries: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: deliveries, isLoading } = useDeliveries(projectId ?? undefined)
  const createDelivery = useCreateDelivery()
  const updateDelivery = useUpdateDelivery()

  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Delivery | null>(null)

  const [form, setForm] = useState({
    supplier: '',
    expected_date: new Date().toISOString().split('T')[0],
    items: [{ description: '', quantity_ordered: 1, quantity_received: 0, unit: 'ea' }] as DeliveryItem[],
    receiving_notes: '',
  })

  const stats = useMemo(() => {
    const list = deliveries ?? []
    const scheduled = list.filter((d) => d.status === 'scheduled' || d.status === 'in_transit').length
    const onTime = list.filter((d) => d.status === 'delivered' && d.actual_date && d.actual_date <= d.expected_date).length
    const late = list.filter((d) => isLate(d)).length
    return { total: list.length, scheduled, onTime, late }
  }, [deliveries])

  const calendar = useMemo(() => {
    const map = new Map<string, Delivery[]>()
    ;(deliveries ?? []).forEach((d) => {
      if (!map.has(d.expected_date)) map.set(d.expected_date, [])
      map.get(d.expected_date)!.push(d)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [deliveries])

  const handleCreate = async () => {
    if (!projectId) return
    if (!form.supplier.trim()) {
      toast.error('Supplier is required')
      return
    }
    try {
      await createDelivery.mutateAsync({
        project_id: projectId,
        supplier: form.supplier.trim(),
        expected_date: form.expected_date,
        items: form.items,
        receiving_notes: form.receiving_notes || null,
        status: 'scheduled',
      })
      toast.success('Delivery scheduled')
      setModalOpen(false)
      setForm({ supplier: '', expected_date: new Date().toISOString().split('T')[0], items: [{ description: '', quantity_ordered: 1, quantity_received: 0, unit: 'ea' }], receiving_notes: '' })
    } catch (e) {
      toast.error('Failed to schedule delivery')
      console.error(e)
    }
  }

  const markDelivered = (d: Delivery) => {
    updateDelivery.mutate({ id: d.id, updates: { status: 'delivered', actual_date: new Date().toISOString().split('T')[0], received_by: user?.id } }, {
      onSuccess: () => toast.success('Delivery marked received'),
      onError: () => toast.error('Failed to update'),
    })
  }

  const analyzeImpact = (d: Delivery) => {
    const daysLate = Math.max(0, Math.round((Date.now() - new Date(d.expected_date).getTime()) / 86400000))
    toast.info(`Impact Analysis: ${d.supplier} is ${daysLate}d late — check schedule phases that depend on this material (concrete pour, framing, etc.)`, { duration: 6000 })
  }

  const addItemRow = () => {
    setForm({ ...form, items: [...form.items, { description: '', quantity_ordered: 1, quantity_received: 0, unit: 'ea' }] })
  }

  const updateItem = (i: number, patch: Partial<DeliveryItem>) => {
    const next = [...form.items]
    next[i] = { ...next[i], ...patch }
    setForm({ ...form, items: next })
  }

  return (
    <PageContainer
      title="Deliveries"
      subtitle="Track material deliveries to the job site"
      actions={
        <Btn variant="primary" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Log Delivery
        </Btn>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
        <MetricBox label="Total" value={String(stats.total)} icon={Truck} />
        <MetricBox label="Scheduled" value={String(stats.scheduled)} icon={CalendarIcon} />
        <MetricBox label="On Time" value={String(stats.onTime)} icon={CheckCircle2} />
        <MetricBox label="Late" value={String(stats.late)} icon={AlertCircle} />
      </div>

      {isLoading ? (
        <Skeleton height={280} />
      ) : (deliveries ?? []).length === 0 ? (
        <EmptyState
          icon={<Truck size={48} color={colors.textTertiary} />}
          title="No deliveries yet"
          description="Schedule supplier deliveries, log receipts with photos, and flag late impact."
          actionLabel="Schedule Delivery"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        calendar.map(([date, list]) => (
          <Card key={date} padding={spacing['4']}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
              <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{date}</div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{list.length} delivery{list.length === 1 ? '' : 's'}</div>
            </div>
            {list.map((d) => {
              const status = STATUS_COLORS[d.status]
              const late = isLate(d)
              return (
                <div
                  key={d.id}
                  onClick={() => setSelected(d)}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: spacing['3'], border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, marginBottom: spacing['2'], cursor: 'pointer', background: colors.surfaceRaised }}
                >
                  <div>
                    <div style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>#{d.delivery_number} — {d.supplier}</div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                      {Array.isArray(d.items) ? d.items.length : 0} line item{Array.isArray(d.items) && d.items.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    {late && <span style={{ color: colors.statusCritical, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold }}>LATE</span>}
                    <span style={{ padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm, background: status.bg, color: status.c, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold }}>
                      {status.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </Card>
        ))
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Delivery" width="720px">
        <InputField label="Supplier" value={form.supplier} onChange={(v) => setForm({ ...form, supplier: v })} />
        <InputField label="Expected Date" value={form.expected_date} onChange={(v) => setForm({ ...form, expected_date: v })} type="date" />
        <SectionHeader title="Line Items" action={<Btn variant="secondary" onClick={addItemRow}><Plus size={14} /> Add</Btn>} />
        {form.items.map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px', gap: spacing['2'], marginBottom: spacing['2'] }}>
            <input
              placeholder="Description"
              value={it.description}
              onChange={(e) => updateItem(i, { description: e.target.value })}
              style={{ padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
            />
            <input
              type="number"
              placeholder="Qty"
              value={it.quantity_ordered}
              onChange={(e) => updateItem(i, { quantity_ordered: parseFloat(e.target.value) || 0 })}
              style={{ padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
            />
            <input
              type="number"
              placeholder="Rcvd"
              value={it.quantity_received}
              onChange={(e) => updateItem(i, { quantity_received: parseFloat(e.target.value) || 0 })}
              style={{ padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
            />
            <input
              placeholder="Unit"
              value={it.unit}
              onChange={(e) => updateItem(i, { unit: e.target.value })}
              style={{ padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
            />
          </div>
        ))}
        <InputField label="Receiving Notes" value={form.receiving_notes} onChange={(v) => setForm({ ...form, receiving_notes: v })} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreate}>Schedule</Btn>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `#${selected.delivery_number} — ${selected.supplier}` : ''} width="640px">
        {selected && (
          <>
            <div style={{ marginBottom: spacing['3'], color: colors.textSecondary }}>
              Expected: {selected.expected_date}{selected.actual_date ? ` · Received: ${selected.actual_date}` : ''}
            </div>
            <SectionHeader title="Items" />
            {Array.isArray(selected.items) && selected.items.length > 0 ? (
              selected.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: typography.fontSize.sm }}>
                  <div style={{ color: colors.textPrimary }}>{it.description}</div>
                  <div style={{ color: colors.textSecondary }}>{it.quantity_received}/{it.quantity_ordered} {it.unit}</div>
                </div>
              ))
            ) : (
              <div style={{ color: colors.textTertiary, padding: spacing['3'] }}>No items</div>
            )}
            {selected.receiving_notes && (
              <div style={{ marginTop: spacing['3'], padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
                {selected.receiving_notes}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
              <Btn variant="secondary" onClick={() => analyzeImpact(selected)}>
                <Sparkles size={14} /> Impact Analysis
              </Btn>
              {selected.status !== 'delivered' && (
                <Btn variant="primary" onClick={() => { markDelivered(selected); setSelected(null) }}>
                  Mark Delivered
                </Btn>
              )}
            </div>
          </>
        )}
      </Modal>
    </PageContainer>
  )
}

export default Deliveries
