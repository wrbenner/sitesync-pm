import React from 'react';
import { TrendingDown, TrendingUp, Minus, AlertTriangle, CheckCircle2, Clock, Target } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

// ── Types ────────────────────────────────────────────────

interface ActivityMetrics {
  scheduleVarianceDays: number;
  criticalPathCount: number;
  onTrackPct: number;
  completePct: number;
  milestoneCount?: number;
  milestonesComplete?: number;
}

interface ScheduleKPIsProps {
  activityMetrics: ActivityMetrics;
  metrics: {
    daysBeforeSchedule: number;
    milestonesHit: number;
    milestoneTotal: number;
  };
  projectMetrics?: { aiConfidenceLevel?: number | null } | null;
  isMobile: boolean;
  isNarrow: boolean;
  compact?: boolean;
}

// ── Color Logic ──────────────────────────────────────────

function varianceStyle(days: number): { color: string; bg: string; icon: React.ReactNode } {
  if (days <= 0) return { color: '#16A34A', bg: '#F0FDF4', icon: <TrendingUp size={14} /> };
  if (days <= 5) return { color: '#D97706', bg: '#FEF3C7', icon: <Minus size={14} /> };
  return { color: '#DC2626', bg: '#FEF2F2', icon: <TrendingDown size={14} /> };
}

function criticalStyle(count: number): { color: string; bg: string } {
  if (count === 0) return { color: '#16A34A', bg: '#F0FDF4' };
  if (count <= 5) return { color: '#D97706', bg: '#FEF3C7' };
  return { color: '#DC2626', bg: '#FEF2F2' };
}

function onTrackStyle(pct: number): { color: string; bg: string } {
  if (pct >= 80) return { color: '#16A34A', bg: '#F0FDF4' };
  if (pct >= 60) return { color: '#D97706', bg: '#FEF3C7' };
  return { color: '#DC2626', bg: '#FEF2F2' };
}

function completeStyle(pct: number): { color: string; bg: string } {
  if (pct >= 90) return { color: '#16A34A', bg: '#F0FDF4' };
  if (pct >= 50) return { color: '#2563EB', bg: '#EFF6FF' };
  return { color: '#6B7280', bg: '#F3F4F6' };
}

// ── Circular Progress Ring ──────────────────────────────

function ProgressRing({ value, size = 36, strokeWidth = 3, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      {/* Visible track so 0% doesn't look broken */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={colors.borderSubtle} strokeWidth={strokeWidth} opacity={0.5} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: `stroke-dashoffset ${transitions.smooth}` }} />
    </svg>
  );
}

// ── Compact Strip ────────────────────────────────────────

