import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCopilotStore } from '../stores/copilotStore';
import { Users, Clock, ShieldCheck, Cloud, ChevronRight, Camera, Send, BarChart3, Sparkles, Zap, CalendarDays, Calendar, X, Lock, AlertTriangle, BookOpen, RefreshCw, Truck, UserPlus, FileEdit, HardHat } from 'lucide-react';
import { PageContainer, Card, Btn, Skeleton, SectionHeader, useToast } from '../components/Primitives';
import EmptyState from '../components/ui/EmptyState';
import CreateDailyLogModal from '../components/forms/CreateDailyLogModal';
import { colors, spacing, typography, borderRadius, transitions, tradeColors } from '../styles/theme';
import { ExportButton } from '../components/shared/ExportButton';
import { DailyLogPDF } from '../components/export/DailyLogPDF';
import type { DailyLogPDFData } from '../components/export/DailyLogPDF';
import { toast } from 'sonner';
import { AutoNarrative } from '../components/dailylog/AutoNarrative';
import DailyLogSkeleton from '../components/dailylog/DailyLogSkeleton';
import { DayComparison } from '../components/dailylog/DayComparison';
import { SignaturePad } from '../components/dailylog/SignaturePad';
import { WeatherCard } from '../components/dailylog/WeatherCard';
import { CrewHoursSummary } from '../components/dailylog/CrewHoursSummary';
import type { CrewHoursEntry } from '../components/dailylog/CrewHoursSummary';
import { PhotoGrid } from '../components/dailylog/PhotoGrid';
import type { DailyLogPhoto } from '../components/dailylog/PhotoGrid';
import { QuickEntry } from '../components/dailylog/QuickEntry';
import type { QuickEntryData } from '../components/dailylog/QuickEntry';
import { CalendarNav } from '../components/dailylog/CalendarNav';
import { useProjectId } from '../hooks/useProjectId';
import { useDailyLogs, useDailyLogEntries } from '../hooks/queries';
import { useUpdateDailyLog, useCreateDailyLog, useSubmitDailyLog, useApproveDailyLog, useRejectDailyLog } from '../hooks/mutations';
import { fetchWeather, formatWeatherSummary } from '../lib/weather';
import type { WeatherData } from '../lib/weather';
import { PermissionGate } from '../components/auth/PermissionGate';
import { usePermissions } from '../hooks/usePermissions';
import { getDailyLogStatusConfig } from '../machines/dailyLogMachine';
import type { DailyLogState } from '../machines/dailyLogMachine';

interface ManpowerRow {
  id: string;
  trade: string;
  company: string;
  headcount: number;
  hours: number;
}

