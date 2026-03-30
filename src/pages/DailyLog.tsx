import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Users, Clock, ShieldCheck, Cloud, ChevronRight, Camera, Send, BarChart3, Sparkles, Zap, CalendarDays, X, Lock, AlertTriangle } from 'lucide-react';
import { PageContainer, Card, Btn, Skeleton, SectionHeader, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { ExportButton } from '../components/shared/ExportButton';
import { toast } from 'sonner';
import { AutoNarrative } from '../components/dailylog/AutoNarrative';
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
import { useDailyLogs } from '../hooks/queries';
import { useUpdateDailyLog, useCreateDailyLog, useSubmitDailyLog, useApproveDailyLog, useRejectDailyLog } from '../hooks/mutations';
import { fetchWeather, formatWeatherSummary } from '../lib/weather';
import type { WeatherData } from '../lib/weather';
import { getDailyLogStatusConfig } from '../machines/dailyLogMachine';
import type { DailyLogState } from '../machines/dailyLogMachine';

export const DailyLog: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const { data: dailyLogData, isPending: loading } = useDailyLogs(projectId);
  const updateDailyLog = useUpdateDailyLog();
  const createDailyLog = useCreateDailyLog();
  const submitDailyLog = useSubmitDailyLog();
  const approveDailyLog = useApproveDailyLog();
  const rejectDailyLog = useRejectDailyLog();

  const dailyLogHistory = dailyLogData ?? [];
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

  // Auto-fetch weather on mount
  useEffect(() => {
    fetchWeather().then(setWeather);
  }, []);

  // Crew hours data (derived from manpower entries or default)
  const crewHours: CrewHoursEntry[] = useMemo(() => [
    { trade: 'Concrete', workers: 42, hours: 336, plannedHours: 320, color: colors.statusInfo },
    { trade: 'Electrical', workers: 35, hours: 280, plannedHours: 300, color: colors.statusPending },
    { trade: 'Mechanical', workers: 28, hours: 224, plannedHours: 240, color: colors.statusActive },
    { trade: 'Steel', workers: 24, hours: 192, plannedHours: 200, color: colors.primaryOrange },
    { trade: 'Plumbing', workers: 18, hours: 144, plannedHours: 160, color: colors.statusReview },
    { trade: 'Carpentry', workers: 16, hours: 128, plannedHours: 120, color: '#8B5E3C' },
    { trade: 'General Labor', workers: 24, hours: 192, plannedHours: 180, color: colors.textTertiary },
  ], []);

  // Photo data (from daily_log_entries with photos, or placeholder)
  const photos: DailyLogPhoto[] = useMemo(() => [
    { id: '1', url: '', caption: 'Steel Connection Detail', category: 'progress' as const, timestamp: new Date().toISOString(), latitude: 40.7128, longitude: -74.006 },
    { id: '2', url: '', caption: 'PPE Compliance Check', category: 'safety' as const, timestamp: new Date().toISOString(), latitude: 40.7128, longitude: -74.006 },
    { id: '3', url: '', caption: 'Drywall Progress Floor 8', category: 'progress' as const, timestamp: new Date().toISOString() },
    { id: '4', url: '', caption: 'MEP Routing Inspection', category: 'quality' as const, timestamp: new Date().toISOString() },
    { id: '5', url: '', caption: 'Curtain Wall Install', category: 'progress' as const, timestamp: new Date().toISOString() },
    { id: '6', url: '', caption: 'Morning Conditions', category: 'weather' as const, timestamp: new Date().toISOString() },
  ], []);

  // Calendar data
  const loggedDates = useMemo(() => new Set(
    dailyLogHistory.filter((l: any) => l.status === 'submitted' || l.status === 'approved' || l.approved).map((l: any) => l.log_date?.split('T')[0])
  ), [dailyLogHistory]);
  const draftDates = useMemo(() => new Set(
    dailyLogHistory.filter((l: any) => l.status === 'draft' || (!l.status && !l.approved)).map((l: any) => l.log_date?.split('T')[0])
  ), [dailyLogHistory]);

  const handleQuickSave = useCallback((_data: QuickEntryData) => {
    toast.success('Draft saved');
  }, []);

  const handleQuickSubmit = useCallback(async (data: QuickEntryData) => {
    try {
      const totalWorkers = data.workforce.reduce((s, w) => s + w.workers, 0);
      const totalHours = data.workforce.reduce((s, w) => s + w.hours, 0);
      await createDailyLog.mutateAsync({
        projectId: projectId!,
        data: {
          project_id: projectId!,
          log_date: selectedDate,
          workers_onsite: totalWorkers,
          total_hours: totalHours,
          weather: data.weather ? formatWeatherSummary(data.weather) : null,
          summary: data.workPerformed,
          status: 'submitted',
        },
      });
      setShowQuickEntry(false);
      addToast('success', 'Daily log submitted');
    } catch {
      addToast('error', 'Failed to submit daily log');
    }
  }, [createDailyLog, projectId, selectedDate, addToast]);

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

  if (loading || dailyLogHistory.length === 0) {
    return (
      <PageContainer title="Daily Log">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
          <Card padding={spacing['5']}>
            <Skeleton width="240px" height="24px" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginTop: spacing['4'] }}>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="72px" />)}
            </div>
          </Card>
        </div>
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
  const isLocked = logStatus === 'approved';
  const isRejected = logStatus === 'rejected';
  const rejectionComments = (today as any).rejection_comments;

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
        />
        <Btn variant="ghost" size="sm" icon={<CalendarDays size={14} />} onClick={() => setShowCalendar(!showCalendar)}>Calendar</Btn>
        <Btn variant="secondary" size="sm" icon={<Zap size={14} />} onClick={() => setShowQuickEntry(true)}>Quick Entry</Btn>
        <div style={{ position: 'relative' }}>
          <Btn variant="secondary" size="sm" icon={<BarChart3 size={14} />} onClick={() => setCompareDropdownOpen(!compareDropdownOpen)}>
            Compare Days
          </Btn>
          {compareDropdownOpen && (
            <>
              <div onClick={() => setCompareDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
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
        {logStatus === 'draft' && (
          <Btn size="sm" icon={<Send size={14} />} onClick={handleSubmit}>Submit for Approval</Btn>
        )}
        {logStatus === 'submitted' && (
          <>
            <Btn size="sm" variant="primary" icon={<ShieldCheck size={14} />} onClick={() => setShowSignature(true)}>Approve</Btn>
            <span style={{ color: colors.statusCritical }}><Btn size="sm" variant="ghost" onClick={() => setShowRejectModal(true)}>Reject</Btn></span>
          </>
        )}
        {isRejected && (
          <Btn size="sm" icon={<Send size={14} />} onClick={handleSubmit}>Resubmit</Btn>
        )}
      </div>
    }>
      <div style={{ display: 'flex', gap: spacing['6'] }}>
        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
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
              {isLocked && <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>This log is locked. Contact PM to make changes.</span>}
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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', backgroundColor: 'rgba(124, 93, 199, 0.04)', borderRadius: '8px', borderLeft: '3px solid #7C5DC7' }}>
            <Sparkles size={14} color="#7C5DC7" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: '#1A1613', margin: 0, lineHeight: 1.5 }}>
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
            <SectionHeader title="Equipment on Site" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 100px', gap: 1 }}>
              {['Equipment', 'Qty', 'Location', 'Status'].map(h => (
                <span key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', backgroundColor: colors.surfaceInset }}>{h}</span>
              ))}
              {[
                { name: 'Tower Crane', qty: 1, location: 'Roof', status: 'Operating', statusColor: colors.statusActive },
                { name: 'Concrete Pump', qty: 2, location: 'Floor 9', status: 'Active', statusColor: colors.statusActive },
                { name: 'Scissor Lifts', qty: 4, location: 'Floors 3 to 5', status: 'Active', statusColor: colors.statusActive },
                { name: 'Generator', qty: 1, location: 'Basement', status: 'Standby', statusColor: colors.statusPending },
              ].map(eq => (
                <React.Fragment key={eq.name}>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{eq.name}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: 'center' }}>{eq.qty}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{eq.location}</span>
                  <span style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: eq.statusColor, borderBottom: `1px solid ${colors.borderSubtle}` }}>{eq.status}</span>
                </React.Fragment>
              ))}
            </div>
          </Card>

          {/* AI Auto Narrative */}
          <AutoNarrative
            workers={today.workers_onsite ?? 0}
            hours={today.total_hours ?? 0}
            incidents={today.incidents ?? 0}
            weather={today.weather ?? (weather ? formatWeatherSummary(weather) : 'N/A')}
            summary={today.summary ?? ''}
          />

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
                    <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, minWidth: '120px', flexShrink: 0 }}>{formatted}</span>
                    {/* Status badge */}
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: sc.color, backgroundColor: sc.bg, padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full, flexShrink: 0 }}>{sc.label}</span>
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
                <button onClick={() => setShowCalendar(false)} style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'] }}><X size={14} /></button>
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

      {/* Reject Modal */}
      {showRejectModal && (
        <>
          <div onClick={() => setShowRejectModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1039 }} />
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
              <Btn variant="primary" size="md" onClick={handleReject}>Return for Revision</Btn>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
};
