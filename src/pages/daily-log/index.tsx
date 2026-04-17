import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCopilotStore } from '../../stores/copilotStore';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Users, Clock, ShieldCheck, Send, BarChart3, Zap, CalendarDays, Calendar, Lock, AlertTriangle, BookOpen, RefreshCw, FileEdit } from 'lucide-react';
import { PageContainer, Card, Btn, useToast } from '../../components/Primitives';
import CreateDailyLogModal from '../../components/forms/CreateDailyLogModal';
import { colors, spacing, typography, borderRadius, transitions, tradeColors } from '../../styles/theme';
import { toast } from 'sonner';
import { CalendarNav } from '../../components/dailylog/CalendarNav';
import { AutoDailyLog } from '../../components/dailylog/AutoDailyLog';
import { DailyLogCapture } from '../../components/dailylog/DailyLogCapture';
import { QuickEntry } from '../../components/dailylog/QuickEntry';
import type { QuickEntryData } from '../../components/dailylog/QuickEntry';
import type { CrewHoursEntry as CrewHoursEntryType } from '../../components/dailylog/CrewHoursSummary';
import type { DailyLogPhoto } from '../../components/dailylog/PhotoGrid';
import { useProjectId } from '../../hooks/useProjectId';
import { useDailyLogs, useDailyLogEntries } from '../../hooks/queries';
import { useUpdateDailyLog, useCreateDailyLog, useSubmitDailyLog, useApproveDailyLog, useRejectDailyLog } from '../../hooks/mutations';
import { fetchWeather, formatWeatherSummary } from '../../lib/weather';
import { supabase } from '../../lib/supabase';
import { syncManager } from '../../lib/syncManager';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { WifiOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { WeatherData } from '../../lib/weather';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { usePermissions } from '../../hooks/usePermissions';
import type { DailyLogState } from '../../machines/dailyLogMachine';
import type { ExtendedDailyLog, ManpowerRow } from './types';
import { DailyLogForm } from './DailyLogForm';
import { DailyLogPDFExport } from './DailyLogPDFExport';
import { createDailyLogSchema, crewHoursEntrySchema } from '../../schemas/dailyLog';

const DailyLogPage: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('daily-log'); }, [setPageContext]);
  const { data: dailyLogData, isPending: loading, error: logError, refetch } = useDailyLogs(projectId);
  const updateDailyLog = useUpdateDailyLog();
  const createDailyLog = useCreateDailyLog();
  const submitDailyLog = useSubmitDailyLog();
  const approveDailyLog = useApproveDailyLog();
  const rejectDailyLog = useRejectDailyLog();

  const dailyLogHistory: ExtendedDailyLog[] = (dailyLogData?.data ?? []) as ExtendedDailyLog[];
  const todayStr = new Date().toISOString().split('T')[0];
  const hasTodayLog = dailyLogHistory.some((l) => l.log_date?.split('T')[0] === todayStr);

  const [showComparison, setShowComparison] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<'yesterday' | 'lastweek' | null>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [activeView, setActiveView] = useState<'auto' | 'calendar' | 'log'>('auto');
  const [showCaptureBar, setShowCaptureBar] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherIsAuto, setWeatherIsAuto] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReturnToDraftModal, setShowReturnToDraftModal] = useState(false);
  const [returnToDraftNote, setReturnToDraftNote] = useState('');
  const [showAddendumForm, setShowAddendumForm] = useState(false);
  const [addendumText, setAddendumText] = useState('');
  const [addendumSubmitting, setAddendumSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [issuesDelays, setIssuesDelays] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [noIncidentsToday, setNoIncidentsToday] = useState(true);
  const [noVisitorsToday, setNoVisitorsToday] = useState(true);
  const [workSummary, setWorkSummary] = useState('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryGenerated, setAiSummaryGenerated] = useState(false);

  const { hasPermission } = usePermissions();
  const isOnline = useIsOnline();

  const manpowerSeeded = React.useRef(false);
  const [manpowerRows, setManpowerRows] = useState<ManpowerRow[]>([]);

  // Auto-fetch weather on mount
  useEffect(() => {
    const loadWeather = async () => {
      if (projectId) {
        try {
          const todayDate = new Date().toISOString().split('T')[0];
          const { data: dbWeather } = await supabase
            .from('weather_records')
            .select('conditions, temperature_high, temperature_low, wind_speed, precipitation, humidity')
            .eq('project_id', projectId)
            .eq('date', todayDate)
            .maybeSingle();
          if (dbWeather) {
            setWeather({
              temp_high: dbWeather.temperature_high ?? 75,
              temp_low: dbWeather.temperature_low ?? 55,
              conditions: dbWeather.conditions ?? 'Clear',
              precipitation: dbWeather.precipitation ?? '0mm',
              wind_speed: dbWeather.wind_speed ?? '0 mph',
              icon: '☀️',
              humidity: dbWeather.humidity ?? 50,
              fetched_at: new Date().toISOString(),
              source: 'default',
            });
            setWeatherIsAuto(true);
            return;
          }
        } catch { /* fall through to API */ }
      }
      const apiWeather = await fetchWeather();
      setWeather(apiWeather);
      setWeatherIsAuto(false);
    };
    loadWeather();
  }, [projectId]);

  useEffect(() => {
    if (dailyLogHistory.length > 0 && !workSummary) {
      const summary = dailyLogHistory[0].summary ?? '';
      if (summary) setWorkSummary(summary);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyLogHistory]);

  useEffect(() => {
    if (manpowerSeeded.current || dailyLogHistory.length === 0) return;
    const todayLog = dailyLogHistory[0];
    const crewEntries = todayLog.crew_entries ?? [];
    if (crewEntries.length > 0) {
      setManpowerRows(crewEntries.map((c) => ({
        id: crypto.randomUUID(),
        trade: c.trade ?? '',
        company: c.company ?? '',
        headcount: c.headcount ?? 0,
        hours: c.hours ?? 0,
      })));
      manpowerSeeded.current = true;
    }
  }, [dailyLogHistory]);

  const todayLogId = dailyLogHistory.length > 0 ? dailyLogHistory[0]?.id : undefined;
  const { data: logEntries = [] } = useDailyLogEntries(todayLogId);

  const tradeColorMap: Record<string, string> = useMemo(() => ({
    concrete: colors.statusInfo,
    electrical: colors.statusPending,
    mechanical: colors.statusActive,
    steel: colors.primaryOrange,
    plumbing: colors.statusReview,
    carpentry: tradeColors.carpentry,
  }), []);

  const crewHours: CrewHoursEntryType[] = useMemo(() => {
    const grouped = new Map<string, { workers: number; hours: number }>();
    for (const entry of logEntries) {
      if (!entry.trade) continue;
      const existing = grouped.get(entry.trade) ?? { workers: 0, hours: 0 };
      grouped.set(entry.trade, {
        workers: existing.workers + (entry.headcount ?? 0),
        hours: existing.hours + (entry.hours ?? 0),
      });
    }
    return Array.from(grouped.entries()).map(([trade, data]) => ({
      trade,
      workers: data.workers,
      hours: data.hours,
      plannedHours: data.hours,
      color: tradeColorMap[trade.toLowerCase()] ?? colors.textTertiary,
    }));
  }, [logEntries, tradeColorMap]);

  const photos: DailyLogPhoto[] = useMemo(() => {
    const result: DailyLogPhoto[] = [];
    for (const entry of logEntries) {
      const entryPhotos = Array.isArray(entry.photos) ? entry.photos : [];
      for (const photo of entryPhotos) {
        const p = photo as Record<string, unknown>;
        result.push({
          id: (p.id as string) ?? `${entry.id}-${result.length}`,
          url: (p.url as string) ?? '',
          caption: (p.caption as string) ?? entry.description ?? '',
          category: (p.category as DailyLogPhoto['category']) ?? 'progress',
          timestamp: (p.timestamp as string) ?? entry.created_at ?? new Date().toISOString(),
          latitude: (p.latitude as number) ?? null,
          longitude: (p.longitude as number) ?? null,
        });
      }
    }
    return result;
  }, [logEntries]);

  const approvedDates = useMemo(() => new Set(
    dailyLogHistory.filter((l) => l.status === 'approved' || (l.approved && l.status !== 'submitted')).map((l) => l.log_date?.split('T')[0])
  ), [dailyLogHistory]);
  const submittedDates = useMemo(() => new Set(
    dailyLogHistory.filter((l) => l.status === 'submitted' && !l.approved).map((l) => l.log_date?.split('T')[0])
  ), [dailyLogHistory]);
  const draftDates = useMemo(() => new Set(
    dailyLogHistory.filter((l) => l.status === 'draft' || (!l.status && !l.approved)).map((l) => l.log_date?.split('T')[0])
  ), [dailyLogHistory]);

  const aggMetrics = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfWeekNow = now.getDay();
    const diffToMonday = dayOfWeekNow === 0 ? 6 : dayOfWeekNow - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const totalLogs = dailyLogHistory.length;
    const thisWeekLogs = dailyLogHistory.filter((l) => {
      const d = new Date(l.log_date + 'T12:00:00');
      return d >= startOfWeek;
    }).length;

    const thisMonthLogs = dailyLogHistory.filter((l) => {
      const d = new Date(l.log_date + 'T12:00:00');
      return d >= startOfMonth;
    });
    const crewTotal = thisMonthLogs.reduce((s, l) => s + (l.workers_onsite ?? 0), 0);
    const avgCrewSize = thisMonthLogs.length > 0 ? Math.round(crewTotal / thisMonthLogs.length) : 0;

    let daysWithoutIncident = 0;
    for (const log of [...dailyLogHistory].sort((a, b) => b.log_date.localeCompare(a.log_date))) {
      if ((log.incidents ?? 0) > 0) break;
      daysWithoutIncident++;
    }

    const todayWorkers = dailyLogHistory[0]?.workers_onsite ?? 0;

    return { totalLogs, thisWeekLogs, avgCrewSize, daysWithoutIncident, todayWorkers };
  }, [dailyLogHistory]);

  const today = dailyLogHistory[0];
  const yesterday = dailyLogHistory[1];
  const lastWeek = dailyLogHistory[4];

  const handleQuickSave = useCallback(() => {
    toast.success('Draft saved');
  }, []);

  const handleQuickSubmit = useCallback(async (data: QuickEntryData) => {
    try {
      // Validate crew hours with Zod (non-negative, max 24/day)
      for (const entry of data.crew_entries) {
        const parsed = crewHoursEntrySchema.safeParse({
          crew_name: entry.company ?? entry.trade ?? 'Crew',
          trade: entry.trade ?? '',
          workers: entry.headcount,
          hours: entry.hours,
        });
        if (!parsed.success) {
          const msg = parsed.error.issues[0]?.message ?? 'Invalid crew hours entry';
          addToast('error', msg);
          return;
        }
      }
      const parsedLog = createDailyLogSchema.safeParse({
        date: selectedDate,
        weather_summary: data.weather ? formatWeatherSummary(data.weather) : '',
        work_summary: data.workPerformed ?? '',
      });
      if (!parsedLog.success) {
        addToast('error', parsedLog.error.issues[0]?.message ?? 'Invalid daily log');
        return;
      }
      const totalWorkers = data.crew_entries.reduce((s, w) => s + w.headcount, 0);
      const totalHours = data.crew_entries.reduce((s, w) => s + w.hours, 0);
      await createDailyLog.mutateAsync({
        projectId: projectId!,
        data: {
          project_id: projectId!,
          log_date: selectedDate,
          workers_onsite: totalWorkers,
          total_hours: totalHours,
          incidents: data.incident_details.length,
          weather: data.weather ? formatWeatherSummary(data.weather) : null,
          summary: data.workPerformed,
          status: 'submitted',
          is_submitted: true,
          submitted_at: new Date().toISOString(),
        },
      });
      setShowQuickEntry(false);
      addToast('success', 'Daily log submitted and locked');
    } catch {
      addToast('error', 'Failed to submit daily log');
    }
  }, [createDailyLog, projectId, selectedDate, addToast]);

  const handleOpenQuickEntry = useCallback(() => {
    if (dailyLogHistory.length > 0) {
      const log = dailyLogHistory[0];
      const status = log.status;
      const locked = log.is_submitted === true || status === 'approved';
      if (locked) { setShowAmendmentModal(true); return; }
    }
    setShowQuickEntry(true);
  }, [dailyLogHistory]);

  const handleCalendarSelect = (date: string) => {
    setSelectedDate(date);
    const hasLog = dailyLogHistory.some((l) => l.log_date?.split('T')[0] === date);
    if (!hasLog) setShowCreateModal(true);
    setActiveView('log');
  };

  const handleSameAsYesterday = useCallback(async () => {
    if (!yesterday) return;
    const yesterdayCrewEntries = yesterday.crew_entries ?? [];
    const yesterdayEquipment = yesterday.equipment_entries ?? [];
    const seededRows: ManpowerRow[] = yesterdayCrewEntries.map((c) => ({
      id: crypto.randomUUID(),
      trade: c.trade ?? '',
      company: c.company ?? '',
      headcount: c.headcount ?? 0,
      hours: c.hours ?? 0,
    }));
    if (seededRows.length === 0 && yesterdayEquipment.length === 0) {
      addToast('info', 'No crew or equipment found on yesterday\'s log');
      return;
    }
    setManpowerRows(seededRows);
    try {
      if (dailyLogHistory[0]) {
        await updateDailyLog.mutateAsync({
          id: dailyLogHistory[0].id,
          updates: {
            crew_entries: yesterdayCrewEntries,
            equipment_entries: yesterdayEquipment,
            workers_onsite: yesterdayCrewEntries.reduce((s, c) => s + (c.headcount ?? 0), 0),
          },
          projectId: projectId!,
        });
      }
      addToast('success', 'Crew and equipment copied from yesterday');
    } catch {
      addToast('error', 'Failed to copy from yesterday');
    }
  }, [yesterday, dailyLogHistory, updateDailyLog, projectId, addToast]);

  const handleWeatherUpdate = async (updated: WeatherData) => {
    setWeather(updated);
    if (dailyLogHistory[0]) {
      await updateDailyLog.mutateAsync({
        id: dailyLogHistory[0].id,
        updates: {
          weather: formatWeatherSummary(updated),
          wind_speed: updated.wind_speed,
          precipitation: updated.precipitation,
        },
        projectId: projectId!,
      });
      addToast('success', 'Weather updated');
    }
  };

  const handlePhotoCapture = () => {
    addToast('info', 'Camera capture would open on mobile device');
  };

  const handleAiSummary = async () => {
    const log = dailyLogHistory[0];
    setAiSummaryLoading(true);
    setAiSummaryGenerated(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-daily-summary', {
        body: {
          projectId,
          logDate: log.log_date,
          field_notes: workSummary,
          temperature_high: log.temperature_high ?? null,
          temperature_low: log.temperature_low ?? null,
          crew_count: log.workers_onsite ?? 0,
        },
      });
      if (fnError) {
        const errObj = fnError as Record<string, unknown>;
        const errMsg = (errObj?.message as string) ?? '';
        const status = (errObj?.status as string | number) ?? (errObj?.code as string | number);
        if (status === 404 || errMsg.includes('404') || errMsg.toLowerCase().includes('not found')) {
          toast.error('AI summary is not available yet');
        } else {
          toast.error('Could not generate summary. Try again.');
        }
        return;
      }
      const result = data as Record<string, unknown> | null;
      const generated = (result?.summary as string) ?? (result?.text as string) ?? '';
      if (generated) {
        setWorkSummary(generated);
        setAiSummaryGenerated(true);
        toast.success('AI summary generated');
      } else {
        toast.error('Could not generate summary. Try again.');
      }
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      const errMsg = (errObj?.message as string) ?? '';
      const status = (errObj?.status as string | number) ?? (errObj?.code as string | number);
      if (status === 404 || errMsg.includes('404') || errMsg.toLowerCase().includes('not found')) {
        toast.error('AI summary is not available yet');
      } else {
        toast.error('Could not generate summary. Try again.');
      }
    } finally {
      setAiSummaryLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(loading);
    setError(logError ? ((logError as Error).message || 'Failed to load daily log data') : null);
  }, [loading, logError]);

  useEffect(() => {
    if (logError) {
      addToast('error', (logError as Error).message || 'Failed to load daily log data');
    }
  }, [logError, addToast]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const authUserId = useAuthStore((s) => s.user?.id);

  if (isLoading) {
    return (
      <PageContainer title="Daily Log" subtitle="Loading...">
        <style>{`@keyframes pulse-dl { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }`}</style>
        <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: colors.surfaceFlat, borderRadius: '12px', border: `1px solid ${colors.borderSubtle}`, animation: 'pulse-dl 1.5s ease-in-out infinite', height: 96 }} aria-hidden="true" />
            ))}
          </div>
          <div style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: 48, margin: `${spacing['2']} ${spacing['5']}`, backgroundColor: colors.borderLight, borderRadius: 8, animation: 'pulse-dl 1.5s ease-in-out infinite', borderBottom: i < 4 ? `1px solid ${colors.borderSubtle}` : 'none' }} aria-hidden="true" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (dailyLogHistory.length === 0) {
    return (
      <PageContainer
        title="Daily Log"
        subtitle="No entries"
        actions={<PermissionGate permission="daily_log.create"><Btn onClick={() => setShowCreateModal(true)}>New Entry</Btn></PermissionGate>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
          {[
            { icon: <Users size={24} color={colors.primaryOrange} />, label: "Today's Workers", value: '0' },
            { icon: <Clock size={24} color={colors.statusActive} />, label: 'Hours This Week', value: '0' },
            { icon: <ShieldCheck size={24} color={colors.statusActive} />, label: 'Open Incidents (30d)', value: '0' },
            { icon: <CalendarDays size={24} color={colors.statusInfo} />, label: 'Logs This Month', value: '0' },
          ].map((m) => (
            <Card key={m.label} padding={spacing['5']}>
              <div style={{ marginBottom: spacing['3'] }}>{m.icon}</div>
              <p style={{ fontSize: '12px', color: colors.textTertiary, margin: 0, marginBottom: spacing['2'], fontWeight: typography.fontWeight.medium }}>{m.label}</p>
              <p style={{ fontSize: '28px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, lineHeight: 1 }}>{m.value}</p>
              <p style={{ fontSize: '11px', color: colors.textTertiary, margin: 0, marginTop: spacing['2'] }}>vs prior period</p>
            </Card>
          ))}
        </div>

        <div aria-live="polite">
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.statusCriticalSubtle, border: `1px solid ${colors.statusCritical}40`, borderRadius: borderRadius.lg, marginBottom: spacing['4'] }}>
              <AlertTriangle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, margin: 0, flex: 1 }}>{error}</p>
              <Btn variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetch()}>Retry</Btn>
            </div>
          )}

          {!error && (
            <Card padding={spacing['10']}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: spacing['4'] }}>
                <Calendar size={48} color="#9CA3AF" />
                <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>No daily logs yet</p>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0, maxWidth: '440px' }}>
                  The daily log is your project official record. Start documenting site conditions today.
                </p>
                <PermissionGate permission="daily_log.create">
                  <button
                    onClick={() => { setSelectedDate(new Date().toISOString().split('T')[0]); setShowCreateModal(true); }}
                    style={{ backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: '8px', padding: `${spacing['3']} ${spacing['5']}`, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, cursor: 'pointer', minHeight: '56px' }}
                  >
                    Start Today Log
                  </button>
                </PermissionGate>
              </div>
            </Card>
          )}
        </div>

        {showCreateModal && (
          <CreateDailyLogModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            projectId={projectId ?? undefined}
            onSubmit={async (data) => {
              const created = await createDailyLog.mutateAsync({
                projectId: projectId!,
                data: {
                  project_id: projectId!,
                  log_date: data.date,
                  workers_onsite: data.crew_count ? Number(data.crew_count) : 0,
                  total_hours: 0,
                  incidents: data.has_incident ? 1 : 0,
                  weather: data.weather_condition,
                  summary: data.activities,
                  status: 'draft',
                },
              });
              setShowCreateModal(false);
              addToast('success', 'Daily log created');
              return { id: created?.data?.id as string | undefined };
            }}
          />
        )}
      </PageContainer>
    );
  }

  const previousDays = dailyLogHistory.slice(1);
  const filteredPreviousDays = historySearch.trim()
    ? previousDays.filter((l) => {
        const q = historySearch.toLowerCase();
        return (
          (l.log_date ?? '').includes(q) ||
          (l.summary ?? '').toLowerCase().includes(q) ||
          (l.ai_summary ?? '').toLowerCase().includes(q)
        );
      })
    : previousDays;

  const todayDate = new Date(today.log_date + 'T12:00:00');
  const todayFormatted = todayDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const logStatus: DailyLogState = (today.status as DailyLogState) || (today.approved ? 'approved' : 'draft');
  const isLocked = today.is_submitted === true || logStatus === 'approved';
  const isApproved = logStatus === 'approved';
  const isSubmittedOnly = logStatus === 'submitted';
  const isRejected = logStatus === 'rejected';
  const submittedAt: string | null = today.submitted_at ?? null;
  const approvedAt: string | null = today.approved_at ?? null;
  const rejectionComments = today.rejection_comments;

  const canReturnToDraft = isSubmittedOnly && hasPermission('daily_log.reject');

  const handleReturnToDraft = async () => {
    if (!returnToDraftNote.trim()) { addToast('error', 'Please provide a note explaining the reason.'); return; }
    try {
      await updateDailyLog.mutateAsync({
        id: today.id,
        updates: { status: 'draft', is_submitted: false, rejection_comments: returnToDraftNote },
        projectId: projectId!,
      });
      setShowReturnToDraftModal(false);
      setReturnToDraftNote('');
      addToast('success', 'Daily log returned to draft');
    } catch {
      addToast('error', 'Failed to return log to draft');
    }
  };

  const handleAddendumSubmit = async () => {
    if (!addendumText.trim()) { addToast('error', 'Addendum cannot be empty.'); return; }
    setAddendumSubmitting(true);
    try {
      await createDailyLog.mutateAsync({
        projectId: projectId!,
        data: {
          project_id: projectId!,
          log_date: today.log_date,
          workers_onsite: 0,
          total_hours: 0,
          incidents: 0,
          summary: addendumText,
          status: 'submitted',
          is_submitted: true,
          submitted_at: new Date().toISOString(),
          addendum_of: today.id,
        } as Parameters<typeof createDailyLog.mutateAsync>[0]['data'],
      });
      setShowAddendumForm(false);
      setAddendumText('');
      addToast('success', 'Addendum saved and linked to original log');
    } catch {
      addToast('error', 'Failed to save addendum');
    } finally {
      setAddendumSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!navigator.onLine) {
      try {
        await syncManager.queueOfflineMutation('daily_logs', 'update', {
          id: today.id,
          status: 'submitted',
          is_submitted: true,
          submitted_at: new Date().toISOString(),
        });
        toast.info('Saved offline \u2014 will sync when connected');
      } catch {
        addToast('error', 'Failed to queue daily log submission');
      }
      return;
    }
    try {
      await submitDailyLog.mutateAsync({ id: today.id, projectId: projectId! });
      addToast('success', 'Daily log submitted for approval');
    } catch {
      addToast('error', 'Failed to submit daily log');
    }
  };

  const handleApprove = async () => {
    if (!authUserId) { addToast('error', 'You must be signed in to approve'); return; }
    try {
      await approveDailyLog.mutateAsync({ id: today.id, userId: authUserId, projectId: projectId! });
      addToast('success', 'Daily log approved');
    } catch {
      addToast('error', 'Failed to approve daily log');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { addToast('error', 'Please provide a reason for rejection'); return; }
    if (!authUserId) { addToast('error', 'You must be signed in to reject'); return; }
    try {
      await rejectDailyLog.mutateAsync({ id: today.id, comments: rejectReason, userId: authUserId, projectId: projectId! });
      setShowRejectModal(false);
      setRejectReason('');
      addToast('success', 'Daily log returned for revision');
    } catch {
      addToast('error', 'Failed to reject daily log');
    }
  };

  return (
    <PageContainer title="Daily Log" subtitle={todayFormatted} actions={
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <DailyLogPDFExport today={today} weather={weather} logStatus={logStatus} />
        <Btn variant="secondary" size="sm" icon={<Zap size={14} />} onClick={handleOpenQuickEntry}>Quick Entry</Btn>
        <div style={{ position: 'relative' }}>
          <Btn variant="secondary" size="sm" icon={<BarChart3 size={14} />} onClick={() => setCompareDropdownOpen(!compareDropdownOpen)}>
            Compare Days
          </Btn>
          {compareDropdownOpen && (
            <>
              <div onClick={() => setCompareDropdownOpen(false)} role="presentation" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: spacing['1'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 999, overflow: 'hidden', minWidth: '180px' }}>
                {[
                  { label: 'vs Yesterday', mode: 'yesterday' as const },
                  { label: 'vs Same Day Last Week', mode: 'lastweek' as const },
                ].map(opt => (
                  <button key={opt.mode} onClick={() => { setCompareMode(opt.mode); setShowComparison(true); setCompareDropdownOpen(false); }} style={{ width: '100%', padding: `${spacing['3']} ${spacing['4']}`, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, textAlign: 'left', minHeight: '56px' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {logStatus === 'draft' && !isLocked && (
          <PermissionGate permission="daily_log.submit"><Btn size="sm" icon={<Lock size={14} />} onClick={handleSubmit}>Submit and Lock</Btn></PermissionGate>
        )}
        {isSubmittedOnly && (
          <>
            <PermissionGate permission="daily_log.approve"><Btn size="sm" variant="primary" icon={<ShieldCheck size={14} />} onClick={() => setShowSignature(true)}>Approve</Btn></PermissionGate>
            <span style={{ color: colors.statusCritical }}><PermissionGate permission="daily_log.reject"><Btn size="sm" variant="ghost" onClick={() => setShowRejectModal(true)}>Reject</Btn></PermissionGate></span>
            {canReturnToDraft && (
              <Btn size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={() => setShowReturnToDraftModal(true)}>Return to Draft</Btn>
            )}
          </>
        )}
        {isApproved && (
          <PermissionGate permission="daily_log.create">
            <Btn size="sm" variant="secondary" icon={<FileEdit size={14} />} onClick={() => setShowAddendumForm(true)}>Add Addendum</Btn>
          </PermissionGate>
        )}
        {isRejected && (
          <PermissionGate permission="daily_log.submit"><Btn size="sm" icon={<Send size={14} />} onClick={handleSubmit}>Resubmit</Btn></PermissionGate>
        )}
      </div>
    }>
      <style>{`@keyframes pulse-dl { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }`}</style>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['4']}`,
            backgroundColor: colors.statusPendingSubtle,
            border: `1px solid ${colors.statusPending}`,
            borderRadius: borderRadius.md,
            marginBottom: spacing['4'],
          }}
        >
          <WifiOff size={14} color={colors.statusPending} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>
            You're offline — changes will sync when connected.
          </span>
        </div>
      )}
      {logError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.statusCriticalSubtle, border: `1px solid ${colors.statusCritical}40`, borderRadius: borderRadius.lg, marginBottom: spacing['4'] }}>
          <AlertTriangle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, margin: 0, flex: 1 }}>
            {(logError as Error).message || 'Failed to load daily log data'}
          </p>
          <Btn variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetch()}>Retry</Btn>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['5'] }}>
        {[
          { icon: <CalendarDays size={22} color={colors.primaryOrange} />, label: 'Total Logs', value: aggMetrics.totalLogs, sub: 'all time' },
          { icon: <BookOpen size={22} color={colors.statusInfo} />, label: 'This Week', value: aggMetrics.thisWeekLogs, sub: 'logs this week' },
          { icon: <Users size={22} color={colors.statusInfo} />, label: 'Avg Crew Size', value: aggMetrics.avgCrewSize, sub: 'this month' },
          { icon: <ShieldCheck size={22} color={aggMetrics.daysWithoutIncident > 0 ? colors.statusActive : colors.statusCritical} />, label: 'Days Without Incident', value: aggMetrics.daysWithoutIncident, sub: 'consecutive days' },
        ].map((m) => (
          <Card key={m.label} padding={spacing['5']}>
            <div style={{ marginBottom: spacing['3'] }}>{m.icon}</div>
            <p style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'], fontWeight: typography.fontWeight.medium }}>{m.label}</p>
            <p style={{ fontSize: '28px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, lineHeight: 1 }}>{m.value}</p>
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: `${spacing['1']} 0 0` }}>{m.sub}</p>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.borderSubtle}`, marginBottom: spacing['5'], gap: 0 }}>
        {([['auto', 'Auto Log'], ['log', 'Manual Entry'], ['calendar', 'Calendar View']] as const).map(([view, label]) => (
          <button
            key={view}
            aria-pressed={activeView === view}
            onClick={() => setActiveView(view)}
            style={{
              padding: `${spacing['3']} ${spacing['5']}`,
              background: 'none',
              border: 'none',
              borderBottom: activeView === view ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
              color: activeView === view ? colors.primaryOrange : colors.textSecondary,
              fontSize: typography.fontSize.body,
              fontWeight: activeView === view ? typography.fontWeight.semibold : typography.fontWeight.normal,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: `color ${transitions.quick}, border-color ${transitions.quick}`,
              minHeight: '56px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeView === 'auto' && (
        <AutoDailyLog onCapturePress={() => setShowCaptureBar(true)} />
      )}

      {activeView === 'calendar' && (
        <Card padding={spacing['6']}>
          <CalendarNav
            approvedDates={approvedDates}
            submittedDates={submittedDates}
            draftDates={draftDates}
            selectedDate={selectedDate}
            onSelectDate={handleCalendarSelect}
          />
        </Card>
      )}

      {activeView === 'log' && (
        <DailyLogForm
          today={today}
          yesterday={yesterday}
          lastWeek={lastWeek}
          filteredPreviousDays={filteredPreviousDays}
          previousDays={previousDays}
          historySearch={historySearch}
          setHistorySearch={setHistorySearch}
          hasTodayLog={hasTodayLog}
          todayStr={todayStr}
          isMobile={isMobile}
          isLocked={isLocked}
          isApproved={isApproved}
          isSubmittedOnly={isSubmittedOnly}
          isRejected={isRejected}
          logStatus={logStatus}
          submittedAt={submittedAt}
          approvedAt={approvedAt}
          rejectionComments={rejectionComments}
          weather={weather}
          weatherIsAuto={weatherIsAuto}
          manpowerRows={manpowerRows}
          setManpowerRows={setManpowerRows}
          crewHours={crewHours}
          photos={photos}
          logEntries={logEntries}
          workSummary={workSummary}
          setWorkSummary={setWorkSummary}
          aiSummaryLoading={aiSummaryLoading}
          aiSummaryGenerated={aiSummaryGenerated}
          setAiSummaryGenerated={setAiSummaryGenerated}
          onAiSummary={handleAiSummary}
          issuesDelays={issuesDelays}
          setIssuesDelays={setIssuesDelays}
          noIncidentsToday={noIncidentsToday}
          setNoIncidentsToday={setNoIncidentsToday}
          noVisitorsToday={noVisitorsToday}
          setNoVisitorsToday={setNoVisitorsToday}
          expandedIncident={expandedIncident}
          setExpandedIncident={setExpandedIncident}
          showComparison={showComparison}
          setShowComparison={setShowComparison}
          compareMode={compareMode}
          showSignature={showSignature}
          showAddendumForm={showAddendumForm}
          setShowAddendumForm={setShowAddendumForm}
          addendumText={addendumText}
          setAddendumText={setAddendumText}
          addendumSubmitting={addendumSubmitting}
          onAddendumSubmit={handleAddendumSubmit}
          onSameAsYesterday={handleSameAsYesterday}
          onPhotoCapture={handlePhotoCapture}
          onWeatherUpdate={handleWeatherUpdate}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          setShowSignature={setShowSignature}
          setShowCreateModal={setShowCreateModal}
          setSelectedDate={setSelectedDate}
        />
      )}

      {showQuickEntry && (
        <QuickEntry
          initialWeather={weather}
          onSave={handleQuickSave}
          onSubmit={handleQuickSubmit}
          onClose={() => setShowQuickEntry(false)}
        />
      )}

      {showAmendmentModal && (
        <>
          <div onClick={() => setShowAmendmentModal(false)} role="presentation" aria-hidden="true" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1039 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 440, backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, boxShadow: '0 16px 48px rgba(0,0,0,0.15)', zIndex: 1040, padding: spacing['6'] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'] }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: borderRadius.md, backgroundColor: colors.orangeSubtle }}>
                <FileEdit size={18} color={colors.orangeText} />
              </div>
              <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Create Amendment</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.orangeSubtle, borderRadius: borderRadius.md, marginBottom: spacing['4'] }}>
              <Lock size={13} color={colors.orangeText} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, margin: 0 }}>This log has been submitted and locked</p>
                {submittedAt && (
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>
                    Submitted {new Date(submittedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginBottom: spacing['5'] }}>
              Creating an amendment will start a new audit version while preserving the original submission. The original timestamp and contents remain on record.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
              <Btn variant="ghost" size="md" onClick={() => setShowAmendmentModal(false)}>Cancel</Btn>
              <Btn variant="primary" size="md" icon={<FileEdit size={14} />} onClick={() => { setShowAmendmentModal(false); setShowQuickEntry(true); }}>Create Amendment</Btn>
            </div>
          </div>
        </>
      )}

      {showReturnToDraftModal && (
        <>
          <div onClick={() => setShowReturnToDraftModal(false)} role="presentation" aria-hidden="true" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1039 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 440, backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, boxShadow: '0 16px 48px rgba(0,0,0,0.15)', zIndex: 1040, padding: spacing['6'] }}>
            <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['4'] }}>Return to Draft</h3>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginBottom: spacing['3'] }}>Provide a note explaining why this log is being returned to draft. This will be visible to the submitter.</p>
            <textarea
              value={returnToDraftNote}
              onChange={e => setReturnToDraftNote(e.target.value)}
              placeholder="Reason for returning to draft..."
              autoFocus
              style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', minHeight: '96px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
              <Btn variant="ghost" size="md" onClick={() => { setShowReturnToDraftModal(false); setReturnToDraftNote(''); }}>Cancel</Btn>
              <Btn variant="primary" size="md" onClick={handleReturnToDraft}>Return to Draft</Btn>
            </div>
          </div>
        </>
      )}

      {showRejectModal && (
        <>
          <div onClick={() => setShowRejectModal(false)} role="presentation" aria-hidden="true" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1039 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 440, backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, boxShadow: '0 16px 48px rgba(0,0,0,0.15)', zIndex: 1040, padding: spacing['6'] }}>
            <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['4'] }}>Return Daily Log</h3>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginBottom: spacing['3'] }}>Provide a reason so the superintendent knows what needs to be corrected.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for returning this log..."
              autoFocus
              style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', minHeight: '96px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
              <Btn variant="ghost" size="md" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Cancel</Btn>
              <PermissionGate permission="daily_log.reject"><Btn variant="primary" size="md" onClick={handleReject}>Return for Revision</Btn></PermissionGate>
            </div>
          </div>
        </>
      )}
      {activeView === 'auto' && (
        <DailyLogCapture
          logId={todayLogId ?? null}
          visible={showCaptureBar}
        />
      )}

      {showCreateModal && (
        <CreateDailyLogModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          projectId={projectId ?? undefined}
          onSubmit={async (data) => {
            const created = await createDailyLog.mutateAsync({
              projectId: projectId!,
              data: {
                project_id: projectId!,
                log_date: data.date,
                workers_onsite: data.crew_count ? Number(data.crew_count) : 0,
                total_hours: 0,
                incidents: data.has_incident ? 1 : 0,
                weather: data.weather_condition,
                summary: data.activities,
                status: 'draft',
              },
            });
            setShowCreateModal(false);
            addToast('success', 'Daily log created');
            return { id: created?.data?.id as string | undefined };
          }}
        />
      )}
    </PageContainer>
  );
};

export const DailyLog: React.FC = () => (
  <ErrorBoundary message="Daily logs could not be displayed. Check your connection and try again.">
    <DailyLogPage />
  </ErrorBoundary>
);

export default DailyLog;
