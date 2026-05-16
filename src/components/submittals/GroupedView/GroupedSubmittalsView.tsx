// Phase 4 — shared GroupedSubmittalsView.
//
// Thin wrapper around the same column infrastructure SubmittalsItemsView
// (Phase 2) uses — buildColumns + useColumnState + useSubmittalSelection —
// applied to a list of pre-grouped row buckets supplied by the per-view
// component (Packages / SpecSections / BIC).
//
// What this component owns:
//   * Column state (resize / sort / pin / hide) — single instance shared
//     across all groups, persisted via useColumnState.
//   * Selection across all visible rows.
//   * Per-group expand/collapse with persisted state (via useGroupExpandState
//     in ExpandAllControls.tsx).
//   * The single column-header row at the top.
//
// What the per-view component owns:
//   * Grouping logic (which rows belong to which group, group labels,
//     subtitles, optional inline actions).
//   * Row pre-filtering (chip filters, search) before passing to this view.
//
// Notes:
//   * No virtualization in Phase 4 — typical group sizes (50–200 rows per
//     view) render well below the 200ms p95 paint budget. If group sizes
//     scale past 1k rows we'll lift the flat-list virtualizer pattern from
//     SubmittalsItemsView; documented in receipt.
//   * Column resize / sort / hide menus mirror Phase 2 verbatim — same
//     ColumnHeaderMenu UX, same ⋮ trigger.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronUp,
  ChevronDown,
  MoreVertical,
  PinOff,
  EyeOff,
  ArrowUpAZ,
  ArrowDownAZ,
} from 'lucide-react'
import { useColumnState, type ColumnPin } from '../../../hooks/useColumnState'
import { useSubmittalSelection } from '../../../hooks/useSubmittalSelection'
import { useAuthStore } from '../../../stores/authStore'
import { buildColumns, type ColumnDef } from '../columns'
import { SubmittalRow } from '../SubmittalRow'
import type { SubmittalListRow } from '../../../hooks/useSubmittalsList'
import { GroupHeader } from './GroupHeader'
import { ExpandAllControls, useGroupExpandState } from './ExpandAllControls'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surfaceInset: '#F5F5F1',
  surface: '#FCFCFA',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const HEADER_HEIGHT = 38

