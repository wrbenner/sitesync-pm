import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, X, LayoutGrid, LayoutList, Download, Trash2,
  Tag as TagIcon, CheckSquare, ChevronDown, Layers,
} from 'lucide-react';
import { Btn } from '../../components/Primitives';
import { colors, typography } from '../../styles/theme';
import { DISCIPLINE_COLORS, DISCIPLINE_LABELS, STATUS_CONFIG, type DrawingStatus } from './constants';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ViewMode = 'table' | 'grid';

export { type DrawingStatus } from './constants';

export type QuickFilter = 'all' | 'recently_updated' | 'with_markups' | 'issued_for_construction';

export interface ToolbarFilters {
  search: string;
  disciplines: Set<string>;
  statuses: Set<DrawingStatus>;
}

interface DrawingToolbarProps {
  filters: ToolbarFilters;
  onFiltersChange: (filters: ToolbarFilters) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  totalCount: number;
  filteredCount: number;
  selectedCount: number;
  quickFilter?: QuickFilter;
  onQuickFilterChange?: (q: QuickFilter) => void;
  onBulkDownload?: () => void;
  onBulkStatusChange?: (status: DrawingStatus) => void;
  onBulkDelete?: () => void;
  onBulkOverlay?: () => void;
  isOverlayBusy?: boolean;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  availableDisciplines: string[];
  /** Optional ref forwarded to the inner search <input> so the parent page
   *  can implement a global "/" focus shortcut. */
  searchInputRef?: React.Ref<HTMLInputElement>;
}

