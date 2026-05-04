import React, { useState, useMemo, useCallback } from 'react'
import {
  Package, Plus, Award, Sparkles, AlertTriangle, FileText, BarChart2,
  Users, Send, CheckCircle, XCircle, Clock, ChevronRight, Search,
  Filter, Calendar, DollarSign, TrendingUp, Eye, Trash2, Edit3,
  UserPlus, Building2, Phone, Mail, Star, Shield, ArrowUpDown,
  Layers, Target, HelpCircle, ChevronDown, Check, X, Minus,
  AlertCircle, Hash, Timer, Activity
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { useOrganization } from '../hooks/useOrganization'
import { toast } from 'sonner'
import {
  usePreconBidPackages,
  useCreatePreconBidPackage,
  useUpdatePreconBidPackage,
  usePreconBidSubmissions,
  useAllPreconBidSubmissions,
  useCreatePreconBidSubmission,
  type PreconBidPackage,
  type PreconBidSubmission,
} from '../hooks/queries/precon-enterprise'
import {
  usePreconSubcontractors,
  useCreatePreconSubcontractor,
  useUpdatePreconSubcontractor,
  usePreconBidInvitations,
  useCreatePreconBidInvitation,
  useUpdatePreconBidInvitation,
  usePreconScopeItems,
  useCreatePreconScopeItem,
  useDeletePreconScopeItem,
  usePreconBidScopeResponses,
  useUpsertPreconBidScopeResponse,
  useDeletePreconBidPackage,
  useUpdatePreconBidSubmission,
  type PreconSubcontractor,
  type PreconBidInvitation,
  type PreconScopeItem,
  type PreconBidScopeResponse,
} from '../hooks/queries/precon-extended'
import { useCreateContract } from '../hooks/queries/enterprise-modules'

// ── Types ─────────────────────────────────────────────────

interface AIAnalysisResult {
  bids: PreconBidSubmission[]
  avg: number
  median: number
  spread: number
  variancePct: number
  stdDev: number
  coeffVar: number
  unusuallyLow: PreconBidSubmission[]
  unusuallyHigh: PreconBidSubmission[]
  insights: { type: 'warning' | 'info' | 'success'; text: string }[]
  lowest: PreconBidSubmission
  highest: PreconBidSubmission
}

// ── Constants ─────────────────────────────────────────────

type ViewKey = 'dashboard' | 'packages' | 'leveling' | 'subs'

const VIEWS: { key: ViewKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Activity },
  { key: 'packages', label: 'Bid Packages', icon: Package },
  { key: 'leveling', label: 'Bid Leveling', icon: Layers },
  { key: 'subs', label: 'Subcontractors', icon: Building2 },
]

const CSI_DIVISIONS: { code: number; label: string }[] = [
  { code: 1, label: '01 — General Requirements' },
  { code: 2, label: '02 — Existing Conditions' },
  { code: 3, label: '03 — Concrete' },
  { code: 4, label: '04 — Masonry' },
  { code: 5, label: '05 — Metals' },
  { code: 6, label: '06 — Wood & Plastics' },
  { code: 7, label: '07 — Thermal & Moisture' },
  { code: 8, label: '08 — Openings' },
  { code: 9, label: '09 — Finishes' },
  { code: 10, label: '10 — Specialties' },
  { code: 11, label: '11 — Equipment' },
  { code: 12, label: '12 — Furnishings' },
  { code: 13, label: '13 — Special Construction' },
  { code: 14, label: '14 — Conveying Equipment' },
  { code: 21, label: '21 — Fire Suppression' },
  { code: 22, label: '22 — Plumbing' },
  { code: 23, label: '23 — HVAC' },
  { code: 26, label: '26 — Electrical' },
  { code: 27, label: '27 — Communications' },
  { code: 31, label: '31 — Earthwork' },
  { code: 32, label: '32 — Exterior Improvements' },
  { code: 33, label: '33 — Utilities' },
]

const SCOPE_CATEGORIES = ['Labor', 'Material', 'Equipment', 'Subcontractor', 'General Conditions', 'Other']

const STATUS_CONFIG: Record<string, { c: string; bg: string; icon: React.ElementType }> = {
  draft: { c: colors.textTertiary, bg: colors.surfaceInset, icon: Edit3 },
  issued: { c: colors.statusInfo, bg: colors.statusInfoSubtle, icon: Send },
  receiving_bids: { c: colors.statusPending, bg: colors.statusPendingSubtle, icon: Clock },
  evaluating: { c: colors.statusReview, bg: colors.statusReviewSubtle, icon: Eye },
  awarded: { c: colors.statusActive, bg: colors.statusActiveSubtle, icon: Award },
  cancelled: { c: colors.statusCritical, bg: colors.statusCriticalSubtle, icon: XCircle },
}

const INV_STATUS_CONFIG: Record<string, { c: string; bg: string }> = {
  invited: { c: colors.statusInfo, bg: colors.statusInfoSubtle },
  viewed: { c: colors.statusPending, bg: colors.statusPendingSubtle },
  bidding: { c: colors.statusReview, bg: colors.statusReviewSubtle },
  declined: { c: colors.statusCritical, bg: colors.statusCriticalSubtle },
  submitted: { c: colors.statusActive, bg: colors.statusActiveSubtle },
  no_response: { c: colors.textTertiary, bg: colors.surfaceInset },
}

// ── Helpers ───────────────────────────────────────────────

const fmt = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const daysUntil = (d: string | null) => {
  if (!d) return null
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  return diff
}

// ── Shared Micro-Components ───────────────────────────────

