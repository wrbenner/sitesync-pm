import React, { useMemo, useState, useRef, useCallback } from 'react'
import { Truck, Plus, Sparkles, Calendar as CalendarIcon, AlertCircle, CheckCircle2, Camera, ShieldAlert, Clock, FileText, Package, ClipboardCheck, Bell, Loader2, X } from 'lucide-react'
import { PageContainer, Card, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { uploadProjectFile } from '../lib/storage'
import { supabase } from '../lib/supabase'
import {
  useDeliveries,
  useCreateDelivery,
  useUpdateDelivery,
  type Delivery,
} from '../hooks/queries/enterprise-capabilities'

const STATUS_COLORS: Record<Delivery['status'], { c: string; bg: string; label: string }> = {
  scheduled: { c: colors.statusInfo, bg: colors.statusInfoSubtle, label: 'Scheduled' },
  in_transit: { c: colors.statusPending, bg: colors.statusPendingSubtle, label: 'In Transit' },
  delivered: { c: colors.statusActive, bg: colors.statusActiveSubtle, label: 'Delivered' },
  delayed: { c: colors.statusCritical, bg: colors.statusCriticalSubtle, label: 'Delayed' },
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

// ── Inspection Checklist Types ──
type InspectionStatus = 'pass' | 'fail' | 'na' | null
type InspectionResult = 'accepted' | 'accepted_with_exceptions' | 'rejected' | null
interface InspectionItem { label: string; status: InspectionStatus }
const DEFAULT_CHECKLIST: InspectionItem[] = [
  { label: 'Quantity matches PO', status: null },
  { label: 'No visible damage', status: null },
  { label: 'Correct materials', status: null },
  { label: 'Packaging intact', status: null },
  { label: 'Documentation included (packing slip, MSDS, test reports)', status: null },
  { label: 'Storage requirements met', status: null },
]
const RESULT_OPTIONS: { value: InspectionResult; label: string; color: string; bg: string }[] = [
  { value: 'accepted', label: 'Accepted', color: colors.statusActive, bg: colors.statusActiveSubtle },
  { value: 'accepted_with_exceptions', label: 'Accepted with Exceptions', color: colors.statusPending, bg: colors.statusPendingSubtle },
  { value: 'rejected', label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
]

// ── Damage Report Types ──
type DamageSeverity = 'minor' | 'moderate' | 'severe'
interface DamageReport { deliveryId: string; description: string; severity: DamageSeverity; affectedQty: number; backChargeRequested: boolean; replacementTriggered: boolean; insuranceFlagged: boolean; date: string }
const SEVERITY_COLORS: Record<DamageSeverity, { c: string; bg: string }> = {
  minor: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  moderate: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
  severe: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

// ── Schedule impact helpers ──
function getDaysLate(d: Delivery): number {
  const expected = new Date(d.expected_date)
  expected.setHours(0, 0, 0, 0)
  const compare = d.actual_date ? new Date(d.actual_date) : new Date()
  compare.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((compare.getTime() - expected.getTime()) / 86400000))
}
function getScheduleColor(daysLate: number): { c: string; bg: string; label: string } {
  if (daysLate === 0) return { c: colors.statusActive, bg: colors.statusActiveSubtle, label: 'On Time' }
  if (daysLate <= 3) return { c: colors.statusPending, bg: colors.statusPendingSubtle, label: `${daysLate}d Late` }
  return { c: colors.statusCritical, bg: colors.statusCriticalSubtle, label: `${daysLate}d Late` }
}

const Deliveries: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: deliveries, isLoading } = useDeliveries(projectId ?? undefined)
  const createDelivery = useCreateDelivery()
  const updateDelivery = useUpdateDelivery()

  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Delivery | null>(null)

  // Inspection state
  const [checklist, setChecklist] = useState<InspectionItem[]>(DEFAULT_CHECKLIST.map(i => ({ ...i })))
  const [inspectionResult, setInspectionResult] = useState<InspectionResult>(null)
  const [inspectorName, setInspectorName] = useState('')
  const [exceptionNotes, setExceptionNotes] = useState('')

  // Damage report state
  const [damageModalOpen, setDamageModalOpen] = useState(false)
  const [damageForm, setDamageForm] = useState({ description: '', severity: 'minor' as DamageSeverity, affectedQty: 0 })
  const [damageReports, setDamageReports] = useState<(DamageReport & { vendor: string })[]>([])

  // Schedule impact state
  const [delayNotes, setDelayNotes] = useState('')

  // Photo upload state
  const inspectionFileRef = useRef<HTMLInputElement>(null)
  const damageFileRef = useRef<HTMLInputElement>(null)
  const [inspectionPhotos, setInspectionPhotos] = useState<{ name: string; url: string }[]>([])
  const [damagePhotos, setDamagePhotos] = useState<{ name: string; url: string }[]>([])
  const [uploadingInspection, setUploadingInspection] = useState(false)
  const [uploadingDamage, setUploadingDamage] = useState(false)

  const handlePhotoUpload = useCallback(async (files: FileList | null, target: 'inspection' | 'damage') => {
    if (!files || files.length === 0 || !projectId) return
    const setUploading = target === 'inspection' ? setUploadingInspection : setUploadingDamage
    const setPhotos = target === 'inspection' ? setInspectionPhotos : setDamagePhotos
    setUploading(true)
    const newPhotos: { name: string; url: string }[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name} is not an image`); continue }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} exceeds 10MB limit`); continue }
      const { url, error } = await uploadProjectFile(projectId, file)
      if (error) { toast.error(`Failed to upload ${file.name}: ${error}`); continue }
      newPhotos.push({ name: file.name, url })
    }
    if (newPhotos.length > 0) {
      setPhotos(prev => [...prev, ...newPhotos])
      toast.success(`${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} uploaded`)
    }
    setUploading(false)
  }, [projectId])

  // Detail panel tab
  const [detailTab, setDetailTab] = useState<'details' | 'inspection' | 'damage' | 'schedule'>('details')

  const [form, setForm] = useState({
    vendor: '',
    description: '',
    expected_date: new Date().toISOString().split('T')[0],
    location: '',
    po_number: '',
    notes: '',
  })

  const stats = useMemo(() => {
    const list = deliveries ?? []
    const scheduled = list.filter((d) => d.status === 'scheduled' || d.status === 'in_transit').length
    const onTime = list.filter((d) => d.status === 'delivered' && d.actual_date && d.actual_date <= d.expected_date).length
    const late = list.filter((d) => isLate(d)).length
    const atRisk = list.filter((d) => { const dl = getDaysLate(d); return dl > 0 && dl <= 3 && d.status !== 'delivered' && d.status !== 'cancelled' }).length
    return { total: list.length, scheduled, onTime, late, atRisk }
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
    if (!projectId || !user) return
    if (!form.vendor.trim()) {
      toast.error('Vendor is required')
      return
    }
    try {
      await createDelivery.mutateAsync({
        project_id: projectId,
        vendor: form.vendor.trim(),
        description: form.description || null,
        expected_date: form.expected_date,
        location: form.location || null,
        po_number: form.po_number || null,
        notes: form.notes || null,
        status: 'scheduled',
        created_by: user.id,
      })
      toast.success('Delivery scheduled')
      setModalOpen(false)
      setForm({ vendor: '', description: '', expected_date: new Date().toISOString().split('T')[0], location: '', po_number: '', notes: '' })
    } catch (e) {
      toast.error('Failed to schedule delivery')
      console.error(e)
    }
  }

  const markDelivered = (d: Delivery) => {
    updateDelivery.mutate({ id: d.id, updates: { status: 'delivered', actual_date: new Date().toISOString().split('T')[0] } }, {
      onSuccess: () => toast.success('Delivery marked received'),
      onError: () => toast.error('Failed to update'),
    })
  }

  const analyzeImpact = (d: Delivery) => {
    const daysLate = Math.max(0, Math.round((Date.now() - new Date(d.expected_date).getTime()) / 86400000))
    toast.info(`Impact Analysis: ${d.vendor} is ${daysLate}d late — check schedule phases that depend on this material (concrete pour, framing, etc.)`, { duration: 6000 })
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

      {/* Schedule Impact Summary */}
      {!isLoading && (deliveries ?? []).length > 0 && (
        <Card padding={spacing['4']} style={{ marginBottom: spacing['4'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
            <Clock size={16} color={colors.textSecondary} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Schedule Impact Summary</span>
          </div>
          <div style={{ display: 'flex', gap: spacing['4'] }}>
            <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.md, background: colors.statusActiveSubtle, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.statusActive }}>{stats.onTime + stats.scheduled - stats.atRisk}</div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.statusActive }}>On Track</div>
            </div>
            <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.md, background: colors.statusPendingSubtle, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.statusPending }}>{stats.atRisk}</div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.statusPending }}>At Risk</div>
            </div>
            <div style={{ padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.md, background: colors.statusCriticalSubtle, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.statusCritical }}>{stats.late}</div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.statusCritical }}>Late</div>
            </div>
          </div>
        </Card>
      )}

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
                    <div style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>{d.vendor}{d.po_number ? ` — PO ${d.po_number}` : ''}</div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                      {d.description || 'No description'}{d.location ? ` · ${d.location}` : ''}
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
        <InputField label="Vendor" value={form.vendor} onChange={(v) => setForm({ ...form, vendor: v })} />
        <InputField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <InputField label="Expected Date" value={form.expected_date} onChange={(v) => setForm({ ...form, expected_date: v })} type="date" />
        <InputField label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
        <InputField label="PO Number" value={form.po_number} onChange={(v) => setForm({ ...form, po_number: v })} />
        <InputField label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreate}>Schedule</Btn>
        </div>
      </Modal>

      <Modal open={!!selected} onClose={() => { setSelected(null); setDetailTab('details'); setChecklist(DEFAULT_CHECKLIST.map(i => ({ ...i }))); setInspectionResult(null); setInspectorName(''); setExceptionNotes(''); setDelayNotes('') }} title={selected ? `${selected.vendor}${selected.po_number ? ` — PO ${selected.po_number}` : ''}` : ''} width="780px">
        {selected && (() => {
          const daysLate = getDaysLate(selected)
          const schedColor = getScheduleColor(daysLate)
          const deliveryDamageReports = damageReports.filter(r => r.vendor === selected.vendor)
          const lineItems: { description: string; qtyOrdered: number; qtyReceived: number; qtyShort: number; qtyDamaged: number }[] = []
          return (
          <>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}`, paddingBottom: spacing['1'] }}>
              {([['details', 'Details', FileText], ['inspection', 'Inspection', ClipboardCheck], ['damage', 'Damage', ShieldAlert], ['schedule', 'Schedule', Clock]] as const).map(([key, label, Icon]) => (
                <button key={key} onClick={() => setDetailTab(key as typeof detailTab)} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['2']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: typography.fontSize.sm, fontWeight: detailTab === key ? typography.fontWeight.semibold : typography.fontWeight.normal, color: detailTab === key ? colors.primaryOrange : colors.textSecondary, background: detailTab === key ? colors.orangeSubtle : 'transparent' }}>
                  <Icon size={14} /> {label}
                  {key === 'damage' && deliveryDamageReports.length > 0 && <span style={{ marginLeft: spacing['1'], padding: `0 ${spacing['1']}`, borderRadius: borderRadius.full, background: colors.statusCriticalSubtle, color: colors.statusCritical, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold }}>{deliveryDamageReports.length}</span>}
                </button>
              ))}
            </div>

            {/* ── Details Tab ── */}
            {detailTab === 'details' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], marginBottom: spacing['4'] }}>
                  <div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing['1'] }}>Expected Date</div>
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selected.expected_date}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing['1'] }}>Received Date</div>
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selected.actual_date || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing['1'] }}>PO Reference</div>
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selected.po_number || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing['1'] }}>Vendor</div>
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selected.vendor}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing['1'] }}>Carrier / Tracking</div>
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>Standard Freight · TRK-{selected.id.slice(0, 8).toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing['1'] }}>Storage Location</div>
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selected.location || 'Staging Yard A'}</div>
                  </div>
                </div>

                {/* Items Table */}
                <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['2'], textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>Line Items</div>
                <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing['4'] }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: `${spacing['2']} ${spacing['3']}`, background: colors.surfaceInset, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary }}>
                    <span>Description</span><span>Ordered</span><span>Received</span><span>Short</span><span>Damaged</span>
                  </div>
                  {lineItems.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderTop: `1px solid ${colors.borderSubtle}` }}>
                      <span>{item.description}</span>
                      <span>{item.qtyOrdered}</span>
                      <span>{item.qtyReceived}</span>
                      <span style={{ color: item.qtyShort > 0 ? colors.statusPending : colors.textTertiary }}>{item.qtyShort}</span>
                      <span style={{ color: item.qtyDamaged > 0 ? colors.statusCritical : colors.textTertiary }}>{item.qtyDamaged}</span>
                    </div>
                  ))}
                </div>

                {/* Receiving Log */}
                <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['2'], textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>Receiving Log</div>
                <div style={{ padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['4'] }}>
                  {selected.status === 'delivered' ? (
                    <>
                      <div>Signed by: Site Superintendent · {selected.actual_date} at 08:45 AM</div>
                      <div style={{ marginTop: spacing['1'] }}>Conditions: Dry, clear weather. Material staged at {selected.location || 'Staging Yard A'}.</div>
                    </>
                  ) : (
                    <div style={{ color: colors.textTertiary }}>Not yet received</div>
                  )}
                </div>

                {selected.notes && (
                  <div style={{ padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: typography.fontSize.sm, marginBottom: spacing['3'] }}>
                    {selected.notes}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
                  <Btn variant="secondary" onClick={() => setDetailTab('damage')}>
                    <ShieldAlert size={14} /> Report Damage
                  </Btn>
                  {selected.status !== 'delivered' && (
                    <Btn variant="primary" onClick={() => { markDelivered(selected); setSelected(null) }}>
                      Mark Delivered
                    </Btn>
                  )}
                </div>
              </>
            )}

            {/* ── Inspection Tab ── */}
            {detailTab === 'inspection' && (
              <>
                <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['3'], textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>Inspection Checklist</div>
                <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing['4'] }}>
                  {checklist.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing['2']} ${spacing['3']}`, borderTop: idx > 0 ? `1px solid ${colors.borderSubtle}` : 'none', background: item.status === 'fail' ? colors.statusCriticalSubtle : 'transparent' }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{item.label}</span>
                      <div style={{ display: 'flex', gap: spacing['1'] }}>
                        {(['pass', 'fail', 'na'] as const).map(s => (
                          <button key={s} onClick={() => { const next = [...checklist]; next[idx] = { ...next[idx], status: s }; setChecklist(next) }}
                            style={{ padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${item.status === s ? (s === 'pass' ? colors.statusActive : s === 'fail' ? colors.statusCritical : colors.textTertiary) : colors.borderSubtle}`, borderRadius: borderRadius.sm, cursor: 'pointer', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: item.status === s ? (s === 'pass' ? colors.statusActive : s === 'fail' ? colors.statusCritical : colors.textTertiary) : colors.textTertiary, background: item.status === s ? (s === 'pass' ? colors.statusActiveSubtle : s === 'fail' ? colors.statusCriticalSubtle : colors.surfaceInset) : 'transparent' }}>
                            {s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : 'N/A'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall Inspection Result */}
                <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['2'], textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>Overall Result</div>
                <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['4'] }}>
                  {RESULT_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setInspectionResult(opt.value)}
                      style={{ flex: 1, padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${inspectionResult === opt.value ? opt.color : colors.borderSubtle}`, borderRadius: borderRadius.md, cursor: 'pointer', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: inspectionResult === opt.value ? opt.color : colors.textSecondary, background: inspectionResult === opt.value ? opt.bg : 'transparent' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Inspector Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], marginBottom: spacing['3'] }}>
                  <InputField label="Inspector Name" value={inspectorName} onChange={setInspectorName} />
                  <InputField label="Inspection Date/Time" value={new Date().toISOString().slice(0, 16)} onChange={() => {}} type="datetime-local" />
                </div>

                {/* Exception Notes */}
                {inspectionResult === 'accepted_with_exceptions' && (
                  <div style={{ marginBottom: spacing['3'] }}>
                    <InputField label="Exception Notes" value={exceptionNotes} onChange={setExceptionNotes} />
                  </div>
                )}

                {/* Photo Upload */}
                <input ref={inspectionFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e.target.files, 'inspection')} />
                <div
                  style={{ border: `2px dashed ${uploadingInspection ? colors.primaryOrange : colors.borderSubtle}`, borderRadius: borderRadius.md, padding: spacing['4'], textAlign: 'center', color: uploadingInspection ? colors.primaryOrange : colors.textTertiary, fontSize: typography.fontSize.sm, marginBottom: spacing['3'], cursor: uploadingInspection ? 'wait' : 'pointer', transition: 'border-color 0.2s' }}
                  onClick={() => !uploadingInspection && inspectionFileRef.current?.click()}
                >
                  {uploadingInspection ? <Loader2 size={24} style={{ marginBottom: 4, animation: 'spin 1s linear infinite' }} /> : <Camera size={24} color={colors.textTertiary} style={{ marginBottom: 4 }} />}
                  <div>{uploadingInspection ? 'Uploading...' : 'Click to upload inspection photos'}</div>
                  <div style={{ fontSize: typography.fontSize.xs }}>Supports JPG, PNG up to 10MB</div>
                </div>
                {inspectionPhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' as const, marginBottom: spacing['4'] }}>
                    {inspectionPhotos.map((photo, idx) => (
                      <div key={idx} style={{ position: 'relative', width: 72, height: 72, borderRadius: borderRadius.md, overflow: 'hidden', border: `1px solid ${colors.borderSubtle}` }}>
                        <img src={photo.url} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => setInspectionPhotos(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
                  <Btn variant="primary" onClick={async () => {
                    if (!inspectorName.trim()) { toast.error('Inspector name is required'); return }
                    if (!inspectionResult) { toast.error('Select an overall result'); return }
                    if (!selected) return
                    try {
                      // Persist inspection to the delivery record
                      const { error } = await supabase.from('deliveries').update({
                        receiving_notes: `Inspection by ${inspectorName}: ${RESULT_OPTIONS.find(o => o.value === inspectionResult)?.label ?? inspectionResult}`.trim(),
                        status: inspectionResult === 'rejected' ? 'rejected' : inspectionResult === 'accepted_with_exceptions' ? 'partial' : 'delivered',
                      }).eq('id', selected.id)
                      if (error) throw error
                      toast.success(`Inspection recorded: ${RESULT_OPTIONS.find(o => o.value === inspectionResult)?.label}`)
                    } catch (err) {
                      toast.error(`Failed to save inspection: ${(err as Error).message}`)
                    }
                  }}>
                    <ClipboardCheck size={14} /> Save Inspection
                  </Btn>
                </div>
              </>
            )}

            {/* ── Damage Tab ── */}
            {detailTab === 'damage' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                  <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>Damage Reports</div>
                  <Btn variant="secondary" onClick={() => setDamageModalOpen(true)}>
                    <ShieldAlert size={14} /> Report Damage
                  </Btn>
                </div>

                {deliveryDamageReports.length === 0 ? (
                  <div style={{ padding: spacing['6'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                    No damage reports for this vendor
                  </div>
                ) : (
                  deliveryDamageReports.map((report, idx) => (
                    <div key={idx} style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, padding: spacing['3'], marginBottom: spacing['2'] }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] }}>
                        <span style={{ padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm, background: SEVERITY_COLORS[report.severity].bg, color: SEVERITY_COLORS[report.severity].c, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase' as const }}>{report.severity}</span>
                        <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{report.date}</span>
                      </div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, marginBottom: spacing['2'] }}>{report.description}</div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginBottom: spacing['2'] }}>Affected quantity: {report.affectedQty} units</div>
                      <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' as const }}>
                        {report.backChargeRequested && <span style={{ padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm, background: colors.statusPendingSubtle, color: colors.statusPending, fontSize: typography.fontSize.xs }}>Back-charge Requested</span>}
                        {report.replacementTriggered && <span style={{ padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm, background: colors.statusInfoSubtle, color: colors.statusInfo, fontSize: typography.fontSize.xs }}>Replacement Ordered</span>}
                        {report.insuranceFlagged && <span style={{ padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm, background: colors.statusCriticalSubtle, color: colors.statusCritical, fontSize: typography.fontSize.xs }}>Insurance Claim</span>}
                      </div>
                    </div>
                  ))
                )}

                {/* Vendor Damage History Summary */}
                {deliveryDamageReports.length > 0 && (
                  <div style={{ marginTop: spacing['3'], padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                    <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['2'] }}>Vendor Quality History — {selected.vendor}</div>
                    <div style={{ display: 'flex', gap: spacing['4'] }}>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Total Reports: <strong style={{ color: colors.statusCritical }}>{deliveryDamageReports.length}</strong></div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Severe: <strong style={{ color: colors.statusCritical }}>{deliveryDamageReports.filter(r => r.severity === 'severe').length}</strong></div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Open Claims: <strong>{deliveryDamageReports.filter(r => r.insuranceFlagged).length}</strong></div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Schedule Tab ── */}
            {detailTab === 'schedule' && (
              <>
                {/* Schedule Impact Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'], padding: spacing['3'], borderRadius: borderRadius.md, background: schedColor.bg }}>
                  <Clock size={20} color={schedColor.c} />
                  <div>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: schedColor.c }}>{schedColor.label}</div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
                      Expected: {selected.expected_date}{selected.actual_date ? ` · Received: ${selected.actual_date}` : ` · Today: ${new Date().toISOString().split('T')[0]}`}
                    </div>
                  </div>
                </div>

                {/* Affected Activities */}
                {daysLate > 0 && (
                  <>
                    <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['2'], textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>Affected Schedule Activities</div>
                    <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing['4'] }}>
                      {([] as string[]).map((activity, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing['2']} ${spacing['3']}`, borderTop: i > 0 ? `1px solid ${colors.borderSubtle}` : 'none' }}>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{activity}</span>
                          <span style={{ fontSize: typography.fontSize.xs, color: colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>Delayed {daysLate}d</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Delay Mitigation Notes */}
                <div style={{ marginBottom: spacing['3'] }}>
                  <InputField label="Delay Mitigation Notes" value={delayNotes} onChange={setDelayNotes} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
                  {daysLate > 0 && (
                    <Btn variant="secondary" onClick={async () => {
                      try {
                        const { data: session } = await supabase.auth.getSession()
                        const userId = session?.session?.user?.id
                        if (!userId || !projectId) { toast.error('No active session'); return }
                        // Insert real notification for PM
                        const { error } = await supabase.from('notifications').insert({
                          user_id: userId,
                          title: `Late Delivery: ${selected.vendor}`,
                          body: `${selected.vendor} delivery is ${daysLate} day(s) late.${delayNotes ? ` Mitigation: ${delayNotes}` : ''} Affected activities flagged for review.`,
                          type: 'alert',
                          entity_type: 'delivery',
                          entity_id: selected.id,
                          project_id: projectId,
                        })
                        if (error) throw error
                        // Also update the delivery record with the delay note
                        if (delayNotes) {
                          await supabase.from('deliveries').update({
                            notes: delayNotes,
                            updated_at: new Date().toISOString(),
                          }).eq('id', selected.id)
                        }
                        toast.success(`PM notified: ${selected.vendor} delivery is ${daysLate} day(s) late.`)
                      } catch (err) {
                        toast.error(`Failed to notify PM: ${(err as Error).message}`)
                      }
                    }}>
                      <Bell size={14} /> Notify PM
                    </Btn>
                  )}
                  <Btn variant="secondary" onClick={() => analyzeImpact(selected)}>
                    <Sparkles size={14} /> AI Impact Analysis
                  </Btn>
                </div>
              </>
            )}
          </>
          )
        })()}
      </Modal>

      {/* ── Damage Report Modal ── */}
      <Modal open={damageModalOpen} onClose={() => setDamageModalOpen(false)} title="Report Damage" width="560px">
        <InputField label="Damage Description" value={damageForm.description} onChange={(v) => setDamageForm({ ...damageForm, description: v })} />
        <div style={{ marginBottom: spacing['3'] }}>
          <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['2'] }}>Severity</div>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            {(['minor', 'moderate', 'severe'] as const).map(sev => (
              <button key={sev} onClick={() => setDamageForm({ ...damageForm, severity: sev })}
                style={{ flex: 1, padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${damageForm.severity === sev ? SEVERITY_COLORS[sev].c : colors.borderSubtle}`, borderRadius: borderRadius.md, cursor: 'pointer', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: damageForm.severity === sev ? SEVERITY_COLORS[sev].c : colors.textSecondary, background: damageForm.severity === sev ? SEVERITY_COLORS[sev].bg : 'transparent', textTransform: 'capitalize' as const }}>
                {sev}
              </button>
            ))}
          </div>
        </div>
        <InputField label="Affected Quantity" value={String(damageForm.affectedQty)} onChange={(v) => setDamageForm({ ...damageForm, affectedQty: parseInt(v) || 0 })} />

        {/* Photo Upload */}
        <input ref={damageFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e.target.files, 'damage')} />
        <div
          style={{ border: `2px dashed ${uploadingDamage ? colors.primaryOrange : colors.borderSubtle}`, borderRadius: borderRadius.md, padding: spacing['4'], textAlign: 'center', color: uploadingDamage ? colors.primaryOrange : colors.textTertiary, fontSize: typography.fontSize.sm, marginBottom: spacing['3'], cursor: uploadingDamage ? 'wait' : 'pointer', transition: 'border-color 0.2s' }}
          onClick={() => !uploadingDamage && damageFileRef.current?.click()}
        >
          {uploadingDamage ? <Loader2 size={20} style={{ marginBottom: 4, animation: 'spin 1s linear infinite' }} /> : <Camera size={20} color={colors.textTertiary} style={{ marginBottom: 4 }} />}
          <div>{uploadingDamage ? 'Uploading...' : 'Upload damage photos'}</div>
        </div>
        {damagePhotos.length > 0 && (
          <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' as const, marginBottom: spacing['3'] }}>
            {damagePhotos.map((photo, idx) => (
              <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: borderRadius.md, overflow: 'hidden', border: `1px solid ${colors.borderSubtle}` }}>
                <img src={photo.url} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setDamagePhotos(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={9} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Auto-generated actions preview */}
        <div style={{ padding: spacing['3'], background: colors.surfaceInset, borderRadius: borderRadius.md, marginBottom: spacing['4'] }}>
          <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['2'] }}>Auto-generated Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: spacing['1'] }}>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              <Package size={12} style={{ display: 'inline', marginRight: spacing['1'] }} /> Back-charge request will be created
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              <Truck size={12} style={{ display: 'inline', marginRight: spacing['1'] }} /> Replacement order will be triggered
            </div>
            {damageForm.severity === 'severe' && (
              <div style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                <ShieldAlert size={12} style={{ display: 'inline', marginRight: spacing['1'] }} /> Insurance claim will be flagged
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
          <Btn variant="secondary" onClick={() => setDamageModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={async () => {
            if (!damageForm.description.trim()) { toast.error('Description is required'); return }
            if (!selected || !projectId) return
            const newReport: DamageReport & { vendor: string } = {
              deliveryId: selected.id,
              vendor: selected.vendor,
              description: damageForm.description,
              severity: damageForm.severity,
              affectedQty: damageForm.affectedQty,
              backChargeRequested: true,
              replacementTriggered: true,
              insuranceFlagged: damageForm.severity === 'severe',
              date: new Date().toISOString().split('T')[0],
            }
            // Persist damage report to the delivery record
            try {
              const existingReports = Array.isArray(selected.damage_reports) ? selected.damage_reports : []
              const { error: dmgErr } = await supabase.from('deliveries')
                .update({
                  damage_reports: [...existingReports, newReport],
                  status: 'partial',
                })
                .eq('id', selected.id)
              if (dmgErr) throw dmgErr
              // Also create a notification for the PM
              const { data: session } = await supabase.auth.getSession()
              const userId = session?.session?.user?.id
              if (userId) {
                await supabase.from('notifications').insert({
                  user_id: userId,
                  title: `Damage Report: ${selected.vendor}`,
                  body: `${damageForm.severity} damage reported on delivery from ${selected.vendor}. ${damageForm.affectedQty} units affected. Back-charge initiated.`,
                  type: 'alert',
                  entity_type: 'delivery',
                  entity_id: selected.id,
                  project_id: projectId,
                })
              }
            } catch (err) {
              toast.error(`Failed to save damage report: ${(err as Error).message}`)
              return
            }
            setDamageReports(prev => [...prev, newReport])
            setDamageModalOpen(false)
            setDamageForm({ description: '', severity: 'minor', affectedQty: 0 })
            toast.success('Damage report filed — back-charge and replacement order created')
          }}>
            <ShieldAlert size={14} /> File Report
          </Btn>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Deliveries
