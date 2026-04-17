import React, { useState, useMemo, useRef, useEffect, useId, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import { CalendarDays, GitBranch, Zap } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import type { PredictedRisk, PredictedDelay } from '../../lib/predictions';
import type { MappedSchedulePhase } from '../../types/entities';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { AIAnnotationIndicator } from '../ai/AIAnnotation';
import { getAnnotationsForEntity } from '../../data/aiAnnotations';

export type TimeScale = 'day' | 'week' | 'month' | 'quarter';

const ROW_HEIGHT = 36; // 32px bar + 4px gap
const PX_PER_DAY: Record<TimeScale, number> = { day: 40, week: 12, month: 4, quarter: 2 };
const DAY_MS = 86_400_000;
const LABEL_WIDTH = 200;
const SLIPPAGE_COL_WIDTH = 72;
const FLOAT_COL_WIDTH = 84;
const BASELINE_DATE_COL_WIDTH = 88;


export type GanttPhase = MappedSchedulePhase;

interface GanttChartProps {
  phases: GanttPhase[];
  isLoading?: boolean;
  onImportSchedule?: () => void;
  onAddActivity?: () => void;
  onPhaseClick?: (phase: GanttPhase) => void;
  baselinePhases?: GanttPhase[];
  showBaseline?: boolean;
  zoomLevel?: TimeScale;
  risks?: PredictedRisk[];
  delays?: PredictedDelay[];
}

const SKELETON_ROW_WIDTHS = ['70%', '55%', '85%', '40%', '90%', '60%', '75%', '45%'];

export const GanttChart: React.FC<GanttChartProps> = ({
  phases,
  isLoading = false,
  onImportSchedule,
  onAddActivity,
  onPhaseClick,
  baselinePhases,
  showBaseline: showBaselineProp,
  zoomLevel: zoomLevelProp,
  risks = [],
  delays = [],
}) => {
  const uid = useId().replace(/:/g, '');

  const [timeScale, setTimeScale] = useState<TimeScale>(zoomLevelProp ?? 'month');

  useEffect(() => {
    if (zoomLevelProp !== undefined) setTimeScale(zoomLevelProp);
  }, [zoomLevelProp]);
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);
  const [showBaselineInternal, setShowBaselineInternal] = useState(true);
  const showBaseline = showBaselineProp !== undefined ? showBaselineProp : showBaselineInternal;
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [riskTooltipPhase, setRiskTooltipPhase] = useState<string | null>(null);
  const [delayTooltipPhase, setDelayTooltipPhase] = useState<string | null>(null);
  const [localPhases, setLocalPhases] = useState<GanttPhase[]>(phases);
  const [announcement] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, setTrackWidth] = useState(0);

  const probeRef = useRef<HTMLDivElement>(null);
  const trackWidthRef = useRef(0);
  const ganttGridRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setLocalPhases(phases);
  }, [phases]);

  // Timeline anchors
  const allStarts = phases.map(p => new Date(p.startDate).getTime());
  const allEnds = phases.map(p => new Date(p.endDate).getTime());
  const timelineStart = Math.min(...allStarts);
  const timelineEnd = Math.max(...allEnds);
  const timelineSpan = timelineEnd - timelineStart;


  const hasBaselineData = phases.some(p => p.baselineStartDate != null && p.baselineEndDate != null);
  const today = new Date();
  const todayPx = Math.round(((today.getTime() - timelineStart) / DAY_MS) * pxPerDay);

  const timeLabels = useMemo(() => {
    const labels: { label: string; offset: number }[] = [];
    const start = new Date(timelineStart);
    const end = new Date(timelineEnd);
    if (timeScale === 'day') {
      // Show every 3 days to avoid overlap
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      while (d.getTime() <= timelineEnd) {
        const offset = Math.round(((d.getTime() - timelineStart) / DAY_MS) * pxPerDay);
        labels.push({
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          offset,
        });
        d.setDate(d.getDate() + 3);
      }
    } else if (timeScale === 'week') {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      d.setDate(d.getDate() - d.getDay()); // rewind to Sunday
      while (d.getTime() <= timelineEnd) {
        const offset = Math.round(((d.getTime() - timelineStart) / DAY_MS) * pxPerDay);
        if (offset >= 0) {
          labels.push({
            label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            offset,
          });
        }
        d.setDate(d.getDate() + 7);
      }
    } else if (timeScale === 'quarter') {
      const d = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
      while (d <= end) {
        const offset = Math.round(((d.getTime() - timelineStart) / DAY_MS) * pxPerDay);
        const q = Math.floor(d.getMonth() / 3) + 1;
        labels.push({ label: `Q${q} ${d.getFullYear()}`, offset });
        d.setMonth(d.getMonth() + 3);
      }
    } else {
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      while (d <= end) {
        const offset = Math.round(((d.getTime() - timelineStart) / DAY_MS) * pxPerDay);
        labels.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), offset });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return labels;
  }, [timelineStart, timelineEnd, timelineSpan, timeScale, pxPerDay]);

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

  const pxPerDay = PX_PER_DAY[timeScale];

  const totalDays = Math.max(1, Math.ceil(timelineSpan / DAY_MS));
  const totalTrackWidth = totalDays * pxPerDay;

  const getPhasePos = (phase: GanttPhase) => {
    const s = new Date(phase.startDate).getTime();
    const e = new Date(phase.endDate).getTime();
    return {
      left: Math.round(((s - timelineStart) / DAY_MS) * pxPerDay),
      width: Math.max(Math.round(((e - s) / DAY_MS) * pxPerDay), 2),
    };
  };

  const getBarColor = (phase: GanttPhase) => {
    if (phase.completed || phase.status === 'completed') return '#4EC896';
    if (phase.status === 'delayed') return '#E74C3C';
    if (phase.status === 'in_progress') return '#3B82F6';
    if (phase.is_critical || phase.critical || phase.floatDays === 0) return '#E74C3C';
    if (phase.status === 'not_started' || phase.progress === 0) return '#9CA3AF';
    return '#3B82F6';
  };


  return (
    <div role="region" aria-label="Gantt chart showing project timeline">
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
          title="Build your schedule to track every phase from mobilization to closeout"
          description="Import your Primavera P6 or MS Project schedule, or create your first phase manually to get started."
          action={{ label: 'Import from P6/MS Project', onClick: onImportSchedule ?? (() => {}) }}
          secondaryAction={{ label: 'Create First Phase', onClick: onAddActivity ?? (() => {}) }}
        />
      )}

      {/* Controls */}
      {!isLoading && phases.length > 0 && (<>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        {zoomLevelProp === undefined && (
        <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
          {(['day', 'week', 'month', 'quarter'] as TimeScale[]).map(scale => (
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
              {scale.charAt(0).toUpperCase() + scale.slice(1)}
            </button>
          ))}
        </div>
        )}

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
          aria-label={showCriticalOnly ? 'Show all activities' : 'Filter to critical path only'}
          aria-pressed={showCriticalOnly}
          onClick={() => setShowCriticalOnly(!showCriticalOnly)}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.full,
            border: showCriticalOnly ? '1px solid #EF4444' : '1px solid transparent',
            backgroundColor: showCriticalOnly ? '#EF444414' : 'transparent',
            color: showCriticalOnly ? '#EF4444' : colors.textTertiary,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily, cursor: 'pointer',
          }}
        >
          Critical Path Only
        </button>

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing['3'], flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Baseline — always visible so ghost bars on the chart are always explained */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 16, height: 6, borderRadius: 2, backgroundColor: colors.borderDefault, opacity: 0.7 }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Baseline</span>
          </div>
          {/* Actual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 16, height: 6, borderRadius: 2, backgroundColor: colors.primaryOrange }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Actual</span>
          </div>
          {/* Critical Path */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 16, height: 12, borderLeft: '3px solid #EF4444', paddingLeft: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 2, backgroundColor: '#EF4444', opacity: 0.3 }} />
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
      <div style={{ overflowX: 'auto', minHeight: '400px' }}>
        <div style={{ minWidth: `${LABEL_WIDTH + totalTrackWidth}px`, position: 'relative' }}>

          {/* Time labels header */}
          <div role="row" style={{ display: 'flex', marginBottom: spacing['2'] }}>
            <div role="columnheader" scope="col" aria-label="Activity" style={{ width: LABEL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, backgroundColor: colors.surfaceRaised, zIndex: 7 }} />
            <div role="columnheader" scope="col" aria-label="Timeline" ref={probeRef} style={{ width: totalTrackWidth, flexShrink: 0, position: 'relative', height: 20 }}>
              {timeLabels.map(tl => (
                <span
                  key={tl.label + tl.offset}
                  style={{
                    position: 'absolute', left: `${tl.offset}px`, transform: 'translateX(-50%)',
                    fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap',
                  }}
                >
                  {tl.label}
                </span>
              ))}
            </div>
            <div role="columnheader" scope="col" style={{
              width: SLIPPAGE_COL_WIDTH, flexShrink: 0, textAlign: 'right',
              paddingRight: spacing['2'], height: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                Slip
              </span>
            </div>
            <div role="columnheader" scope="col" style={{
              width: FLOAT_COL_WIDTH, flexShrink: 0, textAlign: 'right',
              paddingRight: spacing['2'], height: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                Float
              </span>
            </div>
            {showBaseline && (
              <div role="columnheader" scope="col" style={{
                width: BASELINE_DATE_COL_WIDTH, flexShrink: 0, textAlign: 'right',
                paddingRight: spacing['2'], height: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                  Bsln Start
                </span>
              </div>
            )}
            {showBaseline && (
              <div role="columnheader" scope="col" style={{
                width: BASELINE_DATE_COL_WIDTH, flexShrink: 0, textAlign: 'right',
                paddingRight: spacing['2'], height: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                  Bsln End
                </span>
              </div>
            )}
          </div>

          {/* Legend */}
          <div
            aria-label="Gantt chart legend"
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['4'],
              paddingLeft: LABEL_WIDTH, paddingBottom: spacing['2'],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <div style={{ width: 16, height: 9, borderRadius: 2, backgroundColor: '#D1D5DB', opacity: 0.5 }} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Baseline</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <div style={{ width: 16, height: 9, borderRadius: 2, backgroundColor: colors.primaryOrange }} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Actual</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <div style={{ width: 16, height: 9, borderRadius: 2, backgroundColor: '#EF4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.3)' }} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Critical Path</span>
            </div>
          </div>

          {/* Phase rows + SVG dependency overlay */}
          <div
            ref={ganttGridRef}
            id="gantt-activities"
            role="table"
            aria-label="Project schedule activities"
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
              <div role="columnheader" scope="col" aria-sort="none" style={{}}>Activity</div>
              <div role="columnheader" scope="col" aria-sort="none" style={{}}>Schedule</div>
              <div role="columnheader" scope="col" aria-sort="none" style={{}}>Slippage</div>
              <div role="columnheader" scope="col" aria-sort="none" style={{}}>Float</div>
              {showBaseline && <div role="columnheader" scope="col" aria-sort="none" style={{}}>Baseline Start</div>}
              {showBaseline && <div role="columnheader" scope="col" aria-sort="none" style={{}}>Baseline End</div>}
            </div>

            {/* SVG overlay for dependency arrows */}
            {(dependencyArrows.length > 0 || typedDependencyArrows.length > 0) && (
              <svg
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: LABEL_WIDTH,
                  top: 0,
                  width: totalTrackWidth,
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
            <motion.div
              role="rowgroup"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
            >
            {localPhases.map((phase, index) => {
              const pos = getPhasePos(phase);
              const barColor = getBarColor(phase);
              const isHovered = hoveredPhase === phase.id;
              const isCriticalPathRow = phase.is_critical_path === true || phase.is_critical || phase.floatDays === 0;
              const phaseRisk = risks.find(r => r.phaseId === phase.id);
              const phaseDelay = delays.find(d => d.activityId === phase.id && d.predictedSlippageDays > 0);
              const durationDays = Math.round((new Date(phase.endDate).getTime() - new Date(phase.startDate).getTime()) / DAY_MS);
              const isMilestoneBar = phase.is_milestone === true || durationDays === 0;

              return (
                <motion.div
                  key={phase.id}
                  id={`${uid}-gantt-row-${index}`}
                  data-gantt-index={index}
                  role="row"
                  aria-rowindex={index + 1}
                  aria-selected={selectedIds.has(phase.id)}
                  aria-label={`${(phase.critical || phase.is_critical) ? 'Critical path activity: ' : ''}${phase.name}: ${new Date(phase.startDate).toLocaleDateString()} to ${new Date(phase.endDate).toLocaleDateString()}, ${phase.progress}% complete${phase.floatDays != null ? `, ${phase.floatDays} days float` : ''}`}
                  tabIndex={0}
                  className="gantt-phase-row"
                  variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0, transition: { duration: 0.2 } } }}
                  style={{
                    display: showCriticalOnly && !isCriticalPathRow ? 'none' : 'flex',
                    alignItems: 'center', marginBottom: spacing['1'], position: 'relative',
                    borderLeft: isCriticalPathRow ? '3px solid #E74C3C' : '3px solid transparent',
                    paddingLeft: isCriticalPathRow ? spacing['2'] : 0,
                    outline: 'none',
                  }}
                  onMouseEnter={() => setHoveredPhase(phase.id)}
                  onMouseLeave={() => setHoveredPhase(null)}
                  onFocus={e => { setHoveredPhase(phase.id); e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primaryOrange}50`; }}
                  onBlur={e => { setHoveredPhase(null); e.currentTarget.style.boxShadow = 'none'; }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); onPhaseClick?.(phase); }
                  }}
                >
                  {/* Label */}
                  <div role="cell" style={{ width: `${LABEL_WIDTH}px`, flexShrink: 0, paddingRight: spacing['3'], position: 'sticky', left: 0, backgroundColor: colors.surfaceRaised, zIndex: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isCriticalPathRow && !phase.completed && (
                        <span style={{
                          fontSize: '10px', fontWeight: 700,
                          backgroundColor: '#EF4444', color: '#fff',
                          padding: '0 4px', borderRadius: '3px',
                          lineHeight: '16px', flexShrink: 0,
                        }}>CP</span>
                      )}
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: isCriticalPathRow ? typography.fontWeight.bold : typography.fontWeight.medium, color: colors.textPrimary }}>
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
                      {!isMilestoneBar && (
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
                      width: totalTrackWidth, flexShrink: 0, height: 32, position: 'relative',
                      backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPhaseClick?.(phase)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPhaseClick?.(phase); } }}
                  >
                    {/* Baseline ghost bar — visible when showBaseline is true and baseline data exists */}
                    {showBaseline && (() => {
                      const bStart = phase.baselineStartDate ?? (baselinePhases?.find(b => b.id === phase.id)?.baselineStartDate ?? null);
                      const bEnd = phase.baselineEndDate ?? (baselinePhases?.find(b => b.id === phase.id)?.baselineEndDate ?? null);
                      if (!bStart || !bEnd) return null;
                      const bLeft = Math.round(((new Date(bStart).getTime() - timelineStart) / DAY_MS) * pxPerDay);
                      const bWidth = Math.max(Math.round(((new Date(bEnd).getTime() - new Date(bStart).getTime()) / DAY_MS) * pxPerDay), 2);
                      return (
                        <div aria-hidden="true" style={{
                          position: 'absolute', top: 2,
                          height: 4,
                          left: `${bLeft}px`, width: `${bWidth}px`,
                          background: 'rgba(156, 163, 175, 0.5)',
                          borderRadius: 2, pointerEvents: 'none',
                          zIndex: 0,
                        }} />
                      );
                    })()}

                    {/* Milestone diamond */}
                    {isMilestoneBar ? (
                      <div
                        role="img"
                        aria-label={`${phase.name}: ${phase.startDate} to ${phase.endDate}, milestone${phase.critical || phase.is_critical ? ', CRITICAL PATH' : ''}`}
                        style={{
                          position: 'absolute',
                          left: `${pos.left}px`,
                          top: '50%',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          width: 14, height: 14,
                          backgroundColor: colors.primaryOrange,
                          zIndex: 2,
                        }}
                      />
                    ) : null}
                    {/* Milestone label to the right of the diamond */}
                    {isMilestoneBar && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: `${pos.left + 12}px`,
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
                    {!isMilestoneBar && (() => {
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
                        role="cell"
                        data-gantt-bar="true"
                        aria-label={`${phase.name}, ${fmtDate(phase.startDate)} to ${fmtDate(phase.endDate)}, ${phase.progress}% complete, ${barStatus}`}
                        tabIndex={0}
                        title={isCriticalPathRow
                          ? 'Critical Path \u2014 0 days float'
                          : phase.floatDays != null
                            ? `Float: ${phase.floatDays} days`
                            : undefined}
                        style={{
                          position: 'absolute', top: 4, bottom: 4,
                          left: `${pos.left}px`, width: `${pos.width}px`,
                          borderRadius: borderRadius.sm, overflow: 'visible',
                          border: 'none',
                          boxShadow: isCriticalPathRow
                            ? '0 0 8px rgba(239, 68, 68, 0.3)'
                            : isHovered ? `0 0 0 2px ${barColor}30` : 'none',
                          transition: `box-shadow ${transitions.instant}`,
                          outline: 'none',
                          cursor: 'pointer',
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
                              width: `${phase.floatDays * pxPerDay}px`,
                              backgroundColor: barColor,
                              opacity: 0.12,
                              borderRadius: `0 ${borderRadius.sm} ${borderRadius.sm} 0`,
                              pointerEvents: 'none',
                            }}
                          />
                        )}

                        {/* Variance badge: red when late vs baseline, green when ahead */}
                        {phase.baselineEndDate != null ? (() => {
                          const varDays = Math.ceil((new Date(phase.endDate).getTime() - new Date(phase.baselineEndDate).getTime()) / 86400000);
                          if (varDays === 0) return null;
                          return (
                            <div aria-hidden="true" style={{
                              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                              backgroundColor: varDays > 0 ? colors.statusCritical : colors.statusActive, color: '#fff',
                              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                              padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm,
                              lineHeight: '16px', whiteSpace: 'nowrap', pointerEvents: 'none',
                            }}>
                              {varDays > 0 ? `+${varDays}d` : `${varDays}d`}
                            </div>
                          );
                        })() : (phase.slippageDays ?? 0) > 0 ? (
                          <div aria-hidden="true" style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            backgroundColor: colors.statusCritical, color: '#fff',
                            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                            padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm,
                            lineHeight: '16px', whiteSpace: 'nowrap', pointerEvents: 'none',
                          }}>
                            +{phase.slippageDays}d
                          </div>
                        ) : null}

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
                        position: 'absolute', top: 0, bottom: 0, left: `${pos.left}px`, width: `${pos.width}px`,
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

                    {/* Baseline variance text next to bar */}
                    {showBaseline && !isMilestoneBar && (() => {
                      const bEnd = phase.baselineEndDate ?? (baselinePhases?.find(b => b.id === phase.id)?.baselineEndDate ?? null);
                      if (!bEnd) return null;
                      const variance = Math.round((new Date(phase.endDate).getTime() - new Date(bEnd).getTime()) / DAY_MS);
                      if (variance === 0) return null;
                      return (
                        <div aria-hidden="true" style={{
                          position: 'absolute',
                          left: `${pos.left + pos.width + 4}px`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: variance > 0 ? '#E74C3C' : '#4EC896',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          zIndex: 4,
                        }}>
                          {variance > 0 ? `+${variance}d` : `${variance}d`}
                        </div>
                      );
                    })()}

                    {/* Today marker */}
                    {todayPx > 0 && todayPx < totalTrackWidth && (
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${todayPx}px`, width: 1, borderLeft: '2px dashed #F47820', opacity: 0.8, pointerEvents: 'none' }} />
                    )}

                    {/* Float pill below bar */}
                    {phase.floatDays != null && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 30,
                          left: `${pos.left}px`,
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
                        position: 'absolute', bottom: '100%', left: `${pos.left + pos.width / 2}px`,
                        transform: 'translateX(-50%)', marginBottom: 4,
                        padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceRaised,
                        borderRadius: borderRadius.md, boxShadow: shadows.dropdown,
                        whiteSpace: 'nowrap', zIndex: 10, fontSize: typography.fontSize.caption,
                        border: `1px solid ${colors.borderSubtle}`,
                      }}>
                        <p style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{phase.name}</p>
                        <p style={{ color: colors.textSecondary, margin: 0, marginTop: 3 }}>
                          {new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' \u2013 '}
                          {new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {!isMilestoneBar && (
                          <p style={{ color: barColor, fontWeight: typography.fontWeight.semibold, margin: 0, marginTop: 3 }}>{phase.progress}% complete</p>
                        )}
                        {isMilestoneBar && (
                          <p style={{ color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold, margin: 0, marginTop: 3 }}>Milestone</p>
                        )}
                        {phase.floatDays != null && (
                          <p style={{ color: phase.floatDays === 0 ? colors.statusCritical : colors.textTertiary, margin: 0, marginTop: 3 }}>
                            {phase.floatDays} {phase.floatDays === 1 ? 'day' : 'days'} float
                          </p>
                        )}
                        {(phase.critical || phase.is_critical) && (
                          <p style={{ color: colors.statusCritical, fontWeight: typography.fontWeight.semibold, margin: 0, marginTop: 3 }}>Critical Path</p>
                        )}
                        {(phase.slippageDays ?? 0) > 0 && <p style={{ color: colors.statusCritical, margin: 0, marginTop: 3 }}>Slippage: +{phase.slippageDays}d</p>}
                      </div>
                    )}
                  </div>

                  {/* Slippage column */}
                  {(() => {
                    const slip = phase.slippage_days;
                    if (slip == null) {
                      return (
                        <div role="cell" style={{ width: SLIPPAGE_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>—</span>
                        </div>
                      );
                    }
                    const slipColor = slip > 0 ? '#E74C3C' : '#4EC896';
                    const slipLabel = slip > 0 ? `+${slip}d` : slip === 0 ? '0d' : `${slip}d`;
                    return (
                      <div role="cell" style={{ width: SLIPPAGE_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
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
                        <div role="cell" style={{ width: FLOAT_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
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
                        <div role="cell" style={{ width: FLOAT_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
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
                      <div role="cell" style={{ width: FLOAT_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {fd}d
                        </span>
                      </div>
                    );
                  })()}

                  {/* Baseline Start column */}
                  {showBaseline && (() => {
                    const bStart = phase.baselineStartDate;
                    if (!bStart) {
                      return (
                        <div role="cell" style={{ width: BASELINE_DATE_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>—</span>
                        </div>
                      );
                    }
                    const variance = Math.ceil((new Date(phase.startDate).getTime() - new Date(bStart).getTime()) / 86400000);
                    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div role="cell" style={{ width: BASELINE_DATE_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{fmtDate(bStart)}</span>
                          {variance !== 0 && (
                            <span style={{
                              fontSize: '10px', fontWeight: typography.fontWeight.semibold,
                              color: variance > 0 ? '#E74C3C' : '#4EC896',
                              backgroundColor: variance > 0 ? '#FEE2E2' : '#D1FAE5',
                              padding: '0 4px', borderRadius: borderRadius.sm, lineHeight: '16px',
                            }}>
                              {variance > 0 ? `+${variance}d` : `${variance}d`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Baseline End column */}
                  {showBaseline && (() => {
                    const bEnd = phase.baselineEndDate;
                    if (!bEnd) {
                      return (
                        <div role="cell" style={{ width: BASELINE_DATE_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>—</span>
                        </div>
                      );
                    }
                    const variance = Math.ceil((new Date(phase.endDate).getTime() - new Date(bEnd).getTime()) / 86400000);
                    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div role="cell" style={{ width: BASELINE_DATE_COL_WIDTH, flexShrink: 0, textAlign: 'right', paddingRight: spacing['2'] }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{fmtDate(bEnd)}</span>
                          {variance !== 0 && (
                            <span style={{
                              fontSize: '10px', fontWeight: typography.fontWeight.semibold,
                              color: variance > 0 ? '#E74C3C' : '#4EC896',
                              backgroundColor: variance > 0 ? '#FEE2E2' : '#D1FAE5',
                              padding: '0 4px', borderRadius: borderRadius.sm, lineHeight: '16px',
                            }}>
                              {variance > 0 ? `+${variance}d` : `${variance}d`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              );
            })}
            </motion.div>{/* end rowgroup */}
          </div>

          {/* Today line label */}
          {todayPx > 0 && todayPx < totalTrackWidth && (
            <div style={{ paddingLeft: `${LABEL_WIDTH}px`, position: 'relative', height: 16, marginTop: spacing['1'] }}>
              <div style={{ position: 'absolute', left: `${todayPx}px`, transform: 'translateX(-50%)' }}>
                <span style={{ fontSize: typography.fontSize.caption, color: '#F47820', fontWeight: typography.fontWeight.semibold, backgroundColor: '#F4782012', padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm }}>Today</span>
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
