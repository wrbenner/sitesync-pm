/**
 * The Plan — "Are we on track?"
 *
 * Shape: Book — chapters you can leaf through.
 * Schedule at a glance: progress, variance, critical path, upcoming work.
 * The orange dot marks the thing that threatens the timeline.
 */

import React, { useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { useCopilotStore } from '../../stores/copilotStore';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject } from '../../hooks/queries';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { useScheduleActivities } from '../../hooks/useScheduleActivities';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { colors, typography, transitions } from '../../styles/theme';
import {
  OrangeDot,
  Hairline,
  Eyebrow,
  SectionHeading,
} from '../../components/atoms';
import {

  ChevronRight,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,

} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusColor(status: string | null | undefined): string {
  if (!status) return colors.statusInfo;
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'on_track') return colors.statusActive;
  if (s === 'in_progress') return colors.statusPending;
  if (s === 'behind' || s === 'delayed' || s === 'critical') return colors.statusCritical;
  return colors.statusInfo;
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Not Started';
  const s = status.toLowerCase();
  if (s === 'completed') return 'Completed';
  if (s === 'on_track') return 'On Track';
  if (s === 'in_progress') return 'In Progress';
  if (s === 'behind') return 'Behind';
  if (s === 'delayed') return 'Delayed';
  if (s === 'critical') return 'Critical';
  if (s === 'not_started') return 'Not Started';
  return status;
}

// ── The Plan Page ────────────────────────────────────────────

