import React from 'react';
import { borderRadius, spacing, shadows } from '../../styles/theme';

// ── Shared pulse style ─────────────────────────────────────────────────────

const pulseStyle: React.CSSProperties = {
  backgroundColor: '#E5E7EB',
  animation: 'pulse 1.5s ease-in-out infinite',
  borderRadius: borderRadius.base,
  opacity: 0.6,
};

// ── MetricCardSkeleton ─────────────────────────────────────────────────────
// 5 side-by-side cards matching Dashboard MetricCard shape (120px tall).

export const MetricCardSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div
    aria-hidden="true"
    data-skeleton="true"
    style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['5'], flexWrap: 'wrap' }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        style={{
          flex: '1 1 0',
          minWidth: 160,
          height: 120,
          backgroundColor: '#FFFFFF',
          borderRadius: borderRadius.lg,
          boxShadow: shadows.card,
          border: '1px solid #F0EDE9',
          padding: spacing['5'],
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Icon row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...pulseStyle, width: 20, height: 20, borderRadius: borderRadius.sm }} />
          <div style={{ ...pulseStyle, width: 14, height: 14, borderRadius: borderRadius.sm }} />
        </div>
        {/* Value */}
        <div style={{ ...pulseStyle, width: '65%', height: 28, borderRadius: borderRadius.sm }} />
        {/* Label */}
        <div style={{ ...pulseStyle, width: '80%', height: 12, borderRadius: borderRadius.sm }} />
      </div>
    ))}
  </div>
);

// ── TableRowSkeleton ───────────────────────────────────────────────────────
// Single row at 48px with column-count-matched placeholders.

const CELL_WIDTHS = ['60%', '40%', '80%'];

export const TableRowSkeleton: React.FC<{ columns: number }> = ({ columns }) => (
  <div
    aria-hidden="true"
    data-skeleton="true"
    style={{
      height: 48,
      display: 'flex',
      alignItems: 'center',
      gap: spacing['4'],
      padding: `0 ${spacing['4']}`,
      borderBottom: '1px solid #F0EDE9',
    }}
  >
    {Array.from({ length: columns }).map((_, i) => (
      <div
        key={i}
        style={{ ...pulseStyle, width: CELL_WIDTHS[i % 3], height: 16, flexShrink: 0 }}
      />
    ))}
  </div>
);

// ── TableSkeleton ──────────────────────────────────────────────────────────
// Renders rows x TableRowSkeleton with matching column count.

export const TableSkeleton: React.FC<{ columns: number; rows?: number }> = ({ columns, rows = 8 }) => (
  <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column' }}>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRowSkeleton key={i} columns={columns} />
    ))}
  </div>
);

// ── GanttSkeleton ──────────────────────────────────────────────────────────
// 3 stacked horizontal bars of varying widths.

export const GanttSkeleton: React.FC = () => (
  <div
    aria-hidden="true"
    data-skeleton="true"
    style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'], padding: spacing['4'] }}
  >
    <div style={{ ...pulseStyle, width: '85%', height: 28, borderRadius: borderRadius.md }} />
    <div style={{ ...pulseStyle, width: '60%', height: 28, borderRadius: borderRadius.md }} />
    <div style={{ ...pulseStyle, width: '75%', height: 28, borderRadius: borderRadius.md }} />
  </div>
);

// ── ChatMessageSkeleton ────────────────────────────────────────────────────
// Avatar circle + 2 text lines.

export const ChatMessageSkeleton: React.FC = () => (
  <div
    aria-hidden="true"
    data-skeleton="true"
    style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-start', padding: `${spacing['3']} 0` }}
  >
    <div style={{ ...pulseStyle, width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      <div style={{ ...pulseStyle, width: '70%', height: 14 }} />
      <div style={{ ...pulseStyle, width: '45%', height: 14 }} />
    </div>
  </div>
);
