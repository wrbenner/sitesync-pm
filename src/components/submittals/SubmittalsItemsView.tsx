// Phase 2 — dense virtualized Items view for /submittals.
//
// Per SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 2:
//   * 11 columns at 1440px viewport, no horizontal scroll
//   * Below 1280px, columns 7-11 collapse into an overflow indicator
//   * Resize handles on every header
//   * ⋮ menu with Sort asc/desc, Pin left, Pin right, Hide
//   * Persist column widths/visibility/pin/sort to localStorage
//   * Inline Edit + Open buttons on every row (PermissionGate-wrapped)
//   * Server-side virtualization via @tanstack/react-virtual
//   * Real BIC from submittals_log_mv (em-dash only for draft/closed/void)
//   * Status pills colored (9-state aware via StatusPill)
//   * Row checkboxes wired to useSubmittalSelection
//   * Bulk Actions trigger lives in the page toolbar; Phase 3 wires the menu
//   * Paint-perf telemetry via useItemsViewPaintTelemetry

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ChevronUp,
  ChevronDown,
  MoreVertical,
  PinOff,
  EyeOff,
  ArrowUpAZ,
  ArrowDownAZ,
} from 'lucide-react'
import { useSubmittalsList, useItemsViewPaintTelemetry, type SubmittalListRow } from '../../hooks/useSubmittalsList'
import { useColumnState, type ColumnPin } from '../../hooks/useColumnState'
import { useSubmittalSelection } from '../../hooks/useSubmittalSelection'
import { useAuthStore } from '../../stores/authStore'
import { buildColumns, type ColumnDef } from './columns'
import { SubmittalRow } from './SubmittalRow'

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

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 38
const TABLE_ID = 'items'

export interface SubmittalsItemsViewProps {
  projectId: string
  resetToken: string
  numberingFormat: string
  filterFn?: (row: SubmittalListRow) => boolean
  onSelectionChange?: (count: number) => void
  onSelectionIdsChange?: (ids: string[]) => void
  /** Page-driven clear — Phase 3 BulkActionsMenu calls this after a bulk op. */
  selectionClearToken?: number
  onVisibleCountChange?: (count: number) => void
}

