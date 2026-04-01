import React, { useState, useCallback, useRef, useEffect, useMemo, useId } from 'react';
import { VirtualDataTable } from './VirtualDataTable';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type Row,
} from '@tanstack/react-table';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { useUiStore } from '../../stores';
import { TableSkeleton } from '../ui/Skeletons';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, Download, Keyboard } from 'lucide-react';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';

export type { ColumnDef, Row };
export { createColumnHelper } from '@tanstack/react-table';

interface TableProps<T> extends DataTableProps<T> {
  virtualThreshold?: number;
  rowHeight?: number;
  containerHeight?: number;
  overscan?: number;
}

export function Table<T>({
  virtualThreshold = 50,
  rowHeight,
  containerHeight,
  overscan,
  ...rest
}: TableProps<T>) {
  // Always use DataTable when selectable so checkbox/keyboard nav work correctly
  if (!rest.selectable && rest.data.length > virtualThreshold) {
    return (
      <VirtualDataTable
        data={rest.data}
        columns={rest.columns}
        loading={rest.loading}
        enableSorting={rest.enableSorting}
        onRowClick={rest.onRowClick}
        selectedRowId={rest.selectedRowId}
        getRowId={rest.getRowId}
        emptyMessage={rest.emptyMessage}
        rowHeight={rowHeight}
        containerHeight={containerHeight}
        overscan={overscan}
      />
    );
  }
  return <DataTable {...rest} />;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  pageSize?: number;
  enablePagination?: boolean;
  enableSorting?: boolean;
  enableGlobalFilter?: boolean;
  enableRowSelection?: boolean;
  enableExport?: boolean;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  stickyHeader?: boolean;
  /** Adds a checkbox column and exposes selection state via onSelectionChange */
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
}

