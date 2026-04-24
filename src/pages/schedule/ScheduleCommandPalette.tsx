import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Calendar, AlertTriangle, CheckCircle2, Clock, Target, ArrowRight, Hash } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import type { SchedulePhase } from '../../stores/scheduleStore';

// ── Types ──────────────────────────────────────────────────

interface ScheduleCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  phases: SchedulePhase[];
  onSelectPhase: (phase: SchedulePhase) => void;
  onAction?: (action: string) => void;
}

interface CommandItem {
  id: string;
  type: 'phase' | 'action';
  label: string;
  sublabel?: string;
  status?: string;
  progress?: number;
  isCritical?: boolean;
  phase?: SchedulePhase;
  action?: string;
  icon?: React.ReactNode;
}

// ── Status config ──────────────────────────────────────────

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  completed: { fg: '#16A34A', bg: '#F0FDF4' },
  active:    { fg: '#2563EB', bg: '#EFF6FF' },
  on_track:  { fg: '#16A34A', bg: '#F0FDF4' },
  at_risk:   { fg: '#D97706', bg: '#FEF3C7' },
  delayed:   { fg: '#DC2626', bg: '#FEF2F2' },
  upcoming:  { fg: '#6B7280', bg: '#F3F4F6' },
};

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Component ──────────────────────────────────────────────

