import React, { useMemo, useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle, DollarSign, HelpCircle, Calendar, ChevronRight,
  Shield, ClipboardList, CloudSun,
  Sparkles, Scale, FileText, Send, Clock,

} from 'lucide-react';
import { PageContainer } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { fetchWeather, fetchWeatherForecast5Day } from '../../lib/weather';
import type { WeatherData, WeatherDay } from '../../lib/weather';
import { getProjectCoordinates } from '../../lib/geocoding';
import type { GeocodingResult } from '../../lib/geocoding';
import { skeletonStyle } from '../../styles/animations';
import { useProjectId } from '../../hooks/useProjectId';
import {
  useProject, useProjects, usePayApplications, useLienWaivers,
  useAiInsightsMeta, useSchedulePhases, useActivityFeed,
} from '../../hooks/queries';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useIsMobile } from '../../hooks/useWindowSize';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import type { AIInsight } from '../../types/ai';
import { useProjectStore } from '../../stores/projectStore';
import { useScheduleStore } from '../../stores/scheduleStore';

import { fromTable } from '../../lib/db/queries'
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { compactDollars } from './types';

import { WelcomeOnboarding } from './WelcomeOnboarding';
import { OnboardingChecklist } from './DashboardBriefing';
import { DashboardBriefingAI } from './DashboardBriefingAI';
import { DashboardProjectHealth } from './DashboardProjectHealth';
import { DashboardMyTasks } from './DashboardMyTasks';
import { DashboardPortfolio } from './DashboardPortfolio';
import { DashboardCarbon } from './DashboardCarbon';
import { DashboardCompliance } from './DashboardCompliance';
import { SundialDashboard } from './SundialDashboard';

// DashboardSiteMapMini eagerly imports leaflet + leaflet.css (~200KB) — keep
// it lazy so it doesn't bloat the dashboard's initial JS chunk for every
// user. The map widget loads after the rest of the dashboard renders.
const DashboardSiteMapMini = lazy(() =>
  import('./DashboardSiteMapMini').then((m) => ({ default: m.DashboardSiteMapMini })),
);
const QuickRFIButton = lazy(() => import('../../components/field/QuickRFIButton'));

// ── Helpers ────────────────────────────────────────────

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(user: { user_metadata?: { full_name?: string }; email?: string } | null): string | null {
  const fullName = user?.user_metadata?.full_name;
  if (fullName) return fullName.split(' ')[0];
  // Don't show raw email prefixes like "wrbenner23" — they look unprofessional.
  // Only use email prefix if it looks like a real name (letters only, 3+ chars).
  const email = user?.email;
  if (email) {
    const prefix = email.split('@')[0];
    if (/^[a-zA-Z]{3,}$/.test(prefix)) return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return null;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Animations ─────────────────────────────────────────

const ease = [0.16, 1, 0.3, 1] as const; // Apple-style overshoot
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease, delay },
});

// ── Skeleton ───────────────────────────────────────────

const skel: React.CSSProperties = { ...skeletonStyle, borderRadius: borderRadius.lg };

function DashboardSkeleton() {
  return (
    <PageContainer>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: `${spacing['12']} 0` }}>
        <div style={{ ...skel, height: 32, width: 260, marginBottom: spacing['3'] }} />
        <div style={{ ...skel, height: 14, width: 180, marginBottom: spacing['12'], animationDelay: '0.08s' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['10'] }}>
          {[0, 1, 2, 3].map((i) => <div key={i} style={{ ...skel, height: 110, animationDelay: `${0.12 + i * 0.04}s` }} />)}
        </div>
        <div style={{ ...skel, height: 240, animationDelay: '0.3s' }} />
      </div>
    </PageContainer>
  );
}

// ── Dashboard Shell ────────────────────────────────────

