import React, { useState, useMemo, useRef, useEffect, useId, useCallback } from 'react';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import { CalendarDays, GitBranch, Sparkles, Zap } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import type { PredictedRisk, PredictedDelay } from '../../lib/predictions';
import type { MappedSchedulePhase } from '../../types/entities';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { AIAnnotationIndicator } from '../ai/AIAnnotation';
import { getAnnotationsForEntity } from '../../data/aiAnnotations';

export type TimeScale = 'month' | 'quarter';

const ROW_HEIGHT = 40; // 32px bar + 8px margin
const DAY_MS = 86_400_000;
const LABEL_WIDTH = 170;
const SLIPPAGE_COL_WIDTH = 72;
const FLOAT_COL_WIDTH = 84;

function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export type GanttPhase = MappedSchedulePhase;

interface DragState {
  phaseId: string;
  side: 'start' | 'end' | 'both';
  startX: number;
  origStart: number;
  origEnd: number;
}

export interface GanttDependency {
  fromId: string;
  toId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
}

interface GanttChartProps {
  phases: GanttPhase[];
  whatIfMode: boolean;
  isLoading?: boolean;
  onImportSchedule?: () => void;
  onAddActivity?: () => void;
  onPhaseClick?: (phase: GanttPhase) => void;
  onPhaseDrag?: (phaseId: string, newEndDate: string) => void;
  onPhaseUpdate?: (id: string, update: { start_date: string; end_date: string }) => void;
  onActivityDateChange?: (id: string, start: string, finish: string) => void;
  baselinePhases?: GanttPhase[];
  showBaseline?: boolean;
  risks?: PredictedRisk[];
  delays?: PredictedDelay[];
  dependencies?: GanttDependency[];
}

const SKELETON_ROW_WIDTHS = ['70%', '55%', '85%', '40%', '90%', '60%', '75%', '45%'];

