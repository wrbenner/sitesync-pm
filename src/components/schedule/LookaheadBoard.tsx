import React, { useState, useMemo } from 'react';
import { GripVertical, AlertTriangle, CheckCircle, Package, Eye } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import type { WeatherDay } from '../../lib/weather';
import type { MappedSchedulePhase } from '../../types/entities';

type ConstraintType = 'material' | 'inspection' | 'predecessor' | 'crew' | 'equipment';
type TaskReadiness = 'ready' | 'constrained' | 'blocked';
type FilterType = 'all' | 'weather' | 'conflict' | 'critical';

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
  work_type?: string;
  location?: string;
}

interface LookaheadBoardProps {
  tasks: LookaheadTask[];
  days: string[];
  crews: string[];
  weekView: 1 | 2 | 3;
  weatherForecast?: WeatherDay[];
  phases?: MappedSchedulePhase[];
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

const WEATHER_SENSITIVE = ['outdoor', 'concrete', 'roofing'];

export const LookaheadBoard: React.FC<LookaheadBoardProps> = ({
  tasks, days, crews, weekView, weatherForecast = [], onTaskMove, onConstraintToggle,
}) => {
  const [dragTask, setDragTask] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const visibleDays = days.slice(0, weekView * 5);

  // Classify each forecast day by hazard type
  const weatherHazards = useMemo(() =>
    weatherForecast.map(day => ({
      isRain: day.precip_probability > 50,
      isHeat: day.temp_high > 100,
      isFreeze: day.temp_low < 32,
      day,
    })),
    [weatherForecast],
  );

  // Trade conflict detection: group tasks by day+location, flag duplicates
  const { conflictTaskIds, conflictDetails } = useMemo(() => {
    const dayLocMap = new Map<string, { taskId: number; crew: string }[]>();
    tasks.forEach(task => {
      if (!task.location) return;
      for (let d = task.dayIndex; d < task.dayIndex + task.duration; d++) {
        const key = `${d}::${task.location}`;
        if (!dayLocMap.has(key)) dayLocMap.set(key, []);
        dayLocMap.get(key)!.push({ taskId: task.id, crew: task.crew });
      }
    });

    const ids = new Set<number>();
    const details = new Map<number, string[]>();
    dayLocMap.forEach(entries => {
      if (entries.length < 2) return;
      entries.forEach(e => {
        ids.add(e.taskId);
        const others = entries.filter(o => o.taskId !== e.taskId).map(o => o.crew);
        const existing = details.get(e.taskId) ?? [];
        details.set(e.taskId, [...new Set([...existing, ...others])]);
      });
    });

    return { conflictTaskIds: ids, conflictDetails: details };
  }, [tasks]);

  // Tasks that have weather-sensitive work on a hazardous day
  const weatherRiskTaskIds = useMemo(() => {
    const ids = new Set<number>();
    tasks.forEach(task => {
      const wt = task.work_type;
      if (!wt || !WEATHER_SENSITIVE.some(s => wt.includes(s))) return;
      for (let d = task.dayIndex; d < task.dayIndex + task.duration; d++) {
        const h = weatherHazards[d];
        if (h && (h.isRain || h.isHeat || h.isFreeze)) { ids.add(task.id); break; }
      }
    });
    return ids;
  }, [tasks, weatherHazards]);

  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case 'weather':   return tasks.filter(t => weatherRiskTaskIds.has(t.id));
      case 'conflict':  return tasks.filter(t => conflictTaskIds.has(t.id));
      case 'critical':  return tasks.filter(t => t.readiness === 'blocked' || t.readiness === 'constrained');
      default:          return tasks;
    }
  }, [tasks, activeFilter, weatherRiskTaskIds, conflictTaskIds]);

  const handleDragStart = (taskId: number) => setDragTask(taskId);
  const handleDrop = (dayIndex: number, crew: string) => {
    if (dragTask && onTaskMove) onTaskMove(dragTask, dayIndex, crew);
    setDragTask(null);
    setHoveredCell(null);
  };

  // Badge for a day column header
  const getDayWeatherBadge = (dayIdx: number): { icon: string; color: string; tooltip: string } | null => {
    const h = weatherHazards[dayIdx];
    if (!h) return null;
    if (h.isRain)   return { icon: '💧', color: '#3A7BC8', tooltip: `${h.day.precip_probability}% precipitation chance` };
    if (h.isFreeze) return { icon: '❄',  color: '#5B8DEF', tooltip: `Freeze warning: ${h.day.temp_low}°F low` };
    if (h.isHeat)   return { icon: '🌡', color: colors.statusCritical, tooltip: `Extreme heat: ${h.day.temp_high}°F high` };
    return null;
  };

  // Amber warning badge for a task card
  const getTaskWeatherBadge = (task: LookaheadTask): { text: string; tooltip: string } | null => {
    const wt = task.work_type;
    if (!wt || !WEATHER_SENSITIVE.some(s => wt.includes(s))) return null;
    for (let d = task.dayIndex; d < task.dayIndex + task.duration; d++) {
      const h = weatherHazards[d];
      if (!h) continue;
      if (h.isRain)   return { text: '⚠ Weather Risk', tooltip: `Rain: ${h.day.precip_probability}% chance on ${h.day.date}. ${h.day.conditions}.` };
      if (h.isFreeze) return { text: '⚠ Weather Risk', tooltip: `Freeze: ${h.day.temp_low}°F low on ${h.day.date}. ${h.day.conditions}.` };
      if (h.isHeat)   return { text: '⚠ Weather Risk', tooltip: `Heat: ${h.day.temp_high}°F high on ${h.day.date}. ${h.day.conditions}.` };
    }
    return null;
  };

  const filterPills: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',      label: 'All',               count: tasks.length },
    { key: 'weather',  label: 'Weather Risks',      count: weatherRiskTaskIds.size },
    { key: 'conflict', label: 'Trade Conflicts',    count: conflictTaskIds.size },
    { key: 'critical', label: 'Critical Path Only', count: tasks.filter(t => t.readiness === 'blocked' || t.readiness === 'constrained').length },
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
        {filterPills.map(pill => (
          <button
            key={pill.key}
            onClick={() => setActiveFilter(pill.key)}
            style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              border: `1px solid ${activeFilter === pill.key ? colors.primaryOrange : colors.borderDefault}`,
              borderRadius: borderRadius.full,
              backgroundColor: activeFilter === pill.key ? colors.orangeSubtle : 'transparent',
              color: activeFilter === pill.key ? colors.orangeText : colors.textSecondary,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              transition: `all ${transitions.instant}`,
            }}
          >
            {pill.label} ({pill.count})
          </button>
        ))}
      </div>

      <div style={{ minWidth: `${visibleDays.length * 120 + 140}px` }}>
        {/* Color legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['2'], flexWrap: 'wrap' }}>
          {[
            { icon: '✓', color: colors.statusActive,   label: 'All Clear' },
            { icon: '▲', color: colors.statusPending,   label: 'Has Constraints' },
            { icon: '●', color: colors.primaryOrange,   label: 'Constraint Resolved' },
            { icon: '⊘', color: colors.statusCritical,  label: 'Blocked' },
            { icon: '—', color: colors.textTertiary,    label: 'No Work Planned' },
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
            const wb = getDayWeatherBadge(i);
            return (
              <div
                key={day}
                title={wb?.tooltip}
                style={{
                  padding: `${spacing['2']} ${spacing['2']}`, textAlign: 'center',
                  backgroundColor: isToday ? colors.orangeSubtle : wb ? `${wb.color}10` : colors.surfaceInset,
                  borderBottom: isToday ? `2px solid ${colors.primaryOrange}` : 'none',
                }}
              >
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: isToday ? colors.orangeText : colors.textPrimary }}>{day}</span>
                {wb && (
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', marginLeft: spacing['1'],
                      padding: `1px ${spacing['1']}`, borderRadius: borderRadius.sm,
                      backgroundColor: `${wb.color}18`, color: wb.color,
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                    }}
                  >
                    {wb.icon}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Swimlanes */}
        {crews.map((crew) => {
          const crewTasks = filteredTasks.filter((t) => t.crew === crew);
          return (
            <div
              key={crew}
              style={{ display: 'grid', gridTemplateColumns: `140px repeat(${visibleDays.length}, 1fr)`, gap: 1, minHeight: '60px' }}
            >
              <div style={{
                padding: `${spacing['3']}`, backgroundColor: colors.surfaceRaised,
                borderRight: `1px solid ${colors.borderSubtle}`,
                display: 'flex', alignItems: 'center',
              }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{crew}</span>
              </div>

              {visibleDays.map((_day, dayIdx) => {
                const cellKey = `${crew}-${dayIdx}`;
                const cellTasks = crewTasks.filter((t) => dayIdx >= t.dayIndex && dayIdx < t.dayIndex + t.duration);
                const isDragOver = hoveredCell === cellKey && dragTask !== null;
                const colBadge = getDayWeatherBadge(dayIdx);

                return (
                  <div
                    key={cellKey}
                    onDragOver={(e) => { e.preventDefault(); setHoveredCell(cellKey); }}
                    onDragLeave={() => setHoveredCell(null)}
                    onDrop={() => handleDrop(dayIdx, crew)}
                    style={{
                      padding: spacing['1'],
                      backgroundColor: isDragOver
                        ? colors.orangeSubtle
                        : colBadge
                          ? `${colBadge.color}07`
                          : cellTasks.length === 0 ? colors.surfaceInset : colors.surfaceRaised,
                      borderRight: `1px solid ${colors.borderSubtle}`,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                      minHeight: '56px',
                      transition: `background-color ${transitions.instant}`,
                    }}
                  >
                    {cellTasks.map((task) => {
                      if (dayIdx !== task.dayIndex) return null;
                      const rColor = readinessColors[task.readiness];
                      const unresolvedCount = task.constraints.filter((c) => !c.resolved).length;
                      const weatherBadge = getTaskWeatherBadge(task);
                      const hasConflict = conflictTaskIds.has(task.id);
                      const conflictTrades = conflictDetails.get(task.id) ?? [];

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
                          <p style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.snug, fontSize: typography.fontSize.caption }}>{task.title}</p>

                          {/* Inline badge row for weather + conflict */}
                          {(weatherBadge || hasConflict) && (
                            <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
                              {weatherBadge && (
                                <span
                                  title={weatherBadge.tooltip}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 2,
                                    padding: `1px ${spacing['1']}`,
                                    backgroundColor: `${colors.statusPending}14`, color: colors.statusPending,
                                    borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption,
                                    fontWeight: typography.fontWeight.medium, cursor: 'help',
                                  }}
                                >
                                  {weatherBadge.text}
                                </span>
                              )}
                              {hasConflict && (
                                <span
                                  title={`Trade conflict with: ${conflictTrades.join(', ')}`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 2,
                                    padding: `1px ${spacing['1']}`,
                                    backgroundColor: `${colors.statusCritical}14`, color: colors.statusCritical,
                                    borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption,
                                    fontWeight: typography.fontWeight.medium, cursor: 'help',
                                  }}
                                >
                                  Trade Conflict
                                </span>
                              )}
                            </div>
                          )}

                          {/* Constraint chips */}
                          {unresolvedCount > 0 && (
                            <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
                              {task.constraints.filter((c) => !c.resolved).map((c, ci) => (
                                <span
                                  key={ci}
                                  onClick={(e) => { e.stopPropagation(); onConstraintToggle?.(task.id, task.constraints.indexOf(c)); }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 2,
                                    padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.caption,
                                    backgroundColor: `${colors.statusPending}14`, color: colors.statusPending,
                                    borderRadius: borderRadius.sm, cursor: 'pointer', fontWeight: typography.fontWeight.medium,
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
                              <span style={{ fontSize: typography.fontSize.caption, color: colors.statusActive }}>All clear</span>
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
