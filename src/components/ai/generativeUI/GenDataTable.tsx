import React, { useState, useMemo, useCallback } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme'
import { StatusTag, PriorityTag, Btn } from '../../Primitives'
import { PermissionGate } from '../../auth/PermissionGate'
import type { DataTableBlock, DataTableColumn } from './types'
import type { Permission } from '../../../hooks/usePermissions'

interface Props {
  block: DataTableBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

export const GenDataTable: React.FC<Props> = React.memo(({ block, onAction }) => {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const sortedRows = useMemo(() => {
    if (!sortKey) return block.rows
    return [...block.rows].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [block.rows, sortKey, sortDir])

  const toggleRow = useCallback((idx: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const renderCell = useCallback((col: DataTableColumn, value: unknown) => {
    const str = String(value ?? '')
    switch (col.type) {
      case 'status':
        return <StatusTag status={str as 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval'} />
      case 'priority':
        return <PriorityTag priority={str as 'low' | 'medium' | 'high' | 'critical'} />
      case 'date':
        if (!str) return '\u2014'
        return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'currency':
        return `$${Number(value || 0).toLocaleString()}`
      case 'number':
        return Number(value || 0).toLocaleString()
      default:
        return str || '\u2014'
    }
  }, [])

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      overflow: 'hidden',
      fontFamily: typography.fontFamily,
    }}>
      {block.title && (
        <div style={{
          padding: `${spacing['3']} ${spacing['4']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
        }}>
          {block.title}
          {block.total_count != null && (
            <span style={{ color: colors.textTertiary, fontWeight: typography.fontWeight.normal, marginLeft: spacing['2'] }}>
              ({block.total_count} total)
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: block.columns.map(c => c.width || '1fr').join(' '),
        padding: `${spacing['2']} ${spacing['4']}`,
        backgroundColor: colors.surfaceInset,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        {block.columns.map((col) => (
          <button
            key={col.key}
            onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
            style={{
              all: 'unset',
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
              cursor: col.sortable !== false ? 'pointer' : 'default',
            }}
          >
            {col.label}
            {sortKey === col.key ? (
              sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
            ) : col.sortable !== false ? (
              <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
            ) : null}
          </button>
        ))}
      </div>

      {/* Rows */}
      {sortedRows.map((row, idx) => (
        <div
          key={idx}
          onClick={() => toggleRow(idx)}
          style={{
            display: 'grid',
            gridTemplateColumns: block.columns.map(c => c.width || '1fr').join(' '),
            padding: `${spacing['2']} ${spacing['4']}`,
            borderBottom: idx < sortedRows.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            backgroundColor: selectedRows.has(idx) ? colors.surfaceSelected : 'transparent',
            cursor: 'pointer',
            transition: `background-color ${transitions.instant}`,
            alignItems: 'center',
          }}
          onMouseEnter={(e) => { if (!selectedRows.has(idx)) e.currentTarget.style.backgroundColor = colors.surfaceHover }}
          onMouseLeave={(e) => { if (!selectedRows.has(idx)) e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          {block.columns.map((col) => (
            <div key={col.key} style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
              {renderCell(col, row[col.key])}
            </div>
          ))}
        </div>
      ))}

      {sortedRows.length === 0 && (
        <div style={{ padding: spacing['6'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
          No data available
        </div>
      )}

      {/* Actions */}
      {block.actions && block.actions.length > 0 && selectedRows.size > 0 && (
        <div style={{
          padding: `${spacing['2']} ${spacing['4']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          backgroundColor: colors.surfaceInset,
        }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {selectedRows.size} selected
          </span>
          {block.actions.map((action) => {
            const btn = (
              <Btn
                key={action.label}
                variant={action.variant === 'danger' ? 'danger' : action.variant === 'primary' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  const selectedData = Array.from(selectedRows).map(i => sortedRows[i])
                  onAction?.(action.action, { items: selectedData })
                }}
              >
                {action.label}
              </Btn>
            )
            if (action.requiresPermission) {
              return (
                <PermissionGate key={action.label} permission={action.requiresPermission as Permission}>
                  {btn}
                </PermissionGate>
              )
            }
            return btn
          })}
        </div>
      )}
    </div>
  )
})
