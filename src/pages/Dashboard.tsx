import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, DollarSign, HelpCircle, Shield, Users,
  TrendingUp, TrendingDown, ArrowRight, Scale, AlertCircle,
  ClipboardList, Circle,
} from 'lucide-react';
import { PageContainer } from '../components/Primitives';
import { MetricCardSkeleton } from '../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { duration, easing, easingArray } from '../styles/animations';
import { useProjectId } from '../hooks/useProjectId';
import {
  useProject, usePayApplications, useLienWaivers,
} from '../hooks/queries';
import { useProjectMetrics } from '../hooks/useProjectMetrics';
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
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    aria-label={onClick ? label : undefined}
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
      {/* Hero placeholder */}
      <div style={{
        height: 120, borderRadius: borderRadius.xl, marginBottom: spacing['5'],
        backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadows.card,
      }} />
      <MetricCardSkeleton count={6} />
    </PageContainer>
  );
}

// ── Dashboard ───────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const { data: project } = useProject(projectId);
  // Single batched query against the project_metrics materialized view.
  // Replaces individual useRFIs / useBudgetItems / useSchedulePhases / usePunchItems /
  // useIncidents / useCrews hook calls that previously issued 6 separate round trips.
  const { data: metrics, isPending: metricsLoading } = useProjectMetrics(projectId);
  const { data: payApps } = usePayApplications(projectId);
  const { data: lienWaivers } = useLienWaivers(projectId);

  // ── Derived KPIs ──────────────────────────────────────

  const overallProgress = metrics?.overall_progress ?? 0;

  const scheduleHealth = useMemo(() => {
    const v = metrics?.schedule_variance_days ?? 0;
    if (v >= 0) return { days: v, label: v === 0 ? 'On Track' : 'days ahead', positive: true };
    return { days: Math.abs(v), label: 'days behind', positive: false };
  }, [metrics?.schedule_variance_days]);

  const budgetData = useMemo(() => {
    const spent = metrics?.budget_spent ?? 0;
    const total = metrics?.budget_total ?? 1;
    const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
    return { spent, total, pct };
  }, [metrics?.budget_spent, metrics?.budget_total]);

  const rfiData = useMemo(() => ({
    open: metrics?.rfis_open ?? 0,
    overdue: metrics?.rfis_overdue ?? 0,
  }), [metrics?.rfis_open, metrics?.rfis_overdue]);

  const safetyScore = useMemo(() => {
    const incidents = metrics?.safety_incidents_this_month ?? 0;
    return Math.max(0, Math.min(100, 98 - incidents * 3));
  }, [metrics?.safety_incidents_this_month]);

  const punchData = useMemo(() => ({
    open: metrics?.punch_open ?? 0,
    total: metrics?.punch_total ?? 0,
    resolved: (metrics?.punch_total ?? 0) - (metrics?.punch_open ?? 0),
  }), [metrics?.punch_open, metrics?.punch_total]);

  const fieldActivity = metrics?.workers_onsite ?? 0;

  // Show onboarding checklist when project has no activity yet
  const isEmptyProject = !!metrics &&
    (metrics.rfis_total ?? 0) === 0 &&
    (metrics.punch_total ?? 0) === 0 &&
    (metrics.budget_total ?? 0) === 0;

  const daysRemaining = useMemo(() =>
    project?.target_completion
      ? Math.max(0, Math.ceil((new Date(project.target_completion).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0,
    [project?.target_completion]
  );

  const missingWaivers = useMemo(() => {
    const approvedAppIds = (payApps ?? [])
      .filter((a) => a.status === 'approved' || a.status === 'paid')
      .map((a) => a.id)
    if (approvedAppIds.length === 0) return []
    const waiversByApp = new Map<string, { status: string }[]>()
    for (const w of (lienWaivers ?? []) as Array<{ pay_app_id: string; status: string }>) {
      const existing = waiversByApp.get(w.pay_app_id) ?? []
      existing.push(w)
      waiversByApp.set(w.pay_app_id, existing)
    }
    return approvedAppIds.filter((id) => {
      const appWaivers = waiversByApp.get(id) ?? []
      return appWaivers.length === 0 || appWaivers.every((w) => w.status === 'pending')
    })
  }, [payApps, lienWaivers]);

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

  if (!project || metricsLoading) return <DashboardSkeleton />;

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

      {/* ── Action Items ──────────────────────────────────── */}
      {missingWaivers.length > 0 && (
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reducedMotion ? undefined : { ...staggerTransition, delay: 0.2 }}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
            padding: spacing['4'],
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            borderLeft: `3px solid ${colors.statusCritical}`,
            borderRadius: borderRadius.lg,
            marginBottom: spacing['5'],
            boxShadow: shadows.card,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/payment-applications')}
        >
          <div style={{
            width: 36, height: 36, borderRadius: borderRadius.base, flexShrink: 0,
            backgroundColor: colors.statusCriticalSubtle,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Scale size={16} color={colors.statusCritical} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Lien Waivers Missing
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 20, height: 20, padding: `0 ${spacing['1']}`,
                backgroundColor: colors.statusCritical, color: colors.white,
                borderRadius: borderRadius.full, fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.bold,
              }}>
                {missingWaivers.length}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
              {missingWaivers.length} approved pay app{missingWaivers.length !== 1 ? 's have' : ' has'} no lien waiver on file. Collect before releasing payment.
            </p>
          </div>
          <AlertCircle size={14} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 2 }} />
        </motion.div>
      )}

      {/* ── Onboarding Checklist (empty project state) ───── */}
      {isEmptyProject && (
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reducedMotion ? undefined : { ...staggerTransition, delay: 0.15 }}
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.xl,
            padding: spacing['6'],
            marginBottom: spacing['5'],
            boxShadow: shadows.card,
          }}
        >
          <p style={{ margin: 0, marginBottom: spacing['4'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Get started with your project
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {[
              { label: 'Add schedule phases', path: '/schedule', icon: <Calendar size={14} /> },
              { label: 'Set project budget', path: '/budget', icon: <DollarSign size={14} /> },
              { label: 'Invite team members', path: '/directory', icon: <Users size={14} /> },
              { label: 'Create first RFI', path: '/rfis', icon: <HelpCircle size={14} /> },
              { label: 'Start punch list', path: '/punch-list', icon: <ClipboardList size={14} /> },
            ].map((item) => (
              <div
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                  padding: `${spacing['3']} ${spacing['4']}`,
                  borderRadius: borderRadius.base,
                  cursor: 'pointer',
                  transition: `background-color ${duration.fast}ms ${easing.standard}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceInset; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
              >
                <Circle size={16} color={colors.borderStrong} />
                <span style={{ color: colors.textTertiary, display: 'flex' }}>{item.icon}</span>
                <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  {item.label}
                </span>
                <ArrowRight size={14} color={colors.textTertiary} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

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
