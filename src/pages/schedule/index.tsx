import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/Primitives';
import { useRealtimeSchedulePhases, useScheduleRealtime } from '../../hooks/queries/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { spacing, colors, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useProjectContext } from '../../stores/projectContextStore';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { useCopilotStore } from '../../stores/copilotStore';
import { PredictiveAlertBanner } from '../../components/ai/PredictiveAlert';
import { getPredictiveAlertsForPage } from '../../data/aiAnnotations';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { predictScheduleRisks } from '../../lib/predictions';
import type { PredictedRisk, WeatherDay } from '../../lib/predictions';
import { analyzeScheduleHealth } from '../../lib/scheduleHealth';
import type { HealthReport } from '../../lib/scheduleHealth';
import { ScheduleHealthPanel } from '../../components/schedule/ScheduleHealthPanel';
import { BuildingOverview, buildingOf } from '../../components/schedule/BuildingOverview';
import { ScheduleCoordination } from './ScheduleCoordination';
import { ScheduleGantt } from './ScheduleGantt';
import { ScheduleKPIs } from './ScheduleKPIs';
import { ScheduleAIRiskPanel } from './ScheduleAIRiskPanel';
import { ScheduleLookahead } from './ScheduleLookahead';
import { ScheduleImportWizard } from '../../components/schedule/ScheduleImportWizard';
import { ScheduleErrorState, ScheduleLoadingState, ScheduleEmptyState } from './ScheduleStates';
import { ScheduleHeaderActions, ScheduleSkipLink, ScheduleErrorBanner } from './ScheduleShellParts';
import AddPhaseModal from '../../components/forms/AddPhaseModal';
import { ScheduleCommandPalette, KeyboardShortcutsOverlay } from './ScheduleCommandPalette';
import { toast } from 'sonner';

// Compact schedule-health chip that sits inline above the Gantt. Clicking it
// expands the full findings panel in-place, so the Gantt keeps the full
// viewport when the user isn't actively inspecting health.
const HealthPill: React.FC<{
  score: number;
  grade: string;
  critical: number;
  onExpand: () => void;
}> = ({ score, critical, onExpand }) => {
  // Tone bands. Imported P6/Procore schedules typically score low because
  // their CPM logic carries open ends and missing predecessors out of the
  // box. The pill leads with score + tone label only — no school-letter
  // grade — because a red "F" sits adjacent to "100% on track" KPIs in
  // healthy projects and reads as a UI bug rather than a finding.
  const tone = (() => {
    if (score >= 85) return { bg: '#E9F2EC', fg: '#1F4A34', rail: '#65A57D', label: 'Healthy' };
    if (score >= 60) return { bg: '#FCF2DE', fg: '#7A5C12', rail: '#D39B1A', label: 'Watch' };
    if (score >= 20 || critical > 0) return { bg: '#FCF2DE', fg: '#7A5C12', rail: '#D39B1A', label: 'Needs cleanup' };
    return                  { bg: '#F2F4F7', fg: '#3F4754', rail: '#9AA4B2', label: 'Not analyzed' };
  })();

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={`Schedule logic quality: ${score} of 100, ${tone.label}. Click for details.`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
        border: 'none', borderRadius: borderRadius.full,
        borderLeft: `3px solid ${tone.rail}`,
        backgroundColor: tone.bg, color: tone.fg,
        fontFamily: typography.fontFamily, cursor: 'pointer',
        fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
      }}
    >
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        Logic quality {score}/100
      </span>
      <span style={{ opacity: 0.6, fontWeight: typography.fontWeight.normal }}>·</span>
      <span>{tone.label}</span>
      {critical > 0 && (
        <span style={{
          padding: '1px 8px', borderRadius: borderRadius.full,
          backgroundColor: tone.rail, color: colors.white,
          fontSize: 10, fontWeight: typography.fontWeight.bold,
          letterSpacing: '0.04em', textTransform: 'uppercase' as const,
        }}>
          {critical} critical
        </span>
      )}
      <span style={{ opacity: 0.6, fontWeight: typography.fontWeight.normal, fontSize: typography.fontSize.caption }}>
        expand
      </span>
    </button>
  );
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
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

