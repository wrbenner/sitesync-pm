import React, { useState, useMemo } from 'react'
import { Truck, Warehouse, Plus, DollarSign, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, Star, TrendingUp, TrendingDown, ArrowRight, ClipboardList, FileText, ShieldCheck, ChevronRight, BarChart3 } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions, touchTarget } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useDeliveries, useMaterialInventory } from '../hooks/queries'
import { usePurchaseOrders, usePOLineItems } from '../hooks/queries/purchase-orders'
import { useCreatePurchaseOrder, useDeletePurchaseOrder, useUpdatePurchaseOrder } from '../hooks/mutations/purchase-orders'
import { useCreateDelivery, useDeleteDelivery, useCreateMaterialItem } from '../hooks/queries/procurement-equipment'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'

type TabKey = 'orders' | 'deliveries' | 'inventory' | 'matching' | 'requisitions'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'orders', label: 'Purchase Orders', icon: DollarSign },
  { key: 'deliveries', label: 'Deliveries', icon: Truck },
  { key: 'inventory', label: 'Inventory', icon: Warehouse },
  { key: 'matching', label: 'Three-Way Match', icon: ShieldCheck },
  { key: 'requisitions', label: 'Requisitions', icon: ClipboardList },
]

// ── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function statusBadge(value: string | null | undefined) {
  const v = (value || '').toLowerCase()
  let color = colors.statusInfo
  let bg = colors.statusInfoSubtle
  if (v === 'approved' || v === 'received' || v === 'complete' || v === 'delivered') {
    color = colors.statusActive
    bg = colors.statusActiveSubtle
  } else if (v === 'pending' || v === 'in_transit' || v === 'partial') {
    color = colors.statusPending
    bg = colors.statusPendingSubtle
  } else if (v === 'rejected' || v === 'cancelled' || v === 'overdue') {
    color = colors.statusCritical
    bg = colors.statusCriticalSubtle
  }
  const label = v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : ''
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color, backgroundColor: bg,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color }} />
      {label}
    </span>
  )
}

// ── PO Approval Workflow Types ──────────────────────────────

type ApprovalStage = 'draft' | 'submitted' | 'pm_approved' | 'director_approved' | 'issued'
const approvalStages: { key: ApprovalStage; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'pm_approved', label: 'PM Approved' },
  { key: 'director_approved', label: 'Dir. Approved' },
  { key: 'issued', label: 'Issued' },
]

interface ApprovalHistoryEntry { name: string; date: string; action: string; comments: string }

interface ApprovalPO {
  id: string; po_number: string; vendor_name: string; total: number
  approval_stage: ApprovalStage; threshold_label: string
  approval_history: ApprovalHistoryEntry[]
}

function getApprovalThreshold(total: number): string {
  if (total < 5000) return 'Auto-Approve'
  if (total <= 25000) return 'PM Only'
  if (total <= 100000) return 'PM + Director'
  return 'PM + Director + Owner'
}

/** Map a PO status string to an approval stage */
function mapStatusToApprovalStage(status: string | null | undefined): ApprovalStage {
  const s = (status || '').toLowerCase()
  if (s === 'draft') return 'draft'
  if (s === 'submitted' || s === 'pending') return 'submitted'
  if (s === 'approved') return 'pm_approved'
  if (s === 'ordered' || s === 'issued') return 'issued'
  if (s === 'received' || s === 'complete') return 'issued'
  return 'draft'
}

