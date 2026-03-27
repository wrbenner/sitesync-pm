import React, { useState } from 'react';
import { GripVertical, AlertTriangle, CheckCircle, Package, Eye } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

type ConstraintType = 'material' | 'inspection' | 'predecessor' | 'crew' | 'equipment';
type TaskReadiness = 'ready' | 'constrained' | 'blocked';

export interface LookaheadTask {
  id: number;
  title: string;
  crew: string;
  crewId: number;
  dayIndex: number; // 0-based index into visible days
  duration: number; // days
  readiness: TaskReadiness;
  constraints: { type: ConstraintType; label: string; resolved: boolean }[];
  progress: number;
}

interface LookaheadBoardProps {
  tasks: LookaheadTask[];
  days: string[];
  crews: string[];
  weekView: 1 | 2 | 3;
  onTaskMove?: (taskId: number, newDayIndex: number, newCrew: string) => void;
  onConstraintToggle?: (taskId: number, constraintIndex: number) => void;
}

const readinessColors: Record<TaskReadiness, string> = {
  ready: colors.statusActive,
  constrained: colors.statusPending,
  blocked: colors.statusCritical,
};

const constraintIcons: Record<ConstraintType, React.ReactNode> = {
  material: <Package size={12} />,
  inspection: <Eye size={12} />,
  predecessor: <AlertTriangle size={12} />,
  crew: <GripVertical size={12} />,
  equipment: <GripVertical size={12} />,
};

const mockWeather: Record<number, { icon: string; rain: boolean }> = {
  0: { icon: '☀️', rain: false },
  1: { icon: '⛅', rain: false },
  2: { icon: '☁️', rain: false },
  3: { icon: '🌧️', rain: true },
  4: { icon: '⛅', rain: false },
  5: { icon: '☀️', rain: false },
  6: { icon: '☀️', rain: false },
  7: { icon: '🌧️', rain: true },
  8: { icon: '⛅', rain: false },
  9: { icon: '☀️', rain: false },
  10: { icon: '☀️', rain: false },
  11: { icon: '⛅', rain: false },
  12: { icon: '☀️', rain: false },
  13: { icon: '☁️', rain: false },
  14: { icon: '☀️', rain: false },
};