const INITIAL_FORECAST: WeatherDay[] = [];

type ViewTab = 'timeline' | 'lookahead' | 'list';

const SchedulePage: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isNarrow = useMediaQuery('(max-width: 480px)');
  const { activeProject } = useProjectContext();
  const queryClient = useQueryClient();
  const { phases: schedulePhases, metrics, loading, error, loadSchedule, updatePhase } = useScheduleStore();
  const { data: projectMetrics } = useProjectMetrics(activeProject?.id);
  const { createConversation, sendMessage, setActiveConversation, setPageContext } = useCopilotStore();
  const navigate = useNavigate();

  const refetch = useCallback(() => {
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id, loadSchedule]);

  useEffect(() => { setPageContext('schedule'); }, [setPageContext]);

  useEffect(() => {
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id, loadSchedule]);

  const [viewTab, setViewTab] = useState<ViewTab>('timeline');

  const handleTabChange = useCallback((tab: ViewTab) => {
    setViewTab(tab);
  }, []);

  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [scheduleAnnouncement, setScheduleAnnouncement] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleAddPhase = useCallback(async (data: Record<string, unknown>) => {
    const projectId = activeProject?.id;
    if (!projectId) {
      toast.error('No project selected');
      throw new Error('No project selected');
    }

    const insert: Record<string, unknown> = {
      project_id: projectId,
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
      status: data.status ?? 'upcoming',
      percent_complete: data.percent_complete ?? 0,
    };

    if (data.is_critical_path != null) insert.is_critical_path = data.is_critical_path;
    if (data.assigned_crew_id) insert.assigned_crew_id = data.assigned_crew_id;
    if (data.float_days != null) insert.float_days = data.float_days;

    if (Array.isArray(data.predecessor_ids) && data.predecessor_ids.length > 0) {
      insert.depends_on = data.predecessor_ids[0];
      insert.predecessor_ids = data.predecessor_ids;
    }

    const { error } = await supabase.from('schedule_phases').insert(insert);
    if (error) {
      toast.error(error.message || 'Failed to create phase');
      throw error;
    }
    toast.success('Phase created');
    queryClient.invalidateQueries({ queryKey: ['schedule', projectId] });
    queryClient.invalidateQueries({ queryKey: ['schedule_phases', projectId] });
    loadSchedule(projectId);
  }, [activeProject?.id, queryClient, loadSchedule]);

  const [mobileFilter, setMobileFilter] = useState<'all' | 'active' | 'delayed' | 'critical_path'>('all');
  const [healthCollapsed, setHealthCollapsed] = useState(true);
  const [activeBuilding, setActiveBuilding] = useState<string | null>(null);

  // Filtered + building-grouped view for the Gantt. Sorting by building
  // (then startDate, then name) keeps rows from the same building contiguous
  // in the row list — so an imported schedule with 7 "CARPET" entries shows
  // them clustered under their building instead of scattered.
  const visiblePhases = useMemo(() => {
    const base = activeBuilding
      ? schedulePhases.filter((p) => buildingOf(p) === activeBuilding)
      : schedulePhases;

    // Stable key per building: Sitework first (early site work), then
    // alphabetical building order, Clubhouse last among named areas.
    const bucketOrder = (b: string): number => {
      if (b === 'Sitework / General') return 0;
      if (b === 'Clubhouse') return 500;
      if (b.startsWith('Building ')) return 100 + b.charCodeAt(9);
      return 800;
    };

    return [...base].sort((a, b) => {
      const ba = buildingOf(a);
      const bb = buildingOf(b);
      if (ba !== bb) return bucketOrder(ba) - bucketOrder(bb) || ba.localeCompare(bb);
      const sa = a.startDate || '9999-12-31';
      const sb = b.startDate || '9999-12-31';
      if (sa !== sb) return sa.localeCompare(sb);
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [schedulePhases, activeBuilding]);

  // Smart initial zoom: wide schedules (>8 months) default to 'month'; very
  // long ones (>2 years) default to 'quarter'. Runs once per project load,
  // so the user's manual zoom is preserved afterward.
  const appliedInitialZoomRef = useRef<string | null>(null);
  useEffect(() => {
    if (schedulePhases.length === 0) return;
    if (appliedInitialZoomRef.current === activeProject?.id) return;
    const starts = schedulePhases.map((p) => p.startDate).filter(Boolean).map((d) => new Date(d).getTime());
    const ends = schedulePhases.map((p) => p.endDate).filter(Boolean).map((d) => new Date(d).getTime());
    if (starts.length === 0 || ends.length === 0) return;
    const spanDays = (Math.max(...ends) - Math.min(...starts)) / 86_400_000;
    if (spanDays > 730) setZoomLevel('quarter');
    else if (spanDays > 240) setZoomLevel('month');
    appliedInitialZoomRef.current = activeProject?.id ?? null;
  }, [schedulePhases, activeProject?.id]);

  // ── Schedule Health Engine ─────────────────────────────
  const healthReport: HealthReport = useMemo(
    () => analyzeScheduleHealth(schedulePhases),
    [schedulePhases]
  );

  const [dirtyPhaseIds] = useState<ReadonlySet<string>>(() => new Set());
  const { isSubscribed: phasesSubscribed } = useRealtimeSchedulePhases(
    activeProject?.id ?? '',
    dirtyPhaseIds
  );
  const { isSubscribed: activitiesSubscribed } = useScheduleRealtime(activeProject?.id ?? '');
  const liveActive = phasesSubscribed || activitiesSubscribed;

  // Predictive risk state
  const [risks, setRisks] = useState<PredictedRisk[]>([]);
  const [riskPanelOpen, setRiskPanelOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copilotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiEdgeText, setAiEdgeText] = useState<string | null>(null);
  const [aiEdgeLoading, setAiEdgeLoading] = useState(false);
  const [weatherRecords, setWeatherRecords] = useState<Array<{ date: string; conditions: string | null }>>([]);

  const hasBaselineData = useMemo(
    () => schedulePhases.some(p => p.baselineStartDate != null && p.baselineEndDate != null),
    [schedulePhases]
  );

  const activityMetrics = useMemo(() => {
    if (schedulePhases.length === 0) {
      return { scheduleVarianceDays: 0, criticalPathCount: 0, onTrackPct: 0, completePct: 0 };
    }

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

    const criticalPathCount = schedulePhases.filter(p => p.is_critical_path === true).length;
    const milestoneCount = schedulePhases.filter(p => p.start_date === p.end_date).length;
    const milestonesComplete = schedulePhases.filter(p => p.start_date === p.end_date && (p.status === 'completed' || (p.percent_complete ?? p.progress ?? 0) >= 100)).length;

    const nonCompleted = schedulePhases.filter(p => p.status !== 'completed' && (p.progress ?? 0) < 100);
    const onTrackCount = nonCompleted.length === 0
      ? schedulePhases.length
      : nonCompleted.filter(p => !p.baselineEndDate || new Date(p.endDate) <= new Date(p.baselineEndDate)).length;
    const onTrackPct = nonCompleted.length === 0
      ? 100
      : Math.round((onTrackCount / nonCompleted.length) * 100);

    const completePct = Math.round(
      schedulePhases.reduce((sum, p) => sum + (p.progress ?? 0), 0) / schedulePhases.length
    );

    return { scheduleVarianceDays, criticalPathCount, onTrackPct, completePct, milestoneCount, milestonesComplete };
  }, [schedulePhases]);

  const mappedForecast: WeatherDay[] = useMemo(
    () => weatherRecords.map((w) => ({
      date: w.date,
      conditions: w.conditions ?? 'Clear',
      precipitationChance: (w.conditions === 'Rain' || w.conditions === 'Thunderstorm' || w.conditions === 'Snow') ? 80 : 10,
      tempHigh: 75,
      tempLow: 55,
    })),
    [weatherRecords]
  );

  const runAnalysis = useCallback(() => {
    setAnalyzing(true);
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    analysisTimeoutRef.current = setTimeout(() => {
      analysisTimeoutRef.current = null;
      const results = predictScheduleRisks(schedulePhases, mappedForecast);
      setRisks(results);
      setLastAnalyzed(new Date());
      setMinutesAgo(0);
      setAnalyzing(false);
    }, 800);
  }, [schedulePhases, mappedForecast]);

  useEffect(() => {
    if (schedulePhases.length > 0 && lastAnalyzed === null) runAnalysis();
  }, [schedulePhases, lastAnalyzed, runAnalysis]);

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

  useEffect(() => {
    if (!loading && schedulePhases.length > 0) {
      const criticalCount = schedulePhases.filter(p => p.is_critical_path === true).length;
      setScheduleAnnouncement(`Schedule loaded with ${schedulePhases.length} ${schedulePhases.length === 1 ? 'activity' : 'activities'}, ${criticalCount} on critical path`);
    }
  }, [loading, schedulePhases]);

  useEffect(() => {
    const ZOOM_ORDER = ['day', 'week', 'month', 'quarter'] as const;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // ⌘K / Ctrl+K — open command palette (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        return;
      }

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
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      } else if (e.key === '1') {
        handleTabChange('timeline');
      } else if (e.key === '3') {
        handleTabChange('list');
      } else if (e.key === 'Escape') {
        setWhatIfMode(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleTabChange]);

  const overallHealthStatus = useMemo(() => {
    if (schedulePhases.length === 0) return { status: 'green', label: 'On Track' };
    const behind = schedulePhases.filter(p => {
      if (p.status === 'delayed') return true;
      if (p.start_date && p.end_date) {
        const totalDuration = new Date(p.end_date).getTime() - new Date(p.start_date).getTime();
        const elapsed = Date.now() - new Date(p.start_date).getTime();
        if (totalDuration > 0) {
          const expectedPct = Math.min(100, (elapsed / totalDuration) * 100);
          if ((p.percent_complete ?? p.progress ?? 0) < expectedPct * 0.8) return true;
        }
      }
      return false;
    });
    const pct = (behind.length / schedulePhases.length) * 100;
    if (pct > 20) return { status: 'red', label: `At Risk: ${behind.length} behind` };
    if (pct > 10) return { status: 'amber', label: `Monitoring: ${behind.length} behind` };
    return { status: 'green', label: 'On Track' };
  }, [schedulePhases]);

  const criticalPathAtRisk = useMemo(() => {
    return schedulePhases
      .filter(p => p.is_critical_path === true && (p.status === 'delayed' || (p.float_days ?? 99) < 3))
      .map(p => ({ id: p.id, name: p.name, floatDays: p.float_days ?? 0, status: p.status }));
  }, [schedulePhases]);

  const outdoorActivityCount = useMemo(() => {
    const outdoorKeywords = ['exterior', 'roofing', 'grading', 'concrete', 'foundation', 'site work', 'landscaping', 'paving'];
    return schedulePhases.filter(p => {
      const name = (p.name ?? '').toLowerCase();
      return outdoorKeywords.some(kw => name.includes(kw));
    }).length;
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
    if (copilotTimeoutRef.current) clearTimeout(copilotTimeoutRef.current);
    copilotTimeoutRef.current = setTimeout(() => {
      copilotTimeoutRef.current = null;
      sendMessage(prompt);
    }, 100);
  }, [createConversation, setActiveConversation, sendMessage, navigate]);

  const handlePhaseUpdate = useCallback(async (
    id: string,
    updates: { start_date?: string; end_date?: string; percent_complete?: number }
  ) => {
    const result = await updatePhase(id, updates);
    if (result.error) {
      toast.error(`Failed to save change: ${result.error}`);
    }
  }, [updatePhase]);

  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
      if (copilotTimeoutRef.current) clearTimeout(copilotTimeoutRef.current);
    };
  }, []);

  if (error && !loading) return <ScheduleErrorState error={error} />;
  if (loading) return <ScheduleLoadingState />;
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
  const viewMode: 'gantt' | 'list' = viewTab === 'list' ? 'list' : 'gantt';

  return (
    <PageContainer
      title="Schedule"
      subtitle={(() => {
        const d = metrics.daysBeforeSchedule
        const variance = d > 0 ? `${d} day${d === 1 ? '' : 's'} ahead`
                       : d < 0 ? `${-d} day${d === -1 ? '' : 's'} behind`
                       : 'On schedule'
        return `${variance} · ${metrics.milestonesHit}/${metrics.milestoneTotal} milestones`
      })()}
      actions={
        <ScheduleHeaderActions
          onImport={() => setShowImportModal(true)}
          onAddPhase={() => setShowAddPhaseModal(true)}
          liveActive={liveActive}
          projectName={activeProject?.name}
          phases={schedulePhases.map((p) => ({
            name: p.name ?? '',
            status: p.status ?? '',
            start_date: p.start_date ?? '',
            end_date: p.end_date ?? '',
            percent_complete: Number(p.percent_complete ?? 0),
            is_critical_path: Boolean(p.is_critical_path),
          }))}
        />
      }
      aria-label="Project Schedule"
      role="main"
    >
      {/* Visually hidden h1 for screen reader navigation */}
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
        Schedule
      </h1>

      {/* Global aria-live region */}
      <div role="status" aria-live="polite" aria-atomic="true"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        {scheduleAnnouncement}
      </div>

      <ScheduleSkipLink />
      <ScheduleErrorBanner error={error} refetch={refetch} />
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} onAction={() => setRiskPanelOpen(prev => !prev)} />
      ))}

      <style>{`
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.35); } }
      `}</style>

      {/* ── 1. Tab Navigation ── */}
      <nav
        role="tablist" aria-label="Schedule views"
        style={{
          display: 'flex', alignItems: 'center', gap: 2,
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.full, padding: 3,
          marginBottom: spacing['5'], width: 'fit-content',
        }}
      >
        {([
          { key: 'timeline' as const, label: 'Timeline' },
          { key: 'lookahead' as const, label: 'Look-Ahead' },
          { key: 'list' as const, label: 'List' },
        ]).map(tab => (
          <button
            key={tab.key} role="tab" aria-selected={viewTab === tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              padding: `${spacing['2']} ${spacing['5']}`,
              border: 'none', borderRadius: borderRadius.full,
              backgroundColor: viewTab === tab.key ? colors.white : 'transparent',
              color: viewTab === tab.key ? colors.textPrimary : colors.textTertiary,
              fontSize: typography.fontSize.sm,
              fontWeight: viewTab === tab.key ? typography.fontWeight.semibold : typography.fontWeight.medium,
              fontFamily: typography.fontFamily, cursor: 'pointer',
              boxShadow: viewTab === tab.key ? shadows.sm : 'none',
              transition: transitions.quick, whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── KPI Strip ── */}
      {schedulePhases.length > 0 && (
        <ScheduleKPIs
          activityMetrics={activityMetrics}
          metrics={metrics}
          projectMetrics={projectMetrics}
          isMobile={isMobile}
          isNarrow={isNarrow}
          compact
        />
      )}

      {/* Health panel */}
      {schedulePhases.length > 0 && !healthCollapsed && (
        <div style={{ marginBottom: spacing['4'] }}>
          <ScheduleHealthPanel
            report={healthReport}
            collapsed={false}
            onToggleCollapsed={() => setHealthCollapsed(true)}
            onClose={() => setHealthCollapsed(true)}
            onFindingClick={(taskIds) => {
              const names = taskIds
                .map(id => schedulePhases.find(p => p.id === id)?.name)
                .filter(Boolean)
                .slice(0, 3);
              setScheduleAnnouncement(
                `Health finding affects: ${names.join(', ')}${taskIds.length > 3 ? ` and ${taskIds.length - 3} more` : ''}`
              );
            }}
          />
        </div>
      )}
      {schedulePhases.length > 0 && healthCollapsed && (
        <HealthPill
          score={healthReport.score}
          grade={healthReport.grade}
          critical={healthReport.findings?.filter((f) => f.severity === 'critical').length ?? 0}
          onExpand={() => setHealthCollapsed(false)}
        />
      )}

      {/* ── Building overview ── */}
      {schedulePhases.length > 0 && (
        <BuildingOverview
          phases={schedulePhases}
          activeBuilding={activeBuilding}
          onSelectBuilding={setActiveBuilding}
        />
      )}

      {/* ── Lookahead tab ── */}
      {viewTab === 'lookahead' && (
        <ScheduleLookahead
          projectId={activeProject?.id}
          projectName={activeProject?.name}
          schedulePhases={schedulePhases}
        />
      )}

      {/* ── 3. Gantt / List (hero) ── */}
      {viewTab !== 'lookahead' && (
        <ScheduleGantt
          schedulePhases={visiblePhases}
          loading={loading}
          error={error}
          refetch={refetch}
          isMobile={isMobile}
          viewMode={viewMode}
          setViewMode={(m) => setViewTab(m === 'list' ? 'list' : 'timeline')}
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
          onPhaseUpdate={handlePhaseUpdate}
        />
      )}

      {/* ── Schedule Intelligence (structural findings + AI risk_predictions) ── */}
      {viewTab !== 'lookahead' && schedulePhases.length > 0 && (
        <div style={{ marginTop: spacing['4'] }}>
          <ScheduleAIRiskPanel
            schedulePhases={schedulePhases}
            projectId={activeProject?.id}
          />
        </div>
      )}

      {/* ── AI Risk Analysis ── */}
      {viewTab !== 'lookahead' && risks.length > 0 && (
        <div style={{ marginTop: spacing['4'] }}>
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
            recoveryExpanded={false}
            setRecoveryExpanded={() => {}}
          />
        </div>
      )}

      {/* Modals */}
      <ScheduleImportWizard
        isModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={activeProject?.id}
        projectName={activeProject?.name}
        onImportComplete={() => {
          setShowImportModal(false);
          if (activeProject?.id) {
            loadSchedule(activeProject.id);
            queryClient.invalidateQueries({ queryKey: ['schedule', activeProject.id] });
            queryClient.invalidateQueries({ queryKey: ['schedule_phases', activeProject.id] });
          }
        }}
      />
      <AddPhaseModal
        open={showAddPhaseModal}
        onClose={() => setShowAddPhaseModal(false)}
        onSubmit={handleAddPhase}
      />

      {/* Command palette (⌘K) */}
      <ScheduleCommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        phases={schedulePhases}
        onSelectPhase={(phase) => {
          setScheduleAnnouncement(`Selected: ${phase.name} — ${(phase.status ?? 'not started').replace(/_/g, ' ')}`);
        }}
        onAction={(action) => {
          if (action.startsWith('filter:')) {
            const filter = action.replace('filter:', '') as 'all' | 'active' | 'delayed' | 'critical_path';
            setMobileFilter(filter);
          } else if (action.startsWith('zoom:')) {
            const zoom = action.replace('zoom:', '') as 'day' | 'week' | 'month' | 'quarter';
            setZoomLevel(zoom);
          } else if (action === 'toggle:baseline') {
            setShowBaseline(prev => !prev);
          }
        }}
      />

      {/* Keyboard shortcuts overlay (?) */}
      <KeyboardShortcutsOverlay
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
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
