import React, { useState, useMemo } from 'react'
import { Users, Plus, Search, Star, Sparkles, AlertTriangle, Shield, ShieldAlert, ClipboardCheck, Award, Mail, Send, CheckCircle, Clock, XCircle } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import {
  useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor,
  useVendorEvaluations, useCreateVendorEvaluation,
  type Vendor,
} from '../hooks/queries/vendors'
import { PermissionGate } from '../components/auth/PermissionGate'

const STATUS_COLORS: Record<Vendor['status'], { c: string; bg: string }> = {
  active: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  probation: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  suspended: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
  blacklisted: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

/* ── Prequalification Data ─────────────────────────────────── */
type PrequalStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected'
interface PrequalSection { label: string; score: number }
interface PrequalRecord {
  vendorId: string; vendorName: string; status: PrequalStatus; sections: PrequalSection[]; overallScore: number
  companyYears: number; annualRevenue: string; bondingCapacity: string; bankRef: string
  largestProject: string; emr: number; trir: number; oshaCitations: number
  glLimit: string; autoLimit: string; wcLimit: string; umbrellaLimit: string
  references: { project: string; contact: string; phone: string }[]
}

const PREQUAL_STATUS_COLORS: Record<PrequalStatus, { c: string; bg: string }> = {
  'Not Started': { c: colors.textTertiary, bg: colors.statusNeutralSubtle },
  'In Progress': { c: colors.statusInfo, bg: colors.statusInfoSubtle },
  'Submitted': { c: colors.statusPending, bg: colors.statusPendingSubtle },
  'Under Review': { c: colors.statusPending, bg: colors.statusPendingSubtle },
  'Approved': { c: colors.statusActive, bg: colors.statusActiveSubtle },
  'Rejected': { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}


/* ── DBE/MBE/WBE Certification Data ──────────────────────── */
type CertType = 'DBE' | 'MBE' | 'WBE' | 'SDVOSB' | 'HUBZone' | '8(a)'
interface DiversityCert { type: CertType; certNumber: string; agency: string; expiry: string; verified: boolean }
interface VendorDiversity { vendorName: string; certs: DiversityCert[]; totalContractValue: number }

/* Diversity goal targets are configurable project-level constants.
   actualPct is computed at render time from real vendor data. */
const DIVERSITY_GOAL_TARGETS: { category: CertType; targetPct: number }[] = [
  { category: 'DBE', targetPct: 15 },
  { category: 'MBE', targetPct: 10 },
  { category: 'WBE', targetPct: 8 },
  { category: 'SDVOSB', targetPct: 3 },
  { category: 'HUBZone', targetPct: 3 },
  { category: '8(a)', targetPct: 5 },
]

/* ── Bid Invitation Lists Data ───────────────────────────── */
type BidResponse = 'Pending' | 'Yes' | 'No Bid'
interface BidInvite { vendorName: string; trade: string; contact: string; invitedDate: string; response: BidResponse; bidAmount: number | null }
interface BidList { id: string; name: string; scope: string; createdDate: string; invites: BidInvite[] }


const BID_RESPONSE_COLORS: Record<BidResponse, { c: string; bg: string }> = {
  'Pending': { c: colors.statusPending, bg: colors.statusPendingSubtle },
  'Yes': { c: colors.statusActive, bg: colors.statusActiveSubtle },
  'No Bid': { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

/* ── Helpers ───────────────────────────────────────────────── */

/** Derive prequalification status from vendor fields */
function derivePrequalStatus(v: Vendor): PrequalStatus {
  const hasLicense = !!v.license_number
  const hasInsurance = !!v.insurance_expiry
  const hasBonding = v.bonding_capacity != null && v.bonding_capacity > 0
  const hasScore = v.performance_score != null

  const filledCount = [hasLicense, hasInsurance, hasBonding, hasScore].filter(Boolean).length

  if (filledCount === 0) return 'Not Started'
  if (filledCount < 3) return 'In Progress'
  if (filledCount === 3) return 'Submitted'
  // All 4 fields populated
  if (v.performance_score != null && v.performance_score >= 3) return 'Approved'
  if (v.performance_score != null && v.performance_score < 2) return 'Rejected'
  return 'Under Review'
}

/** Derive prequalification section scores from vendor fields (0 = not scored, 1-5 scale) */
function derivePrequalSections(v: Vendor): PrequalSection[] {
  const hasLicense = !!v.license_number
  const hasInsurance = !!v.insurance_expiry
  const insuranceValid = v.insurance_expiry ? new Date(v.insurance_expiry) > new Date() : false
  const hasBonding = v.bonding_capacity != null && v.bonding_capacity > 0
  const score = v.performance_score

  return [
    { label: 'Company Info', score: (v.contact_name && v.email) ? 4 : (v.contact_name || v.email) ? 2 : 0 },
    { label: 'Financial Stability', score: hasBonding ? 4 : 0 },
    { label: 'Experience', score: score != null ? Math.min(5, Math.round(score)) : 0 },
    { label: 'Safety Record', score: hasLicense ? 3 : 0 },
    { label: 'Insurance', score: hasInsurance ? (insuranceValid ? 5 : 2) : 0 },
    { label: 'References', score: 0 }, // No reference data in DB yet
  ]
}

/** Build a PrequalRecord from a real Vendor */
function vendorToPrequalRecord(v: Vendor): PrequalRecord {
  const sections = derivePrequalSections(v)
  const scored = sections.filter((s) => s.score > 0)
  const overallScore = scored.length > 0 ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length : 0

  return {
    vendorId: v.id,
    vendorName: v.company_name,
    status: derivePrequalStatus(v),
    sections,
    overallScore,
    companyYears: 0, // Not tracked in DB
    annualRevenue: '',
    bondingCapacity: v.bonding_capacity ? `$${(v.bonding_capacity / 100).toLocaleString()}` : '',
    bankRef: '',
    largestProject: '',
    emr: 0,
    trir: 0,
    oshaCitations: 0,
    glLimit: '',
    autoLimit: '',
    wcLimit: '',
    umbrellaLimit: v.insurance_expiry ? 'On file' : '',
    references: [],
  }
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
  const updateVendor = useUpdateVendor()
  const deleteVendor = useDeleteVendor()

  const handleDelete = async (vendor: Vendor, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${vendor.company_name}"? This cannot be undone.`)) return
    try {
      await deleteVendor.mutateAsync({ id: vendor.id })
      toast.success('Vendor deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete vendor')
    }
  }

  const handleStatusChange = async (vendor: Vendor, status: Vendor['status'], e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation()
    try {
      await updateVendor.mutateAsync({ id: vendor.id, updates: { status } })
      toast.success('Vendor updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update vendor')
    }
  }

  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)
  const [editVendorForm, setEditVendorForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '', trade: '',
    license_number: '', insurance_expiry: '', bonding_capacity: '',
    status: 'active' as Vendor['status'], notes: '',
  })
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<Vendor['status'] | ''>('')
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [riskOpen, setRiskOpen] = useState(false)
  const [evalOpen, setEvalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'vendors' | 'prequalification' | 'diversity' | 'bidlists'>('vendors')
  const [selectedPrequal, setSelectedPrequal] = useState<PrequalRecord | null>(null)
  const [selectedBidList, setSelectedBidList] = useState<BidList | null>(null)
  const [bidListModalOpen, setBidListModalOpen] = useState(false)
  const [bidLists, setBidLists] = useState<BidList[]>([])
  const [bidListForm, setBidListForm] = useState({ name: '', scope: '', selectedVendorIds: [] as string[] })

  const openEditVendor = (v: Vendor, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditVendorForm({
      company_name: v.company_name ?? '',
      contact_name: v.contact_name ?? '',
      email: v.email ?? '',
      phone: v.phone ?? '',
      trade: v.trade ?? '',
      license_number: v.license_number ?? '',
      insurance_expiry: v.insurance_expiry ?? '',
      bonding_capacity: v.bonding_capacity ? String(v.bonding_capacity / 100) : '',
      status: v.status,
      notes: v.notes ?? '',
    })
    setEditVendor(v)
    setEditModalOpen(true)
  }

  const handleEditVendorSave = async () => {
    if (!editVendor) return
    try {
      await updateVendor.mutateAsync({
        id: editVendor.id,
        updates: {
          company_name: editVendorForm.company_name || null,
          contact_name: editVendorForm.contact_name || null,
          email: editVendorForm.email || null,
          phone: editVendorForm.phone || null,
          trade: editVendorForm.trade || null,
          license_number: editVendorForm.license_number || null,
          insurance_expiry: editVendorForm.insurance_expiry || null,
          bonding_capacity: editVendorForm.bonding_capacity ? Math.round(parseFloat(editVendorForm.bonding_capacity) * 100) : null,
          status: editVendorForm.status,
          notes: editVendorForm.notes || null,
        },
      })
      toast.success('Vendor updated')
      setEditModalOpen(false)
      setEditVendor(null)
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

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

  /* ── Derived prequalification records from real vendor data ── */
  const prequalRecords = useMemo(() => {
    return (vendors ?? []).map(vendorToPrequalRecord)
  }, [vendors])

  /* ── Derived diversity goals with actual percentages from vendor data ── */
  const diversityGoals = useMemo(() => {
    // Since there is no diversity_certification column in the vendors table yet,
    // actual percentages are 0. When a certification_type field is added to
    // the vendors table, this computation will populate real numbers.
    const _list = vendors ?? []
    const _totalValue = _list.reduce((sum, v) => sum + (v.bonding_capacity ?? 0), 0)

    return DIVERSITY_GOAL_TARGETS.map((g) => ({
      category: g.category,
      targetPct: g.targetPct,
      actualPct: 0, // No certification type data in DB yet
    }))
  }, [vendors])

  /* ── Derived vendor diversity records from real vendor data ── */
  const vendorDiversityRecords = useMemo((): VendorDiversity[] => {
    // No diversity certification data in DB yet — return empty
    // When a diversity_certifications table or certification_type column
    // is added, this will derive real VendorDiversity records.
    return []
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
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)} data-testid="create-vendor-button">Add Vendor</Btn>
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

          {/* ── Tab Navigation ──────────────────────────── */}
          <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['4'], borderBottom: `1px solid ${colors.borderLight}`, paddingBottom: spacing['1'] }}>
            {([
              { key: 'vendors' as const, label: 'Vendors', icon: <Users size={14} /> },
              { key: 'prequalification' as const, label: 'Prequalification', icon: <ClipboardCheck size={14} /> },
              { key: 'diversity' as const, label: 'DBE/MBE/WBE', icon: <Award size={14} /> },
              { key: 'bidlists' as const, label: 'Bid Lists', icon: <Mail size={14} /> },
            ]).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['2']} ${spacing['3']}`,
                border: 'none', borderBottom: activeTab === tab.key ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: typography.fontSize.sm,
                color: activeTab === tab.key ? colors.primaryOrange : colors.textSecondary,
                fontWeight: activeTab === tab.key ? typography.fontWeight.medium : typography.fontWeight.normal,
              }}>{tab.icon} {tab.label}</button>
            ))}
          </div>

          {activeTab === 'vendors' && <Card padding={spacing['4']}>
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
                  const now = new Date()
                  const expiry = v.insurance_expiry ? new Date(v.insurance_expiry) : null
                  const expired = expiry ? expiry < now : false
                  const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
                  const expiringSoon = !expired && daysToExpiry != null && daysToExpiry <= 30
                  const insuranceColor = expired ? colors.statusCritical : expiringSoon ? colors.statusPending : colors.textSecondary
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
                        <PermissionGate permission="directory.manage" fallback={
                          <span style={{
                            padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                            color: palette.c, backgroundColor: palette.bg,
                          }}>{v.status}</span>
                        }>
                          <select
                            value={v.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStatusChange(v, e.target.value as Vendor['status'], e)}
                            aria-label="Change vendor status"
                            data-testid="edit-vendor-status"
                            style={{
                              padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                              color: palette.c, backgroundColor: palette.bg,
                              border: 'none', cursor: 'pointer',
                            }}
                          >
                            <option value="active">active</option>
                            <option value="probation">probation</option>
                            <option value="suspended">suspended</option>
                            <option value="blacklisted">blacklisted</option>
                          </select>
                        </PermissionGate>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <Stars value={v.performance_score} />
                        <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>
                          {v.performance_score != null ? v.performance_score.toFixed(1) : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.caption, color: insuranceColor }}>
                        {expired || expiringSoon ? <ShieldAlert size={14} /> : <Shield size={14} />}
                        Insurance: {v.insurance_expiry ? `exp ${new Date(v.insurance_expiry).toLocaleDateString()}` : '—'}
                        {expired && <span style={{ fontWeight: typography.fontWeight.medium }}>· expired</span>}
                        {expiringSoon && <span style={{ fontWeight: typography.fontWeight.medium }}>· {daysToExpiry}d left</span>}
                      </div>
                      {v.email && <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{v.email}</div>}
                      <PermissionGate permission="directory.manage">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['1'] }}>
                          <Btn
                            size="sm"
                            variant="secondary"
                            onClick={(e) => openEditVendor(v, e)}
                          >
                            Edit
                          </Btn>
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleDelete(v, e)}
                            disabled={deleteVendor.isPending}
                            aria-label={`Delete ${v.company_name}`}
                            data-testid="delete-vendor-button"
                          >
                            {deleteVendor.isPending ? 'Deleting…' : 'Delete'}
                          </Btn>
                        </div>
                      </PermissionGate>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>}

          {/* ── Prequalification Tab ───────────────────── */}
          {activeTab === 'prequalification' && (
            <Card padding={spacing['4']}>
              <SectionHeader title="Vendor Prequalification" />
              <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm, marginBottom: spacing['4'] }}>
                Track vendor prequalification questionnaires across Company Info, Financial Stability, Experience, Safety Record, Insurance, and References.
              </div>
              {prequalRecords.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck size={48} />}
                  title="No prequalification data"
                  description="Add vendors with license, insurance, and bonding information to see prequalification status derived automatically."
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: spacing['3'] }}>
                  {prequalRecords.map((pq) => {
                    const palette = PREQUAL_STATUS_COLORS[pq.status]
                    return (
                      <div key={pq.vendorId} onClick={() => setSelectedPrequal(pq)} style={{
                        padding: spacing['3'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base,
                        cursor: 'pointer', backgroundColor: colors.surfaceFlat, display: 'flex', flexDirection: 'column', gap: spacing['2'],
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{pq.vendorName}</span>
                          <span style={{ padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: palette.c, backgroundColor: palette.bg }}>{pq.status}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Overall Score:</span>
                          <span style={{ fontWeight: typography.fontWeight.semibold, color: pq.overallScore >= 4 ? colors.statusActive : pq.overallScore >= 3 ? colors.statusPending : colors.textTertiary, fontSize: typography.fontSize.sm }}>
                            {pq.overallScore > 0 ? `${pq.overallScore.toFixed(1)} / 5.0` : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: spacing['1'], flexWrap: 'wrap' }}>
                          {pq.sections.map((s) => (
                            <div key={s.label} title={`${s.label}: ${s.score}/5`} style={{
                              width: 28, height: 6, borderRadius: borderRadius.full,
                              backgroundColor: s.score >= 4 ? colors.statusActive : s.score >= 2 ? colors.statusPending : colors.borderLight,
                            }} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ── DBE/MBE/WBE Diversity Tab ──────────────── */}
          {activeTab === 'diversity' && (
            <Card padding={spacing['4']}>
              <SectionHeader title="Diversity Certification Tracking" />
              {/* Summary dashboard */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing['3'], marginBottom: spacing['4'] }}>
                <div style={{ padding: spacing['3'], borderRadius: borderRadius.base, backgroundColor: colors.statusActiveSubtle, border: `1px solid ${colors.statusActive}` }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.statusActive }}>Total Diverse Spend</div>
                  <div style={{ fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>
                    ${(vendorDiversityRecords.filter((d) => d.certs.length > 0).reduce((s, d) => s + d.totalContractValue, 0) / 1e6).toFixed(1)}M
                  </div>
                </div>
                <div style={{ padding: spacing['3'], borderRadius: borderRadius.base, backgroundColor: colors.statusInfoSubtle, border: `1px solid ${colors.statusInfo}` }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.statusInfo }}>% of Total Contract Value</div>
                  <div style={{ fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo }}>
                    {(() => { const total = vendorDiversityRecords.reduce((s, d) => s + d.totalContractValue, 0); const diverse = vendorDiversityRecords.filter((d) => d.certs.length > 0).reduce((s, d) => s + d.totalContractValue, 0); return total > 0 ? ((diverse / total * 100).toFixed(1) + '%') : '0%' })()}
                  </div>
                </div>
                <div style={{ padding: spacing['3'], borderRadius: borderRadius.base, backgroundColor: colors.orangeSubtle, border: `1px solid ${colors.primaryOrange}` }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.orangeText }}>Certified Vendors</div>
                  <div style={{ fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>
                    {vendorDiversityRecords.filter((d) => d.certs.length > 0).length} / {vendorDiversityRecords.length}
                  </div>
                </div>
              </div>
              {/* Goal tracker */}
              <div style={{ marginBottom: spacing['4'] }}>
                <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontSize: typography.fontSize.sm, marginBottom: spacing['2'] }}>Project Diversity Goals</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: spacing['2'] }}>
                  {diversityGoals.map((g) => (
                    <div key={g.category} style={{ padding: spacing['2'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, backgroundColor: colors.surfaceFlat }}>
                      <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>{g.category}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.caption }}>
                        <span style={{ color: colors.textSecondary }}>Target: {g.targetPct}%</span>
                        <span style={{ color: g.actualPct >= g.targetPct ? colors.statusActive : colors.statusCritical, fontWeight: typography.fontWeight.medium }}>{g.actualPct}%</span>
                      </div>
                      <div style={{ marginTop: spacing['1'], height: 4, backgroundColor: colors.borderLight, borderRadius: borderRadius.full, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, g.targetPct > 0 ? (g.actualPct / g.targetPct) * 100 : 0)}%`, backgroundColor: g.actualPct >= g.targetPct ? colors.statusActive : colors.statusPending, borderRadius: borderRadius.full }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Per-vendor certifications */}
              <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontSize: typography.fontSize.sm, marginBottom: spacing['2'] }}>Vendor Certifications</div>
              {vendorDiversityRecords.length === 0 ? (
                <EmptyState
                  icon={<Award size={48} />}
                  title="No diversity certifications on file"
                  description="Diversity certification tracking will appear here once a certification_type field is added to the vendors table or a dedicated diversity_certifications table is created."
                />
              ) : (
                vendorDiversityRecords.map((vd) => (
                  <div key={vd.vendorName} style={{ padding: spacing['3'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, marginBottom: spacing['2'], backgroundColor: colors.surfaceFlat }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: vd.certs.length > 0 ? spacing['2'] : '0' }}>
                      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{vd.vendorName}</span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>${(vd.totalContractValue / 1e6).toFixed(2)}M</span>
                    </div>
                    {vd.certs.length === 0 ? (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>No diversity certifications on file</span>
                    ) : (
                      <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
                        {vd.certs.map((cert) => (
                          <div key={cert.certNumber} style={{ padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, fontSize: typography.fontSize.caption, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                            {cert.verified ? <CheckCircle size={12} color={colors.statusActive} /> : <Clock size={12} color={colors.statusPending} />}
                            <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{cert.type}</span>
                            <span style={{ color: colors.textTertiary }}>#{cert.certNumber}</span>
                            <span style={{ color: colors.textSecondary }}>exp {new Date(cert.expiry).toLocaleDateString()}</span>
                            <span style={{ color: colors.textTertiary }}>({cert.agency})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </Card>
          )}

          {/* ── Bid Lists Tab ──────────────────────────── */}
          {activeTab === 'bidlists' && (
            <Card padding={spacing['4']}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
                <SectionHeader title="Bid Invitation Lists" />
                <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setBidListModalOpen(true)}>New Bid List</Btn>
              </div>

              {bidLists.length === 0 ? (
                <EmptyState
                  icon={<Mail size={48} />}
                  title="No bid lists yet"
                  description="Create a bid invitation list to invite qualified vendors to respond to project scopes. Select vendors by trade to build your invite list."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                  {bidLists.map(bl => (
                    <div key={bl.id} style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, padding: spacing['4'], cursor: 'pointer', transition: 'border-color 0.2s' }}
                      onClick={() => setSelectedBidList(bl)}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = colors.primaryOrange }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = colors.borderSubtle }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] }}>
                        <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{bl.name}</span>
                        <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{bl.createdDate}</span>
                      </div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['2'] }}>{bl.scope}</div>
                      <div style={{ display: 'flex', gap: spacing['3'], fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                        <span>{bl.invites.length} vendor{bl.invites.length !== 1 ? 's' : ''} invited</span>
                        <span>{bl.invites.filter(i => i.response === 'Yes').length} responded Yes</span>
                        <span>{bl.invites.filter(i => i.response === 'Pending').length} pending</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bid List Detail */}
              {selectedBidList && (
                <div style={{ marginTop: spacing['4'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, padding: spacing['4'] }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                    <div>
                      <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{selectedBidList.name}</div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{selectedBidList.scope}</div>
                    </div>
                    <Btn variant="ghost" size="sm" onClick={() => setSelectedBidList(null)}>Close</Btn>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                    {selectedBidList.invites.map((inv, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} ${spacing['3']}`, background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                        <div>
                          <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{inv.vendorName}</div>
                          <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{inv.trade} · {inv.contact}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          {inv.bidAmount != null && <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>${inv.bidAmount.toLocaleString()}</span>}
                          <span style={{ padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: BID_RESPONSE_COLORS[inv.response].c, background: BID_RESPONSE_COLORS[inv.response].bg }}>{inv.response}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
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

      {/* ── Prequalification Detail Modal ─────────── */}
      {selectedPrequal && (
        <Modal open={!!selectedPrequal} onClose={() => setSelectedPrequal(null)} title={`Prequal: ${selectedPrequal.vendorName}`} width="720px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Status: <span style={{ color: PREQUAL_STATUS_COLORS[selectedPrequal.status].c, fontWeight: typography.fontWeight.medium }}>{selectedPrequal.status}</span></span>
              <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: selectedPrequal.overallScore >= 4 ? colors.statusActive : colors.statusPending }}>{selectedPrequal.overallScore > 0 ? `${selectedPrequal.overallScore.toFixed(1)} / 5.0` : 'Not Scored'}</span>
            </div>
            {/* Section scores */}
            <SectionHeader title="Section Scores" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
              {selectedPrequal.sections.map((s) => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: spacing['2'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{s.label}</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={14} fill={i <= s.score ? colors.orangeText : 'none'} color={i <= s.score ? colors.orangeText : colors.textTertiary} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Financial & Experience */}
            <SectionHeader title="Financial Stability" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <div><span style={{ color: colors.textSecondary }}>Annual Revenue: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.annualRevenue || '—'}</span></div>
              <div><span style={{ color: colors.textSecondary }}>Bonding Capacity: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.bondingCapacity || '—'}</span></div>
              <div><span style={{ color: colors.textSecondary }}>Bank Reference: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.bankRef || '—'}</span></div>
              <div><span style={{ color: colors.textSecondary }}>Years in Business: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.companyYears > 0 ? selectedPrequal.companyYears : '—'}</span></div>
            </div>
            <SectionHeader title="Safety Record" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <div><span style={{ color: colors.textSecondary }}>EMR: </span><span style={{ color: selectedPrequal.emr > 0 && selectedPrequal.emr <= 1.0 ? colors.statusActive : selectedPrequal.emr > 1.0 ? colors.statusPending : colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{selectedPrequal.emr > 0 ? selectedPrequal.emr.toFixed(2) : '—'}</span></div>
              <div><span style={{ color: colors.textSecondary }}>TRIR: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.trir > 0 ? selectedPrequal.trir.toFixed(1) : '—'}</span></div>
              <div><span style={{ color: colors.textSecondary }}>OSHA Citations: </span><span style={{ color: selectedPrequal.oshaCitations > 0 ? colors.statusCritical : colors.statusActive, fontWeight: typography.fontWeight.medium }}>{selectedPrequal.oshaCitations}</span></div>
            </div>
            <SectionHeader title="Insurance Limits" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
              <div><span style={{ color: colors.textSecondary }}>General Liability: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.glLimit || '—'}</span></div>
              <div><span style={{ color: colors.textSecondary }}>Auto: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.autoLimit || '—'}</span></div>
              <div><span style={{ color: colors.textSecondary }}>Workers Comp: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.wcLimit || '—'}</span></div>
              <div><span style={{ color: colors.textSecondary }}>Umbrella: </span><span style={{ color: colors.textPrimary }}>{selectedPrequal.umbrellaLimit || '—'}</span></div>
            </div>
            {selectedPrequal.references.length > 0 && (
              <>
                <SectionHeader title="Project References" />
                {selectedPrequal.references.map((ref, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: spacing['2'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm }}>
                    <span style={{ color: colors.textPrimary }}>{ref.project}</span>
                    <span style={{ color: colors.textSecondary }}>{ref.contact} — {ref.phone}</span>
                  </div>
                ))}
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing['2'] }}>
              <Btn variant="secondary" onClick={() => setSelectedPrequal(null)}>Close</Btn>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={editModalOpen} onClose={() => { setEditModalOpen(false); setEditVendor(null) }} title="Edit Vendor" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Company Name" value={editVendorForm.company_name} onChange={(v) => setEditVendorForm({ ...editVendorForm, company_name: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Contact Name" value={editVendorForm.contact_name} onChange={(v) => setEditVendorForm({ ...editVendorForm, contact_name: v })} />
            <InputField label="Trade" value={editVendorForm.trade} onChange={(v) => setEditVendorForm({ ...editVendorForm, trade: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Email" value={editVendorForm.email} onChange={(v) => setEditVendorForm({ ...editVendorForm, email: v })} />
            <InputField label="Phone" value={editVendorForm.phone} onChange={(v) => setEditVendorForm({ ...editVendorForm, phone: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="License #" value={editVendorForm.license_number} onChange={(v) => setEditVendorForm({ ...editVendorForm, license_number: v })} />
            <InputField label="Insurance Expiry" type="date" value={editVendorForm.insurance_expiry} onChange={(v) => setEditVendorForm({ ...editVendorForm, insurance_expiry: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Bonding Capacity ($)" value={editVendorForm.bonding_capacity} onChange={(v) => setEditVendorForm({ ...editVendorForm, bonding_capacity: v })} />
            <div>
              <label style={labelStyle}>Status</label>
              <select value={editVendorForm.status} onChange={(e) => setEditVendorForm({ ...editVendorForm, status: e.target.value as Vendor['status'] })} style={selectStyle}>
                <option value="active">Active</option>
                <option value="probation">Probation</option>
                <option value="suspended">Suspended</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={editVendorForm.notes} onChange={(e) => setEditVendorForm({ ...editVendorForm, notes: e.target.value })} rows={2} style={textareaStyle} />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => { setEditModalOpen(false); setEditVendor(null) }}>Cancel</Btn>
            <Btn variant="primary" onClick={handleEditVendorSave} loading={updateVendor.isPending}>{updateVendor.isPending ? 'Saving...' : 'Save'}</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Create Bid List Modal ── */}
      <Modal open={bidListModalOpen} onClose={() => { setBidListModalOpen(false); setBidListForm({ name: '', scope: '', selectedVendorIds: [] }) }} title="Create Bid Invitation List" width="680px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Bid List Name" value={bidListForm.name} onChange={(v) => setBidListForm({ ...bidListForm, name: v })} placeholder="e.g. Electrical – Building A" />
          <InputField label="Scope Description" value={bidListForm.scope} onChange={(v) => setBidListForm({ ...bidListForm, scope: v })} placeholder="Describe the work scope for this bid invitation" />

          <div>
            <label style={labelStyle}>Select Vendors to Invite ({bidListForm.selectedVendorIds.length} selected)</label>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, padding: spacing['2'] }}>
              {(vendors ?? []).filter(v => v.status === 'active').length === 0 ? (
                <div style={{ padding: spacing['3'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>No active vendors available</div>
              ) : (
                (vendors ?? []).filter(v => v.status === 'active').map(v => {
                  const isSelected = bidListForm.selectedVendorIds.includes(v.id)
                  return (
                    <div key={v.id}
                      onClick={() => setBidListForm(prev => ({
                        ...prev,
                        selectedVendorIds: isSelected
                          ? prev.selectedVendorIds.filter(id => id !== v.id)
                          : [...prev.selectedVendorIds, v.id]
                      }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`,
                        borderRadius: borderRadius.md, cursor: 'pointer', marginBottom: 2,
                        background: isSelected ? colors.orangeSubtle : 'transparent',
                        border: `1px solid ${isSelected ? colors.primaryOrange : 'transparent'}`,
                      }}
                    >
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? colors.primaryOrange : colors.borderDefault}`, background: isSelected ? colors.primaryOrange : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSelected && <CheckCircle size={12} color="#fff" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{v.company_name}</div>
                        <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{v.trade || 'No trade'} · {v.contact_name || 'No contact'}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => { setBidListModalOpen(false); setBidListForm({ name: '', scope: '', selectedVendorIds: [] }) }}>Cancel</Btn>
            <Btn variant="primary" icon={<Send size={14} />} onClick={() => {
              if (!bidListForm.name.trim()) { toast.error('Bid list name is required'); return }
              if (bidListForm.selectedVendorIds.length === 0) { toast.error('Select at least one vendor'); return }
              const newBidList: BidList = {
                id: crypto.randomUUID(),
                name: bidListForm.name,
                scope: bidListForm.scope,
                createdDate: new Date().toISOString().slice(0, 10),
                invites: bidListForm.selectedVendorIds.map(vid => {
                  const v = (vendors ?? []).find(vn => vn.id === vid)
                  return {
                    vendorName: v?.company_name ?? 'Unknown',
                    trade: v?.trade ?? '',
                    contact: v?.email ?? v?.contact_name ?? '',
                    invitedDate: new Date().toISOString().slice(0, 10),
                    response: 'Pending' as BidResponse,
                    bidAmount: null,
                  }
                }),
              }
              setBidLists(prev => [newBidList, ...prev])
              setBidListModalOpen(false)
              setBidListForm({ name: '', scope: '', selectedVendorIds: [] })
              toast.success(`Bid list "${newBidList.name}" created with ${newBidList.invites.length} vendor${newBidList.invites.length > 1 ? 's' : ''}`)
            }}>
              Create & Send Invitations
            </Btn>
          </div>
        </div>
      </Modal>
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