export const LookaheadBoard: React.FC<LookaheadBoardProps> = ({
  tasks, days, crews, weekView, onTaskMove, onConstraintToggle,
}) => {
  const [dragTask, setDragTask] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  const visibleDays = days.slice(0, weekView * 5); // 5 work days per week

  const handleDragStart = (taskId: number) => {
    setDragTask(taskId);
  };

  const handleDrop = (dayIndex: number, crew: string) => {
    if (dragTask && onTaskMove) {
      onTaskMove(dragTask, dayIndex, crew);
    }
    setDragTask(null);
    setHoveredCell(null);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: `${visibleDays.length * 120 + 140}px` }}>
        {/* Color legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['2'], flexWrap: 'wrap' }}>
          {[
            { icon: '✓', color: colors.statusActive, label: 'All Clear' },
            { icon: '▲', color: colors.statusPending, label: 'Has Constraints' },
            { icon: '●', color: colors.primaryOrange, label: 'Constraint Resolved' },
            { icon: '⊘', color: colors.statusCritical, label: 'Blocked' },
            { icon: '—', color: colors.textTertiary, label: 'No Work Planned' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <span style={{ fontSize: typography.fontSize.caption, color: item.color }}>{item.icon}</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${visibleDays.length}, 1fr)`, gap: 1 }}>
          <div style={{ padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: `${borderRadius.md} 0 0 0` }}>
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
              Crew / Trade
            </span>
          </div>
          {visibleDays.map((day, i) => {
            const isToday = i === 0;
            const w = mockWeather[i];
            return (
              <div
                key={day}
                style={{
                  padding: `${spacing['2']} ${spacing['2']}`, textAlign: 'center',
                  backgroundColor: isToday ? colors.orangeSubtle : w?.rain ? 'rgba(58, 123, 200, 0.06)' : colors.surfaceInset,
                  borderBottom: isToday ? `2px solid ${colors.primaryOrange}` : 'none',
                }}
              >
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: isToday ? colors.primaryOrange : colors.textPrimary }}>{day}</span>
                <span style={{ fontSize: '12px', marginLeft: spacing['1'] }}>{w?.icon}</span>
              </div>
            );
          })}
        </div>

        {/* Swimlanes */}
        {crews.map((crew) => {
          const crewTasks = tasks.filter((t) => t.crew === crew);
          return (
            <div
              key={crew}
              style={{ display: 'grid', gridTemplateColumns: `140px repeat(${visibleDays.length}, 1fr)`, gap: 1, minHeight: '60px' }}
            >
              {/* Crew label */}
              <div style={{
                padding: `${spacing['3']}`, backgroundColor: colors.surfaceRaised,
                borderRight: `1px solid ${colors.borderSubtle}`,
                display: 'flex', alignItems: 'center',
              }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{crew}</span>
              </div>

              {/* Day cells */}
              {visibleDays.map((_day, dayIdx) => {
                const cellKey = `${crew}-${dayIdx}`;
                const cellTasks = crewTasks.filter((t) => dayIdx >= t.dayIndex && dayIdx < t.dayIndex + t.duration);
                const isDragOver = hoveredCell === cellKey && dragTask !== null;

                return (
                  <div
                    key={cellKey}
                    onDragOver={(e) => { e.preventDefault(); setHoveredCell(cellKey); }}
                    onDragLeave={() => setHoveredCell(null)}
                    onDrop={() => handleDrop(dayIdx, crew)}
                    style={{
                      padding: spacing['1'],
                      backgroundColor: isDragOver ? colors.orangeSubtle : cellTasks.length === 0 ? colors.surfaceInset : colors.surfaceRaised,
                      borderRight: `1px solid ${colors.borderSubtle}`,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                      minHeight: '56px',
                      transition: `background-color ${transitions.instant}`,
                    }}
                  >
                    {cellTasks.map((task) => {
                      if (dayIdx !== task.dayIndex) return null; // Only render at start
                      const rColor = readinessColors[task.readiness];
                      const unresolvedCount = task.constraints.filter((c) => !c.resolved).length;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => handleDragStart(task.id)}
                          onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                          style={{
                            padding: `${spacing['1']} ${spacing['2']}`,
                            backgroundColor: `${rColor}0A`,
                            borderLeft: `3px solid ${rColor}`,
                            borderRadius: borderRadius.sm,
                            cursor: 'grab',
                            fontSize: typography.fontSize.caption,
                            gridColumn: `span ${Math.min(task.duration, visibleDays.length - dayIdx)}`,
                            position: 'relative',
                          }}
                        >
                          <GripVertical size={10} color={colors.borderDefault} style={{ position: 'absolute', top: 2, right: 2 }} />
                          <p style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.snug, fontSize: '11px' }}>{task.title}</p>

                          {/* Constraint chips */}
                          {unresolvedCount > 0 && (
                            <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
                              {task.constraints.filter((c) => !c.resolved).map((c, ci) => (
                                <span
                                  key={ci}
                                  onClick={(e) => { e.stopPropagation(); onConstraintToggle?.(task.id, task.constraints.indexOf(c)); }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 2,
                                    padding: '4px 8px', fontSize: '11px',
                                    backgroundColor: `${colors.statusPending}14`, color: colors.statusPending,
                                    borderRadius: 3, cursor: 'pointer', fontWeight: typography.fontWeight.medium,
                                  }}
                                >
                                  {constraintIcons[c.type]} {c.label}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Resolved indicator */}
                          {unresolvedCount === 0 && task.constraints.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                              <CheckCircle size={9} color={colors.statusActive} />
                              <span style={{ fontSize: '9px', color: colors.statusActive }}>All clear</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {cellTasks.length === 0 && !isDragOver && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40px' }}>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, opacity: 0.4 }}>No work</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
