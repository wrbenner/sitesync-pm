import React, { useMemo } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Clock, Circle, ChevronRight } from 'lucide-react';
import { useToast } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { PermissionGate } from '../../components/auth/PermissionGate';
import type { SchedulePhase } from '../../stores/scheduleStore';

type MobileFilter = 'all' | 'active' | 'delayed' | 'critical_path';

interface ScheduleMobileListProps {
  schedulePhases: SchedulePhase[];
  mobileFilter: MobileFilter;
  setMobileFilter: (f: MobileFilter) => void;
  setShowImportModal: (v: boolean) => void;
  setScheduleAnnouncement: (s: string) => void;
}

// ── Status helpers ──────────────────────────────────────────

type VisualStatus = 'completed' | 'active' | 'behind' | 'upcoming';

function visualStatus(p: SchedulePhase): VisualStatus {
  if (p.status === 'completed') return 'completed';
  if (p.status === 'delayed' || p.status === 'at_risk') return 'behind';
  if (p.status === 'active' || p.status === 'on_track') return 'active';
  return 'upcoming';
}

const STATUS_CONFIG: Record<VisualStatus, {
  fg: string; bg: string; label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}> = {
  completed: { fg: '#16A34A', bg: '#F0FDF4', label: 'Completed', Icon: CheckCircle2 },
  active:    { fg: '#2563EB', bg: '#EFF6FF', label: 'Active',    Icon: Clock },
  behind:    { fg: '#DC2626', bg: '#FEF2F2', label: 'Behind',    Icon: AlertTriangle },
  upcoming:  { fg: '#6B7280', bg: '#F3F4F6', label: 'Upcoming',  Icon: Circle },
};

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

function durationDays(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));
}

// ── Component ───────────────────────────────────────────────

