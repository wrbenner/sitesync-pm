import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Link2, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
import type { GanttPhase } from './GanttChart';
import type { PredictedRisk } from '../../lib/predictions';
import { colors, spacing, typography, borderRadius, getStatusColor } from '../../styles/theme';
import { useScheduleStore } from '../../stores/scheduleStore';

// ── Trade color palette ────────────────────────────────────────────────────

const TRADE_COLORS: Record<string, string> = {
  Concrete: '#64748b',
  Steel: '#475569',
  Structural: '#b45309',
  Mechanical: '#2563eb',
  Electrical: '#d97706',
  Plumbing: '#0891b2',
  HVAC: '#0284c7',
  MEP: '#0ea5e9',
  Carpentry: '#92400e',
  Masonry: '#78716c',
  Roofing: '#dc2626',
  Finishes: '#7c3aed',
  Drywall: '#b45309',
  Painting: '#6d28d9',
  Landscaping: '#16a34a',
  Sitework: '#059669',
  Foundation: '#7f6d5b',
  General: '#F47820',
  Framing: '#a16207',
  Insulation: '#15803d',
  Flooring: '#7e22ce',
  Glazing: '#0369a1',
};

function getTradeColor(trade: string | null | undefined): string {
  if (!trade) return '#F47820';
  return TRADE_COLORS[trade] ?? '#6b7280';
}

// ── Date helpers ───────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── ActivityCard ───────────────────────────────────────────────────────────

interface CardProps {
  phase: GanttPhase;
  risk?: PredictedRisk;
  onMarkInProgress: () => void;
}

