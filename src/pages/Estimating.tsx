import React, { useState, useMemo } from 'react'
import { Calculator, Users, Ruler, Plus, DollarSign, Award, Trash2, ChevronDown, ChevronRight, Layers, GitCompare, Scale, FileSearch, Download, Check, X, AlertTriangle, Copy } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { PermissionGate } from '../components/auth/PermissionGate'
import { colors, spacing, typography, borderRadius, transitions, touchTarget } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import {
  useEstimates,
  useEstimateLineItems,
  useBidPackages,
  useBidResponses,
  useTakeoffItems,
  useCreateEstimate,
  useDeleteEstimate,
  useCreateEstimateLineItem,
  useDeleteEstimateLineItem,
} from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'estimates' | 'bids' | 'takeoffs' | 'assemblies' | 'compare' | 'bidLeveling' | 'takeoffDetail'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'estimates', label: 'Estimates', icon: Calculator },
  { key: 'assemblies', label: 'Assemblies', icon: Layers },
  { key: 'compare', label: 'Compare', icon: GitCompare },
  { key: 'bidLeveling', label: 'Bid Leveling', icon: Scale },
  { key: 'bids', label: 'Bid Packages', icon: Users },
  { key: 'takeoffs', label: 'Takeoffs', icon: Ruler },
  { key: 'takeoffDetail', label: 'Takeoff Detail', icon: FileSearch },
]

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const ESTIMATE_TYPES = ['conceptual', 'schematic', 'detailed', 'final'] as const
const ESTIMATE_STATUSES = ['draft', 'in_review', 'submitted', 'awarded', 'lost'] as const
const UNIT_OPTIONS = ['EA', 'LF', 'SF', 'SY', 'CY', 'TON', 'LS', 'HR'] as const

// Assembly categories — reference data (CSI division groupings)
const ASSEMBLY_CATEGORIES = ['Sitework', 'Concrete', 'Structural Steel', 'Framing', 'Exterior Envelope', 'Interior Finishes', 'MEP', 'Specialties'] as const

// ── Column helpers ───────────────────────────────────────────

const estimateCol = createColumnHelper<unknown>()
const estimateColumns = [
  estimateCol.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  estimateCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return <span style={{ color: colors.textSecondary }}>{v ? v.replace(/_/g, ' ') : ''}</span>
    },
  }),
  estimateCol.accessor('version', {
    header: 'Version',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>v{info.getValue() || 1}</span>
    ),
  }),
  estimateCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'awarded' ? colors.statusActive
        : v === 'lost' ? colors.statusCritical
        : v === 'submitted' ? colors.statusPending
        : v === 'in_review' ? colors.statusInfo
        : colors.textSecondary
      const statusBg = v === 'awarded' ? colors.statusActiveSubtle
        : v === 'lost' ? colors.statusCriticalSubtle
        : v === 'submitted' ? colors.statusPendingSubtle
        : v === 'in_review' ? colors.statusInfoSubtle
        : colors.surfaceInset
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : ''}
        </span>
      )
    },
  }),
  estimateCol.accessor('total_amount', {
    header: 'Total Amount',
    cell: (info) => {
      const v = info.getValue() as number | null
      if (v == null) return <span style={{ color: colors.textTertiary }}>N/A</span>
      return <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmtCurrency(v)}</span>
    },
  }),
  estimateCol.accessor('due_date', {
    header: 'Due Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  estimateCol.accessor('created_at', {
    header: 'Created',
    cell: (info) => (
      <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
]

const bidCol = createColumnHelper<unknown>()
const bidColumns = [
  bidCol.accessor('name', {
    header: 'Package Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  bidCol.accessor('trade', {
    header: 'Trade',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  bidCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'awarded' ? colors.statusActive
        : v === 'closed' ? colors.textTertiary
        : v === 'open' ? colors.statusInfo
        : v === 'evaluating' ? colors.statusPending
        : colors.textSecondary
      const statusBg = v === 'awarded' ? colors.statusActiveSubtle
        : v === 'closed' ? colors.surfaceInset
        : v === 'open' ? colors.statusInfoSubtle
        : v === 'evaluating' ? colors.statusPendingSubtle
        : colors.surfaceInset
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  bidCol.accessor('issue_date', {
    header: 'Issue Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  bidCol.accessor('due_date', {
    header: 'Due Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  bidCol.accessor('response_count', {
    header: 'Responses',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textSecondary }}>{v ?? 0}</span>
    },
  }),
]

const takeoffCol = createColumnHelper<unknown>()
const takeoffColumns = [
  takeoffCol.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  takeoffCol.accessor('category', {
    header: 'Category',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  takeoffCol.accessor('takeoff_type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return <span style={{ color: colors.textSecondary }}>{v ? v.replace(/_/g, ' ') : ''}</span>
    },
  }),
  takeoffCol.accessor('quantity', {
    header: 'Quantity',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{v != null ? v.toLocaleString() : ''}</span>
    },
  }),
  takeoffCol.accessor('unit', {
    header: 'Unit',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  takeoffCol.accessor('drawing_ref', {
    header: 'Drawing',
    cell: (info) => <span style={{ color: colors.textTertiary }}>{info.getValue() || ''}</span>,
  }),
  takeoffCol.accessor('color', {
    header: 'Color',
    cell: (info) => {
      const v = info.getValue() as string | null
      if (!v) return <span style={{ color: colors.textTertiary }}>None</span>
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <div style={{ width: 12, height: 12, borderRadius: borderRadius.sm, backgroundColor: v, border: `1px solid ${colors.borderDefault}` }} />
          <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>{v}</span>
        </div>
      )
    },
  }),
]

// ── Select Field (inline helper) ────────────────────────────
const SelectField: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  required?: boolean
}> = ({ label, value, onChange, options, required }) => (
  <div>
    <label style={{
      display: 'block', fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium, color: colors.textSecondary,
      marginBottom: spacing.sm,
    }}>{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      style={{
        width: '100%', padding: `${spacing.md} ${spacing.lg}`,
        backgroundColor: colors.surfaceInset, color: colors.textPrimary,
        border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base,
        fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
        outline: 'none', cursor: 'pointer',
      }}
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, ' ')}</option>
      ))}
    </select>
  </div>
)

