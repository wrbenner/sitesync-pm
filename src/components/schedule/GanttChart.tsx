import React, { useState, useMemo } from 'react';
import { GitBranch, Sparkles } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { AIAnnotationIndicator } from '../ai/AIAnnotation';
import { getAnnotationsForEntity } from '../../data/aiAnnotations';

export type TimeScale = 'month' | 'quarter';

export interface GanttPhase {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  critical: boolean;
  completed: boolean;
  dependencies?: number[]; // IDs of predecessor phases
  resources?: number; // crew count
}

interface GanttChartProps {
  phases: GanttPhase[];
  whatIfMode: boolean;
  onPhaseClick?: (phase: GanttPhase) => void;
  onPhaseDrag?: (phaseId: number, newEndDate: string) => void;
  baselinePhases?: GanttPhase[];
}

const dependencies: Record<number, number[]> = {
  2: [1], // Foundation depends on Demolition
  3: [2], // Structure depends on Foundation
  4: [3], // MEP depends on Structure
  5: [3], // Exterior depends on Structure
  6: [4, 5], // Interior depends on MEP and Exterior
  7: [6], // Finishes depends on Interior
};

export const GanttChart: React.FC<GanttChartProps> = ({ phases, whatIfMode, onPhaseClick, onPhaseDrag: _onPhaseDrag, baselinePhases }) => {
  const [timeScale, setTimeScale] = useState<TimeScale>('quarter');
  const [hoveredPhase, setHoveredPhase] = useState<number | null>(null);
  const [dragPhase, _setDragPhase] = useState<number | null>(null);
  const [showBaseline, setShowBaseline] = useState(false);

  const allStarts = phases.map((p) => new Date(p.startDate).getTime());
  const allEnds = phases.map((p) => new Date(p.endDate).getTime());
  const timelineStart = Math.min(...allStarts);
  const timelineEnd = Math.max(...allEnds);
  const timelineSpan = timelineEnd - timelineStart;

  const today = new Date();
  const todayOffset = ((today.getTime() - timelineStart) / timelineSpan) * 100;

  // Generate time labels
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

  const getBarColor = (phase: GanttPhase) => {
    if (phase.completed) return colors.statusActive; // desaturated gray-green for completed
    if (whatIfMode && dragPhase) return colors.statusReview;
    if (phase.critical && phase.progress > 0) return colors.primaryOrange;
    if (phase.progress === 0) return colors.textTertiary;
    return colors.statusInfo;
  };

  const getPhasePos = (phase: GanttPhase) => {
    const s = new Date(phase.startDate).getTime();
    const e = new Date(phase.endDate).getTime();
    return {
      left: ((s - timelineStart) / timelineSpan) * 100,
      width: ((e - s) / timelineSpan) * 100,
    };
  };

  // Resource histogram data
  const resourceData = useMemo(() => {
    const buckets = 20;
    const bucketWidth = timelineSpan / buckets;
    return Array.from({ length: buckets }).map((_, i) => {
      const bucketStart = timelineStart + i * bucketWidth;
      const bucketEnd = bucketStart + bucketWidth;
      let count = 0;
      phases.forEach((p) => {
        const ps = new Date(p.startDate).getTime();
        const pe = new Date(p.endDate).getTime();
        if (ps < bucketEnd && pe > bucketStart && !p.completed) {
          count += (p.resources || Math.ceil(p.progress / 20) + 1);
        }
      });
      return count;
    });
  }, [phases, timelineStart, timelineSpan]);

  const maxResource = Math.max(...resourceData, 1);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
          {(['month', 'quarter'] as TimeScale[]).map((scale) => (
            <button
              key={scale}
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

        <button
          onClick={() => setShowBaseline(!showBaseline)}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
            backgroundColor: showBaseline ? `${colors.statusInfo}14` : 'transparent',
            color: showBaseline ? colors.statusInfo : colors.textTertiary,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily, cursor: 'pointer',
          }}
        >
          <GitBranch size={12} /> Baseline
        </button>

        {whatIfMode && (
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.semibold }}>
            <Sparkles size={12} /> What If Mode: Drag tasks to see cascade effects
          </span>
        )}

        {/* Critical path legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing['3'] }}>
          {[
            { color: colors.statusActive, label: 'Complete' },
            { color: colors.primaryOrange, label: 'Critical' },
            { color: colors.statusInfo, label: 'Active' },
            { color: colors.textTertiary, label: 'Future' },
          ].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <div style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: l.color }} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline header */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '900px' }}>
          <div style={{ display: 'flex', paddingLeft: '170px', marginBottom: spacing['2'] }}>
            <div style={{ flex: 1, position: 'relative', height: 20 }}>
              {timeLabels.map((tl) => (
                <span key={tl.label + tl.offset} style={{
                  position: 'absolute', left: `${tl.offset}%`, transform: 'translateX(-50%)',
                  fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap',
                }}>
                  {tl.label}
                </span>
              ))}
            </div>
          </div>

          {/* Phase rows */}
          {phases.map((phase) => {
            const pos = getPhasePos(phase);
            const barColor = getBarColor(phase);
            const isHovered = hoveredPhase === phase.id;
            const deps = dependencies[phase.id] || [];
            const isCascadeAffected = whatIfMode && dragPhase && deps.includes(dragPhase);

            return (
              <div
                key={phase.id}
                style={{ display: 'flex', alignItems: 'center', marginBottom: spacing['2'], position: 'relative' }}
                onMouseEnter={() => setHoveredPhase(phase.id)}
                onMouseLeave={() => setHoveredPhase(null)}
              >
                {/* Label */}
                <div style={{ width: '170px', flexShrink: 0, paddingRight: spacing['3'] }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {phase.critical && !phase.completed && <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: colors.primaryOrange }} />}
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{phase.name}</span>
                    {getAnnotationsForEntity('schedule_phase', phase.id).map((ann) => (
                      <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                    ))}
                  </div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{phase.progress}%</span>
                </div>

                {/* Track */}
                <div
                  style={{
                    flex: 1, height: 32, position: 'relative',
                    backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm,
                    cursor: whatIfMode && !phase.completed ? 'ew-resize' : 'pointer',
                  }}
                  onClick={() => onPhaseClick?.(phase)}
                >
                  {/* Baseline bar */}
                  {showBaseline && baselinePhases && (() => {
                    const bp = baselinePhases.find((b) => b.id === phase.id);
                    if (!bp) return null;
                    const bPos = getPhasePos(bp);
                    return (
                      <div style={{
                        position: 'absolute', top: 2, bottom: 2, left: `${bPos.left}%`, width: `${bPos.width}%`,
                        border: `1px dashed ${colors.statusInfo}40`, borderRadius: borderRadius.sm, pointerEvents: 'none',
                      }} />
                    );
                  })()}

                  {/* Phase bar */}
                  <div
                    style={{
                      position: 'absolute', top: 4, bottom: 4, left: `${pos.left}%`, width: `${pos.width}%`,
                      borderRadius: borderRadius.sm, overflow: 'hidden',
                      border: isCascadeAffected ? `2px dashed ${colors.statusReview}` : 'none',
                      boxShadow: isHovered ? `0 0 0 2px ${barColor}30` : 'none',
                      transition: `box-shadow ${transitions.instant}`,
                    }}
                  >
                    {/* Filled portion */}
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: barColor, opacity: 0.25 }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${phase.progress}%`, backgroundColor: barColor }} />

                    {/* Milestone diamond */}
                    {phase.progress === 100 && (
                      <div style={{
                        position: 'absolute', right: -5, top: '50%', width: 10, height: 10,
                        backgroundColor: colors.statusActive, transform: 'translateY(-50%) rotate(45deg)',
                        border: `2px solid ${colors.surfaceRaised}`,
                      }} />
                    )}

                    {/* Milestone diamond for upcoming milestones */}
                    {!phase.completed && phase.critical && (
                      <div style={{
                        position: 'absolute', right: -5, top: '50%', width: 8, height: 8,
                        backgroundColor: phase.progress > 0 ? colors.statusPending : colors.textTertiary,
                        transform: 'translateY(-50%) rotate(45deg)',
                        border: `1.5px solid ${colors.surfaceRaised}`,
                      }} />
                    )}
                  </div>

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

                  {/* Dependency arrows (simple lines) */}
                  {deps.map((depId) => {
                    const depPhase = phases.find((p) => p.id === depId);
                    if (!depPhase) return null;
                    const depEnd = ((new Date(depPhase.endDate).getTime() - timelineStart) / timelineSpan) * 100;
                    const isCriticalConnection = phase.critical && depPhase.critical;
                    return (
                      <svg key={depId} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
                        <line
                          x1={`${depEnd}%`} y1="50%"
                          x2={`${pos.left}%`} y2="50%"
                          stroke={phase.critical ? colors.primaryOrange : colors.borderDefault}
                          strokeWidth={isCriticalConnection ? "1.5" : "1"} strokeDasharray={phase.critical ? "none" : "3 3"}
                          opacity={isCriticalConnection ? 0.7 : 0.4}
                        />
                        <polygon
                          points={`${pos.left - 0.3}%,35% ${pos.left}%,50% ${pos.left - 0.3}%,65%`}
                          fill={phase.critical ? colors.primaryOrange : colors.borderDefault}
                          opacity={isCriticalConnection ? 0.7 : 0.4}
                          transform={`translate(0, 0)`}
                        />
                      </svg>
                    );
                  })}

                  {/* Today marker */}
                  {todayOffset > 0 && todayOffset < 100 && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${todayOffset}%`, width: 1, borderLeft: `1px dashed ${colors.statusCritical}`, opacity: 0.4 }} />
                  )}

                  {/* Popover on hover */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: `${pos.left + pos.width / 2}%`,
                      transform: 'translateX(-50%)', marginBottom: 4,
                      padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceRaised,
                      borderRadius: borderRadius.md, boxShadow: shadows.dropdown,
                      whiteSpace: 'nowrap', zIndex: 10, fontSize: typography.fontSize.caption,
                    }}>
                      <p style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{phase.name}</p>
                      <p style={{ color: colors.textTertiary, margin: 0, marginTop: 2 }}>
                        {new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} to {new Date(phase.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                      <p style={{ color: barColor, fontWeight: typography.fontWeight.semibold, margin: 0, marginTop: 2 }}>{phase.progress}% complete</p>
                      {phase.critical && <p style={{ color: colors.orangeText, margin: 0, marginTop: 2 }}>Critical Path</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Today line label */}
          {todayOffset > 0 && todayOffset < 100 && (
            <div style={{ paddingLeft: '170px', position: 'relative', height: 16, marginTop: spacing['1'] }}>
              <div style={{ position: 'absolute', left: `calc(170px + ${(todayOffset / 100) * (100)}% * (100% - 170px) / 100%)`, transform: 'translateX(-50%)' }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, fontWeight: typography.fontWeight.semibold, backgroundColor: `${colors.statusCritical}12`, padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm }}>Today</span>
              </div>
            </div>
          )}

          {/* Resource Histogram */}
          <div style={{ marginTop: spacing['5'], paddingLeft: '170px' }}>
            <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, marginBottom: spacing['2'] }}>Resource Loading</p>
            <div style={{ display: 'flex', gap: spacing['2'] }}>
              {/* Y-axis labels */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', height: 64, paddingRight: spacing['1'], flexShrink: 0 }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>200</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>100</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>0</span>
              </div>
              {/* Bars */}
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
    </div>
  );
};