export const GanttChart: React.FC<GanttChartProps> = ({
  phases,
  whatIfMode,
  isLoading = false,
  onImportSchedule,
  onAddActivity,
  onPhaseClick,
  onPhaseDrag: _onPhaseDrag,
  onPhaseUpdate,
  onActivityDateChange,
  baselinePhases,
  showBaseline: showBaselineProp,
  risks = [],
  delays = [],
  dependencies = [],
}) => {
  const uid = useId().replace(/:/g, '');

  const [timeScale, setTimeScale] = useState<TimeScale>('quarter');
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);
  const [showBaselineInternal, setShowBaselineInternal] = useState(true);
  const showBaseline = showBaselineProp !== undefined ? showBaselineProp : showBaselineInternal;
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [riskTooltipPhase, setRiskTooltipPhase] = useState<string | null>(null);
  const [delayTooltipPhase, setDelayTooltipPhase] = useState<string | null>(null);
  const [localPhases, setLocalPhases] = useState<GanttPhase[]>(phases);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trackWidth, setTrackWidth] = useState(0);

  const probeRef = useRef<HTMLDivElement>(null);
  const trackWidthRef = useRef(0);
  const ganttGridRef = useRef<HTMLDivElement>(null);
  const activityChangeDebouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { focusedIndex: ganttFocused, handleKeyDown: ganttHandleKeyDown, activeRowId: ganttActiveRowId } = useTableKeyboardNavigation({
    rowCount: localPhases.length,
    onActivate: useCallback((i: number) => onPhaseClick?.(localPhases[i]), [localPhases, onPhaseClick]),
    onToggleSelect: useCallback((i: number) => {
      const id = localPhases[i]?.id;
      if (!id) return;
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }, [localPhases]),
    rowIdPrefix: `${uid}-gantt`,
  });

  useEffect(() => {
    if (ganttGridRef.current?.contains(document.activeElement)) {
      const row = ganttGridRef.current.querySelector<HTMLElement>(`[data-gantt-index="${ganttFocused}"]`);
      row?.focus({ preventScroll: false });
    }
  }, [ganttFocused]);

  // Measure the track column width
  useEffect(() => {
    if (!probeRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setTrackWidth(w);
      trackWidthRef.current = w;
    });
    ro.observe(probeRef.current);
    return () => ro.disconnect();
  }, []);

  // Sync localPhases from props, preserving pending edits
  useEffect(() => {
    setLocalPhases(prev =>
      phases.map(p => {
        const local = prev.find(lp => lp.id === p.id);
        return local && pendingIds.has(p.id) ? local : p;
      }),
    );
  // pendingIds intentionally omitted: we only want to re-sync when phases changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases]);

  // Timeline anchors always from original props so the ruler stays fixed during drag
  const allStarts = phases.map(p => new Date(p.startDate).getTime());
  const allEnds = phases.map(p => new Date(p.endDate).getTime());
  const timelineStart = Math.min(...allStarts);
  const timelineEnd = Math.max(...allEnds);
  const timelineSpan = timelineEnd - timelineStart;

  const timelineSpanRef = useRef(timelineSpan);
  useEffect(() => { timelineSpanRef.current = timelineSpan; }, [timelineSpan]);

  // Global drag listeners — recreated whenever activeDrag changes
  useEffect(() => {
    if (!activeDrag) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e
        ? (e as TouchEvent).touches[0].clientX
        : (e as MouseEvent).clientX;
      const dx = clientX - activeDrag.startX;
      const pxPerMs = trackWidthRef.current / timelineSpanRef.current;
      if (!pxPerMs) return;
      const deltaMs = Math.round(dx / pxPerMs / DAY_MS) * DAY_MS;
      setLocalPhases(prev => prev.map(p => {
        if (p.id !== activeDrag.phaseId) return p;
        let newStart = activeDrag.origStart;
        let newEnd = activeDrag.origEnd;
        if (activeDrag.side === 'start') {
          newStart = Math.min(activeDrag.origStart + deltaMs, activeDrag.origEnd - DAY_MS);
        } else if (activeDrag.side === 'end') {
          newEnd = Math.max(activeDrag.origEnd + deltaMs, activeDrag.origStart + DAY_MS);
        } else {
          newStart = activeDrag.origStart + deltaMs;
          newEnd = activeDrag.origEnd + deltaMs;
        }
        return { ...p, startDate: toISO(newStart), endDate: toISO(newEnd) };
      }));
    };

    const onUp = (e: MouseEvent | TouchEvent) => {
      setPendingIds(s => new Set([...s, activeDrag.phaseId]));
      if (activeDrag.side === 'both' && onActivityDateChange) {
        const clientX = 'changedTouches' in e
          ? (e as TouchEvent).changedTouches[0]?.clientX ?? activeDrag.startX
          : (e as MouseEvent).clientX;
        const dx = clientX - activeDrag.startX;
        const pxPerMs = trackWidthRef.current / timelineSpanRef.current;
        const deltaMs = pxPerMs ? Math.round(dx / pxPerMs / DAY_MS) * DAY_MS : 0;
        const newStart = toISO(activeDrag.origStart + deltaMs);
        const newFinish = toISO(activeDrag.origEnd + deltaMs);
        if (activityChangeDebouncerRef.current) clearTimeout(activityChangeDebouncerRef.current);
        activityChangeDebouncerRef.current = setTimeout(() => {
          onActivityDateChange(activeDrag.phaseId, newStart, newFinish);
        }, 300);
      }
      setActiveDrag(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [activeDrag]);

  const hasBaselineData = phases.some(p => p.baselineStartDate != null && p.baselineEndDate != null);
  const today = new Date();
  const todayOffset = ((today.getTime() - timelineStart) / timelineSpan) * 100;

  const timeLabels = useMemo(() => {
    const labels: { label: string; offset: number }[] = [];
    const start = new Date(timelineStart);
    const end = new Date(timelineEnd);
    if (timeScale === 'month') {
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      while (d <= end) {
        const offset = ((d.getTime() - timelineStart) / timelineSpan) * 100;
        labels.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), offset });
        d.setMonth(d.getMonth() + 1);
      }
    } else {
      const d = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
      while (d <= end) {
        const q = Math.floor(d.getMonth() / 3) + 1;
        const offset = ((d.getTime() - timelineStart) / timelineSpan) * 100;
        labels.push({ label: `Q${q} ${d.getFullYear()}`, offset });
        d.setMonth(d.getMonth() + 3);
      }
    }
    return labels;
  }, [timelineStart, timelineEnd, timelineSpan, timeScale]);

  const resourceData = useMemo(() => {
    const buckets = 20;
    const bucketWidth = timelineSpan / buckets;
    return Array.from({ length: buckets }).map((_, i) => {
      const bucketStart = timelineStart + i * bucketWidth;
      const bucketEnd = bucketStart + bucketWidth;
      let count = 0;
      phases.forEach(p => {
        const ps = new Date(p.startDate).getTime();
        const pe = new Date(p.endDate).getTime();
        if (ps < bucketEnd && pe > bucketStart && !p.completed) {
          count += p.resources ?? Math.ceil(p.progress / 20) + 1;
        }
      });
      return count;
    });
  }, [phases, timelineStart, timelineSpan]);

  const maxResource = Math.max(...resourceData, 1);

  const getPhasePos = (phase: GanttPhase) => {
    const s = new Date(phase.startDate).getTime();
    const e = new Date(phase.endDate).getTime();
    return {
      left: ((s - timelineStart) / timelineSpan) * 100,
      width: ((e - s) / timelineSpan) * 100,
    };
  };

  const getBarColor = (phase: GanttPhase) => {
    if (phase.completed) return colors.statusActive;
    if (whatIfMode && activeDrag?.phaseId === phase.id) return colors.statusReview;
    if (phase.is_critical || phase.critical) return '#E74C3C';
    if (phase.progress === 0) return colors.textTertiary;
    return colors.statusInfo;
  };

  // Dependency arrows: cubic bezier paths in pixel space
  const dependencyArrows = useMemo(() => {
    if (trackWidth === 0) return [];
    const arrows: { key: string; d: string; isCritical: boolean }[] = [];
    localPhases.forEach((succPhase, succIdx) => {
      const predIds = succPhase.predecessor_ids ?? succPhase.dependencies ?? [];
      predIds.forEach(predId => {
        const predIdx = localPhases.findIndex(p => p.id === predId);
        if (predIdx === -1) return;
        const predPhase = localPhases[predIdx];
        const predPos = getPhasePos(predPhase);
        const succPos = getPhasePos(succPhase);
        const x1 = ((predPos.left + predPos.width) / 100) * trackWidth;
        const x2 = (succPos.left / 100) * trackWidth;
        const y1 = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const y2 = succIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const midX = (x1 + x2) / 2;
        arrows.push({
          key: `${predId}-${succPhase.id}`,
          d: `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`,
          isCritical: predPhase.critical && succPhase.critical,
        });
      });
    });
    return arrows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPhases, trackWidth, timelineStart, timelineSpan]);

  // Typed dependency arrows from the `dependencies` prop (FS, SS, FF, SF)
  const typedDependencyArrows = useMemo(() => {
    if (trackWidth === 0 || dependencies.length === 0) return [];
    return dependencies.map(dep => {
      const fromIdx = localPhases.findIndex(p => p.id === dep.fromId);
      const toIdx = localPhases.findIndex(p => p.id === dep.toId);
      if (fromIdx === -1 || toIdx === -1) return null;
      const fromPos = getPhasePos(localPhases[fromIdx]);
      const toPos = getPhasePos(localPhases[toIdx]);
      const y1 = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const y2 = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      let x1: number;
      let x2: number;
      if (dep.type === 'FS') {
        x1 = ((fromPos.left + fromPos.width) / 100) * trackWidth;
        x2 = (toPos.left / 100) * trackWidth;
      } else if (dep.type === 'SS') {
        x1 = (fromPos.left / 100) * trackWidth;
        x2 = (toPos.left / 100) * trackWidth;
      } else if (dep.type === 'FF') {
        x1 = ((fromPos.left + fromPos.width) / 100) * trackWidth;
        x2 = ((toPos.left + toPos.width) / 100) * trackWidth;
      } else {
        // SF
        x1 = (fromPos.left / 100) * trackWidth;
        x2 = ((toPos.left + toPos.width) / 100) * trackWidth;
      }
      const midX = (x1 + x2) / 2;
      return {
        key: `typed-${dep.fromId}-${dep.toId}-${dep.type}`,
        d: `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`,
        type: dep.type,
      };
    }).filter(Boolean) as { key: string; d: string; type: string }[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencies, localPhases, trackWidth, timelineStart, timelineSpan]);


  const startDrag = (
    e: React.MouseEvent | React.TouchEvent,
    phaseId: string,
    side: 'start' | 'end' | 'both',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const phase = localPhases.find(p => p.id === phaseId);
    if (!phase) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setActiveDrag({
      phaseId,
      side,
      startX: clientX,
      origStart: new Date(phase.startDate).getTime(),
      origEnd: new Date(phase.endDate).getTime(),
    });
  };

  const handleBarKeyDown = (e: React.KeyboardEvent, phase: GanttPhase) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const days = e.shiftKey ? 7 : 1;
    const delta = (e.key === 'ArrowLeft' ? -1 : 1) * days * DAY_MS;
    setLocalPhases(prev => prev.map(p => {
      if (p.id !== phase.id) return p;
      return {
        ...p,
        startDate: toISO(new Date(p.startDate).getTime() + delta),
        endDate: toISO(new Date(p.endDate).getTime() + delta),
      };
    }));
    setPendingIds(s => new Set([...s, phase.id]));
    const dir = e.key === 'ArrowLeft' ? 'back' : 'forward';
    setAnnouncement(`${phase.name} shifted ${dir} ${days} ${days === 1 ? 'day' : 'days'}`);
  };

  const handleSave = () => {
    pendingIds.forEach(id => {
      const phase = localPhases.find(p => p.id === id);
      if (phase) {
        onPhaseUpdate?.(id, { start_date: phase.startDate, end_date: phase.endDate });
      }
    });
    setPendingIds(new Set());
  };

  const handleDiscard = () => {
    setLocalPhases(phases);
    setPendingIds(new Set());
  };

  return (
    <div role="region" aria-label="Project Schedule Gantt Chart">
      {/* Visually hidden summary for screen readers */}
      {localPhases.length > 0 && (
        <p style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden', margin: 0 }}>
          {`Schedule contains ${localPhases.length} activities. ${localPhases.filter(p => p.critical).length} are on the critical path. Projected completion: ${new Date(Math.max(...localPhases.map(p => new Date(p.endDate).getTime()))).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`}
        </p>
      )}
      {/* Tablet touch target overrides: min 32px bar, 44px touch wrapper */}
      <style>{`
        @media (min-width: 768px) and (max-width: 1279px) {
          .gantt-phase-row { min-height: 44px !important; }
          .gantt-phase-track { min-height: 44px !important; }
        }
      `}</style>
      {/* Unsaved changes banner */}
      {pendingIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['2']} ${spacing['4']}`, marginBottom: spacing['3'],
          backgroundColor: '#FFFBEB', border: '1px solid #FCD34D',
          borderRadius: borderRadius.md,
        }}>
          <span style={{ fontSize: typography.fontSize.sm, color: '#92400E', fontWeight: typography.fontWeight.medium }}>
            Unsaved changes
          </span>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <button
              onClick={handleDiscard}
              style={{
                padding: `${spacing['1']} ${spacing['3']}`, border: '1px solid #FCD34D',
                borderRadius: borderRadius.sm, backgroundColor: 'transparent',
                color: '#92400E', fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily, cursor: 'pointer',
              }}
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: `${spacing['1']} ${spacing['3']}`, border: 'none',
                borderRadius: borderRadius.sm, backgroundColor: '#F59E0B',
                color: '#fff', fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily, cursor: 'pointer',
                fontWeight: typography.fontWeight.medium,
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* aria-live region for keyboard announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
      >
        {announcement}
      </div>

      {/* Loading skeleton rows */}
      {isLoading && (
        <>
          <style>{`@keyframes ganttPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>
          {SKELETON_ROW_WIDTHS.map((rowWidth, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: i === 0 ? 0 : '8px' }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: `${LABEL_WIDTH}px`,
                  height: '32px',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '4px',
                  animation: 'ganttPulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.08}s`,
                }}
              />
              <div
                style={{
                  width: rowWidth,
                  height: '32px',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '4px',
                  animation: 'ganttPulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.08 + 0.05}s`,
                }}
              />
            </div>
          ))}
        </>
      )}

      {/* Empty state */}
      {!isLoading && phases.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No schedule activities yet"
          description="Import a schedule from Primavera P6 or MS Project, or create your first activity to start tracking progress against your baseline."
          action={{ label: 'Import Schedule', onClick: onImportSchedule ?? (() => {}) }}
          secondaryAction={{ label: 'Add Activity', onClick: onAddActivity ?? (() => {}) }}
        />
      )}

      {/* Controls */}
      {!isLoading && phases.length > 0 && (<>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
          {(['month', 'quarter'] as TimeScale[]).map(scale => (
            <button
              key={scale}
              aria-label={`View by ${scale}`}
              aria-pressed={timeScale === scale}
              onClick={() => setTimeScale(scale)}
              style={{
                padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                backgroundColor: timeScale === scale ? colors.surfaceRaised : 'transparent',
                color: timeScale === scale ? colors.textPrimary : colors.textTertiary,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily, cursor: 'pointer',
                boxShadow: timeScale === scale ? shadows.sm : 'none',
                textTransform: 'capitalize',
              }}
            >
              {scale}
            </button>
          ))}
        </div>

        {showBaselineProp === undefined && (
          <button
            aria-label={showBaseline ? 'Hide baseline schedule' : 'Show baseline schedule'}
            aria-pressed={showBaseline}
            onClick={() => setShowBaselineInternal(!showBaselineInternal)}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
              backgroundColor: showBaseline ? `${colors.statusInfo}14` : 'transparent',
              color: showBaseline ? colors.statusInfo : colors.textTertiary,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily, cursor: 'pointer',
            }}
          >
            <GitBranch size={12} /> {showBaseline ? 'Hide Baseline' : 'Show Baseline'}
          </button>
        )}

        <button
          aria-label={showCriticalPath ? 'Show all activities' : 'Filter to critical path only'}
          aria-pressed={showCriticalPath}
          onClick={() => setShowCriticalPath(!showCriticalPath)}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.full,
            border: showCriticalPath ? '1px solid #E74C3C' : '1px solid transparent',
            backgroundColor: showCriticalPath ? '#E74C3C14' : 'transparent',
            color: showCriticalPath ? '#E74C3C' : colors.textTertiary,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily, cursor: 'pointer',
          }}
        >
          Critical Path Only
        </button>

        {whatIfMode && (
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.semibold }}>
            <Sparkles size={12} /> What If Mode: Drag tasks to see cascade effects
          </span>
        )}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing['3'], flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Baseline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 16, height: 6, borderRadius: 2, backgroundColor: '#9CA3AF', opacity: 0.3 }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Baseline</span>
          </div>
          {/* Actual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 16, height: 6, borderRadius: 2, backgroundColor: colors.primaryOrange }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Actual</span>
          </div>
          {/* Critical Path */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 16, height: 12, borderLeft: '3px solid #E74C3C', paddingLeft: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 2, backgroundColor: colors.statusCritical, opacity: 0.3 }} />
            </div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Critical Path</span>
          </div>
          {/* Float */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 10, height: 6, borderRadius: '2px 0 0 2px', backgroundColor: colors.statusInfo }} />
              <div style={{ width: 8, height: 6, borderRadius: '0 2px 2px 0', backgroundColor: colors.statusInfo, opacity: 0.15 }} />
            </div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Float</span>
          </div>
        </div>
      </div>

      {/* No-baseline banner */}
      {showBaseline && !hasBaselineData && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
          backgroundColor: `${colors.statusPending}10`, borderRadius: borderRadius.md,
          border: `1px solid ${colors.statusPending}30`,
        }}>
          <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending }}>
            No baseline set. Click Set Baseline to snapshot current schedule.
          </span>
        </div>
      )}

      {/* Timeline */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '900px' }}>

          {/* Time labels header + width probe */}
          <div style={{ display: 'flex', paddingLeft: `${LABEL_WIDTH}px`, marginBottom: spacing['2'] }}>
            <div ref={probeRef} style={{ flex: 1, position: 'relative', height: 20 }}>
              {timeLabels.map(tl => (
                <span
                  key={tl.label + tl.offset}
                  style={{
                    position: 'absolute', left: `${tl.offset}%`, transform: 'translateX(-50%)',
                    fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap',
                  }}
                >
                  {tl.label}
                </span>
              ))}
            </div>
            <div style={{
              width: SLIPPAGE_COL_WIDTH, flexShrink: 0, textAlign: 'right',
              paddingRight: spacing['2'], height: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                Slip
              </span>
            </div>
            <div style={{
              width: FLOAT_COL_WIDTH, flexShrink: 0, textAlign: 'right',
              paddingRight: spacing['2'], height: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                Float
              </span>
            </div>
          </div>

          {/* Phase rows + SVG dependency overlay */}
          <div
            ref={ganttGridRef}
            id="gantt-activities"
            role="grid"
            aria-label="Project Schedule Gantt Chart"
            aria-rowcount={localPhases.length}
            aria-activedescendant={ganttActiveRowId}
            tabIndex={0}
            onKeyDown={ganttHandleKeyDown}
            onFocus={(e) => {
              if (e.target === e.currentTarget) {
                const row = e.currentTarget.querySelector<HTMLElement>(`[data-gantt-index="${ganttFocused}"]`);
                row?.focus();
              }
            }}
            style={{ position: 'relative', outline: 'none' }}
          >
            {/* Visually hidden caption — read by screen readers as grid description */}
            <p style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden', margin: 0 }}>
              Project schedule. Use J and K to navigate activities, Enter to open details.
            </p>

            {/* Visually hidden header row so screen readers announce column names */}
            <div role="row" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
              <div role="columnheader" style={{}}>Activity</div>
              <div role="columnheader" style={{}}>Schedule</div>
              <div role="columnheader" style={{}}>Slippage</div>
              <div role="columnheader" style={{}}>Float</div>
            </div>

            {/* SVG overlay for dependency arrows */}
            {(dependencyArrows.length > 0 || typedDependencyArrows.length > 0) && (
              <svg
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: LABEL_WIDTH,
                  top: 0,
                  width: `calc(100% - ${LABEL_WIDTH}px)`,
                  height: localPhases.length * ROW_HEIGHT,
                  pointerEvents: 'none',
                  overflow: 'visible',
                  zIndex: 5,
                }}
              >
                <defs>
                  <marker
                    id={`arr-nc-${uid}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" fill="#9CA3AF" />
                  </marker>
                  <marker
                    id={`arr-crit-${uid}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" fill="#E74C3C" />
                  </marker>
                  <marker
                    id={`arr-typed-${uid}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" fill="#9CA3AF" />
                  </marker>
                </defs>
                {dependencyArrows.map(arrow => (
                  <path
                    key={arrow.key}
                    d={arrow.d}
                    stroke={arrow.isCritical ? '#E74C3C' : '#9CA3AF'}
                    strokeWidth="1.5"
                    fill="none"
                    opacity={arrow.isCritical ? 0.9 : 0.7}
                    markerEnd={`url(#${arrow.isCritical ? `arr-crit-${uid}` : `arr-nc-${uid}`})`}
                  />
                ))}
                {typedDependencyArrows.map(arrow => (
                  <path
                    key={arrow.key}
                    d={arrow.d}
                    stroke="#6B7280"
                    strokeWidth="1.5"
                    fill="none"
                    opacity={0.7}
                    strokeDasharray={arrow.type === 'SS' || arrow.type === 'FF' ? '4 3' : undefined}
                    markerEnd={`url(#arr-typed-${uid})`}
                  />
                ))}
              </svg>
            )}

            {/* Phase rows */}
            <div role="rowgroup">
            {localPhases.map((phase, index) => {
              const pos = getPhasePos(phase);
              const barColor = getBarColor(phase);
              const isHovered = hoveredPhase === phase.id;
              const predIds = phase.predecessor_ids ?? phase.dependencies ?? [];
              const isCascadeAffected = whatIfMode && activeDrag && predIds.includes(activeDrag.phaseId);
              const isCriticalPathRow = phase.is_critical;
              const phaseRisk = risks.find(r => r.phaseId === phase.id);
              const phaseDelay = delays.find(d => d.activityId === phase.id && d.predictedSlippageDays > 0);
              const isDraggingThis = activeDrag?.phaseId === phase.id;
              const isDraggingBoth = isDraggingThis && activeDrag?.side === 'both';
              const canDrag = !phase.completed && !phase.is_milestone;
              const ghostLeft = isDraggingBoth
                ? ((activeDrag!.origStart - timelineStart) / timelineSpan) * 100
                : null;
              const ghostWidth = isDraggingBoth
                ? (((activeDrag!.origEnd - activeDrag!.origStart) / timelineSpan) * 100)
                : null;

              return (
                <div
                  key={phase.id}
                  id={`${uid}-gantt-row-${index}`}
                  data-gantt-index={index}
                  role="row"
                  aria-rowindex={index + 1}
                  aria-selected={selectedIds.has(phase.id)}
                  aria-label={`${phase.name}: ${new Date(phase.startDate).toLocaleDateString()} to ${new Date(phase.endDate).toLocaleDateString()}, ${phase.progress}% complete${phase.floatDays != null ? `, ${phase.floatDays} days float` : ''}${phase.critical ? ', critical path' : ''}`}
                  tabIndex={ganttFocused === index ? 0 : -1}
                  className="gantt-phase-row"
                  style={{
                    display: showCriticalPath && !phase.is_critical ? 'none' : 'flex',
                    alignItems: 'center', marginBottom: spacing['2'], position: 'relative',
                    borderLeft: isCriticalPathRow ? '3px solid #E74C3C' : '3px solid transparent',
                    paddingLeft: isCriticalPathRow ? spacing['2'] : 0,
                    outline: 'none',
                  }}
                  onMouseEnter={() => setHoveredPhase(phase.id)}
                  onMouseLeave={() => setHoveredPhase(null)}
                  onFocus={e => { setHoveredPhase(phase.id); e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primaryOrange}50`; }}
                  onBlur={e => { setHoveredPhase(null); e.currentTarget.style.boxShadow = 'none'; }}
                  onKeyDown={e => handleBarKeyDown(e, phase)}
                >
                  {/* Label */}
                  <div role="gridcell" style={{ width: `${LABEL_WIDTH}px`, flexShrink: 0, paddingRight: spacing['3'] }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {phase.is_critical && !phase.completed && (
                        <span style={{
                          fontSize: '10px', fontWeight: 700,
                          backgroundColor: '#E74C3C', color: '#fff',
                          padding: '0 4px', borderRadius: '3px',
                          lineHeight: '16px', flexShrink: 0,
                        }}>CP</span>
                      )}
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                        {phase.name}
                      </span>
                      {getAnnotationsForEntity('schedule_phase', phase.id).map(ann => (
                        <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                      ))}
                      {phaseRisk && (
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            aria-label={`Risk: ${phaseRisk.likelihoodPercent}% likelihood, ${phaseRisk.impactDays} day impact. ${phaseRisk.reason}`}
                            onMouseEnter={e => { e.stopPropagation(); setRiskTooltipPhase(phase.id); }}
                            onMouseLeave={() => setRiskTooltipPhase(null)}
                            onFocus={() => setRiskTooltipPhase(phase.id)}
                            onBlur={() => setRiskTooltipPhase(null)}
                            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            <Zap size={12} color={colors.primaryOrange} fill={colors.primaryOrange} />
                          </button>
                          {riskTooltipPhase === phase.id && (
                            <div style={{
                              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                              marginBottom: 6, padding: `${spacing['2']} ${spacing['3']}`,
                              backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md,
                              boxShadow: shadows.dropdown, zIndex: 20,
                              width: 240, pointerEvents: 'none',
                            }}>
                              <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, fontSize: typography.fontSize.caption }}>
                                {phaseRisk.likelihoodPercent}% likely, +{phaseRisk.impactDays}d impact
                              </p>
                              <p style={{ margin: 0, marginTop: 3, fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                                {phaseRisk.reason}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: 2 }}>
                      {!phase.is_milestone && (
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{phase.progress}%</span>
                      )}
                      {phase.floatDays != null && (
                        <span style={{
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          backgroundColor: phase.floatDays === 0 ? `${colors.statusCritical}18` : `${colors.statusInfo}12`,
                          color: phase.floatDays === 0 ? colors.statusCritical : colors.statusInfo,
                          padding: `0 4px`, borderRadius: borderRadius.sm, lineHeight: '16px',
                        }}>
                          {phase.floatDays}d float
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Track */}
                  <div
                    className="gantt-phase-track"
                    style={{
                      flex: 1, height: 32, position: 'relative',
                      backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm,
                      cursor: isDraggingBoth ? 'grabbing' : isDraggingThis ? 'col-resize' : 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => { if (!isDraggingThis) onPhaseClick?.(phase); }}
                  >
                    {/* Baseline bar */}
                    {showBaseline && (() => {
                      const bStart = phase.baselineStartDate ?? (baselinePhases?.find(b => b.id === phase.id)?.baselineStartDate ?? null);
                      const bEnd = phase.baselineEndDate ?? (baselinePhases?.find(b => b.id === phase.id)?.baselineEndDate ?? null);
                      if (!bStart || !bEnd) return null;
                      const bLeft = ((new Date(bStart).getTime() - timelineStart) / timelineSpan) * 100;
                      const bWidth = ((new Date(bEnd).getTime() - new Date(bStart).getTime()) / timelineSpan) * 100;
                      return (
                        <div aria-hidden="true" style={{
                          position: 'absolute', top: 4, bottom: 4,
                          left: `${bLeft}%`, width: `${bWidth}%`,
                          backgroundColor: '#9CA3AF', opacity: 0.3,
                          borderRadius: borderRadius.sm, pointerEvents: 'none',
                          zIndex: 0,
                        }} />
                      );
                    })()}

                    {/* Ghost bar shown at original position during whole-bar drag */}
                    {isDraggingBoth && ghostLeft !== null && ghostWidth !== null && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute', top: 4, bottom: 4,
                          left: `${ghostLeft}%`, width: `${ghostWidth}%`,
                          borderRadius: borderRadius.sm,
                          border: `2px dashed ${colors.textTertiary}`,
                          backgroundColor: `${colors.textTertiary}18`,
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      />
                    )}

                    {/* Milestone diamond */}
                    {phase.is_milestone ? (
                      <div
                        role="img"
                        aria-label={`${phase.name}: ${phase.startDate} to ${phase.endDate}, milestone${phase.critical || phase.is_critical ? ', CRITICAL PATH' : ''}`}
                        style={{
                          position: 'absolute',
                          left: `${pos.left}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          width: 14, height: 14,
                          backgroundColor: colors.primaryOrange,
                          zIndex: 2,
                        }}
                      />
                    ) : null}
                    {/* Milestone label to the right of the diamond */}
                    {phase.is_milestone && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: `calc(${pos.left}% + 12px)`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.primaryOrange,
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          zIndex: 3,
                        }}
                      >
                        {phase.name}
                      </span>
                    )}
                    {!phase.is_milestone && (() => {
                      const barStatus = phase.completed
                        ? 'complete'
                        : (phase.slippageDays ?? 0) > 0
                          ? 'delayed'
                          : phase.critical || phase.is_critical
                            ? 'critical path'
                            : 'on track';
                      const fmtDate = (d: string) =>
                        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      return (
                      /* Regular phase bar */
                      <div
                        role="gridcell"
                        data-gantt-bar="true"
                        aria-label={`${phase.name}, ${fmtDate(phase.startDate)} to ${fmtDate(phase.endDate)}, ${phase.progress}% complete, ${barStatus}`}
                        tabIndex={0}
                        onMouseDown={canDrag ? e => startDrag(e, phase.id, 'both') : undefined}
                        onTouchStart={canDrag ? e => startDrag(e, phase.id, 'both') : undefined}
                        style={{
                          position: 'absolute', top: 4, bottom: 4,
                          left: `${pos.left}%`, width: `${pos.width}%`,
                          borderRadius: borderRadius.sm, overflow: 'visible',
                          border: isCascadeAffected ? `2px dashed ${colors.statusReview}` : 'none',
                          boxShadow: isHovered ? `0 0 0 2px ${barColor}30` : 'none',
                          opacity: isDraggingBoth ? 0.75 : 1,
                          transition: isDraggingThis ? 'none' : `box-shadow ${transitions.instant}`,
                          outline: 'none',
                          cursor: isDraggingBoth ? 'grabbing' : canDrag ? 'grab' : 'pointer',
                        }}
                        onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${barColor}60`; }}
                        onBlur={e => { e.currentTarget.style.boxShadow = isHovered ? `0 0 0 2px ${barColor}30` : 'none'; }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onPhaseClick?.(phase);
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            ganttGridRef.current
                              ?.querySelector<HTMLElement>(`[data-gantt-index="${index + 1}"]`)
                              ?.querySelector<HTMLElement>('[data-gantt-bar]')
                              ?.focus();
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            ganttGridRef.current
                              ?.querySelector<HTMLElement>(`[data-gantt-index="${index - 1}"]`)
                              ?.querySelector<HTMLElement>('[data-gantt-bar]')
                              ?.focus();
                          }
                        }}
                      >
                        {/* Bar fill */}
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: barColor, opacity: 0.25, borderRadius: borderRadius.sm }} />
                        {/* Progress fill */}
                        <div
                          role="progressbar"
                          aria-valuenow={phase.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${phase.name} progress`}
                          style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${phase.progress}%`, backgroundColor: barColor, borderRadius: borderRadius.sm }}
                        />

                        {/* Float extension bar */}
                        {phase.floatDays > 0 && (
                          <div
                            aria-hidden="true"
                            style={{
                              position: 'absolute', top: 0, bottom: 0,
                              left: '100%',
                              width: `${(phase.floatDays * DAY_MS / timelineSpan) * 100}%`,
                              backgroundColor: barColor,
                              opacity: 0.12,
                              borderRadius: `0 ${borderRadius.sm} ${borderRadius.sm} 0`,
                              pointerEvents: 'none',
                            }}
                          />
                        )}

                        {/* Slippage badge */}
                        {(phase.slippageDays ?? 0) > 0 && (
                          <div style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            backgroundColor: colors.statusCritical, color: '#fff',
                            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                            padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm,
                            lineHeight: '16px', whiteSpace: 'nowrap', pointerEvents: 'none',
                          }}>
                            +{phase.slippageDays}d
                          </div>
                        )}

                        {/* Predicted delay warning badge */}
                        {phaseDelay && (
                          <div style={{
                            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                            zIndex: 3,
                          }}>
                            <button
                              aria-label={`Predicted delay: ${phaseDelay.predictedSlippageDays} day${phaseDelay.predictedSlippageDays > 1 ? 's' : ''} slippage. ${phaseDelay.reasons.join('. ')}`}
                              onMouseEnter={e => { e.stopPropagation(); setDelayTooltipPhase(phase.id); }}
                              onMouseLeave={() => setDelayTooltipPhase(null)}
                              onFocus={() => setDelayTooltipPhase(phase.id)}
                              onBlur={() => setDelayTooltipPhase(null)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 2,
                                backgroundColor: '#FEF08A', border: '1px solid #CA8A04',
                                borderRadius: 3, padding: '0 4px', lineHeight: '16px',
                                fontSize: 10, fontWeight: 700, color: '#92400E',
                                cursor: 'pointer', whiteSpace: 'nowrap',
                                fontFamily: 'inherit',
                              }}
                            >
                              {`\u26A0 +${phaseDelay.predictedSlippageDays}d`}
                            </button>
                            {delayTooltipPhase === phase.id && (
                              <div style={{
                                position: 'absolute', bottom: '100%', left: 0,
                                marginBottom: 6, padding: '8px 12px',
                                backgroundColor: '#FEFCE8', border: '1px solid #CA8A04',
                                borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                zIndex: 20, width: 260, pointerEvents: 'none',
                              }}>
                                <p style={{ margin: 0, fontWeight: 700, color: '#92400E', fontSize: 11 }}>
                                  {`Predicted delay: +${phaseDelay.predictedSlippageDays}d`}
                                </p>
                                <ul style={{ margin: '4px 0 0', paddingLeft: 14, fontSize: 11, color: '#713F12', lineHeight: 1.5 }}>
                                  {phaseDelay.reasons.map((r, ri) => (
                                    <li key={ri}>{r}</li>
                                  ))}
                                </ul>
                                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#78350F', fontStyle: 'italic' }}>
                                  {phaseDelay.suggestedAction}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Completion end-cap diamond */}
                        {phase.progress === 100 && (
                          <div style={{
                            position: 'absolute', right: -5, top: '50%', width: 10, height: 10,
                            backgroundColor: colors.statusActive, transform: 'translateY(-50%) rotate(45deg)',
                            border: `2px solid ${colors.surfaceRaised}`,
                          }} />
                        )}

                        {/* Left drag handle */}
                        {canDrag && (
                          <div
                            role="button"
                            tabIndex={0}
                            aria-label={`Adjust start date of ${phase.name}`}
                            style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0, width: 6,
                              backgroundColor: barColor, filter: 'brightness(0.65)',
                              borderRadius: `${borderRadius.sm} 0 0 ${borderRadius.sm}`,
                              cursor: 'col-resize', zIndex: 2,
                            }}
                            onMouseDown={e => startDrag(e, phase.id, 'start')}
                            onTouchStart={e => startDrag(e, phase.id, 'start')}
                            onKeyDown={e => handleBarKeyDown(e, phase)}
                          />
                        )}

                        {/* Right drag handle */}
                        {canDrag && (
                          <div
                            role="button"
                            tabIndex={0}
                            aria-label={`Adjust end date of ${phase.name}`}
                            style={{
                              position: 'absolute', right: 0, top: 0, bottom: 0, width: 6,
                              backgroundColor: barColor, filter: 'brightness(0.65)',
                              borderRadius: `0 ${borderRadius.sm} ${borderRadius.sm} 0`,
                              cursor: 'col-resize', zIndex: 2,
                            }}
                            onMouseDown={e => startDrag(e, phase.id, 'end')}
                            onTouchStart={e => startDrag(e, phase.id, 'end')}
                            onKeyDown={e => handleBarKeyDown(e, phase)}
                          />
                        )}
                      </div>
                      );
                    })()}

                    {/* Cascade highlight */}
                    {isCascadeAffected && (
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0, left: `${pos.left}%`, width: `${pos.width}%`,
                        backgroundColor: `${colors.statusReview}08`,
                        borderRadius: borderRadius.sm, pointerEvents: 'none',
                      }}>
                        <div style={{
                          position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                          fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.semibold,
                          backgroundColor: colors.surfaceRaised, padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm,
                          whiteSpace: 'nowrap', boxShadow: shadows.sm,
                        }}>
                          Cascade affected
                        </div>
                      </div>
                    )}

                    {/* Today marker */}
                    {todayOffset > 0 && todayOffset < 100 && (
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${todayOffset}%`, width: 1, borderLeft: `1px dashed ${colors.statusCritical}`, opacity: 0.4, pointerEvents: 'none' }} />
                    )}

                    {/* Float pill below bar */}
                    {phase.floatDays != null && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 30,
                          left: `${pos.left}%`,
                          fontSize: '12px',
                          color: phase.floatDays === 0 ? '#E74C3C' : '#6B7280',
                          backgroundColor: phase.floatDays === 0 ? '#FEE2E2' : '#F3F4F6',
                          padding: '0 5px',
                          borderRadius: '10px',
                          lineHeight: '16px',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          zIndex: 4,
                        }}
                      >
                        {phase.floatDays}d float
                      </div>
                    )}

                    {/* Hover popover */}
                    {isHovered && !activeDrag && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: `${pos.left + pos.width / 2}%`,
                        transform: 'translateX(-50%)', marginBottom: 4,
                        padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceRaised,
                        borderRadius: borderRadius.md, boxShadow: shadows.dropdown,
                        whiteSpace: 'nowrap', zIndex: 10, fontSize: typography.fontSize.caption,
                      }}>
                        <p style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{phase.name}</p>
                        {phase.is_milestone
                          ? <p style={{ color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold, margin: 0, marginTop: 2 }}>Milestone</p>
                          : <p style={{ color: barColor, fontWeight: typography.fontWeight.semibold, margin: 0, marginTop: 2 }}>{phase.progress}% complete</p>
                        }
                        <p style={{ color: colors.textTertiary, margin: 0, marginTop: 2 }}>
                          {new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} to {new Date(phase.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                        {phase.critical && <p style={{ color: colors.statusCritical, margin: 0, marginTop: 2 }}>Critical Path</p>}
                        {phase.floatDays != null && <p style={{ color: colors.textTertiary, margin: 0, marginTop: 2 }}>Float: {phase.floatDays}d</p>}
                        {(phase.slippageDays ?? 0) > 0 && <p style={{ color: colors.statusCritical, margin: 0, marginTop: 2 }}>Slippage: +{phase.slippageDays}d</p>}
                      </div>
                    )}
                  </div>

                  {/* Slippage column */}
                  {(() => {
                    const slip = phase.slippage_days;
                    if (slip == null) {
                      return (
                        <div role="gridcell" style={{ width: SLIPPAGE_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>—</span>
                        </div>
                      );
                    }
                    const slipColor = slip > 0 ? '#E74C3C' : '#4EC896';
                    const slipLabel = slip > 0 ? `+${slip}d` : slip === 0 ? '0d' : `${slip}d`;
                    return (
                      <div role="gridcell" style={{ width: SLIPPAGE_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                        <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: slipColor }}>
                          {slipLabel}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Float column */}
                  {(() => {
                    const fd = phase.floatDays;
                    if (fd === 0) {
                      return (
                        <div role="gridcell" style={{ width: FLOAT_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                          <span style={{
                            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                            backgroundColor: '#E74C3C18', color: '#E74C3C',
                            padding: '0 5px', borderRadius: borderRadius.sm, lineHeight: '16px',
                            whiteSpace: 'nowrap',
                          }}>
                            0d CRITICAL
                          </span>
                        </div>
                      );
                    }
                    if (fd <= 2) {
                      return (
                        <div role="gridcell" style={{ width: FLOAT_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                          <span style={{
                            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                            backgroundColor: `${colors.statusPending}18`, color: colors.statusPending,
                            padding: '0 5px', borderRadius: borderRadius.sm, lineHeight: '16px',
                          }}>
                            {fd}d
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div role="gridcell" style={{ width: FLOAT_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {fd}d
                        </span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            </div>{/* end rowgroup */}
          </div>

          {/* Today line label */}
          {todayOffset > 0 && todayOffset < 100 && (
            <div style={{ paddingLeft: `${LABEL_WIDTH}px`, position: 'relative', height: 16, marginTop: spacing['1'] }}>
              <div style={{ position: 'absolute', left: `calc(${LABEL_WIDTH}px + ${todayOffset}% * (100% - ${LABEL_WIDTH}px) / 100)`, transform: 'translateX(-50%)' }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, fontWeight: typography.fontWeight.semibold, backgroundColor: `${colors.statusCritical}12`, padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm }}>Today</span>
              </div>
            </div>
          )}

          {/* Resource Histogram */}
          <div style={{ marginTop: spacing['5'], paddingLeft: `${LABEL_WIDTH}px` }}>
            <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, marginBottom: spacing['2'] }}>Resource Loading</p>
            <div style={{ display: 'flex', gap: spacing['2'] }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', height: 64, paddingRight: spacing['1'], flexShrink: 0 }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>200</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>100</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>0</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
                {resourceData.map((val, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1, height: `${(val / maxResource) * 100}%`,
                      backgroundColor: val > maxResource * 0.8 ? colors.statusCritical : val > maxResource * 0.5 ? colors.statusPending : colors.statusInfo,
                      borderRadius: '2px 2px 0 0', opacity: 0.6,
                      minHeight: val > 0 ? 2 : 0,
                      transition: `height ${transitions.quick}`,
                    }}
                    title={`${val} workers`}
                  />
                ))}
              </div>
            </div>
            <div style={{ paddingLeft: '28px', marginTop: spacing['1'] }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Workers</span>
            </div>
          </div>

        </div>
      </div>
      </>)}
    </div>
  );
};
