import React, { useCallback } from 'react';
import {
  Upload, FileText, AlertCircle,
  ChevronDown, ChevronUp, Eye,
} from 'lucide-react';
import { Btn } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { DISCIPLINE_COLORS, STATUS_CONFIG } from './constants';
import type { DrawingRevision } from '../../types/api';
import { formatRevDate } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DrawingItem {
  id: string;
  title: string;
  setNumber: string;
  discipline: string;
  disciplineColor?: string;
  revision: string;
  date: string;
  status?: string;
  sheetCount?: number;
  file_url?: string;
  thumbnail_url?: string | null;
  processing_status?: string;
  source_filename?: string;
  total_pages?: number;
  tile_status?: 'pending' | 'processing' | 'ready' | 'failed';
  tile_levels?: number;
  tile_format?: string;
  currentRevision?: { revision_number: number; issued_date: string | null; issued_by?: string };
  revisions: DrawingRevision[];
  /** Markup count for this sheet — wired by the page when annotation
   *  counts are available; defaults to 0 in the UI. */
  markupCount?: number;
  /** Linked RFI count — populated by `getDrawings` once the FK migration
   *  lands; the UI shows the badge whenever the value is > 0. */
  linkedRfiCount?: number;
  /** Server-side last-modified timestamp for the drawing row. */
  updated_at?: string | null;
}

interface DrawingListProps {
  drawings: DrawingItem[];
  loading: boolean;
  error: unknown;
  refetch: () => void;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  // Selection
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  // Interaction
  focusedId: string | null;
  onSelectDrawing: (d: DrawingItem) => void;
  onViewDrawing: (d: DrawingItem) => void;
  onUploadClick: () => void;
  // Search highlighting
  searchQuery: string;
}

// Constants imported from ./constants

// ─── Helpers ────────────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: `${colors.primaryOrange}30`, color: 'inherit', padding: '0 1px', borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Table Header ───────────────────────────────────────────────────────────

const COLUMNS = [
  { field: 'setNumber', label: 'Sheet #', width: '90px' },
  { field: 'title', label: 'Title', width: '1fr' },
  { field: 'discipline', label: 'Discipline', width: '120px' },
  { field: 'revision', label: 'Rev', width: '50px' },
  { field: 'date', label: 'Issued', width: '90px' },
  { field: 'status', label: 'Status', width: '100px' },
  { field: '', label: '', width: '48px' }, // actions
] as const;

const GRID_TEMPLATE = `32px ${COLUMNS.map((c) => c.width).join(' ')}`;

const SortHeader: React.FC<{
  field: string;
  label: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
}> = ({ field, label, sortField, sortDir, onSort }) => {
  const isActive = sortField === field;
  return (
    <button
      onClick={() => field && onSort(field)}
      disabled={!field}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        border: 'none', backgroundColor: 'transparent', cursor: field ? 'pointer' : 'default',
        fontSize: '11px', fontWeight: 600,
        color: isActive ? colors.textPrimary : colors.textTertiary,
        fontFamily: typography.fontFamily, padding: '4px 0',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        transition: 'color 150ms ease',
      }}
    >
      {label}
      {isActive && (
        sortDir === 'asc' ? <ChevronUp size={11} strokeWidth={2.5} /> : <ChevronDown size={11} strokeWidth={2.5} />
      )}
    </button>
  );
};

