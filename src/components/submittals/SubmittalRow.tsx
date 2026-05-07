// Phase 2 — single dense row with always-visible Edit + Open inline buttons.
// Procore parity: actions are visible at all times, not on-hover.
//
// Both action buttons are wrapped in PermissionGate per Sprint Invariant #5.

import React from 'react'
import { Pencil, ExternalLink } from 'lucide-react'
import { PermissionGate } from '../auth/PermissionGate'
import type { ColumnDef, ColumnContext, SubmittalListRow } from './columns'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surfaceHover: '#F0EFEB',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface SubmittalRowProps {
  row: SubmittalListRow
  columns: ColumnDef[]
  ctx: ColumnContext
  widths: Record<string, number>
  selected: boolean
  onToggleSelect: (id: string) => void
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  zebra?: boolean
  index: number
}

const SubmittalRowImpl: React.FC<SubmittalRowProps> = ({
  row,
  columns,
  ctx,
  widths,
  selected,
  onToggleSelect,
  onOpen,
  onEdit,
  zebra,
  index,
}) => {
  const id = String(row.id)
  const totalCellWidth = columns.reduce((sum, c) => sum + (widths[c.id] ?? c.defaultWidth), 0)

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      onDoubleClick={() => onOpen(id)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: 36,
        backgroundColor: selected ? 'rgba(244, 120, 32, 0.06)' : zebra ? C.surfaceInset : '#fff',
        borderBottom: `1px solid ${C.borderSubtle}`,
        fontFamily: FONT,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = selected ? 'rgba(244, 120, 32, 0.10)' : C.surfaceHover }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selected ? 'rgba(244, 120, 32, 0.06)' : zebra ? C.surfaceInset : '#fff' }}
    >
      {/* Checkbox cell — sticky left edge */}
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
          checked={selected}
          onChange={() => onToggleSelect(id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select submittal ${row.title ?? id}`}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* Data cells */}
      <div style={{ display: 'flex', alignItems: 'stretch', flex: '1 1 auto', minWidth: 0, width: totalCellWidth }}>
        {columns.map((col) => {
          const w = widths[col.id] ?? col.defaultWidth
          return (
            <div
              key={col.id}
              role="cell"
              style={{
                flex: `0 0 ${w}px`,
                width: w,
                minWidth: 0,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                textAlign: col.numeric ? 'right' : 'left',
                justifyContent: col.numeric ? 'flex-end' : 'flex-start',
                overflow: 'hidden',
              }}
            >
              {col.cell(row, ctx)}
            </div>
          )
        })}
      </div>

      {/* Action cluster — sticky right edge */}
      <div
        style={{
          flex: '0 0 132px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          padding: '0 10px',
          borderLeft: `1px solid ${C.borderSubtle}`,
        }}
      >
        <PermissionGate permission="submittals.edit">
          <button
            type="button"
            aria-label="Edit submittal"
            title="Edit"
            onClick={(e) => { e.stopPropagation(); onEdit(id) }}
            style={inlineActionButtonStyle}
          >
            <Pencil size={11} />
            Edit
          </button>
        </PermissionGate>
        <PermissionGate permission="submittals.view">
          <button
            type="button"
            aria-label="Open submittal"
            title="Open detail"
            onClick={(e) => { e.stopPropagation(); onOpen(id) }}
            style={{ ...inlineActionButtonStyle, color: C.brandOrange, borderColor: 'rgba(244, 120, 32, 0.30)' }}
          >
            <ExternalLink size={11} />
            Open
          </button>
        </PermissionGate>
      </div>
    </div>
  )
}

const inlineActionButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '3px 8px',
  minHeight: 24,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  backgroundColor: '#fff',
  color: C.ink,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '-0.005em',
}

export const SubmittalRow = React.memo(SubmittalRowImpl, (prev, next) => {
  return (
    prev.row === next.row &&
    prev.selected === next.selected &&
    prev.columns === next.columns &&
    prev.widths === next.widths &&
    prev.zebra === next.zebra
  )
})

export default SubmittalRow