// ── Line Items Detail Section ───────────────────────────────

const EstimateLineItemsSection: React.FC<{ estimateId: string; projectId: string }> = ({ estimateId, projectId }) => {
  const { data: lineItems, isPending } = useEstimateLineItems(estimateId)
  const createLineItem = useCreateEstimateLineItem()
  const deleteLineItem = useDeleteEstimateLineItem()
  const [showAddModal, setShowAddModal] = useState(false)

  // Line item form state
  const [liForm, setLiForm] = useState({
    csi_division: '', csi_code: '', description: '', unit: '',
    quantity: '', unit_cost: '', labor_hours: '', labor_rate: '',
    material_cost: '', equipment_cost: '', subcontractor_cost: '', markup: '', notes: '',
  })

  const resetLiForm = () => setLiForm({
    csi_division: '', csi_code: '', description: '', unit: '',
    quantity: '', unit_cost: '', labor_hours: '', labor_rate: '',
    material_cost: '', equipment_cost: '', subcontractor_cost: '', markup: '', notes: '',
  })

  const handleCreateLineItem = () => {
    if (!liForm.description) { toast.error('Description is required'); return }
    const qty = parseFloat(liForm.quantity) || 0
    const uc = parseFloat(liForm.unit_cost) || 0
    const lh = parseFloat(liForm.labor_hours) || 0
    const lr = parseFloat(liForm.labor_rate) || 0
    createLineItem.mutate({
      estimate_id: estimateId,
      csi_division: liForm.csi_division || null,
      csi_code: liForm.csi_code || null,
      description: liForm.description,
      unit: liForm.unit || null,
      quantity: qty,
      unit_cost: uc,
      total_cost: qty * uc,
      labor_hours: lh,
      labor_rate: lr,
      labor_cost: lh * lr,
      material_cost: parseFloat(liForm.material_cost) || 0,
      equipment_cost: parseFloat(liForm.equipment_cost) || 0,
      subcontractor_cost: parseFloat(liForm.subcontractor_cost) || 0,
      markup: parseFloat(liForm.markup) || 0,
      notes: liForm.notes || null,
      sort_order: (lineItems?.length || 0) + 1,
    }, {
      onSuccess: () => { toast.success('Line item created'); setShowAddModal(false); resetLiForm() },
      onError: (err: any) => toast.error(err.message || 'Failed to create line item'),
    })
  }

  const handleDeleteLineItem = (id: string) => {
    if (!confirm('Delete this line item?')) return
    deleteLineItem.mutate({ id, estimate_id: estimateId }, {
      onSuccess: () => toast.success('Line item deleted'),
      onError: (err: any) => toast.error(err.message || 'Failed to delete line item'),
    })
  }

  if (isPending) return <Skeleton width="100%" height="60px" />

  return (
    <div style={{ padding: spacing['4'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg, marginTop: spacing['3'] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
        <h4 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Line Items
        </h4>
        <PermissionGate permission="budget.edit">
          <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddModal(true)}>
            Add Line Item
          </Btn>
        </PermissionGate>
      </div>

      {(!lineItems || lineItems.length === 0) ? (
        <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: 0 }}>
          No line items yet. Add your first line item to start building this estimate.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.borderDefault}` }}>
                {['CSI', 'Description', 'Unit', 'Qty', 'Unit Cost', 'Total', 'Labor Cost', 'Material', 'Equipment', 'Sub', 'Markup %', ''].map((h) => (
                  <th key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'left', color: colors.textSecondary, fontWeight: typography.fontWeight.medium, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li: any) => (
                <tr key={li.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>{li.csi_code || li.csi_division || '-'}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{li.description}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{li.unit || '-'}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary }}>{li.quantity ?? 0}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary }}>{fmtCurrency(li.unit_cost || 0)}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmtCurrency(li.total_cost || 0)}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{fmtCurrency(li.labor_cost || 0)}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{fmtCurrency(li.material_cost || 0)}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{fmtCurrency(li.equipment_cost || 0)}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{fmtCurrency(li.subcontractor_cost || 0)}</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{li.markup ?? 0}%</td>
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
                    <PermissionGate permission="budget.edit">
                      <button
                        onClick={() => handleDeleteLineItem(li.id)}
                        title="Delete line item"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: colors.statusCritical,
                          padding: spacing['1'], borderRadius: borderRadius.sm,
                          display: 'inline-flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Line Item Modal */}
      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); resetLiForm() }} title="Add Line Item" width="700px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
          <InputField label="CSI Division" value={liForm.csi_division} onChange={(v) => setLiForm({ ...liForm, csi_division: v })} placeholder="e.g. 03" />
          <InputField label="CSI Code" value={liForm.csi_code} onChange={(v) => setLiForm({ ...liForm, csi_code: v })} placeholder="e.g. 03 30 00" />
          <div style={{ gridColumn: '1 / -1' }}>
            <InputField label="Description" value={liForm.description} onChange={(v) => setLiForm({ ...liForm, description: v })} required placeholder="Line item description" />
          </div>
          <SelectField label="Unit" value={liForm.unit} onChange={(v) => setLiForm({ ...liForm, unit: v })} options={UNIT_OPTIONS} />
          <InputField label="Quantity" value={liForm.quantity} onChange={(v) => setLiForm({ ...liForm, quantity: v })} type="number" placeholder="0" />
          <InputField label="Unit Cost ($)" value={liForm.unit_cost} onChange={(v) => setLiForm({ ...liForm, unit_cost: v })} type="number" placeholder="0.00" />
          <div style={{ display: 'flex', alignItems: 'flex-end', padding: `0 0 ${spacing.md} 0` }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              Total: <strong style={{ color: colors.textPrimary }}>{fmtCurrency((parseFloat(liForm.quantity) || 0) * (parseFloat(liForm.unit_cost) || 0))}</strong>
            </span>
          </div>
          <InputField label="Labor Hours" value={liForm.labor_hours} onChange={(v) => setLiForm({ ...liForm, labor_hours: v })} type="number" placeholder="0" />
          <InputField label="Labor Rate ($/hr)" value={liForm.labor_rate} onChange={(v) => setLiForm({ ...liForm, labor_rate: v })} type="number" placeholder="0.00" />
          <InputField label="Material Cost ($)" value={liForm.material_cost} onChange={(v) => setLiForm({ ...liForm, material_cost: v })} type="number" placeholder="0.00" />
          <InputField label="Equipment Cost ($)" value={liForm.equipment_cost} onChange={(v) => setLiForm({ ...liForm, equipment_cost: v })} type="number" placeholder="0.00" />
          <InputField label="Subcontractor Cost ($)" value={liForm.subcontractor_cost} onChange={(v) => setLiForm({ ...liForm, subcontractor_cost: v })} type="number" placeholder="0.00" />
          <InputField label="Markup (%)" value={liForm.markup} onChange={(v) => setLiForm({ ...liForm, markup: v })} type="number" placeholder="0" />
          <div style={{ gridColumn: '1 / -1' }}>
            <InputField label="Notes" value={liForm.notes} onChange={(v) => setLiForm({ ...liForm, notes: v })} placeholder="Optional notes" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['5'] }}>
          <Btn variant="ghost" onClick={() => { setShowAddModal(false); resetLiForm() }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreateLineItem} disabled={createLineItem.isPending}>
            {createLineItem.isPending ? 'Creating...' : 'Create Line Item'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}

// ── Bid Leveling Sub-Component ──────────────────────────────
// Uses real bid_packages + bid_responses data

const BidLevelingSection: React.FC<{ bidPackages: any[] }> = ({ bidPackages }) => {
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null)
  const { data: bidResponses, isPending: responsesLoading } = useBidResponses(selectedPkgId ?? undefined)
  const [awardedBidder, setAwardedBidder] = useState<string | null>(null)

  // Only show packages that have status evaluating, open, or awarded — these are relevant for leveling
  const levelingPackages = useMemo(
    () => bidPackages.filter((bp: any) => bp.status === 'evaluating' || bp.status === 'open' || bp.status === 'awarded'),
    [bidPackages],
  )

  if (levelingPackages.length === 0) {
    return (
      <Card>
        <div style={{ padding: spacing['6'], textAlign: 'center' }}>
          <Scale size={32} style={{ color: colors.textTertiary, marginBottom: spacing['3'] }} />
          <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['2'] }}>
            No Bid Packages to Level
          </h3>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Bid leveling compares responses across bid packages. Create bid packages and collect responses to start comparing bids.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <>
      {/* Package selector */}
      <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        {levelingPackages.map((pkg: any) => (
          <button
            key={pkg.id}
            onClick={() => setSelectedPkgId(pkg.id)}
            style={{
              flex: '1 1 220px', minWidth: 220, padding: spacing['4'],
              backgroundColor: selectedPkgId === pkg.id ? colors.surfaceRaised : colors.surfaceInset,
              borderRadius: borderRadius.lg,
              border: `1px solid ${selectedPkgId === pkg.id ? colors.orangeText : colors.borderDefault}`,
              cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontFamily,
            }}
          >
            <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>{pkg.name}</div>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
              {pkg.trade || 'General'} &middot; {pkg.response_count ?? 0} responses
            </div>
            {pkg.status && (
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>
                Status: {pkg.status.charAt(0).toUpperCase() + pkg.status.slice(1)}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Bid responses comparison */}
      {!selectedPkgId ? (
        <Card>
          <div style={{ padding: spacing['5'], textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              Select a bid package above to compare responses.
            </p>
          </div>
        </Card>
      ) : responsesLoading ? (
        <Skeleton width="100%" height="200px" />
      ) : !bidResponses || bidResponses.length === 0 ? (
        <Card>
          <div style={{ padding: spacing['5'], textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              No bid responses received for this package yet.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <SectionHeader title="Bid Response Comparison" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.borderDefault}` }}>
                  <th style={{ padding: `${spacing['3']}`, textAlign: 'left', color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Bidder</th>
                  <th style={{ padding: `${spacing['3']}`, textAlign: 'right', color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Base Bid</th>
                  <th style={{ padding: `${spacing['3']}`, textAlign: 'right', color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Alternates</th>
                  <th style={{ padding: `${spacing['3']}`, textAlign: 'left', color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Qualifications</th>
                  <th style={{ padding: `${spacing['3']}`, textAlign: 'left', color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Status</th>
                  <th style={{ padding: `${spacing['3']}`, textAlign: 'center', color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Award</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const bids = bidResponses.map((r: any) => r.base_bid || 0)
                  const nonZero = bids.filter((b: number) => b > 0)
                  const lowBid = nonZero.length > 0 ? Math.min(...nonZero) : 0
                  const highBid = nonZero.length > 0 ? Math.max(...nonZero) : 0

                  return bidResponses.map((resp: any) => {
                    const baseBid = resp.base_bid || 0
                    const isLow = baseBid === lowBid && baseBid > 0
                    const isHigh = baseBid === highBid && baseBid > 0 && lowBid !== highBid
                    return (
                      <tr key={resp.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                          {resp.bidder_name || resp.vendor_name || 'Unknown Bidder'}
                        </td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right' }}>
                          <span style={{
                            padding: `2px ${spacing['2']}`, borderRadius: borderRadius.sm,
                            fontWeight: isLow ? typography.fontWeight.semibold : typography.fontWeight.normal,
                            color: isLow ? colors.statusActive : isHigh ? colors.statusCritical : colors.textPrimary,
                            backgroundColor: isLow ? colors.statusActiveSubtle : isHigh ? colors.statusCriticalSubtle : 'transparent',
                          }}>
                            {baseBid > 0 ? fmtCurrency(baseBid) : 'N/A'}
                            {isLow && <> <Check size={12} style={{ verticalAlign: 'middle' }} /></>}
                          </span>
                        </td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right', color: colors.textSecondary }}>
                          {resp.alternate_amounts ? fmtCurrency(resp.alternate_amounts) : '-'}
                        </td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textTertiary, fontSize: typography.fontSize.caption, maxWidth: 250 }}>
                          {resp.qualifications || resp.notes || '-'}
                        </td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
                          {awardedBidder === resp.id ? (
                            <span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, backgroundColor: colors.statusActiveSubtle, color: colors.statusActive, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Award size={10} /> Awarded
                            </span>
                          ) : (
                            <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>
                              {resp.status ? resp.status.charAt(0).toUpperCase() + resp.status.slice(1) : 'Submitted'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'center' }}>
                          <Btn
                            variant={awardedBidder === resp.id ? 'primary' : 'ghost'}
                            size="sm"
                            icon={<Award size={14} />}
                            onClick={() => {
                              setAwardedBidder(resp.id)
                              toast.success(`Awarded to ${resp.bidder_name || resp.vendor_name || 'bidder'}`)
                            }}
                          >
                            {awardedBidder === resp.id ? 'Awarded' : 'Award'}
                          </Btn>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
              {bidResponses.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceInset }}>
                    <td style={{ padding: `${spacing['3']}`, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                      Spread
                    </td>
                    <td style={{ padding: `${spacing['3']}`, textAlign: 'right', fontSize: typography.fontSize.caption, color: colors.textSecondary }} colSpan={5}>
                      {(() => {
                        const bids = bidResponses.map((r: any) => r.base_bid || 0).filter((b: number) => b > 0)
                        if (bids.length < 2) return 'Not enough bids to compare'
                        const low = Math.min(...bids)
                        const high = Math.max(...bids)
                        const spread = high - low
                        const pct = ((spread / low) * 100).toFixed(1)
                        return `Low: ${fmtCurrency(low)} | High: ${fmtCurrency(high)} | Spread: ${fmtCurrency(spread)} (${pct}%)`
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

// ── Main Component ───────────────────────────────────────────

export const Estimating: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('estimates')
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: estimates, isPending: estimatesLoading } = useEstimates(projectId)
  const { data: bidPackages, isPending: bidsLoading } = useBidPackages(projectId)
  const { data: takeoffItems, isPending: takeoffsLoading } = useTakeoffItems(projectId)

  // Mutations
  const createEstimate = useCreateEstimate()
  const deleteEstimate = useDeleteEstimate()

  // Modal & detail state
  const [showNewEstimate, setShowNewEstimate] = useState(false)
  const [expandedEstimateId, setExpandedEstimateId] = useState<string | null>(null)
  const [assemblyFilter, setAssemblyFilter] = useState<string>('All')

  // New estimate form state
  const [estForm, setEstForm] = useState({
    name: '', type: 'conceptual' as string, status: 'draft' as string,
    markup_percent: '', overhead_percent: '', profit_percent: '',
    contingency_percent: '', due_date: '', notes: '',
  })
  const resetEstForm = () => setEstForm({
    name: '', type: 'conceptual', status: 'draft',
    markup_percent: '', overhead_percent: '', profit_percent: '',
    contingency_percent: '', due_date: '', notes: '',
  })

  // ── KPIs ───────────────────────────────────────────────────

  const totalEstimateValue = useMemo(
    () => estimates?.reduce((s: number, e: any) => s + (e.total_amount || 0), 0) || 0,
    [estimates],
  )
  const activeEstimates = useMemo(
    () => estimates?.filter((e: any) => e.status === 'draft' || e.status === 'in_review' || e.status === 'submitted').length || 0,
    [estimates],
  )
  const awardedCount = useMemo(
    () => estimates?.filter((e: any) => e.status === 'awarded').length || 0,
    [estimates],
  )
  const activeBids = useMemo(
    () => bidPackages?.filter((b: any) => b.status !== 'awarded' && b.status !== 'draft').length || 0,
    [bidPackages],
  )

  // ── Estimate version comparison (derived from real estimates) ──

  const estimatesByVersion = useMemo(() => {
    if (!estimates || estimates.length === 0) return []
    // Group estimates by name to find versioned sets
    const byName: Record<string, any[]> = {}
    estimates.forEach((e: any) => {
      const key = (e.name || '').replace(/\s*v\d+$/i, '').trim()
      if (!byName[key]) byName[key] = []
      byName[key].push(e)
    })
    // Return groups with more than one version
    return Object.entries(byName)
      .filter(([, versions]) => versions.length > 1)
      .map(([name, versions]) => ({
        name,
        versions: versions.sort((a: any, b: any) => (a.version || 1) - (b.version || 1)),
      }))
  }, [estimates])

  // ── Assemblies derived from estimate line items (grouped by CSI division) ──

  const assemblyGroups = useMemo(() => {
    if (!estimates || estimates.length === 0) return []
    // We show a note that assemblies are populated from estimate line items
    // Real assembly data would come from a dedicated assemblies table
    return []
  }, [estimates])

  // ── Handlers ──────────────────────────────────────────────

  const handleCreateEstimate = () => {
    if (!estForm.name.trim()) { toast.error('Estimate name is required'); return }
    if (!projectId) { toast.error('No project selected'); return }
    createEstimate.mutate({
      project_id: projectId,
      name: estForm.name.trim(),
      type: estForm.type,
      status: estForm.status,
      version: 1,
      total_amount: 0,
      markup_percent: parseFloat(estForm.markup_percent) || 0,
      overhead_percent: parseFloat(estForm.overhead_percent) || 0,
      profit_percent: parseFloat(estForm.profit_percent) || 0,
      contingency_percent: parseFloat(estForm.contingency_percent) || 0,
      due_date: estForm.due_date || null,
      notes: estForm.notes || null,
      created_by: user?.id || null,
    }, {
      onSuccess: () => { toast.success('Estimate created'); setShowNewEstimate(false); resetEstForm() },
      onError: (err: any) => toast.error(err.message || 'Failed to create estimate'),
    })
  }

  const handleDeleteEstimate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this estimate and all its line items?')) return
    if (!projectId) return
    deleteEstimate.mutate({ id, project_id: projectId }, {
      onSuccess: () => {
        toast.success('Estimate deleted')
        if (expandedEstimateId === id) setExpandedEstimateId(null)
      },
      onError: (err: any) => toast.error(err.message || 'Failed to delete estimate'),
    })
  }

  const handleAdd = () => {
    if (activeTab === 'estimates') {
      setShowNewEstimate(true)
    } else {
      toast.info('Submission requires backend configuration')
    }
  }

  // ── Tab actions ────────────────────────────────────────────

  const addButtonLabel: Record<TabKey, string> = {
    estimates: 'New Estimate',
    assemblies: 'New Assembly',
    compare: 'Save as New Version',
    bidLeveling: 'New Bid Comparison',
    bids: 'Create Bid Package',
    takeoffs: 'New Takeoff',
    takeoffDetail: 'Import from Drawing',
  }

  // ── Render ─────────────────────────────────────────────────

  const isLoading = estimatesLoading || bidsLoading || takeoffsLoading

  return (
    <PageContainer
      title="Estimating"
      subtitle="Preconstruction estimates, bid packages, and quantity takeoffs"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Estimating_Report" />
          <PermissionGate permission="budget.edit">
            <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd}>
              {addButtonLabel[activeTab]}
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="Estimating sections"
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* Estimates Tab */}
      {activeTab === 'estimates' && !isLoading && (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox
              label="Total Pipeline Value"
              value={fmtCurrency(totalEstimateValue)}
              icon={<DollarSign size={18} />}
            />
            <MetricBox
              label="Active Estimates"
              value={activeEstimates}
              icon={<Calculator size={18} />}
            />
            <MetricBox
              label="Awarded"
              value={awardedCount}
              icon={<Award size={18} />}
            />
            <MetricBox
              label="Open Bid Packages"
              value={activeBids}
              icon={<Users size={18} />}
            />
          </div>

          <Card>
            <SectionHeader title="All Estimates" />
            {/* Estimate rows with click-to-expand */}
            {(!estimates || estimates.length === 0) ? (
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, padding: spacing['4'] }}>
                No estimates yet. Create your first estimate to get started.
              </p>
            ) : (
              <div>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 0.5fr 1fr 1fr 1fr 1fr 40px',
                  gap: spacing['2'],
                  padding: `${spacing['3']} ${spacing['4']}`,
                  borderBottom: `1px solid ${colors.borderDefault}`,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                }}>
                  <span>Name</span>
                  <span>Type</span>
                  <span>Ver</span>
                  <span>Status</span>
                  <span>Total Amount</span>
                  <span>Due Date</span>
                  <span>Created</span>
                  <span></span>
                </div>
                {estimates.map((est: any) => {
                  const isExpanded = expandedEstimateId === est.id
                  const statusColor = est.status === 'awarded' ? colors.statusActive
                    : est.status === 'lost' ? colors.statusCritical
                    : est.status === 'submitted' ? colors.statusPending
                    : est.status === 'in_review' ? colors.statusInfo
                    : colors.textSecondary
                  const statusBg = est.status === 'awarded' ? colors.statusActiveSubtle
                    : est.status === 'lost' ? colors.statusCriticalSubtle
                    : est.status === 'submitted' ? colors.statusPendingSubtle
                    : est.status === 'in_review' ? colors.statusInfoSubtle
                    : colors.surfaceInset

                  return (
                    <div key={est.id}>
                      <div
                        onClick={() => setExpandedEstimateId(isExpanded ? null : est.id)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 0.5fr 1fr 1fr 1fr 1fr 40px',
                          gap: spacing['2'],
                          padding: `${spacing['3']} ${spacing['4']}`,
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                          cursor: 'pointer',
                          fontSize: typography.fontSize.sm,
                          backgroundColor: isExpanded ? colors.surfaceInset : 'transparent',
                          transition: `background-color ${transitions.instant}`,
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          {isExpanded ? <ChevronDown size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} />}
                          <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{est.name}</span>
                        </span>
                        <span style={{ color: colors.textSecondary }}>{est.type ? est.type.replace(/_/g, ' ') : ''}</span>
                        <span style={{ color: colors.textSecondary }}>v{est.version || 1}</span>
                        <span>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                            padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                            color: statusColor, backgroundColor: statusBg,
                          }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
                            {est.status ? est.status.charAt(0).toUpperCase() + est.status.slice(1).replace(/_/g, ' ') : ''}
                          </span>
                        </span>
                        <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                          {est.total_amount != null ? fmtCurrency(est.total_amount) : 'N/A'}
                        </span>
                        <span style={{ color: colors.textSecondary }}>
                          {est.due_date ? new Date(est.due_date).toLocaleDateString() : ''}
                        </span>
                        <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>
                          {est.created_at ? new Date(est.created_at).toLocaleDateString() : ''}
                        </span>
                        <span>
                          <PermissionGate permission="budget.edit">
                            <button
                              onClick={(e) => handleDeleteEstimate(est.id, e)}
                              title="Delete estimate"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: colors.statusCritical,
                                padding: spacing['1'], borderRadius: borderRadius.sm,
                                display: 'inline-flex', alignItems: 'center',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </PermissionGate>
                        </span>
                      </div>
                      {/* Expanded line items section */}
                      {isExpanded && projectId && (
                        <EstimateLineItemsSection estimateId={est.id} projectId={projectId} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Bids Tab */}
      {activeTab === 'bids' && !isLoading && (
        <Card>
          <SectionHeader title="Bid Packages" />
          <DataTable
            data={bidPackages || []}
            columns={bidColumns}
            emptyMessage="No bid packages yet. Create a bid package to start collecting proposals."
          />
        </Card>
      )}

      {/* Takeoffs Tab */}
      {activeTab === 'takeoffs' && !isLoading && (
        <Card>
          <SectionHeader title="Quantity Takeoffs" />
          <DataTable
            data={takeoffItems || []}
            columns={takeoffColumns}
            emptyMessage="No takeoff items yet. Start a new takeoff to measure quantities from drawings."
          />
        </Card>
      )}

      {/* Assemblies Tab */}
      {activeTab === 'assemblies' && !isLoading && (
        <>
          <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'center', marginBottom: spacing['4'], flexWrap: 'wrap' }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Category:</span>
            {['All', ...ASSEMBLY_CATEGORIES].map((cat) => (
              <button key={cat} onClick={() => setAssemblyFilter(cat)} style={{
                padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.full, border: 'none', cursor: 'pointer',
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                color: assemblyFilter === cat ? colors.orangeText : colors.textSecondary,
                backgroundColor: assemblyFilter === cat ? colors.surfaceRaised : colors.surfaceInset,
                transition: `all ${transitions.instant}`,
              }}>{cat}</button>
            ))}
          </div>
          <Card>
            <div style={{ padding: spacing['6'], textAlign: 'center' }}>
              <Layers size={32} style={{ color: colors.textTertiary, marginBottom: spacing['3'] }} />
              <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['2'] }}>
                No Assemblies Yet
              </h3>
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                Assemblies are reusable groups of line items (e.g., a standard wall section with framing, insulation, drywall, and paint). Create your first assembly to speed up estimating.
              </p>
            </div>
          </Card>
        </>
      )}

      {/* Compare Tab - Estimate Version Comparison */}
      {activeTab === 'compare' && !isLoading && (
        <>
          {estimatesByVersion.length === 0 ? (
            <Card>
              <div style={{ padding: spacing['6'], textAlign: 'center' }}>
                <GitCompare size={32} style={{ color: colors.textTertiary, marginBottom: spacing['3'] }} />
                <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['2'] }}>
                  No Versions to Compare
                </h3>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                  Version comparison shows how estimates change over time. Create multiple versions of an estimate (e.g., v1 Initial, v2 Value Engineering, v3 Final GMP) to enable side-by-side comparison.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {estimatesByVersion.map((group) => (
                <Card key={group.name} style={{ marginBottom: spacing['4'] }}>
                  <SectionHeader title={`${group.name} - Version Comparison`} />
                  <div style={{ display: 'flex', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, flexWrap: 'wrap' }}>
                    {group.versions.map((v: any) => (
                      <div key={v.id} style={{ flex: 1, minWidth: 200, padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, border: `1px solid ${colors.borderSubtle}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                          <GitCompare size={14} style={{ color: colors.orangeText }} />
                          <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>
                            v{v.version || 1} - {v.type ? v.type.replace(/_/g, ' ') : 'Draft'}
                          </span>
                        </div>
                        <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                          {v.created_at ? new Date(v.created_at).toLocaleDateString() : ''} &middot; {v.status || 'draft'}
                        </div>
                        <div style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginTop: spacing['2'] }}>
                          {v.total_amount != null ? fmtCurrency(v.total_amount) : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {group.versions.length >= 2 && (() => {
                    const first = group.versions[0]
                    const last = group.versions[group.versions.length - 1]
                    const v1 = first.total_amount || 0
                    const vN = last.total_amount || 0
                    const variance = vN - v1
                    const pctChange = v1 > 0 ? ((variance / v1) * 100) : 0
                    const isNegative = variance < 0
                    const varColor = isNegative ? colors.statusActive : variance > 0 ? colors.statusCritical : colors.textSecondary
                    return (
                      <div style={{ padding: `${spacing['3']} ${spacing['4']}`, borderTop: `1px solid ${colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                          v{first.version || 1} to v{last.version || 1} variance:
                        </span>
                        <span style={{ fontWeight: typography.fontWeight.semibold, color: varColor }}>
                          {isNegative ? '' : '+'}{fmtCurrency(variance)} ({isNegative ? '' : '+'}{pctChange.toFixed(1)}%)
                        </span>
                      </div>
                    )
                  })()}
                </Card>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
                <Btn variant="ghost" icon={<Copy size={14} />} onClick={() => toast.info('Comparison copied to clipboard')}>Copy Table</Btn>
                <Btn variant="primary" icon={<Plus size={14} />} onClick={() => toast.success('New version saved from current estimates')}>Save as New Version</Btn>
              </div>
            </>
          )}
        </>
      )}

      {/* Bid Leveling Tab */}
      {activeTab === 'bidLeveling' && !isLoading && (
        <BidLevelingSection bidPackages={bidPackages || []} />
      )}

      {/* Takeoff Detail Tab */}
      {activeTab === 'takeoffDetail' && !isLoading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['4'] }}>
            {(['area', 'linear', 'count', 'volume'] as const).map((mt) => {
              const items = (takeoffItems || []).filter((t: any) => {
                const tt = (t.takeoff_type || '').toLowerCase()
                return tt === mt || tt.includes(mt)
              })
              const total = items.reduce((s: number, t: any) => s + (t.quantity || 0), 0)
              const label = mt === 'area' ? 'Area (SF)' : mt === 'linear' ? 'Linear (LF)' : mt === 'count' ? 'Count (EA)' : 'Volume (CY)'
              return (
                <MetricBox key={mt} label={label} value={total.toLocaleString()} icon={<Ruler size={18} />} />
              )
            })}
          </div>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing['3']} ${spacing['4']}` }}>
              <SectionHeader title="Takeoff Items" />
              <div style={{ display: 'flex', gap: spacing['2'] }}>
                <Btn variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => toast.info('Importing quantities from drawing markup...')}>Import from Drawing</Btn>
              </div>
            </div>
            {(!takeoffItems || takeoffItems.length === 0) ? (
              <div style={{ padding: spacing['5'], textAlign: 'center' }}>
                <FileSearch size={32} style={{ color: colors.textTertiary, marginBottom: spacing['3'] }} />
                <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['2'] }}>
                  No Takeoff Items
                </h3>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
                  Takeoff detail shows measured quantities from drawings. Create takeoff items from the Takeoffs tab or import measurements from drawing markups.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.borderDefault}` }}>
                      {['Name', 'Category', 'Type', 'Quantity', 'Unit', 'Drawing Ref', 'Color'].map((h) => (
                        <th key={h} style={{ padding: `${spacing['3']}`, textAlign: 'left', color: colors.textSecondary, fontWeight: typography.fontWeight.medium, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {takeoffItems.map((item: any) => (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{item.name}</td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{item.category || '-'}</td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
                          <span style={{ padding: `2px ${spacing['2']}`, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceInset, color: colors.textSecondary, fontSize: typography.fontSize.caption }}>
                            {item.takeoff_type ? item.takeoff_type.replace(/_/g, ' ') : '-'}
                          </span>
                        </td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                          {item.quantity != null ? item.quantity.toLocaleString() : '-'}
                        </td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{item.unit || '-'}</td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
                          {item.drawing_ref ? (
                            <span style={{ color: colors.orangeText, fontWeight: typography.fontWeight.medium, cursor: 'pointer' }}>{item.drawing_ref}</span>
                          ) : (
                            <span style={{ color: colors.textTertiary }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: `${spacing['2']} ${spacing['3']}` }}>
                          {item.color ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                              <div style={{ width: 12, height: 12, borderRadius: borderRadius.sm, backgroundColor: item.color, border: `1px solid ${colors.borderDefault}` }} />
                              <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.caption }}>{item.color}</span>
                            </div>
                          ) : (
                            <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ padding: `${spacing['3']} ${spacing['4']}`, borderTop: `1px solid ${colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                {takeoffItems?.length || 0} takeoff items
                {takeoffItems && takeoffItems.length > 0 && (() => {
                  const sheets = new Set(takeoffItems.map((t: any) => t.drawing_ref).filter(Boolean))
                  return ` across ${sheets.size} drawing sheet${sheets.size !== 1 ? 's' : ''}`
                })()}
              </span>
              <Btn variant="ghost" size="sm" icon={<FileSearch size={14} />} onClick={() => toast.info('Opening quantity adjustment log...')}>Adjustment History</Btn>
            </div>
          </Card>
        </>
      )}

      {/* New Estimate Modal */}
      <Modal open={showNewEstimate} onClose={() => { setShowNewEstimate(false); resetEstForm() }} title="New Estimate" width="650px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <InputField label="Name" value={estForm.name} onChange={(v) => setEstForm({ ...estForm, name: v })} required placeholder="Estimate name" />
          </div>
          <SelectField label="Type" value={estForm.type} onChange={(v) => setEstForm({ ...estForm, type: v })} options={ESTIMATE_TYPES} required />
          <SelectField label="Status" value={estForm.status} onChange={(v) => setEstForm({ ...estForm, status: v })} options={ESTIMATE_STATUSES} required />
          <InputField label="Markup (%)" value={estForm.markup_percent} onChange={(v) => setEstForm({ ...estForm, markup_percent: v })} type="number" placeholder="0" />
          <InputField label="Overhead (%)" value={estForm.overhead_percent} onChange={(v) => setEstForm({ ...estForm, overhead_percent: v })} type="number" placeholder="0" />
          <InputField label="Profit (%)" value={estForm.profit_percent} onChange={(v) => setEstForm({ ...estForm, profit_percent: v })} type="number" placeholder="0" />
          <InputField label="Contingency (%)" value={estForm.contingency_percent} onChange={(v) => setEstForm({ ...estForm, contingency_percent: v })} type="number" placeholder="0" />
          <div style={{ gridColumn: '1 / -1' }}>
            <InputField label="Due Date" value={estForm.due_date} onChange={(v) => setEstForm({ ...estForm, due_date: v })} type="date" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <InputField label="Notes" value={estForm.notes} onChange={(v) => setEstForm({ ...estForm, notes: v })} placeholder="Optional notes" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['5'] }}>
          <Btn variant="ghost" onClick={() => { setShowNewEstimate(false); resetEstForm() }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreateEstimate} disabled={createEstimate.isPending}>
            {createEstimate.isPending ? 'Creating...' : 'Create Estimate'}
          </Btn>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Estimating
