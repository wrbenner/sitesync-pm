import React, { useState, useCallback } from 'react';
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
import { Skeleton } from '../Primitives';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';

export type { ColumnDef, Row };
export { createColumnHelper } from '@tanstack/react-table';

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
}

const MemoizedRow = React.memo(function MemoizedRow<T>({
  row,
  onClick,
  selected,
  columns,
}: {
  row: Row<T>;
  onClick?: (row: T) => void;
  selected: boolean;
  columns: ColumnDef<T, any>[];
}) {
  const baseBg = selected ? colors.surfaceSelected : colors.surfaceRaised;
  return (
    <tr
      onClick={onClick ? () => onClick(row.original) : undefined}
      style={{
        backgroundColor: baseBg,
        cursor: onClick ? 'pointer' : 'default',
        transition: `background-color ${transitions.quick}`,
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
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
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
    enableRowSelection,
    getRowId,
    initialState: {
      pagination: { pageSize },
    },
  });

  const handleExport = useCallback(() => {
    exportToCsv(table, columns);
  }, [table, columns]);

  if (loading) {
    return (
      <div style={{ padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height="40px" />
        ))}
      </div>
    );
  }

  const rows = table.getRowModel().rows;

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
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
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
            {rows.map((row) => (
              <MemoizedRow
                key={row.id}
                row={row}
                onClick={onRowClick}
                selected={selectedRowId != null && getRowId ? getRowId(row.original) === String(selectedRowId) : false}
                columns={columns}
              />
            ))}
          </tbody>
        </table>
      </div>

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
