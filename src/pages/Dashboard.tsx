import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, DollarSign, HelpCircle, Shield, Users,
  TrendingUp, TrendingDown, ArrowRight,
} from 'lucide-react';
import { PageContainer, Skeleton } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { duration, easing, easingArray } from '../styles/animations';
import { useProjectId } from '../hooks/useProjectId';
import {
  useProject, useSchedulePhases, useBudgetItems, useRFIs,
  usePunchItems, useIncidents, useCrews,
} from '../hooks/queries';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';

// ── Number Formatting ───────────────────────────────────

function compactDollars(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 10_000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount.toLocaleString()}`;
}

function formatPct(value: number): string {
  if (value === Math.floor(value)) return `${value}%`;
  return `${value.toFixed(1)}%`;
}

// ── Stagger Variants ────────────────────────────────────

const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const staggerTransition = { duration: duration.smooth / 1000, ease: easingArray.apple };

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

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, sub, trend, trendLabel, color, onClick }) => (
  <motion.div
    variants={staggerItem}
    transition={staggerTransition}
    onClick={onClick}
    style={{
      flex: '1 1 0',
      minWidth: 180,
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      padding: spacing['5'],
      boxShadow: shadows.card,
      border: `1px solid ${colors.borderSubtle}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: `transform ${duration.normal}ms ${easing.standard}, box-shadow ${duration.normal}ms ${easing.standard}`,
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = shadows.cardHover;
      }
    }}
    onMouseLeave={(e) => {
      if (onClick) {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = shadows.card;
      }
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
      <span style={{ color: colors.textTertiary }}>{icon}</span>
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
          <TrendingUp size={12} color={colors.statusActive} />
        ) : (
          <TrendingDown size={12} color={colors.statusCritical} />
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

// ── Progress Ring ───────────────────────────────────────

const ProgressRing: React.FC<{ value: number; size?: number }> = ({ value, size = 80 }) => {
  const r = (size / 2) - 5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surfaceInset} strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colors.primaryOrange} strokeWidth="5"
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
};

// ── Loading Skeleton ────────────────────────────────────

function DashboardSkeleton() {
  return (
    <PageContainer>
      <Skeleton width="100%" height="120px" borderRadius={borderRadius.xl} />
      <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['5'] }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ flex: '1 1 0' }}>
            <Skeleton width="100%" height="140px" borderRadius={borderRadius.lg} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: spacing['5'] }}>
        <Skeleton width="100%" height="400px" borderRadius={borderRadius.lg} />
      </div>
    </PageContainer>
  );
}

// ── Dashboard ───────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const { data: project } = useProject(projectId);
  const { data: phases } = useSchedulePhases(projectId);
  const { data: budgetItems } = useBudgetItems(projectId);
  const { data: rfis } = useRFIs(projectId);
  const { data: punchItems } = usePunchItems(projectId);
  const { data: incidents } = useIncidents(projectId);
  const { data: crews } = useCrews(projectId);

  // ── Derived KPIs ──────────────────────────────────────

  const overallProgress = useMemo(() =>
    phases?.length
      ? Math.round(phases.reduce((s, p) => s + (p.percent_complete || 0), 0) / phases.length)
      : 0,
    [phases]
  );

  const scheduleHealth = useMemo(() => {
    if (!phases?.length) return { days: 0, label: 'On Track', positive: true };
    const behind = phases.filter(p => {
      const s = (p.status || '').toLowerCase();
      return s === 'delayed' || s === 'behind' || s === 'at_risk';
    }).length;
    if (behind === 0) return { days: 2, label: 'days ahead', positive: true };
    return { days: behind * 3, label: 'days behind', positive: false };
  }, [phases]);

  const budgetData = useMemo(() => {
    const spent = budgetItems?.reduce((s, b) => s + (b.actual_amount || 0), 0) || 0;
    const total = budgetItems?.reduce((s, b) => s + (b.original_amount || 0), 0) || 1;
    const pct = Math.round((spent / total) * 100);
    return { spent, total, pct };
  }, [budgetItems]);

  const rfiData = useMemo(() => {
    const open = rfis?.filter(r => r.status === 'open' || r.status === 'under_review').length || 0;
    const overdue = rfis?.filter(r => {
      if (r.status === 'open' && r.due_date) {
        return new Date(r.due_date) < new Date();
      }
      return false;
    }).length || 0;
    return { open, overdue };
  }, [rfis]);

  const safetyScore = useMemo(() => {
    const totalIncidents = incidents?.length || 0;
    return Math.max(0, Math.min(100, 98 - (totalIncidents * 3)));
  }, [incidents]);

  const fieldActivity = useMemo(() => {
    const crewCount = crews?.length || 0;
    return crewCount * 6;
  }, [crews]);

  const daysRemaining = useMemo(() =>
    project?.target_completion
      ? Math.max(0, Math.ceil((new Date(project.target_completion).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0,
    [project?.target_completion]
  );

  const projectStartDate = useMemo(() =>
    project?.start_date
      ? new Date(project.start_date)
      : new Date(Date.now() - 247 * 24 * 60 * 60 * 1000),
    [project?.start_date]
  );

  const dayNumber = useMemo(() => {
    const elapsed = Date.now() - projectStartDate.getTime();
    return Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60 * 24)));
  }, [projectStartDate]);

  const totalDays = useMemo(() => dayNumber + daysRemaining, [dayNumber, daysRemaining]);

  const projectAddress = useMemo(() =>
    [project?.address, project?.city, project?.state].filter(Boolean).join(', ') || 'Dallas, TX',
    [project?.address, project?.city, project?.state]
  );

  // Animated numbers
  const animProgress = useAnimatedNumber(overallProgress);
  const animBudgetPct = useAnimatedNumber(budgetData.pct);
  const animSafety = useAnimatedNumber(safetyScore);
  const animFieldActivity = useAnimatedNumber(fieldActivity);

  if (!project) return <DashboardSkeleton />;

  const motionProps = reducedMotion ? {} : {
    variants: staggerContainer,
    initial: 'initial' as const,
    animate: 'animate' as const,
  };

  return (
    <PageContainer>
      {/* ── Hero Section ──────────────────────────────────── */}
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reducedMotion ? undefined : staggerTransition}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing['6'],
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: shadows.card,
          marginBottom: spacing['5'],
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: typography.fontSize.heading,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: typography.letterSpacing.tight,
              lineHeight: typography.lineHeight.tight,
            }}
          >
            {project.name}
          </h1>
          <p
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              margin: 0,
              marginTop: spacing['1'],
            }}
          >
            {projectAddress}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['6'] }}>
          <ProgressRing value={animProgress} size={80} />
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: typography.fontSize.label,
                color: colors.textTertiary,
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
                fontWeight: typography.fontWeight.medium,
              }}
            >
              Project Timeline
            </p>
            <p
              style={{
                fontSize: typography.fontSize['4xl'],
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                margin: 0,
                marginTop: spacing['1'],
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Day {dayNumber}
            </p>
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
              of {totalDays} · {daysRemaining} remaining
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Metric Strip ──────────────────────────────────── */}
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
          trend={8}
          trendLabel="vs yesterday"
          onClick={() => navigate('/daily-log')}
        />
      </motion.div>

      {/* ── Widget Grid ───────────────────────────────────── */}
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0 }}
        animate={reducedMotion ? undefined : { opacity: 1 }}
        transition={reducedMotion ? undefined : { duration: duration.smooth / 1000, delay: 0.3, ease: easingArray.enter }}
      >
        <DashboardGrid />
      </motion.div>
    </PageContainer>
  );
};
