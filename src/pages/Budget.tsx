// ─────────────────────────────────────────────────────────────────────────────
// Budget — investor-grade, glance-readable money page
// ─────────────────────────────────────────────────────────────────────────────
// Mission: an Owner walks in with the PM and sees, in one screen, what was
// approved, what's committed, what's been spent, and the variance. Dense
// table, real numbers, tabular figures, no decoration.
//
// Locked to the canonical `budget_items` schema (original_amount /
// committed_amount / actual_amount / forecast_amount / percent_complete /
// division / csi_division / description / cost_code). Change-order linkage
// uses `budget_line_item_id` on `change_orders` rows.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorBoundary } from '../components/ErrorBoundary'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useQuery } from '../hooks/useQuery'
import { useProjectId } from '../hooks/useProjectId'
import { useUpdateBudgetItem } from '../hooks/mutations'
import { usePermissions } from '../hooks/usePermissions'
import { useBudgetRealtime } from '../hooks/queries/realtime'
import { fetchBudgetDivisions } from '../api/endpoints/budget'
import { getProject } from '../api/endpoints/projects'
import { computeProjectFinancials } from '../lib/financialEngine'
import type { BudgetItemRow } from '../types/api'
import type { MappedChangeOrder } from '../api/endpoints/budget'
import { fromCents, type Cents } from '../types/money'
import { supabase } from '../lib/supabase'