/** Format a date string into human-readable form */
function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return raw; }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const DrawingList: React.FC<DrawingListProps> = ({
  drawings,
  loading,
  error,
  refetch,
  sortField,
  sortDir,
  onSort,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  focusedId,
  onSelectDrawing,
  onViewDrawing,
  onUploadClick,
  searchQuery,
}) => {
  const allSelected = drawings.length > 0 && drawings.every((d) => selectedIds.has(d.id));
  const someSelected = !allSelected && drawings.some((d) => selectedIds.has(d.id));

  const handleCheckboxClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onToggleSelect(id);
  }, [onToggleSelect]);

  // ── Loading skeleton ────────────────────────────────────
  if (loading) {
    return (
      <div style={{ borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden', backgroundColor: colors.surfaceRaised }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const shimmer = {
            background: `linear-gradient(90deg, ${colors.surfaceInset} 25%, ${colors.surfaceHover} 50%, ${colors.surfaceInset} 75%)`,
            backgroundSize: '800px 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.06}s`,
          };
          return (
            <div
              key={i}
              style={{
                display: 'grid', gridTemplateColumns: GRID_TEMPLATE,
                padding: '8px 16px', alignItems: 'center',
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: 3, ...shimmer }} />
              <div style={{ height: 10, borderRadius: 4, width: '55%', ...shimmer }} />
              <div style={{ height: 10, borderRadius: 4, width: '75%', ...shimmer }} />
              <div style={{ height: 10, borderRadius: 4, width: '50%', ...shimmer }} />
              <div style={{ height: 10, borderRadius: 4, width: '30%', ...shimmer }} />
              <div style={{ height: 10, borderRadius: 4, width: '65%', ...shimmer }} />
              <div style={{ height: 10, borderRadius: 4, width: '55%', ...shimmer }} />
              <div />
            </div>
          );
        })}
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────
  if (error) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: spacing['5'], backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg,
        }}
      >
        <AlertCircle size={20} color={colors.statusCritical} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textPrimary }}>
            Unable to load drawings
          </p>
          <p style={{ margin: 0, marginTop: 2, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
            Check your connection and try again.
          </p>
        </div>
        <Btn variant="secondary" size="sm" onClick={() => refetch()}>Retry</Btn>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────
  if (drawings.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: `${spacing['16']} ${spacing['6']}`,
        textAlign: 'center', backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: `${colors.primaryOrange}10`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: spacing['5'],
        }}>
          <FileText size={28} color={colors.primaryOrange} />
        </div>
        <h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing['2'] }}>
          {searchQuery ? 'No drawings match your search' : 'No drawings uploaded yet'}
        </h3>
        <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, maxWidth: 380, marginBottom: spacing['6'] }}>
          {searchQuery
            ? 'Try adjusting your search terms or clearing filters.'
            : 'Upload construction drawings to enable digital markup, revision tracking, AI classification, and cross-discipline coordination analysis.'}
        </p>
        {!searchQuery && (
          <Btn variant="primary" size="md" icon={<Upload size={16} />} onClick={onUploadClick}>
            Upload Drawings
          </Btn>
        )}
      </div>
    );
  }

  // ── Table view ──────────────────────────────────────────
  return (
    <div style={{
      borderRadius: '14px', border: `1px solid ${colors.borderSubtle}`,
      overflow: 'hidden', backgroundColor: colors.surfaceRaised,
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
    }}>
      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: GRID_TEMPLATE,
        padding: '8px 16px',
        borderBottom: `1px solid ${colors.borderDefault}`,
        backgroundColor: colors.surfaceInset,
        position: 'sticky', top: 0, zIndex: 5,
      }}>
        {/* Select all checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={onSelectAll}
            aria-label="Select all drawings"
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: colors.primaryOrange }}
          />
        </div>
        {COLUMNS.map((col) => (
          <SortHeader
            key={col.label || 'actions'}
            field={col.field}
            label={col.label}
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSort}
          />
        ))}
      </div>

      {/* Table body */}
      <div role="list" aria-label="Project drawings">
        {drawings.map((drawing, index) => {
          const isSelected = selectedIds.has(drawing.id);
          const isFocused = focusedId === drawing.id;
          const discColor = DISCIPLINE_COLORS[drawing.discipline] || DISCIPLINE_COLORS.unclassified;
          const statusKey = drawing.status || 'current';
          const badge = STATUS_CONFIG[statusKey] || STATUS_CONFIG.current;
          const rev = drawing.currentRevision?.revision_number ?? drawing.revision ?? '';
          const issuedDate = drawing.currentRevision?.issued_date
            ? formatRevDate(drawing.currentRevision.issued_date)
            : drawing.date || '—';

          return (
            <div
              key={drawing.id}
              role="listitem"
              tabIndex={0}
              aria-label={`${drawing.setNumber} ${drawing.title}`}
              onClick={() => onSelectDrawing(drawing)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDrawing(drawing); } }}
              style={{
                display: 'grid', gridTemplateColumns: GRID_TEMPLATE,
                padding: '10px 16px',
                alignItems: 'center', cursor: 'pointer',
                borderBottom: index < drawings.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                backgroundColor: isSelected ? `${colors.primaryOrange}06` : isFocused ? colors.surfaceHover : 'transparent',
                transition: 'background-color 180ms ease, box-shadow 180ms ease',
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = isFocused ? colors.surfaceHover : 'transparent'; else e.currentTarget.style.backgroundColor = `${colors.primaryOrange}06`; }}
            >
              {/* Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => handleCheckboxClick(e, drawing.id)}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  aria-label={`Select ${drawing.setNumber}`}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: colors.primaryOrange }}
                />
              </div>

              {/* Sheet # */}
              <span style={{
                fontSize: typography.fontSize.sm, fontWeight: 600,
                color: colors.textPrimary, fontFamily: typography.fontFamilyMono,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {highlightMatch(drawing.setNumber || '—', searchQuery)}
              </span>

              {/* Title */}
              <span style={{
                fontSize: typography.fontSize.sm, color: colors.textPrimary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {highlightMatch(drawing.title, searchQuery)}
              </span>

              {/* Discipline */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: typography.fontSize.caption, fontWeight: 400,
                color: colors.textSecondary, textTransform: 'capitalize',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', backgroundColor: discColor,
                  flexShrink: 0,
                }} />
                {drawing.discipline?.replace(/_/g, ' ') || 'Unclassified'}
              </span>

              {/* Revision */}
              <span style={{
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamilyMono,
                fontWeight: 500,
                color: colors.textTertiary,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {rev}
              </span>

              {/* Issued date */}
              <span style={{
                fontSize: typography.fontSize.caption, color: colors.textTertiary,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatDate(issuedDate)}
              </span>

              {/* Status */}
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 7px', borderRadius: '4px',
                backgroundColor: `${badge.bg}cc`, color: badge.color,
                fontSize: '10px', fontWeight: 500, textTransform: 'uppercase',
                letterSpacing: '0.04em', whiteSpace: 'nowrap',
              }}>
                {badge.label}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onViewDrawing(drawing)}
                  aria-label={`Open viewer for ${drawing.setNumber}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, border: 'none', borderRadius: '8px',
                    backgroundColor: 'transparent', cursor: 'pointer', color: colors.textTertiary,
                    transition: 'all 200ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceInset; e.currentTarget.style.color = colors.primaryOrange; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = colors.textTertiary; }}
                >
                  <Eye size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
