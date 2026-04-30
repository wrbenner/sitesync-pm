// ─────────────────────────────────────────────────────────────────────────────
// Change Orders — money in motion (investor-readiness push)
// ─────────────────────────────────────────────────────────────────────────────
// Mission: every dollar in motion, dense and trustworthy. PM tracks pending,
// approved, rejected; sees margin impact at a glance; approves or rejects
// from a slide-in detail panel without leaving the queue.
//
// Data shape: canonical `change_orders` columns. Multi-party approval routes
// via the `approval_chain` JSONB column added in c4799a1. Iris RFI→CO drafts
// surface via the existing `lib/coAutoDraft` lineage (CO.promoted_from_id).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  Sparkles,
  X,
  XCircle,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'

import { ErrorBoundary } from '../components/ErrorBoundary'
import { PermissionGate } from '../components/auth/PermissionGate'
import { PeriodClosedBanner } from '../components/ui/PeriodClosedBanner'
import CreateChangeOrderModal from '../components/forms/CreateChangeOrderModal'
import { useChangeOrders, useProject } from '../hooks/queries'
import {
  useApproveChangeOrder,
  useRejectChangeOrder,
  useSubmitChangeOrder,
} from '../hooks/mutations'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { useProjectId } from '../hooks/useProjectId'
import { useActivePeriod } from '../hooks/queries/financial-periods'
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation'
import type { ChangeOrder } from '../types/database'

// ── Page-local design tokens (DESIGN-RESET.md) ──────────────────────────────

const C = {
  surface: '#FCFCFA',
  surfaceAlt: '#F5F5F1',
  surfaceHover: '#F0EFEB',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  brandOrange: '#F47820',
  critical: '#C93B3B',
  high: '#B8472E',
  pending: '#C4850C',
  active: '#2D8A6E',
  indigo: '#4F46E5',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

// ── Money formatting ────────────────────────────────────────────────────────

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

function fmt$(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return usd0.format(n)
}

function fmt$Compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return usd0.format(n)
}

function fmtPct(rate01: number | null | undefined): string {
  if (rate01 == null || Number.isNaN(rate01)) return '—'
  return `${(rate01 * 100).toFixed(1)}%`
}

function daysOpen(co: ChangeOrder): number | null {
  const startStr =
    co.requested_date ?? co.submitted_at ?? co.created_at ?? null
  if (!startStr) return null
  const start = new Date(startStr)
  if (Number.isNaN(start.getTime())) return null
  const isFinal =
    co.status === 'approved' || co.status === 'rejected' || co.status === 'voided'
  const endStr = isFinal
    ? co.approved_at ?? co.rejected_at ?? co.updated_at ?? null
    : null
  const end = endStr ? new Date(endStr) : new Date()
  const ms = end.getTime() - start.getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

// ── Reason label ────────────────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  owner_request: 'Owner Request',
  owner_directive: 'Owner Directive',
  design_change: 'Design Change',
  unforeseen_condition: 'Unforeseen Condition',
  code_change: 'Code / Regulatory',
  value_engineering: 'Value Engineering',
  scope_addition: 'Scope Addition',
  error_omission: 'Error / Omission',
  rfi_clarification: 'RFI Clarification',
  other: 'Other',
}

function reasonLabel(co: ChangeOrder): string {
  const code = co.reason_code ?? ''
  return REASON_LABEL[code] ?? co.reason ?? '—'
}

// ── Status pill ─────────────────────────────────────────────────────────────

type Status = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'voided'

function tone(status: string | null | undefined): { color: string; bg: string; label: string } {
  switch (status) {
    case 'approved':
      return { color: C.active, bg: 'rgba(45, 138, 110, 0.10)', label: 'Approved' }
    case 'pending_review':
      return { color: C.pending, bg: 'rgba(196, 133, 12, 0.10)', label: 'Pending' }
    case 'rejected':
      return { color: C.critical, bg: 'rgba(201, 59, 59, 0.10)', label: 'Rejected' }
    case 'voided':
      return { color: C.ink3, bg: 'rgba(140, 133, 126, 0.10)', label: 'Voided' }
    case 'draft':
    default:
      return { color: C.ink2, bg: 'rgba(92, 85, 80, 0.06)', label: 'Draft' }
  }
}

const StatusPill: React.FC<{ status: string | null | undefined }> = ({ status }) => {
  const t = tone(status)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 999,
        backgroundColor: t.bg,
        color: t.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.005em',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: t.color }} />
      {t.label}
    </span>
  )
}