// ── Page-local design tokens ────────────────────────────────────────────────
// Investor view colors are not tied to the parchment surface — see
// specs/homepage-redesign/DESIGN-RESET.md for the locked palette.
const C = {
  surface: '#FCFCFA',         // true off-white data surface
  surfaceAlt: '#F5F5F1',      // grouping rows / subtotals
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

// ── Number formatting ───────────────────────────────────────────────────────

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const pct1 = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

function fmt$(value: number | null | undefined, dense = true): string {
  if (value == null || Number.isNaN(value)) return '—'
  return dense ? usd0.format(value) : usd2.format(value)
}

function fmtPct(rate01: number | null | undefined): string {
  if (rate01 == null || Number.isNaN(rate01)) return '—'
  return pct1.format(rate01)
}

function centsToDollars(c: Cents | number): number {
  return fromCents(c as Cents) / 100
}

// ── Row shape ───────────────────────────────────────────────────────────────

interface Row {
  id: string
  costCode: string
  division: string
  csiDivision: string
  description: string
  original: number
  committed: number
  actual: number
  forecast: number
  percentComplete: number  // 0..1
  variance: number         // original - forecast (positive = under)
  variancePct: number      // 0..1 (positive = under), negative = over
  coCount: number
  coTotal: number
  status: string | null
}

function rowFromBudgetItem(b: BudgetItemRow, cosOnLine: MappedChangeOrder[]): Row {
  const original = b.original_amount ?? 0
  const committed = b.committed_amount ?? 0
  const actual = b.actual_amount ?? 0
  // Forecast: prefer the stored value; otherwise project from actual + remaining
  // committed at the line's current percent complete.
  const storedForecast = b.forecast_amount
  const computedForecast =
    storedForecast != null
      ? storedForecast
      : Math.max(actual + Math.max(committed - actual, 0), original)
  const forecast = computedForecast
  const variance = original - forecast
  const variancePct = original > 0 ? variance / original : 0
  const percentComplete = ((b.percent_complete ?? 0) as number) / 100
  const approvedCOs = cosOnLine.filter((co) => co.status === 'approved')
  const coTotal = approvedCOs.reduce((s, co) => s + co.amount, 0)
  return {
    id: b.id,
    costCode: b.cost_code ?? '—',
    division: b.division || '—',
    csiDivision: b.csi_division ?? '',
    description: b.description ?? '',
    original,
    committed,
    actual,
    forecast,
    percentComplete,
    variance,
    variancePct,
    coCount: cosOnLine.length,
    coTotal,
    status: b.status ?? null,
  }
}

// ── View toggle ─────────────────────────────────────────────────────────────

type ViewMode = 'summary' | 'by-division' | 'all-lines'

const VIEW_LABEL: Record<ViewMode, string> = {
  summary: 'Summary',
  'by-division': 'By Division',
  'all-lines': 'All Lines',
}

// ── Page component ──────────────────────────────────────────────────────────

const BudgetPage: React.FC = () => {
  const projectId = useProjectId()
  const { hasPermission } = usePermissions()
  const canEditBudget = hasPermission('budget.edit')

  useBudgetRealtime(projectId)

  const {
    data: costData,
    loading: costLoading,
    error: costError,
    refetch: refetchCost,
  } = useQuery(
    `costData-${projectId}`,
    () => fetchBudgetDivisions(projectId!),
    { enabled: !!projectId },
  )

  const { data: projectData } = useQuery(
    `projectData-${projectId}`,
    () => getProject(projectId!),
    { enabled: !!projectId },
  )

  const updateBudgetItem = useUpdateBudgetItem()

  // ── Derived rows ─────────────────────────────────────────────────────────

  const budgetItems = useMemo(() => costData?.budgetItems ?? [], [costData?.budgetItems])
  const changeOrders = useMemo(() => costData?.changeOrders ?? [], [costData?.changeOrders])
  const divisions = useMemo(() => costData?.divisions ?? [], [costData?.divisions])

  const cosByLine = useMemo(() => {
    const m = new Map<string, MappedChangeOrder[]>()
    for (const co of changeOrders) {
      const key = co.budget_line_item_id
      if (!key) continue
      const list = m.get(key) ?? []
      list.push(co)
      m.set(key, list)
    }
    return m
  }, [changeOrders])

  const rows = useMemo<Row[]>(
    () => budgetItems.map((b) => rowFromBudgetItem(b, cosByLine.get(b.id) ?? [])),
    [budgetItems, cosByLine],
  )

  // Engine-computed roll-up — mirrors the rest of the app for cross-page parity.
  const projectFinancials = useMemo(
    () => computeProjectFinancials(divisions, changeOrders, projectData?.totalValue ?? 0),
    [divisions, changeOrders, projectData?.totalValue],
  )

  // Strip totals are sourced from raw rows so an Owner reading these numbers
  // sees the literal sum of the table beneath them — no surprise deltas from
  // contract-value scaling.
  const totals = useMemo(() => {
    let original = 0, committed = 0, actual = 0, forecast = 0
    for (const r of rows) {
      original += r.original
      committed += r.committed
      actual += r.actual
      forecast += r.forecast
    }
    const variance = original - forecast
    const variancePct = original > 0 ? variance / original : 0
    return { original, committed, actual, forecast, variance, variancePct }
  }, [rows])

  // ── UI state ─────────────────────────────────────────────────────────────

  const [view, setView] = useState<ViewMode>('summary')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Track which divisions the user has explicitly *closed*. Default empty
  // means all are open — no seeding needed when we land on by-division.
  const [closedDivisions, setClosedDivisions] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleDivision = (key: string) =>
    setClosedDivisions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const isDivisionOpen = (key: string) => !closedDivisions.has(key)

  // Display rows depend on the view. "Summary" rolls up to one row per
  // division (no per-line detail); the others show every line.
  const summaryRows = useMemo<Row[]>(() => {
    const byDiv = new Map<string, Row>()
    for (const r of rows) {
      const existing = byDiv.get(r.division)
      if (!existing) {
        byDiv.set(r.division, {
          ...r,
          id: `summary-${r.division}`,
          costCode: r.csiDivision || '—',
          description: r.division,
          coCount: r.coCount,
          coTotal: r.coTotal,
        })
        continue
      }
      existing.original += r.original
      existing.committed += r.committed
      existing.actual += r.actual
      existing.forecast += r.forecast
      existing.coCount += r.coCount
      existing.coTotal += r.coTotal
      // Weight percent complete by original budget so a tiny line at 100%
      // doesn't dominate a $5M parent at 10%.
      const totalWeight =
        (existing.original > 0 ? existing.original : 1)
      existing.percentComplete =
        ((existing.percentComplete * (totalWeight - r.original) || 0) +
          r.percentComplete * r.original) /
        (totalWeight || 1)
      existing.variance = existing.original - existing.forecast
      existing.variancePct =
        existing.original > 0 ? existing.variance / existing.original : 0
    }
    return [...byDiv.values()].sort((a, b) =>
      a.csiDivision.localeCompare(b.csiDivision) || a.division.localeCompare(b.division),
    )
  }, [rows])

  const allLineRows = useMemo<Row[]>(
    () => [...rows].sort((a, b) =>
      a.csiDivision.localeCompare(b.csiDivision) ||
      a.division.localeCompare(b.division) ||
      a.costCode.localeCompare(b.costCode),
    ),
    [rows],
  )

  // ── Keyboard nav (j / k / Enter) ─────────────────────────────────────────

  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [focusIndexRaw, setFocusIndex] = useState(0)
  const focusableRows = useMemo<Row[]>(() => {
    if (view === 'summary') return summaryRows
    if (view === 'all-lines') return allLineRows
    // by-division: collapsed rows are not focusable; only those whose division
    // group is open contribute to nav order.
    return allLineRows.filter((r) => !closedDivisions.has(r.division))
  }, [view, summaryRows, allLineRows, closedDivisions])

  // Clamp during render — when rows shrink, the stored index may exceed the
  // new length. Deriving avoids a follow-up setState in an effect.
  const focusIndex = focusableRows.length === 0
    ? 0
    : Math.min(focusIndexRaw, focusableRows.length - 1)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'j') {
        e.preventDefault()
        setFocusIndex((i) => Math.min(focusableRows.length - 1, i + 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setFocusIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        const r = focusableRows[focusIndex]
        if (!r || view === 'summary') return
        e.preventDefault()
        toggleExpanded(r.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusableRows, focusIndex, view])

  // Scroll focused row into view (best-effort; doesn't fight user scrolling).
  useEffect(() => {
    const container = tableScrollRef.current
    if (!container) return
    const r = focusableRows[focusIndex]
    if (!r) return
    const node = container.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(r.id)}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [focusIndex, focusableRows])

  // ── Loading + error rails ────────────────────────────────────────────────

  if (!projectId) {
    return <PageEmpty title="Select a project to view its budget" />
  }
  if (costLoading) {
    return <PageEmpty title="Loading budget…" />
  }
  if (costError) {
    return <PageEmpty title="Couldn't load the budget" body={String(costError)} />
  }
  if (rows.length === 0) {
    return (
      <Shell
        right={
          <PermissionGate permission="budget.edit">
            <Btn primary onClick={() => setAddOpen(true)}>
              <Plus size={14} /> New Line
            </Btn>
          </PermissionGate>
        }
        view={view}
        onView={setView}
      >
        <PageEmpty
          title="No budget lines yet"
          body="Add the first line to see commitments, actuals, and variance roll up."
        />
        {addOpen && (
          <AddLineModal
            projectId={projectId}
            onClose={() => setAddOpen(false)}
            onCreated={() => {
              void refetchCost()
              setAddOpen(false)
            }}
          />
        )}
      </Shell>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const projectName = projectData?.name ?? ''
  const ovrV = totals.original > 0 ? totals.committed / totals.original : 0
  const overBudget = totals.forecast > totals.original && totals.original > 0

  return (
    <Shell
      view={view}
      onView={setView}
      total={totals}
      committedPct={ovrV}
      projectName={projectName}
      right={
        <PermissionGate permission="budget.edit">
          <Btn primary onClick={() => setAddOpen(true)}>
            <Plus size={14} /> New Line
          </Btn>
        </PermissionGate>
      }
    >
      {overBudget && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            backgroundColor: 'rgba(201, 59, 59, 0.06)',
            color: C.critical,
            borderBottom: `1px solid ${C.borderSubtle}`,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={14} />
          Forecast exceeds approved budget by {fmt$(totals.forecast - totals.original)} (
          {fmtPct(Math.abs(totals.variancePct))}).
          Engine projected final cost: {fmt$(centsToDollars(projectFinancials.projectedFinalCost))}.
        </div>
      )}

      <div ref={tableScrollRef} style={{ flex: 1, overflow: 'auto', backgroundColor: C.surface }}>
        <table
          role="grid"
          aria-label={`Budget — ${VIEW_LABEL[view]} view`}
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
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr>
              <Th>Cost Code</Th>
              <Th>Division</Th>
              <Th>Description</Th>
              <Th align="right">Original</Th>
              <Th align="right">Committed</Th>
              <Th align="right">Actual</Th>
              <Th align="right">Forecast</Th>
              <Th align="right">Variance</Th>
              <Th align="right">% Complete</Th>
              <Th align="right">CO</Th>
            </tr>
          </thead>
          <tbody>
            {view === 'summary' &&
              summaryRows.map((r) => (
                <BudgetRow
                  key={r.id}
                  row={r}
                  bold
                  isFocused={focusableRows[focusIndex]?.id === r.id}
                  onClick={() => setFocusIndex(focusableRows.indexOf(r))}
                  expandable={false}
                  expanded={false}
                  onToggle={undefined}
                />
              ))}
            {view === 'all-lines' &&
              allLineRows.map((r) => (
                <RowWithExpansion
                  key={r.id}
                  row={r}
                  expanded={expanded.has(r.id)}
                  onToggle={() => toggleExpanded(r.id)}
                  isFocused={focusableRows[focusIndex]?.id === r.id}
                  onClick={() => setFocusIndex(focusableRows.indexOf(r))}
                  cos={cosByLine.get(r.id) ?? []}
                  canEdit={canEditBudget}
                  onSaveActual={(value) =>
                    updateBudgetItem.mutateAsync({
                      id: r.id,
                      projectId,
                      updates: { actual_amount: value },
                    })
                  }
                  onSavePercent={(value) =>
                    updateBudgetItem.mutateAsync({
                      id: r.id,
                      projectId,
                      updates: { percent_complete: value },
                    })
                  }
                />
              ))}
            {view === 'by-division' && (
              <ByDivisionBody
                rows={allLineRows}
                isDivisionOpen={isDivisionOpen}
                onToggleDivision={toggleDivision}
                expanded={expanded}
                onToggleExpanded={toggleExpanded}
                focusedId={focusableRows[focusIndex]?.id}
                onFocusRow={(id) => {
                  const idx = focusableRows.findIndex((r) => r.id === id)
                  if (idx >= 0) setFocusIndex(idx)
                }}
                cosByLine={cosByLine}
                canEdit={canEditBudget}
                projectId={projectId}
                updateBudgetItem={updateBudgetItem}
              />
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddLineModal
          projectId={projectId}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            void refetchCost()
            setAddOpen(false)
            toast.success('Line added')
          }}
        />
      )}
    </Shell>
  )
}

// ── Shell — sticky header + view toggle + total strip ───────────────────────

interface ShellProps {
  children: React.ReactNode
  right?: React.ReactNode
  view: ViewMode
  onView: (v: ViewMode) => void
  total?: { original: number; committed: number; actual: number; forecast: number; variance: number; variancePct: number }
  committedPct?: number
  projectName?: string
}

const Shell: React.FC<ShellProps> = ({
  children,
  right,
  view,
  onView,
  total,
  committedPct,
  projectName,
}) => {
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
            gap: 24,
            padding: '14px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: C.ink,
              }}
            >
              Budget
            </h1>
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
            {total && (
              <ProjectChip
                committed={total.committed}
                original={total.original}
                committedPct={committedPct ?? 0}
              />
            )}
          </div>

          <ViewToggle value={view} onChange={onView} />

          <div style={{ flex: '0 0 auto' }}>{right}</div>
        </div>

        {total && <TotalStrip total={total} />}
      </header>

      {children}
    </div>
  )
}

