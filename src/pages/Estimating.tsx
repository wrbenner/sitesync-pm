import React, { useState, useMemo } from 'react'
import {
  Calculator,
  Users,
  Award,
  Plus,
  Trash2,
  Package,
  Receipt,
  BarChart3,
} from 'lucide-react'
import {
  PageContainer,
  Card,
  SectionHeader,
  MetricBox,
  Btn,
  Skeleton,
  Modal,
  InputField,
  EmptyState,
} from '../components/Primitives'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useConfirm } from '../components/ConfirmDialog'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { toast } from 'sonner'
import { useProjectId } from '../hooks/useProjectId'
import { useOrganization } from '../hooks/useOrganization'
import { useBidPackages } from '../hooks/queries/preconstruction'
import { useVendors } from '../hooks/queries/vendors'
import { useBudgetItems } from '../hooks/queries/budget-items'
import { usePreconSubcontractors } from '../hooks/queries/precon-extended'
import {
  useEstimatingItems,
  useLatestRollupsByDivision,
  useBidSubmissions,
  useAllBidSubmissions,
  type EstimatingItem,
  type BidSubmission,
} from '../hooks/queries/estimating'
import {
  useCreateEstimatingItem,
  useUpdateEstimatingItem,
  useDeleteEstimatingItem,
  useUpsertEstimateRollup,
  useCreateBidSubmission,
  useAwardBidSubmission,
  useDeleteBidSubmission,
} from '../hooks/mutations/estimating'

type TabKey = 'line_items' | 'bid_packages' | 'submissions' | 'rollups' | 'subcontractors'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'line_items', label: 'Line Items', icon: Calculator },
  { key: 'bid_packages', label: 'Bid Packages', icon: Package },
  { key: 'submissions', label: 'Submissions', icon: Receipt },
  { key: 'rollups', label: 'Rollups', icon: BarChart3 },
  { key: 'subcontractors', label: 'Subcontractors', icon: Users },
]

const fmtCurrency = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(typeof n === 'number' && !Number.isNaN(n) ? n : 0)

// ── Badges ───────────────────────────────────────────────

const Pill: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `2px ${spacing.sm}`,
    borderRadius: borderRadius.full,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    color,
    backgroundColor: bg,
  }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color }} />
    {label}
  </span>
)

function statusPill(status: string | null | undefined) {
  const s = (status ?? '').toLowerCase()
  if (s === 'awarded') return <Pill label="Awarded" color={colors.statusActive} bg={colors.statusActiveSubtle} />
  if (s === 'shortlisted') return <Pill label="Shortlisted" color={colors.statusInfo} bg={colors.statusInfoSubtle} />
  if (s === 'declined') return <Pill label="Declined" color={colors.statusCritical} bg={colors.statusCriticalSubtle} />
  if (s === 'submitted') return <Pill label="Submitted" color={colors.statusPending} bg={colors.statusPendingSubtle} />
  return <Pill label="Pending" color={colors.textTertiary} bg={colors.statusNeutralSubtle} />
}

// ── Table primitives ─────────────────────────────────────

