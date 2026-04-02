import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, ChevronDown, ChevronUp, CheckCircle, RefreshCw, Zap, CalendarClock, TrendingUp, GitBranch, Gauge, CalendarCheck, Calendar, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Card, SectionHeader, MetricBox, Skeleton, Btn, useToast } from '../components/Primitives';
import { useRealtimeSchedulePhases, useScheduleRealtime } from '../hooks/queries/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useScheduleStore } from '../stores/scheduleStore';
import { useProjectContext } from '../stores/projectContextStore';
import { useProjectMetrics } from '../hooks/useProjectMetrics';
import { useCopilotStore } from '../stores/copilotStore';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { GanttChart } from '../components/schedule/GanttChart';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MobileScheduleView } from '../components/schedule/MobileScheduleView';
import { predictScheduleRisks } from '../lib/predictions';
import type { PredictedRisk, WeatherDay } from '../lib/predictions';
import { computeScheduleKPIs } from '../lib/criticalPath';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

interface ScheduleKPICardProps {
  icon: React.ReactNode
  label: string
  value: string
  valueColor: string
  trend: 'up' | 'down' | 'neutral'
}

const ScheduleKPICard: React.FC<ScheduleKPICardProps> = ({ icon, label, value, valueColor, trend }) => (
  <div style={{
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }}>
    {icon}
    <span style={{ fontSize: '12px', color: colors.textTertiary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.normal }}>
      {label}
    </span>
    <span style={{ fontSize: '28px', fontWeight: typography.fontWeight.semibold, color: valueColor, lineHeight: 1.1 }}>
      {value}
    </span>
    <span style={{ fontSize: '12px', color: trend === 'up' ? colors.statusActive : trend === 'down' ? colors.statusCritical : colors.textTertiary }}>
      {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─'}
    </span>
  </div>
);

// 7-day mock forecast (would come from real weather API in production)
const MOCK_FORECAST: WeatherDay[] = Array.from({ length: 7 }, (_, i) => {
  const conditions = (['Clear', 'Rain', 'Clear', 'Cloudy', 'Rain', 'Snow', 'Clear'] as const)[i];
  return {
    date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
    conditions,
    precipitationChance: conditions === 'Rain' ? 75 : conditions === 'Snow' ? 65 : 10,
    tempHigh: 54 - i * 2,
    tempLow: 38 - i,
  };
});

export const Schedule: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { activeProject } = useProjectContext();
  const queryClient = useQueryClient();
  const { phases: schedulePhases, metrics, loading, error, loadSchedule } = useScheduleStore();
  const { data: projectMetrics } = useProjectMetrics(activeProject?.id);
  const { createConversation, sendMessage, setActiveConversation, setPageContext } = useCopilotStore();
  const navigate = useNavigate();

  const refetch = useCallback(() => {
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id, loadSchedule]);

  useEffect(() => { setPageContext('schedule'); }, [setPageContext]);

  useEffect(() => {
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id]);

  useEffect(() => {
    const projectId = activeProject?.id;
    if (!projectId) return;
    const channel = supabase
      .channel('schedule:' + projectId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_phases', filter: 'project_id=eq.' + projectId }, () => {
        queryClient.invalidateQueries({ queryKey: ['schedule', projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeProject?.id, queryClient]);

  const [whatIfMode, setWhatIfMode] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [recoveryExpanded, setRecoveryExpanded] = useState(false);
  const { addToast } = useToast();

  // dirtyPhaseIds: pass phase IDs currently being edited to get conflict toasts.
  // Populated by whichever editing UI sets them; empty set is safe.
  const [dirtyPhaseIds] = useState<ReadonlySet<string>>(() => new Set());
  const { isSubscribed: phasesSubscribed } = useRealtimeSchedulePhases(
    activeProject?.id ?? '',
    dirtyPhaseIds
  );
  const { isSubscribed: activitiesSubscribed } = useScheduleRealtime(activeProject?.id ?? '');
  const liveActive = phasesSubscribed || activitiesSubscribed;

  // Predictive risk state
  const [risks, setRisks] = useState<PredictedRisk[]>([]);
  const [riskPanelOpen, setRiskPanelOpen] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const kpis = useMemo(() => computeScheduleKPIs(schedulePhases), [schedulePhases])

  const activityMetrics = useMemo(() => {
    if (schedulePhases.length === 0) {
      return {
        scheduleVarianceDays: 0,
        criticalPathCount: 0,
        onTrackPct: 0,
        completePct: 0,
      }
    }

    // Schedule Variance: projected finish minus planned finish for the latest activity (positive = behind)
    const lastActivity = schedulePhases.reduce((latest, p) =>
      new Date(p.endDate) > new Date(latest.endDate) ? p : latest
    )
    let scheduleVarianceDays = 0
    if (lastActivity.baselineEndDate) {
      const projected = new Date(lastActivity.endDate)
      const planned = new Date(lastActivity.baselineEndDate)
      projected.setHours(0, 0, 0, 0)
      planned.setHours(0, 0, 0, 0)
      scheduleVarianceDays = Math.round((projected.getTime() - planned.getTime()) / 86400000)
    }

    // Critical Path Items: activities where is_critical_path === true
    const criticalPathCount = schedulePhases.filter(p => p.is_critical_path === true).length

    // On Track: percentage where status !== 'delayed'
    const onTrackCount = schedulePhases.filter(p => p.status !== 'delayed').length
    const onTrackPct = Math.round((onTrackCount / schedulePhases.length) * 100)

    // Complete: percentage where status === 'completed'
    const completeCount = schedulePhases.filter(p => p.status === 'completed').length
    const completePct = Math.round((completeCount / schedulePhases.length) * 100)

    return {
      scheduleVarianceDays,
      criticalPathCount,
      onTrackPct,
      completePct,
    }
  }, [schedulePhases]);

  const runAnalysis = useCallback(() => {
    setAnalyzing(true);
    // Simulate brief async analysis delay for UX feedback
    setTimeout(() => {
      const results = predictScheduleRisks(schedulePhases, MOCK_FORECAST);
      setRisks(results);
      setLastAnalyzed(new Date());
      setMinutesAgo(0);
      setAnalyzing(false);
    }, 800);
  }, [schedulePhases]);

  // Run analysis when phases first load
  useEffect(() => {
    if (schedulePhases.length > 0 && lastAnalyzed === null) {
      runAnalysis();
    }
  }, [schedulePhases, lastAnalyzed, runAnalysis]);

  // Tick the "X minutes ago" counter
  useEffect(() => {
    if (lastAnalyzed === null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setMinutesAgo(Math.floor((Date.now() - lastAnalyzed.getTime()) / 60000));
    }, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lastAnalyzed]);

  const openCopilotWithRisk = useCallback(async (risk: PredictedRisk) => {
    const prompt = `Generate a detailed recovery plan for the ${risk.title} phase. Risk assessment: ${risk.reason} Likelihood: ${risk.likelihoodPercent}%, potential impact: +${risk.impactDays} days. Suggested action: ${risk.suggestedAction}`;
    const convId = createConversation(`Recovery Plan: ${risk.title}`);
    setActiveConversation(convId);
    navigate('/copilot');
    // Fire-and-forget the initial message after navigation
    setTimeout(() => sendMessage(prompt), 100);
  }, [createConversation, setActiveConversation, sendMessage, navigate]);

  const GANTT_ROW_WIDTHS = ['70%', '55%', '85%', '40%', '90%', '60%', '75%', '45%'];

  if (loading && schedulePhases.length === 0) {
    return (
      <PageContainer title="Schedule" subtitle="Loading...">
        <style>{`
          @media (max-width: 1024px) and (min-width: 641px) { .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 640px) { .kpi-grid { grid-template-columns: 1fr !important; } }
          @keyframes schedPulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.3; } }
        `}</style>
        <div
          className="kpi-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: spacing.lg,
            marginBottom: spacing['2xl'],
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: '104px',
                backgroundColor: '#E5E7EB',
                borderRadius: '12px',
                animation: 'schedPulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: spacing.lg,
            marginBottom: spacing['2xl'],
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: '80px',
                backgroundColor: '#E5E7EB',
                borderRadius: '12px',
                animation: 'schedPulse 1.5s ease-in-out infinite',
                animationDelay: `${(i + 5) * 0.1}s`,
              }}
            />
          ))}
        </div>
        <SectionHeader title="Project Timeline" />
        <Card padding={spacing.xl}>
          {GANTT_ROW_WIDTHS.map((rowWidth, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: i === 0 ? 0 : '8px',
              }}
            >
              <motion.div
                animate={{ opacity: [0.7, 0.3, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: i * 0.08 }}
                style={{
                  flexShrink: 0,
                  width: '170px',
                  height: '32px',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '4px',
                }}
              />
              <motion.div
                animate={{ opacity: [0.7, 0.3, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: i * 0.08 + 0.05 }}
                style={{
                  width: rowWidth,
                  height: '32px',
                  backgroundColor: '#E5E7EB',
                  borderRadius: '4px',
                }}
              />
            </div>
          ))}
        </Card>
      </PageContainer>
    );
  }
  const pageAlerts = getPredictiveAlertsForPage('schedule');

  const liveIndicator = liveActive ? (
    <div
      aria-label="Live updates active"
      role="status"
      title="Live updates active"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: '#6B7280',
        fontWeight: 500,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#4EC896',
          animation: 'livePulse 1.8s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      Live
    </div>
  ) : null;

  return (
    <PageContainer
      title="Schedule"
      subtitle={`${metrics.daysBeforeSchedule} days ahead \u00B7 ${metrics.milestonesHit}/${metrics.milestoneTotal} milestones`}
      actions={liveIndicator}
    >
      <a
        href="#gantt-activities"
        style={{
          position: 'absolute',
          left: -9999,
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
          zIndex: 1000,
          backgroundColor: '#0F1629',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '14px',
          fontFamily: 'inherit',
          fontWeight: 500,
        }}
        onFocus={e => Object.assign(e.currentTarget.style, { left: '16px', top: '16px', width: 'auto', height: 'auto', overflow: 'visible' })}
        onBlur={e => Object.assign(e.currentTarget.style, { left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' })}
      >
        Skip to schedule activities
      </a>
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} onAction={() => setRecoveryExpanded(!recoveryExpanded)} />
      ))}

      {recoveryExpanded && (
        <div style={{
          padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'],
          backgroundColor: `${colors.statusPending}06`, borderRadius: borderRadius.md,
          border: `1px solid ${colors.statusPending}15`,
          animation: 'slideInUp 200ms ease-out',
        }}>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Recovery Plan</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {[
              'Authorize MEP overtime on floors 4 through 6 to recover 4 days of schedule float.',
              'Redirect Exterior Crew D to secondary facade sections while RFI 004 is resolved.',
              'Batch Tuesday RFI reviews with MEP consultant to reduce average response time by 40%.',
            ].map((action, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.semibold }}>{i + 1}.</span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>{action}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setRecoveryExpanded(false)} style={{ marginTop: spacing['3'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, color: colors.textTertiary, cursor: 'pointer' }}>
            Collapse
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) and (min-width: 641px) { .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) { .kpi-grid { grid-template-columns: 1fr !important; } }
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.35); } }
      `}</style>

      {/* KPI Metric Cards */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}
      >
        {/* Card 1: Schedule Variance */}
        <ScheduleKPICard
          icon={<Calendar size={24} color={
            activityMetrics.scheduleVarianceDays <= 0 ? colors.statusActive
            : activityMetrics.scheduleVarianceDays <= 5 ? colors.statusPending
            : colors.statusCritical
          } />}
          label="Schedule Variance"
          value={`${activityMetrics.scheduleVarianceDays > 0 ? '+' : ''}${activityMetrics.scheduleVarianceDays}d`}
          valueColor={
            activityMetrics.scheduleVarianceDays <= 0 ? colors.statusActive
            : activityMetrics.scheduleVarianceDays <= 5 ? colors.statusPending
            : colors.statusCritical
          }
          trend={activityMetrics.scheduleVarianceDays > 0 ? 'down' : activityMetrics.scheduleVarianceDays < 0 ? 'up' : 'neutral'}
        />
        {/* Card 2: Critical Path Items */}
        <ScheduleKPICard
          icon={<AlertTriangle size={24} color={activityMetrics.criticalPathCount > 0 ? colors.statusCritical : colors.statusActive} />}
          label="Critical Path Items"
          value={String(activityMetrics.criticalPathCount)}
          valueColor={activityMetrics.criticalPathCount > 0 ? colors.statusCritical : colors.textPrimary}
          trend="neutral"
        />
        {/* Card 3: On Track */}
        <ScheduleKPICard
          icon={<CheckCircle size={24} color={
            activityMetrics.onTrackPct >= 80 ? colors.statusActive
            : activityMetrics.onTrackPct >= 60 ? colors.statusPending
            : colors.statusCritical
          } />}
          label="On Track"
          value={`${activityMetrics.onTrackPct}%`}
          valueColor={
            activityMetrics.onTrackPct >= 80 ? colors.statusActive
            : activityMetrics.onTrackPct >= 60 ? colors.statusPending
            : colors.statusCritical
          }
          trend={activityMetrics.onTrackPct >= 80 ? 'up' : 'down'}
        />
        {/* Card 4: Complete */}
        <ScheduleKPICard
          icon={<BarChart3 size={24} color={colors.primaryOrange} />}
          label="Complete"
          value={`${activityMetrics.completePct}%`}
          valueColor={colors.textPrimary}
          trend="neutral"
        />
      </div>

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}
      >
        <MetricBox label="Days Ahead" value={metrics.daysBeforeSchedule} />
        <MetricBox label="Milestones" value={`${metrics.milestonesHit}/${metrics.milestoneTotal}`} />
        <MetricBox
          label="AI Confidence"
          value={projectMetrics?.aiConfidenceLevel == null ? 'Insufficient data' : projectMetrics.aiConfidenceLevel}
          unit={projectMetrics?.aiConfidenceLevel == null ? undefined : '%'}
        />
      </div>

      {/* AI Risk Panel */}
      <div style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${risks.length > 0 ? `${colors.primaryOrange}30` : colors.borderDefault}`,
        marginBottom: spacing['5'],
        overflow: 'hidden',
        boxShadow: shadows.sm,
      }}>
        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['3']} ${spacing['4']}`,
          borderBottom: riskPanelOpen ? `1px solid ${colors.borderDefault}` : 'none',
          cursor: 'pointer',
          backgroundColor: risks.length > 0 ? `${colors.primaryOrange}05` : 'transparent',
        }}
          onClick={() => setRiskPanelOpen((v) => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Zap size={15} color={risks.length > 0 ? colors.primaryOrange : colors.statusActive} fill={risks.length > 0 ? colors.primaryOrange : colors.statusActive} />
            <span style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
              AI Risk Analysis
            </span>
            {risks.length > 0 && (
              <span style={{
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                backgroundColor: `${colors.primaryOrange}18`, color: colors.primaryOrange,
                padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
              }}>
                {risks.length} risk{risks.length > 1 ? 's' : ''} detected
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            {lastAnalyzed && !analyzing && (
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                Last analyzed: {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
              disabled={analyzing}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                color: analyzing ? colors.textTertiary : colors.primaryOrange,
                background: 'none', border: 'none', cursor: analyzing ? 'default' : 'pointer',
                fontFamily: typography.fontFamily, padding: 0,
              }}
            >
              <RefreshCw size={11} style={{ animation: analyzing ? 'spin 1s linear infinite' : 'none' }} />
              Re-analyze
            </button>
            {riskPanelOpen ? <ChevronUp size={14} color={colors.textTertiary} /> : <ChevronDown size={14} color={colors.textTertiary} />}
          </div>
        </div>

        {/* Panel body */}
        {riskPanelOpen && (
          <div style={{ padding: spacing['4'] }}>
            {analyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-start' }}>
                    <Skeleton height="36px" width="36px" />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                      <Skeleton height="14px" width="40%" />
                      <Skeleton height="12px" width="80%" />
                    </div>
                  </div>
                ))}
              </div>
            ) : risks.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} 0` }}>
                <CheckCircle size={16} color={colors.statusActive} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  No risks detected for the next 7 days. Schedule looks healthy.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                {risks.map((risk) => (
                  <div key={risk.phaseId} style={{
                    display: 'flex', gap: spacing['3'], alignItems: 'flex-start',
                    padding: `${spacing['3']} ${spacing['3']}`,
                    backgroundColor: `${colors.primaryOrange}06`,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${colors.primaryOrange}15`,
                  }}>
                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      <AlertTriangle size={15} color={colors.primaryOrange} fill={`${colors.primaryOrange}25`} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap', marginBottom: spacing['1'] }}>
                        <span style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                          {risk.title}
                        </span>
                        <span style={{
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          backgroundColor: risk.likelihoodPercent >= 70 ? `${colors.statusCritical}15` : `${colors.statusPending}15`,
                          color: risk.likelihoodPercent >= 70 ? colors.statusCritical : colors.statusPending,
                          padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                        }}>
                          {risk.likelihoodPercent}% likely
                        </span>
                        <span style={{
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          backgroundColor: `${colors.primaryOrange}12`, color: colors.primaryOrange,
                          padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                        }}>
                          +{risk.impactDays} day{risk.impactDays > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                        {risk.reason}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <button
                        onClick={() => openCopilotWithRisk(risk)}
                        style={{
                          padding: `${spacing['1']} ${spacing['3']}`,
                          backgroundColor: colors.primaryOrange, color: '#fff',
                          border: 'none', borderRadius: borderRadius.base,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          fontFamily: typography.fontFamily, cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: `opacity ${transitions.quick}`,
                        }}
                      >
                        View Recovery Plan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline: Gantt on desktop/tablet, card list on mobile */}
      <div style={{ marginTop: spacing['5'] }}>
        {error ? (
          /* Inline API error card */
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: borderRadius.lg,
            padding: spacing['5'],
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing['3'],
          }}>
            <AlertTriangle size={20} color={colors.statusCritical} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
                Unable to load schedule data
              </p>
              <p style={{ margin: `${spacing['1']} 0 ${spacing['3']}`, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
                {error}
              </p>
              <Btn variant="danger" size="sm" onClick={refetch}>
                Retry
              </Btn>
            </div>
          </div>
        ) : !loading && schedulePhases.length === 0 ? (
          <Card padding={spacing['5']}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: `${spacing['2xl']} ${spacing['5']}`,
              textAlign: 'center',
              gap: spacing['4'],
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: borderRadius.lg,
                backgroundColor: `${colors.primaryOrange}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Calendar size={28} color={colors.primaryOrange} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  Build your project schedule
                </p>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, maxWidth: '420px', lineHeight: typography.lineHeight.relaxed }}>
                  Import your schedule from Primavera P6 or Microsoft Project, or create phases manually to track every milestone from mobilization to closeout.
                </p>
              </div>
              <Btn variant="primary" size="md" onClick={() => addToast('info', 'Phase creation coming soon')}>
                Create First Phase
              </Btn>
            </div>
          </Card>
        ) : isMobile ? (
          <MobileScheduleView phases={schedulePhases} risks={risks} />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <SectionHeader title="Project Timeline" />
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Btn
                  variant={showBaseline ? 'primary' : 'secondary'}
                  size="sm"
                  icon={<GitBranch size={14} />}
                  onClick={() => setShowBaseline(!showBaseline)}
                >
                  {showBaseline ? 'Hide Baseline' : 'Show Baseline'}
                </Btn>
                <Btn
                  variant={whatIfMode ? 'primary' : 'secondary'}
                  size="sm"
                  icon={<Sparkles size={14} />}
                  onClick={() => setWhatIfMode(!whatIfMode)}
                >
                  {whatIfMode ? 'Exit What If Mode' : 'What If Mode'}
                </Btn>
              </div>
            </div>
            <div style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.lg,
              padding: spacing['5'],
              boxShadow: whatIfMode ? `0 0 0 2px ${colors.statusPending}40` : shadows.card,
              transition: `box-shadow ${transitions.quick}`,
            }}>
              {whatIfMode && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
                  backgroundColor: `${colors.statusPending}08`, borderRadius: borderRadius.md,
                  border: `1px solid ${colors.statusPending}20`,
                }}>
                  <Sparkles size={14} color={colors.statusPending} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>
                    What If Mode is active. Drag phase bars to simulate schedule changes and see cascade effects.
                  </span>
                </div>
              )}
              <ErrorBoundary
                fallback={(err) => (
                  <div style={{
                    padding: spacing['5'],
                    backgroundColor: '#FEF2F2',
                    borderRadius: borderRadius.md,
                    border: '1px solid #FECACA',
                  }}>
                    <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
                      Schedule could not be displayed
                    </p>
                    <details style={{ marginTop: spacing['2'] }}>
                      <summary style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, cursor: 'pointer' }}>
                        Technical details
                      </summary>
                      <pre style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {err.message}
                      </pre>
                    </details>
                    <button
                      onClick={() => window.location.reload()}
                      style={{
                        marginTop: spacing['3'],
                        padding: `${spacing['2']} ${spacing['4']}`,
                        backgroundColor: colors.statusCritical,
                        color: '#fff',
                        border: 'none',
                        borderRadius: borderRadius.base,
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        fontFamily: typography.fontFamily,
                        cursor: 'pointer',
                      }}
                    >
                      Reload
                    </button>
                  </div>
                )}
              >
                <GanttChart
                  phases={schedulePhases}
                  whatIfMode={whatIfMode}
                  isLoading={loading}
                  onImportSchedule={() => addToast('info', 'Schedule import coming soon')}
                  onAddActivity={() => addToast('info', 'Activity drawer coming soon')}
                  onPhaseClick={(phase) => addToast('info', `${phase.name}: ${phase.progress}% complete`)}
                  baselinePhases={schedulePhases}
                  showBaseline={showBaseline}
                  risks={risks}
                />
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
};