const MemoizedRow = React.memo(function MemoizedRow<T>({
  row,
  onClick,
  selected,
  columns,
  index,
  focused,
  rowId,
}: {
  row: Row<T>;
  onClick?: (row: T) => void;
  selected: boolean;
  columns: ColumnDef<T, any>[];
  index: number;
  focused: boolean;
  rowId: string;
}) {
  const baseBg = selected ? colors.surfaceSelected : colors.surfaceRaised;
  return (
    <tr
      id={rowId}
      role="row"
      aria-rowindex={index + 1}
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      data-row-index={index}
      className="sitesync-grid-row"
      onClick={onClick ? () => onClick(row.original) : undefined}
      style={{
        backgroundColor: baseBg,
        cursor: onClick ? 'pointer' : 'default',
        transition: `background-color ${transitions.quick}`,
        borderLeft: selected ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
        height: '48px',
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
          role="gridcell"
          style={{
            padding: `${spacing['3']} ${spacing['4']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            fontSize: typography.fontSize.sm,
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
  void columns;
}) as <T>(props: {
  row: Row<T>;
  onClick?: (row: T) => void;
  selected: boolean;
  columns: ColumnDef<T, any>[];
  index: number;
  focused: boolean;
  rowId: string;
}) => React.ReactElement;

function exportToCsv<T>(table: ReturnType<typeof useReactTable<T>>, columns: ColumnDef<T, any>[]) {
  const headers = columns
    .map((c) => {
      const header = c.header;
      return typeof header === 'string' ? header : String(c.id || '');
    })
    .join(',');

  const rows = table.getRowModel().rows.map((row) =>
    row.getVisibleCells().map((cell) => {
      const val = cell.getValue();
      const str = val == null ? '' : String(val);
      return str.includes(',') ? `"${str}"` : str;
    }).join(',')
  );

  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  data,
  columns,
  loading = false,
  pageSize = 20,
  enablePagination = false,
  enableSorting = true,
  enableGlobalFilter = false,
  enableRowSelection = false,
  enableExport = false,
  onRowClick,
  selectedRowId,
  getRowId,
  emptyMessage = 'No items found',
  stickyHeader = true,
  selectable = false,
  onSelectionChange,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Tracks the last index the user clicked a checkbox on, for shift-click range selection.
  const lastCheckedRef = useRef<number | null>(null);

  const checkboxColumn = useMemo<ColumnDef<T, any>>(() => ({
    id: '_select',
    size: 40,
    enableSorting: false,
    header: ({ table: t }) => (
      <input
        type="checkbox"
        checked={t.getIsAllRowsSelected()}
        ref={(el) => { if (el) el.indeterminate = t.getIsSomeRowsSelected(); }}
        onChange={(e) => {
          t.getToggleAllRowsSelectedHandler()(e);
          lastCheckedRef.current = null;
        }}
        style={{ cursor: 'pointer', accentColor: colors.primaryOrange, width: 14, height: 14 }}
        aria-label="Select all rows"
      />
    ),
    cell: ({ row, table: t }) => {
      const index = row.index;
      return (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={() => {/* controlled via onClick */}}
          onClick={(e) => {
            e.stopPropagation();
            if (e.shiftKey && lastCheckedRef.current !== null) {
              // Range select: toggle all rows between lastChecked and current to match current row's new state
              const allRows = t.getRowModel().rows;
              const from = Math.min(lastCheckedRef.current, index);
              const to = Math.max(lastCheckedRef.current, index);
              const targetState = !row.getIsSelected();
              allRows.slice(from, to + 1).forEach((r) => {
                if (r.getCanSelect()) r.toggleSelected(targetState);
              });
            } else {
              row.toggleSelected();
            }
            lastCheckedRef.current = index;
          }}
          style={{ cursor: 'pointer', accentColor: colors.primaryOrange, width: 14, height: 14 }}
          aria-label="Select row"
        />
      );
    },
  // lastCheckedRef is a stable ref object, safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const effectiveColumns = useMemo(
    () => selectable ? [checkboxColumn, ...columns] : columns,
    [selectable, checkboxColumn, columns],
  );

  const table = useReactTable({
    data,
    columns: effectiveColumns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      rowSelection,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableGlobalFilter ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    enableRowSelection: selectable || enableRowSelection,
    getRowId,
    initialState: {
      pagination: { pageSize },
    },
  });

  useEffect(() => {
    if (!onSelectionChange) return;
    const ids = table.getSelectedRowModel().rows.map((r) => r.id);
    onSelectionChange(ids);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  const announceStatus = useUiStore((s) => s.announceStatus);
  const filteredRowCount = table.getFilteredRowModel().rows.length;

  useEffect(() => {
    if (sorting.length === 0) return;
    const col = sorting[0];
    const colDef = effectiveColumns.find((c) => c.id === col.id || (c as any).accessorKey === col.id);
    const colName = colDef
      ? typeof colDef.header === 'string'
        ? colDef.header
        : col.id
      : col.id;
    const direction = col.desc ? 'descending' : 'ascending';
    announceStatus(`Table sorted by ${colName} ${direction}. ${filteredRowCount} results shown.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting]);

  useEffect(() => {
    if (!enableGlobalFilter || globalFilter === '') return;
    announceStatus(`${filteredRowCount} results shown.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilter, filteredRowCount]);

  const handleExport = useCallback(() => {
    exportToCsv(table, effectiveColumns);
  }, [table, effectiveColumns]);

  const rows = table.getRowModel().rows;

  const tableId = useId();
  const gridRef = useRef<HTMLDivElement>(null);

  const { focusedIndex, handleKeyDown, activeRowId } = useTableKeyboardNavigation({
    rowCount: rows.length,
    onActivate: (i) => onRowClick?.(rows[i].original),
    onToggleSelect: selectable ? (i) => rows[i]?.toggleSelected() : undefined,
    rowIdPrefix: tableId,
  });

  useEffect(() => {
    if (gridRef.current?.contains(document.activeElement)) {
      const row = gridRef.current.querySelector<HTMLElement>(`[data-row-index="${focusedIndex}"]`);
      row?.focus({ preventScroll: false });
    }
  }, [focusedIndex]);

  return (
    <div>
      {/* Toolbar */}
      {(enableGlobalFilter || enableExport) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          {enableGlobalFilter && (
            <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search..."
                style={{
                  width: '100%',
                  padding: `${spacing['2']} ${spacing['3']} ${spacing['2']} 32px`,
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  color: colors.textPrimary,
                  backgroundColor: colors.surfaceRaised,
                  outline: 'none',
                }}
              />
            </div>
          )}
          <div style={{ flex: 1 }} />
          {enableExport && (
            <button
              onClick={handleExport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.sm,
                backgroundColor: 'transparent',
                fontSize: typography.fontSize.caption,
                fontFamily: typography.fontFamily,
                color: colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <Download size={12} /> CSV
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div
        ref={gridRef}
        tabIndex={0}
        className="sitesync-grid"
        onKeyDown={handleKeyDown}
        aria-activedescendant={activeRowId}
        onFocus={(e) => {
          if (e.target === e.currentTarget) {
            const firstRow = e.currentTarget.querySelector<HTMLElement>('[data-row-index="0"]');
            firstRow?.focus();
          }
        }}
        style={{ overflowX: 'auto' }}
      >
        <table
          role="grid"
          aria-rowcount={data.length}
          aria-colcount={effectiveColumns.length}
          style={{ width: '100%', borderCollapse: 'collapse' }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} role="row">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    role="columnheader"
                    scope="col"
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
                      borderBottom: `1px solid ${colors.borderDefault}`,
                      textAlign: 'left',
                      fontSize: typography.fontSize.label,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textTertiary,
                      letterSpacing: typography.letterSpacing.wide,
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      backgroundColor: colors.surfaceInset,
                      position: stickyHeader ? 'sticky' : undefined,
                      top: stickyHeader ? 0 : undefined,
                      zIndex: stickyHeader ? 10 : undefined,
                      width: header.column.columnDef.size ? `${header.column.columnDef.size}px` : undefined,
                      minWidth: header.column.columnDef.minSize ? `${header.column.columnDef.minSize}px` : undefined,
                      maxWidth: header.column.columnDef.maxSize ? `${header.column.columnDef.maxSize}px` : undefined,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <ArrowUp size={12} />}
                      {header.column.getIsSorted() === 'desc' && <ArrowDown size={12} />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={effectiveColumns.length} style={{ padding: 0, border: 'none' }}>
                  <TableSkeleton columns={effectiveColumns.length} rows={8} />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <MemoizedRow
                  key={row.id}
                  row={row}
                  onClick={onRowClick}
                  selected={selectedRowId != null && getRowId ? getRowId(row.original) === String(selectedRowId) : false}
                  columns={effectiveColumns}
                  index={index}
                  focused={focusedIndex === index}
                  rowId={`${tableId}-row-${index}`}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Keyboard shortcut hint */}
      {rows.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: `${spacing['2']} ${spacing['4']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceInset,
        }}>
          <Keyboard size={11} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            J/K to navigate{selectable ? ', Space to select' : ''}, Enter to open
          </span>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['12']} ${spacing['6']}`, textAlign: 'center' }}>
          <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>{emptyMessage}</p>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Pagination */}
      {enablePagination && rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['3']} ${spacing['4']}`, borderTop: `1px solid ${colors.borderSubtle}` }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {table.getState().pagination.pageIndex * pageSize + 1} to{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, table.getFilteredRowModel().rows.length)} of{' '}
            {table.getFilteredRowModel().rows.length}
          </span>
          <div style={{ display: 'flex', gap: spacing['1'] }}>
            <button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              style={{
                display: 'flex', alignItems: 'center',
                padding: `${spacing['1']} ${spacing['2']}`,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.sm,
                backgroundColor: 'transparent',
                cursor: table.getCanPreviousPage() ? 'pointer' : 'default',
                color: table.getCanPreviousPage() ? colors.textPrimary : colors.textTertiary,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
              }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              style={{
                display: 'flex', alignItems: 'center',
                padding: `${spacing['1']} ${spacing['2']}`,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.sm,
                backgroundColor: 'transparent',
                cursor: table.getCanNextPage() ? 'pointer' : 'default',
                color: table.getCanNextPage() ? colors.textPrimary : colors.textTertiary,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
