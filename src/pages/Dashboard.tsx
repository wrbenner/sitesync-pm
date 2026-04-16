import React, { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, DollarSign, HelpCircle, Shield, Users,
  TrendingUp, TrendingDown, ArrowRight, Scale, AlertCircle,
  ClipboardList, Circle, Plus, Building2, HardHat, Sparkles,
  CloudSun, Thermometer, Wind, Droplets,
} from 'lucide-react';
import { PageContainer } from '../components/Primitives';
import { MetricCardSkeleton } from '../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { fetchWeather, fetchWeatherForecast5Day, getWeatherImpact } from '../lib/weather';
import type { WeatherData, WeatherDay } from '../lib/weather';
import { duration, easing, easingArray } from '../styles/animations';
import { useProjectId } from '../hooks/useProjectId';
import {
  useProject, useProjects, usePayApplications, useLienWaivers,
  useAiInsightsMeta, useSchedulePhases,
} from '../hooks/queries';
import { useProjectMetrics } from '../hooks/useProjectMetrics';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { MorningBriefing } from '../components/dashboard/MorningBriefing';
import { CoordinationEngine } from '../components/schedule/CoordinationEngine';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { AIInsight } from '../types/ai';
import { useProjectContext } from '../stores/projectContextStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const CreateProjectModal = lazy(() => import('../components/forms/CreateProjectModal'));
const QuickRFIButton = lazy(() => import('../components/field/QuickRFIButton'));

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

// ── Welcome / Create Project Onboarding ─────────────────

