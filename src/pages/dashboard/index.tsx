import React, { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { PageContainer } from '../../components/Primitives';
import { MetricCardSkeleton } from '../../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { fetchWeather, fetchWeatherForecast5Day } from '../../lib/weather';
import type { WeatherData, WeatherDay } from '../../lib/weather';
import { duration, easingArray, skeletonStyle } from '../../styles/animations';
import { useProjectId } from '../../hooks/useProjectId';
import {
  useProject, useProjects, usePayApplications, useLienWaivers,
  useAiInsightsMeta, useSchedulePhases,
} from '../../hooks/queries';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { useProjectDiscrepancies } from '../../hooks/useDrawingIntelligence';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DashboardGrid } from '../../components/dashboard/DashboardGrid';
import { MorningBriefing } from '../../components/dashboard/MorningBriefing';
import { CoordinationEngine } from '../../components/schedule/CoordinationEngine';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import type { AIInsight } from '../../types/ai';
import { useProjectContext } from '../../stores/projectContextStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { supabase } from '../../lib/supabase';
import { useQuery } from '@tanstack/react-query';

import { WelcomeOnboarding } from './WelcomeOnboarding';
import { DashboardMetrics } from './DashboardMetrics';
import { DashboardWeather } from './DashboardWeather';
import { AIInsightsBanner, DeterministicInsightsBanner } from './DashboardAI';
import { DashboardHero, OwnerReportCard, MissingWaiversAlert, OnboardingChecklist } from './DashboardBriefing';

const QuickRFIButton = lazy(() => import('../../components/field/QuickRFIButton'));

// ── Loading Skeleton ────────────────────────────────────

const skeletonCard: React.CSSProperties = {
  ...skeletonStyle,
  border: `1px solid ${colors.borderSubtle}`,
  boxShadow: shadows.card,
};

function DashboardSkeleton() {
  return (
    <PageContainer>
      {/* Hero placeholder */}
      <div style={{ ...skeletonCard, height: 104, borderRadius: borderRadius.xl, marginBottom: spacing['5'] }} />
      {/* Weather strip placeholder */}
      <div style={{ ...skeletonCard, height: 60, borderRadius: borderRadius.lg, marginBottom: spacing['4'], animationDelay: '0.2s' }} />
      {/* Insights panel placeholder */}
      <div style={{ ...skeletonCard, height: 88, borderRadius: borderRadius.xl, marginBottom: spacing['5'], animationDelay: '0.4s' }} />
      <MetricCardSkeleton count={6} />
    </PageContainer>
  );
}

// ── Dashboard ───────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const projectId = useProjectId();
  const setActiveProject = useProjectContext((s) => s.setActiveProject);

  // Fetch all projects to detect "no projects" state
  const { data: allProjects, isPending: projectsLoading } = useProjects();

  // Auto-select first project if none selected
  useEffect(() => {
    if (!projectId && allProjects && allProjects.length > 0) {
      setActiveProject(allProjects[0].id);
    }
  }, [projectId, allProjects, setActiveProject]);

  // Show onboarding if no projects exist
  if (projectsLoading) return <DashboardSkeleton />;
  if (!allProjects || allProjects.length === 0) {
    return <WelcomeOnboarding onProjectCreated={() => {}} />;
  }

  return <DashboardInner />;
};

export const Dashboard: React.FC = () => (
  <ErrorBoundary message="The dashboard could not be displayed. Check your connection and try again.">
    <DashboardPage />
  </ErrorBoundary>
);

export default Dashboard;

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

// ── Dashboard Inner (has a project) ─────────────────────

