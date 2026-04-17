import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/Primitives';
import { useRealtimeSchedulePhases, useScheduleRealtime } from '../../hooks/queries/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { spacing } from '../../styles/theme';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useProjectContext } from '../../stores/projectContextStore';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { useCopilotStore } from '../../stores/copilotStore';
import { PredictiveAlertBanner } from '../../components/ai/PredictiveAlert';
import { getPredictiveAlertsForPage } from '../../data/aiAnnotations';
import { CoordinationEngine } from '../../components/schedule/CoordinationEngine';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { predictScheduleRisks } from '../../lib/predictions';
import type { PredictedRisk, WeatherDay } from '../../lib/predictions';
import { computeScheduleKPIs } from '../../lib/criticalPath';
import { ScheduleKPIs } from './ScheduleKPIs';
import { ScheduleCoordination } from './ScheduleCoordination';
import { ScheduleGantt } from './ScheduleGantt';
import { ScheduleImportModal } from './ScheduleUpload';
import { ScheduleErrorState, ScheduleLoadingState, ScheduleEmptyState } from './ScheduleStates';
import { ScheduleHeaderActions, ScheduleSkipLink, ScheduleErrorBanner } from './ScheduleShellParts';
import AddPhaseModal from '../../components/forms/AddPhaseModal';
import { toast } from 'sonner';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    // REACT-05 FIX: Track the deferred-sync setTimeout so it can't fire after unmount.
    const syncHandle = setTimeout(() => setMatches(mq.matches), 0);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => {
      clearTimeout(syncHandle);
      mq.removeEventListener('change', handler);
    };
  }, [query]);
  return matches;
}

// Weather forecast loaded from weather_records table or weather API
// Empty array is the default until project weather data is populated
const INITIAL_FORECAST: WeatherDay[] = [];

