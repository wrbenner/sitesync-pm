import React from 'react';
import { Sparkles, AlertTriangle, ToggleLeft, ToggleRight, Sun, Cloud, CloudRain, Snowflake } from 'lucide-react';
import { Btn, useToast } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { ScheduleCanvas } from '../../components/schedule/ScheduleCanvas';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import type { PredictedRisk, WeatherDay } from '../../lib/predictions';
import type { SchedulePhase } from '../../stores/scheduleStore';
import { ScheduleMobileList } from './ScheduleMobileList';

type ViewMode = 'gantt' | 'list';
type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';
type MobileFilter = 'all' | 'in_progress' | 'delayed' | 'critical_path';

interface ScheduleGanttProps {
  schedulePhases: SchedulePhase[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isMobile: boolean;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  zoomLevel: ZoomLevel;
  setZoomLevel: (z: ZoomLevel) => void;
  whatIfMode: boolean;
  setWhatIfMode: React.Dispatch<React.SetStateAction<boolean>>;
  showBaseline: boolean;
  setShowBaseline: React.Dispatch<React.SetStateAction<boolean>>;
  hasBaselineData: boolean;
  mobileFilter: MobileFilter;
  setMobileFilter: (f: MobileFilter) => void;
  weatherRecords: Array<{ date: string; conditions: string | null }>;
  initialForecast: WeatherDay[];
  risks: PredictedRisk[];
  setShowImportModal: (v: boolean) => void;
  setScheduleAnnouncement: (s: string) => void;
  onPhaseUpdate?: (id: string, updates: { start_date?: string; end_date?: string; percent_complete?: number }) => void;
}

// ── Weather icon helper ─────────────────────────────────
function WeatherIcon({ conditions }: { conditions: string }) {
  const cond = conditions.toLowerCase();
  if (cond.includes('snow')) return <Snowflake size={13} color="#93C5FD" />;
  if (cond.includes('rain') || cond.includes('storm')) return <CloudRain size={13} color="#60A5FA" />;
  if (cond.includes('cloud') || cond.includes('overcast')) return <Cloud size={13} color={colors.textTertiary} />;
  return <Sun size={13} color="#FBBF24" />;
}

export const ScheduleGantt: React.FC<ScheduleGanttProps> = ({
  schedulePhases,
  loading,
  error,
  refetch,
  isMobile,
  viewMode,
  setViewMode,
  zoomLevel,
  setZoomLevel,
  whatIfMode,
  setWhatIfMode,
  showBaseline,
  setShowBaseline,
  hasBaselineData,
  mobileFilter,
  setMobileFilter,
  weatherRecords,
  initialForecast,
  risks: _risks,
  setShowImportModal,
  setScheduleAnnouncement,
  onPhaseUpdate: _onPhaseUpdate,
}) => {
  const { addToast } = useToast();

  // Error state
  if (error) {
    return (
      <div style={{
        backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2',
        borderRadius: borderRadius.xl, padding: spacing['6'],
        display: 'flex', alignItems: 'flex-start', gap: spacing['4'],
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: borderRadius.lg,
          backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <AlertTriangle size={20} color="#DC2626" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: '#991B1B', fontSize: typography.fontSize.body }}>
            Unable to load schedule data
          </p>
          <p style={{ margin: `${spacing['2']} 0 ${spacing['4']}`, color: '#7F1D1D', fontSize: typography.fontSize.sm, lineHeight: typography.lineHeight.relaxed }}>
            {error}
          </p>
          <Btn variant="danger" size="sm" onClick={refetch}>
            Retry
          </Btn>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && schedulePhases.length === 0) {
    return (
      <div style={{
        backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
        border: `1px solid ${colors.borderSubtle}`, padding: spacing['8'],
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400,
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: 440, textAlign: 'center', gap: spacing['5'],
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: borderRadius['2xl'],
            background: `linear-gradient(135deg, ${colors.orangeSubtle}, ${colors.brand50})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={32} color={colors.primaryOrange} strokeWidth={1.5} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Build your project schedule
            </p>
            <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.body, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
              Create phases and activities to track every milestone from mobilization to closeout.
            </p>
          </div>
          <div style={{ display: 'flex', gap: spacing['3'] }}>
            <button onClick={() => setShowImportModal(true)} style={{
              padding: `${spacing['3']} ${spacing['6']}`, backgroundColor: colors.primaryOrange,
              color: colors.white, border: 'none', borderRadius: borderRadius.lg,
              fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily, cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(244,120,32,0.3)',
            }}>
              Import Schedule
            </button>
            <button onClick={() => setShowImportModal(true)} style={{
              padding: `${spacing['3']} ${spacing['6']}`, backgroundColor: 'transparent',
              color: colors.textPrimary, border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.lg, fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, cursor: 'pointer',
            }}>
              Create First Phase
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <ScheduleMobileList
        schedulePhases={schedulePhases}
        mobileFilter={mobileFilter}
        setMobileFilter={setMobileFilter}
        setShowImportModal={setShowImportModal}
        setScheduleAnnouncement={setScheduleAnnouncement}
      />
    );
  }

  // ── Desktop Gantt/List view ───────────────────────────
  const weatherDays = weatherRecords.length > 0
    ? weatherRecords.slice(0, 7).map(r => ({ date: r.date, conditions: r.conditions ?? 'Clear' }))
    : initialForecast.slice(0, 7).map(d => ({ date: d.date, conditions: d.conditions as string }));

  const hasAdverseWeather = weatherDays.some(d => {
    const c = d.conditions.toLowerCase();
    return c.includes('rain') || c.includes('storm') || c.includes('snow');
  });

  return (
    <>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: spacing['4'], flexWrap: 'wrap', gap: spacing['3'],
      }}>
        {/* Left side: title + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'] }}>
            <span style={{
              fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
            }}>
              Timeline
            </span>
            <span style={{
              fontSize: typography.fontSize.sm, color: colors.textTertiary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {schedulePhases.length} {schedulePhases.length === 1 ? 'activity' : 'activities'}
            </span>
          </div>

          {/* View mode toggle */}
          <div role="group" aria-label="View mode" style={{
            display: 'flex', gap: 1, backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.full, padding: 2,
          }}>
            {(['gantt', 'list'] as const).map(mode => (
              <button key={mode} aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)}
                style={{
                  padding: `${spacing['1.5']} ${spacing['4']}`, border: 'none',
                  borderRadius: borderRadius.full,
                  backgroundColor: viewMode === mode ? colors.white : 'transparent',
                  color: viewMode === mode ? colors.textPrimary : colors.textTertiary,
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                  boxShadow: viewMode === mode ? shadows.sm : 'none',
                  textTransform: 'capitalize' as const, transition: transitions.quick,
                }}
              >
                {mode === 'gantt' ? 'Gantt' : 'List'}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], flexWrap: 'wrap' }}>
          {/* Weather preview (compact) */}
          {weatherDays.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['1.5'],
              padding: `${spacing['1']} ${spacing['3']}`,
              backgroundColor: hasAdverseWeather ? '#FEF3C720' : colors.surfaceInset,
              border: `1px solid ${hasAdverseWeather ? '#FDE68A40' : colors.borderSubtle}`,
              borderRadius: borderRadius.full,
            }}>
              <span style={{ fontSize: 10, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                7d
              </span>
              {weatherDays.map(day => (
                <WeatherIcon key={day.date} conditions={day.conditions} />
              ))}
            </div>
          )}

          {/* Separator */}
          {weatherDays.length > 0 && (
            <span style={{ width: 1, height: 20, backgroundColor: colors.borderSubtle, flexShrink: 0 }} />
          )}

          {/* Zoom controls */}
          <div role="group" aria-label="Zoom level" style={{
            display: 'flex', gap: 1, backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.full, padding: 2,
          }}>
            {([
              { value: 'day' as const, label: 'D' },
              { value: 'week' as const, label: 'W' },
              { value: 'month' as const, label: 'M' },
              { value: 'quarter' as const, label: 'Q' },
            ]).map(z => (
              <button key={z.value} aria-label={`Zoom to ${z.value} view`} aria-pressed={zoomLevel === z.value}
                onClick={() => setZoomLevel(z.value)}
                style={{
                  padding: `${spacing['1.5']} ${spacing['3']}`, border: 'none',
                  borderRadius: borderRadius.full, minWidth: 32,
                  backgroundColor: zoomLevel === z.value ? colors.white : 'transparent',
                  color: zoomLevel === z.value ? colors.textPrimary : colors.textTertiary,
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                  boxShadow: zoomLevel === z.value ? shadows.sm : 'none',
                  transition: transitions.quick,
                }}
              >
                {z.label}
              </button>
            ))}
          </div>

          {/* Separator */}
          <span style={{ width: 1, height: 20, backgroundColor: colors.borderSubtle, flexShrink: 0 }} />

          {/* Baseline toggle */}
          {hasBaselineData && (
            <button
              onClick={() => setShowBaseline(!showBaseline)}
              aria-label={showBaseline ? 'Hide baseline' : 'Show baseline'}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1.5'],
                padding: `${spacing['1.5']} ${spacing['3']}`,
                border: `1px solid ${showBaseline ? colors.primaryOrange + '40' : colors.borderDefault}`,
                borderRadius: borderRadius.full,
                backgroundColor: showBaseline ? colors.orangeSubtle : 'transparent',
                color: showBaseline ? colors.primaryOrange : colors.textSecondary,
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily, cursor: 'pointer',
                transition: transitions.quick,
              }}
            >
              {showBaseline ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              Baseline
            </button>
          )}

          {/* What-if mode */}
          <button
            onClick={() => setWhatIfMode(prev => !prev)}
            aria-label={whatIfMode ? 'Exit what-if mode' : 'Enable what-if mode'}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1.5'],
              padding: `${spacing['1.5']} ${spacing['3']}`,
              border: `1px solid ${whatIfMode ? '#7C3AED40' : colors.borderDefault}`,
              borderRadius: borderRadius.full,
              backgroundColor: whatIfMode ? '#F5F3FF' : 'transparent',
              color: whatIfMode ? '#7C3AED' : colors.textSecondary,
              fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily, cursor: 'pointer',
              transition: transitions.quick,
            }}
          >
            <Sparkles size={13} />
            {whatIfMode ? 'Exit What-If' : 'What-If'}
          </button>
        </div>
      </div>

      {/* What-if mode banner */}
      {whatIfMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['3'],
          backgroundColor: '#F5F3FF', borderRadius: borderRadius.lg,
          border: '1px solid #DDD6FE',
        }}>
          <Sparkles size={16} color="#7C3AED" />
          <span style={{ fontSize: typography.fontSize.sm, color: '#5B21B6', fontWeight: typography.fontWeight.medium }}>
            What-If Mode — drag bars to simulate changes. Nothing is saved until you commit.
          </span>
        </div>
      )}

      {/* ── Main content ── */}
      <div
        role="region"
        aria-label={viewMode === 'gantt' ? 'Project Schedule Gantt Chart' : 'Schedule Activities List'}
        id="gantt-activities"
      >
        {viewMode === 'list' ? (
          <div style={{
            backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
            border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden',
            boxShadow: shadows.card,
          }}>
            <table role="grid" aria-label="Schedule activities" style={{
              width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm,
            }}>
              <thead>
                <tr style={{ backgroundColor: colors.surfaceInset }}>
                  {['Activity', 'Start', 'Finish', 'Duration', 'Status', 'Progress', 'Float'].map(h => (
                    <th key={h} style={{
                      padding: `${spacing['3']} ${spacing['4']}`, textAlign: 'left',
                      fontWeight: typography.fontWeight.semibold, color: colors.textTertiary,
                      fontSize: typography.fontSize.caption, textTransform: 'uppercase' as const,
                      letterSpacing: typography.letterSpacing.wider,
                      borderBottom: `1px solid ${colors.borderDefault}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody data-schedule-list>
                {schedulePhases.map((phase) => {
                  const statusLabel = (phase.status ?? 'not started').replace(/_/g, ' ');
                  const dur = Math.round((new Date(phase.endDate).getTime() - new Date(phase.startDate).getTime()) / 86400000);
                  const floatDays = phase.float_days ?? (phase as unknown as Record<string, unknown>).floatDays ?? 0;

                  const statusColors: Record<string, { fg: string; bg: string }> = {
                    completed: { fg: '#16A34A', bg: '#F0FDF4' },
                    in_progress: { fg: '#2563EB', bg: '#EFF6FF' },
                    delayed: { fg: '#D97706', bg: '#FEF3C7' },
                    planned: { fg: '#6B7280', bg: '#F3F4F6' },
                  };
                  const sc = statusColors[phase.status ?? 'planned'] ?? statusColors.planned;
                  const isCP = phase.is_critical_path === true;
                  const isMilestone = phase.startDate === phase.endDate;

                  return (
                    <tr key={phase.id} role="row" tabIndex={0}
                      aria-label={`${isMilestone ? 'Milestone: ' : ''}${phase.name}, ${statusLabel}, ${phase.progress ?? 0}% complete`}
                      style={{
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                        borderLeft: isCP ? '3px solid #EF4444' : isMilestone ? `3px solid ${colors.primaryOrange}` : '3px solid transparent',
                        cursor: 'pointer', transition: transitions.quick, outline: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => {
                        addToast('info', `${phase.name}: ${phase.progress}% complete`);
                        setScheduleAnnouncement(`Selected: ${phase.name}, ${statusLabel}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          addToast('info', `${phase.name}: ${phase.progress}% complete`);
                          setScheduleAnnouncement(`Selected: ${phase.name}, ${statusLabel}`);
                        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                          e.preventDefault();
                          const tbody = e.currentTarget.closest('[data-schedule-list]');
                          const rows = Array.from(tbody?.querySelectorAll<HTMLElement>('[role="row"]') ?? []);
                          const idx = rows.indexOf(e.currentTarget);
                          const next = e.key === 'ArrowDown' ? rows[idx + 1] : rows[idx - 1];
                          next?.focus();
                        }
                      }}
                    >
                      <td role="gridcell" style={{
                        padding: `${spacing['3']} ${spacing['4']}`, color: colors.textPrimary,
                        fontWeight: isCP ? typography.fontWeight.semibold : typography.fontWeight.normal,
                        maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          {isMilestone && <span style={{ fontSize: 10, color: colors.primaryOrange }}>◆</span>}
                          {isCP && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, backgroundColor: '#FEE2E2',
                              color: '#991B1B', padding: '1px 5px', borderRadius: 3,
                            }}>CP</span>
                          )}
                          <span>{phase.name}</span>
                        </div>
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing['3']} ${spacing['4']}`, color: colors.textSecondary, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing['3']} ${spacing['4']}`, color: colors.textSecondary, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing['3']} ${spacing['4']}`, color: colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                        {dur}d
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                        <span style={{
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          color: sc.fg, backgroundColor: sc.bg,
                          padding: `2px ${spacing['3']}`, borderRadius: borderRadius.full,
                          textTransform: 'capitalize' as const,
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          <div style={{
                            width: 48, height: 4, borderRadius: 2,
                            backgroundColor: colors.surfaceInset, overflow: 'hidden',
                          }}>
                            <div style={{ height: '100%', width: `${phase.progress ?? 0}%`, backgroundColor: sc.fg, borderRadius: 2 }} />
                          </div>
                          <span style={{
                            fontSize: typography.fontSize.caption, color: colors.textSecondary,
                            fontVariantNumeric: 'tabular-nums', minWidth: 28,
                          }}>
                            {phase.progress ?? 0}%
                          </span>
                        </div>
                      </td>
                      <td role="gridcell" style={{
                        padding: `${spacing['3']} ${spacing['4']}`,
                        color: Number(floatDays) === 0 ? '#DC2626' : colors.textTertiary,
                        fontWeight: Number(floatDays) === 0 ? typography.fontWeight.semibold : typography.fontWeight.normal,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {floatDays}d
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ErrorBoundary
            fallback={(err) => (
              <div style={{
                padding: spacing['6'], backgroundColor: '#FEF2F2',
                borderRadius: borderRadius.xl, border: '1px solid #FEE2E2',
              }}>
                <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: '#991B1B', fontSize: typography.fontSize.body }}>
                  Schedule could not be displayed
                </p>
                <details style={{ marginTop: spacing['3'] }}>
                  <summary style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, cursor: 'pointer' }}>
                    Technical details
                  </summary>
                  <pre style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {err.message}
                  </pre>
                </details>
                <button onClick={() => window.location.reload()} style={{
                  marginTop: spacing['4'], padding: `${spacing['2']} ${spacing['5']}`,
                  backgroundColor: '#DC2626', color: colors.white, border: 'none',
                  borderRadius: borderRadius.lg, fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer',
                }}>
                  Reload
                </button>
              </div>
            )}
          >
            <ScheduleCanvas
              phases={schedulePhases}
              zoom={zoomLevel}
              onSelectPhase={(phase) => {
                setScheduleAnnouncement(`Selected: ${phase.name} — ${(phase.status ?? 'not started').replace(/_/g, ' ')}`);
              }}
            />
          </ErrorBoundary>
        )}
      </div>
    </>
  );
};