const DashboardInner: React.FC = () => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const { data: project, isError: projectError, error: projectErrorObj } = useProject(projectId);
  const { data: insightsData } = useAiInsightsMeta(projectId);
  // Single batched query against the project_metrics materialized view.
  const { data: matViewMetrics } = useProjectMetrics(projectId);
  const { data: payApps } = usePayApplications(projectId);
  const { data: lienWaivers } = useLienWaivers(projectId);
  const { data: discrepancies = [] } = useProjectDiscrepancies(projectId);

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
  const { data: weatherData, isPending: weatherPending } = useQuery<WeatherData>({
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

  // Stable "now" timestamp — captured once at mount so useMemos stay pure
  const [now] = useState(() => Date.now());

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
    } satisfies import('../../types/api').ProjectMetrics;
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

  const discrepancyData = useMemo(() => {
    const active = discrepancies.filter((d) => !d.is_false_positive);
    const high = active.filter((d) => d.severity === 'high').length;
    const medium = active.filter((d) => d.severity === 'medium').length;
    const low = active.filter((d) => d.severity === 'low').length;
    return { total: active.length, high, medium, low };
  }, [discrepancies]);

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

  const targetCompletion = project?.target_completion ?? null;
  const daysRemaining = useMemo(() =>
    targetCompletion
      ? Math.max(0, Math.ceil((new Date(targetCompletion).getTime() - now) / (1000 * 60 * 60 * 24)))
      : 0,
    [targetCompletion, now]
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

  const startDateStr = project?.start_date ?? null;
  const projectStartDate = useMemo(() =>
    startDateStr
      ? new Date(startDateStr)
      : new Date(now - 247 * 24 * 60 * 60 * 1000),
    [startDateStr, now]
  );

  const dayNumber = useMemo(() => {
    const elapsed = now - projectStartDate.getTime();
    return Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60 * 24)));
  }, [now, projectStartDate]);

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

  return (
    <PageContainer>
      {/* ── Morning Briefing ─────────────────────────────── */}
      <MorningBriefing />

      {/* ── Coordination Alerts (only when conflicts exist) ── */}
      <CoordinationEngine compact maxItems={3} />

      {/* ── Hero Section ──────────────────────────────────── */}
      <DashboardHero
        projectName={project?.name ?? 'Project Dashboard'}
        projectAddress={projectAddress}
        dayNumber={dayNumber}
        totalDays={totalDays}
        daysRemaining={daysRemaining}
        animProgress={animProgress}
        reducedMotion={reducedMotion}
      />

      {/* ── Weather Strip ─────────────────────────────────── */}
      <DashboardWeather
        weatherData={weatherData}
        forecastData={forecastData}
        weatherPending={weatherPending}
        reducedMotion={reducedMotion}
      />

      {/* ── AI Insights (above the fold) ────────────────── */}
      <AnimatePresence mode="wait">
        {mergedInsights.length > 0 ? (
          <motion.div
            key="ai-insights"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            <AIInsightsBanner insights={mergedInsights} navigate={navigate} />
          </motion.div>
        ) : metrics ? (
          <motion.div
            key="det-insights"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            <DeterministicInsightsBanner metrics={metrics} navigate={navigate} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Metric Strip ──────────────────────────────────── */}
      <DashboardMetrics
        scheduleHealth={scheduleHealth}
        budgetData={budgetData}
        animBudgetPct={animBudgetPct}
        rfiData={rfiData}
        safetyScore={safetyScore}
        animSafety={animSafety}
        animFieldActivity={animFieldActivity}
        punchData={punchData}
        discrepancyData={discrepancyData}
        metrics={metrics}
        reducedMotion={reducedMotion}
        navigate={navigate}
      />

      {/* ── Owner Report Quick Access ─────────────────────── */}
      <OwnerReportCard navigate={navigate} reducedMotion={reducedMotion} />

      {/* ── Action Items ──────────────────────────────────── */}
      <MissingWaiversAlert count={missingWaivers.length} navigate={navigate} reducedMotion={reducedMotion} />

      {/* ── Onboarding Checklist (empty project state) ───── */}
      {isEmptyProject && <OnboardingChecklist navigate={navigate} reducedMotion={reducedMotion} />}

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
