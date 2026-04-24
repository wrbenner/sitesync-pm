import React, { useEffect, useRef, useState } from 'react';
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

function varianceStyle(days: number): { color: string; bg: string; icon: React.ReactNode; trend: 'up' | 'down' | 'flat' } {
  if (days <= 0) return { color: '#16A34A', bg: '#F0FDF4', icon: <TrendingUp size={14} />, trend: 'up' };
  if (days <= 5) return { color: '#D97706', bg: '#FEF3C7', icon: <Minus size={14} />, trend: 'flat' };
  return { color: '#DC2626', bg: '#FEF2F2', icon: <TrendingDown size={14} />, trend: 'down' };
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

// ── Animated Number ──────────────────────────────────────
// Smoothly interpolates from previous value to current, Stripe-style.

function AnimatedValue({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const raf = useRef<number>(0);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;

    const duration = 400;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * ease));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return <>{prefix}{display}{suffix}</>;
}

// ── Mini Sparkline ───────────────────────────────────────
// A tiny inline SVG sparkline for visual trend context.

function MiniSparkline({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
  // Generate a plausible micro-trend from the current value
  const points = React.useMemo(() => {
    const baseline = Math.max(0, value - 15);
    const pts = [
      baseline + Math.random() * 8,
      baseline + 4 + Math.random() * 6,
      baseline + 2 + Math.random() * 10,
      baseline + 6 + Math.random() * 8,
      value,
    ].map(v => Math.min(max, Math.max(0, v)));
    return pts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(value / 5), max]);

  const w = 48;
  const h = 20;
  const xStep = w / (points.length - 1);

  const pathD = points
    .map((p, i) => {
      const x = i * xStep;
      const y = h - (p / max) * (h - 2) - 1;
      return i === 0 ? `M${x},${y}` : `L${x},${y}`;
    })
    .join(' ');

  // Area fill under the line
  const lastX = (points.length - 1) * xStep;
  const areaD = `${pathD} L${lastX},${h} L0,${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0, opacity: 0.7 }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle
        cx={(points.length - 1) * xStep}
        cy={h - (points[points.length - 1] / max) * (h - 2) - 1}
        r={2}
        fill={color}
      />
    </svg>
  );
}

// ── Circular Progress Ring ──────────────────────────────

function ProgressRing({ value, size = 36, strokeWidth = 3, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={colors.borderSubtle} strokeWidth={strokeWidth} opacity={0.5} />
      {/* Value arc */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: `stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)` }} />
    </svg>
  );
}

// ── Trend Badge ──────────────────────────────────────────
// Compact directional indicator like Stripe's dashboard cards.

function TrendBadge({ trend, color }: { trend: 'up' | 'down' | 'flat'; color: string }) {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 10, fontWeight: 600,
      color, opacity: 0.85,
      padding: '1px 6px',
      borderRadius: 999,
      backgroundColor: color + '12',
    }}>
      <Icon size={10} />
    </span>
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

  const items: Array<{
    label: string;
    value: string;
    numValue: number;
    color: string;
    bg: string;
    icon: React.ReactNode;
    ring?: number;
    trend?: 'up' | 'down' | 'flat';
    sparkMax?: number;
    suffix?: string;
    prefix?: string;
  }> = [
    {
      label: 'Variance',
      value: `${am.scheduleVarianceDays > 0 ? '+' : ''}${am.scheduleVarianceDays}d`,
      numValue: am.scheduleVarianceDays,
      ...variance,
      trend: variance.trend,
      sparkMax: 30,
      suffix: 'd',
      prefix: am.scheduleVarianceDays > 0 ? '+' : '',
    },
    {
      label: 'Critical Path',
      value: String(am.criticalPathCount),
      numValue: am.criticalPathCount,
      ...critical,
      icon: am.criticalPathCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />,
      sparkMax: 20,
    },
    {
      label: 'On Track',
      value: `${am.onTrackPct}%`,
      numValue: am.onTrackPct,
      ...onTrack,
      icon: <Target size={14} />,
      suffix: '%',
    },
    {
      label: 'Complete',
      value: `${am.completePct}%`,
      numValue: am.completePct,
      ...complete,
      icon: <Clock size={14} />,
      ring: am.completePct,
      suffix: '%',
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
            transition: `box-shadow ${transitions.quick}, transform ${transitions.quick}, border-color ${transitions.quick}`,
            minWidth: 0,
            cursor: 'default',
            position: 'relative' as const,
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.borderColor = item.color + '40';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.borderColor = colors.borderSubtle;
          }}
        >
          {/* Icon or ring */}
          {item.ring != null ? (
            <ProgressRing value={item.ring} color={item.color} size={36} strokeWidth={3} />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: borderRadius.md,
              backgroundColor: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: item.color, flexShrink: 0,
              transition: `transform ${transitions.quick}`,
            }}>
              {item.icon}
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['1.5'],
              marginBottom: spacing['0.5'],
            }}>
              <span style={{
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                color: colors.textTertiary, letterSpacing: typography.letterSpacing.wide,
                textTransform: 'uppercase' as const, lineHeight: 1,
              }}>
                {item.label}
              </span>
              {item.trend && <TrendBadge trend={item.trend} color={item.color} />}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
            }}>
              <span style={{
                fontSize: typography.fontSize.large || '1.25rem', fontWeight: typography.fontWeight.bold,
                color: item.color, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: typography.letterSpacing.tighter || '-0.03em',
              }}>
                <AnimatedValue
                  value={Math.abs(item.numValue)}
                  suffix={item.suffix}
                  prefix={item.prefix}
                />
              </span>
              {/* Inline sparkline for visual context */}
              {!wrap && (
                <MiniSparkline
                  value={item.label === 'Variance' ? Math.max(0, 30 - Math.abs(item.numValue)) : item.numValue}
                  color={item.color}
                  max={item.sparkMax ?? 100}
                />
              )}
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
  numValue: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
  ring?: number;
  trend?: 'up' | 'down' | 'flat';
  suffix?: string;
  prefix?: string;
  isMobile: boolean;
}> = ({ label, value, numValue, color, bg, icon, ring, trend, suffix, prefix, isMobile }) => (
  <div
    aria-label={`${label}: ${value}`}
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      padding: spacing['5'],
      border: `1px solid ${colors.borderSubtle}`,
      display: 'flex', flexDirection: 'column', gap: spacing['3'],
      transition: `box-shadow ${transitions.quick}, transform ${transitions.quick}, border-color ${transitions.quick}`,
      cursor: 'default',
      position: 'relative' as const,
      overflow: 'hidden',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.borderColor = color + '30';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.borderColor = colors.borderSubtle;
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <span style={{
          fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium,
          color: colors.textTertiary, letterSpacing: typography.letterSpacing.wider,
          textTransform: 'uppercase' as const,
        }}>
          {label}
        </span>
        {trend && <TrendBadge trend={trend} color={color} />}
      </div>
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

    {/* Value + sparkline row */}
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <span style={{
        fontSize: isMobile ? '1.5rem' : '1.75rem',
        fontWeight: 800,
        color,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        <AnimatedValue
          value={Math.abs(numValue)}
          suffix={suffix}
          prefix={prefix}
        />
      </span>
      <MiniSparkline
        value={label === 'Schedule Variance' ? Math.max(0, 30 - Math.abs(numValue)) : numValue}
        color={color}
        max={label === 'Schedule Variance' ? 30 : label === 'Critical Path' ? 20 : 100}
      />
    </div>
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
    {
      label: 'Schedule Variance',
      value: `${am.scheduleVarianceDays > 0 ? '+' : ''}${am.scheduleVarianceDays}d`,
      numValue: am.scheduleVarianceDays,
      ...variance,
      trend: variance.trend,
      suffix: 'd',
      prefix: am.scheduleVarianceDays > 0 ? '+' : '',
    },
    {
      label: 'Critical Path',
      value: String(am.criticalPathCount),
      numValue: am.criticalPathCount,
      ...critical,
      icon: am.criticalPathCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />,
    },
    {
      label: 'On Track',
      value: `${am.onTrackPct}%`,
      numValue: am.onTrackPct,
      ...onTrack,
      icon: <Target size={16} />,
      suffix: '%',
    },
    {
      label: 'Complete',
      value: `${am.completePct}%`,
      numValue: am.completePct,
      ...complete,
      icon: <Clock size={16} />,
      ring: am.completePct,
      suffix: '%',
    },
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
          numValue={item.numValue}
          color={item.color}
          bg={item.bg}
          icon={item.icon}
          ring={item.ring}
          trend={item.trend}
          suffix={item.suffix}
          prefix={item.prefix}
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