function ApprovalPipeline({ stage }: { stage: ApprovalStage }) {
  const currentIdx = approvalStages.findIndex(s => s.key === stage)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {approvalStages.map((s, idx) => {
        const isDone = idx <= currentIdx
        const isCurrent = idx === currentIdx
        return (
          <React.Fragment key={s.key}>
            {idx > 0 && <div style={{ width: 18, height: 2, backgroundColor: isDone ? colors.statusActive : colors.borderLight }} />}
            <div title={s.label} style={{
              width: isCurrent ? 22 : 18, height: isCurrent ? 22 : 18, borderRadius: '50%',
              backgroundColor: isDone ? colors.statusActive : colors.surfaceInset,
              border: isCurrent ? `2px solid ${colors.statusActive}` : `1px solid ${isDone ? colors.statusActive : colors.borderLight}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: isDone ? '#fff' : colors.textTertiary, fontWeight: 600,
            }}>
              {isDone ? <CheckCircle size={10} /> : idx + 1}
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Three-Way Match Types ──────────────────────────────────

type MatchStatus = 'matched' | 'qty_mismatch' | 'price_mismatch' | 'pending'

interface MatchLine {
  item: string; poQty: number; poPrice: number
  receivedQty: number; invoicedQty: number; invoicedPrice: number
  status: MatchStatus
}

function matchStatusBadge(status: MatchStatus) {
  const config: Record<MatchStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    matched: { label: 'Matched', color: colors.statusActive, bg: colors.statusActiveSubtle, icon: CheckCircle },
    qty_mismatch: { label: 'Qty Mismatch', color: colors.statusPending, bg: colors.statusPendingSubtle, icon: AlertTriangle },
    price_mismatch: { label: 'Price Mismatch', color: colors.statusCritical, bg: colors.statusCriticalSubtle, icon: XCircle },
    pending: { label: 'Pending', color: colors.textTertiary, bg: colors.surfaceInset, icon: Clock },
  }
  const c = config[status]
  const Icon = c.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: c.color, backgroundColor: c.bg }}>
      <Icon size={10} /> {c.label}
    </span>
  )
}

// ── Material Requisition Types ────────────────────────────

type ReqStatus = 'open' | 'converted' | 'cancelled'
type ReqUrgency = 'low' | 'medium' | 'high' | 'critical'

interface Requisition {
  id: string; requester: string; date: string; urgency: ReqUrgency
  status: ReqStatus; items: string; converted_po?: string
}

function urgencyBadge(urgency: ReqUrgency) {
  const map: Record<ReqUrgency, { color: string; bg: string }> = {
    low: { color: colors.textTertiary, bg: colors.surfaceInset },
    medium: { color: colors.statusInfo, bg: colors.statusInfoSubtle },
    high: { color: colors.statusPending, bg: colors.statusPendingSubtle },
    critical: { color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  }
  const c = map[urgency]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: c.color, backgroundColor: c.bg }}>
      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
    </span>
  )
}

// ── Vendor Scorecard (computed from delivery data) ────────

interface VendorScore {
  name: string; onTimeDelivery: number; totalDeliveries: number
  deliveredCount: number; rating: number; trend: 'up' | 'down' | 'stable'
}

function VendorScorecard({ score }: { score: VendorScore | null }) {
  if (!score) return null
  const isLow = score.rating < 3.5
  const TrendIcon = score.trend === 'up' ? TrendingUp : score.trend === 'down' ? TrendingDown : ArrowRight
  const trendColor = score.trend === 'up' ? colors.statusActive : score.trend === 'down' ? colors.statusCritical : colors.textTertiary
  return (
    <div style={{ padding: spacing['3'], backgroundColor: isLow ? colors.statusCriticalSubtle : colors.surfaceInset, borderRadius: borderRadius.base, border: isLow ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderLight}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Vendor Performance: {score.name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: trendColor, fontSize: typography.fontSize.caption }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={12} fill={i < Math.round(score.rating) ? '#f59e0b' : 'none'} color={i < Math.round(score.rating) ? '#f59e0b' : colors.borderLight} />
          ))}
          <span style={{ fontWeight: typography.fontWeight.semibold, marginLeft: 4 }}>{score.rating.toFixed(1)}</span>
          <TrendIcon size={12} />
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['2'] }}>
        <div><span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block' }}>On-Time %</span><span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: score.onTimeDelivery >= 90 ? colors.statusActive : score.onTimeDelivery >= 80 ? colors.statusPending : colors.statusCritical }}>{score.onTimeDelivery}%</span></div>
        <div><span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block' }}>Total Deliveries</span><span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{score.totalDeliveries}</span></div>
        <div><span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block' }}>Completed</span><span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{score.deliveredCount}</span></div>
      </div>
    </div>
  )
}

function VendorScorecardEmpty() {
  return (
    <div style={{ padding: spacing['4'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, textAlign: 'center' }}>
      <BarChart3 size={20} style={{ color: colors.textTertiary, marginBottom: spacing['2'] }} />
      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
        No delivery data available for this vendor yet. Performance scores will appear once deliveries are recorded.
      </p>
    </div>
  )
}

// ── Empty State Component ─────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: `${spacing['6']} ${spacing['4']}`,
      backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg, border: `1px dashed ${colors.borderLight}`,
      textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', backgroundColor: colors.surfaceRaised,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing['3'],
        border: `1px solid ${colors.borderLight}`,
      }}>
        <Icon size={22} style={{ color: colors.textTertiary }} />
      </div>
      <h4 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `0 0 ${spacing['1']} 0` }}>{title}</h4>
      <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, maxWidth: 400 }}>{description}</p>
    </div>
  )
}

// ── Inline styles (shared) ──────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: spacing['1'],
  fontSize: typography.fontSize.caption, color: colors.textSecondary,
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
  border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised,
  color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical',
}

// ── Line-item type ──────────────────────────────────────────

interface LineItemForm {
  description: string
  quantity: string
  unit: string
  unit_cost: string
}

const emptyLineItem: LineItemForm = { description: '', quantity: '', unit: '', unit_cost: '' }

// ── Main Component ───────────────────────────────────────────

export const Procurement: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: pos, isPending: posLoading } = usePurchaseOrders(projectId)
  const { data: deliveries, isPending: delLoading } = useDeliveries(projectId)
  const { data: inventory, isPending: invLoading } = useMaterialInventory(projectId)
  const { data: poLineItems } = usePOLineItems(projectId)
  const [activeTab, setActiveTab] = useState<TabKey>('orders')

  // mutations
  const createPO = useCreatePurchaseOrder()
  const updatePO = useUpdatePurchaseOrder()
  const deletePO = useDeletePurchaseOrder()
  const createDelivery = useCreateDelivery()
  const deleteDelivery = useDeleteDelivery()
  const createMaterial = useCreateMaterialItem()

  // modal states
  const [poModalOpen, setPoModalOpen] = useState(false)
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
  const [materialModalOpen, setMaterialModalOpen] = useState(false)

  // enterprise feature states
  const [selectedApprovalPO, setSelectedApprovalPO] = useState<string | null>(null)
  // Local approval stage overrides — keyed by PO id
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, { stage: ApprovalStage; history: ApprovalHistoryEntry[] }>>({})
  // Requisitions — no DB table exists yet, so we use local state with an empty initial array
  const [requisitions, setRequisitions] = useState<Requisition[]>([])

  const isLoading = posLoading || delLoading || invLoading

  // ── Derive Approval POs from real PO data ─────────────────

  const approvalPOs: ApprovalPO[] = useMemo(() => {
    if (!pos || pos.length === 0) return []
    return pos.map((po: Record<string, unknown>) => {
      const id = po.id as string
      const total = (po.total as number) || 0
      const override = approvalOverrides[id]
      const baseStage = mapStatusToApprovalStage(po.status as string)
      return {
        id,
        po_number: `PO-${po.po_number}`,
        vendor_name: (po.vendor_name as string) || 'Unknown Vendor',
        total,
        approval_stage: override?.stage ?? baseStage,
        threshold_label: getApprovalThreshold(total),
        approval_history: override?.history ?? [],
      }
    })
  }, [pos, approvalOverrides])

  // Map approval stages to persisted PO status values
  const STAGE_TO_STATUS: Partial<Record<ApprovalStage, string>> = {
    draft: 'draft',
    issued: 'issued',
  }

  // Helper to update approval state for a PO — persists status when the stage maps to a DB value
  const updateApproval = (poId: string, stage: ApprovalStage, newEntry: ApprovalHistoryEntry) => {
    setApprovalOverrides(prev => {
      const existing = prev[poId]
      return {
        ...prev,
        [poId]: {
          stage,
          history: [...(existing?.history ?? []), newEntry],
        },
      }
    })
    const nextStatus = STAGE_TO_STATUS[stage]
    if (nextStatus && projectId) {
      updatePO.mutate({ id: poId, projectId, updates: { status: nextStatus } })
    }
  }

  // ── Compute Vendor Scores from delivery data ──────────────

  const vendorScores: Record<string, VendorScore> = useMemo(() => {
    if (!deliveries || !pos) return {}
    // Build a map of PO id -> vendor name
    const poVendorMap: Record<string, string> = {}
    for (const po of pos) {
      poVendorMap[po.id as string] = (po.vendor_name as string) || 'Unknown'
    }
    // Group deliveries by vendor
    const vendorDeliveries: Record<string, { total: number; delivered: number; onTime: number }> = {}
    for (const d of deliveries) {
      const vendorName = poVendorMap[(d.purchase_order_id as string) || ''] || 'Unknown'
      if (!vendorDeliveries[vendorName]) {
        vendorDeliveries[vendorName] = { total: 0, delivered: 0, onTime: 0 }
      }
      vendorDeliveries[vendorName].total++
      const status = ((d.status as string) || '').toLowerCase()
      if (status === 'delivered' || status === 'received') {
        vendorDeliveries[vendorName].delivered++
        // Consider delivered/received as on-time (we don't have a due date to compare)
        vendorDeliveries[vendorName].onTime++
      }
    }
    const scores: Record<string, VendorScore> = {}
    for (const [name, data] of Object.entries(vendorDeliveries)) {
      const onTimePct = data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0
      const rating = data.total > 0 ? Math.min(5, Math.max(1, (data.delivered / data.total) * 5)) : 0
      scores[name] = {
        name,
        onTimeDelivery: onTimePct,
        totalDeliveries: data.total,
        deliveredCount: data.delivered,
        rating: Math.round(rating * 10) / 10,
        trend: onTimePct >= 90 ? 'up' : onTimePct >= 70 ? 'stable' : 'down',
      }
    }
    return scores
  }, [deliveries, pos])

  // ── Derive Three-Way Match lines from PO line items + deliveries ──

  const matchLines: MatchLine[] = useMemo(() => {
    if (!poLineItems || poLineItems.length === 0) return []
    return poLineItems.map((li: Record<string, unknown>) => {
      const poQty = (li.quantity as number) || 0
      const poPrice = (li.unit_cost as number) || 0
      const receivedQty = (li.quantity_received as number) || 0
      // We don't have a separate invoice table, so use PO values as invoiced when received
      const invoicedQty = receivedQty
      const invoicedPrice = receivedQty > 0 ? poPrice : 0

      let status: MatchStatus = 'pending'
      if (receivedQty === 0 && poQty > 0) {
        status = 'pending'
      } else if (receivedQty === poQty && invoicedPrice === poPrice) {
        status = 'matched'
      } else if (receivedQty !== poQty) {
        status = 'qty_mismatch'
      } else if (invoicedPrice !== poPrice) {
        status = 'price_mismatch'
      }

      return {
        item: (li.description as string) || 'Unnamed item',
        poQty,
        poPrice,
        receivedQty,
        invoicedQty,
        invoicedPrice,
        status,
      }
    })
  }, [poLineItems])

  // ── PO Form ────────────────────────────────────────────────
  const [poForm, setPoForm] = useState({
    vendor_name: '', description: '', status: 'draft',
    required_date: '', delivery_address: '', notes: '',
    is_long_lead: false, lead_time_weeks: '', needed_on_site_date: '',
    tax: '', shipping: '',
  })
  const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...emptyLineItem }])

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, li) => {
      const qty = parseFloat(li.quantity) || 0
      const uc = parseFloat(li.unit_cost) || 0
      return sum + qty * uc
    }, 0)
  }, [lineItems])

  const poTotal = useMemo(() => {
    return subtotal + (parseFloat(poForm.tax) || 0) + (parseFloat(poForm.shipping) || 0)
  }, [subtotal, poForm.tax, poForm.shipping])

  const addLineItem = () => setLineItems([...lineItems, { ...emptyLineItem }])
  const removeLineItem = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx))
  const updateLineItem = (idx: number, field: keyof LineItemForm, val: string) => {
    setLineItems(lineItems.map((li, i) => i === idx ? { ...li, [field]: val } : li))
  }

  const handleCreatePO = async () => {
    if (!projectId || !poForm.vendor_name) {
      toast.error('Vendor name is required')
      return
    }
    try {
      const tax = parseFloat(poForm.tax) || 0
      const shipping = parseFloat(poForm.shipping) || 0
      const po: Record<string, unknown> = {
        project_id: projectId,
        vendor_name: poForm.vendor_name,
        description: poForm.description || null,
        status: poForm.status,
        required_date: poForm.required_date || null,
        delivery_address: poForm.delivery_address || null,
        notes: poForm.notes || null,
        is_long_lead: poForm.is_long_lead,
        lead_time_weeks: poForm.lead_time_weeks ? parseInt(poForm.lead_time_weeks) : null,
        needed_on_site_date: poForm.needed_on_site_date || null,
        subtotal, tax, shipping, total: poTotal,
        created_by: user?.id,
      }
      const items = lineItems
        .filter(li => li.description)
        .map(li => ({
          description: li.description,
          quantity: parseFloat(li.quantity) || 0,
          unit: li.unit || null,
          unit_cost: parseFloat(li.unit_cost) || 0,
          total_cost: (parseFloat(li.quantity) || 0) * (parseFloat(li.unit_cost) || 0),
        }))
      await createPO.mutateAsync({ po, lineItems: items })
      toast.success('Purchase order created')
      setPoModalOpen(false)
      setPoForm({ vendor_name: '', description: '', status: 'draft', required_date: '', delivery_address: '', notes: '', is_long_lead: false, lead_time_weeks: '', needed_on_site_date: '', tax: '', shipping: '' })
      setLineItems([{ ...emptyLineItem }])
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleDeletePO = async (po: Record<string, unknown>) => {
    if (!projectId) return
    if (!window.confirm(`Delete PO #${po.po_number || ''}? This cannot be undone.`)) return
    try {
      await deletePO.mutateAsync({ id: po.id as string, projectId })
      toast.success('Purchase order deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete PO')
    }
  }

  // ── Delivery Form ──────────────────────────────────────────
  const [deliveryForm, setDeliveryForm] = useState({
    purchase_order_id: '', expected_date: '', vendor: '',
    po_number: '', status: 'scheduled', receiving_notes: '',
  })

  const handleCreateDelivery = async () => {
    if (!projectId || !deliveryForm.vendor.trim()) {
      toast.error('Vendor is required')
      return
    }
    try {
      const selectedPO = (pos || []).find((po: Record<string, unknown>) => po.id === deliveryForm.purchase_order_id) as Record<string, unknown> | undefined
      await createDelivery.mutateAsync({
        project_id: projectId,
        purchase_order_id: deliveryForm.purchase_order_id || null,
        vendor: deliveryForm.vendor.trim(),
        po_number: deliveryForm.po_number || (selectedPO?.po_number ? String(selectedPO.po_number) : null),
        expected_date: deliveryForm.expected_date || new Date().toISOString().split('T')[0],
        status: deliveryForm.status,
        receiving_notes: deliveryForm.receiving_notes || null,
        created_by: user?.id,
      })
      toast.success('Delivery logged')
      setDeliveryModalOpen(false)
      setDeliveryForm({ purchase_order_id: '', expected_date: '', vendor: '', po_number: '', status: 'scheduled', receiving_notes: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  const handleDeleteDelivery = async (d: Record<string, unknown>) => {
    if (!projectId) return
    if (!window.confirm('Delete this delivery? This cannot be undone.')) return
    try {
      await deleteDelivery.mutateAsync({ id: d.id as string, projectId })
      toast.success('Delivery deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete delivery')
    }
  }

  // ── Material Form ──────────────────────────────────────────
  const [materialForm, setMaterialForm] = useState({
    name: '', category: '', quantity_on_hand: '', unit: '', location: '', minimum_quantity: '',
  })

  const handleCreateMaterial = async () => {
    if (!projectId || !materialForm.name) {
      toast.error('Material name is required')
      return
    }
    try {
      await createMaterial.mutateAsync({
        project_id: projectId,
        name: materialForm.name,
        category: materialForm.category || null,
        quantity_on_hand: parseFloat(materialForm.quantity_on_hand) || 0,
        unit: materialForm.unit || null,
        location: materialForm.location || null,
        minimum_quantity: materialForm.minimum_quantity ? parseFloat(materialForm.minimum_quantity) : null,
      })
      toast.success('Material added')
      setMaterialModalOpen(false)
      setMaterialForm({ name: '', category: '', quantity_on_hand: '', unit: '', location: '', minimum_quantity: '' })
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'))
    }
  }

  // ── KPIs ────────────────────────────────────────────────────

  const totalPOValue = useMemo(() => {
    return pos?.reduce((sum: number, po: Record<string, unknown>) => sum + ((po.total as number) || 0), 0) || 0
  }, [pos])

  const openOrders = useMemo(() => {
    return pos?.filter((po: Record<string, unknown>) => po.status !== 'received' && po.status !== 'complete' && po.status !== 'cancelled').length || 0
  }, [pos])

  const pendingDeliveries = useMemo(() => {
    return deliveries?.filter((d: Record<string, unknown>) => d.status !== 'delivered' && d.status !== 'received').length || 0
  }, [deliveries])

  const lowStockItems = useMemo(() => {
    return inventory?.filter((item: Record<string, unknown>) => item.quantity_on_hand != null && item.minimum_quantity != null && (item.quantity_on_hand as number) < (item.minimum_quantity as number)).length || 0
  }, [inventory])

  // ── Tab actions ─────────────────────────────────────────────

  const addButtonLabel: Record<TabKey, string> = {
    orders: 'New PO',
    deliveries: 'Log Delivery',
    inventory: 'Add Material',
    matching: '',
    requisitions: 'New Requisition',
  }

  const handleAdd = () => {
    if (activeTab === 'orders') setPoModalOpen(true)
    else if (activeTab === 'deliveries') setDeliveryModalOpen(true)
    else setMaterialModalOpen(true)
  }

  // ── Column definitions (with actions) ─────────────────────

  const poCol = createColumnHelper<Record<string, unknown>>()
  const poColumns = useMemo(() => [
    poCol.accessor('po_number', {
      header: 'PO #',
      cell: (info) => (
        <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>
          {info.getValue() as string}
        </span>
      ),
    }),
    poCol.accessor('vendor_name', {
      header: 'Vendor',
      cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue() as string}</span>,
    }),
    poCol.accessor('description', {
      header: 'Description',
      cell: (info) => (
        <span style={{ color: colors.textSecondary, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {info.getValue() as string}
        </span>
      ),
    }),
    poCol.accessor('status', {
      header: 'Status',
      cell: (info) => statusBadge(info.getValue() as string),
    }),
    poCol.accessor('total', {
      header: 'Total',
      cell: (info) => (
        <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          {formatCurrency(info.getValue() as number)}
        </span>
      ),
    }),
    poCol.accessor('required_date', {
      header: 'Required Date',
      cell: (info) => (
        <span style={{ color: colors.textSecondary }}>
          {info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : ''}
        </span>
      ),
    }),
    poCol.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const row = info.row.original
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PermissionGate permission="budget.edit">
              <Btn size="sm" variant="ghost" onClick={() => handleDeletePO(row)} disabled={deletePO.isPending}>
                <Trash2 size={14} />
              </Btn>
            </PermissionGate>
          </div>
        )
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [deletePO.isPending, projectId])

  const deliveryCol = createColumnHelper<Record<string, unknown>>()
  const deliveryColumns = useMemo(() => [
    deliveryCol.accessor((row) => (row.vendor as string) || (row.supplier as string) || (row.carrier as string) || '—', {
      id: 'vendor',
      header: 'Vendor',
      cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue() as string}</span>,
    }),
    deliveryCol.accessor('po_number', {
      header: 'PO #',
      cell: (info) => {
        const row = info.row.original
        const poNum = (info.getValue() as string) || (row.purchase_order_id ? String(row.purchase_order_id).slice(0, 8) : '')
        return (
          <span style={{ color: colors.textTertiary, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>
            {poNum || '—'}
          </span>
        )
      },
    }),
    deliveryCol.accessor((row) => (row.expected_date as string) || (row.delivery_date as string), {
      id: 'eta',
      header: 'ETA',
      cell: (info) => {
        const v = info.getValue() as string | undefined
        return (
          <span style={{ color: colors.textSecondary }}>
            {v ? new Date(v).toLocaleDateString() : '—'}
          </span>
        )
      },
    }),
    deliveryCol.accessor((row) => (row.actual_date as string) || (row.delivery_date as string), {
      id: 'received',
      header: 'Received',
      cell: (info) => {
        const row = info.row.original
        const status = String(row.status || '').toLowerCase()
        const received = (row.actual_date as string) || (status === 'delivered' || status === 'received' ? (row.delivery_date as string) : null)
        if (received) {
          return <span style={{ color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>{new Date(received).toLocaleDateString()}</span>
        }
        const expected = (row.expected_date as string) || (row.delivery_date as string)
        if (expected) {
          const exp = new Date(expected)
          exp.setHours(0, 0, 0, 0)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          if (today.getTime() > exp.getTime() && status !== 'cancelled') {
            const daysLate = Math.round((today.getTime() - exp.getTime()) / 86400000)
            return (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                color: colors.statusCritical, backgroundColor: colors.statusCriticalSubtle,
              }}>
                <AlertTriangle size={10} /> Missing · {daysLate}d late
              </span>
            )
          }
        }
        return <span style={{ color: colors.textTertiary }}>—</span>
      },
    }),
    deliveryCol.accessor('status', {
      header: 'Status',
      cell: (info) => statusBadge(info.getValue() as string),
    }),
    deliveryCol.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const row = info.row.original
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PermissionGate permission="budget.edit">
              <Btn size="sm" variant="ghost" onClick={() => handleDeleteDelivery(row)} disabled={deleteDelivery.isPending}>
                <Trash2 size={14} />
              </Btn>
            </PermissionGate>
          </div>
        )
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [deleteDelivery.isPending, projectId])

  const inventoryCol = createColumnHelper<Record<string, unknown>>()
  const inventoryColumns = useMemo(() => [
    inventoryCol.accessor('name', {
      header: 'Name',
      cell: (info) => <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{info.getValue() as string}</span>,
    }),
    inventoryCol.accessor('category', {
      header: 'Category',
      cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
    }),
    inventoryCol.accessor('quantity_on_hand', {
      header: 'Quantity',
      cell: (info) => {
        const row = info.row.original
        const qty = info.getValue() as number | null
        const minQty = row.minimum_quantity as number | null
        const isLow = qty != null && minQty != null && qty < minQty
        return (
          <span style={{ fontWeight: typography.fontWeight.semibold, color: isLow ? colors.statusCritical : colors.textPrimary }}>
            {qty ?? 0}
          </span>
        )
      },
    }),
    inventoryCol.accessor('unit', {
      header: 'Unit',
      cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
    }),
    inventoryCol.accessor('location', {
      header: 'Location',
      cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
    }),
    inventoryCol.accessor('minimum_quantity', {
      header: 'Min Qty',
      cell: (info) => <span style={{ color: colors.textTertiary }}>{(info.getValue() as number) ?? 'N/A'}</span>,
    }),
    inventoryCol.accessor('last_counted_date', {
      header: 'Last Counted',
      cell: (info) => (
        <span style={{ color: colors.textSecondary }}>
          {info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : 'Never'}
        </span>
      ),
    }),
  ], [])

  // ── Render ──────────────────────────────────────────────────

  return (
    <PageContainer
      title="Procurement"
      subtitle="Purchase orders, deliveries, and material inventory tracking"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Procurement_Report" />
          {addButtonLabel[activeTab] && (
          <PermissionGate permission="budget.edit">
          <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd}>
            {addButtonLabel[activeTab]}
          </Btn>
          </PermissionGate>
          )}
        </div>
      }
    >
      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
        <MetricBox label="Total PO Value" value={formatCurrency(totalPOValue)} />
        <MetricBox label="Open Orders" value={openOrders} change={openOrders > 5 ? -1 : 1} />
        <MetricBox label="Pending Deliveries" value={pendingDeliveries} />
        <MetricBox label="Low Stock Items" value={lowStockItems} change={lowStockItems > 0 ? -1 : 1} changeLabel={lowStockItems > 0 ? 'below minimum' : 'all stocked'} />
      </div>

      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="Procurement sections"
        style={{
          display: 'flex',
          gap: spacing['1'],
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.lg,
          padding: spacing['1'],
          marginBottom: spacing['2xl'],
          overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `0 ${spacing['4']}`,
                minHeight: touchTarget.field,
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
              {React.createElement(Icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* Purchase Orders Tab */}
      {activeTab === 'orders' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Purchase Orders" />
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable
              columns={poColumns}
              data={pos || []}
              emptyMessage="No purchase orders yet. Create your first PO to start tracking materials and services."
            />
          </div>
        </Card>
      )}

      {/* Deliveries Tab */}
      {activeTab === 'deliveries' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Deliveries" />
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable
              columns={deliveryColumns}
              data={deliveries || []}
              emptyMessage="No deliveries logged yet. Deliveries appear here once purchase orders are fulfilled."
            />
          </div>
        </Card>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Material Inventory" />
          <div style={{ marginTop: spacing['3'] }}>
            <DataTable
              columns={inventoryColumns}
              data={inventory || []}
              emptyMessage="No inventory items tracked. Add materials to monitor stock levels and flag low quantities."
            />
          </div>
        </Card>
      )}

      {/* ── PO Approval Workflow (shown below PO table) ──────── */}
      {activeTab === 'orders' && !isLoading && (
        <Card padding={spacing['4']} style={{ marginTop: spacing['4'] }}>
          <SectionHeader title="PO Approval Pipeline" />
          {approvalPOs.length === 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <EmptyState
                icon={FileText}
                title="No Purchase Orders to Approve"
                description="Create purchase orders above to see them flow through the approval pipeline. POs are automatically mapped to approval stages based on their status."
              />
            </div>
          ) : (
            <div style={{ marginTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {approvalPOs.map((apo) => {
                const isExpanded = selectedApprovalPO === apo.id
                const vendorScore = vendorScores[apo.vendor_name] || null
                return (
                  <div key={apo.id} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
                    <div
                      onClick={() => setSelectedApprovalPO(isExpanded ? null : apo.id)}
                      style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 120px 180px auto', gap: spacing['3'], alignItems: 'center', padding: spacing['3'], cursor: 'pointer', backgroundColor: isExpanded ? colors.surfaceInset : colors.surfaceRaised }}
                    >
                      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>{apo.po_number}</span>
                      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{apo.vendor_name}</span>
                      <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{formatCurrency(apo.total)}</span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, backgroundColor: colors.surfaceInset, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, textAlign: 'center' }}>{getApprovalThreshold(apo.total)}</span>
                      <ApprovalPipeline stage={apo.approval_stage} />
                      <ChevronRight size={14} style={{ color: colors.textTertiary, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: `transform ${transitions.instant}` }} />
                    </div>
                    {isExpanded && (
                      <div style={{ padding: spacing['3'], borderTop: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised }}>
                        {/* Vendor Scorecard — computed from real delivery data */}
                        {vendorScore ? (
                          <VendorScorecard score={vendorScore} />
                        ) : (
                          <VendorScorecardEmpty />
                        )}
                        {/* Approval Actions */}
                        <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['3'], alignItems: 'center' }}>
                          {apo.approval_stage === 'draft' && (
                            <Btn size="sm" variant="primary" icon={<FileText size={14} />} onClick={() => {
                              updateApproval(apo.id, 'submitted', { name: user?.email || 'Current User', date: new Date().toISOString().split('T')[0], action: 'Submitted', comments: '' })
                              toast.success(`${apo.po_number} submitted for approval`)
                            }}>Submit for Approval</Btn>
                          )}
                          {apo.approval_stage === 'submitted' && (
                            <>
                              <Btn size="sm" variant="primary" icon={<CheckCircle size={14} />} onClick={() => {
                                const nextStage: ApprovalStage = apo.total <= 25000 ? 'issued' : 'pm_approved'
                                updateApproval(apo.id, nextStage, { name: user?.email || 'PM', date: new Date().toISOString().split('T')[0], action: 'Approved', comments: '' })
                                toast.success(`${apo.po_number} approved by PM`)
                              }}>Approve (PM)</Btn>
                              <Btn size="sm" variant="ghost" icon={<XCircle size={14} />} onClick={() => {
                                updateApproval(apo.id, 'draft', { name: user?.email || 'PM', date: new Date().toISOString().split('T')[0], action: 'Rejected', comments: 'Needs revised scope' })
                                toast.error(`${apo.po_number} rejected`)
                              }}>Reject</Btn>
                            </>
                          )}
                          {apo.approval_stage === 'pm_approved' && (
                            <>
                              <Btn size="sm" variant="primary" icon={<CheckCircle size={14} />} onClick={() => {
                                const nextStage: ApprovalStage = apo.total <= 100000 ? 'issued' : 'director_approved'
                                updateApproval(apo.id, nextStage, { name: user?.email || 'Director', date: new Date().toISOString().split('T')[0], action: 'Approved', comments: '' })
                                toast.success(`${apo.po_number} approved by Director`)
                              }}>Approve (Director)</Btn>
                              <Btn size="sm" variant="ghost" icon={<XCircle size={14} />} onClick={() => {
                                updateApproval(apo.id, 'submitted', { name: user?.email || 'Director', date: new Date().toISOString().split('T')[0], action: 'Rejected', comments: 'Exceeds approved budget line' })
                                toast.error(`${apo.po_number} rejected by Director`)
                              }}>Reject</Btn>
                            </>
                          )}
                          {apo.approval_stage === 'director_approved' && (
                            <Btn size="sm" variant="primary" icon={<CheckCircle size={14} />} onClick={() => {
                              updateApproval(apo.id, 'issued', { name: user?.email || 'Owner Rep', date: new Date().toISOString().split('T')[0], action: 'Approved', comments: 'Final approval granted' })
                              toast.success(`${apo.po_number} issued!`)
                            }}>Approve (Owner) & Issue</Btn>
                          )}
                          {apo.approval_stage === 'issued' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.medium }}><CheckCircle size={14} /> Fully Approved & Issued</span>
                          )}
                        </div>
                        {/* Approval History */}
                        {apo.approval_history.length > 0 && (
                          <div style={{ marginTop: spacing['3'] }}>
                            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, display: 'block', marginBottom: spacing['1'] }}>Approval History</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                              {apo.approval_history.map((h, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textSecondary, padding: `${spacing['1']} 0`, borderBottom: i < apo.approval_history.length - 1 ? `1px solid ${colors.borderLight}` : 'none' }}>
                                  <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, minWidth: 140 }}>{h.name}</span>
                                  <span style={{ color: colors.textTertiary, minWidth: 80 }}>{h.date}</span>
                                  <span style={{ color: h.action === 'Rejected' ? colors.statusCritical : h.action === 'Approved' || h.action === 'Auto-Approved' ? colors.statusActive : colors.statusPending, fontWeight: typography.fontWeight.medium }}>{h.action}</span>
                                  {h.comments && <span style={{ color: colors.textTertiary, fontStyle: 'italic' }}>— {h.comments}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Three-Way Match Tab ────────────────────────────────── */}
      {activeTab === 'matching' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Three-Way Match: PO vs Receiving vs Invoice" />
          {matchLines.length === 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <EmptyState
                icon={ShieldCheck}
                title="No Line Items to Match"
                description="Create purchase orders with line items to enable three-way matching. Line items from your POs will be compared against received quantities and invoiced amounts."
              />
            </div>
          ) : (
            (() => {
              const matchedCount = matchLines.filter(l => l.status === 'matched').length
              const totalVariance = matchLines.reduce((sum, l) => {
                const poTotal = l.poQty * l.poPrice
                const invTotal = l.invoicedQty * l.invoicedPrice
                return sum + Math.abs(poTotal - invTotal)
              }, 0)
              const hasMajor = matchLines.some(l => l.status === 'price_mismatch' || (l.status === 'qty_mismatch' && Math.abs(l.poQty - l.receivedQty) > l.poQty * 0.1))
              return (
                <>
                  {/* Summary Bar */}
                  <div style={{ display: 'flex', gap: spacing['4'], alignItems: 'center', padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, marginTop: spacing['3'], marginBottom: spacing['3'] }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                      <CheckCircle size={16} color={colors.statusActive} />
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{matchedCount} of {matchLines.length} lines matched</span>
                    </div>
                    <div style={{ height: 16, width: 1, backgroundColor: colors.borderLight }} />
                    <div>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Total Variance: </span>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: totalVariance > 0 ? colors.statusCritical : colors.statusActive }}>{formatCurrency(totalVariance)}</span>
                    </div>
                    <div style={{ flex: 1 }} />
                    {!hasMajor && totalVariance > 0 && (
                      <Btn size="sm" variant="secondary" icon={<CheckCircle size={14} />} onClick={() => toast.success('Variance approved — invoice cleared for payment')}>Approve with Variance</Btn>
                    )}
                    {hasMajor && (
                      <Btn size="sm" variant="ghost" icon={<AlertTriangle size={14} />} onClick={() => toast.info('Flagged for review — AP team notified')} style={{ color: colors.statusCritical }}>Flag for Review</Btn>
                    )}
                  </div>
                  {/* Match Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${colors.borderLight}` }}>
                          {['Item', 'PO Qty', 'PO Price', 'Received Qty', 'Invoiced Qty', 'Invoiced Price', 'Variance', 'Status'].map(h => (
                            <th key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'left', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matchLines.map((line, idx) => {
                          const poLineTotal = line.poQty * line.poPrice
                          const invLineTotal = line.invoicedQty * line.invoicedPrice
                          const variance = invLineTotal - poLineTotal
                          return (
                            <tr key={idx} style={{ borderBottom: `1px solid ${colors.borderLight}`, backgroundColor: idx % 2 === 0 ? 'transparent' : colors.surfaceInset }}>
                              <td style={{ padding: `${spacing['2']} ${spacing['3']}`, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{line.item}</td>
                              <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{line.poQty}</td>
                              <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{formatCurrency(line.poPrice)}</td>
                              <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: line.receivedQty !== line.poQty ? colors.statusPending : colors.textSecondary, fontWeight: line.receivedQty !== line.poQty ? typography.fontWeight.semibold : typography.fontWeight.normal }}>{line.receivedQty}</td>
                              <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{line.invoicedQty}</td>
                              <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: line.invoicedPrice !== line.poPrice ? colors.statusCritical : colors.textSecondary, fontWeight: line.invoicedPrice !== line.poPrice ? typography.fontWeight.semibold : typography.fontWeight.normal }}>{formatCurrency(line.invoicedPrice)}</td>
                              <td style={{ padding: `${spacing['2']} ${spacing['3']}`, fontWeight: typography.fontWeight.semibold, color: variance === 0 ? colors.textTertiary : variance > 0 ? colors.statusCritical : colors.statusActive }}>{variance === 0 ? '—' : formatCurrency(variance)}</td>
                              <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>{matchStatusBadge(line.status)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            })()
          )}
        </Card>
      )}

      {/* ── Requisitions Tab ──────────────────────────────────── */}
      {activeTab === 'requisitions' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Material Requisitions" />
          {requisitions.length === 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <EmptyState
                icon={ClipboardList}
                title="No Material Requisitions"
                description="Material requisitions will appear here when field teams submit requests for materials. Use the 'New Requisition' button to create a requisition that can be converted into a purchase order."
              />
            </div>
          ) : (
            <div style={{ marginTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {requisitions.map((req) => (
                <div key={req.id} style={{ display: 'grid', gridTemplateColumns: '90px 130px 90px 1fr 90px 80px auto', gap: spacing['3'], alignItems: 'center', padding: spacing['3'], border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.base, backgroundColor: colors.surfaceRaised }}>
                  <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText, fontSize: typography.fontSize.sm }}>{req.id}</span>
                  <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>{req.requester}</span>
                  <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>{new Date(req.date).toLocaleDateString()}</span>
                  <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.items}</span>
                  {urgencyBadge(req.urgency)}
                  {statusBadge(req.status)}
                  <div style={{ display: 'flex', gap: spacing['1'], justifyContent: 'flex-end' }}>
                    {req.status === 'open' && (
                      <Btn size="sm" variant="primary" onClick={() => {
                        setRequisitions(prev => prev.map(r => r.id === req.id ? { ...r, status: 'converted' as ReqStatus, converted_po: `PO-${2045 + Math.floor(Math.random() * 10)}` } : r))
                        toast.success(`${req.id} converted to PO — items pre-filled`)
                      }}>Convert to PO</Btn>
                    )}
                    {req.status === 'converted' && req.converted_po && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: typography.fontSize.caption, color: colors.statusActive }}>
                        <ArrowRight size={12} /> {req.converted_po}
                      </span>
                    )}
                    {req.status === 'cancelled' && (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontStyle: 'italic' }}>Cancelled</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Create PO Modal ─────────────────────────────────── */}
      <Modal open={poModalOpen} onClose={() => setPoModalOpen(false)} title="Create Purchase Order" width="720px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Vendor Name" value={poForm.vendor_name} onChange={(v) => setPoForm({ ...poForm, vendor_name: v })} placeholder="ABC Supplies" required />
            <div>
              <label style={labelStyle}>Status</label>
              <select value={poForm.status} onChange={(e) => setPoForm({ ...poForm, status: e.target.value })} style={selectStyle}>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="ordered">Ordered</option>
              </select>
            </div>
          </div>
          <InputField label="Description" value={poForm.description} onChange={(v) => setPoForm({ ...poForm, description: v })} placeholder="Materials for Phase 2" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Required Date" type="date" value={poForm.required_date} onChange={(v) => setPoForm({ ...poForm, required_date: v })} />
            <InputField label="Needed On Site" type="date" value={poForm.needed_on_site_date} onChange={(v) => setPoForm({ ...poForm, needed_on_site_date: v })} />
            <InputField label="Lead Time (weeks)" value={poForm.lead_time_weeks} onChange={(v) => setPoForm({ ...poForm, lead_time_weeks: v })} placeholder="0" />
          </div>
          <InputField label="Delivery Address" value={poForm.delivery_address} onChange={(v) => setPoForm({ ...poForm, delivery_address: v })} placeholder="123 Job Site Rd" />
          {/* Vendor Scorecard in PO Creation — computed from real delivery data */}
          {poForm.vendor_name && vendorScores[poForm.vendor_name] && (
            <VendorScorecard score={vendorScores[poForm.vendor_name]} />
          )}
          {poForm.vendor_name && vendorScores[poForm.vendor_name] && vendorScores[poForm.vendor_name].rating < 3.5 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['2'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
              <AlertTriangle size={14} /> Warning: This vendor has a low performance rating. Consider alternative suppliers.
            </div>
          )}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} rows={2} style={textareaStyle} />
          </div>
          <div style={{ display: 'flex', gap: spacing['4'] }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
              <input type="checkbox" checked={poForm.is_long_lead} onChange={(e) => setPoForm({ ...poForm, is_long_lead: e.target.checked })} /> Long lead item
            </label>
          </div>

          {/* Line Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] }}>
              <label style={{ ...labelStyle, marginBottom: 0, fontWeight: typography.fontWeight.medium }}>Line Items</label>
              <Btn size="sm" variant="secondary" icon={<Plus size={12} />} onClick={addLineItem}>Add Line</Btn>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {lineItems.map((li, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: spacing['2'], alignItems: 'end' }}>
                  <InputField label={idx === 0 ? 'Description' : undefined} value={li.description} onChange={(v) => updateLineItem(idx, 'description', v)} placeholder="Item description" />
                  <InputField label={idx === 0 ? 'Qty' : undefined} value={li.quantity} onChange={(v) => updateLineItem(idx, 'quantity', v)} placeholder="0" />
                  <InputField label={idx === 0 ? 'Unit' : undefined} value={li.unit} onChange={(v) => updateLineItem(idx, 'unit', v)} placeholder="ea" />
                  <InputField label={idx === 0 ? 'Unit Cost' : undefined} value={li.unit_cost} onChange={(v) => updateLineItem(idx, 'unit_cost', v)} placeholder="0.00" />
                  <Btn size="sm" variant="ghost" onClick={() => removeLineItem(idx)} disabled={lineItems.length <= 1}>
                    <Trash2 size={14} />
                  </Btn>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: spacing['3'], padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
            <div>
              <label style={labelStyle}>Subtotal</label>
              <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{formatCurrency(subtotal)}</span>
            </div>
            <InputField label="Tax" value={poForm.tax} onChange={(v) => setPoForm({ ...poForm, tax: v })} placeholder="0.00" />
            <InputField label="Shipping" value={poForm.shipping} onChange={(v) => setPoForm({ ...poForm, shipping: v })} placeholder="0.00" />
            <div>
              <label style={labelStyle}>Total</label>
              <span style={{ fontWeight: typography.fontWeight.bold, color: colors.orangeText, fontSize: typography.fontSize.lg }}>{formatCurrency(poTotal)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setPoModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreatePO} loading={createPO.isPending}>Create PO</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Log Delivery Modal ──────────────────────────────── */}
      <Modal open={deliveryModalOpen} onClose={() => setDeliveryModalOpen(false)} title="Log Delivery" width="600px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div>
            <label style={labelStyle}>Purchase Order (optional)</label>
            <select
              value={deliveryForm.purchase_order_id}
              onChange={(e) => {
                const poId = e.target.value
                const selectedPO = (pos || []).find((po: Record<string, unknown>) => po.id === poId) as Record<string, unknown> | undefined
                setDeliveryForm({
                  ...deliveryForm,
                  purchase_order_id: poId,
                  vendor: selectedPO?.vendor_name ? String(selectedPO.vendor_name) : deliveryForm.vendor,
                  po_number: selectedPO?.po_number ? String(selectedPO.po_number) : deliveryForm.po_number,
                })
              }}
              style={selectStyle}
            >
              <option value="">No PO — ad-hoc delivery</option>
              {(pos || []).map((po: Record<string, unknown>) => (
                <option key={po.id as string} value={po.id as string}>
                  PO #{po.po_number} - {po.vendor_name as string}
                </option>
              ))}
            </select>
          </div>
          <InputField label="Vendor" value={deliveryForm.vendor} onChange={(v) => setDeliveryForm({ ...deliveryForm, vendor: v })} placeholder="ABC Supply Co." required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="ETA (Expected Date)" type="date" value={deliveryForm.expected_date} onChange={(v) => setDeliveryForm({ ...deliveryForm, expected_date: v })} />
            <div>
              <label style={labelStyle}>Status</label>
              <select value={deliveryForm.status} onChange={(e) => setDeliveryForm({ ...deliveryForm, status: e.target.value })} style={selectStyle}>
                <option value="scheduled">Scheduled</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="delayed">Delayed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <InputField label="PO Number (if no PO selected above)" value={deliveryForm.po_number} onChange={(v) => setDeliveryForm({ ...deliveryForm, po_number: v })} placeholder="Manual PO reference" />
          <div>
            <label style={labelStyle}>Receiving Notes</label>
            <textarea value={deliveryForm.receiving_notes} onChange={(e) => setDeliveryForm({ ...deliveryForm, receiving_notes: e.target.value })} rows={3} style={textareaStyle} placeholder="Condition of materials, any damage noted..." />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setDeliveryModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateDelivery} loading={createDelivery.isPending}>Log Delivery</Btn>
          </div>
        </div>
      </Modal>

      {/* ── Add Material Modal ──────────────────────────────── */}
      <Modal open={materialModalOpen} onClose={() => setMaterialModalOpen(false)} title="Add Material" width="600px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Material Name" value={materialForm.name} onChange={(v) => setMaterialForm({ ...materialForm, name: v })} placeholder="2x4 Lumber" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Category" value={materialForm.category} onChange={(v) => setMaterialForm({ ...materialForm, category: v })} placeholder="Lumber, Electrical, etc." />
            <InputField label="Unit" value={materialForm.unit} onChange={(v) => setMaterialForm({ ...materialForm, unit: v })} placeholder="pcs, lbs, ft" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Quantity on Hand" value={materialForm.quantity_on_hand} onChange={(v) => setMaterialForm({ ...materialForm, quantity_on_hand: v })} placeholder="0" />
            <InputField label="Minimum Quantity" value={materialForm.minimum_quantity} onChange={(v) => setMaterialForm({ ...materialForm, minimum_quantity: v })} placeholder="0" />
          </div>
          <InputField label="Location" value={materialForm.location} onChange={(v) => setMaterialForm({ ...materialForm, location: v })} placeholder="Trailer 2, Shelf B" />
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setMaterialModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateMaterial} loading={createMaterial.isPending}>Add Material</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Procurement