const QUICK_FILTERS: Array<{ id: QuickFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'recently_updated', label: 'Recently Updated' },
  { id: 'with_markups', label: 'With Markups' },
  { id: 'issued_for_construction', label: 'Issued for Construction' },
];

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = {
  wrapper: {
    marginBottom: '20px',
  } as React.CSSProperties,

  // Main bar — single row, compact
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    height: '44px',
  } as React.CSSProperties,

  // Search — clean, borderless feel
  searchWrap: {
    position: 'relative' as const,
    flex: 1,
    maxWidth: '400px',
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  searchIcon: {
    position: 'absolute' as const,
    left: '12px',
    pointerEvents: 'none' as const,
    color: colors.textTertiary,
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    height: '36px',
    padding: '0 36px 0 36px',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    outline: 'none',
    transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out',
  } as React.CSSProperties,
  searchKbd: {
    position: 'absolute' as const,
    right: '10px',
    fontSize: '11px',
    color: colors.textTertiary,
    backgroundColor: colors.surfaceInset,
    padding: '2px 6px',
    borderRadius: '5px',
    border: `1px solid ${colors.borderSubtle}`,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
    fontFamily: typography.fontFamilyMono,
  } as React.CSSProperties,
  searchClear: {
    position: 'absolute' as const,
    right: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    color: colors.textTertiary,
    borderRadius: '4px',
  } as React.CSSProperties,

  // Filter pill button
  filterBtn: (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    height: '32px',
    padding: '0 12px',
    border: `1px solid ${isActive ? colors.primaryOrange + '60' : colors.borderSubtle}`,
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: isActive ? colors.primaryOrange + '08' : 'transparent',
    fontSize: '12px',
    fontFamily: typography.fontFamily,
    color: isActive ? colors.primaryOrange : colors.textSecondary,
    fontWeight: 500,
    transition: 'all 150ms ease-out',
  } as React.CSSProperties),

  filterCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: colors.primaryOrange,
    color: '#fff',
    fontSize: '9px',
    fontWeight: 700,
  } as React.CSSProperties,

  // Dropdown
  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 6px)',
    left: 0,
    zIndex: 100,
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
    minWidth: '180px',
    padding: '6px',
    maxHeight: '280px',
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  dropdownItem: (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    backgroundColor: isActive ? colors.surfaceSelected : 'transparent',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '12px',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    fontWeight: isActive ? 500 : 400,
    transition: 'background-color 100ms ease-out',
  } as React.CSSProperties),
  dropdownDot: (color: string) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
  } as React.CSSProperties),

  // View toggle
  viewToggle: {
    display: 'flex',
    height: '32px',
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: '8px',
    overflow: 'hidden',
  } as React.CSSProperties,
  viewBtn: (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '100%',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: isActive ? colors.surfaceSelected : 'transparent',
    color: isActive ? colors.primaryOrange : colors.textTertiary,
    transition: 'all 150ms ease-out',
  } as React.CSSProperties),

  // Result count
  count: {
    fontSize: '12px',
    color: colors.textTertiary,
    marginLeft: 'auto',
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 500,
  } as React.CSSProperties,

  // Active filter chips row
  chipsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '10px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  // Quick filter chips (above the toolbar bar)
  quickRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '10px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  quickChip: (isActive: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    height: '28px',
    padding: '0 12px',
    border: `1px solid ${isActive ? colors.primaryOrange : colors.borderSubtle}`,
    borderRadius: '999px',
    backgroundColor: isActive ? `${colors.primaryOrange}10` : 'transparent',
    color: isActive ? colors.primaryOrange : colors.textSecondary,
    fontSize: '12px',
    fontFamily: typography.fontFamily,
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
  } as React.CSSProperties),
  chip: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    height: '24px',
    padding: '0 8px',
    backgroundColor: color + '10',
    border: `1px solid ${color}30`,
    borderRadius: '6px',
    fontSize: '11px',
    color,
    fontWeight: 500,
    textTransform: 'capitalize' as const,
  } as React.CSSProperties),
  chipClose: {
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    color: 'inherit',
    opacity: 0.7,
  } as React.CSSProperties,

  // Bulk action bar
  bulk: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    height: '44px',
    padding: '0 16px',
    backgroundColor: colors.primaryOrange + '06',
    border: `1px solid ${colors.primaryOrange}25`,
    borderRadius: '10px',
  } as React.CSSProperties,
  bulkLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  bulkSpacer: { flex: 1 } as React.CSSProperties,
  bulkDivider: {
    width: '1px',
    height: '20px',
    backgroundColor: colors.borderSubtle,
  } as React.CSSProperties,
  bulkTextBtn: (color: string) => ({
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '12px',
    color,
    fontFamily: typography.fontFamily,
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: '4px',
  } as React.CSSProperties),
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount,
  selectedCount,
  quickFilter = 'all',
  onQuickFilterChange,
  onBulkDownload,
  onBulkStatusChange,
  onBulkDelete,
  onBulkOverlay,
  isOverlayBusy,
  onSelectAll,
  onClearSelection,
  availableDisciplines,
  searchInputRef,
}) => {
  const localSearchRef = useRef<HTMLInputElement>(null);
  // Forward the input element to the parent if a ref was passed in.
  const setSearchRef = useCallback((node: HTMLInputElement | null) => {
    (localSearchRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
    if (typeof searchInputRef === 'function') {
      searchInputRef(node);
    } else if (searchInputRef && typeof searchInputRef === 'object') {
      (searchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
    }
  }, [searchInputRef]);
  const [showDisciplineDropdown, setShowDisciplineDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);
  const disciplineRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // "/" or ⌘K to focus search. The parent page can also drive focus via
  // the forwarded ref; both paths work. Escape clears the field.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
    };
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        localSearchRef.current?.focus();
        return;
      }
      if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault();
        localSearchRef.current?.focus();
        return;
      }
      if (e.key === 'Escape' && document.activeElement === localSearchRef.current) {
        localSearchRef.current?.blur();
        if (filters.search) onFiltersChange({ ...filters, search: '' });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [filters, onFiltersChange]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (disciplineRef.current && !disciplineRef.current.contains(e.target as Node)) setShowDisciplineDropdown(false);
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setShowStatusDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDiscipline = useCallback((disc: string) => {
    const next = new Set(filters.disciplines);
    if (next.has(disc)) next.delete(disc); else next.add(disc);
    onFiltersChange({ ...filters, disciplines: next });
  }, [filters, onFiltersChange]);

  const toggleStatus = useCallback((status: DrawingStatus) => {
    const next = new Set(filters.statuses);
    if (next.has(status)) next.delete(status); else next.add(status);
    onFiltersChange({ ...filters, statuses: next });
  }, [filters, onFiltersChange]);

  const activeFilterCount = filters.disciplines.size + filters.statuses.size;
  const hasSelection = selectedCount > 0;

  // ── Bulk action bar ──────────────────────────────────────
  if (hasSelection) {
    return (
      <div style={S.wrapper}>
        <div style={S.bulk}>
          <span style={S.bulkLabel}>
            <CheckSquare size={14} color={colors.primaryOrange} />
            {selectedCount} selected
          </span>
          <div style={S.bulkSpacer} />

          {onBulkOverlay && (
            <Btn
              variant={selectedCount === 2 ? 'primary' : 'secondary'}
              size="sm"
              icon={<Layers size={13} />}
              onClick={onBulkOverlay}
              disabled={selectedCount !== 2 || isOverlayBusy}
              title={selectedCount !== 2 ? 'Select exactly 2 drawings to overlay' : 'Overlay the two selected drawings'}
            >
              {isOverlayBusy ? 'Loading…' : 'Overlay'}
            </Btn>
          )}

          {onBulkDownload && (
            <Btn variant="secondary" size="sm" icon={<Download size={13} />} onClick={onBulkDownload}>
              Download
            </Btn>
          )}

          {onBulkStatusChange && (
            <div style={{ position: 'relative' }}>
              <Btn variant="secondary" size="sm" icon={<TagIcon size={13} />} onClick={() => setShowBulkStatusMenu(v => !v)}>
                Status
              </Btn>
              {showBulkStatusMenu && (
                <div style={S.dropdown}>
                  {(Object.entries(STATUS_CONFIG) as [DrawingStatus, { bg: string; color: string; label: string }][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => { onBulkStatusChange(key); setShowBulkStatusMenu(false); }}
                      style={S.dropdownItem(false)}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span style={S.dropdownDot(cfg.color)} />
                      {cfg.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {onBulkDelete && (
            <Btn variant="secondary" size="sm" icon={<Trash2 size={13} />} onClick={onBulkDelete}>
              Archive
            </Btn>
          )}

          <div style={S.bulkDivider} />
          {onSelectAll && <button onClick={onSelectAll} style={S.bulkTextBtn(colors.primaryOrange)}>Select All</button>}
          {onClearSelection && <button onClick={onClearSelection} style={S.bulkTextBtn(colors.textSecondary)}>Clear</button>}
        </div>
      </div>
    );
  }

  // ── Normal toolbar ───────────────────────────────────────
  return (
    <div style={S.wrapper}>
      {/* Quick-filter chips */}
      {onQuickFilterChange && (
        <div style={S.quickRow} role="group" aria-label="Quick drawing filters">
          {QUICK_FILTERS.map((q) => {
            const isActive = quickFilter === q.id;
            return (
              <button
                key={q.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onQuickFilterChange(q.id)}
                style={S.quickChip(isActive)}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      )}

      <div style={S.bar}>
        {/* Search */}
        <div style={S.searchWrap}>
          <Search size={14} style={S.searchIcon} />
          <input
            ref={setSearchRef}
            type="text"
            value={filters.search}
            onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Search sheets — try A3.2"
            aria-label="Search drawings"
            style={S.searchInput}
            onFocus={e => { e.currentTarget.style.borderColor = colors.primaryOrange; e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primaryOrange}12`; }}
            onBlur={e => { e.currentTarget.style.borderColor = colors.borderSubtle; e.currentTarget.style.boxShadow = 'none'; }}
          />
          {!filters.search && <span style={S.searchKbd}>/</span>}
          {filters.search && (
            <button onClick={() => onFiltersChange({ ...filters, search: '' })} aria-label="Clear search" style={S.searchClear}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Discipline filter */}
        <div ref={disciplineRef} style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowDisciplineDropdown(v => !v); setShowStatusDropdown(false); }}
            aria-expanded={showDisciplineDropdown}
            style={S.filterBtn(filters.disciplines.size > 0)}
          >
            Discipline
            {filters.disciplines.size > 0 && <span style={S.filterCount}>{filters.disciplines.size}</span>}
            <ChevronDown size={11} />
          </button>
          {showDisciplineDropdown && (
            <div style={S.dropdown}>
              {availableDisciplines.map(disc => {
                const isActive = filters.disciplines.has(disc);
                const color = DISCIPLINE_COLORS[disc] || DISCIPLINE_COLORS.unclassified;
                return (
                  <button
                    key={disc}
                    onClick={() => toggleDiscipline(disc)}
                    style={S.dropdownItem(isActive)}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={S.dropdownDot(color)} />
                    <span style={{ flex: 1, textAlign: 'left', textTransform: 'capitalize' }}>
                      {DISCIPLINE_LABELS[disc] || disc.replace(/_/g, ' ')}
                    </span>
                    {isActive && <span style={{ color: colors.primaryOrange, fontSize: '13px' }}>✓</span>}
                  </button>
                );
              })}
              {filters.disciplines.size > 0 && (
                <button
                  onClick={() => onFiltersChange({ ...filters, disciplines: new Set() })}
                  style={{ ...S.dropdownItem(false), justifyContent: 'center', color: colors.textTertiary, borderTop: `1px solid ${colors.borderSubtle}`, marginTop: '4px', paddingTop: '8px' }}
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status filter */}
        <div ref={statusRef} style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowStatusDropdown(v => !v); setShowDisciplineDropdown(false); }}
            aria-expanded={showStatusDropdown}
            style={S.filterBtn(filters.statuses.size > 0)}
          >
            Status
            {filters.statuses.size > 0 && <span style={S.filterCount}>{filters.statuses.size}</span>}
            <ChevronDown size={11} />
          </button>
          {showStatusDropdown && (
            <div style={S.dropdown}>
              {(Object.entries(STATUS_CONFIG) as [DrawingStatus, { bg: string; color: string; label: string }][]).map(([key, cfg]) => {
                const isActive = filters.statuses.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleStatus(key)}
                    style={S.dropdownItem(isActive)}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={S.dropdownDot(cfg.color)} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{cfg.label}</span>
                    {isActive && <span style={{ color: colors.primaryOrange, fontSize: '13px' }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* View mode toggle */}
        <div style={S.viewToggle}>
          <button
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            onClick={() => onViewModeChange('grid')}
            style={S.viewBtn(viewMode === 'grid')}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            aria-label="Table view"
            aria-pressed={viewMode === 'table'}
            onClick={() => onViewModeChange('table')}
            style={{ ...S.viewBtn(viewMode === 'table'), borderLeft: `1px solid ${colors.borderSubtle}` }}
          >
            <LayoutList size={14} />
          </button>
        </div>

        {/* Result count */}
        <span style={S.count}>
          {filteredCount === totalCount
            ? `${totalCount} sheet${totalCount !== 1 ? 's' : ''}`
            : `${filteredCount} of ${totalCount}`}
        </span>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div style={S.chipsRow}>
          {Array.from(filters.disciplines).map(disc => {
            const color = DISCIPLINE_COLORS[disc] || DISCIPLINE_COLORS.unclassified;
            return (
              <span key={`d-${disc}`} style={S.chip(color)}>
                {DISCIPLINE_LABELS[disc] || disc.replace(/_/g, ' ')}
                <button onClick={() => toggleDiscipline(disc)} aria-label={`Remove ${disc}`} style={S.chipClose}>
                  <X size={10} />
                </button>
              </span>
            );
          })}
          {Array.from(filters.statuses).map(st => {
            const cfg = STATUS_CONFIG[st];
            return (
              <span key={`s-${st}`} style={S.chip(cfg.color)}>
                {cfg.label}
                <button onClick={() => toggleStatus(st)} aria-label={`Remove ${cfg.label}`} style={S.chipClose}>
                  <X size={10} />
                </button>
              </span>
            );
          })}
          <button
            onClick={() => onFiltersChange({ ...filters, disciplines: new Set(), statuses: new Set() })}
            style={{ ...S.chipClose, fontSize: '11px', color: colors.textTertiary, textDecoration: 'underline', padding: '0 4px' }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
