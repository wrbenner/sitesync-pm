import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  X,
  FileQuestion,
  FileCheck,
  DollarSign,
  AlertCircle,
  PenTool,
  Calendar,
  Users,
  FileText,
  CreditCard,
  ShieldAlert,
} from 'lucide-react';
import { colors, spacing, typography, shadows, zIndex } from '../../styles/theme';

// ── Types ────────────────────────────────────────────────

type EntityType =
  | 'rfi'
  | 'submittal'
  | 'change_order'
  | 'punch_item'
  | 'daily_log'
  | 'drawing'
  | 'meeting'
  | 'contract'
  | 'pay_app'
  | 'safety_incident';

export interface SearchResult {
  type: EntityType;
  id: string;
  number: string | number;
  title: string;
  status: string;
  date?: string;
}

interface CrossEntitySearchProps {
  onSelect: (item: SearchResult) => void;
  isOpen: boolean;
  onClose: () => void;
  filter?: string[];
}

// ── Config ───────────────────────────────────────────────

const ENTITY_CONFIG: Record<EntityType, { label: string; icon: React.ElementType; color: string }> = {
  rfi:             { label: 'RFIs',             icon: FileQuestion, color: '#7C3AED' },
  submittal:       { label: 'Submittals',       icon: FileCheck,    color: '#0D9488' },
  change_order:    { label: 'Change Orders',    icon: DollarSign,   color: '#D97706' },
  punch_item:      { label: 'Punch Items',      icon: AlertCircle,  color: '#DC2626' },
  daily_log:       { label: 'Daily Logs',       icon: Calendar,     color: '#2563EB' },
  drawing:         { label: 'Drawings',         icon: PenTool,      color: '#2563EB' },
  meeting:         { label: 'Meetings',         icon: Users,        color: '#7C3AED' },
  contract:        { label: 'Contracts',        icon: FileText,     color: '#059669' },
  pay_app:         { label: 'Pay Apps',         icon: CreditCard,   color: '#D97706' },
  safety_incident: { label: 'Safety Incidents', icon: ShieldAlert,  color: '#DC2626' },
};

// ── Helpers ──────────────────────────────────────────────

function statusColor(status: string): { text: string; bg: string } {
  const s = status.toLowerCase();
  if (s.includes('open') || s.includes('active') || s.includes('approved') || s.includes('current')) return { text: '#059669', bg: '#ECFDF5' };
  if (s.includes('closed') || s.includes('complete')) return { text: '#6B7280', bg: '#F3F4F6' };
  if (s.includes('pending') || s.includes('review') || s.includes('report') || s.includes('revised')) return { text: '#D97706', bg: '#FFFBEB' };
  if (s.includes('reject') || s.includes('overdue')) return { text: '#DC2626', bg: '#FEF2F2' };
  return { text: '#6B7280', bg: '#F3F4F6' };
}

function groupResults(results: SearchResult[]): Map<EntityType, SearchResult[]> {
  const map = new Map<EntityType, SearchResult[]>();
  for (const r of results) {
    const list = map.get(r.type) ?? [];
    list.push(r);
    map.set(r.type, list);
  }
  return map;
}

// ── Component ────────────────────────────────────────────

export const CrossEntitySearch: React.FC<CrossEntitySearchProps> = ({ onSelect, isOpen, onClose, filter }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state or loading state; no external system sync
      setQuery('');
      setDebouncedQuery('');
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter results
  const results = useMemo(() => {
    let data: SearchResult[] = [];
    if (filter && filter.length > 0) {
      data = data.filter((d) => filter.includes(d.type));
    }
    if (!debouncedQuery.trim()) return data;
    const q = debouncedQuery.toLowerCase();
    return data.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        String(d.number).toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q) ||
        d.type.replace('_', ' ').includes(q)
    );
  }, [debouncedQuery, filter]);

  const flatResults = results;
  const grouped = groupResults(results);

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < flatResults.length) {
        e.preventDefault();
        onSelect(flatResults[activeIndex]);
        onClose();
      }
    },
    [flatResults, activeIndex, onClose, onSelect]
  );

  // Scroll active into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  let flatIdx = -1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: zIndex.modal ?? 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: colors.overlayBackdrop ?? 'rgba(0,0,0,0.4)' }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: '560px',
          background: colors.surfaceRaised ?? '#fff',
          borderRadius: '12px', boxShadow: shadows.xl ?? '0 20px 60px rgba(0,0,0,0.2)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          maxHeight: '70vh',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <Search size={18} color={colors.textTertiary} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
            placeholder="Search across all entities..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: typography.fontSize?.sm ?? '14px', color: colors.textPrimary,
              fontFamily: typography.fontFamily,
            }}
          />
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px', borderRadius: '6px',
              background: colors.surfaceInset, border: 'none', cursor: 'pointer',
            }}
          >
            <X size={14} color={colors.textSecondary} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', padding: `${spacing['2']} 0` }}>
          {results.length === 0 ? (
            <div style={{
              padding: `${spacing['8']} ${spacing['4']}`, textAlign: 'center',
              color: colors.textTertiary, fontSize: typography.fontSize?.sm ?? '14px',
            }}>
              No results found for &ldquo;{debouncedQuery}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([type, items]) => {
              const cfg = ENTITY_CONFIG[type];
              const Icon = cfg.icon;
              return (
                <div key={type}>
                  {/* Group label */}
                  <div style={{
                    padding: `${spacing['1.5']} ${spacing['4']}`,
                    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em', color: cfg.color,
                  }}>
                    {cfg.label} ({items.length})
                  </div>
                  {items.map((item) => {
                    flatIdx += 1;
                    const idx = flatIdx;
                    const isActive = idx === activeIndex;
                    const sc = statusColor(item.status);
                    return (
                      <button
                        key={item.id}
                        data-idx={idx}
                        onClick={() => { onSelect(item); onClose(); }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['3'],
                          width: '100%', padding: `${spacing['2']} ${spacing['4']}`,
                          background: isActive ? (colors.surfaceHover ?? '#F9FAFB') : 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <Icon size={14} color={cfg.color} />
                        <span style={{
                          fontSize: typography.fontSize?.xs ?? '12px', fontWeight: 600,
                          color: cfg.color, whiteSpace: 'nowrap',
                        }}>
                          #{item.number}
                        </span>
                        <span style={{
                          fontSize: typography.fontSize?.xs ?? '12px', color: colors.textPrimary,
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.title}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: 500, color: sc.text, background: sc.bg,
                          padding: `${spacing['0.5']} ${spacing['2']}`, borderRadius: '9999px', whiteSpace: 'nowrap',
                        }}>
                          {item.status}
                        </span>
                        {item.date && (
                          <span style={{ fontSize: '11px', color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                            {item.date}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: `${spacing['2']} ${spacing['4']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          display: 'flex', gap: spacing['4'],
          fontSize: '11px', color: colors.textTertiary,
        }}>
          <span><kbd style={{ padding: '1px 4px', background: colors.surfaceInset, borderRadius: '3px', fontFamily: typography.fontFamilyMono }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ padding: '1px 4px', background: colors.surfaceInset, borderRadius: '3px', fontFamily: typography.fontFamilyMono }}>↵</kbd> select</span>
          <span><kbd style={{ padding: '1px 4px', background: colors.surfaceInset, borderRadius: '3px', fontFamily: typography.fontFamilyMono }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};