const WelcomeOnboarding: React.FC<{ onProjectCreated: () => void }> = ({ onProjectCreated }) => {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const handleSubmit = async (data: Record<string, unknown>) => {
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        name: data.name as string,
        address: (data.address as string) || null,
        city: (data.city as string) || null,
        state: (data.state as string) || null,
        project_type: (data.project_type as string) || null,
        contract_value: data.contract_value ? Number(data.contract_value) : null,
        start_date: (data.start_date as string) || null,
        target_completion: (data.target_completion as string) || null,
        description: (data.description as string) || null,
        status: 'active',
        owner_id: user?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      toast.error(`Failed to create project: ${error.message}`);
      return;
    }

    // Add creator as project manager
    if (user?.id && newProject) {
      await supabase.from('project_members').insert({
        project_id: newProject.id,
        user_id: user.id,
        role: 'project_manager',
        accepted_at: new Date().toISOString(),
      });
    }

    // Set as active project and refresh queries
    if (newProject) {
      useProjectContext.getState().setActiveProject(newProject.id);
      // Update store projects list directly
      useProjectContext.setState((s) => ({
        projects: [newProject, ...s.projects],
        activeProject: newProject,
        activeProjectId: newProject.id,
      }));
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
      setShowModal(false);
      onProjectCreated();
    }
  };

  return (
    <PageContainer>
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reducedMotion ? undefined : { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: spacing['8'],
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: borderRadius.xl,
            backgroundColor: colors.primaryOrange,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing['6'],
            boxShadow: `0 8px 24px ${colors.primaryOrange}33`,
          }}
        >
          <HardHat size={40} color={colors.white} />
        </div>

        <h1
          style={{
            fontSize: typography.fontSize['4xl'],
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing['3'],
            letterSpacing: typography.letterSpacing.tight,
          }}
        >
          Welcome to SiteSync PM
        </h1>
        <p
          style={{
            fontSize: typography.fontSize.subtitle,
            color: colors.textSecondary,
            margin: 0,
            marginBottom: spacing['8'],
            maxWidth: 480,
            lineHeight: typography.lineHeight.relaxed,
          }}
        >
          The construction management platform that thinks like a 30 year veteran superintendent.
          Create your first project to get started.
        </p>

        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['4']} ${spacing['8']}`,
            minHeight: 56,
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.lg,
            fontSize: typography.fontSize.subtitle,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${colors.primaryOrange}40`,
            transition: `transform ${duration.fast}ms ${easing.standard}, box-shadow ${duration.fast}ms ${easing.standard}`,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.transform = 'translateY(-2px)';
            el.style.boxShadow = `0 6px 20px ${colors.primaryOrange}50`;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.transform = 'translateY(0)';
            el.style.boxShadow = `0 4px 12px ${colors.primaryOrange}40`;
          }}
        >
          <Plus size={20} />
          Create Your First Project
        </button>

        <div
          style={{
            display: 'flex',
            gap: spacing['8'],
            marginTop: spacing['12'],
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {[
            { icon: <Building2 size={20} />, label: 'RFIs, Submittals, Change Orders' },
            { icon: <Calendar size={20} />, label: 'Schedule and Daily Logs' },
            { icon: <DollarSign size={20} />, label: 'Budget and Payment Tracking' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                color: colors.textTertiary,
                fontSize: typography.fontSize.sm,
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <Suspense fallback={null}>
        {showModal && (
          <CreateProjectModal
            open={showModal}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
          />
        )}
      </Suspense>
    </PageContainer>
  );
};

// ── Dashboard ───────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const setActiveProject = useProjectContext((s) => s.setActiveProject);

  // Fetch all projects to detect "no projects" state
  const { data: allProjects, isPending: projectsLoading } = useProjects();
  const [projectCreated, setProjectCreated] = useState(0);

  // Auto-select first project if none selected
  useEffect(() => {
    if (!projectId && allProjects && allProjects.length > 0) {
      setActiveProject(allProjects[0].id);
    }
  }, [projectId, allProjects, setActiveProject]);

  // Show onboarding if no projects exist
  if (projectsLoading) return <DashboardSkeleton />;
  if (!allProjects || allProjects.length === 0) {
    return <WelcomeOnboarding onProjectCreated={() => setProjectCreated((c) => c + 1)} />;
  }

  return <DashboardInner />;
};

export const Dashboard: React.FC = () => (
  <ErrorBoundary message="The dashboard could not be displayed. Check your connection and try again.">
    <DashboardPage />
  </ErrorBoundary>
);

// ── Live Metrics Fallback ───────────────────────────────
// When the materialized view hasn't been refreshed (e.g. new project),
// run direct count queries so the dashboard shows real numbers.

function useLiveMetricsFallback(projectId: string | undefined, matViewHasData: boolean) {
  return useQuery({
    queryKey: ['live-metrics', projectId],
    queryFn: async () => {
      const [rfis, punchItems, budgetItems, submittals, dailyLogs] = await Promise.all([
        supabase.from('rfis').select('id, status, due_date', { count: 'exact' }).eq('project_id', projectId!),
        supabase.from('punch_items').select('id, status', { count: 'exact' }).eq('project_id', projectId!),
        supabase.from('budget_items').select('original_amount, actual_amount', { count: 'exact' }).eq('project_id', projectId!),
        supabase.from('submittals').select('id, status', { count: 'exact' }).eq('project_id', projectId!),
        supabase.from('daily_logs').select('id', { count: 'exact' }).eq('project_id', projectId!),
      ]);

      const rfiRows = rfis.data ?? [];
      const punchRows = punchItems.data ?? [];
      const budgetRows = budgetItems.data ?? [];
      const submittalRows = submittals.data ?? [];
      const today = new Date().toISOString().split('T')[0];

      return {
        rfis_open: rfiRows.filter((r) => r.status === 'open' || r.status === 'under_review').length,
        rfis_overdue: rfiRows.filter((r) => (r.status === 'open' || r.status === 'under_review') && r.due_date && r.due_date < today).length,
        rfis_total: rfis.count ?? rfiRows.length,
        punch_open: punchRows.filter((p) => p.status === 'open' || p.status === 'in_progress').length,
        punch_total: punchItems.count ?? punchRows.length,
        budget_total: budgetRows.reduce((sum, b) => sum + (b.original_amount ?? 0), 0),
        budget_spent: budgetRows.reduce((sum, b) => sum + (b.actual_amount ?? 0), 0),
        submittals_pending: submittalRows.filter((s) => s.status === 'in_review' || s.status === 'submitted').length,
        submittals_total: submittals.count ?? submittalRows.length,
        daily_logs_total: dailyLogs.count ?? 0,
      };
    },
    enabled: !!projectId && !matViewHasData,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

// ── AI Insights Banner (above the fold) ─────────────────

const SEVERITY_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  critical: { bg: colors.statusCriticalSubtle, border: colors.statusCritical, icon: colors.statusCritical },
  warning: { bg: colors.statusPendingSubtle, border: colors.statusPending, icon: colors.statusPending },
  info: { bg: colors.statusInfoSubtle, border: colors.statusInfo, icon: colors.statusInfo },
};

const InsightRow: React.FC<{ insight: AIInsight; onClick?: () => void }> = ({ insight, onClick }) => {
  const sev = SEVERITY_COLORS[insight.severity] || SEVERITY_COLORS.info;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing['3'],
        padding: `${spacing['3']} ${spacing['4']}`,
        borderLeft: `3px solid ${sev.border}`,
        backgroundColor: sev.bg,
        borderRadius: borderRadius.base,
        cursor: onClick ? 'pointer' : 'default',
        transition: `background-color ${duration.fast}ms ${easing.standard}`,
      }}
    >
      <AlertCircle size={16} color={sev.icon} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          lineHeight: typography.lineHeight.tight,
        }}>
          {insight.title}
        </p>
        <p style={{
          margin: 0,
          marginTop: spacing['1'],
          fontSize: typography.fontSize.caption,
          color: colors.textSecondary,
          lineHeight: typography.lineHeight.normal,
        }}>
          {insight.description}
        </p>
        {insight.affectedEntities && insight.affectedEntities.length > 0 && (
          <div style={{ display: 'flex', gap: spacing['1'], marginTop: spacing['2'], flexWrap: 'wrap' }}>
            {insight.affectedEntities.slice(0, 3).map((entity) => (
              <span
                key={entity.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing['1'],
                  padding: `1px ${spacing['2']}`,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.full,
                  whiteSpace: 'nowrap',
                }}
              >
                <Circle size={6} fill={sev.border} color={sev.border} />
                {entity.name}
              </span>
            ))}
          </div>
        )}
        {insight.suggestedAction && (
          <p style={{
            margin: 0,
            marginTop: spacing['1'],
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            color: sev.icon,
          }}>
            {insight.suggestedAction}
          </p>
        )}
      </div>
      {onClick && <ArrowRight size={14} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 2 }} />}
    </div>
  );
};