// ── ProjectChip — committed of approved + percent ───────────────────────────

const ProjectChip: React.FC<{ committed: number; original: number; committedPct: number }> = ({
  committed,
  original,
  committedPct,
}) => {
  const tone =
    committedPct > 1 ? C.critical : committedPct > 0.9 ? C.pending : C.active
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        backgroundColor: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        fontSize: 12,
        color: C.ink2,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 500,
      }}
    >
      <span style={{ color: C.ink }}>{fmt$(committed)}</span>
      <span style={{ color: C.ink3 }}>committed of</span>
      <span style={{ color: C.ink }}>{fmt$(original)}</span>
      <span
        aria-hidden
        style={{ width: 1, height: 12, backgroundColor: C.border, margin: '0 2px' }}
      />
      <span style={{ color: tone, fontWeight: 600 }}>{fmtPct(committedPct)}</span>
    </span>
  )
}

// ── View toggle ─────────────────────────────────────────────────────────────

const ViewToggle: React.FC<{ value: ViewMode; onChange: (v: ViewMode) => void }> = ({
  value,
  onChange,
}) => {
  const items: ViewMode[] = ['summary', 'by-division', 'all-lines']
  return (
    <div
      role="tablist"
      aria-label="Budget view"
      style={{
        display: 'inline-flex',
        padding: 2,
        backgroundColor: C.surfaceAlt,
        borderRadius: 6,
        border: `1px solid ${C.borderSubtle}`,
      }}
    >
      {items.map((m) => {
        const active = value === m
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            style={{
              padding: '6px 12px',
              minHeight: 28,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              backgroundColor: active ? '#fff' : 'transparent',
              color: active ? C.ink : C.ink2,
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              letterSpacing: '-0.005em',
              boxShadow: active ? '0 1px 1px rgba(0,0,0,0.03)' : 'none',
            }}
          >
            {VIEW_LABEL[m]}
          </button>
        )
      })}
    </div>
  )
}