const DashboardPage: React.FC = () => {
  const projectId = useProjectId();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const { data: allProjects, isPending: projectsLoading } = useProjects();

  // Ensure a valid project is selected — but guard against infinite loops.
  // allProjects is a new array reference on every react-query refetch, so we
  // track the last ID we set via ref to avoid re-triggering setActiveProject
  // when the store update hasn't propagated to projectId yet.
  const lastAutoSetRef = useRef<string | null>(null);
  useEffect(() => {
    if (!allProjects || allProjects.length === 0) return;
    const validIds = new Set(allProjects.map((p) => p.id));
    // Already pointing at a valid project — nothing to do
    if (projectId && validIds.has(projectId)) {
      lastAutoSetRef.current = null;
      return;
    }
    const fallbackId = allProjects[0].id;
    // Don't re-set if we already just set this ID (store update in flight)
    if (lastAutoSetRef.current === fallbackId) return;
    lastAutoSetRef.current = fallbackId;
    setActiveProject(fallbackId);
  }, [projectId, allProjects, setActiveProject]);

  // Cross-feature sweeps: when the dashboard mounts for a project, run any
  // registered project-level sweeps. Each is idempotent so it's safe to
  // fire on every mount. Eventually these move to a scheduled cron — for
  // now, dashboard-mount is the cheapest surface to run them.
  const lastSweptProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (lastSweptProjectRef.current === projectId) return;
    lastSweptProjectRef.current = projectId;
    void import('../../lib/crossFeatureWorkflows').then(
      async ({ runRfiOverdueSweep, runMeetingActionItemTaskSweep }) => {
        const [rfiResults, actionResults] = await Promise.all([
          runRfiOverdueSweep(projectId),
          runMeetingActionItemTaskSweep(projectId),
        ]);
        const rfiCreated = rfiResults.filter((r) => r.created).length;
        const actionCreated = actionResults.filter((r) => r.created).length;
        if (rfiCreated > 0) console.info(`[rfi_overdue_sweep] created ${rfiCreated} follow-up task(s)`);
        if (actionCreated > 0) console.info(`[meeting_action_item_sweep] created ${actionCreated} task(s)`);
      },
    );
  }, [projectId]);

  if (projectsLoading) return <DashboardSkeleton />;
  if (!allProjects || allProjects.length === 0) return <WelcomeOnboarding onProjectCreated={() => {}} />;
  return <SundialDashboard />;
};

export const Dashboard: React.FC = () => (
  <ErrorBoundary message="The dashboard could not be displayed. Check your connection and try again.">
    <DashboardPage />
  </ErrorBoundary>
);
export default Dashboard;

// ── Live Metrics Fallback ──────────────────────────────