export const ScheduleCommandPalette: React.FC<ScheduleCommandPaletteProps> = ({
  open,
  onClose,
  phases,
  onSelectPhase,
  onAction,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build command items
  const items = useMemo((): CommandItem[] => {
    const q = query.toLowerCase().trim();

    // Quick actions (when no query or matching)
    const actions: CommandItem[] = [
      { id: 'act:critical', type: 'action', label: 'Show critical path activities', action: 'filter:critical_path', icon: <AlertTriangle size={14} /> },
      { id: 'act:delayed', type: 'action', label: 'Show delayed activities', action: 'filter:delayed', icon: <Clock size={14} /> },
      { id: 'act:active', type: 'action', label: 'Show active activities', action: 'filter:active', icon: <Target size={14} /> },
      { id: 'act:zoom-day', type: 'action', label: 'Zoom to day view', action: 'zoom:day', icon: <Calendar size={14} /> },
      { id: 'act:zoom-week', type: 'action', label: 'Zoom to week view', action: 'zoom:week', icon: <Calendar size={14} /> },
      { id: 'act:zoom-month', type: 'action', label: 'Zoom to month view', action: 'zoom:month', icon: <Calendar size={14} /> },
      { id: 'act:baseline', type: 'action', label: 'Toggle baseline comparison', action: 'toggle:baseline', icon: <Hash size={14} /> },
    ];

    // Phase items
    const phaseItems: CommandItem[] = phases.map(p => ({
      id: p.id,
      type: 'phase',
      label: p.name ?? 'Unnamed Activity',
      sublabel: `${formatDateShort(p.startDate)} — ${formatDateShort(p.endDate)}`,
      status: p.status,
      progress: p.progress ?? 0,
      isCritical: p.is_critical_path === true,
      phase: p,
    }));

    if (!q) {
      // Show actions first, then first 8 phases
      return [...actions, ...phaseItems.slice(0, 8)];
    }

    // Filter by query
    const matchingActions = actions.filter(a => a.label.toLowerCase().includes(q));
    const matchingPhases = phaseItems.filter(p =>
      p.label.toLowerCase().includes(q) ||
      (p.status ?? '').includes(q) ||
      (p.isCritical && q.includes('critical'))
    );

    return [...matchingActions, ...matchingPhases].slice(0, 12);
  }, [query, phases]);

  // Clamp selection
  useEffect(() => {
    setSelectedIdx(prev => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIdx] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const handleSelect = useCallback((item: CommandItem) => {
    if (item.type === 'phase' && item.phase) {
      onSelectPhase(item.phase);
    } else if (item.type === 'action' && item.action) {
      onAction?.(item.action);
    }
    onClose();
  }, [onSelectPhase, onAction, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIdx]) handleSelect(items[selectedIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [items, selectedIdx, handleSelect, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        } as React.CSSProperties}
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-label="Activity search"
        style={{
          position: 'fixed', zIndex: 9999,
          top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 560,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius['2xl'],
          border: `1px solid ${colors.borderDefault}`,
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          fontFamily: typography.fontFamily,
          animation: 'cmdPaletteIn 0.15s ease-out',
        }}
      >
        <style>{`
          @keyframes cmdPaletteIn {
            from { opacity: 0; transform: translateX(-50%) scale(0.98) translateY(-8px); }
            to { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); }
          }
        `}</style>

        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['4']} ${spacing['5']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <Search size={18} color={colors.textTertiary} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search activities, actions..."
            aria-label="Search schedule"
            style={{
              flex: 1, border: 'none', outline: 'none',
              backgroundColor: 'transparent',
              fontSize: typography.fontSize.body,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              caretColor: colors.primaryOrange,
            }}
          />
          <kbd style={{
            fontSize: 10, fontWeight: 600,
            padding: '2px 6px', borderRadius: 4,
            backgroundColor: colors.surfaceInset,
            color: colors.textTertiary,
            border: `1px solid ${colors.borderSubtle}`,
            fontFamily: 'monospace',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          role="listbox"
          style={{
            maxHeight: 340, overflowY: 'auto',
            padding: spacing['2'],
          }}
        >
          {items.length === 0 && (
            <div style={{
              padding: spacing['6'],
              textAlign: 'center', color: colors.textTertiary,
              fontSize: typography.fontSize.sm,
            }}>
              No results for "{query}"
            </div>
          )}

          {items.map((item, idx) => {
            const isSelected = idx === selectedIdx;
            const sc = item.status ? (STATUS_COLORS[item.status] ?? STATUS_COLORS.upcoming) : null;

            return (
              <div
                key={item.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIdx(idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                  padding: `${spacing['2.5']} ${spacing['3']}`,
                  borderRadius: borderRadius.lg,
                  backgroundColor: isSelected ? colors.surfaceHover : 'transparent',
                  cursor: 'pointer',
                  transition: `background-color 60ms ease`,
                }}
              >
                {/* Icon */}
                {item.type === 'action' ? (
                  <div style={{
                    width: 28, height: 28, borderRadius: borderRadius.md,
                    backgroundColor: colors.surfaceInset,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: colors.textSecondary, flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: borderRadius.md,
                    backgroundColor: sc?.bg ?? colors.surfaceInset,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {item.isCritical ? (
                      <AlertTriangle size={13} color="#DC2626" />
                    ) : item.status === 'completed' ? (
                      <CheckCircle2 size={13} color={sc?.fg} />
                    ) : (
                      <Clock size={13} color={sc?.fg ?? colors.textTertiary} />
                    )}
                  </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: typography.fontSize.sm,
                    fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.medium,
                    color: colors.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.label}
                  </div>
                  {item.sublabel && (
                    <div style={{
                      fontSize: typography.fontSize.caption,
                      color: colors.textTertiary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {item.sublabel}
                    </div>
                  )}
                </div>

                {/* Right metadata */}
                {item.type === 'phase' && item.progress != null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: spacing['2'],
                    flexShrink: 0,
                  }}>
                    {item.isCritical && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        backgroundColor: '#FEE2E2', color: '#991B1B',
                        padding: '1px 5px', borderRadius: 3,
                      }}>CP</span>
                    )}
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      color: sc?.fg ?? colors.textTertiary,
                      fontWeight: typography.fontWeight.medium,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {item.progress}%
                    </span>
                  </div>
                )}

                {item.type === 'action' && isSelected && (
                  <ArrowRight size={14} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer hints */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['4'],
          padding: `${spacing['2.5']} ${spacing['4']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceInset,
        }}>
          {[
            { keys: ['↑', '↓'], label: 'Navigate' },
            { keys: ['↵'], label: 'Select' },
            { keys: ['esc'], label: 'Close' },
          ].map(hint => (
            <div key={hint.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {hint.keys.map(k => (
                <kbd key={k} style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '1px 5px', borderRadius: 3,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textTertiary,
                  border: `1px solid ${colors.borderSubtle}`,
                  fontFamily: 'monospace',
                  lineHeight: '16px',
                }}>{k}</kbd>
              ))}
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{hint.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ── Keyboard Shortcuts Overlay ─────────────────────────────

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { category: 'Navigation', items: [
    { keys: ['⌘', 'K'], label: 'Search activities' },
    { keys: ['+', '−'], label: 'Zoom in / out' },
    { keys: ['B'], label: 'Toggle baseline' },
    { keys: ['?'], label: 'Show keyboard shortcuts' },
  ]},
  { category: 'Views', items: [
    { keys: ['1'], label: 'Timeline view' },
    { keys: ['3'], label: 'List view' },
    { keys: ['Esc'], label: 'Exit what-if mode' },
  ]},
  { category: 'Selection', items: [
    { keys: ['↑', '↓'], label: 'Navigate activities' },
    { keys: ['Enter'], label: 'Select activity' },
    { keys: ['Space'], label: 'Toggle details' },
  ]},
];

export const KeyboardShortcutsOverlay: React.FC<KeyboardShortcutsOverlayProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        backgroundColor: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      } as React.CSSProperties} />

      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        style={{
          position: 'fixed', zIndex: 9999,
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '100%', maxWidth: 480,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius['2xl'],
          border: `1px solid ${colors.borderDefault}`,
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)',
          padding: spacing['6'],
          fontFamily: typography.fontFamily,
          animation: 'cmdPaletteIn 0.15s ease-out',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: spacing['5'],
        }}>
          <h2 style={{
            margin: 0, fontSize: typography.fontSize.subtitle,
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
          }}>
            Keyboard Shortcuts
          </h2>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: typography.fontSize.body, color: colors.textTertiary,
            padding: spacing['1'],
          }}>
            ✕
          </button>
        </div>

        {SHORTCUTS.map(category => (
          <div key={category.category} style={{ marginBottom: spacing['4'] }}>
            <h3 style={{
              margin: `0 0 ${spacing['2']}`,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textTertiary,
              textTransform: 'uppercase' as const,
              letterSpacing: typography.letterSpacing.wider,
            }}>
              {category.category}
            </h3>
            {category.items.map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${spacing['2']} 0`,
              }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  {item.label}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {item.keys.map(k => (
                    <kbd key={k} style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 4,
                      backgroundColor: colors.surfaceInset,
                      color: colors.textSecondary,
                      border: `1px solid ${colors.borderSubtle}`,
                      fontFamily: 'monospace',
                      minWidth: 24, textAlign: 'center' as const,
                    }}>{k}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
};
