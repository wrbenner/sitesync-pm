import React from 'react';
import { Camera, LayoutGrid, Map as MapIcon, X, Tag, Trash2, Download, Link2 } from 'lucide-react';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { CONSTRUCTION_TAGS } from './types';

// ── Filter bar ───────────────────────────────────────────────

export type DateRange = 'all' | 'today' | 'week' | 'month';

interface FilterBarProps {
  filterTag: string;
  setFilterTag: (v: string) => void;
  filterDateRange: DateRange;
  setFilterDateRange: (v: DateRange) => void;
  filterEntityType: string;
  setFilterEntityType: (v: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filterTag, setFilterTag, filterDateRange, setFilterDateRange, filterEntityType, setFilterEntityType,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing['2'],
      marginBottom: spacing['4'],
      flexWrap: 'wrap',
    }}
  >
    <select
      value={filterTag}
      onChange={e => setFilterTag(e.target.value)}
      aria-label="Filter by tag"
      style={{
        padding: `${spacing['3']} ${spacing['3']}`,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: borderRadius.lg,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily,
        color: filterTag ? colors.textPrimary : colors.textTertiary,
        backgroundColor: filterTag ? colors.orangeSubtle : colors.white,
        cursor: 'pointer',
        outline: 'none',
        minHeight: '56px',
      }}
    >
      <option value="">All tags</option>
      {CONSTRUCTION_TAGS.map(t => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
    <select
      value={filterDateRange}
      onChange={e => setFilterDateRange(e.target.value as DateRange)}
      aria-label="Filter by date range"
      style={{
        padding: `${spacing['3']} ${spacing['3']}`,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: borderRadius.lg,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily,
        color: filterDateRange !== 'all' ? colors.textPrimary : colors.textTertiary,
        backgroundColor: filterDateRange !== 'all' ? colors.orangeSubtle : colors.white,
        cursor: 'pointer',
        outline: 'none',
        minHeight: '56px',
      }}
    >
      <option value="all">All dates</option>
      <option value="today">Today</option>
      <option value="week">This week</option>
      <option value="month">This month</option>
    </select>
    <select
      value={filterEntityType}
      onChange={e => setFilterEntityType(e.target.value)}
      aria-label="Filter by linked entity type"
      style={{
        padding: `${spacing['3']} ${spacing['3']}`,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: borderRadius.lg,
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily,
        color: filterEntityType ? colors.textPrimary : colors.textTertiary,
        backgroundColor: filterEntityType ? colors.orangeSubtle : colors.white,
        cursor: 'pointer',
        outline: 'none',
        minHeight: '56px',
      }}
    >
      <option value="">All linked types</option>
      <option value="drawing">Drawing</option>
      <option value="rfi">RFI</option>
    </select>
    {(filterTag || filterDateRange !== 'all' || filterEntityType) && (
      <button
        aria-label="Clear all filters"
        onClick={() => { setFilterTag(''); setFilterDateRange('all'); setFilterEntityType(''); }}
        style={{
          padding: `${spacing['3']} ${spacing['3']}`,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          color: colors.textSecondary,
          backgroundColor: colors.white,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: spacing['1'],
          minHeight: '56px',
        }}
      >
        <X size={12} />
        Clear
      </button>
    )}
  </div>
);

// ── View toggle + select-all row ────────────────────────────

interface ViewToggleRowProps {
  filteredCount: number;
  totalCount: number;
  isBulkMode: boolean;
  onToggleSelectAll: () => void;
  viewMode: 'grid' | 'map';
  setViewMode: (mode: 'grid' | 'map') => void;
}

export const ViewToggleRow: React.FC<ViewToggleRowProps> = ({
  filteredCount, totalCount, isBulkMode, onToggleSelectAll, viewMode, setViewMode,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing['4'],
      flexWrap: 'wrap',
      gap: spacing['2'],
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
        {filteredCount} photo{filteredCount !== 1 ? 's' : ''}
        {filteredCount !== totalCount && ` of ${totalCount}`}
      </span>
      {filteredCount > 0 && (
        <button
          onClick={onToggleSelectAll}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: typography.fontSize.sm, color: colors.primaryOrange,
            fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
            padding: 0, minHeight: '56px',
          }}
        >
          {isBulkMode ? 'Deselect all' : 'Select all'}
        </button>
      )}
    </div>
    <div
      style={{
        display: 'flex',
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        padding: '3px',
        gap: '2px',
      }}
    >
      {([
        { mode: 'grid' as const, icon: <LayoutGrid size={15} />, label: 'Grid view' },
        { mode: 'map' as const, icon: <MapIcon size={15} />, label: 'Map view' },
      ]).map(({ mode, icon, label }) => (
        <button
          key={mode}
          aria-label={label}
          aria-pressed={viewMode === mode}
          onClick={() => setViewMode(mode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
            padding: `${spacing['3']} ${spacing['4']}`,
            minHeight: '56px',
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            backgroundColor: viewMode === mode ? colors.white : 'transparent',
            color: viewMode === mode ? colors.textPrimary : colors.textTertiary,
            fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            boxShadow: viewMode === mode ? shadows.card : 'none',
            transition: `all ${transitions.quick}`,
          }}
        >
          {icon}
          <span style={{ textTransform: 'capitalize' }}>{mode}</span>
        </button>
      ))}
    </div>
  </div>
);