function useLiveMetricsFallback(projectId: string | undefined, matViewHasData: boolean) {
  return useQuery({
    queryKey: ['live-metrics', projectId],
    queryFn: async () => {
      const [rfis, punchItems, budgetItems, submittals, dailyLogs] = await Promise.all([
        fromTable('rfis').select('id, status, due_date', { count: 'exact' }).eq('project_id' as never, projectId!),
        fromTable('punch_items').select('id, status', { count: 'exact' }).eq('project_id' as never, projectId!),
        fromTable('budget_items').select('original_amount, actual_amount', { count: 'exact' }).eq('project_id' as never, projectId!),
        fromTable('submittals').select('id, status', { count: 'exact' }).eq('project_id' as never, projectId!),
        fromTable('daily_logs').select('id', { count: 'exact' }).eq('project_id' as never, projectId!),
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

// ════════════════════════════════════════════════════════════════
// ══  DASHBOARD — The Command Center                          ══
// ══  Design philosophy: Calm authority. Information density   ══
// ══  without noise. Every element earns its place.           ══
// ════════════════════════════════════════════════════════════════

const _DashboardInner: React.FC = () => {
      void _DashboardInner;
  const projectId = useProjectId();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const { data: project, isError: projectError, error: projectErrorObj } = useProject(projectId);
  const { data: insightsData } = useAiInsightsMeta(projectId);
  const { data: matViewMetrics } = useProjectMetrics(projectId);
  const { data: payApps } = usePayApplications(projectId);
  const { data: lienWaivers } = useLienWaivers(projectId);
  const { data: liveMetrics } = useLiveMetricsFallback(projectId, !!matViewMetrics);

  const loadSchedule = useScheduleStore((s) => s.loadSchedule);
  useEffect(() => { if (projectId) loadSchedule(projectId); }, [projectId, loadSchedule]);

  // Weather
  const { data: geoResult } = useQuery<GeocodingResult>({
    queryKey: ['project_geocode', projectId, project?.city, project?.state],
    queryFn: () => getProjectCoordinates(projectId!, project?.address, project?.city, project?.state, project?.latitude, project?.longitude),
    enabled: !!projectId && !!project,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const hasRealLocation = !!geoResult && geoResult.source !== 'default';
  const projectLat = geoResult?.lat;
  const projectLon = geoResult?.lon;
  const { data: weatherData } = useQuery<WeatherData>({
    queryKey: ['weather_current', projectId, projectLat, projectLon],
    queryFn: () => fetchWeather(projectLat, projectLon),
    enabled: !!projectId && hasRealLocation,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: forecastData } = useQuery<WeatherDay[]>({
    queryKey: ['weather_forecast', projectId, projectLat, projectLon],
    queryFn: () => fetchWeatherForecast5Day(projectLat!, projectLon!),
    enabled: !!projectId && hasRealLocation,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: schedulePhases } = useSchedulePhases(projectId);

  // Weather conflicts
  const weatherConflictInsights = useMemo<AIInsight[]>(() => {
    if (!hasRealLocation || !forecastData || !schedulePhases) return [];
    const nowStr = new Date().toISOString();
    const conflicts: AIInsight[] = [];
    const activePhases = schedulePhases.filter((p) => p.status !== 'complete' && (p.percent_complete ?? 0) < 100 && p.start_date);
    for (const day of forecastData) {
      if (day.precip_probability < 60) continue;
      const match = activePhases.find((p) => {
        const s = p.start_date!.split('T')[0];
        const e = p.end_date ? p.end_date.split('T')[0] : s;
        return day.date >= s && day.date <= e;
      });
      if (!match) continue;
      const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      conflicts.push({
        id: `weather-${day.date}-${match.id}`, type: 'risk',
        severity: day.precip_probability >= 80 ? 'critical' : 'warning',
        title: `${day.conditions} on ${dayLabel} may impact ${match.name ?? 'scheduled work'}`,
        description: `${day.precip_probability}% precipitation chance.`,
        affectedEntities: [{ type: 'schedule_phase', id: match.id, name: match.name ?? '' }],
        suggestedAction: `Review ${match.name} and prepare contingency`,
        confidence: 0.8, source: 'computed' as const,
        createdAt: nowStr, generatedAt: nowStr, dismissed: false,
      });
      if (conflicts.length >= 2) break;
    }
    return conflicts;
  }, [forecastData, schedulePhases]);

  const [now] = useState(() => Date.now());
  const [skeletonTimedOut, setSkeletonTimedOut] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSkeletonTimedOut(true), 5000); return () => clearTimeout(t); }, []);

  // ── Metrics ──────────────────────────────────────────
  const metrics = useMemo(() => {
    if (matViewMetrics) return matViewMetrics;
    if (!liveMetrics) return undefined;
    return {
      project_id: projectId ?? '', project_name: project?.name ?? '', contract_value: project?.contract_value ?? null,
      overall_progress: 0, milestones_completed: 0, milestones_total: 0, schedule_variance_days: 0,
      rfis_open: liveMetrics.rfis_open, rfis_overdue: liveMetrics.rfis_overdue, rfis_total: liveMetrics.rfis_total,
      avg_rfi_response_days: 0, punch_open: liveMetrics.punch_open, punch_total: liveMetrics.punch_total,
      budget_total: liveMetrics.budget_total, budget_spent: liveMetrics.budget_spent, budget_committed: 0,
      crews_active: 0, workers_onsite: 0, safety_incidents_this_month: 0,
      submittals_pending: liveMetrics.submittals_pending, submittals_approved: 0, submittals_total: liveMetrics.submittals_total,
    } satisfies import('../../types/api').ProjectMetrics;
  }, [matViewMetrics, liveMetrics, projectId, project?.name, project?.contract_value]);

  // ── Derived KPIs ─────────────────────────────────────
  const overallProgress = metrics?.overall_progress ?? 0;
  const scheduleHealth = useMemo(() => {
    const v = metrics?.schedule_variance_days ?? 0;
    if (v >= 0) return { days: v, label: v === 0 ? 'On Track' : `${v}d ahead`, positive: true };
    return { days: Math.abs(v), label: `${Math.abs(v)}d behind`, positive: false };
  }, [metrics?.schedule_variance_days]);

  const budgetData = useMemo(() => {
    const spent = metrics?.budget_spent ?? 0;
    const total = metrics?.budget_total ?? 1;
    const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
    return { spent, total, pct };
  }, [metrics?.budget_spent, metrics?.budget_total]);

  const rfiData = useMemo(() => ({ open: metrics?.rfis_open ?? 0, overdue: metrics?.rfis_overdue ?? 0 }), [metrics?.rfis_open, metrics?.rfis_overdue]);
  const punchData = useMemo(() => ({ open: metrics?.punch_open ?? 0, total: metrics?.punch_total ?? 0, resolved: (metrics?.punch_total ?? 0) - (metrics?.punch_open ?? 0) }), [metrics?.punch_open, metrics?.punch_total]);
  const safetyIncidents = metrics?.safety_incidents_this_month ?? null;
  const safetyScore = safetyIncidents !== null ? Math.max(0, Math.min(100, 100 - safetyIncidents * 5)) : null;

  const isEmptyProject = !metrics || ((metrics.rfis_total ?? 0) === 0 && (metrics.punch_total ?? 0) === 0 && (metrics.budget_total ?? 0) === 0);

  const targetCompletion = project?.target_completion ?? null;
  const daysRemaining = useMemo(() => targetCompletion ? Math.max(0, Math.ceil((new Date(targetCompletion).getTime() - now) / 86400000)) : 0, [targetCompletion, now]);
  const startDateStr = project?.start_date ?? null;
  const projectStartDate = useMemo(() => startDateStr ? new Date(startDateStr) : null, [startDateStr]);
  const dayNumber = useMemo(() => projectStartDate ? Math.max(1, Math.ceil((now - projectStartDate.getTime()) / 86400000)) : null, [now, projectStartDate]);
  const totalDays = useMemo(() => (dayNumber && daysRemaining > 0) ? dayNumber + daysRemaining : null, [dayNumber, daysRemaining]);

  const missingWaivers = useMemo(() => {
    const approvedAppIds = (payApps ?? []).filter((a) => a.status === 'approved' || a.status === 'paid').map((a) => a.id);
    if (approvedAppIds.length === 0) return [];
    const waiversByApp = new Map<string, { status: string }[]>();
    for (const w of (lienWaivers ?? []) as Array<{ pay_app_id: string; status: string }>) {
      const existing = waiversByApp.get(w.pay_app_id) ?? [];
      existing.push(w);
      waiversByApp.set(w.pay_app_id, existing);
    }
    return approvedAppIds.filter((id) => { const aw = waiversByApp.get(id) ?? []; return aw.length === 0 || aw.every((w) => w.status === 'pending'); });
  }, [payApps, lienWaivers]);

  const animProgress = useAnimatedNumber(overallProgress);

  // ── Focus Items ─────────────────────────────────────
  const focusItems = useMemo(() => {
    const items: { id: string; icon: React.ReactNode; label: string; detail: string; severity: 'critical' | 'warning' | 'info'; path: string }[] = [];
    if (rfiData.overdue > 0) items.push({ id: 'rfi-overdue', icon: <HelpCircle size={14} />, label: `${rfiData.overdue} overdue RFI${rfiData.overdue === 1 ? '' : 's'}`, detail: 'Blocking field work', severity: 'critical', path: '/rfis' });
    if (missingWaivers.length > 0) items.push({ id: 'waivers', icon: <Scale size={14} />, label: `${missingWaivers.length} missing lien waiver${missingWaivers.length === 1 ? '' : 's'}`, detail: 'Collect before release', severity: 'warning', path: '/payment-applications' });
    if (budgetData.pct > 85) items.push({ id: 'budget-risk', icon: <DollarSign size={14} />, label: `Budget at ${budgetData.pct}%`, detail: budgetData.pct > 95 ? 'Over budget risk' : 'Monitor closely', severity: budgetData.pct > 95 ? 'critical' : 'warning', path: '/budget' });
    if (!scheduleHealth.positive && scheduleHealth.days > 0) items.push({ id: 'schedule-behind', icon: <Calendar size={14} />, label: `${scheduleHealth.days}d behind schedule`, detail: 'Review critical path', severity: scheduleHealth.days > 14 ? 'critical' : 'warning', path: '/schedule' });
    if (punchData.open > 5) items.push({ id: 'punch', icon: <ClipboardList size={14} />, label: `${punchData.open} open punch items`, detail: `${punchData.resolved}/${punchData.total} resolved`, severity: punchData.open > 15 ? 'warning' : 'info', path: '/punch-list' });
    if ((metrics?.submittals_pending ?? 0) > 0) items.push({ id: 'submittals', icon: <Send size={14} />, label: `${metrics?.submittals_pending} pending submittal${(metrics?.submittals_pending ?? 0) === 1 ? '' : 's'}`, detail: 'Awaiting review', severity: 'info', path: '/submittals' });
    for (const c of weatherConflictInsights.slice(0, 1)) items.push({ id: c.id, icon: <CloudSun size={14} />, label: c.title, detail: '', severity: c.severity as 'critical' | 'warning', path: '/schedule' });
    const aiInsights = (insightsData?.insights ?? []).filter((i) => !i.dismissed).sort((a, b) => { const o: Record<string, number> = { critical: 0, warning: 1, info: 2 }; return (o[a.severity] ?? 2) - (o[b.severity] ?? 2); });
    for (const insight of aiInsights.slice(0, 1)) { if (items.length >= 4) break; items.push({ id: insight.id, icon: <Sparkles size={14} />, label: insight.title, detail: insight.suggestedAction ?? '', severity: insight.severity as 'critical' | 'warning' | 'info', path: '/rfis' }); }
    return items.slice(0, 4);
  }, [rfiData, missingWaivers, budgetData, scheduleHealth, punchData, metrics?.submittals_pending, weatherConflictInsights, insightsData?.insights]);

  // ── Time & User ──────────────────────────────────────
  const today = useMemo(() => new Date(), []);
  const greeting = getGreeting(today.getHours());
  const firstName = getFirstName(user);
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const sevColor = (s: string) => s === 'critical' ? colors.statusCritical : s === 'warning' ? colors.statusPending : colors.textSecondary;
  const sevBg = (s: string) => s === 'critical' ? colors.statusCriticalSubtle : s === 'warning' ? colors.statusPendingSubtle : colors.surfaceInset;

  const m = (delay: number) => reducedMotion ? {} : fadeUp(delay);

  // ── Error / Loading ──────────────────────────────────
  if (projectError) {
    return (
      <PageContainer>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', padding: spacing['8'] }}>
          <AlertCircle size={32} color={colors.statusCritical} style={{ marginBottom: spacing['4'] }} />
          <h2 style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Unable to load project</h2>
          <p style={{ margin: 0, marginBottom: spacing['6'], fontSize: typography.fontSize.sm, color: colors.textSecondary, maxWidth: 340 }}>{projectErrorObj?.message || 'Check your connection and try again.'}</p>
          <button onClick={() => window.location.reload()} style={{ padding: `10px 24px`, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.lg, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer', transition: 'opacity 0.15s' }}>Retry</button>
        </div>
      </PageContainer>
    );
  }
  if (!project && !skeletonTimedOut) return <DashboardSkeleton />;

  // ════════════════════════════════════════════════════════
  // ══  RENDER                                           ══
  // ════════════════════════════════════════════════════════

  return (
    <PageContainer>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: `${spacing['10']} 0 ${spacing['16']}` }}>

        {/* ═══════════════════════════════════════════════════════════
            HERO — Calm authority. Project name is the anchor.
            Progress bar lives here — not in the metrics grid.
        ═══════════════════════════════════════════════════════════ */}
        <motion.header {...m(0)} style={{ marginBottom: spacing['8'] }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing['1'] }}>
            <p style={{
              margin: 0,
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
              letterSpacing: '0.3px',
              fontWeight: typography.fontWeight.medium,
            }}>
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </p>
            <p style={{
              margin: 0,
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
              letterSpacing: '0.3px',
              fontWeight: typography.fontWeight.medium,
            }}>
              {dateStr}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing['6'] }}>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
            }}>
              {project?.name ?? 'Project'}
            </h1>
            {hasRealLocation && weatherData && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['1.5'], flexShrink: 0 }}>
                <span style={{ fontSize: 18, lineHeight: 1, position: 'relative', top: 2 }}>{weatherData.icon}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                  {weatherData.temp_high}°
                </span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {weatherData.temp_low}°
                </span>
              </div>
            )}
          </div>
          {/* Progress bar — thin, elegant, integrated */}
          <div style={{ marginTop: spacing['3'], display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceInset, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(overallProgress, 100)}%` }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', backgroundColor: colors.brand400, borderRadius: 2 }}
              />
            </div>
            <span style={{
              fontSize: '11px', fontWeight: typography.fontWeight.semibold,
              color: overallProgress > 0 ? colors.textPrimary : colors.textTertiary,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
              flexShrink: 0, minWidth: 32, textAlign: 'right',
            }}>
              {Math.round(animProgress)}%
            </span>
            {dayNumber !== null && (
              <span style={{ fontSize: '10px', color: colors.textSecondary, flexShrink: 0 }}>
                Day {dayNumber}{totalDays ? ` / ${totalDays}` : ''}
              </span>
            )}
          </div>
        </motion.header>

        {/* ═══════════════════════════════════════════════════════════
            METRICS — The heartbeat. 4 KPI tiles + Progress Ring.
            Each tile is its own card with internal hierarchy:
            LABEL → BIG NUMBER → context line
            The ring sits at the end as a visual anchor.
        ═══════════════════════════════════════════════════════════ */}
        <motion.div {...m(0.05)} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['8'] }}>
          <MetricTile
            label="Schedule"
            value={scheduleHealth.days === 0 ? '0' : `${scheduleHealth.positive ? '+' : '–'}${scheduleHealth.days}`}
            unit="days"
            context={scheduleHealth.label}
            color={scheduleHealth.days === 0 ? colors.statusActive : scheduleHealth.positive ? colors.statusActive : colors.statusCritical}
            onClick={() => navigate('/schedule')}
          />
          <MetricTile
            label="Budget"
            value={budgetData.spent === 0 && budgetData.total <= 1 ? '—' : compactDollars(budgetData.spent)}
            context={budgetData.total <= 1 ? 'Not set' : `${budgetData.pct}% of ${compactDollars(budgetData.total)}`}
            color={budgetData.total <= 1 ? colors.textTertiary : budgetData.pct > 95 ? colors.statusCritical : budgetData.pct > 80 ? colors.statusPending : colors.textPrimary}
            onClick={() => navigate('/budget')}
            bar={budgetData.total > 1 ? { pct: budgetData.pct, color: budgetData.pct > 95 ? colors.statusCritical : budgetData.pct > 80 ? colors.statusPending : colors.statusActive } : undefined}
          />
          <MetricTile
            label="Open RFIs"
            value={String(rfiData.open)}
            context={rfiData.overdue > 0 ? `${rfiData.overdue} overdue` : rfiData.open > 0 ? 'None overdue' : 'All clear'}
            color={rfiData.overdue > 0 ? colors.statusCritical : colors.textPrimary}
            onClick={() => navigate('/rfis')}
          />
          <MetricTile
            label="Safety"
            value={safetyScore !== null ? String(safetyScore) : '—'}
            unit={safetyScore !== null ? '/100' : undefined}
            context={safetyScore === null ? 'No data' : safetyScore >= 90 ? 'Excellent' : safetyScore >= 70 ? 'Good' : 'At risk'}
            color={safetyScore === null ? colors.textTertiary : safetyScore >= 90 ? colors.statusActive : safetyScore >= 70 ? colors.statusPending : colors.statusCritical}
            onClick={() => navigate('/safety')}
          />
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            PROJECT HEALTH — Unified 0-100 score synthesizing cost,
            schedule, safety, and quality. Sits between the KPI tiles
            and the focus list as a command-deck summary.
        ═══════════════════════════════════════════════════════════ */}
        {!isEmptyProject && (
          <motion.div {...m(0.08)} style={{ marginBottom: spacing['8'] }}>
            <DashboardProjectHealth metrics={metrics} />
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            FOCUS — What needs your attention right now.
            Elevated prominence. These are the reason you opened the app.
            No header text needed — the visual weight speaks.
        ═══════════════════════════════════════════════════════════ */}
        {focusItems.length > 0 && (
          <motion.div {...m(0.1)} style={{ marginBottom: spacing['8'] }}>
            <div style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.xl,
              overflow: 'hidden',
            }}>
              {focusItems.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['3.5']} ${spacing['5']}`,
                    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    borderBottom: i < focusItems.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                    background: 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontFamily,
                    width: '100%', transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: borderRadius.lg, flexShrink: 0,
                    backgroundColor: sevBg(item.severity),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: sevColor(item.severity),
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{item.label}</span>
                    {item.detail && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['2'] }}>{item.detail}</span>}
                  </div>
                  <ChevronRight size={14} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            AI BRIEFING — Intelligence, not decoration
        ═══════════════════════════════════════════════════════════ */}
        {!isEmptyProject && (
          <ErrorBoundary message="">
            <DashboardBriefingAI />
          </ErrorBoundary>
        )}

        {/* ═══════════════════════════════════════════════════════════
            COMMAND WIDGETS — absorbed routes (Tasks, Portfolio,
            Carbon, Site Map, Compliance). Two-column balanced grid.
        ═══════════════════════════════════════════════════════════ */}
        <motion.div {...m(0.13)} style={{ marginBottom: spacing['8'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <ErrorBoundary message="">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing['4'] }}>
              <DashboardMyTasks />
              <DashboardCompliance projectId={projectId} />
              <DashboardCarbon projectId={projectId} />
              <Suspense fallback={<div style={{ minHeight: 220 }} />}>
                <DashboardSiteMapMini projectId={projectId} projectLat={projectLat} projectLon={projectLon} />
              </Suspense>
            </div>
          </ErrorBoundary>
          <ErrorBoundary message="">
            <DashboardPortfolio />
          </ErrorBoundary>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            LOWER DECK — Adaptive layout: 2-col when both sides have
            content, single column when only forecast/critical path exist.
        ═══════════════════════════════════════════════════════════ */}
        <LowerDeck
          forecastData={hasRealLocation ? forecastData : undefined}
          isEmptyProject={isEmptyProject}
          delay={0.15}
          m={m}
        />

        {/* Onboarding for empty projects — before quick nav so it's prominent */}
        {isEmptyProject && <OnboardingChecklist navigate={navigate} reducedMotion={reducedMotion} />}

        <Suspense fallback={null}>
          <QuickRFIButton />
        </Suspense>
      </div>
    </PageContainer>
  );
};