const ActivityCard: React.FC<CardProps> = ({ phase, risk, onMarkInProgress }) => {
  const [expanded, setExpanded] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const ts = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    isH: null as boolean | null,
    active: false,
  });

  const THRESHOLD = 60;
  const tradeColor = getTradeColor(phase.assigned_trade);

  // Register passive:false touchmove so preventDefault works
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const handleTouchMove = (e: TouchEvent) => {
      const t = ts.current;
      if (!t.active) return;
      const dx = e.touches[0].clientX - t.startX;
      const dy = e.touches[0].clientY - t.startY;

      if (t.isH === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        t.isH = Math.abs(dx) > Math.abs(dy);
      }
      if (!t.isH) return;

      e.preventDefault();
      t.currentX = e.touches[0].clientX;
      setTranslateX(Math.max(-100, Math.min(100, dx)));
    };

    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    ts.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      currentX: e.touches[0].clientX,
      isH: null,
      active: true,
    };
    setTranslateX(0);
  };

  const onTouchEnd = () => {
    const t = ts.current;
    if (!t.active) return;
    const dx = t.currentX - t.startX;
    t.active = false;

    setTranslateX(0);

    if (t.isH === null || Math.abs(dx) < 6) {
      setExpanded(prev => !prev);
    } else if (dx > THRESHOLD) {
      onMarkInProgress();
    } else if (dx < -THRESHOLD) {
      setExpanded(true);
    }
  };

  const progressColor = phase.completed
    ? colors.statusActive
    : phase.critical
    ? colors.statusCritical
    : phase.progress > 0
    ? colors.statusInfo
    : colors.textTertiary;

  const statusColors = getStatusColor(phase.status ?? '');

  const isSwipingRight = translateX > 10;
  const isSwipingLeft = translateX < -10;

  return (
    <div style={{ position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden' }}>
      {/* Swipe right reveal: Mark In Progress */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: colors.statusActive,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: spacing['4'],
          gap: spacing['2'],
          borderRadius: borderRadius.lg,
          opacity: isSwipingRight ? Math.min(1, translateX / THRESHOLD) : 0,
          transition: 'opacity 0.1s',
        }}
      >
        <CheckCircle2 size={18} color="#fff" />
        <span style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: '#fff',
        }}>
          Mark In Progress
        </span>
      </div>

      {/* Swipe left reveal: View Detail */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: colors.statusInfo,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: spacing['4'],
          gap: spacing['2'],
          borderRadius: borderRadius.lg,
          opacity: isSwipingLeft ? Math.min(1, Math.abs(translateX) / THRESHOLD) : 0,
          transition: 'opacity 0.1s',
        }}
      >
        <span style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: '#fff',
        }}>
          View Detail
        </span>
        <ChevronDown size={18} color="#fff" />
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${phase.name}, ${phase.progress}% complete`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => setExpanded(prev => !prev)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') setExpanded(prev => !prev);
        }}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderDefault}`,
          borderLeft: `4px solid ${tradeColor}`,
          minHeight: 44,
          cursor: 'pointer',
          transform: `translateX(${translateX}px)`,
          transition: translateX === 0 ? 'transform 0.2s ease' : 'none',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Main content */}
        <div style={{ padding: '12px 12px 10px' }}>
          {/* Name + chevron */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            marginBottom: 6,
          }}>
            <span style={{
              flex: 1,
              fontSize: 14,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              lineHeight: 1.3,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {phase.name}
            </span>
            {phase.critical && (
              <span style={{
                fontSize: 10,
                fontWeight: typography.fontWeight.semibold,
                backgroundColor: `${colors.statusCritical}18`,
                color: colors.statusCritical,
                padding: '1px 5px',
                borderRadius: borderRadius.full,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                letterSpacing: '0.2px',
              }}>
                Critical
              </span>
            )}
            {risk && (
              <AlertTriangle size={13} color={colors.statusPending} style={{ flexShrink: 0 }} />
            )}
            {expanded
              ? <ChevronUp size={14} color={colors.textTertiary} style={{ flexShrink: 0 }} />
              : <ChevronDown size={14} color={colors.textTertiary} style={{ flexShrink: 0 }} />
            }
          </div>

          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: 4,
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.full,
            marginBottom: 8,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${phase.progress}%`,
              backgroundColor: progressColor,
              borderRadius: borderRadius.full,
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Meta row: dates + completion + trade badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing['2'],
            flexWrap: 'nowrap',
          }}>
            <span style={{
              fontSize: 12,
              color: colors.textTertiary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {fmtShort(phase.startDate)} {'\u2013'} {fmtShort(phase.endDate)}
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              flexShrink: 0,
            }}>
              {phase.status && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginRight: 2 }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: statusColors.fg,
                    flexShrink: 0,
                    display: 'inline-block',
                  }} />
                  <span style={{
                    fontSize: 11,
                    color: statusColors.fg,
                    fontWeight: typography.fontWeight.medium,
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap',
                  }}>
                    {phase.status.replace(/_/g, ' ')}
                  </span>
                </span>
              )}
              {phase.assigned_trade && (
                <span style={{
                  fontSize: 11,
                  fontWeight: typography.fontWeight.semibold,
                  backgroundColor: tradeColor + '22',
                  color: tradeColor,
                  padding: '1px 6px',
                  borderRadius: borderRadius.full,
                  whiteSpace: 'nowrap',
                }}>
                  {phase.assigned_trade}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Inline expanded detail */}
        {expanded && (
          <div style={{
            borderTop: `1px solid ${colors.borderDefault}`,
            padding: '10px 12px 12px',
            backgroundColor: colors.surfaceInset,
          }}>
            {/* Status */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 8,
              borderBottom: `1px solid ${colors.borderDefault}`,
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 12, color: colors.textTertiary }}>Status</span>
              <span style={{
                fontSize: 12,
                color: colors.textPrimary,
                fontWeight: typography.fontWeight.medium,
                textTransform: 'capitalize',
              }}>
                {(phase.status ?? 'not started').replace(/_/g, ' ')}
              </span>
            </div>

            {/* Float days */}
            {phase.floatDays != null && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 8,
                borderBottom: `1px solid ${colors.borderDefault}`,
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, color: colors.textTertiary }}>Float</span>
                <span style={{
                  fontSize: 12,
                  fontWeight: typography.fontWeight.semibold,
                  color: phase.floatDays === 0 ? colors.statusCritical : colors.textPrimary,
                }}>
                  {phase.floatDays === 0 ? 'Critical path' : `${phase.floatDays}d`}
                </span>
              </div>
            )}

            {/* Risk callout */}
            {risk && (
              <div style={{
                backgroundColor: `${colors.statusPending}12`,
                border: `1px solid ${colors.statusPending}25`,
                borderRadius: borderRadius.base,
                padding: '6px 8px',
                marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <AlertTriangle size={11} color={colors.statusPending} />
                  <span style={{
                    fontSize: 11,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.statusPending,
                  }}>
                    {risk.likelihoodPercent}% likely, +{risk.impactDays}d impact
                  </span>
                </div>
                <p style={{
                  margin: 0,
                  fontSize: 11,
                  color: colors.textSecondary,
                  lineHeight: 1.4,
                }}>
                  {risk.reason}
                </p>
              </div>
            )}

            {/* Linked RFIs placeholder */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link2 size={11} color={colors.textTertiary} />
              <span style={{ fontSize: 12, color: colors.textTertiary }}>
                No linked RFIs
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main MobileScheduleView ────────────────────────────────────────────────

interface Props {
  phases: GanttPhase[];
  risks: PredictedRisk[];
}

export const MobileScheduleView: React.FC<Props> = ({ phases, risks }) => {
  const { updatePhase } = useScheduleStore();

  // Actual today (fixed) + user-driven week offset (\u00b11 per swipe or button tap).
  // Offset shifts the 3-week window forward or backward by 7 days per step.
  const actualToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [weekOffset, setWeekOffset] = useState(0);
  const today = useMemo(() => addDays(actualToday, weekOffset * 7), [actualToday, weekOffset]);
  const rangeEnd = useMemo(() => addDays(today, 21), [today]);

  // Pinch-zoom state \u2014 scales the weeks list between 0.8x and 1.5x.
  const [zoom, setZoom] = useState(1);
  const pinchRef = useRef({ active: false, initialDist: 0, initialZoom: 1 });

  // Swipe state for advancing/retreating the 3-week window.
  const swipeRef = useRef({ startX: 0, startY: 0, active: false });
  const SWIPE_THRESHOLD = 60;

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Pinch-zoom: register non-passive touchmove so we can preventDefault when scaling.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current.active) {
        const a = e.touches[0];
        const b = e.touches[1];
        const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        if (pinchRef.current.initialDist > 0) {
          const ratio = dist / pinchRef.current.initialDist;
          const next = Math.max(0.8, Math.min(1.5, pinchRef.current.initialZoom * ratio));
          setZoom(next);
        }
        e.preventDefault();
      }
    };

    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  const onWrapperTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const a = e.touches[0];
      const b = e.touches[1];
      pinchRef.current = {
        active: true,
        initialDist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        initialZoom: zoom,
      };
      swipeRef.current.active = false;
    }
  }, [zoom]);

  const onWrapperTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current.active = false;
    }
  }, []);

  // Header-area swipe: advances window by \u00b11 week without stealing card swipes.
  const onHeaderTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    swipeRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      active: true,
    };
  }, []);

  const onHeaderTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current.active) return;
    swipeRef.current.active = false;
    const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
    const dy = e.changedTouches[0].clientY - swipeRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      setWeekOffset((o) => o + (dx < 0 ? 1 : -1));
    }
  }, []);

  // Filter to activities that overlap the current 21-day window
  const lookahead = useMemo(() => phases.filter(p => {
    const start = new Date(p.startDate + 'T00:00:00');
    const end = new Date(p.endDate + 'T00:00:00');
    return start < rangeEnd && end >= today;
  }), [phases, today, rangeEnd]);

  // Group into 3 weeks by start date offset (ongoing = Week 1)
  const weeks = useMemo(() => {
    const w = [
      { label: 'Week 1', start: today,             end: addDays(today, 7),  phases: [] as GanttPhase[] },
      { label: 'Week 2', start: addDays(today, 7), end: addDays(today, 14), phases: [] as GanttPhase[] },
      { label: 'Week 3', start: addDays(today, 14), end: rangeEnd,          phases: [] as GanttPhase[] },
    ];
    for (const phase of lookahead) {
      const start = new Date(phase.startDate + 'T00:00:00');
      const offset = Math.floor((start.getTime() - today.getTime()) / 86400000);
      const idx = offset < 7 ? 0 : offset < 14 ? 1 : 2;
      w[idx].phases.push(phase);
    }
    return w;
  }, [lookahead, today, rangeEnd]);

  const handleMarkInProgress = (phase: GanttPhase) => {
    updatePhase(phase.id, { status: 'active' });
  };

  const windowLabel = weekOffset === 0
    ? 'Next 3 Weeks'
    : weekOffset > 0
      ? `+${weekOffset}w Ahead`
      : `${weekOffset}w Back`;

  return (
    <div
      ref={wrapperRef}
      onTouchStart={onWrapperTouchStart}
      onTouchEnd={onWrapperTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Sticky top header with window nav + pinch-zoom controls */}
      <div
        onTouchStart={onHeaderTouchStart}
        onTouchEnd={onHeaderTouchEnd}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing['2']} ${spacing['3']}`,
          borderBottom: `1px solid ${colors.borderDefault}`,
          gap: spacing['2'],
        }}
      >
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          aria-label="Previous week"
          style={{
            width: 56, height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: colors.textSecondary, borderRadius: borderRadius.base,
          }}
        >
          <ChevronLeft size={22} />
        </button>
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          minWidth: 0,
        }}>
          <span style={{
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}>
            {windowLabel}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: typography.fontWeight.medium,
            color: colors.primaryOrange,
            backgroundColor: `${colors.primaryOrange}14`,
            padding: '2px 10px',
            borderRadius: borderRadius.full,
            whiteSpace: 'nowrap',
          }}>
            {fmtDate(today)} {'\u2013'} {fmtDate(addDays(rangeEnd, -1))}
          </span>
        </div>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          aria-label="Next week"
          style={{
            width: 56, height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: colors.textSecondary, borderRadius: borderRadius.base,
          }}
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Zoom + reset-to-today control strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${spacing['2']} ${spacing['3']}`,
        gap: spacing['2'],
      }}>
        {weekOffset !== 0 ? (
          <button
            onClick={() => setWeekOffset(0)}
            aria-label="Jump to today"
            style={{
              minHeight: 56, minWidth: 56,
              padding: `0 ${spacing['3']}`,
              display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
              background: colors.surfaceRaised,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.base, cursor: 'pointer',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}
          >
            Today
          </button>
        ) : (
          <span style={{ fontSize: 11, color: colors.textTertiary }}>
            {'Swipe or tap arrows to shift window \u00b7 pinch to zoom'}
          </span>
        )}
        <div style={{ display: 'flex', gap: spacing['1'] }}>
          <button
            onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))}
            aria-label="Zoom out"
            style={{
              width: 56, height: 56,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.base, cursor: 'pointer',
              color: colors.textSecondary,
            }}
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
            aria-label="Zoom in"
            style={{
              width: 56, height: 56,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.base, cursor: 'pointer',
              color: colors.textSecondary,
            }}
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {lookahead.length === 0 && (
        <div style={{
          padding: `${spacing['2xl']} ${spacing['4']}`,
          textAlign: 'center',
          color: colors.textTertiary,
          fontSize: typography.fontSize.sm,
        }}>
          No activities scheduled in this window.
        </div>
      )}

      {/* Zoomable content region — CSS `zoom` scales layout without breaking
          sticky positioning, unlike transform:scale. Wide browser support now. */}
      <div
        style={{
          // Cast via React.CSSProperties — `zoom` is valid CSS but not in the
          // default TS React.CSSProperties shape; the cast keeps tsc happy.
          ...( { zoom } as React.CSSProperties ),
          transition: pinchRef.current.active ? 'none' : 'zoom 120ms ease-out',
        }}
      >

      {/* Week sections */}
      {weeks.map((week, wi) => {
        if (week.phases.length === 0) return null;
        const weekEndDisplay = addDays(week.end, -1);
        return (
          <div key={week.label}>
            {/* Sticky week header */}
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: '#ffffff',
              borderBottom: `1px solid ${colors.borderDefault}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${spacing['2']} ${spacing['4']}`,
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: typography.fontWeight.semibold,
                color: wi === 0 ? colors.primaryOrange : colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {week.label}
                {wi === 0 && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: typography.fontWeight.semibold,
                    backgroundColor: `${colors.primaryOrange}18`,
                    color: colors.primaryOrange,
                    padding: '1px 6px',
                    borderRadius: borderRadius.full,
                    letterSpacing: 0,
                    textTransform: 'none',
                  }}>
                    Current
                  </span>
                )}
              </span>
              <span style={{ fontSize: 11, color: colors.textTertiary }}>
                {fmtDate(week.start)} {'\u2013'} {fmtDate(weekEndDisplay)}
              </span>
            </div>

            {/* Activity cards */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['4']} ${spacing['3']}`,
            }}>
              {week.phases.map(phase => (
                <ActivityCard
                  key={phase.id}
                  phase={phase}
                  risk={risks.find(r => r.phaseId === phase.id)}
                  onMarkInProgress={() => handleMarkInProgress(phase)}
                />
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};
