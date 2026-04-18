import React, { useState, useMemo } from 'react'
import { Users, Plus, Search, Star, Sparkles, AlertTriangle, Shield, ShieldAlert } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import {
  useVendors, useCreateVendor,
  useVendorEvaluations, useCreateVendorEvaluation,
  type Vendor,
} from '../hooks/queries/vendors'

const STATUS_COLORS: Record<Vendor['status'], { c: string; bg: string }> = {
  active: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  probation: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  suspended: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
  blacklisted: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

function Stars({ value }: { value: number | null }) {
  const n = value != null ? Math.round(value) : 0
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} fill={i <= n ? colors.orangeText : 'none'} color={i <= n ? colors.orangeText : colors.textTertiary} />
      ))}
    </div>
  )
}

export const Vendors: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: vendors, isLoading } = useVendors(projectId ?? undefined)
  const createVendor = useCreateVendor()

  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<Vendor['status'] | ''>('')
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [riskOpen, setRiskOpen] = useState(false)
  const [evalOpen, setEvalOpen] = useState(false)

  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '', trade: '',
    license_number: '', insurance_expiry: '', bonding_capacity: '',
    status: 'active' as Vendor['status'], notes: '',
  })

  const filtered = useMemo(() => {
    const list = vendors ?? []
    const term = search.trim().toLowerCase()
    return list.filter((v) => {
      if (term && !(v.company_name || '').toLowerCase().includes(term) && !(v.trade || '').toLowerCase().includes(term)) return false
      if (tradeFilter && v.trade !== tradeFilter) return false
      if (statusFilter && v.status !== statusFilter) return false
      return true
    })
  }, [vendors, search, tradeFilter, statusFilter])

  const trades = useMemo(() => {
    const set = new Set<string>()
    ;(vendors ?? []).forEach((v) => { if (v.trade) set.add(v.trade) })
    return Array.from(set).sort()
  }, [vendors])

  const stats = useMemo(() => {
    const list = vendors ?? []
    const active = list.filter((v) => v.status === 'active').length
    const today = new Date()
    const expired = list.filter((v) => v.insurance_expiry && new Date(v.insurance_expiry) < today).length
    const avgScore = list.length > 0
      ? list.filter((v) => v.performance_score != null).reduce((s, v) => s + (v.performance_score || 0), 0) /
        Math.max(1, list.filter((v) => v.performance_score != null).length)
      : 0
    return { total: list.length, active, expired, avgScore }
  }, [vendors])

  const risks = useMemo(() => {
    const list = vendors ?? []
    const today = new Date()
    const warnings: { vendor: Vendor; reasons: string[] }[] = []
    list.forEach((v) => {
      const reasons: string[] = []
      if (v.insurance_expiry && new Date(v.insurance_expiry) < today) reasons.push('Insurance expired')
      else if (v.insurance_expiry) {
        const daysOut = (new Date(v.insurance_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        if (daysOut < 30) reasons.push(`Insurance expires in ${Math.round(daysOut)} days`)
      }
      if (v.performance_score != null && v.performance_score < 3) reasons.push(`Low performance score (${v.performance_score.toFixed(1)})`)
      if (v.status === 'probation') reasons.push('On probation')
      if (v.status === 'suspended' || v.status === 'blacklisted') reasons.push(`Status: ${v.status}`)
      if (reasons.length > 0) warnings.push({ vendor: v, reasons })
    })
    return warnings
  }, [vendors])

  const handleCreate = async () => {
    if (!form.company_name) {
      toast.error('Company name required')
      return
    }
    try {
      await createVendor.mutateAsync({
        project_id: projectId ?? null,
        company_name: form.company_name,
        contact_name: form.contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
        trade: form.trade || null,
        license_number: form.license_number || null,
        insurance_expiry: form.insurance_expiry || null,
        bonding_capacity: form.bonding_capacity ? Math.round(parseFloat(form.bonding_capacity) * 100) : null,
        status: form.status,
        notes: form.notes || null,
        created_by: user?.id ?? null,
      })
      toast.success('Vendor added')
      setModalOpen(false)
      setForm({ company_name: '', contact_name: '', email: '', phone: '', trade: '', license_number: '', insurance_expiry: '', bonding_capacity: '', status: 'active', notes: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  return (
    <PageContainer
      title="Vendors"
      subtitle="Subcontractors, suppliers, and consultants"
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn variant="secondary" icon={<Sparkles size={16} />} onClick={() => setRiskOpen(true)}>Vendor Risk Assessment</Btn>
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>Add Vendor</Btn>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Vendors" value={stats.total} />
            <MetricBox label="Active" value={stats.active} />
            <MetricBox label="Insurance Expired" value={stats.expired} />
            <MetricBox label="Avg Score" value={stats.avgScore > 0 ? stats.avgScore.toFixed(1) : '—'} />
          </div>

          <Card padding={spacing['4']}>
            <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['2'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, backgroundColor: colors.surfaceFlat }}>
                <Search size={14} color={colors.textTertiary} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: colors.textPrimary, fontSize: typography.fontSize.sm }} />
              </div>
              <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} style={filterSelectStyle}>
                <option value="">All trades</option>
                {trades.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Vendor['status'] | '')} style={filterSelectStyle}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="probation">Probation</option>
                <option value="suspended">Suspended</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={<Users size={48} />} title="No vendors" description="Add a vendor to start tracking performance." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: spacing['3'] }}>
                {filtered.map((v) => {
                  const expired = v.insurance_expiry && new Date(v.insurance_expiry) < new Date()
                  const palette = STATUS_COLORS[v.status]
                  return (
                    <div key={v.id} onClick={() => { setSelectedVendor(v); setEvalOpen(true) }} style={{
                      padding: spacing['3'], border: `1px solid ${colors.borderLight}`,
                      borderRadius: borderRadius.base, cursor: 'pointer', backgroundColor: colors.surfaceFlat,
                      display: 'flex', flexDirection: 'column', gap: spacing['2'],
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: spacing['2'] }}>
                        <div>
                          <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{v.company_name}</div>
                          <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>{v.trade || '—'}</div>
                        </div>
                        <span style={{
                          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                          color: palette.c, backgroundColor: palette.bg,
                        }}>{v.status}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <Stars value={v.performance_score} />
                        <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>
                          {v.performance_score != null ? v.performance_score.toFixed(1) : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.caption, color: expired ? colors.statusCritical : colors.textSecondary }}>
                        {expired ? <ShieldAlert size={14} /> : <Shield size={14} />}
                        Insurance: {v.insurance_expiry ? `exp ${new Date(v.insurance_expiry).toLocaleDateString()}` : '—'}
                      </div>
                      {v.email && <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{v.email}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Vendor" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Company Name" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} placeholder="ABC Contractors, LLC" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Contact Name" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
            <InputField label="Trade" value={form.trade} onChange={(v) => setForm({ ...form, trade: v })} placeholder="Electrical" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <InputField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="License #" value={form.license_number} onChange={(v) => setForm({ ...form, license_number: v })} />
            <InputField label="Insurance Expiry" type="date" value={form.insurance_expiry} onChange={(v) => setForm({ ...form, insurance_expiry: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Bonding Capacity ($)" value={form.bonding_capacity} onChange={(v) => setForm({ ...form, bonding_capacity: v })} />
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Vendor['status'] })} style={selectStyle}>
                <option value="active">Active</option>
                <option value="probation">Probation</option>
                <option value="suspended">Suspended</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} style={textareaStyle} />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} loading={createVendor.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={riskOpen} onClose={() => setRiskOpen(false)} title="AI Vendor Risk Assessment" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {risks.length === 0 ? (
            <EmptyState icon={<Shield size={48} />} title="All clear" description="No flagged vendors detected." />
          ) : (
            <>
              <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
                {risks.length} vendor{risks.length !== 1 ? 's' : ''} require attention.
              </div>
              {risks.map(({ vendor, reasons }) => (
                <div key={vendor.id} style={{
                  padding: spacing['3'], border: `1px solid ${colors.statusCritical}`,
                  borderRadius: borderRadius.base, backgroundColor: colors.statusCriticalSubtle,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontWeight: typography.fontWeight.medium, color: colors.statusCritical, marginBottom: spacing['2'] }}>
                    <AlertTriangle size={14} /> {vendor.company_name}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                    {reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      </Modal>

      {selectedVendor && (
        <EvaluationModal open={evalOpen} onClose={() => setEvalOpen(false)} vendor={selectedVendor} evaluatorId={user?.id ?? null} projectId={projectId ?? null} />
      )}
    </PageContainer>
  )
}

function EvaluationModal({ open, onClose, vendor, evaluatorId, projectId }: { open: boolean; onClose: () => void; vendor: Vendor; evaluatorId: string | null; projectId: string | null }) {
  const { data: evals } = useVendorEvaluations(vendor.id)
  const create = useCreateVendorEvaluation()
  const [scores, setScores] = useState({ quality: 4, schedule: 4, safety: 4, communication: 4 })
  const [comments, setComments] = useState('')

  const handleSubmit = async () => {
    try {
      await create.mutateAsync({
        vendor_id: vendor.id,
        project_id: projectId,
        evaluator: evaluatorId,
        quality_score: scores.quality,
        schedule_score: scores.schedule,
        safety_score: scores.safety,
        communication_score: scores.communication,
        comments: comments || null,
      })
      toast.success('Evaluation saved')
      setComments('')
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={vendor.company_name} width="640px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
          {vendor.trade || 'No trade'} · {vendor.contact_name || 'No contact'} · {vendor.email || 'No email'}
        </div>

        <SectionHeader title="New Evaluation" />
        {(['quality', 'schedule', 'safety', 'communication'] as const).map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'] }}>
            <span style={{ textTransform: 'capitalize', fontSize: typography.fontSize.sm, color: colors.textPrimary, minWidth: 120 }}>{key}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setScores({ ...scores, [key]: i })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Star size={20} fill={i <= scores[key] ? colors.orangeText : 'none'} color={i <= scores[key] ? colors.orangeText : colors.textTertiary} />
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <label style={labelStyle}>Comments</label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} style={textareaStyle} />
        </div>
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
          <Btn variant="primary" onClick={handleSubmit} loading={create.isPending}>Save</Btn>
        </div>

        {(evals ?? []).length > 0 && (
          <>
            <SectionHeader title="History" />
            {(evals ?? []).map((e) => (
              <div key={e.id} style={{ padding: spacing['2'], border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                  <span>{new Date(e.evaluated_at).toLocaleDateString()}</span>
                  <span>Overall: {e.overall_score?.toFixed(2) ?? '—'}</span>
                </div>
                {e.comments && <div style={{ marginTop: spacing['1'], fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{e.comments}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: spacing['1'],
  fontSize: typography.fontSize.caption, color: colors.textSecondary,
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary, fontSize: typography.fontSize.sm,
}
const filterSelectStyle: React.CSSProperties = {
  padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceFlat,
  color: colors.textPrimary, fontSize: typography.fontSize.sm, minWidth: 160,
}
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
  resize: 'vertical',
}

export default Vendors