function Pill({ value, palette }: { value: string; palette?: { c: string; bg: string } }) {
  const p = palette || STATUS_CONFIG[value] || { c: colors.textTertiary, bg: colors.surfaceInset }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color: p.c, backgroundColor: p.bg, whiteSpace: 'nowrap',
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: p.c }} />
      {value.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
    </span>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ height: 6, borderRadius: borderRadius.full, backgroundColor: colors.surfaceInset, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: borderRadius.full, backgroundColor: color, transition: `width ${transitions.smooth}` }} />
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      padding: spacing['4'], backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg, boxShadow: shadows.card,
    }}>
      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, fontWeight: typography.fontWeight.medium }}>{label}</div>
      <div style={{ fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, color: color || colors.textPrimary, letterSpacing: typography.letterSpacing.tight }}>{value}</div>
      {sub && <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>{sub}</div>}
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
      <Search size={14} style={{ position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        style={{
          width: '100%', padding: `${spacing['2']} ${spacing['3']} ${spacing['2']} ${spacing['8']}`,
          borderRadius: borderRadius.base, border: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceRaised, color: colors.textPrimary,
          fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
          outline: 'none',
        }}
      />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────

export const Preconstruction: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [pkgModalOpen, setPkgModalOpen] = useState(false)
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [bidModalOpen, setBidModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [scopeModalOpen, setScopeModalOpen] = useState(false)
  const [subDetailId, setSubDetailId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const projectId = useProjectId()
  const { user } = useAuth()
  const { currentOrg } = useOrganization()
  const orgId = currentOrg?.id

  // ── Data Queries ──────────────────────────────────────

  const { data: packages, isLoading: packagesLoading } = usePreconBidPackages(projectId ?? undefined)
  const { data: allSubs } = useAllPreconBidSubmissions(projectId ?? undefined)
  const { data: selectedSubs } = usePreconBidSubmissions(selectedPackageId ?? undefined)
  const { data: subcontractors } = usePreconSubcontractors(orgId)
  const { data: invitations } = usePreconBidInvitations(selectedPackageId ?? undefined)
  const { data: scopeItems } = usePreconScopeItems(selectedPackageId ?? undefined)
  const { data: scopeResponses } = usePreconBidScopeResponses(selectedPackageId ?? undefined)

  // ── Mutations ─────────────────────────────────────────

  const createPackage = useCreatePreconBidPackage()
  const updatePackage = useUpdatePreconBidPackage()
  const deletePackage = useDeletePreconBidPackage()
  const createSubmission = useCreatePreconBidSubmission()
  const updateSubmission = useUpdatePreconBidSubmission()
  const createContract = useCreateContract()
  const createSubcontractor = useCreatePreconSubcontractor()
  const updateSubcontractor = useUpdatePreconSubcontractor()
  const createInvitation = useCreatePreconBidInvitation()
  const updateInvitation = useUpdatePreconBidInvitation()
  const createScopeItem = useCreatePreconScopeItem()
  const deleteScopeItem = useDeletePreconScopeItem()
  const upsertScopeResponse = useUpsertPreconBidScopeResponse()

  // ── Derived Data ──────────────────────────────────────

  const packageList = packages ?? []
  const allSubmissions = allSubs ?? []
  const subList = subcontractors ?? []
  const invitationList = invitations ?? []
  const scopeItemList = scopeItems ?? []
  const scopeResponseList = scopeResponses ?? []
  const selectedSubmissions = selectedSubs ?? []

  const selectedPackage = useMemo(
    () => packageList.find((p) => p.id === selectedPackageId) || null,
    [packageList, selectedPackageId]
  )

  // Dashboard metrics
  const metrics = useMemo(() => {
    const total = packageList.length
    const inMarket = packageList.filter((p) => ['issued', 'receiving_bids', 'evaluating'].includes(p.status)).length
    const awarded = packageList.filter((p) => p.status === 'awarded').length
    const totalEstimated = packageList.reduce((s, p) => s + (p.estimated_value || 0), 0)
    const totalAwarded = packageList.filter((p) => p.status === 'awarded').reduce((s, p) => s + (p.awarded_amount || 0), 0)
    const subsReceived = allSubmissions.length
    const avgBidsPerPkg = total > 0 ? Math.round(subsReceived / total * 10) / 10 : 0

    // Find nearest due date
    const upcomingDue = packageList
      .filter((p) => p.bid_due_date && ['issued', 'receiving_bids'].includes(p.status))
      .map((p) => ({ pkg: p, days: daysUntil(p.bid_due_date) }))
      .filter((d) => d.days !== null && d.days >= 0)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

    // Coverage: packages with at least 3 bids
    const wellCovered = packageList.filter((p) => {
      const bids = allSubmissions.filter((s) => s.bid_package_id === p.id)
      return bids.length >= 3
    }).length

    return {
      total, inMarket, awarded, totalEstimated, totalAwarded,
      subsReceived, avgBidsPerPkg, upcomingDue, wellCovered,
      coveragePct: total > 0 ? Math.round((wellCovered / total) * 100) : 0,
    }
  }, [packageList, allSubmissions])

  // Filter packages
  const filteredPackages = useMemo(() => {
    let filtered = [...packageList]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.package_number.toLowerCase().includes(q) ||
        (p.trade || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }
    return filtered
  }, [packageList, searchQuery, statusFilter])

  // AI analysis for selected package
  const aiAnalysis = useMemo(() => {
    if (!selectedPackage || selectedSubmissions.length === 0) return null
    const bids = [...selectedSubmissions].sort((a, b) => a.bid_amount - b.bid_amount)
    const amounts = bids.map((b) => b.bid_amount)
    const avg = amounts.reduce((s, n) => s + n, 0) / amounts.length
    const median = amounts[Math.floor(amounts.length / 2)]
    const lowest = bids[0]
    const highest = bids[bids.length - 1]
    const spread = highest.bid_amount - lowest.bid_amount
    const variancePct = avg > 0 ? (spread / avg) * 100 : 0
    const stdDev = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length)
    const coeffVar = avg > 0 ? (stdDev / avg) * 100 : 0
    const unusuallyLow = bids.filter((b) => b.bid_amount < avg * 0.75)
    const unusuallyHigh = bids.filter((b) => b.bid_amount > avg * 1.3)

    const insights: { type: 'warning' | 'info' | 'success'; text: string }[] = []

    if (selectedPackage.estimated_value && lowest.bid_amount < selectedPackage.estimated_value * 0.7) {
      insights.push({ type: 'warning', text: `Low bid is >30% below estimate — verify scope completeness and check for potential buy-in pricing.` })
    }
    if (variancePct > 40) {
      insights.push({ type: 'warning', text: `Very high spread (${variancePct.toFixed(0)}%) — likely scope interpretation differences. Request clarifications before leveling.` })
    } else if (variancePct > 25) {
      insights.push({ type: 'info', text: `Moderate spread (${variancePct.toFixed(0)}%) — review scope definitions for ambiguity.` })
    }
    if (unusuallyLow.length > 0) {
      insights.push({ type: 'warning', text: `${unusuallyLow.length} bid(s) >25% below average — check for errors, missing scope, or qualification concerns.` })
    }
    if (unusuallyHigh.length > 0) {
      insights.push({ type: 'info', text: `${unusuallyHigh.length} bid(s) >30% above average — may include extra scope or higher qualifications.` })
    }
    if (bids.length < 3) {
      insights.push({ type: 'warning', text: `Only ${bids.length} bid(s) received — insufficient coverage for competitive leveling. Target 3-5 bids minimum.` })
    }
    if (coeffVar < 10 && bids.length >= 3) {
      insights.push({ type: 'success', text: `Tight clustering (CV: ${coeffVar.toFixed(1)}%) — pricing is competitive and scope interpretation is consistent.` })
    }

    // Scope gap detection
    const excludedCount = scopeResponseList.filter((r) => r.response === 'excluded').length
    if (excludedCount > 0) {
      insights.push({ type: 'warning', text: `${excludedCount} scope exclusion(s) detected across bidders — review leveling matrix for gaps.` })
    }

    return { bids, avg, median, lowest, highest, spread, variancePct, stdDev, coeffVar, unusuallyLow, unusuallyHigh, insights }
  }, [selectedPackage, selectedSubmissions, scopeResponseList])

  // ── Form State ────────────────────────────────────────

  const [pkgForm, setPkgForm] = useState({
    package_number: '', title: '', description: '', csi_division: '',
    trade: '', estimated_value: '', bid_due_date: '',
  })
  const [bidForm, setBidForm] = useState({
    bid_package_id: '', bidder_name: '', bidder_company: '',
    bid_amount: '', notes: '', exclusions: '', inclusions: '',
    qualifications: '', schedule_days: '', bond_included: false,
  })
  const [subForm, setSubForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '',
    primary_trade: '', city: '', state: '', notes: '',
  })
  const [inviteForm, setInviteForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '',
    subcontractor_id: '',
  })
  const [scopeForm, setScopeForm] = useState({ description: '', category: 'General' })

  // ── Handlers ──────────────────────────────────────────

  const handleCreatePackage = async () => {
    if (!projectId || !pkgForm.package_number || !pkgForm.title) {
      toast.error('Package number and title required')
      return
    }
    try {
      const created = await createPackage.mutateAsync({
        project_id: projectId,
        package_number: pkgForm.package_number,
        title: pkgForm.title,
        description: pkgForm.description || null,
        csi_division: pkgForm.csi_division ? parseInt(pkgForm.csi_division, 10) : null,
        trade: pkgForm.trade || null,
        estimated_value: pkgForm.estimated_value ? Math.round(parseFloat(pkgForm.estimated_value) * 100) : 0,
        bid_due_date: pkgForm.bid_due_date || null,
        created_by: user?.id ?? null,
      })
      toast.success('Bid package created')
      setPkgModalOpen(false)
      setPkgForm({ package_number: '', title: '', description: '', csi_division: '', trade: '', estimated_value: '', bid_due_date: '' })
      setSelectedPackageId(created.id)
      setActiveView('packages')
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleCreateBid = async () => {
    const pkgId = bidForm.bid_package_id || selectedPackageId
    if (!pkgId || !bidForm.bidder_name || !bidForm.bid_amount) {
      toast.error('Package, bidder name, and amount required')
      return
    }
    try {
      await createSubmission.mutateAsync({
        bid_package_id: pkgId,
        bidder_name: bidForm.bidder_name,
        bidder_company: bidForm.bidder_company || null,
        bid_amount: Math.round(parseFloat(bidForm.bid_amount) * 100),
        notes: bidForm.notes || null,
      })
      toast.success('Bid recorded')
      setBidModalOpen(false)
      setBidForm({ bid_package_id: '', bidder_name: '', bidder_company: '', bid_amount: '', notes: '', exclusions: '', inclusions: '', qualifications: '', schedule_days: '', bond_included: false })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleAward = async (pkg: PreconBidPackage, sub: PreconBidSubmission) => {
    try {
      await updatePackage.mutateAsync({
        id: pkg.id,
        patch: {
          status: 'awarded',
          awarded_amount: sub.bid_amount,
          awarded_to_company: sub.bidder_company || sub.bidder_name,
        } as Partial<PreconBidPackage>,
      })
      await updateSubmission.mutateAsync({ id: sub.id, patch: { status: 'accepted' } })
      // Reject other bids
      const otherBids = selectedSubmissions.filter((s) => s.id !== sub.id)
      for (const other of otherBids) {
        await updateSubmission.mutateAsync({ id: other.id, patch: { status: 'rejected' } })
      }
      if (projectId) {
        await createContract.mutateAsync({
          project_id: projectId,
          contract_type: 'subcontract',
          title: pkg.title,
          counterparty_name: sub.bidder_company || sub.bidder_name,
          contract_amount: sub.bid_amount,
          scope_of_work: pkg.description,
          status: 'draft',
          created_by: user?.id,
        })
        toast.success('Awarded — subcontract draft created')
      } else {
        toast.success('Bid awarded')
      }
    } catch (err) {
      toast.error('Award failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleCreateSubcontractor = async () => {
    if (!orgId || !subForm.company_name) {
      toast.error('Company name required')
      return
    }
    try {
      await createSubcontractor.mutateAsync({
        organization_id: orgId,
        company_name: subForm.company_name,
        contact_name: subForm.contact_name || null,
        email: subForm.email || null,
        phone: subForm.phone || null,
        primary_trade: subForm.primary_trade || null,
        city: subForm.city || null,
        state: subForm.state || null,
        notes: subForm.notes || null,
      })
      toast.success('Subcontractor added')
      setSubModalOpen(false)
      setSubForm({ company_name: '', contact_name: '', email: '', phone: '', primary_trade: '', city: '', state: '', notes: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleCreateInvitation = async () => {
    if (!selectedPackageId || !inviteForm.company_name) {
      toast.error('Company name required')
      return
    }
    try {
      await createInvitation.mutateAsync({
        bid_package_id: selectedPackageId,
        company_name: inviteForm.company_name,
        contact_name: inviteForm.contact_name || null,
        email: inviteForm.email || null,
        phone: inviteForm.phone || null,
        subcontractor_id: inviteForm.subcontractor_id || null,
      })
      toast.success('Invitation sent')
      setInviteModalOpen(false)
      setInviteForm({ company_name: '', contact_name: '', email: '', phone: '', subcontractor_id: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleAddScopeItem = async () => {
    if (!selectedPackageId || !scopeForm.description) {
      toast.error('Description required')
      return
    }
    try {
      await createScopeItem.mutateAsync({
        bid_package_id: selectedPackageId,
        description: scopeForm.description,
        category: scopeForm.category || null,
        sort_order: scopeItemList.length,
      })
      toast.success('Scope item added')
      setScopeModalOpen(false)
      setScopeForm({ description: '', category: 'General' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleScopeResponse = async (scopeItemId: string, bidSubmissionId: string, response: string) => {
    try {
      await upsertScopeResponse.mutateAsync({
        scope_item_id: scopeItemId,
        bid_submission_id: bidSubmissionId,
        response,
      })
    } catch (err) {
      toast.error('Failed to update scope response')
    }
  }

  const handleStatusChange = async (pkg: PreconBidPackage, newStatus: string) => {
    try {
      await updatePackage.mutateAsync({ id: pkg.id, patch: { status: newStatus } as Partial<PreconBidPackage> })
      toast.success(`Package status updated to ${newStatus.replace(/_/g, ' ')}`)
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const selectPackageAndNavigate = useCallback((pkgId: string, view?: ViewKey) => {
    setSelectedPackageId(pkgId)
    if (view) setActiveView(view)
  }, [])

  // ── Render ────────────────────────────────────────────

  return (
    <PageContainer
      title="Preconstruction"
      subtitle="Bid management, sub tracking, and bid leveling"
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn variant="secondary" icon={<Building2 size={15} />} onClick={() => setSubModalOpen(true)}>Add Sub</Btn>
          <Btn variant="primary" icon={<Plus size={15} />} onClick={() => setPkgModalOpen(true)}>New Package</Btn>
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div style={{
        display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg, padding: spacing['1'], marginBottom: spacing['5'], overflowX: 'auto',
      }}>
        {VIEWS.map((view) => {
          const isActive = activeView === view.key
          return (
            <button
              key={view.key}
              onClick={() => setActiveView(view.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`, border: 'none',
                borderRadius: borderRadius.base, cursor: 'pointer',
                fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`, whiteSpace: 'nowrap',
                boxShadow: isActive ? shadows.sm : 'none',
              }}
            >
              {React.createElement(view.icon, { size: 14 })}
              {view.label}
            </button>
          )
        })}
      </div>

      {packagesLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      ) : (
        <>
          {/* ── DASHBOARD VIEW ─────────────────────────────── */}
          {activeView === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              packageList={packageList}
              allSubmissions={allSubmissions}
              onSelectPackage={selectPackageAndNavigate}
            />
          )}

          {/* ── BID PACKAGES VIEW ──────────────────────────── */}
          {activeView === 'packages' && (
            <PackagesView
              packages={filteredPackages}
              allSubmissions={allSubmissions}
              selectedPackage={selectedPackage}
              selectedPackageId={selectedPackageId}
              selectedSubmissions={selectedSubmissions}
              invitationList={invitationList}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              aiAnalysis={aiAnalysis}
              onSearch={setSearchQuery}
              onFilterStatus={setStatusFilter}
              onSelectPackage={setSelectedPackageId}
              onStatusChange={handleStatusChange}
              onAward={handleAward}
              onAddBid={() => setBidModalOpen(true)}
              onInviteSub={() => setInviteModalOpen(true)}
              onAddScope={() => setScopeModalOpen(true)}
              onNavigateToLeveling={() => { setActiveView('leveling') }}
            />
          )}

          {/* ── BID LEVELING VIEW ──────────────────────────── */}
          {activeView === 'leveling' && (
            <LevelingView
              packageList={packageList}
              selectedPackageId={selectedPackageId}
              selectedPackage={selectedPackage}
              selectedSubmissions={selectedSubmissions}
              scopeItemList={scopeItemList}
              scopeResponseList={scopeResponseList}
              aiAnalysis={aiAnalysis}
              onSelectPackage={setSelectedPackageId}
              onScopeResponse={handleScopeResponse}
              onAddScope={() => setScopeModalOpen(true)}
              onDeleteScope={(id) => deleteScopeItem.mutateAsync(id)}
              onAward={handleAward}
            />
          )}

          {/* ── SUBCONTRACTORS VIEW ────────────────────────── */}
          {activeView === 'subs' && (
            <SubcontractorsView
              subcontractors={subList}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onAddSub={() => setSubModalOpen(true)}
              onSelectSub={setSubDetailId}
              selectedSubId={subDetailId}
              onUpdateSub={(id, patch) => updateSubcontractor.mutateAsync({ id, patch })}
            />
          )}
        </>
      )}

      {/* ── MODALS ────────────────────────────────────────── */}

      {/* New Package Modal */}
      <Modal open={pkgModalOpen} onClose={() => setPkgModalOpen(false)} title="New Bid Package" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: spacing['3'] }}>
            <InputField label="Package #" value={pkgForm.package_number} onChange={(v) => setPkgForm({ ...pkgForm, package_number: v })} placeholder="BP-001" />
            <InputField label="Title" value={pkgForm.title} onChange={(v) => setPkgForm({ ...pkgForm, title: v })} placeholder="Electrical rough-in" />
          </div>
          <div>
            <label style={labelStyle}>Description / Scope Summary</label>
            <textarea value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} rows={3} style={textareaStyle} placeholder="Describe the scope of work for this bid package..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={labelStyle}>CSI Division</label>
              <select value={pkgForm.csi_division} onChange={(e) => setPkgForm({ ...pkgForm, csi_division: e.target.value })} style={selectStyle}>
                <option value="">—</option>
                {CSI_DIVISIONS.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
              </select>
            </div>
            <InputField label="Trade" value={pkgForm.trade} onChange={(v) => setPkgForm({ ...pkgForm, trade: v })} placeholder="Electrical" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Estimated Value ($)" value={pkgForm.estimated_value} onChange={(v) => setPkgForm({ ...pkgForm, estimated_value: v })} placeholder="0.00" />
            <InputField label="Bid Due Date" type="date" value={pkgForm.bid_due_date} onChange={(v) => setPkgForm({ ...pkgForm, bid_due_date: v })} />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setPkgModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreatePackage} loading={createPackage.isPending}>Create Package</Btn>
          </div>
        </div>
      </Modal>

      {/* Record Bid Modal */}
      <Modal open={bidModalOpen} onClose={() => setBidModalOpen(false)} title="Record Bid Submission" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {!selectedPackageId && (
            <div>
              <label style={labelStyle}>Bid Package</label>
              <select value={bidForm.bid_package_id} onChange={(e) => setBidForm({ ...bidForm, bid_package_id: e.target.value })} style={selectStyle}>
                <option value="">— choose —</option>
                {packageList.map((p) => <option key={p.id} value={p.id}>{p.package_number} · {p.title}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Bidder Name" value={bidForm.bidder_name} onChange={(v) => setBidForm({ ...bidForm, bidder_name: v })} placeholder="John Smith" />
            <InputField label="Company" value={bidForm.bidder_company} onChange={(v) => setBidForm({ ...bidForm, bidder_company: v })} placeholder="ABC Electric" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Base Bid ($)" value={bidForm.bid_amount} onChange={(v) => setBidForm({ ...bidForm, bid_amount: v })} placeholder="0.00" />
            <InputField label="Schedule (days)" value={bidForm.schedule_days} onChange={(v) => setBidForm({ ...bidForm, schedule_days: v })} placeholder="90" />
          </div>
          <div>
            <label style={labelStyle}>Exclusions</label>
            <textarea value={bidForm.exclusions} onChange={(e) => setBidForm({ ...bidForm, exclusions: e.target.value })} rows={2} style={textareaStyle} placeholder="List any exclusions from this bid..." />
          </div>
          <div>
            <label style={labelStyle}>Inclusions / Qualifications</label>
            <textarea value={bidForm.qualifications} onChange={(e) => setBidForm({ ...bidForm, qualifications: e.target.value })} rows={2} style={textareaStyle} placeholder="Special qualifications, alternates, or included items..." />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={bidForm.notes} onChange={(e) => setBidForm({ ...bidForm, notes: e.target.value })} rows={2} style={textareaStyle} placeholder="Additional notes..." />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setBidModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateBid} loading={createSubmission.isPending}>Record Bid</Btn>
          </div>
        </div>
      </Modal>

      {/* Invite Subcontractor Modal */}
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} title="Invite Subcontractor to Bid" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {subList.length > 0 && (
            <div>
              <label style={labelStyle}>Select from Sub Database</label>
              <select
                value={inviteForm.subcontractor_id}
                onChange={(e) => {
                  const sub = subList.find((s) => s.id === e.target.value)
                  if (sub) {
                    setInviteForm({
                      ...inviteForm,
                      subcontractor_id: sub.id,
                      company_name: sub.company_name,
                      contact_name: sub.contact_name || '',
                      email: sub.email || '',
                      phone: sub.phone || '',
                    })
                  } else {
                    setInviteForm({ ...inviteForm, subcontractor_id: '' })
                  }
                }}
                style={selectStyle}
              >
                <option value="">— or enter manually below —</option>
                {subList.map((s) => <option key={s.id} value={s.id}>{s.company_name}{s.primary_trade ? ` (${s.primary_trade})` : ''}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Company" value={inviteForm.company_name} onChange={(v) => setInviteForm({ ...inviteForm, company_name: v })} placeholder="ABC Electric" />
            <InputField label="Contact" value={inviteForm.contact_name} onChange={(v) => setInviteForm({ ...inviteForm, contact_name: v })} placeholder="John Smith" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Email" value={inviteForm.email} onChange={(v) => setInviteForm({ ...inviteForm, email: v })} placeholder="john@abc.com" />
            <InputField label="Phone" value={inviteForm.phone} onChange={(v) => setInviteForm({ ...inviteForm, phone: v })} placeholder="(555) 123-4567" />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setInviteModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" icon={<Send size={14} />} onClick={handleCreateInvitation} loading={createInvitation.isPending}>Send Invitation</Btn>
          </div>
        </div>
      </Modal>

      {/* Add Scope Item Modal */}
      <Modal open={scopeModalOpen} onClose={() => setScopeModalOpen(false)} title="Add Scope Item" width="480px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Scope Item Description" value={scopeForm.description} onChange={(v) => setScopeForm({ ...scopeForm, description: v })} placeholder="Provide and install all conduit and wiring..." />
          <div>
            <label style={labelStyle}>Category</label>
            <select value={scopeForm.category} onChange={(e) => setScopeForm({ ...scopeForm, category: e.target.value })} style={selectStyle}>
              {SCOPE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setScopeModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleAddScopeItem} loading={createScopeItem.isPending}>Add Item</Btn>
          </div>
        </div>
      </Modal>

      {/* Add Subcontractor Modal */}
      <Modal open={subModalOpen} onClose={() => setSubModalOpen(false)} title="Add Subcontractor" width="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing['3'] }}>
            <InputField label="Company Name" value={subForm.company_name} onChange={(v) => setSubForm({ ...subForm, company_name: v })} placeholder="ABC Electric LLC" />
            <InputField label="Primary Trade" value={subForm.primary_trade} onChange={(v) => setSubForm({ ...subForm, primary_trade: v })} placeholder="Electrical" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Contact Name" value={subForm.contact_name} onChange={(v) => setSubForm({ ...subForm, contact_name: v })} placeholder="John Smith" />
            <InputField label="Email" value={subForm.email} onChange={(v) => setSubForm({ ...subForm, email: v })} placeholder="john@abc.com" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Phone" value={subForm.phone} onChange={(v) => setSubForm({ ...subForm, phone: v })} placeholder="(555) 123-4567" />
            <InputField label="City" value={subForm.city} onChange={(v) => setSubForm({ ...subForm, city: v })} placeholder="Austin" />
            <InputField label="State" value={subForm.state} onChange={(v) => setSubForm({ ...subForm, state: v })} placeholder="TX" />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={subForm.notes} onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })} rows={2} style={textareaStyle} placeholder="Internal notes about this sub..." />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setSubModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateSubcontractor} loading={createSubcontractor.isPending}>Add Subcontractor</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════

function DashboardView({
  metrics, packageList, allSubmissions, onSelectPackage,
}: {
  metrics: {
    total: number; inMarket: number; awarded: number; totalEstimated: number;
    totalAwarded: number; subsReceived: number; avgBidsPerPkg: number;
    upcomingDue: { pkg: PreconBidPackage; days: number | null }[];
    wellCovered: number; coveragePct: number;
  }
  packageList: PreconBidPackage[]
  allSubmissions: PreconBidSubmission[]
  onSelectPackage: (id: string, view?: ViewKey) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>
      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'] }}>
        <StatCard label="Bid Packages" value={metrics.total} sub={`${metrics.inMarket} in market`} />
        <StatCard label="Bids Received" value={metrics.subsReceived} sub={`${metrics.avgBidsPerPkg} avg per package`} />
        <StatCard label="Awarded" value={metrics.awarded} sub={fmt(metrics.totalAwarded)} color={colors.statusActive} />
        <StatCard label="Total Estimated" value={fmt(metrics.totalEstimated)} />
        <StatCard label="Bid Coverage" value={`${metrics.coveragePct}%`} sub={`${metrics.wellCovered}/${metrics.total} with 3+ bids`} color={metrics.coveragePct >= 80 ? colors.statusActive : colors.statusPending} />
      </div>

      {/* Upcoming Bid Days + Status Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
        {/* Upcoming Due Dates */}
        <Card padding={spacing['4']}>
          <SectionHeader title="Upcoming Bid Due Dates" />
          {metrics.upcomingDue.length === 0 ? (
            <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, marginTop: spacing['3'] }}>No upcoming due dates</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
              {metrics.upcomingDue.slice(0, 8).map(({ pkg, days }) => (
                <div
                  key={pkg.id}
                  onClick={() => onSelectPackage(pkg.id, 'packages')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.base,
                    cursor: 'pointer', backgroundColor: colors.surfaceInset,
                    transition: `background ${transitions.instant}`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceInset }}
                >
                  <div>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{pkg.title}</div>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{pkg.package_number} · {pkg.trade || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                      color: (days !== null && days <= 3) ? colors.statusCritical : (days !== null && days <= 7) ? colors.statusPending : colors.textPrimary,
                    }}>
                      {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                    </div>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{fmtDate(pkg.bid_due_date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Package Status Breakdown */}
        <Card padding={spacing['4']}>
          <SectionHeader title="Package Status" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], marginTop: spacing['3'] }}>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
              const count = packageList.filter((p) => p.status === status).length
              if (count === 0) return null
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                  <div style={{ width: 100, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {status.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                  </div>
                  <ProgressBar value={count} max={packageList.length} color={config.c} />
                  <div style={{ width: 24, textAlign: 'right', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{count}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Coverage Board — which packages need attention */}
      <Card padding={spacing['4']}>
        <SectionHeader title="Bid Coverage Board" />
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['3'] }}>
          Packages sorted by coverage urgency. Red = no bids. Yellow = less than 3 bids. Green = 3+ bids.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: spacing['3'] }}>
          {packageList
            .filter((p) => p.status !== 'cancelled' && p.status !== 'awarded')
            .sort((a, b) => {
              const aBids = allSubmissions.filter((s) => s.bid_package_id === a.id).length
              const bBids = allSubmissions.filter((s) => s.bid_package_id === b.id).length
              return aBids - bBids
            })
            .map((pkg) => {
              const bidCount = allSubmissions.filter((s) => s.bid_package_id === pkg.id).length
              const coverageColor = bidCount === 0 ? colors.statusCritical : bidCount < 3 ? colors.statusPending : colors.statusActive
              const days = daysUntil(pkg.bid_due_date)
              return (
                <div
                  key={pkg.id}
                  onClick={() => onSelectPackage(pkg.id, 'packages')}
                  style={{
                    padding: spacing['3'], borderRadius: borderRadius.base,
                    border: `1px solid ${colors.borderSubtle}`, cursor: 'pointer',
                    backgroundColor: colors.surfaceRaised,
                    borderLeft: `3px solid ${coverageColor}`,
                    transition: `all ${transitions.instant}`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.cardHover }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['2'] }}>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, lineHeight: typography.lineHeight.snug }}>{pkg.title}</div>
                    <Pill value={pkg.status} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: coverageColor }} />
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{bidCount} bid{bidCount !== 1 ? 's' : ''}</span>
                    </div>
                    {days !== null && days >= 0 && (
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        color: days <= 3 ? colors.statusCritical : days <= 7 ? colors.statusPending : colors.textTertiary,
                        fontWeight: days <= 3 ? typography.fontWeight.semibold : typography.fontWeight.normal,
                      }}>
                        {days === 0 ? 'Due today' : `${days}d left`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          {packageList.filter((p) => p.status !== 'cancelled' && p.status !== 'awarded').length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: spacing['8'], color: colors.textTertiary }}>
              No active packages. Create a bid package to get started.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// BID PACKAGES VIEW (Master-Detail)
// ═══════════════════════════════════════════════════════════

function PackagesView({
  packages, allSubmissions, selectedPackage, selectedPackageId, selectedSubmissions,
  invitationList, searchQuery, statusFilter, aiAnalysis,
  onSearch, onFilterStatus, onSelectPackage, onStatusChange, onAward,
  onAddBid, onInviteSub, onAddScope, onNavigateToLeveling,
}: {
  packages: PreconBidPackage[]
  allSubmissions: PreconBidSubmission[]
  selectedPackage: PreconBidPackage | null
  selectedPackageId: string | null
  selectedSubmissions: PreconBidSubmission[]
  invitationList: PreconBidInvitation[]
  searchQuery: string
  statusFilter: string
  aiAnalysis: AIAnalysisResult | null
  onSearch: (v: string) => void
  onFilterStatus: (v: string) => void
  onSelectPackage: (id: string | null) => void
  onStatusChange: (pkg: PreconBidPackage, status: string) => void
  onAward: (pkg: PreconBidPackage, sub: PreconBidSubmission) => void
  onAddBid: () => void
  onInviteSub: () => void
  onAddScope: () => void
  onNavigateToLeveling: () => void
}) {
  const [detailTab, setDetailTab] = useState<'overview' | 'bids' | 'invitations'>('overview')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedPackage ? '380px 1fr' : '1fr', gap: spacing['4'], minHeight: 500 }}>
      {/* Left Panel: Package List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
          <SearchInput value={searchQuery} onChange={onSearch} placeholder="Search packages..." />
          <select value={statusFilter} onChange={(e) => onFilterStatus(e.target.value)} style={{ ...selectStyle, width: 'auto', minWidth: 120 }}>
            <option value="all">All Status</option>
            {Object.keys(STATUS_CONFIG).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'], overflow: 'auto', maxHeight: 'calc(100vh - 340px)' }}>
          {packages.length === 0 ? (
            <EmptyState icon={<Package size={40} />} title="No packages found" description={searchQuery ? 'Try a different search.' : 'Create a new bid package to start.'} />
          ) : (
            packages.map((pkg) => {
              const bidCount = allSubmissions.filter((s) => s.bid_package_id === pkg.id).length
              const isSelected = pkg.id === selectedPackageId
              const days = daysUntil(pkg.bid_due_date)
              return (
                <div
                  key={pkg.id}
                  onClick={() => onSelectPackage(pkg.id)}
                  style={{
                    padding: spacing['3'], borderRadius: borderRadius.base,
                    border: `1px solid ${isSelected ? colors.primaryOrange : colors.borderSubtle}`,
                    backgroundColor: isSelected ? colors.surfaceSelected : colors.surfaceRaised,
                    cursor: 'pointer', transition: `all ${transitions.instant}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['1'] }}>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{pkg.title}</div>
                    <Pill value={pkg.status} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: spacing['3'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      <span>{pkg.package_number}</span>
                      {pkg.trade && <span>{pkg.trade}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'center', fontSize: typography.fontSize.caption }}>
                      <span style={{ color: colors.textSecondary }}>{bidCount} bid{bidCount !== 1 ? 's' : ''}</span>
                      {days !== null && days >= 0 && (
                        <span style={{ color: days <= 3 ? colors.statusCritical : colors.textTertiary, fontWeight: days <= 3 ? typography.fontWeight.semibold : typography.fontWeight.normal }}>
                          {days === 0 ? 'Due today' : `${days}d`}
                        </span>
                      )}
                      <span style={{ color: colors.textSecondary }}>{fmt(pkg.estimated_value || 0)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right Panel: Package Detail */}
      {selectedPackage && (
        <Card padding={spacing['4']}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['4'] }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                <span style={{ fontFamily: typography.fontFamilyMono, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{selectedPackage.package_number}</span>
                <Pill value={selectedPackage.status} />
              </div>
              <h2 style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{selectedPackage.title}</h2>
              {selectedPackage.trade && <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing['1'] }}>{selectedPackage.trade}{selectedPackage.csi_division ? ` · CSI ${selectedPackage.csi_division}` : ''}</div>}
            </div>
            <div style={{ display: 'flex', gap: spacing['2'] }}>
              {selectedPackage.status === 'draft' && (
                <Btn variant="secondary" icon={<Send size={14} />} onClick={() => onStatusChange(selectedPackage, 'issued')}>Issue to Market</Btn>
              )}
              {selectedPackage.status === 'issued' && (
                <Btn variant="secondary" onClick={() => onStatusChange(selectedPackage, 'receiving_bids')}>Receiving Bids</Btn>
              )}
              {['receiving_bids', 'evaluating'].includes(selectedPackage.status) && (
                <Btn variant="secondary" onClick={() => onStatusChange(selectedPackage, 'evaluating')}>Start Evaluation</Btn>
              )}
            </div>
          </div>

          {/* Key Info Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['4'], padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
            <div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Estimated</div>
              <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{fmt(selectedPackage.estimated_value || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Due Date</div>
              <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{fmtDate(selectedPackage.bid_due_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Bids</div>
              <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{selectedSubmissions.length}</div>
            </div>
            <div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Invited</div>
              <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{invitationList.length}</div>
            </div>
          </div>

          {selectedPackage.description && (
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['4'], lineHeight: typography.lineHeight.normal }}>{selectedPackage.description}</div>
          )}

          {/* Detail Tabs */}
          <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}`, paddingBottom: spacing['1'] }}>
            {(['overview', 'bids', 'invitations'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                style={{
                  padding: `${spacing['2']} ${spacing['3']}`, border: 'none', cursor: 'pointer',
                  backgroundColor: 'transparent', fontFamily: typography.fontFamily,
                  fontSize: typography.fontSize.sm, color: detailTab === tab ? colors.orangeText : colors.textTertiary,
                  fontWeight: detailTab === tab ? typography.fontWeight.medium : typography.fontWeight.normal,
                  borderBottom: detailTab === tab ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {tab === 'overview' ? 'Overview' : tab === 'bids' ? `Bids (${selectedSubmissions.length})` : `Invitations (${invitationList.length})`}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {detailTab === 'overview' && (
            <div>
              {/* AI Analysis */}
              {aiAnalysis && aiAnalysis.insights && (
                <div style={{ marginBottom: spacing['4'] }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
                    <Sparkles size={16} style={{ color: colors.indigo }} />
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.indigo }}>AI Analysis</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                    {aiAnalysis.insights.map((insight, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: spacing['2'], padding: spacing['3'],
                        borderRadius: borderRadius.base, fontSize: typography.fontSize.sm,
                        backgroundColor: insight.type === 'warning' ? colors.statusPendingSubtle : insight.type === 'success' ? colors.statusActiveSubtle : colors.statusInfoSubtle,
                        color: insight.type === 'warning' ? colors.statusPending : insight.type === 'success' ? colors.statusActive : colors.statusInfo,
                      }}>
                        {insight.type === 'warning' ? <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> : insight.type === 'success' ? <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />}
                        <span>{insight.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
                <Btn variant="secondary" icon={<Plus size={14} />} onClick={onAddBid}>Record Bid</Btn>
                <Btn variant="secondary" icon={<UserPlus size={14} />} onClick={onInviteSub}>Invite Sub</Btn>
                <Btn variant="secondary" icon={<Layers size={14} />} onClick={onNavigateToLeveling}>Bid Leveling</Btn>
              </div>
            </div>
          )}

          {/* Bids Tab */}
          {detailTab === 'bids' && (
            <div>
              {selectedSubmissions.length === 0 ? (
                <EmptyState icon={<FileText size={40} />} title="No bids received" description="Record bids as subcontractors submit their pricing." />
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {selectedSubmissions.length} submission{selectedSubmissions.length !== 1 ? 's' : ''} · Low: {fmt(selectedSubmissions[0]?.bid_amount || 0)}
                      {aiAnalysis && ` · Avg: ${fmt(aiAnalysis.avg || 0)}`}
                    </div>
                    <Btn variant="secondary" icon={<Plus size={14} />} onClick={onAddBid}>Add Bid</Btn>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Bidder</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Variance</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedSubmissions].sort((a, b) => a.bid_amount - b.bid_amount).map((bid, idx) => {
                        const low = selectedSubmissions.reduce((m, b) => Math.min(m, b.bid_amount), Infinity)
                        const variance = low > 0 ? ((bid.bid_amount - low) / low) * 100 : 0
                        return (
                          <tr key={bid.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                            <td style={{ ...tdStyle, color: colors.textTertiary, fontFamily: typography.fontFamilyMono }}>{idx + 1}</td>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: typography.fontWeight.medium }}>{bid.bidder_name}</div>
                              {bid.bidder_company && <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{bid.bidder_company}</div>}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamilyMono }}>
                              {fmt(bid.bid_amount)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: idx === 0 ? colors.statusActive : colors.textSecondary }}>
                              {idx === 0 ? 'Low' : `+${variance.toFixed(1)}%`}
                            </td>
                            <td style={tdStyle}><Pill value={bid.status} /></td>
                            <td style={tdStyle}>
                              {selectedPackage.status !== 'awarded' && (
                                <Btn variant="secondary" icon={<Award size={14} />} onClick={() => onAward(selectedPackage, bid)}>Award</Btn>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* Invitations Tab */}
          {detailTab === 'invitations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {invitationList.length} invitation{invitationList.length !== 1 ? 's' : ''}
                  {invitationList.length > 0 && ` · ${invitationList.filter((i) => i.status === 'submitted').length} responded`}
                </div>
                <Btn variant="secondary" icon={<UserPlus size={14} />} onClick={onInviteSub}>Invite Sub</Btn>
              </div>
              {invitationList.length === 0 ? (
                <EmptyState icon={<Users size={40} />} title="No invitations sent" description="Invite subcontractors to bid on this package." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {invitationList.map((inv) => (
                    <div key={inv.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: spacing['3'], borderRadius: borderRadius.base,
                      border: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised,
                    }}>
                      <div>
                        <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{inv.company_name}</div>
                        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {inv.contact_name && `${inv.contact_name} · `}{inv.email || '—'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <Pill value={inv.status} palette={INV_STATUS_CONFIG[inv.status]} />
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{fmtDate(inv.invited_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {!selectedPackage && packages.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
          Select a package to see details
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// BID LEVELING VIEW — THE KILLER FEATURE
// ═══════════════════════════════════════════════════════════

function LevelingView({
  packageList, selectedPackageId, selectedPackage, selectedSubmissions,
  scopeItemList, scopeResponseList, aiAnalysis,
  onSelectPackage, onScopeResponse, onAddScope, onDeleteScope, onAward,
}: {
  packageList: PreconBidPackage[]
  selectedPackageId: string | null
  selectedPackage: PreconBidPackage | null
  selectedSubmissions: PreconBidSubmission[]
  scopeItemList: PreconScopeItem[]
  scopeResponseList: PreconBidScopeResponse[]
  aiAnalysis: AIAnalysisResult | null
  onSelectPackage: (id: string | null) => void
  onScopeResponse: (scopeItemId: string, bidSubmissionId: string, response: string) => void
  onAddScope: () => void
  onDeleteScope: (id: string) => Promise<void>
  onAward: (pkg: PreconBidPackage, sub: PreconBidSubmission) => void
}) {
  const sortedBids = useMemo(
    () => [...selectedSubmissions].sort((a, b) => a.bid_amount - b.bid_amount),
    [selectedSubmissions]
  )

  // Build lookup for scope responses
  const responseLookup = useMemo(() => {
    const map: Record<string, PreconBidScopeResponse> = {}
    for (const r of scopeResponseList) {
      map[`${r.scope_item_id}:${r.bid_submission_id}`] = r
    }
    return map
  }, [scopeResponseList])

  // Calculate adjusted totals (estimate excluded item costs)
  const adjustedTotals = useMemo(() => {
    return sortedBids.map((bid) => {
      let adjustment = 0
      for (const item of scopeItemList) {
        const resp = responseLookup[`${item.id}:${bid.id}`]
        if (resp?.response === 'excluded' && resp.cost_impact) {
          adjustment += resp.cost_impact
        }
      }
      return { bidId: bid.id, baseAmount: bid.bid_amount, adjustment, adjustedTotal: bid.bid_amount + adjustment }
    })
  }, [sortedBids, scopeItemList, responseLookup])

  const responseIcon = (response: string) => {
    switch (response) {
      case 'included': return <Check size={14} style={{ color: colors.statusActive }} />
      case 'excluded': return <X size={14} style={{ color: colors.statusCritical }} />
      case 'qualified': return <HelpCircle size={14} style={{ color: colors.statusPending }} />
      default: return <Minus size={14} style={{ color: colors.textTertiary }} />
    }
  }

  const responseBg = (response: string) => {
    switch (response) {
      case 'included': return colors.statusActiveSubtle
      case 'excluded': return colors.statusCriticalSubtle
      case 'qualified': return colors.statusPendingSubtle
      default: return 'transparent'
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {/* Package Selector */}
      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Select Bid Package to Level</label>
            <select
              value={selectedPackageId || ''}
              onChange={(e) => onSelectPackage(e.target.value || null)}
              style={selectStyle}
            >
              <option value="">— choose a package —</option>
              {packageList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.package_number} · {p.title} ({[...new Set([])].length} bids)
                </option>
              ))}
            </select>
          </div>
          {selectedPackage && (
            <div style={{ display: 'flex', gap: spacing['2'], alignSelf: 'flex-end' }}>
              <Btn variant="secondary" icon={<Plus size={14} />} onClick={onAddScope}>Add Scope Item</Btn>
            </div>
          )}
        </div>
      </Card>

      {!selectedPackage && (
        <EmptyState icon={<Layers size={48} />} title="Select a bid package" description="Choose a bid package above to begin leveling bids." />
      )}

      {selectedPackage && sortedBids.length === 0 && (
        <EmptyState icon={<FileText size={48} />} title="No bids to level" description="Record bid submissions before you can level them." />
      )}

      {selectedPackage && sortedBids.length > 0 && (
        <>
          {/* Bid Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sortedBids.length, 5)}, 1fr)`, gap: spacing['3'] }}>
            {sortedBids.map((bid, idx) => {
              const adj = adjustedTotals.find((a) => a.bidId === bid.id)
              const isLow = idx === 0
              return (
                <Card key={bid.id} padding={spacing['3']}>
                  <div style={{
                    fontSize: typography.fontSize.caption, color: isLow ? colors.statusActive : colors.textTertiary,
                    fontWeight: typography.fontWeight.medium, marginBottom: spacing['1'],
                    textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
                  }}>
                    {isLow ? 'Low Bid' : `Bidder ${idx + 1}`}
                  </div>
                  <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['0.5'] }}>
                    {bid.bidder_company || bid.bidder_name}
                  </div>
                  <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, fontFamily: typography.fontFamilyMono }}>
                    {fmt(bid.bid_amount)}
                  </div>
                  {adj && adj.adjustment > 0 && (
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.statusPending, marginTop: spacing['1'] }}>
                      Adj: {fmt(adj.adjustedTotal)} (+{fmt(adj.adjustment)} for exclusions)
                    </div>
                  )}
                  {selectedPackage.status !== 'awarded' && (
                    <div style={{ marginTop: spacing['2'] }}>
                      <Btn variant={isLow ? 'primary' : 'secondary'} icon={<Award size={14} />} onClick={() => onAward(selectedPackage, bid)}>
                        {isLow ? 'Award' : 'Award'}
                      </Btn>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Scope Comparison Matrix */}
          <Card padding={spacing['4']}>
            <SectionHeader
              title="Scope Comparison Matrix"
              action={<Btn variant="secondary" icon={<Plus size={14} />} onClick={onAddScope}>Add Scope Item</Btn>}
            />
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['4'] }}>
              Click cells to toggle: Included / Excluded / Qualified / Unknown. Exclusions are flagged as scope gaps.
            </div>

            {scopeItemList.length === 0 ? (
              <EmptyState icon={<Target size={40} />} title="No scope items defined" description="Add scope items to create a comparison matrix for bid leveling." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.borderSubtle}` }}>
                      <th style={{ ...thStyle, minWidth: 200, position: 'sticky', left: 0, backgroundColor: colors.surfaceRaised, zIndex: 1 }}>Scope Item</th>
                      <th style={{ ...thStyle, width: 80 }}>Category</th>
                      {sortedBids.map((bid) => (
                        <th key={bid.id} style={{ ...thStyle, textAlign: 'center', minWidth: 120 }}>
                          <div>{bid.bidder_company || bid.bidder_name}</div>
                          <div style={{ fontWeight: typography.fontWeight.normal, fontSize: typography.fontSize.caption }}>{fmt(bid.bid_amount)}</div>
                        </th>
                      ))}
                      <th style={{ ...thStyle, width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopeItemList.map((item) => (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ ...tdStyle, position: 'sticky', left: 0, backgroundColor: colors.surfaceRaised, zIndex: 1, fontWeight: typography.fontWeight.medium }}>
                          {item.description}
                          {item.required && <span style={{ color: colors.statusCritical, marginLeft: spacing['1'] }}>*</span>}
                        </td>
                        <td style={{ ...tdStyle, color: colors.textTertiary, fontSize: typography.fontSize.caption }}>{item.category || '—'}</td>
                        {sortedBids.map((bid) => {
                          const key = `${item.id}:${bid.id}`
                          const resp = responseLookup[key]
                          const current = resp?.response || 'unknown'
                          const cycleOrder = ['unknown', 'included', 'excluded', 'qualified']
                          const nextResponse = cycleOrder[(cycleOrder.indexOf(current) + 1) % cycleOrder.length]
                          return (
                            <td
                              key={bid.id}
                              onClick={() => onScopeResponse(item.id, bid.id, nextResponse)}
                              style={{
                                ...tdStyle, textAlign: 'center', cursor: 'pointer',
                                backgroundColor: responseBg(current),
                                transition: `background ${transitions.instant}`,
                              }}
                              title={`${current} — click to change`}
                            >
                              {responseIcon(current)}
                            </td>
                          )
                        })}
                        <td style={tdStyle}>
                          <button
                            onClick={() => onDeleteScope(item.id)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: spacing['1'], color: colors.textTertiary }}
                            title="Remove scope item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${colors.borderSubtle}` }}>
                      <td style={{ ...tdStyle, fontWeight: typography.fontWeight.semibold }} colSpan={2}>Base Bid Total</td>
                      {sortedBids.map((bid) => (
                        <td key={bid.id} style={{ ...tdStyle, textAlign: 'center', fontWeight: typography.fontWeight.bold, fontFamily: typography.fontFamilyMono }}>
                          {fmt(bid.bid_amount)}
                        </td>
                      ))}
                      <td></td>
                    </tr>
                    {adjustedTotals.some((a) => a.adjustment > 0) && (
                      <tr>
                        <td style={{ ...tdStyle, fontWeight: typography.fontWeight.semibold, color: colors.statusPending }} colSpan={2}>Adjusted Total</td>
                        {sortedBids.map((bid) => {
                          const adj = adjustedTotals.find((a) => a.bidId === bid.id)
                          return (
                            <td key={bid.id} style={{ ...tdStyle, textAlign: 'center', fontWeight: typography.fontWeight.bold, fontFamily: typography.fontFamilyMono, color: adj && adj.adjustment > 0 ? colors.statusPending : colors.textPrimary }}>
                              {adj ? fmt(adj.adjustedTotal) : '—'}
                            </td>
                          )
                        })}
                        <td></td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['4'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}><Check size={12} style={{ color: colors.statusActive }} /> Included</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}><X size={12} style={{ color: colors.statusCritical }} /> Excluded</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}><HelpCircle size={12} style={{ color: colors.statusPending }} /> Qualified</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}><Minus size={12} style={{ color: colors.textTertiary }} /> Unknown</span>
              <span style={{ color: colors.statusCritical }}>* Required</span>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SUBCONTRACTORS VIEW
// ═══════════════════════════════════════════════════════════

function SubcontractorsView({
  subcontractors, searchQuery, onSearch, onAddSub, onSelectSub, selectedSubId, onUpdateSub,
}: {
  subcontractors: PreconSubcontractor[]
  searchQuery: string
  onSearch: (v: string) => void
  onAddSub: () => void
  onSelectSub: (id: string | null) => void
  selectedSubId: string | null
  onUpdateSub: (id: string, patch: Partial<PreconSubcontractor>) => Promise<unknown>
}) {
  const filtered = useMemo(() => {
    if (!searchQuery) return subcontractors
    const q = searchQuery.toLowerCase()
    return subcontractors.filter((s) =>
      s.company_name.toLowerCase().includes(q) ||
      (s.primary_trade || '').toLowerCase().includes(q) ||
      (s.contact_name || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q)
    )
  }, [subcontractors, searchQuery])

  const selectedSub = subcontractors.find((s) => s.id === selectedSubId)

  const handleTogglePrequal = async (sub: PreconSubcontractor) => {
    try {
      await onUpdateSub(sub.id, {
        prequalified: !sub.prequalified,
        prequalified_at: !sub.prequalified ? new Date().toISOString() : null,
      })
      toast.success(sub.prequalified ? 'Prequalification removed' : 'Marked as prequalified')
    } catch {
      toast.error('Update failed')
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedSub ? '1fr 400px' : '1fr', gap: spacing['4'] }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
          <SearchInput value={searchQuery} onChange={onSearch} placeholder="Search subs by name, trade, or location..." />
          <Btn variant="primary" icon={<Plus size={14} />} onClick={onAddSub}>Add Sub</Btn>
        </div>

        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          {filtered.length} subcontractor{filtered.length !== 1 ? 's' : ''}
          {subcontractors.length > 0 && ` · ${subcontractors.filter((s) => s.prequalified).length} prequalified`}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Building2 size={48} />} title="No subcontractors" description="Add subcontractors to build your bid invitation database." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            {filtered.map((sub) => {
              const isSelected = sub.id === selectedSubId
              return (
                <div
                  key={sub.id}
                  onClick={() => onSelectSub(isSelected ? null : sub.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: spacing['3'], borderRadius: borderRadius.base,
                    border: `1px solid ${isSelected ? colors.primaryOrange : colors.borderSubtle}`,
                    backgroundColor: isSelected ? colors.surfaceSelected : colors.surfaceRaised,
                    cursor: 'pointer', transition: `all ${transitions.instant}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: borderRadius.base,
                      backgroundColor: colors.surfaceInset, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: colors.textTertiary, fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                    }}>
                      {sub.company_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{sub.company_name}</span>
                        {sub.prequalified && <Shield size={12} style={{ color: colors.statusActive }} title="Prequalified" />}
                      </div>
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {sub.primary_trade || '—'}{sub.city ? ` · ${sub.city}${sub.state ? `, ${sub.state}` : ''}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                    {sub.rating !== null && sub.rating > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['0.5'] }}>
                        <Star size={12} style={{ color: colors.statusPending, fill: colors.statusPending }} />
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{sub.rating.toFixed(1)}</span>
                      </div>
                    )}
                    <Pill value={sub.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sub Detail Panel */}
      {selectedSub && (
        <Card padding={spacing['4']}>
          <div style={{ marginBottom: spacing['4'] }}>
            <div style={{
              width: 48, height: 48, borderRadius: borderRadius.lg,
              backgroundColor: colors.surfaceInset, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: colors.textSecondary, fontSize: typography.fontSize.medium,
              fontWeight: typography.fontWeight.semibold, marginBottom: spacing['3'],
            }}>
              {selectedSub.company_name.charAt(0).toUpperCase()}
            </div>
            <h3 style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{selectedSub.company_name}</h3>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing['1'] }}>{selectedSub.primary_trade || 'No trade specified'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {selectedSub.contact_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Users size={14} style={{ color: colors.textTertiary }} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selectedSub.contact_name}</span>
              </div>
            )}
            {selectedSub.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Mail size={14} style={{ color: colors.textTertiary }} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selectedSub.email}</span>
              </div>
            )}
            {selectedSub.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Phone size={14} style={{ color: colors.textTertiary }} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selectedSub.phone}</span>
              </div>
            )}
            {(selectedSub.city || selectedSub.state) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Building2 size={14} style={{ color: colors.textTertiary }} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                  {[selectedSub.city, selectedSub.state].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, marginTop: spacing['4'], paddingTop: spacing['4'] }}>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, marginBottom: spacing['3'] }}>Qualification</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
              <div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Prequalified</div>
                <div
                  onClick={() => handleTogglePrequal(selectedSub)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['1'], cursor: 'pointer',
                    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                    color: selectedSub.prequalified ? colors.statusActive : colors.textTertiary,
                  }}
                >
                  {selectedSub.prequalified ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {selectedSub.prequalified ? 'Yes' : 'No'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Insurance</div>
                <div style={{ fontSize: typography.fontSize.sm, color: selectedSub.insurance_verified ? colors.statusActive : colors.textTertiary }}>
                  {selectedSub.insurance_verified ? 'Verified' : 'Not verified'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Projects</div>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selectedSub.projects_completed}</div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Rating</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                  {selectedSub.rating ? (
                    <>
                      <Star size={12} style={{ color: colors.statusPending, fill: colors.statusPending }} />
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{selectedSub.rating.toFixed(1)} / 5</span>
                    </>
                  ) : (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {selectedSub.notes && (
            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, marginTop: spacing['4'], paddingTop: spacing['4'] }}>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, marginBottom: spacing['2'] }}>Notes</div>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>{selectedSub.notes}</div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ── Shared Styles ─────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: `${spacing['2']} ${spacing['3']}`, color: colors.textTertiary,
  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
  textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
}
const tdStyle: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary, fontSize: typography.fontSize.sm,
  verticalAlign: 'middle',
}
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: spacing['1'],
  fontSize: typography.fontSize.caption, color: colors.textSecondary,
  fontWeight: typography.fontWeight.medium,
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
}
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
  resize: 'vertical',
}

export default Preconstruction
