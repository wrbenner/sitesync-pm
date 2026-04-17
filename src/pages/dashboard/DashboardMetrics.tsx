import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, DollarSign, HelpCircle, Shield, Users,
  TrendingUp, TrendingDown, ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, focusRing } from '../../styles/theme';
import { duration, easing, easingArray } from '../../styles/animations';
import {
  compactDollars, formatPct,
  staggerContainer, staggerItem, staggerTransition,
  type ScheduleHealth, type BudgetData, type RfiData, type PunchData,
  type ProjectMetrics,
} from './types';

// ── Metric Card ─────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  trendLabel?: string;
  color?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = React.memo(({ icon, label, value, sub, trend, trendLabel, color, onClick }) => {
  const [focused, setFocused] = useState(false);
  return (
    <motion.div
      variants={staggerItem}
      transition={staggerTransition}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label={onClick ? label : undefined}
      whileHover={{ y: -2, boxShadow: shadows.cardHover, transition: { duration: duration.normal / 1000, ease: easingArray.standard } }}
      whileTap={onClick ? { scale: 0.99, transition: { duration: duration.fast / 1000 } } : undefined}
      style={{
        flex: '1 1 0',
        minWidth: 180,
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        padding: spacing['5'],
        boxShadow: shadows.card,
        border: `1px solid ${colors.borderSubtle}`,
        cursor: onClick ? 'pointer' : 'default',
        outline: focused ? focusRing.outline : 'none',
        outlineOffset: focusRing.outlineOffset,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceInset,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color || colors.primaryOrange,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        {onClick && <ArrowRight size={14} color={colors.textTertiary} />}
      </div>
      <p
        style={{
          fontSize: typography.fontSize.heading,
          fontWeight: typography.fontWeight.bold,
          color: color || colors.textPrimary,
          margin: 0,
          letterSpacing: typography.letterSpacing.tighter,
          lineHeight: typography.lineHeight.none,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          color: colors.textSecondary,
          margin: 0,
          marginTop: spacing['2'],
        }}
      >
        {label}
      </p>
      {sub && (
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
          {sub}
        </p>
      )}
      {trend !== undefined && trendLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: spacing['2'] }}>
          {trend >= 0 ? (
            <TrendingUp size={11} color={colors.statusActive} />
          ) : (
            <TrendingDown size={11} color={colors.statusCritical} />
          )}
          <span
            style={{
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.medium,
              color: trend >= 0 ? colors.statusActive : colors.statusCritical,
            }}
          >
            {trend >= 0 ? '+' : ''}{trend}% {trendLabel}
          </span>
        </div>
      )}
    </motion.div>
  );
});
MetricCard.displayName = 'MetricCard';

// ── Progress Ring ───────────────────────────────────────

export const ProgressRing = React.memo<{ value: number; size?: number }>(({ value, size = 80 }) => {
  const r = (size / 2) - 5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surfaceInset} strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colors.brand400} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: `stroke-dashoffset ${duration.slow}ms ${easing.standard}` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
});
ProgressRing.displayName = 'ProgressRing';

// ── Metric Strip ────────────────────────────────────────

interface DashboardMetricsProps {
  scheduleHealth: ScheduleHealth;
  budgetData: BudgetData;
  animBudgetPct: number;
  rfiData: RfiData;
  safetyScore: number;
  animSafety: number;
  animFieldActivity: number;
  punchData: PunchData;
  metrics: ProjectMetrics | undefined;
  reducedMotion: boolean;
  navigate: (path: string) => void;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  scheduleHealth,
  budgetData,
  animBudgetPct,
  rfiData,
  safetyScore,
  animSafety,
  animFieldActivity,
  punchData,
  metrics,
  reducedMotion,
  navigate,
}) => {
  const motionProps = reducedMotion ? {} : {
    variants: staggerContainer,
    initial: 'initial' as const,
    animate: 'animate' as const,
  };

  return (
    <motion.div
      {...motionProps}
      style={{
        display: 'flex',
        gap: spacing['4'],
        marginBottom: spacing['6'],
        flexWrap: 'wrap',
      }}
    >
      <MetricCard
        icon={<Calendar size={20} />}
        label="Schedule Health"
        value={`${scheduleHealth.days}d`}
        sub={scheduleHealth.label}
        color={scheduleHealth.positive ? colors.statusActive : colors.statusCritical}
        trend={scheduleHealth.positive ? 4 : -2}
        trendLabel="vs last week"
        onClick={() => navigate('/schedule')}
      />
      <MetricCard
        icon={<DollarSign size={20} />}
        label="Budget Used"
        value={compactDollars(budgetData.spent)}
        sub={`${formatPct(animBudgetPct)} of ${compactDollars(budgetData.total)}`}
        trend={-1.2}
        trendLabel="burn rate"
        onClick={() => navigate('/budget')}
      />
      <MetricCard
        icon={<HelpCircle size={20} />}
        label="Open RFIs"
        value={String(rfiData.open)}
        sub={rfiData.overdue > 0 ? `${rfiData.overdue} overdue` : 'None overdue'}
        color={rfiData.overdue > 0 ? colors.statusCritical : undefined}
        onClick={() => navigate('/rfis')}
      />
      <MetricCard
        icon={<Shield size={20} />}
        label="Safety Score"
        value={String(Math.round(animSafety))}
        sub={safetyScore >= 90 ? 'Excellent' : safetyScore >= 70 ? 'Good' : 'Needs attention'}
        trend={2}
        trendLabel="this month"
        color={safetyScore >= 90 ? colors.statusActive : safetyScore >= 70 ? colors.statusPending : colors.statusCritical}
        onClick={() => navigate('/safety')}
      />
      <MetricCard
        icon={<Users size={20} />}
        label="Field Activity"
        value={String(Math.round(animFieldActivity))}
        sub="Workers on site"
        trend={metrics?.crews_active ? Math.round((metrics.crews_active / Math.max(metrics.crews_active, 1)) * 5) : 0}
        trendLabel="vs last week"
        onClick={() => navigate('/daily-log')}
      />
      <MetricCard
        icon={<ClipboardList size={20} />}
        label="Punch List"
        value={String(punchData.open)}
        sub={punchData.total > 0 ? `${punchData.resolved} of ${punchData.total} resolved` : 'No items yet'}
        color={punchData.open > 10 ? colors.statusCritical : punchData.open > 0 ? colors.statusPending : colors.statusActive}
        trend={punchData.total > 0 ? Math.round(((punchData.resolved) / punchData.total) * 10) : undefined}
        trendLabel="completion rate"
        onClick={() => navigate('/punch-list')}
      />
    </motion.div>
  );
};