const isOverdueDate = (date: string | null | undefined): boolean => {
  if (!date) return false
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

export interface GroupBucket {
  id: string
  label: React.ReactNode
  subtitle?: React.ReactNode
  rows: SubmittalListRow[]
  /** Optional inline actions on the right side of the group header. */
  actions?: React.ReactNode
  /** When set, the group label becomes a clickable button. */
  onLabelClick?: () => void
  /** Force-collapsed by default (e.g. BIC "Closed" group). */
  defaultCollapsed?: boolean
}

export interface GroupedSubmittalsViewProps {
  projectId: string
  viewType: 'packages' | 'spec_sections' | 'ball_in_court'
  resetToken: string
  numberingFormat: string
  groups: GroupBucket[]
  /**
   * Page-driven clear — Phase 3 BulkActionsMenu calls this after a bulk
   * op to clear selection across views.
   */
  selectionClearToken?: number
  onSelectionIdsChange?: (ids: string[]) => void
  /** Empty state rendered when groups is empty. */
  emptyState?: React.ReactNode
  /** True when the upstream data is still loading. */
  loading?: boolean
}

export const GroupedSubmittalsView: React.FC<GroupedSubmittalsViewProps> = ({
  projectId,
  viewType,
  resetToken,
  numberingFormat,
  groups,
  selectionClearToken,
  onSelectionIdsChange,
  emptyState,
  loading,
}) => {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const allColumns = useMemo(() => buildColumns(), [])
  // Reuse the items-view column state so resize/pin/hide/sort survive across
  // tab switches per spec ("Switching between views does NOT clear filters").
  const columnState = useColumnState(userId, projectId, 'items')
  const selection = useSubmittalSelection({ resetToken })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(typeof window === 'undefined' ? 1440 : window.innerWidth)
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const visibleColumns = useMemo<ColumnDef[]>(() => {
    const userVisible = allColumns.filter((c) => !columnState.getColumn(c.id).hidden)
    if (containerWidth >= 1280) return userVisible
    const essentials = userVisible.filter((c) => !c.collapsible)
    if (essentials.length >= 6) return essentials
    const collapsibles = userVisible.filter((c) => c.collapsible)
    return [...essentials, ...collapsibles].slice(0, Math.max(6, essentials.length))
  }, [allColumns, columnState, containerWidth])

  const orderedColumns = useMemo<ColumnDef[]>(() => {
    const left: ColumnDef[] = []
    const center: ColumnDef[] = []
    const right: ColumnDef[] = []
    for (const c of visibleColumns) {
      const pin = columnState.getColumn(c.id).pin
      if (pin === 'left') left.push(c)
      else if (pin === 'right') right.push(c)
      else center.push(c)
    }
    return [...left, ...center, ...right]
  }, [columnState, visibleColumns])

  const widths = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const c of orderedColumns) {
      const w = columnState.getColumn(c.id).width
      out[c.id] = w ?? c.defaultWidth
    }
    return out
  }, [columnState, orderedColumns])

  const ctx = useMemo(() => ({ numberingFormat, isOverdue: isOverdueDate }), [numberingFormat])

  const groupIds = useMemo(() => groups.map((g) => g.id), [groups])
  const expandState = useGroupExpandState({ projectId, viewType, groupIds })

  // Apply default-collapsed flags on first mount (only if not in URL/storage).
  const collapsedAppliedRef = useRef(false)
  useEffect(() => {
    if (collapsedAppliedRef.current) return
    if (groups.length === 0) return
    const collapsedDefaults = groups.filter((g) => g.defaultCollapsed).map((g) => g.id)
    if (collapsedDefaults.length > 0) {
      const next = new Set(expandState.expanded)
      for (const id of collapsedDefaults) next.delete(id)
      // Trick: use expandAll then remove — easier to just set directly via toggle if needed.
      // We honor the stored state if it exists; otherwise close the defaults.
      if (typeof window !== 'undefined') {
        const storageKey = `sitesync.submittals.groupExpand.${projectId}.${viewType}`
        if (!window.localStorage.getItem(storageKey)) {
          for (const id of collapsedDefaults) {
            if (expandState.isExpanded(id)) expandState.toggle(id)
          }
        }
      }
    }
    collapsedAppliedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  // Selection wiring — visible rows are only those inside expanded groups.
  const visibleIds = useMemo(() => {
    const ids: string[] = []
    for (const g of groups) {
      if (!expandState.isExpanded(g.id)) continue
      for (const r of g.rows) ids.push(String(r.id))
    }
    return ids
  }, [groups, expandState])

  useEffect(() => {
    if (!onSelectionIdsChange) return
    onSelectionIdsChange(Array.from(selection.selectedIds))
  }, [onSelectionIdsChange, selection.selectedIds])

  const selectionClear = selection.clear
  useEffect(() => {
    if (selectionClearToken === undefined) return
    selectionClear()
  }, [selectionClearToken, selectionClear])

  const onColumnResize = useCallback(
    (columnId: string, startX: number, startWidth: number, ev: React.PointerEvent<HTMLDivElement>) => {
      const col = allColumns.find((c) => c.id === columnId)
      if (!col) return
      const target = ev.currentTarget
      target.setPointerCapture(ev.pointerId)
      const onMove = (e: PointerEvent): void => {
        const next = Math.max(col.minWidth, Math.min(col.maxWidth, startWidth + (e.clientX - startX)))
        columnState.setWidth(columnId, next)
      }
      const onUp = (): void => {
        try { target.releasePointerCapture(ev.pointerId) } catch { /* ignore */ }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [allColumns, columnState],
  )

  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null)
  const toggleMenu = (id: string): void => setOpenMenuFor((cur) => (cur === id ? null : id))
  useEffect(() => {
    if (!openMenuFor) return
    const onDocClick = (): void => setOpenMenuFor(null)
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
  }, [openMenuFor])

  const handleOpen = useCallback((id: string) => navigate(`/submittals/${id}`), [navigate])
  const handleEdit = useCallback((id: string) => navigate(`/submittals/${id}?edit=1`), [navigate])

  const headerCheckboxState = selection.headerStateFor(visibleIds)

  if (loading) {
    return (
      <div style={{ padding: 24, color: C.ink3, fontFamily: FONT, fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div
        ref={containerRef}
        role="status"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          fontFamily: FONT,
          backgroundColor: C.surface,
        }}
      >
        {emptyState ?? (
          <span style={{ color: C.ink3, fontSize: 13 }}>
            No groups to display.
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: C.surface,
        fontFamily: FONT,
        color: C.ink,
        overflow: 'hidden',
      }}
    >
      <ExpandAllControls
        groupCount={groups.length}
        expandedCount={expandState.expanded.size}
        onExpandAll={() => expandState.expandAll(groupIds)}
        onCollapseAll={() => expandState.collapseAll()}
      />

      {/* Column header row */}
      <div
        role="rowgroup"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          minHeight: HEADER_HEIGHT,
          backgroundColor: C.surface,
          borderBottom: `1px solid ${C.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 2,
          fontSize: 11,
          fontWeight: 600,
          color: C.ink3,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <div
          style={{
            flex: '0 0 36px',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: `1px solid ${C.borderSubtle}`,
          }}
        >
          <input
            type="checkbox"
            checked={headerCheckboxState === 'all'}
            ref={(el) => { if (el) el.indeterminate = headerCheckboxState === 'some' }}
            onChange={() => selection.toggleAll(visibleIds)}
            aria-label={headerCheckboxState === 'all' ? 'Deselect all' : 'Select all visible'}
            style={{ cursor: 'pointer' }}
          />
        </div>
        {orderedColumns.map((col) => {
          const w = widths[col.id]
          const sort = columnState.getColumn(col.id).sort
          return (
            <div
              key={col.id}
              role="columnheader"
              aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'}
              style={{
                position: 'relative',
                flex: `0 0 ${w}px`,
                width: w,
                minWidth: 0,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                justifyContent: col.numeric ? 'flex-end' : 'flex-start',
              }}
            >
              <button
                type="button"
                onClick={() => columnState.setSort(col.id, sort === 'asc' ? 'desc' : sort === 'desc' ? null : 'asc')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: 'inherit',
                  fontSize: 'inherit',
                  fontWeight: 'inherit',
                  letterSpacing: 'inherit',
                  textTransform: 'inherit',
                  cursor: 'pointer',
                }}
                title={`Sort by ${col.header}`}
              >
                {col.headerCell ? col.headerCell() : col.header}
                {sort === 'asc' && <ChevronUp size={11} />}
                {sort === 'desc' && <ChevronDown size={11} />}
              </button>
              <button
                type="button"
                aria-label={`Column actions: ${col.header}`}
                onClick={(e) => { e.stopPropagation(); toggleMenu(col.id) }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginLeft: 'auto',
                  background: 'transparent',
                  border: 'none',
                  padding: 2,
                  color: C.ink3,
                  cursor: 'pointer',
                }}
              >
                <MoreVertical size={11} />
              </button>
              {openMenuFor === col.id && (
                <ColumnHeaderMenu
                  columnId={col.id}
                  currentSort={sort ?? null}
                  currentPin={columnState.getColumn(col.id).pin ?? null}
                  onSort={(dir) => { columnState.setSort(col.id, dir); setOpenMenuFor(null) }}
                  onPin={(pin) => { columnState.setPin(col.id, pin); setOpenMenuFor(null) }}
                  onHide={() => { columnState.setHidden(col.id, true); setOpenMenuFor(null) }}
                />
              )}
              <div
                role="separator"
                aria-orientation="vertical"
                onPointerDown={(ev) => {
                  ev.preventDefault()
                  onColumnResize(col.id, ev.clientX, w, ev)
                }}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'col-resize',
                  borderRight: `1px solid ${C.borderSubtle}`,
                  userSelect: 'none',
                  touchAction: 'none',
                }}
              />
            </div>
          )
        })}
        <div
          style={{
            flex: '0 0 132px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 10px',
            borderLeft: `1px solid ${C.borderSubtle}`,
          }}
          aria-hidden
        />
      </div>

      {/* Body — flat-rendered groups (no virtualization in Phase 4). */}
      <div role="rowgroup" style={{ flex: 1, overflow: 'auto', backgroundColor: '#fff' }}>
        {groups.map((g) => {
          const expanded = expandState.isExpanded(g.id)
          const total = g.rows.length
          const approved = g.rows.filter((r) => {
            const status = String(r.status ?? '').toLowerCase()
            return status === 'approved' || status === 'approved_as_noted' || status === 'closed'
          }).length
          const overdue = g.rows.filter((r) => {
            const onSite = (r.required_on_site_date as string | null) ?? null
            return isOverdueDate(onSite) && String(r.status ?? '') !== 'closed' && String(r.status ?? '') !== 'void'
          }).length

          return (
            <React.Fragment key={g.id}>
              <GroupHeader
                expanded={expanded}
                onToggle={() => expandState.toggle(g.id)}
                label={g.label}
                subtitle={g.subtitle}
                total={total}
                approved={approved}
                overdue={overdue}
                onLabelClick={g.onLabelClick}
                actions={g.actions}
              />
              {expanded && g.rows.map((row, idx) => (
                <SubmittalRow
                  key={String(row.id)}
                  row={row}
                  columns={orderedColumns}
                  ctx={ctx}
                  widths={widths}
                  selected={selection.isSelected(String(row.id))}
                  onToggleSelect={selection.toggle}
                  onOpen={handleOpen}
                  onEdit={handleEdit}
                  zebra={idx % 2 === 1}
                  index={idx}
                />
              ))}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

interface ColumnHeaderMenuProps {
  columnId: string
  currentSort: 'asc' | 'desc' | null
  currentPin: ColumnPin
  onSort: (dir: 'asc' | 'desc' | null) => void
  onPin: (pin: ColumnPin) => void
  onHide: () => void
}

const ColumnHeaderMenu: React.FC<ColumnHeaderMenuProps> = ({
  columnId,
  currentSort,
  currentPin,
  onSort,
  onPin,
  onHide,
}) => (
  <div
    role="menu"
    tabIndex={-1}
    aria-label={`Column ${columnId} actions`}
    onClick={(e) => e.stopPropagation()}
    style={{
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 4,
      minWidth: 160,
      padding: 4,
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
      zIndex: 10,
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: 0,
      textTransform: 'none',
      color: C.ink,
    }}
  >
    <MenuItem onClick={() => onSort(currentSort === 'asc' ? null : 'asc')}>
      <ArrowUpAZ size={12} /> Sort ascending
    </MenuItem>
    <MenuItem onClick={() => onSort(currentSort === 'desc' ? null : 'desc')}>
      <ArrowDownAZ size={12} /> Sort descending
    </MenuItem>
    <MenuDivider />
    <MenuItem onClick={() => onPin(currentPin === 'left' ? null : 'left')}>
      ⇤ Pin left
    </MenuItem>
    <MenuItem onClick={() => onPin(currentPin === 'right' ? null : 'right')}>
      ⇥ Pin right
    </MenuItem>
    {currentPin && (
      <MenuItem onClick={() => onPin(null)}>
        <PinOff size={12} /> Unpin
      </MenuItem>
    )}
    <MenuDivider />
    <MenuItem onClick={onHide} tone="danger">
      <EyeOff size={12} /> Hide column
    </MenuItem>
  </div>
)

const MenuItem: React.FC<{ children: React.ReactNode; onClick: () => void; tone?: 'default' | 'danger' }> = ({
  children,
  onClick,
  tone = 'default',
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      width: '100%',
      padding: '6px 8px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
      color: tone === 'danger' ? '#C93B3B' : C.ink,
      textAlign: 'left',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surfaceInset }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
  >
    {children}
  </button>
)

const MenuDivider: React.FC = () => (
  <div role="separator" style={{ height: 1, backgroundColor: C.borderSubtle, margin: '4px 0' }} />
)

export default GroupedSubmittalsView