const CompactStrip: React.FC<{ activityMetrics: ActivityMetrics; isMobile: boolean; isNarrow: boolean }> = ({
  activityMetrics: am,
  isMobile,
  isNarrow,
}) => {
  const variance = varianceStyle(am.scheduleVarianceDays);
  const critical = criticalStyle(am.criticalPathCount);
  const onTrack = onTrackStyle(am.onTrackPct);
  const complete = completeStyle(am.completePct);
  const wrap = isMobile || isNarrow;

  const items = [
    {
      label: 'Variance',
      value: `${am.scheduleVarianceDays > 0 ? '+' : ''}${am.scheduleVarianceDays}d`,
      ...variance,
      icon: variance.icon,
    },
    {
      label: 'Critical Path',
      value: String(am.criticalPathCount),
      ...critical,
      icon: am.criticalPathCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />,
    },
    {
      label: 'On Track',
      value: `${am.onTrackPct}%`,
      ...onTrack,
      icon: <Target size={14} />,
    },
    {
      label: 'Complete',
      value: `${am.completePct}%`,
      ...complete,
      icon: <Clock size={14} />,
      ring: am.completePct,
    },
  ];

  return (
    <div
      role="group"
      aria-label="Schedule metrics"
      style={{
        display: 'flex',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: spacing['3'],
        marginBottom: spacing['4'],
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          aria-label={`${item.label}: ${item.value}`}
          style={{
            flex: wrap ? '1 1 calc(50% - 6px)' : '1 1 0',
            display: 'flex', alignItems: 'center', gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.lg,
            transition: `box-shadow ${transitions.quick}, transform ${transitions.quick}`,
            minWidth: 0,
            cursor: 'default',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
        >
          {/* Icon or ring */}
          {item.ring != null ? (
            <ProgressRing value={item.ring} color={item.color} size={36} strokeWidth={3} />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: borderRadius.md,
              backgroundColor: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: item.color, flexShrink: 0,
            }}>
              {item.icon}
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              color: colors.textTertiary, letterSpacing: typography.letterSpacing.wide,
              textTransform: 'uppercase' as const, lineHeight: 1,
              marginBottom: spacing['0.5'],
            }}>
              {item.label}
            </div>
            <div style={{
              fontSize: typography.fontSize.large || '1.25rem', fontWeight: typography.fontWeight.bold,
              color: item.color, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: typography.letterSpacing.tighter || '-0.03em',
            }}>
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Full Card ────────────────────────────────────────────

const KPICard: React.FC<{
  label: string;
  value: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  ring?: number;
  isMobile: boolean;
}> = ({ label, value, color, bg, icon, ring, isMobile }) => (
  <div
    aria-label={`${label}: ${value}`}
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      padding: spacing['5'],
      border: `1px solid ${colors.borderSubtle}`,
      display: 'flex', flexDirection: 'column', gap: spacing['3'],
      transition: `box-shadow ${transitions.quick}, transform ${transitions.quick}`,
      cursor: 'default',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{
        fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium,
        color: colors.textTertiary, letterSpacing: typography.letterSpacing.wider,
        textTransform: 'uppercase' as const,
      }}>
        {label}
      </span>
      {ring != null ? (
        <ProgressRing value={ring} color={color} size={40} strokeWidth={3} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: borderRadius.md,
          backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
      )}
    </div>
    <span style={{
      fontSize: isMobile ? '1.5rem' : '1.75rem',
      fontWeight: 800,
      color,
      lineHeight: 1,
      letterSpacing: '-0.04em',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </span>
  </div>
);

// ── Full Cards Grid ──────────────────────────────────────

const FullCards: React.FC<{
  activityMetrics: ActivityMetrics;
  isMobile: boolean;
  isNarrow: boolean;
}> = ({ activityMetrics: am, isMobile, isNarrow }) => {
  const variance = varianceStyle(am.scheduleVarianceDays);
  const critical = criticalStyle(am.criticalPathCount);
  const onTrack = onTrackStyle(am.onTrackPct);
  const complete = completeStyle(am.completePct);

  const items = [
    { label: 'Schedule Variance', value: `${am.scheduleVarianceDays > 0 ? '+' : ''}${am.scheduleVarianceDays}d`, ...variance },
    { label: 'Critical Path', value: String(am.criticalPathCount), ...critical, icon: am.criticalPathCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} /> },
    { label: 'On Track', value: `${am.onTrackPct}%`, ...onTrack, icon: <Target size={16} /> },
    { label: 'Complete', value: `${am.completePct}%`, ...complete, icon: <Clock size={16} />, ring: am.completePct },
  ];

  return (
    <div role="group" aria-label="Schedule metrics" style={{
      display: 'grid',
      gridTemplateColumns: isNarrow ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
      gap: spacing['3'],
    }}>
      {items.map((item) => (
        <KPICard
          key={item.label}
          label={item.label}
          value={item.value}
          color={item.color}
          bg={item.bg}
          icon={item.icon}
          ring={item.ring}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
};

// ── Exported Component ───────────────────────────────────

export const ScheduleKPIs: React.FC<ScheduleKPIsProps> = ({
  activityMetrics,
  metrics,
  projectMetrics,
  isMobile,
  isNarrow,
  compact = false,
}) => {
  if (compact) {
    return (
      <CompactStrip activityMetrics={activityMetrics} isMobile={isMobile} isNarrow={isNarrow} />
    );
  }

  return (
    <FullCards activityMetrics={activityMetrics} isMobile={isMobile} isNarrow={isNarrow} />
  );
};