// ── Approval chain (multi-party) ────────────────────────────────────────────

interface ChainStep {
  role?: string
  party_id?: string | null
  status?: 'pending' | 'current' | 'approved' | 'rejected' | string
  stamp?: string | null
  comments?: string | null
}

const STEP_TONE: Record<string, string> = {
  approved: C.active,
  current: C.brandOrange,
  rejected: C.critical,
  pending: C.ink4,
}

function readChain(co: ChangeOrder): ChainStep[] {
  const raw = (co as unknown as { approval_chain?: unknown }).approval_chain
  if (!Array.isArray(raw)) return []
  return (raw as ChainStep[]).filter(Boolean)
}

const InlineApprovalChain: React.FC<{ chain: ChainStep[] }> = ({ chain }) => {
  if (chain.length === 0) return <span style={{ color: C.ink4 }}>—</span>
  const visible = chain.length > 5 ? [...chain.slice(0, 4), { status: 'pending', role: `+${chain.length - 4} more` } as ChainStep] : chain
  return (
    <span aria-label={`Approval chain — ${chain.length} steps`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {visible.map((step, i) => {
        const color = STEP_TONE[String(step.status ?? 'pending')] ?? STEP_TONE.pending
        return (
          <React.Fragment key={`${step.role ?? 'step'}-${i}`}>
            {i > 0 && <span aria-hidden style={{ width: 6, height: 1, backgroundColor: C.border }} />}
            <span
              title={`${step.role ?? `Step ${i + 1}`} — ${step.status ?? 'pending'}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
                opacity: step.status === 'pending' ? 0.6 : 0.9,
              }}
            />
          </React.Fragment>
        )
      })}
    </span>
  )
}

const ChainBlock: React.FC<{ chain: ChainStep[] }> = ({ chain }) => {
  if (chain.length === 0) {
    return (
      <div
        style={{
          fontSize: 12,
          color: C.ink3,
          padding: '8px 0',
        }}
      >
        No approval chain configured.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {chain.map((step, i) => {
        const status = String(step.status ?? 'pending')
        const color = STEP_TONE[status] ?? STEP_TONE.pending
        return (
          <div
            key={`${step.role ?? 'step'}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              backgroundColor: status === 'current' ? 'rgba(244, 120, 32, 0.06)' : C.surface,
              border: `1px solid ${status === 'current' ? C.brandOrange : C.borderSubtle}`,
              borderRadius: 4,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: C.ink, fontWeight: 500 }}>{step.role ?? `Step ${i + 1}`}</span>
            <span
              style={{
                fontSize: 11,
                color,
                fontWeight: 600,
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
              }}
            >
              {status.replace(/_/g, ' ')}
            </span>
            {step.stamp && (
              <span style={{ fontSize: 11, color: C.ink3, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                {new Date(step.stamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Filter ──────────────────────────────────────────────────────────────────

type Filter = 'all' | 'draft' | 'pending_review' | 'approved' | 'rejected' | 'voided'

const FILTER_ORDER: Filter[] = ['all', 'draft', 'pending_review', 'approved', 'rejected', 'voided']

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  draft: 'Draft',
  pending_review: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Voided',
}

// ── Page ────────────────────────────────────────────────────────────────────

const ChangeOrdersPage: React.FC = () => {
  const projectId = useProjectId()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPermission, role: projectRole } = usePermissions()
  const canApprove = hasPermission('change_orders.approve')
  const canCreate = hasPermission('change_orders.create')

  useRealtimeInvalidation(projectId)

  const { data: cos, isLoading, isError, refetch } = useChangeOrders(projectId)
  const { data: project } = useProject(projectId)
  const { data: activePeriod } = useActivePeriod(projectId)

  const approveCO = useApproveChangeOrder()
  const rejectCO = useRejectChangeOrder()
  const submitCO = useSubmitChangeOrder()

  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const periodLocked = !!activePeriod && activePeriod.status === 'closed'

  const all = useMemo<ChangeOrder[]>(() => cos ?? [], [cos])

  const counts = useMemo<Record<Filter, number>>(() => {
    const c: Record<Filter, number> = { all: 0, draft: 0, pending_review: 0, approved: 0, rejected: 0, voided: 0 }
    c.all = all.length
    for (const co of all) {
      const s = (co.status ?? 'draft') as Status
      if (s === 'draft') c.draft++
      else if (s === 'pending_review') c.pending_review++
      else if (s === 'approved') c.approved++
      else if (s === 'rejected') c.rejected++
      else if (s === 'voided') c.voided++
    }
    return c
  }, [all])

  // ── Totals strip ────────────────────────────────────────────────────────
  // Pending = sum of submitted_cost (or amount) across pending_review + draft
  // Approved this period = sum of approved_cost (or amount) approved in the
  //   active financial period (or last 30d if no period gates exist)
  // Rejected = sum of submitted_cost (or amount) on rejected COs
  // Margin impact = approved_total / contract_value (project)
  // FinancialPeriod schema uses `start_date`/`end_date` (not period_*); the
  // generated types are authoritative. Coerce to allow either name at runtime
  // since some older periods may carry the older shape.
  const periodAny = activePeriod as unknown as { period_start?: string | null; period_end?: string | null; start_date?: string | null; end_date?: string | null } | null
  const periodStartIso = periodAny?.period_start ?? periodAny?.start_date ?? null
  const periodEndIso = periodAny?.period_end ?? periodAny?.end_date ?? null

  const totals = useMemo(() => {
    // "Now" is captured once per memo run. We accept that the rolling window
    // freezes between memo runs — when the active period flips or `all`
    // changes, the window recomputes. For a financial UI this is fine.
    // eslint-disable-next-line react-hooks/purity
    const nowMs = Date.now()
    const periodStart = periodStartIso ? new Date(periodStartIso).getTime() : nowMs - 30 * 86400000
    const periodEnd = periodEndIso ? new Date(periodEndIso).getTime() : nowMs
    let pending = 0
    let approvedThisPeriod = 0
    let rejected = 0
    let approvedAllTime = 0
    for (const co of all) {
      const submitted = (co.submitted_cost as number | null) ?? (co.amount as number | null) ?? 0
      const approved = ((co as unknown as { approved_amount?: number | null }).approved_amount as number | null)
        ?? (co.approved_cost as number | null) ?? (co.amount as number | null) ?? 0
      if (co.status === 'pending_review' || co.status === 'draft') pending += submitted
      else if (co.status === 'approved') {
        approvedAllTime += approved
        const stamp = co.approved_at ?? co.approved_date
        if (stamp) {
          const t = new Date(stamp).getTime()
          if (t >= periodStart && t <= periodEnd) approvedThisPeriod += approved
        }
      } else if (co.status === 'rejected') rejected += submitted
    }
    const contractValue = ((project as unknown as { totalValue?: number; contract_value?: number })?.contract_value
      ?? (project as unknown as { totalValue?: number })?.totalValue
      ?? 0)
    const marginImpactRate = contractValue > 0 ? approvedAllTime / contractValue : 0
    return { pending, approvedThisPeriod, rejected, approvedAllTime, marginImpactRate, contractValue }
  }, [all, periodStartIso, periodEndIso, project])

  // ── Filtered + sorted rows ──────────────────────────────────────────────

  const rows = useMemo<ChangeOrder[]>(() => {
    let arr = all
    if (filter !== 'all') arr = arr.filter((co) => co.status === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      arr = arr.filter((co) => {
        const num = String(co.number ?? '')
        return (
          num.toLowerCase().includes(q) ||
          (co.title ?? '').toLowerCase().includes(q) ||
          (co.description ?? '').toLowerCase().includes(q) ||
          (reasonLabel(co)).toLowerCase().includes(q) ||
          (co.requested_by ?? '').toLowerCase().includes(q)
        )
      })
    }
    return [...arr].sort((a, b) => {
      const an = (a.number as number | null) ?? 0
      const bn = (b.number as number | null) ?? 0
      return bn - an
    })
  }, [all, filter, search])

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? all.find((r) => r.id === selectedId) ?? null : null),
    [selectedId, rows, all],
  )

  // ── Keyboard nav: j/k step rows, Enter open, Esc close detail. ─────────

  const tableRef = useRef<HTMLDivElement>(null)
  const [focusIndexRaw, setFocusIndex] = useState(0)
  const focusIndex = rows.length === 0 ? 0 : Math.min(focusIndexRaw, rows.length - 1)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'j') {
        e.preventDefault()
        setFocusIndex((i) => Math.min(rows.length - 1, i + 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setFocusIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        const r = rows[focusIndex]
        if (!r) return
        e.preventDefault()
        setSelectedId(r.id)
      } else if (e.key === 'Escape' && selectedId) {
        e.preventDefault()
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [rows, focusIndex, selectedId])

  useEffect(() => {
    const node = tableRef.current?.querySelector<HTMLElement>(`[data-co-row-index="${focusIndex}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [focusIndex])

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleApprove = async (co: ChangeOrder, opts?: { approvedCost?: number; comments?: string }) => {
    if (!projectId || !user?.id) return
    try {
      await approveCO.mutateAsync({
        id: co.id,
        userId: user.id,
        projectId,
        comments: opts?.comments,
        approvedCost: opts?.approvedCost,
      })
      toast.success(`CO #${co.number ?? '—'} approved`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve')
    }
  }

  const handleReject = async (co: ChangeOrder, comments: string) => {
    if (!projectId || !user?.id) return
    try {
      await rejectCO.mutateAsync({ id: co.id, userId: user.id, projectId, comments })
      toast.success(`CO #${co.number ?? '—'} rejected`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject')
    }
  }

  const handleSubmit = async (co: ChangeOrder) => {
    if (!projectId || !user?.id) return
    try {
      await submitCO.mutateAsync({ id: co.id, userId: user.id, projectId })
      toast.success(`CO #${co.number ?? '—'} submitted for review`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit')
    }
  }

  // ── Loading / error / empty ─────────────────────────────────────────────

  if (!projectId) return <PageEmpty title="Select a project to see change orders" />
  if (isLoading) return <PageEmpty title="Loading change orders…" />
  if (isError) {
    return (
      <Shell
        projectName={project?.name}
        filter={filter}
        setFilter={setFilter}
        counts={counts}
        search={search}
        setSearch={setSearch}
        totals={totals}
        actions={null}
        periodLocked={periodLocked}
      >
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 24px',
            backgroundColor: 'rgba(201, 59, 59, 0.06)',
            color: C.critical,
            borderBottom: `1px solid ${C.borderSubtle}`,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>Couldn’t load change orders.</span>
          <button
            onClick={() => refetch()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              minHeight: 30,
              backgroundColor: '#fff',
              color: C.ink,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </Shell>
    )
  }

  if (all.length === 0) {
    return (
      <Shell
        projectName={project?.name}
        filter={filter}
        setFilter={setFilter}
        counts={counts}
        search={search}
        setSearch={setSearch}
        totals={totals}
        periodLocked={periodLocked}
        actions={
          <PermissionGate permission="change_orders.create">
            <PrimaryBtn onClick={() => setCreateOpen(true)} disabled={periodLocked}>
              <Plus size={14} /> New CO
            </PrimaryBtn>
          </PermissionGate>
        }
      >
        <PageEmpty
          title="No change orders yet"
          body="Track every dollar in motion — pending, approved, rejected, and margin impact."
        />
        {createOpen && projectId && (
          <CreateChangeOrderModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onSubmit={async () => {
              // Modal owns its own form state and creation flow; consumer
              // closes on successful submit. The projectId is read from the
              // active-project store inside the modal — no prop needed here.
              setCreateOpen(false)
            }}
          />
        )}
      </Shell>
    )
  }

  return (
    <Shell
      projectName={project?.name}
      filter={filter}
      setFilter={setFilter}
      counts={counts}
      search={search}
      setSearch={setSearch}
      totals={totals}
      periodLocked={periodLocked}
      actions={
        <PermissionGate permission="change_orders.create">
          <PrimaryBtn onClick={() => setCreateOpen(true)} disabled={periodLocked}>
            <Plus size={14} /> New CO
          </PrimaryBtn>
        </PermissionGate>
      }
    >
      <div ref={tableRef} style={{ flex: 1, overflow: 'auto', backgroundColor: C.surface }}>
        <table
          role="grid"
          aria-label="Change orders"
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontFamily: FONT,
            fontSize: 13,
            color: C.ink2,
          }}
        >
          <colgroup>
            <col style={{ width: 80 }} />
            <col />
            <col style={{ width: 160 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr>
              <Th align="right">#</Th>
              <Th>Title</Th>
              <Th>Reason</Th>
              <Th>Originator</Th>
              <Th align="right">Amount</Th>
              <Th>Status</Th>
              <Th align="right">Days Open</Th>
              <Th>Linked RFI</Th>
              <Th>Approval Chain</Th>
              <Th>Iris</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((co, idx) => (
              <CORow
                key={co.id}
                co={co}
                isFocused={focusIndex === idx}
                isSelected={selectedId === co.id}
                rowIndex={idx}
                onClick={() => {
                  setFocusIndex(idx)
                  setSelectedId(co.id)
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && projectId && (
        <CreateChangeOrderModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSubmit={async () => setCreateOpen(false)}
        />
      )}

      {selected && (
        <DetailPanel
          co={selected}
          canApprove={canApprove}
          canCreate={canCreate}
          periodLocked={periodLocked}
          onClose={() => setSelectedId(null)}
          onApprove={(opts) => handleApprove(selected, opts)}
          onReject={(comments) => handleReject(selected, comments)}
          onSubmit={() => handleSubmit(selected)}
          onOpenRfi={(rfiId) => navigate(`/rfis/${rfiId}`)}
          isRoleSubcontractor={projectRole === 'subcontractor'}
        />
      )}
    </Shell>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

const CORow: React.FC<{
  co: ChangeOrder
  isFocused: boolean
  isSelected: boolean
  rowIndex: number
  onClick: () => void
}> = ({ co, isFocused, isSelected, rowIndex, onClick }) => {
  const amount = (co.submitted_cost as number | null)
    ?? ((co as unknown as { approved_amount?: number | null }).approved_amount as number | null)
    ?? (co.amount as number | null)
    ?? 0
  const days = daysOpen(co)
  const chain = readChain(co)
  const isDraftFromRfi = co.promoted_from_id != null && (co.status === 'draft' || co.status === 'pending_review')
  const linkedRfiId = (co as unknown as { rfi_id?: string | null }).rfi_id ?? null

  return (
    <tr
      data-co-row-index={rowIndex}
      onClick={onClick}
      style={{
        backgroundColor: isSelected
          ? 'rgba(244, 120, 32, 0.06)'
          : isFocused
            ? C.surfaceHover
            : 'transparent',
        cursor: 'pointer',
        outline: isFocused ? `1px solid ${C.brandOrange}` : 'none',
        outlineOffset: -1,
      }}
    >
      <Td align="right" mono>
        <span style={{ color: C.ink, fontWeight: 600 }}>{co.number != null ? `#${co.number}` : '—'}</span>
      </Td>
      <Td>
        <span style={{ color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {co.title ?? co.description ?? '—'}
        </span>
      </Td>
      <Td>{reasonLabel(co)}</Td>
      <Td>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {co.requested_by ?? co.created_by ?? '—'}
        </span>
      </Td>
      <Td align="right" mono>
        <span
          style={{
            color: amount < 0 ? C.active : C.ink,
            fontWeight: 600,
          }}
        >
          {amount === 0 ? '—' : fmt$(amount)}
        </span>
      </Td>
      <Td>
        <StatusPill status={co.status} />
      </Td>
      <Td align="right" mono>
        {days == null ? '—' : (
          <span
            style={{
              color: days > 14 ? C.critical : days > 7 ? C.high : C.ink2,
              fontWeight: days > 14 ? 600 : 500,
            }}
          >
            {days}d
          </span>
        )}
      </Td>
      <Td>
        {linkedRfiId ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: C.ink2,
              fontFamily: MONO,
            }}
          >
            <Link2 size={11} />
            {linkedRfiId.slice(0, 6)}…
          </span>
        ) : co.promoted_from_id ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: C.ink3,
              fontFamily: MONO,
            }}
            title="Promoted from another change order"
          >
            <Link2 size={11} />
            promoted
          </span>
        ) : (
          <span style={{ color: C.ink4 }}>—</span>
        )}
      </Td>
      <Td>
        <InlineApprovalChain chain={chain} />
      </Td>
      <Td>
        {isDraftFromRfi ? (
          <span
            title="Iris drafted this from RFI lineage"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              backgroundColor: 'rgba(79, 70, 229, 0.10)',
              color: C.indigo,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Sparkles size={10} />
            Iris draft
          </span>
        ) : (
          <span style={{ color: C.ink4 }}>—</span>
        )}
      </Td>
    </tr>
  )
}

// ── Detail panel (slide-in from right) ──────────────────────────────────────

interface DetailPanelProps {
  co: ChangeOrder
  canApprove: boolean
  canCreate: boolean
  periodLocked: boolean
  onClose: () => void
  onApprove: (opts: { approvedCost?: number; comments?: string }) => Promise<void>
  onReject: (comments: string) => Promise<void>
  onSubmit: () => Promise<void>
  onOpenRfi: (rfiId: string) => void
  isRoleSubcontractor: boolean
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  co,
  canApprove,
  periodLocked,
  onClose,
  onApprove,
  onReject,
  onSubmit,
}) => {
  const submittedAmount = (co.submitted_cost as number | null) ?? (co.amount as number | null) ?? 0
  const approvedDefault = ((co as unknown as { approved_amount?: number | null }).approved_amount as number | null)
    ?? (co.approved_cost as number | null)
    ?? submittedAmount
  const [approvedCost, setApprovedCost] = useState(String(approvedDefault ?? 0))
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState(false)
  const chain = readChain(co)

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside
      role="complementary"
      aria-label={`Change order #${co.number ?? ''} detail`}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 480,
        maxWidth: '100vw',
        backgroundColor: C.surface,
        borderLeft: `1px solid ${C.border}`,
        boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.06)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        color: C.ink,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>
          {co.number != null ? `#${co.number}` : '—'}
        </span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {co.title ?? co.description ?? 'Untitled CO'}
        </h2>
        <StatusPill status={co.status} />
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: C.ink2,
          }}
        >
          <X size={16} />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Section label="Summary">
          <Grid2>
            <KV k="Reason" v={reasonLabel(co)} />
            <KV k="Originator" v={co.requested_by ?? co.created_by ?? '—'} />
            <KV k="Submitted" v={fmt$(submittedAmount)} mono />
            <KV k="Approved" v={fmt$((co.approved_cost as number | null) ?? ((co as unknown as { approved_amount?: number | null }).approved_amount as number | null))} mono />
            <KV
              k="Schedule impact"
              v={
                co.schedule_impact_days
                  ? `${co.schedule_impact_days > 0 ? '+' : ''}${co.schedule_impact_days}d`
                  : co.schedule_impact ?? '—'
              }
            />
            <KV
              k="Days open"
              v={(() => {
                const d = daysOpen(co)
                return d == null ? '—' : `${d}d`
              })()}
            />
          </Grid2>
        </Section>

        {co.description && (
          <Section label="Description">
            <p style={{ margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {co.description}
            </p>
          </Section>
        )}

        <Section label="Approval chain">
          <ChainBlock chain={chain} />
        </Section>

        {(co.review_comments || co.approval_comments || co.rejection_comments) && (
          <Section label="Comments">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {co.review_comments && <CommentBlock label="Review" body={co.review_comments} />}
              {co.approval_comments && <CommentBlock label="Approval" body={co.approval_comments} />}
              {co.rejection_comments && <CommentBlock label="Rejection" body={co.rejection_comments} />}
            </div>
          </Section>
        )}

        {/* Approve / reject actions */}
        {co.status === 'pending_review' && canApprove && !periodLocked && (
          <Section label="Decide">
            <Grid2>
              <Field
                label="Approved amount"
                value={approvedCost}
                onChange={setApprovedCost}
                prefix="$"
                disabled={busy}
              />
              <Field
                label="Comments"
                value={comments}
                onChange={setComments}
                disabled={busy}
              />
            </Grid2>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <SecondaryBtn
                disabled={busy || !comments.trim()}
                onClick={() =>
                  wrap(() => onReject(comments.trim() || 'Rejected.'))
                }
              >
                <XCircle size={14} /> Reject
              </SecondaryBtn>
              <PrimaryBtn
                disabled={busy}
                onClick={() =>
                  wrap(() =>
                    onApprove({
                      approvedCost: Number(approvedCost) || undefined,
                      comments: comments.trim() || undefined,
                    }),
                  )
                }
              >
                <CheckCircle size={14} /> Approve
              </PrimaryBtn>
            </div>
          </Section>
        )}

        {co.status === 'draft' && canApprove === false && (
          <Section label="Submit for review">
            <PrimaryBtn disabled={busy} onClick={() => wrap(() => onSubmit())}>
              Submit for review
            </PrimaryBtn>
          </Section>
        )}
        {co.status === 'draft' && canApprove && !periodLocked && (
          <Section label="Submit for review">
            <PrimaryBtn disabled={busy} onClick={() => wrap(() => onSubmit())}>
              Submit for review
            </PrimaryBtn>
          </Section>
        )}

        {periodLocked && (
          <Section label="Period closed">
            <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
              The active financial period is closed. Reopen it to record decisions on this change order.
            </p>
          </Section>
        )}
      </div>
    </aside>
  )
}

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <section>
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: C.ink3,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    {children}
  </section>
)

const Grid2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
)

const KV: React.FC<{ k: string; v: React.ReactNode; mono?: boolean }> = ({ k, v, mono }) => (
  <div>
    <div style={{ fontSize: 11, color: C.ink3, fontWeight: 500 }}>{k}</div>
    <div
      style={{
        fontSize: 13,
        color: C.ink,
        fontWeight: 500,
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      }}
    >
      {v ?? '—'}
    </div>
  </div>
)

const CommentBlock: React.FC<{ label: string; body: string }> = ({ label, body }) => (
  <div
    style={{
      padding: '8px 10px',
      backgroundColor: C.surfaceAlt,
      border: `1px solid ${C.borderSubtle}`,
      borderRadius: 4,
    }}
  >
    <div style={{ fontSize: 11, color: C.ink3, fontWeight: 600, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 13, color: C.ink, whiteSpace: 'pre-wrap' }}>{body}</div>
  </div>
)

const Field: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  prefix?: string
}> = ({ label, value, onChange, disabled, prefix }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, color: C.ink3, fontWeight: 600 }}>{label}</span>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 10px',
        backgroundColor: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {prefix && <span style={{ color: C.ink3, fontSize: 13 }}>{prefix}</span>}
      <input
        type={prefix === '$' ? 'number' : 'text'}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          color: C.ink,
          fontSize: 13,
          fontFamily: FONT,
          fontVariantNumeric: prefix === '$' ? 'tabular-nums' : 'normal',
        }}
      />
    </div>
  </label>
)

// ── Shell — sticky header + total strip + body ──────────────────────────────

interface ShellProps {
  children: React.ReactNode
  actions?: React.ReactNode
  projectName?: string
  filter: Filter
  setFilter: (f: Filter) => void
  counts: Record<Filter, number>
  search: string
  setSearch: (s: string) => void
  totals: { pending: number; approvedThisPeriod: number; rejected: number; approvedAllTime: number; marginImpactRate: number; contractValue: number }
  periodLocked: boolean
}

const Shell: React.FC<ShellProps> = ({
  children,
  actions,
  projectName,
  filter,
  setFilter,
  counts,
  search,
  setSearch,
  totals,
  periodLocked,
}) => {
  const projectId = useProjectId()
  const exposureLabel =
    `${fmt$Compact(totals.pending)} pending · ${fmt$Compact(totals.approvedThisPeriod)} approved this period`
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        backgroundColor: C.surface,
        color: C.ink,
        fontFamily: FONT,
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: C.surface,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 24px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>
              Change Orders
            </h1>
            <ExposureChip label={exposureLabel} />
            {projectName && (
              <span
                style={{
                  fontSize: 13,
                  color: C.ink3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 320,
                }}
              >
                {projectName}
              </span>
            )}
          </div>

          <SearchInput value={search} onChange={setSearch} />
          {actions}
        </div>

        <FilterChips filter={filter} setFilter={setFilter} counts={counts} />

        <TotalsStrip totals={totals} />

        {periodLocked && (
          <div style={{ padding: '0 24px 12px' }}>
            <PeriodClosedBanner projectId={projectId ?? undefined} />
          </div>
        )}
      </header>

      {children}
    </div>
  )
}

const ExposureChip: React.FC<{ label: string }> = ({ label }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      backgroundColor: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      fontSize: 12,
      color: C.ink2,
      fontWeight: 500,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
)

const SearchInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <input
    type="search"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Search number, title, originator…"
    aria-label="Search change orders"
    style={{
      width: 260,
      padding: '6px 12px',
      minHeight: 32,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      fontSize: 13,
      fontFamily: FONT,
      backgroundColor: '#fff',
      color: C.ink,
      outline: 'none',
    }}
  />
)

const FilterChips: React.FC<{ filter: Filter; setFilter: (f: Filter) => void; counts: Record<Filter, number> }> = ({
  filter,
  setFilter,
  counts,
}) => (
  <div
    role="tablist"
    aria-label="Filter change orders by status"
    style={{
      display: 'flex',
      gap: 6,
      padding: '0 24px 12px',
      flexWrap: 'wrap',
    }}
  >
    {FILTER_ORDER.map((f) => {
      const active = filter === f
      const count = counts[f]
      const tt = f === 'all' ? null : tone(f)
      return (
        <button
          key={f}
          role="tab"
          aria-selected={active}
          onClick={() => setFilter(f)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            minHeight: 28,
            backgroundColor: active ? '#fff' : C.surfaceAlt,
            color: active ? C.ink : C.ink2,
            border: `1px solid ${active ? C.border : 'transparent'}`,
            borderRadius: 999,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: active ? 600 : 500,
            fontFamily: FONT,
          }}
        >
          {tt && <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: tt.color }} />}
          {FILTER_LABEL[f]}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: active ? C.ink2 : C.ink3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        </button>
      )
    })}
  </div>
)