// ── Total strip — 4 large numbers + variance ────────────────────────────────

const TotalStrip: React.FC<{
  total: { original: number; committed: number; actual: number; forecast: number; variance: number; variancePct: number }
}> = ({ total }) => {
  const v = total.variance
  const vPct = total.variancePct
  const vTone = v < 0 ? C.critical : C.active
  const vSign = v >= 0 ? '+' : '−'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr) auto',
        gap: 0,
        borderTop: `1px solid ${C.borderSubtle}`,
      }}
    >
      <Stat label="Original" value={total.original} />
      <Stat label="Committed" value={total.committed} sub={`${fmtPct(total.original > 0 ? total.committed / total.original : 0)} of original`} />
      <Stat label="Actual" value={total.actual} sub={`${fmtPct(total.original > 0 ? total.actual / total.original : 0)} of original`} />
      <Stat label="Forecast" value={total.forecast} />
      <div
        style={{
          padding: '14px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          minWidth: 200,
          borderLeft: `1px solid ${C.borderSubtle}`,
          backgroundColor: C.surface,
        }}
      >
        <span style={{ fontSize: 11, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          Variance
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: vTone,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}
        >
          {vSign}
          {fmt$(Math.abs(v))}
        </span>
        <span style={{ fontSize: 12, color: vTone, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {vSign}
          {fmtPct(Math.abs(vPct))} {v >= 0 ? 'under budget' : 'over budget'}
        </span>
      </div>
    </div>
  )
}

const Stat: React.FC<{ label: string; value: number; sub?: string }> = ({ label, value, sub }) => (
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
        color: C.ink,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}
    >
      {fmt$(value)}
    </div>
    {sub && (
      <div style={{ marginTop: 4, fontSize: 12, color: C.ink3, fontVariantNumeric: 'tabular-nums' }}>
        {sub}
      </div>
    )}
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

interface BudgetRowProps {
  row: Row
  bold?: boolean
  isFocused: boolean
  onClick: () => void
  expandable: boolean
  expanded: boolean
  onToggle?: () => void
  indent?: number
}

const BudgetRow: React.FC<BudgetRowProps> = ({
  row,
  bold,
  isFocused,
  onClick,
  expandable,
  expanded,
  onToggle,
  indent = 0,
}) => {
  const v = row.variance
  const vPct = row.variancePct
  const vTone = v < 0 ? C.critical : v > 0 ? C.active : C.ink2
  const vSign = v >= 0 ? '+' : '−'
  // Bar width capped at ±20% so a hugely-over-budget row doesn't stretch the
  // column; the numeric percent above the bar carries the actual magnitude.
  const barFrac = Math.min(0.2, Math.abs(vPct)) / 0.2

  return (
    <tr
      data-row-id={row.id}
      onClick={onClick}
      style={{
        backgroundColor: isFocused ? C.surfaceHover : 'transparent',
        cursor: expandable ? 'pointer' : 'default',
        outline: isFocused ? `1px solid ${C.brandOrange}` : 'none',
        outlineOffset: -1,
      }}
    >
      <Td>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: indent,
          }}
        >
          {expandable && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle?.()
              }}
              aria-label={expanded ? 'Collapse' : 'Expand'}
              style={{
                display: 'inline-flex',
                width: 16,
                height: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: C.ink3,
                padding: 0,
              }}
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
          <span
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              fontWeight: bold ? 600 : 500,
              color: C.ink,
            }}
          >
            {row.costCode}
          </span>
        </div>
      </Td>
      <Td>
        <span style={{ fontWeight: bold ? 600 : 400, color: bold ? C.ink : C.ink2 }}>
          {row.csiDivision || row.division}
        </span>
      </Td>
      <Td>
        <span
          style={{
            color: C.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            fontWeight: bold ? 500 : 400,
          }}
        >
          {row.description || row.division}
        </span>
      </Td>
      <Td align="right" mono bold={bold}>
        {fmt$(row.original)}
      </Td>
      <Td align="right" mono bold={bold}>
        {fmt$(row.committed)}
      </Td>
      <Td align="right" mono bold={bold}>
        {fmt$(row.actual)}
      </Td>
      <Td align="right" mono bold={bold}>
        {fmt$(row.forecast)}
      </Td>
      <Td align="right" mono>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ color: vTone, fontWeight: bold ? 600 : 500 }}>
            {row.original === 0 && row.forecast === 0 ? '—' : `${vSign}${fmt$(Math.abs(v))}`}
          </span>
          {row.original > 0 && (
            <div
              aria-hidden
              style={{
                width: 96,
                height: 3,
                backgroundColor: C.borderSubtle,
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: `${barFrac * 100}%`,
                  backgroundColor: vTone,
                  // Under budget bar grows from the right edge inward; over
                  // budget grows from the left so the eye reads "we crossed
                  // zero into red" without a gauge label.
                  right: v >= 0 ? 0 : 'auto',
                  left: v >= 0 ? 'auto' : 0,
                }}
              />
            </div>
          )}
        </div>
      </Td>
      <Td align="right" mono>
        {fmtPct(row.percentComplete)}
      </Td>
      <Td align="right">
        {row.coCount > 0 ? (
          <span
            title={row.coCount === 1 ? '1 change order' : `${row.coCount} change orders`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 20,
              padding: '1px 8px',
              backgroundColor: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              fontSize: 11,
              color: C.ink2,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            CO×{row.coCount}
          </span>
        ) : (
          <span style={{ color: C.ink4 }}>—</span>
        )}
      </Td>
    </tr>
  )
}

