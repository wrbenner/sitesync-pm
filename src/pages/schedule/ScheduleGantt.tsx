import React from 'react';
import { Sparkles, AlertTriangle, ToggleLeft, ToggleRight, Sun, Cloud, CloudRain } from 'lucide-react';
import { Card, SectionHeader, Btn, useToast } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { GanttChart } from '../../components/schedule/GanttChart';
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
  risks,
  setShowImportModal,
  setScheduleAnnouncement,
}) => {
  const { addToast } = useToast();

  if (error) {
    return (
      <div style={{
        backgroundColor: colors.statusCriticalSubtle,
        border: '1px solid ${colors.statusCritical}40',
        borderRadius: borderRadius.lg,
        padding: spacing['5'],
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing['3'],
      }}>
        <AlertTriangle size={20} color={colors.statusCritical} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
            Unable to load schedule data
          </p>
          <p style={{ margin: `${spacing['1']} 0 ${spacing['3']}`, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
            {error}
          </p>
          <Btn variant="danger" size="sm" onClick={refetch}>
            Retry
          </Btn>
        </div>
      </div>
    );
  }

  if (!loading && schedulePhases.length === 0) {
    return (
      <Card padding={spacing['5']}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '320px' }}>
          <div
            role="status"
            aria-label="No schedule activities. Build your project schedule to get started."
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '48px', maxWidth: '480px', textAlign: 'center', gap: spacing['4'],
            }}>
            <AlertTriangle size={48} color="#9CA3AF" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: colors.textPrimary }}>
                Build your project schedule
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                Create phases and activities to track every milestone from mobilization to closeout. Import from Primavera P6 or Microsoft Project to get started quickly.
              </p>
            </div>
            <div style={{ display: 'flex', gap: spacing['3'] }}>
              <button
                onClick={() => addToast('info', 'Phase creation available in the next update')}
                style={{
                  padding: `${spacing.sm} ${spacing.xl}`, backgroundColor: colors.primaryOrange, color: colors.white,
                  border: 'none', borderRadius: borderRadius.md, fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer',
                }}
              >
                Create First Phase
              </button>
              <button
                onClick={() => addToast('info', 'P6/MS Project import available in the next update')}
                style={{
                  padding: `${spacing.sm} ${spacing.xl}`, backgroundColor: 'transparent', color: colors.textPrimary,
                  border: `1px solid ${colors.borderLight}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer',
                }}
              >
                Import Schedule
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

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

  // Desktop view: Gantt or List
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <SectionHeader title="Project Timeline" />
          <span
            aria-hidden="true"
            style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}
          >
            {schedulePhases.length > 0 ? `${schedulePhases.length} ${schedulePhases.length === 1 ? 'activity' : 'activities'}` : ''}
          </span>
          {/* Gantt / List view toggle */}
          <div role="group" aria-label="View mode" style={{ display: 'flex', gap: 2, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            {(['gantt', 'list'] as const).map(mode => (
              <button
                key={mode}
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                  backgroundColor: viewMode === mode ? colors.surfaceRaised : 'transparent',
                  color: viewMode === mode ? colors.textPrimary : colors.textTertiary,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                  boxShadow: viewMode === mode ? shadows.sm : 'none',
                  textTransform: 'capitalize',
                  transition: transitions.quick,
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {/* Zoom controls */}
          <div role="group" aria-label="Zoom level" style={{ display: 'flex', gap: 1, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            {([
              { value: 'day' as const, label: 'Day', ariaLabel: 'Zoom to day view' },
              { value: 'week' as const, label: 'Week', ariaLabel: 'Zoom to week view' },
              { value: 'month' as const, label: 'Month', ariaLabel: 'Zoom to month view' },
              { value: 'quarter' as const, label: 'Quarter', ariaLabel: 'Zoom to quarter view' },
            ]).map(z => (
              <button
                key={z.value}
                aria-label={z.ariaLabel}
                aria-pressed={zoomLevel === z.value}
                onClick={() => setZoomLevel(z.value)}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                  backgroundColor: zoomLevel === z.value ? colors.surfaceRaised : 'transparent',
                  color: zoomLevel === z.value ? colors.textPrimary : colors.textTertiary,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                  boxShadow: zoomLevel === z.value ? shadows.sm : 'none',
                  transition: transitions.quick,
                }}
              >
                {z.label}
              </button>
            ))}
          </div>
          {hasBaselineData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                aria-hidden="true"
                style={{ width: 24, height: 10, background: 'rgba(156, 163, 175, 0.3)', border: '1px dashed #9CA3AF', borderRadius: 2, flexShrink: 0 }}
              />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Baseline</span>
            </div>
          )}
          <span title={!hasBaselineData ? 'No baseline dates available' : undefined} style={{ display: 'inline-flex' }}>
            <Btn
              variant={showBaseline ? 'primary' : 'secondary'}
              size="sm"
              icon={showBaseline ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              onClick={() => setShowBaseline(!showBaseline)}
              aria-label={showBaseline ? 'Hide baseline comparison' : 'Show baseline comparison'}
              disabled={!hasBaselineData}
              style={!showBaseline ? { border: `1px solid ${colors.borderDefault}`, background: 'transparent', color: colors.textPrimary } : {}}
            >
              {showBaseline ? 'Hide Baseline' : 'Show Baseline'}
            </Btn>
          </span>
          <Btn
            variant={whatIfMode ? 'primary' : 'secondary'}
            size="sm"
            icon={<Sparkles size={14} />}
            onClick={() => setWhatIfMode(!whatIfMode)}
            aria-label={whatIfMode ? 'Exit what-if scenario mode' : 'Enable what-if scenario mode'}
          >
            {whatIfMode ? 'Exit What If Mode' : 'What If Mode'}
          </Btn>
        </div>
      </div>
      <div
        role="region"
        aria-label={viewMode === 'gantt' ? 'Project Schedule Gantt Chart' : 'Schedule Activities List'}
        id="gantt-activities"
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          padding: spacing['5'],
          boxShadow: whatIfMode ? `0 0 0 2px ${colors.statusPending}40` : shadows.card,
          transition: `box-shadow ${transitions.quick}`,
          overflow: 'auto',
          minHeight: '500px',
        }}
      >
        {whatIfMode && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
            backgroundColor: `${colors.statusPending}08`, borderRadius: borderRadius.md,
            border: `1px solid ${colors.statusPending}20`,
          }}>
            <Sparkles size={14} color={colors.statusPending} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>
              What If Mode is active. Drag phase bars to simulate schedule changes and see cascade effects.
            </span>
          </div>
        )}

        {/* Weather overlay strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
          backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
          border: `1px solid ${colors.borderSubtle}`, overflowX: 'auto',
        }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium, whiteSpace: 'nowrap' }}>
            7-Day Forecast
          </span>
          {(weatherRecords.length > 0
            ? weatherRecords.slice(0, 7).map(r => ({ date: r.date, conditions: r.conditions ?? 'Clear' }))
            : initialForecast.map(d => ({ date: d.date, conditions: d.conditions as string }))
          ).map((day) => {
            const label = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
            const cond = day.conditions.toLowerCase();
            const isRain = cond.includes('rain') || cond.includes('storm') || cond.includes('snow');
            const isCloudy = cond.includes('cloud') || cond.includes('overcast');
            return (
              <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 44 }}>
                {isRain
                  ? <CloudRain size={14} color={colors.statusInfo} />
                  : isCloudy
                  ? <Cloud size={14} color={colors.textTertiary} />
                  : <Sun size={14} color="#F59E0B" />
                }
                <span style={{ fontSize: 10, color: colors.textTertiary, whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            );
          })}
        </div>

        {viewMode === 'list' ? (
          <div style={{ overflowX: 'auto' }}>
            <table role="grid" aria-label="Schedule activities" style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
              <thead>
                <tr style={{ backgroundColor: colors.surfaceInset }}>
                  {['Activity', 'Start', 'Finish', 'Duration', 'Status', '% Complete', 'Float'].map(h => (
                    <th key={h} style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, fontSize: typography.fontSize.caption, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${colors.borderSubtle}`, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody data-schedule-list>
                {schedulePhases.map((phase) => {
                  const statusLabel = (phase.status ?? 'not started').replace(/_/g, ' ');
                  const durationDays = Math.round((new Date(phase.endDate).getTime() - new Date(phase.startDate).getTime()) / 86400000);
                  const floatDays = phase.float_days ?? (phase as unknown as Record<string, unknown>).floatDays ?? 0;
                  const statusColor =
                    phase.status === 'completed' ? colors.textTertiary
                    : phase.status === 'in_progress' ? colors.statusInfo
                    : phase.status === 'delayed' ? colors.statusPending
                    : colors.textTertiary;
                  const isCP = phase.is_critical_path === true;
                  return (
                    <tr
                      key={phase.id}
                      role="row"
                      tabIndex={0}
                      aria-label={`${phase.name}, ${statusLabel}, ${phase.progress ?? 0}% complete, starts ${phase.startDate}`}
                      style={{
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                        borderLeft: isCP ? `3px solid ${colors.statusCritical}` : '3px solid transparent',
                        cursor: 'pointer', transition: transitions.quick, outline: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => addToast('info', `${phase.name}: ${phase.progress}% complete`)}
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
                      <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontWeight: isCP ? typography.fontWeight.semibold : typography.fontWeight.normal, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isCP && <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: colors.statusCritical, color: colors.white, padding: '0 4px', borderRadius: 3, lineHeight: '16px', marginRight: 6 }}>CP</span>}
                        {phase.name}
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                        {new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                        {new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textTertiary }}>
                        {durationDays}d
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}` }}>
                        <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: statusColor, backgroundColor: statusColor + '18', padding: '2px 8px', borderRadius: borderRadius.full }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                          <div style={{ width: 64, height: 6, borderRadius: 3, backgroundColor: colors.borderSubtle, overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ height: '100%', width: `${phase.progress ?? 0}%`, backgroundColor: statusColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, minWidth: 28 }}>{phase.progress ?? 0}%</span>
                        </div>
                      </td>
                      <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: Number(floatDays) === 0 ? colors.statusCritical : colors.textTertiary, fontWeight: Number(floatDays) === 0 ? typography.fontWeight.semibold : typography.fontWeight.normal }}>
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
              padding: spacing['5'], backgroundColor: colors.statusCriticalSubtle,
              borderRadius: borderRadius.md, border: '1px solid ${colors.statusCritical}40',
            }}>
              <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
                Schedule could not be displayed
              </p>
              <details style={{ marginTop: spacing['2'] }}>
                <summary style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, cursor: 'pointer' }}>
                  Technical details
                </summary>
                <pre style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {err.message}
                </pre>
              </details>
              <button
                onClick={() => window.location.reload()}
                style={{
                  marginTop: spacing['3'], padding: `${spacing['2']} ${spacing['4']}`,
                  backgroundColor: colors.statusCritical, color: colors.white,
                  border: 'none', borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily, cursor: 'pointer',
                }}
              >
                Reload
              </button>
            </div>
          )}
        >
          <GanttChart
            phases={schedulePhases}
            whatIfMode={whatIfMode}
            isLoading={loading}
            zoomLevel={zoomLevel}
            onImportSchedule={() => addToast('info', 'Schedule import available in the next update')}
            onAddActivity={() => addToast('info', 'Activity drawer available in the next update')}
            onPhaseClick={(phase) => {
              addToast('info', `${phase.name}: ${phase.progress}% complete`);
              setScheduleAnnouncement(`Schedule updated: ${phase.name} is now ${(phase.status ?? 'not started').replace(/_/g, ' ')}`);
            }}
            baselinePhases={schedulePhases}
            showBaseline={showBaseline}
            risks={risks}
          />
        </ErrorBoundary>
        )}
      </div>
    </>
  );
};
