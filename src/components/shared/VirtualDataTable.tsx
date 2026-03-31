import React, { useRef, useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Row,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { colors, spacing, typography, transitions } from '../../styles/theme';
import { Skeleton } from '../Primitives';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface VirtualDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  loading?: boolean;
  enableSorting?: boolean;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  rowHeight?: number;
  overscan?: number;
}

const ROW_HEIGHT = 44;

const VirtualRow = React.memo(function VirtualRow<T>({
  row,
  onClick,
  selected,
  style,
}: {
  row: Row<T>;
  onClick?: (row: T) => void;
  selected: boolean;
  style: React.CSSProperties;
}) {
  const baseBg = selected ? colors.surfaceSelected : colors.surfaceRaised;
  return (
    <tr
      onClick={onClick ? () => onClick(row.original) : undefined}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: baseBg,
        cursor: onClick ? 'pointer' : 'default',
        transition: `background-color ${transitions.quick}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        borderLeft: selected ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = selected ? colors.surfaceSelected : colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        if (onClick) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = baseBg;
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${spacing['4']}`,
            fontSize: typography.fontSize.sm,
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: cell.column.getSize(),
            flexShrink: 0,
          }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}) as <T>(props: {
  row: Row<T>;
  onClick?: (row: T) => void;
  selected: boolean;
  style: React.CSSProperties;
}) => React.ReactElement;

export function VirtualDataTable<T>({
  data,
  columns,
  loading = false,
  enableSorting = true,
  onRowClick,
  selectedRowId,
  getRowId,
  emptyMessage = 'No items found',
  rowHeight = ROW_HEIGHT,
  overscan = 10,
}: VirtualDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    getRowId,
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan,
  });

  if (loading) {
    return (
      <div style={{ padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height="40px" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceInset, position: 'sticky', top: 0, zIndex: 10 }}>
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div
              key={header.id}
              onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
              style={{
                padding: `${spacing['2.5']} ${spacing['4']}`,
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                color: colors.textTertiary,
                letterSpacing: typography.letterSpacing.wide,
                cursor: header.column.getCanSort() ? 'pointer' : 'default',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                width: header.column.getSize(),
                flexShrink: 0,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getIsSorted() === 'asc' && <ArrowUp size={12} />}
                {header.column.getIsSorted() === 'desc' && <ArrowDown size={12} />}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        style={{ height: '600px', overflow: 'auto' }}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <VirtualRow
                key={row.id}
                row={row}
                onClick={onRowClick}
                selected={selectedRowId != null && getRowId ? getRowId(row.original) === String(selectedRowId) : false}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {rows.length === 0 && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['12']} ${spacing['6']}`, textAlign: 'center' }}>
          <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>{emptyMessage}</p>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}