const Td: React.FC<{
  children: React.ReactNode
  align?: 'left' | 'right'
  mono?: boolean
  bold?: boolean
}> = ({ children, align = 'left', mono, bold }) => (
  <td
    style={{
      padding: '8px 12px',
      borderBottom: `1px solid ${C.borderSubtle}`,
      textAlign: align,
      fontSize: 13,
      fontWeight: bold ? 600 : 400,
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

// ── Row + expansion ─────────────────────────────────────────────────────────

interface RowExpansionProps {
  row: Row
  expanded: boolean
  onToggle: () => void
  isFocused: boolean
  onClick: () => void
  cos: MappedChangeOrder[]
  canEdit: boolean
  onSaveActual: (value: number) => Promise<unknown>
  onSavePercent: (value: number) => Promise<unknown>
  indent?: number
}

const RowWithExpansion: React.FC<RowExpansionProps> = ({
  row,
  expanded,
  onToggle,
  isFocused,
  onClick,
  cos,
  canEdit,
  onSaveActual,
  onSavePercent,
  indent,
}) => {
  return (
    <>
      <BudgetRow
        row={row}
        bold={false}
        isFocused={isFocused}
        onClick={onClick}
        expandable
        expanded={expanded}
        onToggle={onToggle}
        indent={indent}
      />
      {expanded && (
        <tr>
          <td colSpan={10} style={{ padding: 0, backgroundColor: C.surfaceAlt }}>
            <ExpansionPanel
              row={row}
              cos={cos}
              canEdit={canEdit}
              onSaveActual={onSaveActual}
              onSavePercent={onSavePercent}
            />
          </td>
        </tr>
      )}
    </>
  )
}

const ExpansionPanel: React.FC<{
  row: Row
  cos: MappedChangeOrder[]
  canEdit: boolean
  onSaveActual: (value: number) => Promise<unknown>
  onSavePercent: (value: number) => Promise<unknown>
}> = ({ row, cos, canEdit, onSaveActual, onSavePercent }) => {
  const [actualDraft, setActualDraft] = useState(String(row.actual ?? 0))
  const [pctDraft, setPctDraft] = useState(String(Math.round(row.percentComplete * 100)))

  const dirtyActual = Number(actualDraft) !== row.actual
  const dirtyPct = Number(pctDraft) !== Math.round(row.percentComplete * 100)

  return (
    <div
      style={{
        padding: '14px 24px',
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        fontFamily: FONT,
      }}
    >
      <div>
        <SectionLabel>Change orders on this line</SectionLabel>
        {cos.length === 0 ? (
          <div style={{ fontSize: 13, color: C.ink3, marginTop: 6 }}>None.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <thead>
              <tr>
                <Th>CO #</Th>
                <Th>Title</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {cos.map((co) => (
                <tr key={co.id}>
                  <Td mono>{co.coNumber}</Td>
                  <Td>{co.title || '—'}</Td>
                  <Td align="right" mono>
                    {fmt$(co.amount)}
                  </Td>
                  <Td>
                    <StatusPill status={co.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ fontSize: 12, color: C.ink3, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
          Approved CO subtotal: <span style={{ color: C.ink, fontWeight: 600 }}>{fmt$(row.coTotal)}</span>
        </div>
      </div>

      <div>
        <SectionLabel>Update actuals</SectionLabel>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginTop: 6,
          }}
        >
          <Field
            label="Actual to date"
            value={actualDraft}
            onChange={setActualDraft}
            disabled={!canEdit}
            prefix="$"
          />
          <Field
            label="% Complete"
            value={pctDraft}
            onChange={setPctDraft}
            disabled={!canEdit}
            suffix="%"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <Btn
            disabled={!canEdit || (!dirtyActual && !dirtyPct)}
            onClick={async () => {
              try {
                if (dirtyActual) await onSaveActual(Number(actualDraft) || 0)
                if (dirtyPct) await onSavePercent(Number(pctDraft) || 0)
                toast.success('Saved')
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Save failed')
              }
            }}
            primary
          >
            Save
          </Btn>
        </div>
        <div style={{ fontSize: 12, color: C.ink3, marginTop: 8 }}>
          Forecast (calculated): <span style={{ color: C.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt$(row.forecast, false)}</span>
        </div>
      </div>
    </div>
  )
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: C.ink3,
    }}
  >
    {children}
  </div>
)

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const tone =
    status === 'approved'
      ? C.active
      : status === 'pending_review'
        ? C.pending
        : status === 'rejected' || status === 'void'
          ? C.critical
          : C.ink2
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: tone,
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: tone }} />
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const Field: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  prefix?: string
  suffix?: string
}> = ({ label, value, onChange, disabled, prefix, suffix }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 12, color: C.ink3, fontWeight: 500 }}>{label}</span>
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
        type="number"
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
          fontVariantNumeric: 'tabular-nums',
          fontFamily: FONT,
        }}
      />
      {suffix && <span style={{ color: C.ink3, fontSize: 13 }}>{suffix}</span>}
    </div>
  </label>
)