const isOverdueDate = (date: string | null | undefined): boolean => {
  if (!date) return false
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

export const SubmittalsItemsView: React.FC<SubmittalsItemsViewProps> = ({
  projectId,
  resetToken,
  numberingFormat,
  filterFn,
  onSelectionChange,
  onSelectionIdsChange,
  selectionClearToken,
  onVisibleCountChange,
}) => {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const { rows, loading, error } = useSubmittalsList(projectId)

  const allColumns = useMemo(() => buildColumns(), [])
  const columnState = useColumnState(userId, projectId, TABLE_ID)
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

  // Visible columns = user-visible minus collapsed-by-responsive (when below
  // 1280px we drop collapsibles, but never below 6 visible columns).
  const visibleColumns = useMemo<ColumnDef[]>(() => {
    const userVisible = allColumns.filter((c) => !columnState.getColumn(c.id).hidden)
    if (containerWidth >= 1280) return userVisible
    const essentials = userVisible.filter((c) => !c.collapsible)
    if (essentials.length >= 6) return essentials
    const collapsibles = userVisible.filter((c) => c.collapsible)
    return [...essentials, ...collapsibles].slice(0, Math.max(6, essentials.length))
  }, [allColumns, columnState, containerWidth])

  const overflowColumns = useMemo<ColumnDef[]>(() => {
    if (containerWidth >= 1280) return []
    const visibleIds = new Set(visibleColumns.map((c) => c.id))
    return allColumns.filter((c) => c.collapsible && !visibleIds.has(c.id) && !columnState.getColumn(c.id).hidden)
  }, [allColumns, columnState, containerWidth, visibleColumns])

  // Pin order: left-pinned first, unpinned center, right-pinned last.
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

  const filteredRows = useMemo<SubmittalListRow[]>(() => {
    if (!filterFn) return rows
    const out: SubmittalListRow[] = []
    for (const r of rows) if (filterFn(r)) out.push(r)
    return out
  }, [rows, filterFn])

  const sortedRows = useMemo<SubmittalListRow[]>(() => {
    let sortColId: string | null = null
    let sortDir: 'asc' | 'desc' | null = null
    for (const c of allColumns) {
      const s = columnState.getColumn(c.id).sort
      if (s) {
        sortColId = c.id
        sortDir = s
        break
      }
    }
    if (!sortColId || !sortDir) return filteredRows
    const dir = sortDir === 'asc' ? 1 : -1
    const valOf = (r: SubmittalListRow): unknown => {
      switch (sortColId) {
        case 'spec_section': return (r.csi_section as string) ?? ''
        case 'number':       return r.number ?? ''
        case 'rev':          return r.rev_number ?? 0
        case 'title':        return (r.title as string) ?? ''
        case 'kind':         return (r.kind as string) ?? ''
        case 'status':       return (r.status as string) ?? ''
        case 'sub':          return (r.sub_name as string) ?? ''
        case 'submit_by':    return (r.submit_by_date as string) ?? ''
        case 'bic':          return (r.current_reviewer_name as string) ?? ''
        case 'days_in_court':return (r.days_in_court as number) ?? -1
        case 'attachments':  return Array.isArray((r as { attachments?: unknown }).attachments)
                              ? ((r as { attachments?: unknown[] }).attachments?.length ?? 0)
                              : 0
        default: return ''
      }
    }
    return [...filteredRows].sort((a, b) => {
      const av = valOf(a)
      const bv = valOf(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [allColumns, columnState, filteredRows])

  useEffect(() => { onSelectionChange?.(selection.size) }, [onSelectionChange, selection.size])
  useEffect(() => {
    if (!onSelectionIdsChange) return
    onSelectionIdsChange(Array.from(selection.selectedIds))
  }, [onSelectionIdsChange, selection.selectedIds])
  const selectionClear = selection.clear
  useEffect(() => {
    if (selectionClearToken === undefined) return
    selectionClear()
  }, [selectionClearToken, selectionClear])
  useEffect(() => { onVisibleCountChange?.(sortedRows.length) }, [onVisibleCountChange, sortedRows.length])

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    getItemKey: (i) => String(sortedRows[i]?.id ?? i),
  })

  const recordPaint = useItemsViewPaintTelemetry({ projectId, rowCount: sortedRows.length })
  useEffect(() => {
    if (loading || sortedRows.length === 0) return
    const t0 = performance.now()
    const id = window.requestAnimationFrame(() => {
      const t1 = performance.now()
      recordPaint({ paintMs: t1 - t0 })
    })
    return () => window.cancelAnimationFrame(id)
  }, [loading, sortedRows.length, recordPaint])

  const onColumnResize = useCallback(
    (columnId: string, startX: number, startWidth: number, ev: React.PointerEvent<HTMLDivElement>) => {
      const col = allColumns.find((c) => c.id === columnId)
      if (!col) return
      const target = ev.currentTarget
      target.setPointerCapture(ev.pointerId)
      const onMove = (e: PointerEvent) => {
        const next = Math.max(col.minWidth, Math.min(col.maxWidth, startWidth + (e.clientX - startX)))
        columnState.setWidth(columnId, next)
      }
      const onUp = () => {
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
  const toggleMenu = (id: string) => setOpenMenuFor((cur) => (cur === id ? null : id))
  useEffect(() => {
    if (!openMenuFor) return
    const onDocClick = () => setOpenMenuFor(null)
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
  }, [openMenuFor])

  const handleOpen = useCallback((id: string) => navigate(`/submittals/${id}`), [navigate])
  const handleEdit = useCallback((id: string) => navigate(`/submittals/${id}?edit=1`), [navigate])

  const visibleIds = useMemo(() => sortedRows.map((r) => String(r.id)), [sortedRows])
  const headerCheckboxState = selection.headerStateFor(visibleIds)

  if (loading) return <ItemsSkeleton />
  if (error) {
    return (
      <div role="alert" style={{ padding: 24, color: C.ink2, fontFamily: FONT }}>
        Couldn't load submittals: {error.message}
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
      {/* Header */}
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
        {/* Header checkbox */}
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
            aria-label={headerCheckboxState === 'all' ? 'Deselect all' : 'Select all'}
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

        {overflowColumns.length > 0 && (
          <div
            style={{
              flex: '0 0 56px',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderLeft: `1px solid ${C.borderSubtle}`,
            }}
            title={`Hidden columns: ${overflowColumns.map((c) => c.header).join(', ')}`}
            aria-label={`${overflowColumns.length} hidden columns`}
          >
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: C.surfaceInset,
                color: C.ink2,
                fontWeight: 600,
              }}
            >
              +{overflowColumns.length}
            </span>
          </div>
        )}

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

      {/* Body — virtualized rows */}
      <div
        ref={scrollerRef}
        role="rowgroup"
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#fff',
          contain: 'strict',
        }}
      >
        {sortedRows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: C.ink3, fontSize: 13 }}>
            No submittals match the current filter.
          </div>
        ) : (
          <div style={{ position: 'relative', height: virtualizer.getTotalSize(), width: '100%' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = sortedRows[vi.index]
              if (!row) return null
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: `translateY(${vi.start}px)`,
                    width: '100%',
                  }}
                >
                  <SubmittalRow
                    row={row}
                    columns={orderedColumns}
                    ctx={ctx}
                    widths={widths}
                    selected={selection.isSelected(String(row.id))}
                    onToggleSelect={selection.toggle}
                    onOpen={handleOpen}
                    onEdit={handleEdit}
                    zebra={vi.index % 2 === 1}
                    index={vi.index}
                  />
                </div>
              )
            })}
          </div>
        )}
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

const ItemsSkeleton: React.FC = () => {
  const rows = Array.from({ length: 14 })
  return (
    <div style={{ padding: 16, fontFamily: FONT }}>
      {rows.map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 110px 110px 56px 1fr 130px 140px 160px 110px 160px 64px 56px 132px',
            gap: 8,
            alignItems: 'center',
            padding: '8px 8px',
            borderBottom: `1px solid ${C.borderSubtle}`,
          }}
        >
          {Array.from({ length: 13 }).map((__, j) => (
            <div
              key={j}
              style={{
                height: 12,
                backgroundColor: C.surfaceInset,
                borderRadius: 3,
                opacity: 0.7 + (j % 3) * 0.1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default SubmittalsItemsView
