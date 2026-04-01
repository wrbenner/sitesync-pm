import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, CloudRain, AlertTriangle, Calendar } from 'lucide-react';
import type { GanttPhase } from './GanttChart';
import type { PredictedRisk } from '../../lib/predictions';
import { usePermissions } from '../../hooks/usePermissions';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

// Returns the Monday of the ISO week containing the given date
function weekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getWeekKey(monday: Date): string {
  return monday.toISOString().slice(0, 10);
}

function getStatusColor(phase: GanttPhase): string {
  if (phase.completed) return colors.statusActive;
  if (phase.critical) return colors.statusCritical;
  if (phase.progress > 0) return colors.statusInfo;
  return colors.textTertiary;
}

function getStatusLabel(phase: GanttPhase): string {
  if (phase.completed) return 'Complete';
  if (phase.critical) return 'Critical Path';
  if (phase.progress > 0) return 'In Progress';
  return 'Not Started';
}

interface Props {
  phases: GanttPhase[];
  risks: PredictedRisk[];
}

export const MobileScheduleView: React.FC<Props> = ({ phases, risks }) => {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('schedule.edit');

  const dateStripRef = useRef<HTMLDivElement>(null);
  const weekRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [selectedPhase, setSelectedPhase] = useState<GanttPhase | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Swipe-to-close state for bottom sheet
  const sheetRef = useRef<HTMLDivElement>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeCurrentY = useRef<number | null>(null);

  const today = new Date();
  const currentWeekStart = weekStart(today);
  const currentWeekKey = getWeekKey(currentWeekStart);

  // Build the list of weeks spanning all phases
  const weeks = React.useMemo(() => {
    if (phases.length === 0) return [];
    const allMs = phases.flatMap(p => [
      new Date(p.startDate).getTime(),
      new Date(p.endDate).getTime(),
    ]);
    const firstWeek = weekStart(new Date(Math.min(...allMs)));
    const lastWeek = weekStart(new Date(Math.max(...allMs)));
    const result: Date[] = [];
    const cursor = new Date(firstWeek);
    const limit = new Date(lastWeek);
    limit.setDate(limit.getDate() + 7);
    while (cursor <= limit) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    return result;
  }, [phases]);

  // Group phases by the week their startDate falls in
  const phasesByWeek = React.useMemo(() => {
    const map: Record<string, GanttPhase[]> = {};
    for (const phase of phases) {
      const key = getWeekKey(weekStart(new Date(phase.startDate)));
      if (!map[key]) map[key] = [];
      map[key].push(phase);
    }
    return map;
  }, [phases]);

  const scrollToCurrentWeek = useCallback(() => {
    const el = weekRefs.current[currentWeekKey];
    const strip = dateStripRef.current;
    if (!el || !strip) return;
    strip.scrollTo({
      left: el.offsetLeft - strip.offsetWidth / 2 + el.offsetWidth / 2,
      behavior: 'smooth',
    });
  }, [currentWeekKey]);

  useEffect(() => {
    scrollToCurrentWeek();
  }, [scrollToCurrentWeek]);

  const openSheet = (phase: GanttPhase) => {
    setSelectedPhase(phase);
    // Delay visible state so the element mounts before animating in
    requestAnimationFrame(() => setSheetVisible(true));
  };

  const closeSheet = () => {
    setSheetVisible(false);
    if (sheetRef.current) sheetRef.current.style.transform = '';
    setTimeout(() => setSelectedPhase(null), 300);
  };

  const onSheetTouchStart = (e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0].clientY;
    swipeCurrentY.current = e.touches[0].clientY;
  };

  const onSheetTouchMove = (e: React.TouchEvent) => {
    if (swipeStartY.current === null) return;
    swipeCurrentY.current = e.touches[0].clientY;
    const dy = swipeCurrentY.current - swipeStartY.current;
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.transition = 'none';
    }
  };

  const onSheetTouchEnd = () => {
    if (swipeStartY.current === null || swipeCurrentY.current === null) return;
    const dy = swipeCurrentY.current - swipeStartY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
      sheetRef.current.style.transform = '';
    }
    if (dy > 80) closeSheet();
    swipeStartY.current = null;
    swipeCurrentY.current = null;
  };

  if (phases.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Horizontal date strip */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: colors.surfaceRaised,
        borderBottom: `1px solid ${colors.borderDefault}`,
      }}>
        <div
          ref={dateStripRef}
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            padding: `${spacing['3']} ${spacing['4']} 0`,
            gap: spacing['2'],
          }}
        >
          {weeks.map(week => {
            const key = getWeekKey(week);
            const isCurrent = key === currentWeekKey;
            return (
              <div
                key={key}
                ref={el => { weekRefs.current[key] = el; }}
                style={{
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  paddingBottom: spacing['2'],
                  padding: `${spacing['1']} ${spacing['2']} ${spacing['2']}`,
                  borderBottom: isCurrent
                    ? `2px solid ${colors.primaryOrange}`
                    : '2px solid transparent',
                  cursor: 'pointer',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  const section = document.getElementById(`week-section-${key}`);
                  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <span style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.medium,
                  color: isCurrent ? colors.primaryOrange : colors.textSecondary,
                  whiteSpace: 'nowrap',
                }}>
                  {isCurrent ? 'This Week' : formatWeekLabel(week)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Today button */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: `${spacing['1']} ${spacing['4']} ${spacing['2']}`,
        }}>
          <button
            onClick={scrollToCurrentWeek}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.medium,
              color: colors.primaryOrange,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
              padding: `${spacing['1']} 0`,
              minHeight: '44px',
            }}
          >
            <Calendar size={12} />
            Today
          </button>
        </div>
      </div>

      {/* Phase cards grouped by week */}
      <div style={{ padding: `${spacing['4']} ${spacing['4']} ${spacing['6']}` }}>
        {weeks.map(week => {
          const key = getWeekKey(week);
          const weekPhases = phasesByWeek[key];
          if (!weekPhases || weekPhases.length === 0) return null;
          const isCurrent = key === currentWeekKey;

          return (
            <div key={key} id={`week-section-${key}`} style={{ marginBottom: spacing['6'] }}>
              {/* Week label */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                marginBottom: spacing['3'],
              }}>
                <span style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: isCurrent ? colors.primaryOrange : colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {isCurrent ? 'This Week' : `Week of ${formatWeekLabel(week)}`}
                </span>
                {isCurrent && (
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: colors.primaryOrange,
                  }} />
                )}
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                {weekPhases.map(phase => {
                  const risk = risks.find(r => r.phaseId === phase.id);
                  const statusColor = getStatusColor(phase);

                  return (
                    <div
                      key={phase.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${phase.name}, ${phase.progress}% complete. Tap for details.`}
                      onClick={() => openSheet(phase)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openSheet(phase); }}
                      style={{
                        backgroundColor: colors.surfaceRaised,
                        borderRadius: borderRadius.lg,
                        padding: '16px',
                        minHeight: '48px',
                        border: `1px solid ${colors.borderDefault}`,
                        boxShadow: shadows.sm,
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                        outline: 'none',
                        // Ensure no horizontal overflow
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Name row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing['2'],
                        marginBottom: spacing['2'],
                        minWidth: 0,
                      }}>
                        {/* Status dot */}
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: statusColor,
                          flexShrink: 0,
                        }} />
                        <span style={{
                          flex: 1,
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {phase.name}
                        </span>
                        {/* Badges */}
                        <div style={{
                          display: 'flex',
                          gap: spacing['1'],
                          alignItems: 'center',
                          flexShrink: 0,
                        }}>
                          {phase.floatDays != null && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: typography.fontWeight.semibold,
                              backgroundColor: phase.floatDays === 0
                                ? `${colors.statusCritical}18`
                                : `${colors.statusInfo}12`,
                              color: phase.floatDays === 0 ? colors.statusCritical : colors.statusInfo,
                              padding: '1px 6px',
                              borderRadius: borderRadius.full,
                              lineHeight: '16px',
                              whiteSpace: 'nowrap',
                            }}>
                              {phase.floatDays}d float
                            </span>
                          )}
                          {risk && (
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              fontSize: '10px',
                              fontWeight: typography.fontWeight.semibold,
                              backgroundColor: `${colors.statusPending}18`,
                              color: colors.statusPending,
                              padding: '1px 6px',
                              borderRadius: borderRadius.full,
                              lineHeight: '16px',
                              whiteSpace: 'nowrap',
                            }}>
                              <CloudRain size={9} />
                              Risk
                            </span>
                          )}
                        </div>
                        <ChevronRight size={14} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                      </div>

                      {/* Progress bar */}
                      <div style={{
                        width: '100%',
                        height: 4,
                        backgroundColor: colors.surfaceInset,
                        borderRadius: borderRadius.full,
                        marginBottom: spacing['2'],
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${phase.progress}%`,
                          backgroundColor: statusColor,
                          borderRadius: borderRadius.full,
                        }} />
                      </div>

                      {/* Date and progress meta */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing['3'],
                        flexWrap: 'wrap',
                        fontSize: '11px',
                        color: colors.textTertiary,
                      }}>
                        <span>
                          {new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' \u2013 '}
                          {new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span>{phase.progress}% complete</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom sheet backdrop */}
      {selectedPhase && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            backgroundColor: 'rgba(0,0,0,0.4)',
            opacity: sheetVisible ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
          onClick={closeSheet}
        />
      )}

      {/* Bottom sheet */}
      {selectedPhase && (() => {
        const phase = selectedPhase;
        const risk = risks.find(r => r.phaseId === phase.id);
        const statusColor = getStatusColor(phase);

        const detailRows = [
          {
            label: 'Start',
            value: new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
            }),
          },
          {
            label: 'Finish',
            value: new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
            }),
          },
          { label: 'Status', value: getStatusLabel(phase) },
          ...(phase.floatDays != null ? [{ label: 'Float', value: `${phase.floatDays} days` }] : []),
          ...((phase.slippageDays ?? 0) > 0 ? [{ label: 'Slippage', value: `+${phase.slippageDays} days` }] : []),
        ];

        return (
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${phase.name} details`}
            onTouchStart={onSheetTouchStart}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              backgroundColor: colors.surfaceRaised,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: shadows.dropdown,
              transform: sheetVisible ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
              maxHeight: '80vh',
              overflowY: 'auto',
              // Prevent content from going under home indicator on iOS
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drag handle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 12,
              paddingBottom: 8,
            }}>
              <div style={{
                width: 36,
                height: 4,
                backgroundColor: colors.borderDefault,
                borderRadius: borderRadius.full,
              }} />
            </div>

            {/* Sheet header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${spacing['2']} ${spacing['4']} ${spacing['3']}`,
              borderBottom: `1px solid ${colors.borderDefault}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                }} />
                <span style={{
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                }}>
                  {phase.name}
                </span>
              </div>
              <button
                onClick={closeSheet}
                aria-label="Close"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: colors.surfaceInset,
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={16} color={colors.textTertiary} />
              </button>
            </div>

            {/* Sheet body */}
            <div style={{ padding: `${spacing['4']} ${spacing['4']} ${spacing['6']}` }}>
              {/* Progress bar */}
              <div style={{ marginBottom: spacing['4'] }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: spacing['2'],
                }}>
                  <span style={{
                    fontSize: typography.fontSize.caption,
                    color: colors.textTertiary,
                    fontWeight: typography.fontWeight.medium,
                  }}>
                    Progress
                  </span>
                  <span style={{
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                  }}>
                    {phase.progress}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: 8,
                  backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.full,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${phase.progress}%`,
                    backgroundColor: statusColor,
                    borderRadius: borderRadius.full,
                  }} />
                </div>
              </div>

              {/* Detail rows */}
              {detailRows.map(row => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: spacing['2'],
                    paddingBottom: spacing['2'],
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <span style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textTertiary,
                  }}>
                    {row.label}
                  </span>
                  <span style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textPrimary,
                    fontWeight: typography.fontWeight.medium,
                    textAlign: 'right',
                    maxWidth: '60%',
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}

              {/* Weather risk callout */}
              {risk && (
                <div style={{
                  marginTop: spacing['4'],
                  padding: spacing['3'],
                  backgroundColor: `${colors.statusPending}10`,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.statusPending}25`,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['2'],
                    marginBottom: spacing['1'],
                  }}>
                    <AlertTriangle size={14} color={colors.statusPending} />
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.statusPending,
                    }}>
                      {risk.likelihoodPercent}% likely, +{risk.impactDays}d impact
                    </span>
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: typography.fontSize.caption,
                    color: colors.textSecondary,
                    lineHeight: typography.lineHeight.relaxed,
                  }}>
                    {risk.reason}
                  </p>
                </div>
              )}

              {/* Edit Dates action (permission gated) */}
              {canEdit && (
                <button
                  style={{
                    marginTop: spacing['4'],
                    width: '100%',
                    padding: spacing['3'],
                    backgroundColor: colors.primaryOrange,
                    color: '#fff',
                    border: 'none',
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  Edit Dates
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