const PlanPage: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();
  useEffect(() => { setPageContext('plan'); }, [setPageContext]);

  // ── Data ────────────────────────────────────────────────
  const { data: metrics, isPending: metricsLoading } = useProjectMetrics(projectId);
  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleActivities(projectId ?? '');

  const isLoading = metricsLoading || scheduleLoading;

  // ── Derived data ────────────────────────────────────────
  const criticalPathActivities = useMemo(() => {
    return (scheduleData ?? []).filter((a) => a.is_critical_path === true);
  }, [scheduleData]);

  const upcomingActivities = useMemo(() => {
    const today = new Date();
    const in14 = new Date();
    in14.setDate(today.getDate() + 14);
    const todayStr = today.toISOString().split('T')[0];
    const in14Str = in14.toISOString().split('T')[0];

    return (scheduleData ?? [])
      .filter((a) => {
        const start = a.start_date?.split('T')[0] ?? '';
        return start >= todayStr && start <= in14Str;
      })
      .sort((a, b) => {
        const da = a.start_date ?? '';
        const db = b.start_date ?? '';
        return da < db ? -1 : da > db ? 1 : 0;
      });
  }, [scheduleData]);

  // ── Behind-schedule alert ───────────────────────────────
  const isBehind = metrics?.schedule_variance_days != null && metrics.schedule_variance_days < 0;
  const varianceDays = metrics?.schedule_variance_days ?? 0;
  const varianceLabel = varianceDays === 0
    ? 'On schedule'
    : varianceDays > 0
      ? `+${varianceDays}d ahead`
      : `${varianceDays}d behind`;

  const progress = Math.round(metrics?.overall_progress ?? 0);
  const milestonesCompleted = metrics?.milestones_completed ?? 0;
  const milestonesTotal = metrics?.milestones_total ?? 0;

  // No project selected
  if (!projectId) return <ProjectGate />;

  return (
    <ErrorBoundary>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          backgroundColor: colors.parchment,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            padding: isMobile ? '16px 16px 0' : '36px 36px 0',
          }}
        >
          {/* ── Compact Header ──────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: typography.fontFamilySerif, fontSize: isMobile ? '20px' : '24px', color: colors.ink, lineHeight: 1.2 }}>
                The Plan
              </span>
              <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
                {project?.name ?? 'Project'}
              </span>
            </div>
            <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
              {!isOnline ? 'Offline' : 'Schedule'}
            </span>
          </div>

          {/* ── Summary Strip ────────────────────────── */}
          {isLoading ? (
            <PageState status="loading" />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 12 : 24,
                  flexWrap: 'wrap',
                  marginTop: 20,
                  marginBottom: 28,
                  padding: '16px 20px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--hairline)',
                  borderRadius: 10,
                }}
              >
                {/* Progress */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TrendingUp size={16} style={{ color: colors.ink4, flexShrink: 0 }} />
                  <div>
                    <Eyebrow style={{ display: 'block', marginBottom: 2 }}>Overall Progress</Eyebrow>
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontSize: '28px',
                        fontWeight: 400,
                        color: colors.ink,
                        lineHeight: 1,
                      }}
                    >
                      {progress}%
                    </span>
                  </div>
                </div>

                <div style={{ width: 1, height: 40, backgroundColor: 'var(--hairline)', flexShrink: 0 }} />

                {/* Schedule variance */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isBehind && <OrangeDot size={8} haloSpread={3} label="Behind schedule" />}
                  <Calendar size={16} style={{ color: isBehind ? colors.primaryOrange : colors.ink4, flexShrink: 0 }} />
                  <div>
                    <Eyebrow style={{ display: 'block', marginBottom: 2 }}>Schedule Variance</Eyebrow>
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontSize: '22px',
                        fontWeight: 400,
                        color: isBehind ? colors.statusCritical : colors.statusActive,
                        lineHeight: 1,
                      }}
                    >
                      {varianceLabel}
                    </span>
                  </div>
                </div>

                <div style={{ width: 1, height: 40, backgroundColor: 'var(--hairline)', flexShrink: 0 }} />

                {/* Milestones */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={16} style={{ color: colors.ink4, flexShrink: 0 }} />
                  <div>
                    <Eyebrow style={{ display: 'block', marginBottom: 2 }}>Milestones</Eyebrow>
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontSize: '22px',
                        fontWeight: 400,
                        color: colors.ink,
                        lineHeight: 1,
                      }}
                    >
                      {milestonesCompleted}
                      <span style={{ color: colors.ink4, fontSize: '16px' }}>
                        {' '}/{' '}{milestonesTotal}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Progress Bar ──────────────────────────── */}
              <Eyebrow style={{ marginBottom: 8, marginTop: 16 }}>Overall Progress</Eyebrow>
              <div style={{ marginBottom: 32 }}>
                <div
                  style={{
                    position: 'relative',
                    height: 8,
                    backgroundColor: 'var(--hairline)',
                    borderRadius: 100,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: `${Math.min(100, Math.max(0, progress))}%`,
                      backgroundColor: colors.statusActive,
                      borderRadius: 100,
                      transition: transitions.quick,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <Eyebrow>0%</Eyebrow>
                  <span
                    style={{
                      fontFamily: typography.fontFamilySerif,
                      fontSize: '14px',
                      color: colors.ink2,
                    }}
                  >
                    {progress}% complete
                  </span>
                  <Eyebrow>100%</Eyebrow>
                </div>
              </div>

              {/* ── Milestone Tracker ─────────────────────── */}
              <Eyebrow style={{ marginBottom: 8, marginTop: 16 }}>Milestones</Eyebrow>
              <div style={{ marginBottom: 32 }}>
                <div
                  style={{
                    position: 'relative',
                    height: 8,
                    backgroundColor: 'var(--hairline)',
                    borderRadius: 100,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: milestonesTotal > 0
                        ? `${Math.min(100, (milestonesCompleted / milestonesTotal) * 100)}%`
                        : '0%',
                      backgroundColor: colors.primaryOrange,
                      borderRadius: 100,
                      transition: transitions.quick,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <Eyebrow>0</Eyebrow>
                  <span
                    style={{
                      fontFamily: typography.fontFamilySerif,
                      fontSize: '14px',
                      color: colors.ink2,
                    }}
                  >
                    {milestonesCompleted} of {milestonesTotal} completed
                  </span>
                  <Eyebrow>{milestonesTotal}</Eyebrow>
                </div>
              </div>

              <Hairline weight={2} spacing="tight" />

              {/* ── Critical Path Activities ──────────────── */}
              <div style={{ marginTop: 24, marginBottom: 32 }}>
                <SectionHeading level={3} style={{ marginBottom: 16 }}>
                  Critical <em>Path</em>
                </SectionHeading>

                {criticalPathActivities.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--hairline)',
                      borderRadius: 10,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontStyle: 'italic',
                        fontSize: '15px',
                        color: colors.ink3,
                      }}
                    >
                      No critical path activities loaded.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {criticalPathActivities.map((activity) => (
                      <a
                        key={activity.id}
                        href="#/schedule"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '14px 16px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--hairline)',
                          borderRadius: 10,
                          textDecoration: 'none',
                          color: 'inherit',
                          transition: transitions.quick,
                        }}
                      >
                        <AlertTriangle size={14} style={{ color: colors.statusCritical, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: typography.fontFamily,
                              fontSize: '14px',
                              fontWeight: 500,
                              color: colors.ink,
                              marginBottom: 3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {activity.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <Eyebrow>
                              {formatShortDate(activity.start_date)} – {formatShortDate(activity.end_date)}
                            </Eyebrow>
                            <span
                              style={{
                                fontFamily: typography.fontFamilySerif,
                                fontSize: '13px',
                                color: colors.ink3,
                              }}
                            >
                              {activity.percent_complete ?? 0}% done
                            </span>
                          </div>
                        </div>
                        <Eyebrow
                          style={{
                            color: statusColor(activity.status),
                            flexShrink: 0,
                          }}
                        >
                          {statusLabel(activity.status)}
                        </Eyebrow>
                        <ChevronRight size={14} style={{ color: colors.ink4, flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <Hairline weight={1} spacing="tight" />

              {/* ── Upcoming Activities ───────────────────── */}
              <div style={{ marginTop: 24, marginBottom: 32 }}>
                <SectionHeading level={3} style={{ marginBottom: 16 }}>
                  Starting <em>soon</em>
                  <span
                    style={{
                      fontFamily: typography.fontFamily,
                      fontSize: '13px',
                      fontWeight: 400,
                      color: colors.ink4,
                      marginLeft: 12,
                      letterSpacing: 0,
                    }}
                  >
                    next 14 days
                  </span>
                </SectionHeading>

                {upcomingActivities.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--hairline)',
                      borderRadius: 10,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontStyle: 'italic',
                        fontSize: '15px',
                        color: colors.ink3,
                      }}
                    >
                      No activities starting in the next 14 days.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {upcomingActivities.map((activity) => (
                      <a
                        key={activity.id}
                        href="#/schedule"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '14px 16px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--hairline)',
                          borderRadius: 10,
                          textDecoration: 'none',
                          color: 'inherit',
                          transition: transitions.quick,
                        }}
                      >
                        <Clock size={14} style={{ color: colors.ink4, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: typography.fontFamily,
                              fontSize: '14px',
                              fontWeight: 500,
                              color: colors.ink,
                              marginBottom: 3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {activity.name}
                          </div>
                          <Eyebrow>
                            {formatShortDate(activity.start_date)} – {formatShortDate(activity.end_date)}
                          </Eyebrow>
                        </div>
                        <span
                          style={{
                            fontFamily: typography.fontFamilySerif,
                            fontSize: '13px',
                            color: colors.ink3,
                            flexShrink: 0,
                          }}
                        >
                          {activity.percent_complete ?? 0}%
                        </span>
                        <ChevronRight size={14} style={{ color: colors.ink4, flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <Hairline weight={2} spacing="tight" />

              {/* ── Quick Links ────────────────────────── */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24, marginBottom: 48 }}>
                <a href="#/schedule" style={{
                  fontFamily: typography.fontFamily, fontSize: '12px', fontWeight: 500,
                  color: colors.ink3, textDecoration: 'none', padding: '6px 14px',
                  borderRadius: 100, border: '1px solid var(--hairline)',
                  transition: transitions.quick,
                }}>Full Schedule</a>
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

// ── Export ─────────────────────────────────────────────────

export default PlanPage;