// ════════════════════════════════════════════════════════════════
// ══  LOWER DECK — Adaptive layout                              ══
// ══  Two columns when both sides have content.                 ══
// ══  Full-width when only one side exists.                     ══
// ════════════════════════════════════════════════════════════════

interface LowerDeckProps {
  forecastData: WeatherDay[] | undefined;
  isEmptyProject: boolean;
  delay: number;
  m: (d: number) => Record<string, unknown>;
}

const LowerDeck: React.FC<LowerDeckProps> = React.memo(({ forecastData, isEmptyProject, delay, m }) => {
  const projectId = useProjectId();
  const { data: activities } = useActivityFeed(projectId);
  const hasActivity = (activities ?? []).length > 0;
  const hasForecast = forecastData && forecastData.length > 0;

  if (isEmptyProject) {
    // For empty projects, only show forecast if available (single column, full width)
    if (!hasForecast) return null;
    return (
      <motion.div {...m(delay)} style={{ marginBottom: spacing['8'] }}>
        <ForecastStrip forecastData={forecastData!} />
      </motion.div>
    );
  }

  // Two-column only when both sides have content
  const hasBothColumns = hasForecast && hasActivity;

  return (
    <motion.div {...m(delay)} style={{
      display: 'grid',
      gridTemplateColumns: hasBothColumns ? '2fr 3fr' : '1fr',
      gap: spacing['4'],
      marginBottom: spacing['8'],
      alignItems: 'start',
    }}>
      {/* Left: Forecast + Critical Path */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        {hasForecast && <ForecastStrip forecastData={forecastData!} />}
        <CriticalPathCard />
      </div>

      {/* Right: Activity Feed — only if it has content */}
      {hasActivity && <ActivityFeedCard />}
    </motion.div>
  );
});
LowerDeck.displayName = 'LowerDeck';

// ── Forecast Strip ────────────────────────────────────────

const ForecastStrip: React.FC<{ forecastData: WeatherDay[] }> = ({ forecastData }) => (
  <div style={{ padding: spacing['4'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl, border: `1px solid ${colors.borderSubtle}` }}>
    <p style={{ margin: 0, marginBottom: spacing['3'], fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      5-Day Forecast
    </p>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {forecastData.slice(0, 5).map((day, i) => {
        const isRainy = day.precip_probability >= 60;
        const isToday = i === 0;
        return (
          <div key={day.date} style={{ textAlign: 'center', flex: 1 }}>
            <p style={{ margin: 0, fontSize: '10px', color: isToday ? colors.textPrimary : colors.textTertiary, fontWeight: isToday ? typography.fontWeight.semibold : typography.fontWeight.medium, marginBottom: 6 }}>
              {isToday ? 'Today' : new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
            </p>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{day.icon}</span>
            <p style={{ margin: 0, marginTop: 6, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
              {day.temp_high}°
            </p>
            <p style={{ margin: 0, marginTop: 1, fontSize: '10px', color: colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
              {day.temp_low}°
            </p>
            {isRainy && (
              <p style={{ margin: 0, marginTop: 2, fontSize: '9px', color: colors.statusPending, fontWeight: typography.fontWeight.semibold }}>
                {day.precip_probability}%
              </p>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════
// ══  METRIC TILE                                              ══
// ══  The fundamental unit. Clean internal hierarchy:          ══
// ══  muted label → bold number → context in tertiary.        ══
// ══  Hover lifts subtly. Click navigates.                     ══
// ════════════════════════════════════════════════════════════════

interface MetricTileProps {
  label: string;
  value: string;
  unit?: string;
  context: string;
  color: string;
  onClick: () => void;
  bar?: { pct: number; color: string };
}

const MetricTile: React.FC<MetricTileProps> = ({ label, value, unit, context, color, onClick, bar }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: `${spacing['5']} ${spacing['5']}`,
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderSubtle}`,
      borderRadius: borderRadius.xl,
      cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontFamily,
      transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease, border-color 0.2s ease',
      minHeight: 120,
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = 'var(--color-borderDefault)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-borderSubtle)'; }}
  >
    <span style={{ fontSize: '11px', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
      {label}
    </span>
    <div style={{ marginTop: spacing['3'] }}>
      <span style={{
        fontSize: '28px', fontWeight: typography.fontWeight.bold, color,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1,
      }}>
        {value}
      </span>
      {unit && <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, marginLeft: 3 }}>{unit}</span>}
    </div>
    <span style={{ fontSize: '12px', color: colors.textTertiary, marginTop: spacing['2'], lineHeight: 1.3 }}>
      {context}
    </span>
    {bar && (
      <div style={{ height: 3, borderRadius: 2, backgroundColor: colors.surfaceInset, marginTop: spacing['2.5'], overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(bar.pct, 100)}%`, backgroundColor: bar.color, borderRadius: 2, transition: 'width 1s ease' }} />
      </div>
    )}
  </button>
);

// ════════════════════════════════════════════════════════════════
// ══  CRITICAL PATH CARD                                       ══
// ════════════════════════════════════════════════════════════════

const CriticalPathCard: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const { data: phases } = useSchedulePhases(projectId);

  const criticalItems = useMemo(() => {
    if (!phases) return [];
    return phases
      .filter((p) => p.is_critical_path && (p.percent_complete ?? 0) < 100)
      .sort((a, b) => (a.end_date ?? '9999').localeCompare(b.end_date ?? '9999'))
      .slice(0, 3);
  }, [phases]);

  if (criticalItems.length === 0) return null;

  return (
    <div style={{ padding: spacing['4'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl, border: `1px solid ${colors.borderSubtle}`, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Critical Path
        </p>
        <button onClick={() => navigate('/schedule')} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: colors.textTertiary, fontFamily: typography.fontFamily, padding: 0, fontWeight: typography.fontWeight.medium }}>
          View all <ChevronRight size={10} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2.5'] }}>
        {criticalItems.map((phase) => {
          const progress = phase.percent_complete ?? 0;
          const endDate = phase.end_date ? new Date(phase.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
          const floatDays = phase.float_days;
          return (
            <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
              <div style={{
                width: 30, height: 30, borderRadius: borderRadius.full, flexShrink: 0,
                border: `2.5px solid ${progress >= 80 ? colors.statusActive : progress >= 40 ? colors.statusPending : colors.borderDefault}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: typography.fontWeight.bold,
                color: progress >= 80 ? colors.statusActive : progress >= 40 ? colors.statusPending : colors.textTertiary,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {progress}%
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {phase.name ?? 'Unnamed'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: 1 }}>
                  {endDate && <span style={{ fontSize: '10px', color: colors.textTertiary }}><Clock size={8} style={{ marginRight: 2, verticalAlign: 'middle' }} />{endDate}</span>}
                  {typeof floatDays === 'number' && floatDays <= 0 && (
                    <span style={{ fontSize: '10px', color: colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>Zero float</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
CriticalPathCard.displayName = 'CriticalPathCard';

// ════════════════════════════════════════════════════════════════
// ══  ACTIVITY FEED CARD                                       ══
// ════════════════════════════════════════════════════════════════

const TYPE_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  rfi: { icon: HelpCircle, color: colors.statusInfo },
  submittal: { icon: FileText, color: colors.statusReview },
  change_order: { icon: DollarSign, color: colors.statusPending },
  punch_item: { icon: AlertCircle, color: colors.statusCritical },
  punch_list_item: { icon: AlertCircle, color: colors.statusCritical },
  daily_log: { icon: Calendar, color: colors.textTertiary },
  safety: { icon: Shield, color: colors.statusCritical },
  task: { icon: ClipboardList, color: colors.statusActive },
  drawing: { icon: FileText, color: colors.statusInfo },
};

const ENTITY_ROUTES: Record<string, string> = {
  rfi: '/rfis', submittal: '/submittals', change_order: '/change-orders',
  punch_item: '/punch-list', punch_list_item: '/punch-list', daily_log: '/daily-log',
  task: '/schedule', drawing: '/drawings', meeting: '/meetings', safety: '/safety',
  incident: '/safety', safety_inspection: '/safety',
};

function getEntityRoute(entityType: string, entityId?: string): string | undefined {
  const base = ENTITY_ROUTES[entityType];
  if (!base || !entityId) return base;
  // Deep-link to specific entity where supported
  if (entityType === 'rfi') return `/rfis/${entityId}`;
  if (entityType === 'submittal') return `/submittals/${entityId}`;
  if (entityType === 'punch_item' || entityType === 'punch_list_item') return `/punch-list?item=${entityId}`;
  if (entityType === 'change_order') return `/change-orders/${entityId}`;
  if (entityType === 'drawing') return `/drawings/${entityId}`;
  if (entityType === 'daily_log') return `/daily-log/${entityId}`;
  if (entityType === 'incident' || entityType === 'safety_inspection') return `/safety?id=${entityId}`;
  return base;
}

const ActivityFeedCard: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const { data: activities } = useActivityFeed(projectId);
  const items = useMemo(() => (activities ?? []).slice(0, 6), [activities]);

  if (items.length === 0) return null;

  return (
    <div style={{ padding: spacing['4'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl, border: `1px solid ${colors.borderSubtle}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Recent Activity
        </p>
        <span style={{ fontSize: '10px', color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{items.length} updates</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['0.5'] }}>
        {items.map((item) => {
          const { icon: Icon, color: iconColor } = TYPE_ICONS[item.entityType] ?? { icon: FileText, color: colors.textTertiary };
          const route = getEntityRoute(item.entityType, item.entityId);
          const verb = item.verb.replace(/_/g, ' ').replace(/^(rfi|submittal|punch|change order|daily log|task|drawing|meeting|incident|safety inspection|safety)\s*/i, '').trim() || 'updated';
          const displayName = item.actorName === 'Unknown User' ? 'You' : item.actorName;
          return (
            <button
              key={item.id}
              onClick={route ? () => navigate(route) : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2.5'],
                padding: `${spacing['2']} ${spacing['2']}`,
                borderRadius: borderRadius.base,
                background: 'none', border: 'none',
                width: '100%', textAlign: 'left', fontFamily: typography.fontFamily,
                cursor: route ? 'pointer' : 'default', transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={route ? (e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; } : undefined}
              onMouseLeave={route ? (e) => { e.currentTarget.style.backgroundColor = 'transparent'; } : undefined}
            >
              <div style={{ width: 22, height: 22, borderRadius: borderRadius.full, backgroundColor: colors.surfaceInset, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={10} color={iconColor} />
              </div>
              <p style={{ margin: 0, flex: 1, fontSize: '11px', color: colors.textSecondary, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{displayName}</span>
                {' '}{verb}
                {item.entityLabel && <> <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{item.entityLabel.replace(/^(Created|Updated|Deleted)\s+/i, '')}</span></>}
              </p>
              <span style={{ fontSize: '10px', color: colors.textTertiary, whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {relativeTime(item.createdAt)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
ActivityFeedCard.displayName = 'ActivityFeedCard';

// ── Re-export for other files ──────────────��──────────
export { ProgressRing } from './DashboardMetrics';