// ── By-Division body ────────────────────────────────────────────────────────

interface ByDivisionBodyProps {
  rows: Row[]
  isDivisionOpen: (division: string) => boolean
  onToggleDivision: (key: string) => void
  expanded: Set<string>
  onToggleExpanded: (id: string) => void
  focusedId?: string
  onFocusRow: (id: string) => void
  cosByLine: Map<string, MappedChangeOrder[]>
  canEdit: boolean
  projectId: string
  updateBudgetItem: ReturnType<typeof useUpdateBudgetItem>
}

const ByDivisionBody: React.FC<ByDivisionBodyProps> = ({
  rows,
  isDivisionOpen,
  onToggleDivision,
  expanded,
  onToggleExpanded,
  focusedId,
  onFocusRow,
  cosByLine,
  canEdit,
  projectId,
  updateBudgetItem,
}) => {
  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of rows) {
      const list = m.get(r.division) ?? []
      list.push(r)
      m.set(r.division, list)
    }
    return [...m.entries()].sort((a, b) =>
      (a[1][0].csiDivision || '').localeCompare(b[1][0].csiDivision || '') ||
      a[0].localeCompare(b[0]),
    )
  }, [rows])

  return (
    <>
      {grouped.map(([div, divRows]) => {
        const open = isDivisionOpen(div)
        const sub = divRows.reduce(
          (acc, r) => ({
            original: acc.original + r.original,
            committed: acc.committed + r.committed,
            actual: acc.actual + r.actual,
            forecast: acc.forecast + r.forecast,
            coCount: acc.coCount + r.coCount,
          }),
          { original: 0, committed: 0, actual: 0, forecast: 0, coCount: 0 },
        )
        const variance = sub.original - sub.forecast
        const variancePct = sub.original > 0 ? variance / sub.original : 0
        const csi = divRows[0].csiDivision || ''
        const subRow: Row = {
          id: `subtotal-${div}`,
          costCode: csi || '—',
          division: div,
          csiDivision: csi,
          description: div,
          original: sub.original,
          committed: sub.committed,
          actual: sub.actual,
          forecast: sub.forecast,
          percentComplete:
            sub.original > 0
              ? divRows.reduce((s, r) => s + r.percentComplete * r.original, 0) / sub.original
              : 0,
          variance,
          variancePct,
          coCount: sub.coCount,
          coTotal: divRows.reduce((s, r) => s + r.coTotal, 0),
          status: null,
        }
        return (
          <React.Fragment key={div}>
            <BudgetRow
              row={subRow}
              bold
              isFocused={false}
              onClick={() => onToggleDivision(div)}
              expandable
              expanded={open}
              onToggle={() => onToggleDivision(div)}
            />
            {open &&
              divRows.map((r) => (
                <RowWithExpansion
                  key={r.id}
                  row={r}
                  expanded={expanded.has(r.id)}
                  onToggle={() => onToggleExpanded(r.id)}
                  isFocused={focusedId === r.id}
                  onClick={() => onFocusRow(r.id)}
                  cos={cosByLine.get(r.id) ?? []}
                  canEdit={canEdit}
                  onSaveActual={(value) =>
                    updateBudgetItem.mutateAsync({
                      id: r.id,
                      projectId,
                      updates: { actual_amount: value },
                    })
                  }
                  onSavePercent={(value) =>
                    updateBudgetItem.mutateAsync({
                      id: r.id,
                      projectId,
                      updates: { percent_complete: value },
                    })
                  }
                  indent={20}
                />
              ))}
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── Empty / loading states ──────────────────────────────────────────────────

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
    }}
  >
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.ink }}>{title}</h2>
    {body && <p style={{ margin: 0, fontSize: 13, color: C.ink3, maxWidth: 360 }}>{body}</p>}
  </div>
)