const SchedulePage: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isNarrow = useMediaQuery('(max-width: 480px)');
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
    // REACT-04 FIX: include loadSchedule in deps (removed prior eslint-disable).
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id, loadSchedule]);

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

  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [recoveryExpanded, setRecoveryExpanded] = useState(false);
  const [scheduleAnnouncement, setScheduleAnnouncement] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);

  const handleAddPhase = useCallback(async (data: { name: string; start_date: string; end_date: string }) => {
    const projectId = activeProject?.id;
    if (!projectId) {
      toast.error('No project selected');
      throw new Error('No project selected');
    }
    const { error } = await supabase.from('schedule_phases').insert({
      project_id: projectId,
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
      status: 'on_track',
      progress: 0,
    });
    if (error) {
      toast.error(error.message || 'Failed to create phase');
      throw error;
    }
    toast.success('Phase created');
    queryClient.invalidateQueries({ queryKey: ['schedule', projectId] });
    queryClient.invalidateQueries({ queryKey: ['schedule_phases', projectId] });
    loadSchedule(projectId);
  }, [activeProject?.id, queryClient, loadSchedule]);
  const [mobileFilter, setMobileFilter] = useState<'all' | 'in_progress' | 'delayed' | 'critical_path'>('all');

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
  // REACT-05 FIX: Track pending setTimeout handles so they can be cleared on unmount.
  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copilotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiEdgeText, setAiEdgeText] = useState<string | null>(null);
  const [aiEdgeLoading, setAiEdgeLoading] = useState(false);
  const [weatherRecords, setWeatherRecords] = useState<Array<{ date: string; conditions: string | null }>>([]);

  useMemo(() => computeScheduleKPIs(schedulePhases), [schedulePhases]);

  const hasBaselineData = useMemo(
    () => schedulePhases.some(p => p.baselineStartDate != null && p.baselineEndDate != null),
    [schedulePhases]
  );

  const activityMetrics = useMemo(() => {
    if (schedulePhases.length === 0) {
      return {
        scheduleVarianceDays: 0,
        criticalPathCount: 0,
        onTrackPct: 0,
        completePct: 0,
      };
    }

    // Schedule Variance: projected finish minus planned finish for the latest activity (positive = behind)
    const lastActivity = schedulePhases.reduce((latest, p) =>
      new Date(p.endDate) > new Date(latest.endDate) ? p : latest
    );
    let scheduleVarianceDays = 0;
    if (lastActivity.baselineEndDate) {
      const projected = new Date(lastActivity.endDate);
      const planned = new Date(lastActivity.baselineEndDate);
      projected.setHours(0, 0, 0, 0);
      planned.setHours(0, 0, 0, 0);
      scheduleVarianceDays = Math.round((projected.getTime() - planned.getTime()) / 86400000);
    }

    // Critical Path Items: activities where is_critical_path === true
    const criticalPathCount = schedulePhases.filter(p => p.is_critical_path === true).length;

    // On Track: of non-completed activities, percentage where end_date <= baseline_end (or no baseline = on track)
    const nonCompleted = schedulePhases.filter(p => p.status !== 'completed' && (p.progress ?? 0) < 100);
    const onTrackCount = nonCompleted.length === 0
      ? schedulePhases.length
      : nonCompleted.filter(p => !p.baselineEndDate || new Date(p.endDate) <= new Date(p.baselineEndDate)).length;
    const onTrackPct = nonCompleted.length === 0
      ? 100
      : Math.round((onTrackCount / nonCompleted.length) * 100);

    // Complete: average percent_complete across all activities
    const completePct = Math.round(
      schedulePhases.reduce((sum, p) => sum + (p.progress ?? 0), 0) / schedulePhases.length
    );

    return {
      scheduleVarianceDays,
      criticalPathCount,
      onTrackPct,
      completePct,
    };
  }, [schedulePhases]);

  const runAnalysis = useCallback(() => {
    setAnalyzing(true);
    // REACT-05 FIX: Cancel any previous pending analysis setTimeout; store the
    // handle so unmount can clear it.
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    analysisTimeoutRef.current = setTimeout(() => {
      analysisTimeoutRef.current = null;
      const results = predictScheduleRisks(schedulePhases, INITIAL_FORECAST);
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

  useEffect(() => {
    const projectId = activeProject?.id;
    if (!projectId) return;
    const today = new Date().toISOString().split('T')[0];
    const twoWeeksOut = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    supabase
      .from('weather_records')
      .select('date, conditions')
      .eq('project_id', projectId)
      .gte('date', today)
      .lte('date', twoWeeksOut)
      .then(({ data }) => {
        if (data && data.length > 0) setWeatherRecords(data);
      });
  }, [activeProject?.id]);

  // Announce schedule load completion to screen readers
  useEffect(() => {
    if (!loading && schedulePhases.length > 0) {
      const criticalCount = schedulePhases.filter(p => p.is_critical_path === true).length;
      setScheduleAnnouncement(`Schedule loaded with ${schedulePhases.length} ${schedulePhases.length === 1 ? 'activity' : 'activities'}, ${criticalCount} on critical path`);
    }
  }, [loading, schedulePhases]);

  // Global keyboard shortcuts: +/= zoom in, - zoom out, b toggle baseline, Escape exit what-if
  useEffect(() => {
    const ZOOM_ORDER = ['day', 'week', 'month', 'quarter'] as const;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel(prev => {
          const idx = ZOOM_ORDER.indexOf(prev);
          return idx > 0 ? ZOOM_ORDER[idx - 1] : prev;
        });
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomLevel(prev => {
          const idx = ZOOM_ORDER.indexOf(prev);
          return idx < ZOOM_ORDER.length - 1 ? ZOOM_ORDER[idx + 1] : prev;
        });
      } else if (e.key === 'b' || e.key === 'B') {
        setShowBaseline(prev => !prev);
      } else if (e.key === 'Escape') {
        setWhatIfMode(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const overallHealthStatus = useMemo(() => {
    if (schedulePhases.length === 0) return { status: 'green', label: 'On Track' };
    const behind = schedulePhases.filter(p => {
      if (p.status === 'delayed') return true;
      const planned = (p as unknown as Record<string, unknown>).planned_percent_complete as number | null | undefined;
      if (planned != null && (p.percent_complete ?? p.progress ?? 0) < planned) return true;
      return false;
    });
    const pct = (behind.length / schedulePhases.length) * 100;
    if (pct > 20) return { status: 'red', label: `At Risk: ${behind.length} ${behind.length === 1 ? 'activity' : 'activities'} behind` };
    if (pct > 10) return { status: 'amber', label: `Monitoring: ${behind.length} ${behind.length === 1 ? 'activity' : 'activities'} behind` };
    return { status: 'green', label: 'On Track' };
  }, [schedulePhases]);

  const criticalPathAtRisk = useMemo(() => {
    return schedulePhases
      .filter(p => p.is_critical_path === true && (p.status === 'delayed' || (p.float_days ?? (p as unknown as Record<string, unknown>).floatDays as number ?? 99) < 3))
      .map(p => ({
        id: p.id,
        name: p.name,
        floatDays: p.float_days ?? (p as unknown as Record<string, unknown>).floatDays as number ?? 0,
        status: p.status,
      }));
  }, [schedulePhases]);

  const outdoorActivityCount = useMemo(() => {
    return schedulePhases.filter(p => (p as unknown as Record<string, unknown>).outdoor_activity === true).length;
  }, [schedulePhases]);

  const runAiEdgeAnalysis = useCallback(async () => {
    const projectId = activeProject?.id;
    if (!projectId) return;
    setAiEdgeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-schedule-risk', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      const text = (data as Record<string, unknown>)?.analysis ?? (data as Record<string, unknown>)?.text ?? String(data ?? '');
      setAiEdgeText(String(text));
    } catch {
      setAiEdgeText('AI analysis will be available when the AI service is configured.');
    }
    setAiEdgeLoading(false);
  }, [activeProject?.id]);

  const openCopilotWithRisk = useCallback(async (risk: PredictedRisk) => {
    const prompt = `Generate a detailed recovery plan for the ${risk.title} phase. Risk assessment: ${risk.reason} Likelihood: ${risk.likelihoodPercent}%, potential impact: +${risk.impactDays} days. Suggested action: ${risk.suggestedAction}`;
    const convId = createConversation(`Recovery Plan: ${risk.title}`);
    setActiveConversation(convId);
    navigate('/copilot');
    // REACT-05 FIX: Track handle so it can be cleared on unmount.
    if (copilotTimeoutRef.current) clearTimeout(copilotTimeoutRef.current);
    copilotTimeoutRef.current = setTimeout(() => {
      copilotTimeoutRef.current = null;
      sendMessage(prompt);
    }, 100);
  }, [createConversation, setActiveConversation, sendMessage, navigate]);

  // REACT-05 FIX: Clear any outstanding setTimeouts when the page unmounts.
  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
      if (copilotTimeoutRef.current) clearTimeout(copilotTimeoutRef.current);
    };
  }, []);

  if (error && !loading) {
    return <ScheduleErrorState error={error} />;
  }

  if (loading) {
    return <ScheduleLoadingState />;
  }

  if (!loading && !error && schedulePhases.length === 0) {
    return (
      <ScheduleEmptyState
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        projectId={activeProject?.id}
      />
    );
  }

  const pageAlerts = getPredictiveAlertsForPage('schedule');

  return (
    <PageContainer
      title="Schedule"
      subtitle={`${metrics.daysBeforeSchedule} days ahead \u00B7 ${metrics.milestonesHit}/${metrics.milestoneTotal} milestones`}
      actions={<ScheduleHeaderActions onImport={() => setShowImportModal(true)} onAddPhase={() => setShowAddPhaseModal(true)} liveActive={liveActive} />}
      aria-label="Project Schedule"
      role="main"
    >
      {/* Visually hidden h1 for screen reader landmark navigation */}
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
        Schedule
      </h1>

      {/* Global aria-live region: announces filter changes and status updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
      >
        {scheduleAnnouncement}
      </div>

      <ScheduleSkipLink />
      <ScheduleErrorBanner error={error} refetch={refetch} />
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} onAction={() => setRecoveryExpanded(!recoveryExpanded)} />
      ))}

      <style>{`
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.35); } }
      `}</style>

      <ScheduleKPIs
        activityMetrics={activityMetrics}
        metrics={metrics}
        projectMetrics={projectMetrics}
        isMobile={isMobile}
        isNarrow={isNarrow}
      />

      <ScheduleCoordination
        risks={risks}
        riskPanelOpen={riskPanelOpen}
        setRiskPanelOpen={setRiskPanelOpen}
        analyzing={analyzing}
        lastAnalyzed={lastAnalyzed}
        minutesAgo={minutesAgo}
        runAnalysis={runAnalysis}
        overallHealthStatus={overallHealthStatus}
        criticalPathAtRisk={criticalPathAtRisk}
        outdoorActivityCount={outdoorActivityCount}
        aiEdgeText={aiEdgeText}
        aiEdgeLoading={aiEdgeLoading}
        runAiEdgeAnalysis={runAiEdgeAnalysis}
        openCopilotWithRisk={openCopilotWithRisk}
        recoveryExpanded={recoveryExpanded}
        setRecoveryExpanded={setRecoveryExpanded}
      />

      {/* ── Coordination Engine — Trade Conflict Detection ──── */}
      <CoordinationEngine />

      {/* Timeline: Gantt on desktop/tablet, card list on mobile */}
      <div style={{ marginTop: spacing['5'] }}>
        <ScheduleGantt
          schedulePhases={schedulePhases}
          loading={loading}
          error={error}
          refetch={refetch}
          isMobile={isMobile}
          viewMode={viewMode}
          setViewMode={setViewMode}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          whatIfMode={whatIfMode}
          setWhatIfMode={setWhatIfMode}
          showBaseline={showBaseline}
          setShowBaseline={setShowBaseline}
          hasBaselineData={hasBaselineData}
          mobileFilter={mobileFilter}
          setMobileFilter={setMobileFilter}
          weatherRecords={weatherRecords}
          initialForecast={INITIAL_FORECAST}
          risks={risks}
          setShowImportModal={setShowImportModal}
          setScheduleAnnouncement={setScheduleAnnouncement}
        />
      </div>
      <ScheduleImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => { setShowImportModal(false); }}
        projectId={activeProject?.id}
      />
      <AddPhaseModal
        open={showAddPhaseModal}
        onClose={() => setShowAddPhaseModal(false)}
        onSubmit={handleAddPhase}
      />
    </PageContainer>
  );
};

export const Schedule: React.FC = () => (
  <ErrorBoundary message="Failed to load schedule. Retry">
    <SchedulePage />
  </ErrorBoundary>
);

export default Schedule;