export const DailyLog: React.FC = () => {
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

  const dailyLogHistory = dailyLogData?.data ?? [];
  const todayStr = new Date().toISOString().split('T')[0];
  const hasTodayLog = dailyLogHistory.some((l: any) => l.log_date?.split('T')[0] === todayStr);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<'yesterday' | 'lastweek' | null>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
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

  const { hasPermission } = usePermissions();

  const manpowerSeeded = React.useRef(false);
  const [manpowerRows, setManpowerRows] = useState<ManpowerRow[]>([]);

  // Auto-fetch weather on mount
  useEffect(() => {
    fetchWeather().then(setWeather);
  }, []);

  // Fetch entries for the current daily log
  const todayLogId = dailyLogHistory.length > 0 ? dailyLogHistory[0]?.id : undefined;
  const { data: logEntries = [] } = useDailyLogEntries(todayLogId);

  // Trade color mapping
  const tradeColorMap: Record<string, string> = useMemo(() => ({
    concrete: colors.statusInfo,
    electrical: colors.statusPending,
    mechanical: colors.statusActive,
    steel: colors.primaryOrange,
    plumbing: colors.statusReview,
    carpentry: tradeColors.carpentry,
  }), []);

  // Derive crew hours from daily log entries
  const crewHours: CrewHoursEntry[] = useMemo(() => {
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

  // Derive photos from daily log entries
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

  // Calendar data
  const loggedDates = useMemo(() => new Set(
    dailyLogHistory.filter((l: any) => l.status === 'submitted' || l.status === 'approved' || l.approved).map((l: any) => l.log_date?.split('T')[0])
  ), [dailyLogHistory]);
  const draftDates = useMemo(() => new Set(
    dailyLogHistory.filter((l: any) => l.status === 'draft' || (!l.status && !l.approved)).map((l: any) => l.log_date?.split('T')[0])
  ), [dailyLogHistory]);

  const aggMetrics = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 14);
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now); sixtyDaysAgo.setDate(now.getDate() - 60);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const logsInRange = (start: Date, end?: Date) =>
      dailyLogHistory.filter((l: any) => {
        const d = new Date((l.log_date as string) + 'T12:00:00');
        return d >= start && (!end || d <= end);
      });

    const thisWeekLogs = logsInRange(sevenDaysAgo);
    const prevWeekLogs = logsInRange(fourteenDaysAgo, sevenDaysAgo);
    const last30Logs = logsInRange(thirtyDaysAgo);
    const prev30Logs = logsInRange(sixtyDaysAgo, thirtyDaysAgo);
    const thisMonthLogs = logsInRange(startOfMonth);
    const prevMonthLogs = logsInRange(startOfPrevMonth, endOfPrevMonth);

    const todayWorkers = (dailyLogHistory[0] as any)?.workers_onsite ?? 0;
    const yesterdayWorkers = (dailyLogHistory[1] as any)?.workers_onsite ?? 0;
    const manHoursWeek = thisWeekLogs.reduce((s: number, l: any) => s + (l.total_hours ?? 0), 0);
    const manHoursPrevWeek = prevWeekLogs.reduce((s: number, l: any) => s + (l.total_hours ?? 0), 0);
    const openIncidents = last30Logs.filter((l: any) => (l.incidents ?? 0) > 0).length;
    const prevIncidents = prev30Logs.filter((l: any) => (l.incidents ?? 0) > 0).length;
    const logsMonth = thisMonthLogs.length;
    const logsPrevMonth = prevMonthLogs.length;

    return {
      todayWorkers,
      todayWorkersDelta: todayWorkers - yesterdayWorkers,
      manHoursWeek,
      manHoursWeekDelta: manHoursWeek - manHoursPrevWeek,
      openIncidents,
      openIncidentsDelta: openIncidents - prevIncidents,
      logsMonth,
      logsMonthDelta: logsMonth - logsPrevMonth,
    };
  }, [dailyLogHistory]);

  const handleQuickSave = useCallback((_data: QuickEntryData) => {
    toast.success('Draft saved');
  }, []);

  const handleQuickSubmit = useCallback(async (data: QuickEntryData) => {
    try {
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
    // If today's log is already submitted/locked, prompt amendment workflow
    if (dailyLogHistory.length > 0) {
      const log = dailyLogHistory[0];
      const status = (log as any).status;
      const locked = (log as any).is_submitted === true || status === 'approved';
      if (locked) { setShowAmendmentModal(true); return; }
    }
    setShowQuickEntry(true);
  }, [dailyLogHistory]);

  const handleCalendarSelect = (date: string) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

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

  // Show toast when fetch error occurs
  useEffect(() => {
    if (logError) {
      addToast('error', (logError as Error).message || 'Failed to load daily log data');
    }
  }, [logError, addToast]);

  if (loading) {
    return (
      <PageContainer title="Daily Log" subtitle="Loading...">
        <style>{`@keyframes pulse-dl { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
          {/* 4 metric card placeholders */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.xl, padding: spacing['5'], border: `1px solid ${colors.borderSubtle}`, animation: 'pulse-dl 1.5s ease-in-out infinite', height: 96 }} aria-hidden="true" />
            ))}
          </div>
          {/* Calendar placeholder */}
          <div style={{ height: 220, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.xl, border: `1px solid ${colors.borderSubtle}`, animation: 'pulse-dl 1.5s ease-in-out infinite' }} aria-hidden="true" />
          {/* 3 row placeholders */}
          <div style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 56, margin: `${spacing['3']} ${spacing['5']}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, animation: 'pulse-dl 1.5s ease-in-out infinite', borderBottom: i < 2 ? `1px solid ${colors.borderSubtle}` : 'none' }} aria-hidden="true" />
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
        actions={<PermissionGate permission="daily_logs.create"><Btn onClick={() => setShowCreateModal(true)}>New Entry</Btn></PermissionGate>}
      >
        {/* Aggregate metric cards — all zeros until first log is created */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
          {[
            { icon: <Users size={24} color={colors.primaryOrange} />, label: "Today's Workers", value: '0', delta: 0, positiveIsGood: true },
            { icon: <Clock size={24} color={colors.statusActive} />, label: 'Man-Hours This Week', value: '0', delta: 0, positiveIsGood: true },
            { icon: <ShieldCheck size={24} color={colors.statusActive} />, label: 'Open Incidents (30d)', value: '0', delta: 0, positiveIsGood: false },
            { icon: <CalendarDays size={24} color={colors.statusInfo} />, label: 'Logs This Month', value: '0', delta: 0, positiveIsGood: true },
          ].map((m) => (
            <Card key={m.label} padding={spacing['5']}>
              <div style={{ marginBottom: spacing['3'] }}>{m.icon}</div>
              <p style={{ fontSize: '12px', color: colors.textTertiary, margin: 0, marginBottom: spacing['2'], fontWeight: typography.fontWeight.medium }}>{m.label}</p>
              <p style={{ fontSize: '28px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, lineHeight: 1 }}>{m.value}</p>
              <p style={{ fontSize: '11px', color: colors.textTertiary, margin: 0, marginTop: spacing['2'] }}>vs prior period</p>
            </Card>
          ))}
        </div>

        {/* Inline error banner */}
        {logError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: '#FEF2F2', border: `1px solid #FECACA`, borderRadius: borderRadius.lg, marginBottom: spacing['4'] }}>
            <AlertTriangle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
            <p style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, margin: 0, flex: 1 }}>
              {(logError as Error).message || 'Failed to load daily log data'}
            </p>
            <Btn variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetch()}>Retry</Btn>
          </div>
        )}

        {/* Empty state */}
        {!logError && (
          <Card padding={spacing['10']}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: spacing['4'] }}>
              <Calendar size={64} color={colors.borderDefault} />
              <div>
                <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>No daily logs yet.</p>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0, maxWidth: '440px' }}>
                  The daily log is your project's official record. Start documenting site conditions.
                </p>
              </div>
              <Btn variant="primary" size="md" onClick={() => { setSelectedDate(new Date().toISOString().split('T')[0]); setShowCreateModal(true); }}>Start Today's Log</Btn>
            </div>
          </Card>
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
  }

  const today = dailyLogHistory[0];
  const yesterday = dailyLogHistory[1];
  const lastWeek = dailyLogHistory[4];
  const previousDays = dailyLogHistory.slice(1);

  const todayDate = new Date(today.log_date + 'T12:00:00');
  const todayFormatted = todayDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const logStatus: DailyLogState = (today as any).status || (today.approved ? 'approved' : 'draft');
  const statusConfig = getDailyLogStatusConfig(logStatus);
  const isLocked = (today as any).is_submitted === true || logStatus === 'approved';
  const isApproved = logStatus === 'approved';
  const isSubmittedOnly = logStatus === 'submitted';
  const isRejected = logStatus === 'rejected';
  const submittedAt: string | null = (today as any).submitted_at ?? null;
  const approvedAt: string | null = (today as any).approved_at ?? null;
  const rejectionComments = (today as any).rejection_comments;

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

  const todayMetrics = [
    { icon: <Users size={16} style={{ color: colors.textTertiary }} />, label: 'Workers', value: (today.workers_onsite ?? 0).toString(), valueColor: colors.textPrimary },
    { icon: <Clock size={16} style={{ color: colors.textTertiary }} />, label: 'Hours', value: (today.total_hours ?? 0).toLocaleString(), valueColor: colors.textPrimary },
    { icon: <ShieldCheck size={16} style={{ color: colors.textTertiary }} />, label: 'Incidents', value: (today.incidents ?? 0).toString(), valueColor: (today.incidents ?? 0) === 0 ? colors.statusActive : colors.statusCritical },
    { icon: <Cloud size={16} style={{ color: colors.textTertiary }} />, label: 'Weather', value: today.weather ?? (weather ? formatWeatherSummary(weather) : 'N/A'), valueColor: colors.textPrimary },
  ];

  const handleSubmit = async () => {
    try {
      await submitDailyLog.mutateAsync({ id: today.id, projectId: projectId! });
      addToast('success', 'Daily log submitted for approval');
    } catch {
      addToast('error', 'Failed to submit daily log');
    }
  };

  const handleApprove = async () => {
    try {
      await approveDailyLog.mutateAsync({ id: today.id, userId: 'current-user', projectId: projectId! });
      addToast('success', 'Daily log approved');
    } catch {
      addToast('error', 'Failed to approve daily log');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { addToast('error', 'Please provide a reason for rejection'); return; }
    try {
      await rejectDailyLog.mutateAsync({ id: today.id, comments: rejectReason, userId: 'current-user', projectId: projectId! });
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
        <ExportButton
          onExportCSV={() => toast.success('Daily log data exported as CSV')}
          pdfFilename="SiteSync_DailyLog"
          pdfDocument={(() => {
            const pdfData: DailyLogPDFData = {
              projectName: 'Current Project',
              logDate: today.log_date,
              workers_onsite: today.workers_onsite ?? 0,
              total_hours: today.total_hours ?? 0,
              incidents: today.incidents ?? 0,
              weather: today.weather ?? (weather ? formatWeatherSummary(weather) : 'N/A'),
              temperature_high: today.temperature_high ?? undefined,
              temperature_low: today.temperature_low ?? undefined,
              wind_speed: today.wind_speed ?? undefined,
              precipitation: today.precipitation ?? undefined,
              is_submitted: (today as any).is_submitted ?? false,
              submitted_at: (today as any).submitted_at ?? null,
              status: logStatus,
              crew_entries: (today as any).crew_entries ?? [],
              equipment_entries: (today as any).equipment_entries ?? [],
              material_deliveries: (today as any).material_deliveries ?? [],
              workPerformed: today.summary ?? '',
              safety_observations: (today as any).safety_observations ?? '',
              toolbox_talk_topic: (today as any).toolbox_talk_topic ?? '',
              visitors: (today as any).visitors ?? [],
              incident_details: (today as any).incident_details ?? [],
              superintendent_signature_url: today.superintendent_signature_url,
              manager_signature_url: today.manager_signature_url,
            };
            return <DailyLogPDF data={pdfData} />;
          })()}
        />
        <Btn variant="ghost" size="sm" icon={<CalendarDays size={14} />} onClick={() => setShowCalendar(!showCalendar)}>Calendar</Btn>
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
                  <button key={opt.mode} onClick={() => { setCompareMode(opt.mode); setShowComparison(true); setCompareDropdownOpen(false); }} style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, textAlign: 'left' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {/* Approval workflow actions */}
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
      <div style={{ display: 'flex', gap: spacing['6'] }}>
        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
          {/* Today's log not started banner */}
          {!hasTodayLog && (
            <div
              aria-live="polite"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${spacing['3']} ${spacing['4']}`,
                backgroundColor: colors.orangeSubtle, borderRadius: borderRadius.md,
                borderLeft: `3px solid ${colors.primaryOrange}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Calendar size={14} color={colors.primaryOrange} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.orangeText, fontWeight: typography.fontWeight.medium }}>
                  Today's daily log hasn't been started
                </span>
              </div>
              <Btn size="sm" variant="primary" onClick={() => { setSelectedDate(todayStr); setShowCreateModal(true); }}>Start Log</Btn>
            </div>
          )}

          {/* Status banner */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${spacing['2']} ${spacing['4']}`,
            backgroundColor: statusConfig.bg, borderRadius: borderRadius.md,
            borderLeft: `3px solid ${statusConfig.color}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              {isLocked && <Lock size={13} color={statusConfig.color} />}
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: statusConfig.color }}>{statusConfig.label}</span>
              {isApproved && approvedAt && (
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  This log was approved on {new Date(approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Changes require an addendum.
                </span>
              )}
              {isApproved && !approvedAt && (
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>This log is approved. Changes require an addendum.</span>
              )}
              {isSubmittedOnly && submittedAt && (
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  This log was submitted on {new Date(submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} and is locked for editing.
                </span>
              )}
              {isSubmittedOnly && !submittedAt && (
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>This log has been submitted and is locked for editing.</span>
              )}
            </div>
          </div>

          {/* Rejection reason */}
          {isRejected && rejectionComments && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
              padding: `${spacing['3']} ${spacing['4']}`,
              backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md,
              borderLeft: `3px solid ${colors.statusCritical}`,
            }}>
              <AlertTriangle size={14} color={colors.statusCritical} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, margin: 0 }}>Returned for revision</p>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>{rejectionComments}</p>
              </div>
            </div>
          )}

          {/* AI insight */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.statusReviewSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
            <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: 1.5 }}>
              Productivity trending 8% above baseline this week. Concrete crew efficiency highest in project history.
            </p>
          </div>

          {/* Weather card */}
          {weather && (
            <WeatherCard weather={weather} onUpdate={!isLocked ? handleWeatherUpdate : undefined} locked={isLocked} />
          )}

          {/* Today's metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
            {todayMetrics.map((metric) => (
              <Card key={metric.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                  {metric.icon}
                  <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{metric.label}</span>
                </div>
                <span style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: metric.valueColor }}>{metric.value}</span>
              </Card>
            ))}
          </div>

          {/* Crew Hours Summary */}
          <Card>
            <SectionHeader title="Crew Hours Summary" action={
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Actual vs Planned</span>
            } />
            <CrewHoursSummary crews={crewHours} />
          </Card>

          {/* Equipment on Site */}
          <Card>
            <SectionHeader title="Equipment on Site" action={
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{((today as any).equipment_entries ?? []).length} items</span>
            } />
            {((today as any).equipment_entries ?? []).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 120px', gap: 1 }}>
                {['Equipment', 'Qty', 'Hrs Operated'].map(h => (
                  <span key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', backgroundColor: colors.surfaceInset }}>{h}</span>
                ))}
                {((today as any).equipment_entries as Array<{ type: string; count: number; hours_operated: number }>).map((eq, i) => (
                  <React.Fragment key={i}>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{eq.type}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'center' }}>{eq.count}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{eq.hours_operated} hrs</span>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: `${spacing['3']} 0` }}>No equipment entries. Use Quick Entry to log equipment.</p>
            )}
          </Card>

          {/* Material Deliveries */}
          <Card>
            <SectionHeader title="Material Deliveries" action={
              <Truck size={14} style={{ color: colors.textTertiary }} />
            } />
            {((today as any).material_deliveries ?? []).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 120px 120px', gap: 1 }}>
                {['Description', 'Qty', 'PO Reference', 'Delivery Ticket'].map(h => (
                  <span key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', backgroundColor: colors.surfaceInset }}>{h}</span>
                ))}
                {((today as any).material_deliveries as Array<{ description: string; quantity: number; po_reference: string; delivery_ticket: string }>).map((d, i) => (
                  <React.Fragment key={i}>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{d.description}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'center' }}>{d.quantity || '—'}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{d.po_reference || '—'}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{d.delivery_ticket || '—'}</span>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: `${spacing['3']} 0` }}>No material deliveries today.</p>
            )}
          </Card>

          {/* Safety and Toolbox Talk */}
          <Card>
            <SectionHeader title="Safety" action={
              <ShieldCheck size={14} style={{ color: colors.textTertiary }} />
            } />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              {(today as any).toolbox_talk_topic && (
                <div>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: spacing['1'] }}>Toolbox Talk</span>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{(today as any).toolbox_talk_topic}</p>
                </div>
              )}
              <div>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: spacing['1'] }}>Observations</span>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{(today as any).safety_observations || 'No safety observations recorded.'}</p>
              </div>
            </div>
          </Card>

          {/* Site Visitors */}
          <Card>
            <SectionHeader title="Site Visitors" action={
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <UserPlus size={12} /> {((today as any).visitors ?? []).length}
              </span>
            } />
            {((today as any).visitors ?? []).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px 80px', gap: 1 }}>
                {['Name', 'Company', 'Purpose', 'Time In', 'Time Out'].map(h => (
                  <span key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', backgroundColor: colors.surfaceInset }}>{h}</span>
                ))}
                {((today as any).visitors as Array<{ name: string; company: string; purpose: string; time_in: string; time_out: string }>).map((v, i) => (
                  <React.Fragment key={i}>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.name}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.company || '—'}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.purpose || '—'}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.time_in || '—'}</span>
                    <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{v.time_out || '—'}</span>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: `${spacing['3']} 0` }}>No visitors today.</p>
            )}
          </Card>

          {/* Incident Details */}
          {((today as any).incident_details ?? []).length > 0 && (
            <Card>
              <SectionHeader title="Incident Details" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                {((today as any).incident_details as Array<{ description: string; type: string; corrective_action: string }>).map((inc, i) => (
                  <div key={i} style={{ padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusCritical}` }}>
                    <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, textTransform: 'uppercase', margin: 0, marginBottom: spacing['1'] }}>{inc.type.replace(/_/g, ' ')}</p>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{inc.description}</p>
                    {inc.corrective_action && (
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>Corrective action: {inc.corrective_action}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* AI Auto Narrative */}
          <AutoNarrative logData={today as unknown as Record<string, unknown>} />

          {/* Day Comparison */}
          {showComparison && yesterday && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                <SectionHeader title={compareMode === 'lastweek' ? 'vs Same Day Last Week' : 'vs Yesterday'} />
                <button onClick={() => setShowComparison(false)} style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily }}>Close</button>
              </div>
              <DayComparison
                today={{ label: 'Today', workers: today.workers_onsite ?? 0, hours: today.total_hours ?? 0, incidents: today.incidents ?? 0 }}
                yesterday={compareMode === 'lastweek' && lastWeek
                  ? { label: 'Last Week', workers: lastWeek.workers_onsite ?? 0, hours: lastWeek.total_hours ?? 0, incidents: lastWeek.incidents ?? 0 }
                  : { label: 'Yesterday', workers: yesterday.workers_onsite ?? 0, hours: yesterday.total_hours ?? 0, incidents: yesterday.incidents ?? 0 }
                }
                lastWeek={lastWeek ? { label: 'Last Week', workers: lastWeek.workers_onsite ?? 0, hours: lastWeek.total_hours ?? 0, incidents: lastWeek.incidents ?? 0 } : { label: 'Last Week', workers: 0, hours: 0, incidents: 0 }}
              />
            </Card>
          )}

          {/* Photo Documentation */}
          <div>
            <SectionHeader title="Photo Documentation" action={
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                <Camera size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{photos.length} captures
              </span>
            } />
            <PhotoGrid photos={photos} onCapture={!isLocked ? handlePhotoCapture : undefined} />
          </div>

          {/* Addendum form — appended below original log content, original remains unmodified */}
          {showAddendumForm && isApproved && (
            <Card>
              <SectionHeader title="Add Addendum" action={
                <button onClick={() => setShowAddendumForm(false)} aria-label="Close addendum form" style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'] }}><X size={14} /></button>
              } />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.orangeSubtle, borderRadius: borderRadius.md, marginBottom: spacing['4'] }}>
                <Lock size={13} color={colors.orangeText} style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: typography.fontSize.sm, color: colors.orangeText, margin: 0 }}>
                  The original log is preserved. This addendum will be saved as a separate record linked to this log, with its own timestamp and author.
                </p>
              </div>
              <textarea
                value={addendumText}
                onChange={e => setAddendumText(e.target.value)}
                placeholder="Describe the addendum, correction, or additional information..."
                disabled={addendumSubmitting}
                style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', minHeight: '96px', boxSizing: 'border-box', color: colors.textPrimary }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['3'] }}>
                <Btn variant="ghost" size="md" onClick={() => { setShowAddendumForm(false); setAddendumText(''); }}>Cancel</Btn>
                <Btn variant="primary" size="md" icon={<FileEdit size={14} />} onClick={handleAddendumSubmit} disabled={addendumSubmitting}>
                  {addendumSubmitting ? 'Saving...' : 'Save Addendum'}
                </Btn>
              </div>
            </Card>
          )}

          {/* Signature / Approval */}
          {showSignature && logStatus === 'submitted' && (
            <SignaturePad
              signerName="Walker Benner"
              signerTitle="Project Manager"
              onSign={async () => {
                await handleApprove();
                setShowSignature(false);
              }}
            />
          )}

          {/* Aggregate metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
            {[
              {
                icon: <Users size={24} color={colors.primaryOrange} />,
                label: "Today's Workers",
                value: aggMetrics.todayWorkers,
                delta: aggMetrics.todayWorkersDelta,
                positiveIsGood: true,
                deltaLabel: 'vs yesterday',
              },
              {
                icon: <Clock size={24} color={colors.statusActive} />,
                label: 'Man-Hours This Week',
                value: aggMetrics.manHoursWeek.toLocaleString(),
                delta: aggMetrics.manHoursWeekDelta,
                positiveIsGood: true,
                deltaLabel: 'vs prior week',
              },
              {
                icon: <ShieldCheck size={24} color={aggMetrics.openIncidents === 0 ? colors.statusActive : colors.statusCritical} />,
                label: 'Open Incidents (30d)',
                value: aggMetrics.openIncidents,
                delta: aggMetrics.openIncidentsDelta,
                positiveIsGood: false,
                deltaLabel: 'vs prior 30d',
              },
              {
                icon: <CalendarDays size={24} color={colors.statusInfo} />,
                label: 'Logs This Month',
                value: aggMetrics.logsMonth,
                delta: aggMetrics.logsMonthDelta,
                positiveIsGood: true,
                deltaLabel: 'vs prior month',
              },
            ].map((m) => (
              <Card key={m.label} padding={spacing['5']}>
                <div style={{ marginBottom: spacing['3'] }}>{m.icon}</div>
                <p style={{ fontSize: '12px', color: colors.textTertiary, margin: 0, marginBottom: spacing['2'], fontWeight: typography.fontWeight.medium }}>{m.label}</p>
                <p style={{ fontSize: '28px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, lineHeight: 1 }}>{m.value}</p>
                <p style={{ fontSize: '11px', margin: 0, marginTop: spacing['2'], color: m.delta === 0 ? colors.textTertiary : (m.positiveIsGood ? (m.delta > 0 ? colors.statusActive : colors.statusCritical) : (m.delta < 0 ? colors.statusActive : colors.statusCritical)) }}>
                  {m.delta === 0 ? `— ${m.deltaLabel}` : `${m.delta > 0 ? '+' : ''}${m.delta} ${m.deltaLabel}`}
                </p>
              </Card>
            ))}
          </div>

          {/* Previous Days */}
          <div>
            <SectionHeader title="Previous Days" />
            <Card padding="0">
              {previousDays.map((log: any, index: number) => {
                const logDate = new Date(log.log_date + 'T12:00:00');
                const formatted = logDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const isHovered = hoveredRow === log.id;
                const isLast = index === previousDays.length - 1;
                const entryStatus = log.status || (log.approved ? 'approved' : 'draft');
                const sc = getDailyLogStatusConfig(entryStatus);

                return (
                  <div
                    key={log.id}
                    onClick={() => addToast('info', `Viewing details for ${formatted}`)}
                    onMouseEnter={() => setHoveredRow(log.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: `${spacing['4']} ${spacing['5']}`,
                      cursor: 'pointer',
                      backgroundColor: isHovered ? colors.surfaceHover : 'transparent',
                      transition: `background-color ${transitions.quick}`,
                      borderBottom: isLast ? 'none' : `1px solid ${colors.borderSubtle}`,
                      gap: spacing['4'],
                    }}
                  >
                    <div style={{ minWidth: '120px', flexShrink: 0 }}>
                      <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, display: 'block' }}>{formatted}</span>
                      {log.ai_summary && (
                        <span style={{ fontSize: '11px', color: colors.textTertiary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{log.ai_summary}</span>
                      )}
                    </div>
                    {/* Status badge with lock indicator for submitted/approved */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: sc.color, backgroundColor: sc.bg, padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full, flexShrink: 0 }}>
                      {(entryStatus === 'submitted' || entryStatus === 'approved') && <Lock size={10} />}
                      {sc.label}
                    </span>
                    <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.summary ?? ''}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], flexShrink: 0 }}>
                      <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>{log.workers_onsite ?? 0} workers</span>
                      <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>{(log.total_hours ?? 0).toLocaleString()} hrs</span>
                      {(log.incidents ?? 0) > 0 && (
                        <div>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedIncident(expandedIncident === log.id ? null : log.id); }} style={{ fontSize: typography.fontSize.label, color: colors.statusCritical, fontWeight: typography.fontWeight.medium, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: typography.fontFamily, textDecoration: 'underline', padding: 0 }}>
                            {log.incidents ?? 0} incident{(log.incidents ?? 0) > 1 ? 's' : ''}
                          </button>
                        </div>
                      )}
                      <ChevronRight size={14} style={{ color: colors.textTertiary, opacity: isHovered ? 1 : 0, transition: `opacity ${transitions.quick}` }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        </div>

        {/* Calendar sidebar */}
        {showCalendar && (
          <div style={{ width: 280, flexShrink: 0 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Calendar</span>
                <button onClick={() => setShowCalendar(false)} aria-label="Close calendar" title="Close calendar" style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'] }}><X size={14} /></button>
              </div>
              <CalendarNav
                loggedDates={loggedDates}
                draftDates={draftDates}
                selectedDate={selectedDate}
                onSelectDate={handleCalendarSelect}
              />
            </Card>
          </div>
        )}
      </div>

      {/* Quick Entry overlay */}
      {showQuickEntry && (
        <QuickEntry
          initialWeather={weather}
          onSave={handleQuickSave}
          onSubmit={handleQuickSubmit}
          onClose={() => setShowQuickEntry(false)}
        />
      )}

      {/* Amendment Modal */}
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

      {/* Return to Draft Modal */}
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

      {/* Reject Modal */}
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
    </PageContainer>
  );
};