// ── Add line modal ──────────────────────────────────────────────────────────

const AddLineModal: React.FC<{
  projectId: string
  onClose: () => void
  onCreated: () => void
}> = ({ projectId, onClose, onCreated }) => {
  const [form, setForm] = useState({
    description: '',
    csi_division: '',
    division: '',
    cost_code: '',
    original_amount: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!form.description.trim()) {
      setErr('Description is required')
      return
    }
    if (!form.division.trim() && !form.csi_division.trim()) {
      setErr('Division or CSI division is required')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const amt = Number.parseFloat(form.original_amount) || 0
      const { error } = await supabase.from('budget_items').insert({
        project_id: projectId,
        description: form.description,
        csi_division: form.csi_division || null,
        division: form.division || form.csi_division || 'General',
        cost_code: form.cost_code || null,
        original_amount: amt,
      })
      if (error) throw error
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create line')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New budget line"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        fontFamily: FONT,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>New budget line</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              borderRadius: 4,
              color: C.ink3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field
            label="Description"
            value={form.description}
            onChange={(v) => setForm((p) => ({ ...p, description: v }))}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field
              label="CSI division"
              value={form.csi_division}
              onChange={(v) => setForm((p) => ({ ...p, csi_division: v }))}
            />
            <Field
              label="Division name"
              value={form.division}
              onChange={(v) => setForm((p) => ({ ...p, division: v }))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field
              label="Cost code"
              value={form.cost_code}
              onChange={(v) => setForm((p) => ({ ...p, cost_code: v }))}
            />
            <Field
              label="Original amount"
              value={form.original_amount}
              onChange={(v) => setForm((p) => ({ ...p, original_amount: v }))}
              prefix="$"
            />
          </div>
        </div>
        {err && (
          <p style={{ margin: '12px 0 0', fontSize: 12, color: C.critical }}>{err}</p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Add line'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Tiny button ─────────────────────────────────────────────────────────────

const Btn: React.FC<{
  children: React.ReactNode
  primary?: boolean
  disabled?: boolean
  onClick?: () => void
}> = ({ children, primary, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 14px',
      minHeight: 32,
      border: primary ? 'none' : `1px solid ${C.border}`,
      backgroundColor: primary ? C.brandOrange : '#fff',
      color: primary ? '#fff' : C.ink,
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

// ── Boundary ────────────────────────────────────────────────────────────────

export const Budget: React.FC = () => (
  <ErrorBoundary message="Budget could not be displayed. Check your connection and try again.">
    <BudgetPage />
  </ErrorBoundary>
)

export default Budget