const TotalsStrip: React.FC<{ totals: ShellProps['totals'] }> = ({ totals }) => {
  const margin = totals.marginImpactRate
  const marginColor =
    margin === 0 ? C.ink3 : margin > 0.05 ? C.critical : margin > 0.02 ? C.high : C.active
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: `1px solid ${C.borderSubtle}`,
      }}
    >
      <Stat label="Pending" value={totals.pending} tone={C.pending} />
      <Stat label="Approved (this period)" value={totals.approvedThisPeriod} tone={C.active} />
      <Stat label="Rejected" value={totals.rejected} tone={C.critical} />
      <div
        style={{
          padding: '14px 24px',
          borderLeft: `1px solid ${C.borderSubtle}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: C.ink3,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Margin Impact
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: marginColor,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {fmtPct(margin)}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: C.ink3, fontVariantNumeric: 'tabular-nums' }}>
          {fmt$(totals.approvedAllTime)} approved · {fmt$(totals.contractValue)} contract
        </div>
      </div>
    </div>
  )
}

const Stat: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone: toneColor }) => (
  <div style={{ padding: '14px 24px', borderRight: `1px solid ${C.borderSubtle}` }}>
    <div
      style={{
        fontSize: 11,
        color: C.ink3,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontWeight: 600,
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: value === 0 ? C.ink3 : toneColor,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}
    >
      {fmt$(value)}
    </div>
  </div>
)

// ── Table primitives ────────────────────────────────────────────────────────

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align = 'left' }) => (
  <th
    scope="col"
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 1,
      textAlign: align,
      padding: '8px 12px',
      backgroundColor: C.surface,
      borderBottom: `1px solid ${C.border}`,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: C.ink3,
      whiteSpace: 'nowrap',
      fontVariantNumeric: align === 'right' ? 'tabular-nums' : 'normal',
    }}
  >
    {children}
  </th>
)

const Td: React.FC<{
  children: React.ReactNode
  align?: 'left' | 'right'
  mono?: boolean
}> = ({ children, align = 'left', mono }) => (
  <td
    style={{
      padding: '8px 12px',
      borderBottom: `1px solid ${C.borderSubtle}`,
      textAlign: align,
      fontSize: 13,
      fontFamily: mono ? MONO : FONT,
      color: C.ink2,
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 0,
    }}
  >
    {children}
  </td>
)

// ── Buttons + empty state ───────────────────────────────────────────────────

const PrimaryBtn: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ onClick, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 14px',
      minHeight: 32,
      backgroundColor: C.brandOrange,
      color: '#fff',
      border: 'none',
      borderRadius: 4,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '-0.005em',
    }}
  >
    {children}
  </button>
)

const SecondaryBtn: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ onClick, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      minHeight: 30,
      backgroundColor: '#fff',
      color: C.ink,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 600,
    }}
  >
    {children}
  </button>
)

const PageEmpty: React.FC<{ title: string; body?: string }> = ({ title, body }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 8,
      height: '60vh',
      padding: 32,
      fontFamily: FONT,
      color: C.ink2,
      textAlign: 'center',
      backgroundColor: C.surface,
    }}
  >
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.ink }}>{title}</h2>
    {body && <p style={{ margin: 0, fontSize: 13, color: C.ink3, maxWidth: 360 }}>{body}</p>}
  </div>
)

// ── Boundary ────────────────────────────────────────────────────────────────

export function ChangeOrders() {
  return (
    <ErrorBoundary message="Change Orders could not be displayed. Check your connection and try again.">
      <ChangeOrdersPage />
    </ErrorBoundary>
  )
}

export default ChangeOrders