// ── Metric cards ─────────────────────────────────────────────

interface MetricsRowProps {
  totalCaptures: number;
  thisWeek: number;
  pendingCount: number;
  untaggedCount: number;
}

export const MetricsRow: React.FC<MetricsRowProps> = ({ totalCaptures, thisWeek, pendingCount, untaggedCount }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: spacing['3'],
      marginBottom: spacing['6'],
    }}
  >
    {[
      {
        label: 'Total Captures',
        value: totalCaptures,
        icon: <Camera size={18} color={colors.statusInfo} />,
        color: colors.statusInfo,
      },
      {
        label: 'This Week',
        value: thisWeek,
        icon: <Camera size={18} color={colors.primaryOrange} />,
        color: colors.primaryOrange,
      },
      {
        label: 'Pending Sync',
        value: pendingCount,
        icon: <Tag size={18} color={pendingCount > 0 ? colors.statusPending : colors.textTertiary} />,
        color: pendingCount > 0 ? colors.statusPending : colors.textTertiary,
      },
      {
        label: 'Untagged',
        value: untaggedCount,
        icon: <Tag size={18} color={untaggedCount > 0 ? colors.statusPending : colors.textTertiary} />,
        color: untaggedCount > 0 ? colors.statusPending : colors.textTertiary,
      },
    ].map(({ label, value, icon, color }) => (
      <div
        key={label}
        style={{
          backgroundColor: colors.white,
          borderRadius: borderRadius.xl,
          padding: spacing['5'],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['2'],
          boxShadow: shadows.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {icon}
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>
            {label}
          </span>
        </div>
        <span style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color }}>
          {value}
        </span>
      </div>
    ))}
  </div>
);

// ── Bulk action bar ──────────────────────────────────────────

interface BulkActionBarProps {
  selectedCount: number;
  onLink: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({ selectedCount, onLink, onExport, onDelete, onClear }) => (
  <div
    role="toolbar"
    aria-label="Bulk actions"
    style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: zIndex.fixed as number,
      backgroundColor: colors.surfaceSidebar,
      borderTop: `1px solid rgba(255,255,255,0.1)`,
      padding: `${spacing['3']} ${spacing['5']}`,
      display: 'flex',
      alignItems: 'center',
      gap: spacing['3'],
      flexWrap: 'wrap',
    }}
  >
    <span style={{ fontSize: typography.fontSize.sm, color: colors.textOnDark, fontWeight: typography.fontWeight.semibold, marginRight: spacing['2'] }}>
      {selectedCount} selected
    </span>
    <button
      onClick={onLink}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing['1.5'],
        padding: `${spacing['2']} ${spacing['4']}`, minHeight: '56px',
        backgroundColor: 'rgba(255,255,255,0.08)', color: colors.textOnDark,
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: borderRadius.lg,
        cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
        fontWeight: typography.fontWeight.medium,
      }}
    >
      <Link2 size={15} /> Link to item
    </button>
    <button
      onClick={onExport}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing['1.5'],
        padding: `${spacing['2']} ${spacing['4']}`, minHeight: '56px',
        backgroundColor: 'rgba(255,255,255,0.08)', color: colors.textOnDark,
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: borderRadius.lg,
        cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
        fontWeight: typography.fontWeight.medium,
      }}
    >
      <Download size={15} /> Export
    </button>
    <PermissionGate permission="field_capture.create">
      <button
        onClick={onDelete}
        style={{
          display: 'flex', alignItems: 'center', gap: spacing['1.5'],
          padding: `${spacing['2']} ${spacing['4']}`, minHeight: '56px',
          backgroundColor: `${colors.statusCritical}22`, color: colors.statusCritical,
          border: `1px solid ${colors.statusCritical}44`, borderRadius: borderRadius.lg,
          cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
          fontWeight: typography.fontWeight.medium,
        }}
      >
        <Trash2 size={15} /> Delete
      </button>
    </PermissionGate>
    <button
      onClick={onClear}
      style={{
        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
        color: colors.textOnDarkMuted, display: 'flex', alignItems: 'center',
        minHeight: '56px', minWidth: '56px', justifyContent: 'center',
      }}
      aria-label="Close bulk selection"
    >
      <X size={18} />
    </button>
  </div>
);