const Th: React.FC<{ children?: React.ReactNode; width?: string; align?: 'left' | 'right' | 'center' }> = ({ children, width, align = 'left' }) => (
  <th style={{
    width,
    padding: `${spacing['3']} ${spacing['4']}`,
    textAlign: align,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </th>
)

const Td: React.FC<{ children?: React.ReactNode; align?: 'left' | 'right' | 'center' }> = ({ children, align = 'left' }) => (
  <td style={{
    padding: `${spacing['3']} ${spacing['4']}`,
    textAlign: align,
    fontSize: typography.fontSize.body,
    color: colors.textPrimary,
    borderBottom: `1px solid ${colors.borderSubtle}`,
  }}>
    {children}
  </td>
)

// ═════════════════════════════════════════════════════════
// Main page
// ═════════════════════════════════════════════════════════

export const Estimating: React.FC = () => {
  const projectId = useProjectId()
  const { currentOrg } = useOrganization()
  const orgId = currentOrg?.id

  const [tab, setTab] = useState<TabKey>('line_items')

  // ── Data ────────────────────────────────────────────────
  const { data: lineItems = [], isPending: liPending } = useEstimatingItems(projectId)
  const { data: bidPackages = [], isPending: bpPending } = useBidPackages(projectId)
  const { data: allSubmissions = [] } = useAllBidSubmissions(projectId)
  const { data: rollups = [], isPending: ruPending } = useLatestRollupsByDivision(projectId)
  const { data: vendors = [] } = useVendors(projectId)
  const { data: budgetItems = [] } = useBudgetItems(projectId)
  const { data: subcontractors = [], isPending: subPending } = usePreconSubcontractors(orgId)

  // ── Metrics ─────────────────────────────────────────────
  const totalEstimate = useMemo(
    () => lineItems.reduce((s, it) => s + (it.total_cost || 0), 0),
    [lineItems],
  )
  const awardedCount = useMemo(
    () => allSubmissions.filter(s => s.status === 'awarded').length,
    [allSubmissions],
  )

  return (
    <PageContainer
      title="Estimating"
      subtitle="Line items, bid packages, vendor submissions, and division rollups"
    >
      {/* Top metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
        <MetricBox label="Line Items" value={lineItems.length} />
        <MetricBox label="Total Estimate" value={fmtCurrency(totalEstimate)} />
        <MetricBox label="Bid Packages" value={bidPackages.length} />
        <MetricBox label="Awarded Bids" value={awardedCount} />
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Estimating views" style={{
        display: 'flex',
        gap: spacing['1'],
        borderBottom: `1px solid ${colors.borderSubtle}`,
        marginBottom: spacing['4'],
      }}>
        {tabs.map((t) => {
          const Icon = t.icon
          const active = t.key === tab
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none',
                borderBottom: `2px solid ${active ? colors.primaryOrange : 'transparent'}`,
                background: 'transparent',
                color: active ? colors.orangeText : colors.textSecondary,
                fontSize: typography.fontSize.body,
                fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.normal,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
                transition: `color ${transitions.quick}, border-color ${transitions.quick}`,
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'line_items' && (
        <LineItemsTab
          projectId={projectId ?? undefined}
          items={lineItems}
          loading={liPending}
          vendors={vendors as unknown as Array<{ id: string; company_name: string }>}
          bidPackages={bidPackages as unknown as Array<Record<string, unknown>>}
        />
      )}
      {tab === 'bid_packages' && (
        <BidPackagesTab
          packages={bidPackages as unknown as Array<Record<string, unknown>>}
          loading={bpPending}
          allSubmissions={allSubmissions}
          onDrillDown={() => setTab('submissions')}
        />
      )}
      {tab === 'submissions' && (
        <SubmissionsTab
          projectId={projectId ?? undefined}
          packages={bidPackages as unknown as Array<Record<string, unknown>>}
          vendors={vendors as unknown as Array<{ id: string; company_name: string }>}
        />
      )}
      {tab === 'rollups' && (
        <RollupsTab
          projectId={projectId ?? undefined}
          rollups={rollups}
          loading={ruPending}
          budgetItems={budgetItems}
          lineItems={lineItems}
        />
      )}
      {tab === 'subcontractors' && (
        <SubcontractorsTab
          loading={subPending}
          subs={subcontractors}
        />
      )}
    </PageContainer>
  )
}

// ═════════════════════════════════════════════════════════
// Line Items
// ═════════════════════════════════════════════════════════

interface LineItemsTabProps {
  projectId: string | undefined
  items: EstimatingItem[]
  loading: boolean
  vendors: Array<{ id: string; company_name: string }>
  bidPackages: Array<Record<string, unknown>>
}

const LineItemsTab: React.FC<LineItemsTabProps> = ({ projectId, items, loading, vendors, bidPackages }) => {
  const create = useCreateEstimatingItem()
  const update = useUpdateEstimatingItem()
  const del = useDeleteEstimatingItem()
  const { confirm: confirmDeleteLine, dialog: deleteLineDialog } = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    cost_code: '',
    description: '',
    quantity: '1',
    unit: 'EA',
    unit_cost: '0',
    category: '',
    bid_package_id: '',
    vendor_id: '',
    notes: '',
  })
  const [divisionFilter, setDivisionFilter] = useState<string>('all')

  const divisionOptions = useMemo(() => {
    const set = new Set<string>()
    for (const it of items) if (it.category) set.add(it.category)
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    if (divisionFilter === 'all') return items
    return items.filter((it) => (it.category ?? '') === divisionFilter)
  }, [items, divisionFilter])

  const resetForm = () =>
    setForm({
      cost_code: '',
      description: '',
      quantity: '1',
      unit: 'EA',
      unit_cost: '0',
      category: '',
      bid_package_id: '',
      vendor_id: '',
      notes: '',
    })

  const handleCreate = async () => {
    if (!projectId) return
    if (!form.description.trim()) {
      toast.error('Description is required')
      return
    }
    const qty = parseFloat(form.quantity) || 0
    const unitCost = parseFloat(form.unit_cost) || 0
    try {
      await create.mutateAsync({
        project_id: projectId,
        cost_code: form.cost_code || null,
        description: form.description.trim(),
        quantity: qty,
        unit: form.unit || null,
        unit_cost: unitCost,
        category: form.category || null,
        bid_package_id: form.bid_package_id || null,
        vendor_id: form.vendor_id || null,
        notes: form.notes || null,
      })
      toast.success('Line item added')
      resetForm()
      setModalOpen(false)
    } catch {
      /* toast surfaced in mutation */
    }
  }

  const handleInlineUpdate = async (
    id: string,
    patch: Partial<Pick<EstimatingItem, 'quantity' | 'unit_cost' | 'cost_code' | 'description' | 'unit' | 'category'>>,
  ) => {
    if (!projectId) return
    try {
      await update.mutateAsync({ id, projectId, patch })
    } catch {
      /* toast surfaced */
    }
  }

  const handleDelete = async (id: string) => {
    if (!projectId) return
    const ok = await confirmDeleteLine({
      title: 'Delete estimate line item?',
      description: 'Estimating totals adjust on the next recalculation. Linked contract or PO references become orphaned.',
      destructiveLabel: 'Delete line',
    })
    if (!ok) return
    try {
      await del.mutateAsync({ id, projectId })
      toast.success('Line item deleted')
    } catch {
      /* toast surfaced */
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'], gap: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <label style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>
            Division:
          </label>
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            aria-label="Filter by division"
            style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              border: `1px solid ${divisionFilter !== 'all' ? colors.primaryOrange : colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              backgroundColor: 'transparent',
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              cursor: 'pointer',
            }}
          >
            <option value="all">All divisions</option>
            {divisionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <PermissionGate permission="estimating.manage">
          <Btn icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>New Line Item</Btn>
        </PermissionGate>
      </div>

      <Card padding="0">
        <div style={{ padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <SectionHeader title="Estimate Line Items" />
        </div>

        {loading ? (
          <div style={{ padding: spacing['6'] }}>
            <Skeleton height={32} /><div style={{ height: spacing['2'] }} />
            <Skeleton height={32} /><div style={{ height: spacing['2'] }} />
            <Skeleton height={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: spacing['8'] }}>
            <EmptyState
              title="No line items yet"
              description="Start the estimate by adding the first line item."
              action={
                <PermissionGate permission="estimating.manage">
                  <Btn icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>New Line Item</Btn>
                </PermissionGate>
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th width="120px">Cost Code</Th>
                  <Th>Description</Th>
                  <Th width="130px">Division</Th>
                  <Th width="90px" align="right">Qty</Th>
                  <Th width="80px">Unit</Th>
                  <Th width="120px" align="right">Unit Cost</Th>
                  <Th width="130px" align="right">Total</Th>
                  <Th width="60px" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id}>
                    <Td>
                      <EditableText
                        value={it.cost_code ?? ''}
                        onSave={(v) => handleInlineUpdate(it.id, { cost_code: v || null })}
                        placeholder="—"
                      />
                    </Td>
                    <Td>
                      <EditableText
                        value={it.description}
                        onSave={(v) => handleInlineUpdate(it.id, { description: v })}
                      />
                    </Td>
                    <Td>
                      <EditableText
                        value={it.category ?? ''}
                        onSave={(v) => handleInlineUpdate(it.id, { category: v || null })}
                        placeholder="—"
                      />
                    </Td>
                    <Td align="right">
                      <EditableNumber
                        value={it.quantity}
                        onSave={(v) => handleInlineUpdate(it.id, { quantity: v })}
                      />
                    </Td>
                    <Td>
                      <EditableText
                        value={it.unit ?? ''}
                        onSave={(v) => handleInlineUpdate(it.id, { unit: v || null })}
                        placeholder="—"
                      />
                    </Td>
                    <Td align="right">
                      <EditableNumber
                        value={it.unit_cost}
                        onSave={(v) => handleInlineUpdate(it.id, { unit_cost: v })}
                      />
                    </Td>
                    <Td align="right">
                      <span style={{ fontWeight: typography.fontWeight.semibold }}>{fmtCurrency(it.total_cost)}</span>
                    </Td>
                    <Td align="right">
                      <PermissionGate permission="estimating.manage">
                        <button
                          type="button"
                          onClick={() => handleDelete(it.id)}
                          aria-label="Delete line item"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: spacing['1'], color: colors.textTertiary }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </PermissionGate>
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: colors.surfaceInset }}>
                  <td colSpan={6} style={{ padding: `${spacing['3']} ${spacing['4']}`, textAlign: 'right', fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Filtered total
                  </td>
                  <td style={{ padding: `${spacing['3']} ${spacing['4']}`, textAlign: 'right', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    {fmtCurrency(filtered.reduce((s, it) => s + (it.total_cost || 0), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New line item">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <InputField label="Cost Code" value={form.cost_code} onChange={(v) => setForm((f) => ({ ...f, cost_code: v }))} placeholder="e.g. 03-30-00" />
          <InputField label="Description *" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="What is being estimated?" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Quantity" value={form.quantity} onChange={(v) => setForm((f) => ({ ...f, quantity: v }))} type="number" />
            <InputField label="Unit" value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} placeholder="EA / SF / CY …" />
            <InputField label="Unit Cost" value={form.unit_cost} onChange={(v) => setForm((f) => ({ ...f, unit_cost: v }))} type="number" />
          </div>
          <InputField label="Division / Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} placeholder="e.g. Concrete, MEP, Sitework" />
          <div>
            <label style={labelStyle}>Bid package (optional)</label>
            <select value={form.bid_package_id} onChange={(e) => setForm((f) => ({ ...f, bid_package_id: e.target.value }))} style={selectStyle}>
              <option value="">— None —</option>
              {bidPackages.map((p) => {
                const id = p.id as string
                const name = (p.name as string) || '(unnamed)'
                return <option key={id} value={id}>{name}</option>
              })}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Vendor (optional)</label>
            <select value={form.vendor_id} onChange={(e) => setForm((f) => ({ ...f, vendor_id: e.target.value }))} style={selectStyle}>
              <option value="">— None —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </select>
          </div>
          <InputField label="Notes" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Add line item'}</Btn>
          </div>
        </div>
      </Modal>
      {deleteLineDialog}
    </>
  )
}

// Inline editable cells ────────────────────────────────────

const editableInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  backgroundColor: 'transparent',
  color: colors.textPrimary,
  boxSizing: 'border-box',
}

const EditableText: React.FC<{ value: string; onSave: (v: string) => void; placeholder?: string }> = ({ value, onSave, placeholder }) => {
  const [v, setV] = useState(value)
  React.useEffect(() => setV(value), [value])
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v) }}
      placeholder={placeholder}
      style={editableInputStyle}
    />
  )
}

const EditableNumber: React.FC<{ value: number; onSave: (v: number) => void }> = ({ value, onSave }) => {
  const [v, setV] = useState(String(value))
  React.useEffect(() => setV(String(value)), [value])
  return (
    <input
      type="number"
      step="any"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const parsed = parseFloat(v)
        if (!Number.isNaN(parsed) && parsed !== value) onSave(parsed)
      }}
      style={{ ...editableInputStyle, textAlign: 'right' }}
    />
  )
}

// ═════════════════════════════════════════════════════════
// Bid Packages
// ═════════════════════════════════════════════════════════

interface BidPackagesTabProps {
  packages: Array<Record<string, unknown>>
  loading: boolean
  allSubmissions: BidSubmission[]
  onDrillDown: (bidPackageId: string) => void
}

const BidPackagesTab: React.FC<BidPackagesTabProps> = ({ packages, loading, allSubmissions, onDrillDown }) => {
  const subsByPackage = useMemo(() => {
    const m = new Map<string, BidSubmission[]>()
    for (const s of allSubmissions) {
      const arr = m.get(s.bid_package_id) ?? []
      arr.push(s)
      m.set(s.bid_package_id, arr)
    }
    return m
  }, [allSubmissions])

  return (
    <Card padding="0">
      <div style={{ padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <SectionHeader title="Bid Packages" />
      </div>
      {loading ? (
        <div style={{ padding: spacing['6'] }}>
          <Skeleton height={32} /><div style={{ height: spacing['2'] }} />
          <Skeleton height={32} /><div style={{ height: spacing['2'] }} />
          <Skeleton height={32} />
        </div>
      ) : packages.length === 0 ? (
        <div style={{ padding: spacing['8'] }}>
          <EmptyState
            title="No bid packages"
            description="Bid packages are created from the Preconstruction workflow — this view drills into their vendor submissions."
          />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Package</Th>
                <Th width="140px">Trade</Th>
                <Th width="120px">Status</Th>
                <Th width="120px">Due Date</Th>
                <Th width="110px" align="right">Submissions</Th>
                <Th width="130px" align="right">Low Bid</Th>
                <Th width="100px" />
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => {
                const id = p.id as string
                const name = (p.name as string) ?? '(unnamed)'
                const trade = (p.trade as string) ?? '—'
                const status = (p.status as string) ?? 'draft'
                const dueDate = (p.due_date as string) ?? ''
                const subs = subsByPackage.get(id) ?? []
                const lowBid = subs.length > 0
                  ? subs.reduce((lo, s) => (s.amount < lo ? s.amount : lo), subs[0].amount)
                  : null
                return (
                  <tr key={id}>
                    <Td><span style={{ fontWeight: typography.fontWeight.medium }}>{name}</span></Td>
                    <Td><span style={{ color: colors.textSecondary }}>{trade}</span></Td>
                    <Td>{statusPill(status)}</Td>
                    <Td><span style={{ color: colors.textSecondary }}>{dueDate ? new Date(dueDate).toLocaleDateString() : '—'}</span></Td>
                    <Td align="right">{subs.length}</Td>
                    <Td align="right">{lowBid != null ? fmtCurrency(lowBid) : '—'}</Td>
                    <Td align="right">
                      <Btn variant="ghost" onClick={() => onDrillDown(id)} style={{ fontSize: typography.fontSize.sm }}>
                        View bids →
                      </Btn>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ═════════════════════════════════════════════════════════
// Submissions (per-package vendor comparison + Award)
// ═════════════════════════════════════════════════════════

interface SubmissionsTabProps {
  projectId: string | undefined
  packages: Array<Record<string, unknown>>
  vendors: Array<{ id: string; company_name: string }>
}

const SubmissionsTab: React.FC<SubmissionsTabProps> = ({ projectId, packages, vendors }) => {
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const { confirm: confirmAwardBid, dialog: awardBidDialog } = useConfirm()
  const { confirm: confirmDeleteSubmission, dialog: deleteSubmissionDialog } = useConfirm()

  // Default to first package once loaded
  React.useEffect(() => {
    if (!selectedPackageId && packages.length > 0) {
      setSelectedPackageId((packages[0].id as string) ?? '')
    }
  }, [packages, selectedPackageId])

  const { data: subs = [], isPending } = useBidSubmissions(selectedPackageId || undefined)
  const createSub = useCreateBidSubmission()
  const awardSub = useAwardBidSubmission()
  const delSub = useDeleteBidSubmission()

  const [showNewForm, setShowNewForm] = useState(false)
  const [newSub, setNewSub] = useState({ vendor_id: '', amount: '', notes: '' })

  const vendorName = (id: string | null) =>
    id ? (vendors.find((v) => v.id === id)?.company_name ?? 'Unknown vendor') : '—'

  const lowAmount = subs.length > 0 ? Math.min(...subs.map((s) => s.amount)) : null

  const handleAdd = async () => {
    if (!selectedPackageId) return
    const amt = parseFloat(newSub.amount)
    if (Number.isNaN(amt)) { toast.error('Amount is required'); return }
    try {
      await createSub.mutateAsync({
        bid_package_id: selectedPackageId,
        vendor_id: newSub.vendor_id || null,
        amount: amt,
        notes: newSub.notes || null,
      })
      toast.success('Submission recorded')
      setNewSub({ vendor_id: '', amount: '', notes: '' })
      setShowNewForm(false)
    } catch {
      /* toast surfaced */
    }
  }

  const handleAward = async (id: string) => {
    if (!selectedPackageId) return
    const ok = await confirmAwardBid({
      title: 'Award this bid?',
      description: 'All other submissions on this package will be marked Declined. Notifications will fire to declined subs.',
      destructiveLabel: 'Award bid',
      destructive: false,
    })
    if (!ok) return
    try {
      await awardSub.mutateAsync({ id, bid_package_id: selectedPackageId })
      toast.success('Bid awarded')
    } catch {
      /* toast surfaced */
    }
  }

  const handleDelete = async (id: string) => {
    if (!selectedPackageId) return
    const ok = await confirmDeleteSubmission({
      title: 'Delete bid submission?',
      description: 'The submission record and any attached pricing files will be removed from this package.',
      destructiveLabel: 'Delete submission',
    })
    if (!ok) return
    try {
      await delSub.mutateAsync({ id, bid_package_id: selectedPackageId })
      toast.success('Submission deleted')
    } catch {
      /* toast surfaced */
    }
  }

  return (
    <>
    <Card padding="0">
      <div style={{ padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'], flexWrap: 'wrap' }}>
        <SectionHeader title="Vendor Submissions" />
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <label style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Package:</label>
          <select
            value={selectedPackageId}
            onChange={(e) => setSelectedPackageId(e.target.value)}
            style={{ ...selectStyle, width: 260 }}
            aria-label="Bid package"
          >
            <option value="">— Select a package —</option>
            {packages.map((p) => {
              const id = p.id as string
              const name = (p.name as string) ?? '(unnamed)'
              return <option key={id} value={id}>{name}</option>
            })}
          </select>
          <PermissionGate permission="estimating.manage">
            <Btn icon={<Plus size={14} />} onClick={() => setShowNewForm((v) => !v)} disabled={!selectedPackageId}>Record Submission</Btn>
          </PermissionGate>
        </div>
      </div>

      {showNewForm && projectId && selectedPackageId && (
        <div style={{ padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 2fr auto', gap: spacing['3'], alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Vendor</label>
              <select value={newSub.vendor_id} onChange={(e) => setNewSub((s) => ({ ...s, vendor_id: e.target.value }))} style={selectStyle}>
                <option value="">— None —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
              </select>
            </div>
            <InputField label="Amount" value={newSub.amount} onChange={(v) => setNewSub((s) => ({ ...s, amount: v }))} type="number" placeholder="0" />
            <InputField label="Notes" value={newSub.notes} onChange={(v) => setNewSub((s) => ({ ...s, notes: v }))} placeholder="Scope clarifications, qualifications…" />
            <Btn variant="primary" onClick={handleAdd} disabled={createSub.isPending}>{createSub.isPending ? 'Saving…' : 'Save'}</Btn>
          </div>
        </div>
      )}

      {!selectedPackageId ? (
        <div style={{ padding: spacing['8'] }}>
          <EmptyState title="Select a bid package" description="Choose a package above to compare vendor submissions." />
        </div>
      ) : isPending ? (
        <div style={{ padding: spacing['6'] }}>
          <Skeleton height={32} /><div style={{ height: spacing['2'] }} /><Skeleton height={32} />
        </div>
      ) : subs.length === 0 ? (
        <div style={{ padding: spacing['8'] }}>
          <EmptyState title="No submissions yet" description="Record the first vendor submission to start leveling." />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Vendor</Th>
                <Th width="130px" align="right">Amount</Th>
                <Th width="110px" align="right">Δ vs Low</Th>
                <Th width="120px">Status</Th>
                <Th width="160px">Submitted</Th>
                <Th>Notes</Th>
                <Th width="180px" />
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const delta = lowAmount != null ? s.amount - lowAmount : 0
                const isLow = lowAmount != null && s.amount === lowAmount
                return (
                  <tr key={s.id}>
                    <Td>
                      <span style={{ fontWeight: typography.fontWeight.medium }}>{vendorName(s.vendor_id)}</span>
                      {isLow && (
                        <span style={{ marginLeft: spacing['2'] }}>
                          <Pill label="Low Bid" color={colors.statusActive} bg={colors.statusActiveSubtle} />
                        </span>
                      )}
                    </Td>
                    <Td align="right"><span style={{ fontWeight: typography.fontWeight.semibold }}>{fmtCurrency(s.amount)}</span></Td>
                    <Td align="right">
                      <span style={{ color: delta > 0 ? colors.statusCritical : colors.textTertiary }}>
                        {delta > 0 ? `+${fmtCurrency(delta)}` : '—'}
                      </span>
                    </Td>
                    <Td>{statusPill(s.status)}</Td>
                    <Td>
                      <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}
                      </span>
                    </Td>
                    <Td><span style={{ color: colors.textSecondary }}>{s.notes ?? '—'}</span></Td>
                    <Td align="right">
                      <div style={{ display: 'inline-flex', gap: spacing['1'] }}>
                        <PermissionGate permission="estimating.manage">
                          {s.status !== 'awarded' && (
                            <Btn variant="primary" onClick={() => handleAward(s.id)} disabled={awardSub.isPending} style={{ fontSize: typography.fontSize.caption, padding: `${spacing['1']} ${spacing['2']}` }}>
                              <Award size={11} /> Award
                            </Btn>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            aria-label="Delete submission"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: spacing['1'], color: colors.textTertiary }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </PermissionGate>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
    {awardBidDialog}
    {deleteSubmissionDialog}
    </>
  )
}

// ═════════════════════════════════════════════════════════
// Rollups (per-division totals + variance vs budget)
// ═════════════════════════════════════════════════════════

interface RollupsTabProps {
  projectId: string | undefined
  rollups: import('../hooks/queries/estimating').EstimateRollup[]
  loading: boolean
  budgetItems: Array<{ division: string | null; original_amount: number | null; committed_amount: number | null }>
  lineItems: EstimatingItem[]
}

const RollupsTab: React.FC<RollupsTabProps> = ({ projectId, rollups, loading, budgetItems, lineItems }) => {
  const upsert = useUpsertEstimateRollup()

  // Budget totals by division (sum original_amount)
  const budgetByDivision = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of budgetItems) {
      const div = b.division ?? ''
      if (!div) continue
      m.set(div, (m.get(div) ?? 0) + (b.original_amount ?? 0))
    }
    return m
  }, [budgetItems])

  // Estimate totals by division (sum line_items.total_cost)
  const estimateByDivision = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of lineItems) {
      const div = it.category ?? ''
      if (!div) continue
      m.set(div, (m.get(div) ?? 0) + (it.total_cost ?? 0))
    }
    return m
  }, [lineItems])

  // Union of all divisions we know about (rollup rows, budget, line items)
  const divisions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rollups) set.add(r.division)
    for (const d of budgetByDivision.keys()) set.add(d)
    for (const d of estimateByDivision.keys()) set.add(d)
    return Array.from(set).sort()
  }, [rollups, budgetByDivision, estimateByDivision])

  const rollupByDivision = useMemo(() => {
    const m = new Map<string, typeof rollups[number]>()
    for (const r of rollups) m.set(r.division, r)
    return m
  }, [rollups])

  const handleSnapshot = async () => {
    if (!projectId) return
    try {
      for (const div of divisions) {
        const estimated = estimateByDivision.get(div) ?? 0
        const committed = rollupByDivision.get(div)?.total_committed ?? 0
        await upsert.mutateAsync({
          project_id: projectId,
          division: div,
          total_estimated: estimated,
          total_committed: committed,
        })
      }
      toast.success('Rollups snapshotted for today')
    } catch {
      /* toast surfaced */
    }
  }

  return (
    <Card padding="0">
      <div style={{ padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'] }}>
        <SectionHeader title="Division Rollups" />
        <PermissionGate permission="estimating.manage">
          <Btn variant="secondary" onClick={handleSnapshot} disabled={upsert.isPending || divisions.length === 0}>
            {upsert.isPending ? 'Saving…' : "Snapshot today's rollup"}
          </Btn>
        </PermissionGate>
      </div>

      {loading ? (
        <div style={{ padding: spacing['6'] }}>
          <Skeleton height={32} /><div style={{ height: spacing['2'] }} /><Skeleton height={32} />
        </div>
      ) : divisions.length === 0 ? (
        <div style={{ padding: spacing['8'] }}>
          <EmptyState
            title="No division data"
            description="Add line items with a Division value, or set up budget divisions, to see rollups here."
          />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Division</Th>
                <Th width="160px" align="right">Estimated</Th>
                <Th width="160px" align="right">Budget</Th>
                <Th width="160px" align="right">Committed</Th>
                <Th width="160px" align="right">Variance</Th>
                <Th width="140px">As-of</Th>
              </tr>
            </thead>
            <tbody>
              {divisions.map((div) => {
                const r = rollupByDivision.get(div)
                const estimated = estimateByDivision.get(div) ?? r?.total_estimated ?? 0
                const budget = budgetByDivision.get(div) ?? 0
                const committed = r?.total_committed ?? 0
                const variance = budget - estimated
                const varianceColor = variance < 0 ? colors.statusCritical : colors.statusActive
                return (
                  <tr key={div}>
                    <Td><span style={{ fontWeight: typography.fontWeight.medium }}>{div}</span></Td>
                    <Td align="right"><span style={{ fontWeight: typography.fontWeight.semibold }}>{fmtCurrency(estimated)}</span></Td>
                    <Td align="right"><span style={{ color: colors.textSecondary }}>{fmtCurrency(budget)}</span></Td>
                    <Td align="right"><span style={{ color: colors.textSecondary }}>{fmtCurrency(committed)}</span></Td>
                    <Td align="right">
                      <span style={{ color: varianceColor, fontWeight: typography.fontWeight.medium }}>
                        {variance >= 0 ? '+' : ''}{fmtCurrency(variance)}
                      </span>
                    </Td>
                    <Td><span style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm }}>{r?.as_of ?? '—'}</span></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ═════════════════════════════════════════════════════════
// Subcontractors (read-through)
// ═════════════════════════════════════════════════════════

interface SubcontractorsTabProps {
  loading: boolean
  subs: Array<{
    id: string
    company_name: string
    primary_trade: string | null
    status: string
    prequalified: boolean
    rating: number | null
    projects_completed: number
  }>
}

const SubcontractorsTab: React.FC<SubcontractorsTabProps> = ({ loading, subs }) => {
  return (
    <Card padding="0">
      <div style={{ padding: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <SectionHeader
          title="Prequalified Subcontractors"
          subtitle="Organization-wide subcontractor roster. Manage entries in the Subcontractors admin."
        />
      </div>

      {loading ? (
        <div style={{ padding: spacing['6'] }}>
          <Skeleton height={32} /><div style={{ height: spacing['2'] }} /><Skeleton height={32} />
        </div>
      ) : subs.length === 0 ? (
        <div style={{ padding: spacing['8'] }}>
          <EmptyState title="No subcontractors" description="Your organization has not added any prequalified subcontractors yet." />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th width="160px">Primary Trade</Th>
                <Th width="120px">Status</Th>
                <Th width="120px">Prequalified</Th>
                <Th width="100px" align="right">Rating</Th>
                <Th width="120px" align="right">Completed</Th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <Td><span style={{ fontWeight: typography.fontWeight.medium }}>{s.company_name}</span></Td>
                  <Td><span style={{ color: colors.textSecondary }}>{s.primary_trade ?? '—'}</span></Td>
                  <Td>
                    {s.status === 'active'
                      ? <Pill label="Active" color={colors.statusActive} bg={colors.statusActiveSubtle} />
                      : s.status === 'blacklisted'
                        ? <Pill label="Blacklisted" color={colors.statusCritical} bg={colors.statusCriticalSubtle} />
                        : <Pill label={s.status} color={colors.textTertiary} bg={colors.statusNeutralSubtle} />}
                  </Td>
                  <Td>
                    {s.prequalified
                      ? <Pill label="Yes" color={colors.statusActive} bg={colors.statusActiveSubtle} />
                      : <Pill label="No" color={colors.textTertiary} bg={colors.statusNeutralSubtle} />}
                  </Td>
                  <Td align="right"><span style={{ color: colors.textSecondary }}>{s.rating != null ? s.rating.toFixed(1) : '—'}</span></Td>
                  <Td align="right"><span style={{ color: colors.textSecondary }}>{s.projects_completed}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Shared styles ─────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  color: colors.textSecondary,
  marginBottom: spacing.sm,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.base,
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  backgroundColor: 'transparent',
  color: colors.textPrimary,
  cursor: 'pointer',
  boxSizing: 'border-box',
}

export default Estimating
