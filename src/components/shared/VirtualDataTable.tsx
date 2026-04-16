import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
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
import { useUiStore } from '../../stores';
import { TableSkeleton } from '../ui/Skeletons';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';

interface VirtualDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  loading?: boolean;
  enableSorting?: boolean;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  getRowId?: (row: T) => string;
  getRowAriaLabel?: (row: T) => string;
  getRowStyle?: (row: T) => React.CSSProperties;
  emptyMessage?: string;
  rowHeight?: number;
  containerHeight?: number;
  overscan?: number;
  selectedRows?: Set<string>;
  onSelectionChange?: (rows: Set<string>) => void;
  onRowToggleSelectByIndex?: (index: number) => void;
  'aria-label'?: string;
}

const ROW_HEIGHT = 56;

const VirtualRow = React.memo(function VirtualRow<T>({
  row,
  onClick,
  selected,
  style,
  index,

  ariaLabel,
  extraStyle,
}: {
  row: Row<T>;
  onClick?: (row: T) => void;
  selected: boolean;
  style: React.CSSProperties;
  index: number;
  focused: boolean;
  ariaLabel?: string;
  extraStyle?: React.CSSProperties;
}) {
  const baseBg = selected ? colors.surfaceSelected : colors.surfaceRaised;
  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      aria-selected={selected}
      aria-label={ariaLabel}
      tabIndex={0}
      data-row-index={index}
      className="sitesync-grid-row"
      onClick={onClick ? () => onClick(row.original) : undefined}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(row.original); } }}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: baseBg,
        cursor: onClick ? 'pointer' : 'default',
        transition: `background-color ${transitions.quick}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        borderLeft: selected ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
        ...extraStyle,
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = selected ? colors.surfaceSelected : colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = baseBg;
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <div
          key={cell.id}
          role="cell"
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
        </div>
      ))}
    </div>
  );
}) as <T>(props: {
  row: Row<T>;
  onClick?: (row: T) => void;
  selected: boolean;
  style: React.CSSProperties;
  index: number;
  focused: boolean;
  ariaLabel?: string;
  extraStyle?: React.CSSProperties;
}) => React.ReactElement;

export function VirtualDataTable<T>({
  data,
  columns,
  loading = false,
  enableSorting = true,
  onRowClick,
  selectedRowId,
  getRowId,
  getRowAriaLabel,
  getRowStyle,
  emptyMessage = 'No items found',
  rowHeight = ROW_HEIGHT,
  containerHeight = 600,
  overscan = 10,
  onRowToggleSelectByIndex,
  'aria-label': ariaLabel,
}: VirtualDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
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

  const { focusedIndex, handleKeyDown } = useTableKeyboardNavigation({
    rowCount: rows.length,
    onActivate: (i) => onRowClick?.(rows[i].original),
    onToggleSelect: onRowToggleSelectByIndex,
  });

  const announceStatus = useUiStore((s) => s.announceStatus);

  const columnHeaders = useMemo(
    () => Object.fromEntries(columns.map((c) => [
      (c as unknown as { accessorKey?: string }).accessorKey ?? c.id ?? '',
      typeof c.header === 'string' ? c.header : (c.id ?? ''),
    ])),
    [columns],
  );

  useEffect(() => {
    if (sorting.length === 0) return;
    const col = sorting[0];
    const colName = columnHeaders[col.id] ?? col.id;
    const direction = col.desc ? 'descending' : 'ascending';
    announceStatus(`Table sorted by ${colName} ${direction}. ${rows.length} results shown.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting]);

  useEffect(() => {
    virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    if (gridRef.current?.contains(document.activeElement)) {
      requestAnimationFrame(() => {
        const row = gridRef.current?.querySelector<HTMLElement>(`[data-row-index="${focusedIndex}"]`);
        row?.focus({ preventScroll: false });
      });
    }
  }, [focusedIndex]);

  return (
    <div
      ref={gridRef}
      role="table"
      aria-label={ariaLabel}
      aria-rowcount={data.length}
      aria-colcount={columns.length}
      tabIndex={0}
      className="sitesync-grid"
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        if (e.target === e.currentTarget) {
          const firstRow = e.currentTarget.querySelector<HTMLElement>('[data-row-index="0"]');
          firstRow?.focus();
        }
      }}
    >
      <style>{`.sitesync-grid-row:focus-visible { outline: 2px solid #F47820; outline-offset: -2px; }`}</style>
      {/* Header */}
      <div
        role="rowgroup"
        style={{ display: 'flex', borderBottom: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceInset, position: 'sticky', top: 0, zIndex: 10 }}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <div key={headerGroup.id} role="row" style={{ display: 'flex', width: '100%' }}>
            {headerGroup.headers.map((header) => (
              <div
                key={header.id}
                role="columnheader"
                aria-sort={
                  header.column.getCanSort()
                    ? header.column.getIsSorted() === 'asc'
                      ? 'ascending'
                      : header.column.getIsSorted() === 'desc'
                      ? 'descending'
                      : 'none'
                    : undefined
                }
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
            ))}
          </div>
        ))}
      </div>

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        role="rowgroup"
        style={{ height: `${containerHeight}px`, overflow: 'auto' }}
      >
        {loading ? (
          <TableSkeleton columns={columns.length} rows={10} />
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <VirtualRow
                  key={row.id}
                  row={row}
                  onClick={onRowClick}
                  selected={selectedRowId != null && getRowId ? getRowId(row.original) === String(selectedRowId) : false}
                  index={virtualRow.index}
                  focused={focusedIndex === virtualRow.index}
                  ariaLabel={getRowAriaLabel ? getRowAriaLabel(row.original) : undefined}
                  extraStyle={getRowStyle ? getRowStyle(row.original) : undefined}
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
        )}
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