export const ScheduleMobileList: React.FC<ScheduleMobileListProps> = ({
  schedulePhases,
  mobileFilter,
  setMobileFilter,
  setShowImportModal,
  setScheduleAnnouncement,
}) => {
  const { addToast } = useToast();

  const filtered = useMemo(() => {
    return schedulePhases.filter((p) => {
      if (mobileFilter === 'all') return true;
      if (mobileFilter === 'critical_path') return p.is_critical_path === true;
      if (mobileFilter === 'delayed') return p.status === 'delayed' || p.status === 'at_risk';
      return p.status === mobileFilter || (mobileFilter === 'active' && p.status === 'on_track');
    });
  }, [schedulePhases, mobileFilter]);

  // Summary counts for filter badges
  const counts = useMemo(() => ({
    all: schedulePhases.length,
    active: schedulePhases.filter(p => p.status === 'active' || p.status === 'on_track').length,
    delayed: schedulePhases.filter(p => p.status === 'delayed' || p.status === 'at_risk').length,
    critical_path: schedulePhases.filter(p => p.is_critical_path === true).length,
  }), [schedulePhases]);

  const overallProgress = useMemo(() => {
    if (schedulePhases.length === 0) return 0;
    return Math.round(schedulePhases.reduce((s, p) => s + (p.progress ?? 0), 0) / schedulePhases.length);
  }, [schedulePhases]);

  return (
    <div style={{ fontFamily: typography.fontFamily }}>
      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: colors.surfacePage,
        paddingTop: spacing['3'], paddingBottom: spacing['2'],
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: spacing['3'],
        }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: typography.fontSize.title ?? '1.25rem',
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
            }}>
              Schedule
            </h1>
            <span style={{
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {schedulePhases.length} activities · {overallProgress}% complete
            </span>
          </div>
          <PermissionGate permission="schedule.edit">
            <button
              onClick={() => setShowImportModal(true)}
              aria-label="Import schedule"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.lg,
                backgroundColor: colors.surfaceRaised,
                cursor: 'pointer',
              }}
            >
              <Upload size={16} color={colors.textSecondary} />
            </button>
          </PermissionGate>
        </div>

        {/* ── Overall progress bar ── */}
        <div style={{
          height: 4, borderRadius: 2,
          backgroundColor: colors.surfaceInset,
          overflow: 'hidden', marginBottom: spacing['3'],
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${overallProgress}%`,
            backgroundColor: colors.primaryOrange,
            transition: `width ${transitions.smooth}`,
          }} />
        </div>

        {/* ── Filter tabs ── */}
        <div
          role="tablist" aria-label="Filter activities"
          style={{
            display: 'flex', gap: spacing['2'],
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            paddingBottom: spacing['1'],
            scrollbarWidth: 'none',
          } as React.CSSProperties}
        >
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'active' as const, label: 'Active' },
            { key: 'delayed' as const, label: 'Behind' },
            { key: 'critical_path' as const, label: 'Critical' },
          ]).map(({ key, label }) => {
            const isActive = mobileFilter === key;
            const count = counts[key];
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setMobileFilter(key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: spacing['1.5'],
                  padding: `${spacing['2']} ${spacing['4']}`,
                  border: isActive ? 'none' : `1px solid ${colors.borderSubtle}`,
                  borderRadius: borderRadius.full,
                  backgroundColor: isActive ? colors.primaryOrange : colors.surfaceRaised,
                  color: isActive ? colors.white : colors.textSecondary,
                  fontSize: typography.fontSize.sm,
                  fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: `background-color ${transitions.quick}, color ${transitions.quick}`,
                  flexShrink: 0,
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: typography.fontWeight.bold,
                    padding: '1px 6px',
                    borderRadius: borderRadius.full,
                    backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.surfaceInset,
                    color: isActive ? colors.white : colors.textTertiary,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Activity cards ── */}
      <div
        data-schedule-list
        role="list"
        style={{
          display: 'flex', flexDirection: 'column',
          gap: spacing['2'], paddingTop: spacing['2'],
        }}
      >
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: spacing['8'],
            color: colors.textTertiary, fontSize: typography.fontSize.sm,
          }}>
            No activities match this filter.
          </div>
        ) : filtered.map((phase) => {
          const vs = visualStatus(phase);
          const cfg = STATUS_CONFIG[vs];
          const StatusIcon = cfg.Icon;
          const progress = phase.progress ?? 0;
          const isCritical = phase.is_critical_path === true;
          const dur = durationDays(phase.startDate, phase.endDate);
          const floatDays = phase.float_days ?? (phase as unknown as Record<string, unknown>).floatDays;
          const hasFloat = floatDays != null && Number(floatDays) >= 0;
          const statusLabel = phase.status === 'at_risk' ? 'At risk' : cfg.label;

          return (
            <div
              key={phase.id}
              role="listitem"
              tabIndex={0}
              aria-label={`${phase.name}, ${progress}% complete, ${statusLabel}`}
              onClick={() => {
                addToast('info', `${phase.name}: ${progress}% complete`);
                setScheduleAnnouncement(`Selected: ${phase.name}, ${statusLabel}`);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  addToast('info', `${phase.name}: ${progress}% complete`);
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const list = e.currentTarget.closest('[data-schedule-list]');
                  const rows = Array.from(list?.querySelectorAll<HTMLElement>('[role="listitem"]') ?? []);
                  const idx = rows.indexOf(e.currentTarget);
                  const next = e.key === 'ArrowDown' ? rows[idx + 1] : rows[idx - 1];
                  next?.focus();
                }
              }}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.borderSubtle}`,
                borderLeft: isCritical ? `3px solid #DC2626` : `1px solid ${colors.borderSubtle}`,
                padding: spacing['4'],
                cursor: 'pointer',
                outline: 'none',
                transition: `background-color ${transitions.quick}, transform ${transitions.quick}`,
                WebkitTapHighlightColor: 'transparent',
              }}
              onTouchStart={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.99)';
              }}
              onTouchEnd={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'none';
              }}
            >
              {/* Row 1: Name + chevron */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: spacing['2'], marginBottom: spacing['2'],
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: spacing['2'],
                    marginBottom: 2,
                  }}>
                    {phase.isMilestone && (
                      <span style={{ color: colors.primaryOrange, fontSize: 10 }}>◆</span>
                    )}
                    {isCritical && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        backgroundColor: '#FEE2E2', color: '#991B1B',
                        padding: '1px 5px', borderRadius: 3,
                        letterSpacing: '0.04em',
                      }}>CP</span>
                    )}
                    <span style={{
                      fontWeight: typography.fontWeight.semibold,
                      fontSize: typography.fontSize.body,
                      color: colors.textPrimary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {phase.name}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 2 }} />
              </div>

              {/* Row 2: Dates + duration */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                marginBottom: spacing['3'],
                fontVariantNumeric: 'tabular-nums',
              }}>
                <span>{formatDate(phase.startDate)} — {formatDate(phase.endDate)}</span>
                <span style={{ color: colors.textTertiary }}>·</span>
                <span style={{ color: colors.textTertiary }}>{dur}d</span>
              </div>

              {/* Row 3: Progress bar */}
              {!phase.isMilestone && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                  marginBottom: spacing['3'],
                }}>
                  <div style={{
                    flex: 1, height: 6, borderRadius: 3,
                    backgroundColor: colors.surfaceInset, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${progress}%`,
                      backgroundColor: cfg.fg,
                      transition: `width ${transitions.smooth}`,
                    }} />
                  </div>
                  <span style={{
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.semibold,
                    color: cfg.fg,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 32, textAlign: 'right',
                  }}>
                    {progress}%
                  </span>
                </div>
              )}

              {/* Row 4: Status badge + metadata */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: `2px ${spacing['3']}`,
                  borderRadius: borderRadius.full,
                  backgroundColor: cfg.bg,
                  color: cfg.fg,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  textTransform: 'capitalize' as const,
                }}>
                  <StatusIcon size={11} color={cfg.fg} />
                  {statusLabel}
                </span>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                }}>
                  {hasFloat && vs !== 'completed' && (
                    <span style={{
                      color: Number(floatDays) === 0 ? '#DC2626'
                        : Number(floatDays) <= 5 ? '#D97706'
                        : colors.textTertiary,
                      fontWeight: Number(floatDays) === 0 ? typography.fontWeight.semibold : typography.fontWeight.normal,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {floatDays}d float
                    </span>
                  )}
                  {phase.baselineEndDate && phase.slippageDays !== 0 && (
                    <span style={{
                      color: (phase.slippageDays ?? 0) > 0 ? '#DC2626' : '#16A34A',
                      fontWeight: typography.fontWeight.medium,
                    }}>
                      {(phase.slippageDays ?? 0) > 0 ? `+${phase.slippageDays}d` : `${phase.slippageDays}d`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <p style={{
        margin: `${spacing['6']} 0 0`,
        fontSize: typography.fontSize.caption,
        color: colors.textTertiary,
        textAlign: 'center',
      }}>
        Switch to desktop for the full Gantt chart.
      </p>
    </div>
  );
};