const AIInsightsBanner: React.FC<{ insights: AIInsight[]; navigate: (path: string) => void }> = ({ insights, navigate }) => {
  // Show real insights first; if none, show onboarding placeholders so the banner is never empty
  const realInsights = insights
    .filter((i) => !i.dismissed && !i.isPlaceholder)
    .sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
    })
    .slice(0, 3);

  const topInsights = realInsights.length > 0
    ? realInsights
    : insights.filter((i) => !i.dismissed).slice(0, 3);

  if (topInsights.length === 0) return null;

  const getNavigationPath = (insight: AIInsight): string | undefined => {
    const typeRoutes: Record<string, string> = {
      schedule_risk: '/schedule',
      budget_risk: '/budget',
    };
    if (typeRoutes[insight.type]) return typeRoutes[insight.type];
    const entity = insight.affectedEntities?.[0];
    if (!entity) return undefined;
    const entityRoutes: Record<string, string> = {
      rfi: '/rfis', schedule_phase: '/schedule', budget_item: '/budget',
      punch_item: '/punch-list', submittal: '/submittals', change_order: '/change-orders',
    };
    return entityRoutes[entity.type];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.smooth / 1000, ease: easingArray.apple }}
      style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.card,
        marginBottom: spacing['5'],
        border: `1px solid ${colors.borderSubtle}`,
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        padding: `${spacing['3']} ${spacing['4']}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: borderRadius.full,
          background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeLight} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Sparkles size={12} color={colors.white} />
        </div>
        <p style={{
          margin: 0,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          flex: 1,
        }}>
          AI Project Intelligence
        </p>
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
        }}>
          {topInsights.length} active {topInsights.length === 1 ? 'alert' : 'alerts'}
        </span>
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['2'],
        padding: spacing['3'],
      }}>
        {topInsights.map((insight) => {
          const path = getNavigationPath(insight);
          return (
            <InsightRow
              key={insight.id}
              insight={insight}
              onClick={path ? () => navigate(path) : undefined}
            />
          );
        })}
      </div>
    </motion.div>
  );
};

// ── Deterministic Insights Fallback (metrics only, no AI) ──────

const DeterministicInsightsBanner: React.FC<{
  metrics: import('../types/api').ProjectMetrics;
  navigate: (path: string) => void;
}> = ({ metrics, navigate }) => {
  const insights: AIInsight[] = [];
  const now = new Date().toISOString();

  if ((metrics.rfis_overdue ?? 0) > 0) {
    insights.push({
      id: 'det-rfi',
      type: 'risk',
      severity: (metrics.rfis_overdue ?? 0) > 5 ? 'critical' : 'warning',
      title: `${metrics.rfis_overdue} overdue RFI${(metrics.rfis_overdue ?? 0) === 1 ? '' : 's'} need response`,
      description: 'Overdue RFIs can block field work and push the schedule. Review and respond to prevent downstream delays.',
      affectedEntities: [],
      suggestedAction: 'Open RFIs to review overdue items',
      confidence: 0.9,
      source: 'computed',
      createdAt: now,
      dismissed: false,
    });
  }

  if ((metrics.punch_open ?? 0) > 0) {
    insights.push({
      id: 'det-punch',
      type: 'action_needed',
      severity: (metrics.punch_open ?? 0) > 10 ? 'critical' : (metrics.punch_open ?? 0) > 5 ? 'warning' : 'info',
      title: `${metrics.punch_open} open punch list item${(metrics.punch_open ?? 0) === 1 ? '' : 's'} require resolution`,
      description: 'Open punch items must be cleared before substantial completion and closeout.',
      affectedEntities: [],
      suggestedAction: 'Open Punch List to review open items',
      confidence: 0.85,
      source: 'computed',
      createdAt: now,
      dismissed: false,
    });
  }

  const budgetPct = (metrics.budget_total ?? 0) > 0
    ? Math.round(((metrics.budget_spent ?? 0) / (metrics.budget_total ?? 1)) * 100)
    : 0;
  if (budgetPct > 85) {
    insights.push({
      id: 'det-budget',
      type: 'budget_risk',
      severity: budgetPct > 95 ? 'critical' : 'warning',
      title: `Budget is ${budgetPct}% utilized`,
      description: `$${Math.round((metrics.budget_spent ?? 0) / 1000).toLocaleString()}K spent of $${Math.round((metrics.budget_total ?? 0) / 1000).toLocaleString()}K total. Monitor closely and review change order exposure.`,
      affectedEntities: [],
      suggestedAction: 'Open Budget to review cost variance',
      confidence: 0.85,
      source: 'computed',
      createdAt: now,
      dismissed: false,
    });
  }

  if ((metrics.schedule_variance_days ?? 0) < 0) {
    const days = Math.abs(metrics.schedule_variance_days ?? 0);
    insights.push({
      id: 'det-schedule',
      type: 'schedule_risk',
      severity: days > 14 ? 'critical' : days > 7 ? 'warning' : 'info',
      title: `Schedule is ${days} day${days === 1 ? '' : 's'} behind`,
      description: 'Schedule delays cascade into downstream trades. Review the critical path and consider acceleration strategies.',
      affectedEntities: [],
      suggestedAction: 'Open Schedule to review impacted phases',
      confidence: 0.85,
      source: 'computed',
      createdAt: now,
      dismissed: false,
    });
  }

  if (insights.length === 0) return null;

  return <AIInsightsBanner insights={insights} navigate={navigate} />;
};

// ── Dashboard Inner (has a project) ─────────────────────

const DashboardInner: React.FC = () => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const { data: project, isError: projectError, error: projectErrorObj } = useProject(projectId);
  const { data: insightsData } = useAiInsightsMeta(projectId);
  // Single batched query against the project_metrics materialized view.
  const { data: matViewMetrics, isPending: metricsLoading, isError: metricsError } = useProjectMetrics(projectId);
  const { data: payApps } = usePayApplications(projectId);
  const { data: lienWaivers } = useLienWaivers(projectId);

  // Fallback: live counts when materialized view has no data for this project
  const { data: liveMetrics } = useLiveMetricsFallback(projectId, !!matViewMetrics);

  // Load schedule phases into Zustand store for coordination engine conflict detection
  const loadSchedule = useScheduleStore((s) => s.loadSchedule);
  useEffect(() => {
    if (projectId) loadSchedule(projectId);
  }, [projectId, loadSchedule]);

  // Weather: fetch current conditions + 5 day forecast using project coordinates
  const projectLat = project?.latitude ?? undefined;
  const projectLon = project?.longitude ?? undefined;
  const { data: weatherData } = useQuery<WeatherData>({
    queryKey: ['weather_current', projectId, projectLat, projectLon],
    queryFn: () => fetchWeather(projectLat, projectLon),
    enabled: !!projectId,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: forecastData } = useQuery<WeatherDay[]>({
    queryKey: ['weather_forecast', projectId, projectLat, projectLon],
    queryFn: () => fetchWeatherForecast5Day(projectLat ?? 40.7128, projectLon ?? -74.0060),
    enabled: !!projectId,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Schedule phases for weather-schedule conflict detection
  const { data: schedulePhases } = useSchedulePhases(projectId);

  // Weather-schedule conflict insights: connect forecast to upcoming outdoor phases
  const weatherConflictInsights = useMemo<AIInsight[]>(() => {
    if (!forecastData || !schedulePhases) return [];
    const now = new Date().toISOString();
    const conflicts: AIInsight[] = [];
    const activePhases = schedulePhases.filter(
      (p) => p.status !== 'complete' && (p.percent_complete ?? 0) < 100 && p.start_date
    );

    for (const day of forecastData) {
      if (day.precip_probability < 60) continue;
      const forecastDate = day.date;
      const matchingPhase = activePhases.find((p) => {
        if (!p.start_date) return false;
        const phaseStart = p.start_date.split('T')[0];
        const phaseEnd = p.end_date ? p.end_date.split('T')[0] : phaseStart;
        return forecastDate >= phaseStart && forecastDate <= phaseEnd;
      });
      if (!matchingPhase) continue;

      const dayLabel = new Date(forecastDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      const phaseName = matchingPhase.name ?? 'Scheduled phase';
      conflicts.push({
        id: `weather-conflict-${forecastDate}-${matchingPhase.id}`,
        type: 'risk',
        severity: day.precip_probability >= 80 ? 'critical' : 'warning',
        title: `${day.conditions} forecast for ${dayLabel}. ${phaseName} may be impacted`,
        description: `${day.precip_probability}% chance of precipitation on ${dayLabel} (${day.temp_high}°/${day.temp_low}°). ${phaseName} is scheduled during this period. Consider identifying indoor backup scope or adjusting the sequence.`,
        affectedEntities: [
          { type: 'schedule_phase', id: matchingPhase.id, name: phaseName },
        ],
        suggestedAction: `Review ${phaseName} schedule and prepare contingency`,
        confidence: 0.8,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        dismissed: false,
      });
      if (conflicts.length >= 2) break;
    }
    return conflicts;
  }, [forecastData, schedulePhases]);

  // Merge AI insights with weather conflict insights
  const mergedInsights = useMemo<AIInsight[]>(() => {
    const aiInsights = insightsData?.insights ?? [];
    return [...aiInsights, ...weatherConflictInsights];
  }, [insightsData?.insights, weatherConflictInsights]);

  // Timeout: never show skeleton for more than 5 seconds
  const [skeletonTimedOut, setSkeletonTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSkeletonTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Merge: prefer materialized view, fall back to live counts
  const metrics = useMemo(() => {
    if (matViewMetrics) return matViewMetrics;
    if (!liveMetrics) return undefined;
    return {
      project_id: projectId ?? '',
      project_name: project?.name ?? '',
      contract_value: project?.contract_value ?? null,
      overall_progress: 0,
      milestones_completed: 0,
      milestones_total: 0,
      schedule_variance_days: 0,
      rfis_open: liveMetrics.rfis_open,
      rfis_overdue: liveMetrics.rfis_overdue,
      rfis_total: liveMetrics.rfis_total,
      avg_rfi_response_days: 0,
      punch_open: liveMetrics.punch_open,
      punch_total: liveMetrics.punch_total,
      budget_total: liveMetrics.budget_total,
      budget_spent: liveMetrics.budget_spent,
      budget_committed: 0,
      crews_active: 0,
      workers_onsite: 0,
      safety_incidents_this_month: 0,
      submittals_pending: liveMetrics.submittals_pending,
      submittals_approved: 0,
      submittals_total: liveMetrics.submittals_total,
    } satisfies import('../types/api').ProjectMetrics;
  }, [matViewMetrics, liveMetrics, projectId, project?.name, project?.contract_value]);

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

  // Show onboarding checklist when project has no activity yet.
  // Also shows when metrics are unavailable (new project not yet in materialized view).
  const isEmptyProject = !metrics ||
    ((metrics.rfis_total ?? 0) === 0 &&
    (metrics.punch_total ?? 0) === 0 &&
    (metrics.budget_total ?? 0) === 0);

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

  // Show error state if the project query itself failed
  if (projectError) {
    return (
      <PageContainer>
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            textAlign: 'center',
            padding: spacing['8'],
          }}
        >
          <AlertCircle size={40} color={colors.statusCritical} style={{ marginBottom: spacing['4'] }} />
          <h2 style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Unable to load project
          </h2>
          <p style={{ margin: 0, marginBottom: spacing['6'], fontSize: typography.fontSize.sm, color: colors.textSecondary, maxWidth: 400 }}>
            {projectErrorObj?.message || 'Check your connection and try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `${spacing['3']} ${spacing['6']}`,
              minHeight: 56,
              backgroundColor: colors.primaryOrange,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.lg,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </PageContainer>
    );
  }

  // Show skeleton only while project is genuinely loading (not errored, not timed out)
  if (!project && !skeletonTimedOut) return <DashboardSkeleton />;

  // If metrics are loading but the project loaded (or timed out), proceed with zero metrics
  // instead of blocking the entire dashboard

  const motionProps = reducedMotion ? {} : {
    variants: staggerContainer,
    initial: 'initial' as const,
    animate: 'animate' as const,
  };

  return (
    <PageContainer>
      {/* ── Morning Briefing ─────────────────────────────── */}
      <MorningBriefing />

      {/* ── Coordination Alerts (only when conflicts exist) ── */}
      <CoordinationEngine compact maxItems={3} />

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
            {project?.name ?? 'Project Dashboard'}
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

      {/* ── Weather Strip ─────────────────────────────────── */}
      {weatherData && (
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reducedMotion ? undefined : { duration: duration.smooth / 1000, ease: easingArray.apple, delay: 0.05 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['5'],
            padding: `${spacing['3']} ${spacing['5']}`,
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.card,
            marginBottom: spacing['4'],
            border: `1px solid ${colors.borderSubtle}`,
            flexWrap: 'wrap',
          }}
        >
          {/* Current conditions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: 160 }}>
            <span style={{ fontSize: 28, lineHeight: '1' }}>{weatherData.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                {weatherData.temp_high}° / {weatherData.temp_low}°
              </p>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                {weatherData.conditions}
              </p>
            </div>
          </div>

          {/* Impact indicator */}
          {(() => {
            const impact = getWeatherImpact(weatherData);
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['1']} ${spacing['3']}`,
                backgroundColor: impact.level === 'none' ? colors.statusActiveSubtle : impact.level === 'low' ? colors.statusPendingSubtle : colors.statusCriticalSubtle,
                borderRadius: borderRadius.full,
                whiteSpace: 'nowrap',
              }}>
                <CloudSun size={13} color={impact.color} />
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: impact.color }}>
                  {impact.label}
                </span>
              </div>
            );
          })()}

          {/* Wind + precip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <Wind size={13} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{weatherData.wind_speed}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <Droplets size={13} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{weatherData.precipitation}</span>
            </div>
          </div>

          {/* 5-day mini forecast */}
          {forecastData && forecastData.length > 0 && (
            <div style={{ display: 'flex', gap: spacing['3'], marginLeft: 'auto' }}>
              {forecastData.slice(0, 5).map((day) => (
                <div key={day.date} style={{ textAlign: 'center', minWidth: 36 }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 2 }}>
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: 16, lineHeight: '1.2' }}>{day.icon}</div>
                  <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    {day.temp_high}°
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── AI Insights (above the fold) ────────────────── */}
      {mergedInsights.length > 0 ? (
        <AIInsightsBanner insights={mergedInsights} navigate={navigate} />
      ) : metrics ? (
        <DeterministicInsightsBanner metrics={metrics} navigate={navigate} />
      ) : null}

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

      <Suspense fallback={null}>
        <QuickRFIButton />
      </Suspense>
    </PageContainer>
  );
};
