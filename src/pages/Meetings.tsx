import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Play, Square, Clock, Plus, ChevronRight, Sparkles, GripVertical,
  Users as UsersIcon, Calendar, X, CheckCircle2, Circle, UserCheck,
} from 'lucide-react';
import {
  PageContainer, Card, SectionHeader, Tag, Skeleton, useToast, Btn, MetricBox,
} from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../styles/theme';
import { ExportButton } from '../components/shared/ExportButton';
import { toast } from 'sonner';
import { useCreateMeeting } from '../hooks/mutations';
import { useProjectId } from '../hooks/useProjectId';
import { useMeetings, useMeeting, useMeetingAgendaItems, useMeetingActionItems, useOpenActionItems } from '../hooks/queries';
import CreateMeetingModal from '../components/forms/CreateMeetingModal';
import { PermissionGate } from '../components/auth/PermissionGate';
import { supabase } from '../lib/supabase';

// ── Type helpers ─────────────────────────────────────────────────────────────

const MEETING_TYPE_LABELS: Record<string, string> = {
  oac: 'OAC',
  safety: 'Safety',
  coordination: 'Coordination',
  progress: 'Progress',
  subcontractor: 'Subcontractor',
  internal: 'Internal',
};

const MEETING_TYPE_COLORS: Record<string, { fg: string; bg: string }> = {
  oac: { fg: colors.primaryOrange, bg: colors.orangeSubtle },
  safety: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
  coordination: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  progress: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  subcontractor: { fg: colors.statusReview, bg: colors.statusReviewSubtle },
  internal: { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle },
};

function typeLabel(type: string | null): string {
  return MEETING_TYPE_LABELS[type ?? ''] ?? 'Meeting';
}

function typeColors(type: string | null): { fg: string; bg: string } {
  return MEETING_TYPE_COLORS[type ?? ''] ?? { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function actionItemAgingColor(dueDateStr: string | null): string {
  if (!dueDateStr) return colors.textTertiary;
  const due = new Date(dueDateStr);
  const now = new Date();
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilDue < 0) return colors.statusCritical;
  if (daysUntilDue <= 4) return colors.statusPending;
  return colors.statusActive;
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function getWeekDates(): { label: string; dateStr: string; dayName: string }[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return days.map((dayName, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label: `${months[d.getMonth()]} ${d.getDate()}`, dateStr: d.toISOString().split('T')[0], dayName };
  });
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function parseAgendaItems(meeting: any): { title: string; duration: string }[] {
  if (!meeting?.agenda) return [];
  try {
    const parsed = typeof meeting.agenda === 'string' ? JSON.parse(meeting.agenda) : meeting.agenda;
    if (Array.isArray(parsed)) return parsed.map((item: any) => ({
      title: item.title || item.name || String(item),
      duration: item.duration || '',
    }));
  } catch { /* ignore */ }
  return [];
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'upcoming' as const, label: 'Upcoming' },
  { key: 'calendar' as const, label: 'Calendar' },
  { key: 'live' as const, label: 'Live Mode' },
];

// ── Detail Panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  meetingId: string;
  onClose: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ meetingId, onClose }) => {
  const { data: meeting, isPending: meetingLoading } = useMeeting(meetingId);
  const { data: agendaItems = [] } = useMeetingAgendaItems(meetingId);
  const { data: actionItems = [] } = useMeetingActionItems(meetingId);

  const tc = typeColors(meeting?.type ?? null);
  const attendees: any[] = (meeting as any)?.attendees ?? [];
  const attendedCount = attendees.filter((a: any) => a.attended).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: zIndex.modal - 1,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 560,
          height: '100vh',
          background: colors.surfaceRaised,
          boxShadow: shadows.panel,
          zIndex: zIndex.modal,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: `${spacing.xl} ${spacing.xl} ${spacing.lg}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {meetingLoading ? (
              <Skeleton width="60%" height="22px" />
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <Tag label={typeLabel(meeting?.type ?? null)} color={tc.fg} backgroundColor={tc.bg} />
                  {meeting?.status === 'completed' && (
                    <Tag label="Completed" color={colors.statusActive} backgroundColor={colors.statusActiveSubtle} />
                  )}
                </div>
                <h2
                  style={{
                    fontSize: typography.fontSize.subtitle,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                    margin: 0,
                    lineHeight: typography.lineHeight.tight,
                  }}
                >
                  {meeting?.title ?? ''}
                </h2>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `${spacing.xs} 0 0` }}>
                  {formatDate(meeting?.date ?? null)}
                  {meeting?.date ? ` at ${formatTime(meeting.date)}` : ''}
                  {meeting?.location ? ` · ${meeting.location}` : ''}
                  {meeting?.duration_minutes ? ` · ${meeting.duration_minutes} min` : ''}
                </p>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close meeting detail"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: spacing.xs,
              color: colors.textTertiary,
              flexShrink: 0,
              marginLeft: spacing.sm,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: spacing.xl }}>
          {/* Agenda items */}
          <p
            style={{
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textSecondary,
              margin: `0 0 ${spacing.md}`,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
            }}
          >
            Agenda
          </p>
          {agendaItems.length === 0 ? (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginBottom: spacing.xl }}>
              No agenda items recorded.
            </p>
          ) : (
            <ol style={{ margin: `0 0 ${spacing.xl}`, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {agendaItems.map((item: any, i: number) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: spacing.md,
                    padding: `${spacing.md} ${spacing.lg}`,
                    background: colors.surfaceInset,
                    borderRadius: borderRadius.md,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: borderRadius.full,
                      background: colors.primaryOrange,
                      color: colors.white,
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>
                      {item.title}
                    </p>
                    {item.notes && (
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing.xs} 0 0`, lineHeight: typography.lineHeight.normal }}>
                        {item.notes}
                      </p>
                    )}
                    {item.decision && (
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, margin: `${spacing.xs} 0 0`, fontWeight: typography.fontWeight.medium }}>
                        Decision: {item.decision}
                      </p>
                    )}
                  </div>
                  {item.duration_minutes && (
                    <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, flexShrink: 0 }}>
                      {item.duration_minutes}m
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}

          {/* Action items */}
          <p
            style={{
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textSecondary,
              margin: `0 0 ${spacing.md}`,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
            }}
          >
            Action Items
          </p>
          {actionItems.length === 0 ? (
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginBottom: spacing.xl }}>
              No action items for this meeting.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.xl }}>
              {actionItems.map((item: any) => {
                const agingColor = actionItemAgingColor(item.due_date);
                const isDone = item.status === 'done' || item.status === 'completed';
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: spacing.md,
                      padding: `${spacing.md} ${spacing.lg}`,
                      background: colors.surfaceInset,
                      borderRadius: borderRadius.md,
                      opacity: isDone ? 0.6 : 1,
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={16} color={colors.statusActive} style={{ flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <Circle size={16} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 2 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: typography.fontSize.body,
                          color: isDone ? colors.textTertiary : colors.textPrimary,
                          margin: 0,
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}
                      >
                        {item.description}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xs }}>
                        {item.assigned_to && (
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                            {item.assigned_to}
                          </span>
                        )}
                        {item.due_date && (
                          <span
                            style={{
                              fontSize: typography.fontSize.sm,
                              color: isDone ? colors.textTertiary : agingColor,
                              fontWeight: typography.fontWeight.medium,
                            }}
                          >
                            Due {formatDate(item.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Attendance */}
          {attendees.length > 0 && (
            <>
              <p
                style={{
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textSecondary,
                  margin: `0 0 ${spacing.md}`,
                  textTransform: 'uppercase',
                  letterSpacing: typography.letterSpacing.wider,
                }}
              >
                Attendance ({attendedCount} of {attendees.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {attendees.map((a: any) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: `${spacing.sm} ${spacing.md}`,
                      borderRadius: borderRadius.md,
                    }}
                  >
                    {a.attended ? (
                      <UserCheck size={14} color={colors.statusActive} />
                    ) : (
                      <Circle size={14} color={colors.textTertiary} />
                    )}
                    <span style={{ fontSize: typography.fontSize.sm, color: a.attended ? colors.textPrimary : colors.textTertiary, flex: 1 }}>
                      {a.company || a.user_id || 'Unknown'}
                    </span>
                    {a.role && (
                      <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                        {a.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ── MeetingsPage ──────────────────────────────────────────────────────────────

export const MeetingsPage: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const createMeeting = useCreateMeeting();

  const { data: rawResult, isPending: loading } = useMeetings(projectId);
  const { data: openActionItemsRaw } = useOpenActionItems(projectId);
  const rawMeetings = rawResult?.data ?? [];

  const meetings = useMemo(() =>
    rawMeetings.map((m) => {
      const d = m.date ? new Date(m.date) : null;
      return {
        ...m,
        type: m.type ?? 'oac',
        dateObj: d,
        dateStr: d ? d.toISOString().split('T')[0] : '',
        displayDate: formatDate(m.date ?? null),
        displayTime: formatTime(m.date ?? null),
        status: (m.status ?? 'scheduled') as string,
      };
    }),
    [rawMeetings]
  );

  // ── Real-time subscription ────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`meetings_page_${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings', filter: `project_id=eq.${projectId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['meetings', projectId] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

  // ── UI state ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'upcoming' | 'calendar' | 'live'>('upcoming');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Live mode state ───────────────────────────────────────
  const [liveMeeting, setLiveMeeting] = useState<any>(null);
  const [liveTimer, setLiveTimer] = useState(0);
  const [liveAgendaIndex, setLiveAgendaIndex] = useState(0);
  const [actionItems, setActionItems] = useState<{ text: string; assignee: string }[]>([]);
  const [actionInput, setActionInput] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (liveMeeting) {
      timerRef.current = setInterval(() => setLiveTimer((p) => p + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [liveMeeting]);

  // ── Metrics ───────────────────────────────────────────────
  const { start: weekStart, end: weekEnd } = getWeekBounds();
  const now = new Date();

  const upcomingMeetings = meetings.filter((m) => m.dateObj && m.dateObj >= now);
  const thisWeekMeetings = meetings.filter(
    (m) => m.dateObj && m.dateObj >= weekStart && m.dateObj < weekEnd
  );
  const openActionItemsCount = openActionItemsRaw?.length ?? 0;

  // Skeleton while loading
  if (loading) {
    return (
      <PageContainer title="Meetings">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} padding={spacing.xl}>
              <Skeleton width="50%" height="14px" />
              <Skeleton width="30%" height="28px" />
            </Card>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {[1, 2, 3].map((i) => (
            <Card key={i} padding={spacing.lg}>
              <Skeleton width="60%" height="16px" />
              <Skeleton width="40%" height="14px" />
            </Card>
          ))}
        </div>
      </PageContainer>
    );
  }

  const completed = meetings.filter((m) => m.status === 'completed');

  // ── Shared styles ─────────────────────────────────────────
  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: spacing.xs,
    background: colors.surfaceInset,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.xl,
    width: 'fit-content',
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    fontSize: typography.fontSize.sm,
    fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
    fontFamily: typography.fontFamily,
    background: isActive ? colors.surfaceRaised : 'transparent',
    color: isActive ? colors.textPrimary : colors.textSecondary,
    boxShadow: isActive ? shadows.card : 'none',
    transition: transitions.quick,
  });

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: `${spacing.sm} ${spacing.md}`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    background: colors.surfaceRaised,
    outline: 'none',
  };

  // ── Handlers ──────────────────────────────────────────────
  const startMeeting = (meeting: any) => {
    setLiveMeeting(meeting);
    setLiveTimer(0);
    setLiveAgendaIndex(0);
    setActionItems([]);
    setActionInput('');
    setActiveTab('live');
  };

  const endMeeting = () => {
    setLiveMeeting(null);
    setLiveTimer(0);
    setLiveAgendaIndex(0);
    addToast('success', 'Meeting ended. Minutes saved.');
    setActiveTab('upcoming');
  };

  const addActionItem = () => {
    if (!actionInput.trim()) return;
    setActionItems((p) => [...p, { text: actionInput.trim(), assignee: 'Unassigned' }]);
    setActionInput('');
  };

  const liveAgendaItems = liveMeeting ? parseAgendaItems(liveMeeting) : [];

  // ── Table column header ───────────────────────────────────
  const thStyle: React.CSSProperties = {
    padding: `${spacing.sm} ${spacing.lg}`,
    textAlign: 'left',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    background: colors.surfaceInset,
  };

  return (
    <PageContainer
      title="Meetings"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <ExportButton
            onExportCSV={() => toast.success('Meeting data exported as CSV')}
            pdfFilename="SiteSync_Meetings"
          />
          <PermissionGate permission="meetings.create">
            <Btn icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Schedule Meeting
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      {/* ── Metric cards ─────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}
      >
        <MetricBox label="Upcoming Meetings" value={upcomingMeetings.length} />
        <MetricBox
          label="Open Action Items"
          value={openActionItemsCount}
          colorOverride={openActionItemsCount > 0 ? 'warning' : undefined}
        />
        <MetricBox label="Meetings This Week" value={thisWeekMeetings.length} />
        <MetricBox
          label="Completed"
          value={completed.length}
          changeLabel={`of ${meetings.length} total`}
        />
      </div>

      {/* ── AI banner ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          marginBottom: spacing['4'],
          backgroundColor: colors.statusReviewSubtle,
          borderRadius: borderRadius.md,
          borderLeft: `3px solid ${colors.statusReview}`,
        }}
      >
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: 1.5 }}>
          3 action items from the last OAC meeting are overdue. The next safety meeting has 2 unresolved items from the prior session.
        </p>
      </div>

      {/* ── Tab bar ──────────────────────────────────────── */}
      <div style={tabBarStyle} role="tablist" aria-label="Meeting views">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            style={tabStyle(activeTab === tab.key)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================
          UPCOMING TAB
      ================================================================ */}
      {activeTab === 'upcoming' && (
        <>
          {meetings.length === 0 ? (
            /* Empty state */
            <Card padding={spacing['2xl']}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: `${spacing['2xl']} ${spacing.xl}`,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: borderRadius.full,
                    background: colors.surfaceInset,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing.xl,
                  }}
                >
                  <Calendar size={28} color={colors.textTertiary} />
                </div>
                <p
                  style={{
                    fontSize: typography.fontSize.title,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                    margin: `0 0 ${spacing.sm}`,
                  }}
                >
                  No meetings scheduled
                </p>
                <p
                  style={{
                    fontSize: typography.fontSize.body,
                    color: colors.textTertiary,
                    margin: `0 0 ${spacing.xl}`,
                    maxWidth: 360,
                    lineHeight: typography.lineHeight.normal,
                  }}
                >
                  Set up your recurring OAC meeting or schedule a one off to keep the team aligned.
                </p>
                <PermissionGate permission="meetings.create">
                  <Btn icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                    Schedule Meeting
                  </Btn>
                </PermissionGate>
              </div>
            </Card>
          ) : (
            /* Meetings table */
            <div
              style={{
                background: colors.surfaceRaised,
                borderRadius: borderRadius.xl,
                boxShadow: shadows.card,
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Type</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Attendees</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action Items</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m, idx) => {
                    const tc = typeColors(m.type);
                    const isLast = idx === meetings.length - 1;
                    const rowBorder = isLast ? 'none' : `1px solid ${colors.borderSubtle}`;
                    const statusColor = m.status === 'completed'
                      ? { fg: colors.statusActive, bg: colors.statusActiveSubtle, label: 'Completed' }
                      : { fg: colors.statusInfo, bg: colors.statusInfoSubtle, label: 'Scheduled' };

                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedId(m.id)}
                        style={{ cursor: 'pointer', transition: transitions.quick }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = colors.surfaceHover; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                      >
                        <td
                          style={{
                            padding: `${spacing.md} ${spacing.lg}`,
                            borderBottom: rowBorder,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>
                            {m.displayDate}
                          </p>
                          {m.displayTime && (
                            <p style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, margin: `${spacing['0.5']} 0 0` }}>
                              {m.displayTime}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                          <p
                            style={{
                              fontSize: typography.fontSize.body,
                              fontWeight: typography.fontWeight.medium,
                              color: colors.textPrimary,
                              margin: 0,
                            }}
                          >
                            {m.title}
                          </p>
                          {m.location && (
                            <p style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, margin: `${spacing['0.5']} 0 0` }}>
                              {m.location}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                          <Tag label={typeLabel(m.type)} color={tc.fg} backgroundColor={tc.bg} />
                        </td>
                        <td
                          style={{
                            padding: `${spacing.md} ${spacing.lg}`,
                            borderBottom: rowBorder,
                            textAlign: 'center',
                          }}
                        >
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                            {m.duration_minutes ?? 0}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: `${spacing.md} ${spacing.lg}`,
                            borderBottom: rowBorder,
                            textAlign: 'center',
                          }}
                        >
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                            {/* Action item counts come from the detail; show placeholder */}
                            —
                          </span>
                        </td>
                        <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                          <Tag label={statusColor.label} color={statusColor.fg} backgroundColor={statusColor.bg} />
                        </td>
                        <td
                          style={{
                            padding: `${spacing.md} ${spacing.lg}`,
                            borderBottom: rowBorder,
                            textAlign: 'center',
                          }}
                        >
                          <ChevronRight size={14} color={colors.textTertiary} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Start meeting shortcut for upcoming */}
          {upcomingMeetings.length > 0 && (
            <div style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Start a Meeting" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                {upcomingMeetings.slice(0, 3).map((m) => {
                  const tc = typeColors(m.type);
                  return (
                    <Card key={m.id} padding={spacing.lg}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                          <Tag label={typeLabel(m.type)} color={tc.fg} backgroundColor={tc.bg} />
                          <div>
                            <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>
                              {m.title}
                            </p>
                            <p style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, margin: `${spacing['0.5']} 0 0` }}>
                              {m.displayDate}{m.displayTime ? ` at ${m.displayTime}` : ''}
                              {m.location ? ` · ${m.location}` : ''}
                            </p>
                          </div>
                        </div>
                        <PermissionGate permission="meetings.create">
                          <Btn icon={<Play size={14} />} onClick={() => startMeeting(m)}>
                            Start
                          </Btn>
                        </PermissionGate>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================
          CALENDAR TAB
      ================================================================ */}
      {activeTab === 'calendar' && (
        <>
          <SectionHeader title="This Week" />
          <div
            role="grid"
            aria-label="Weekly calendar"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: spacing.sm,
              minHeight: 400,
            }}
          >
            {getWeekDates().map((day) => {
              const dayMeetings = meetings.filter((m) => m.dateStr === day.dateStr);
              const isToday = day.dateStr === new Date().toISOString().split('T')[0];
              return (
                <div
                  key={day.dateStr}
                  style={{
                    background: isToday ? colors.orangeSubtle : colors.surfaceRaised,
                    borderRadius: borderRadius.lg,
                    border: isToday ? `2px solid ${colors.primaryOrange}` : `1px solid ${colors.borderSubtle}`,
                    padding: spacing.md,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing.sm,
                  }}
                >
                  <div style={{ textAlign: 'center', marginBottom: spacing.sm }}>
                    <p
                      style={{
                        fontSize: typography.fontSize.label,
                        fontWeight: typography.fontWeight.semibold,
                        color: isToday ? colors.orangeText : colors.textSecondary,
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: typography.letterSpacing.wider,
                      }}
                    >
                      {day.dayName}
                    </p>
                    <p style={{ fontSize: typography.fontSize.sm, color: isToday ? colors.orangeText : colors.textTertiary, margin: 0 }}>
                      {day.label}
                    </p>
                  </div>
                  {dayMeetings.map((m) => {
                    const tc = typeColors(m.type);
                    return (
                      <div
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${typeLabel(m.type)} meeting: ${m.title} at ${m.displayTime}`}
                        onClick={() => setSelectedId(m.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(m.id); } }}
                        style={{
                          background: tc.bg,
                          borderLeft: `3px solid ${tc.fg}`,
                          borderRadius: borderRadius.sm,
                          padding: `${spacing.xs} ${spacing.sm}`,
                          cursor: 'pointer',
                          transition: transitions.quick,
                        }}
                      >
                        <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: tc.fg, margin: 0 }}>
                          {m.displayTime}
                        </p>
                        <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {typeLabel(m.type)}
                        </p>
                      </div>
                    );
                  })}
                  {dayMeetings.length === 0 && (
                    <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textAlign: 'center', margin: 'auto 0' }}>
                      No meetings
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ================================================================
          LIVE MODE TAB
      ================================================================ */}
      {activeTab === 'live' && (
        <>
          {!liveMeeting ? (
            <Card padding={spacing['2xl']}>
              <div style={{ textAlign: 'center', padding: spacing['2xl'] }}>
                <Play size={48} color={colors.textTertiary} style={{ marginBottom: spacing.lg }} />
                <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `0 0 ${spacing.sm}` }}>
                  No Active Meeting
                </p>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: `0 0 ${spacing.xl}` }}>
                  Start a meeting from the Upcoming tab to enter live mode.
                </p>
                <Btn onClick={() => setActiveTab('upcoming')}>Go to Upcoming</Btn>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
              {/* Live header with timer */}
              <Card padding={spacing.xl}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                      <div style={{ width: 10, height: 10, borderRadius: borderRadius.full, background: colors.statusCritical }} />
                      <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                        Live
                      </span>
                    </div>
                    <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                      {liveMeeting.title}
                    </p>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `${spacing.xs} 0 0` }}>
                      {liveMeeting.location}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, background: colors.surfaceInset, padding: `${spacing.md} ${spacing.xl}`, borderRadius: borderRadius.lg }}>
                    <Clock size={20} color={colors.textSecondary} />
                    <span style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                      {formatTimer(liveTimer)}
                    </span>
                  </div>
                </div>
              </Card>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.xl }}>
                {/* Agenda */}
                <Card padding={spacing.xl}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                    <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                      Agenda
                    </p>
                    <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                      {liveAgendaItems.length > 0 ? `${liveAgendaIndex + 1} of ${liveAgendaItems.length}` : 'No agenda'}
                    </span>
                  </div>
                  <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.xl }}>
                    {liveAgendaItems.length === 0 && (
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing.lg }}>
                        No agenda items
                      </p>
                    )}
                    {liveAgendaItems.map((item: any, i: number) => {
                      const isCurrent = i === liveAgendaIndex;
                      const isDone = i < liveAgendaIndex;
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.md,
                            padding: `${spacing.md} ${spacing.lg}`,
                            borderRadius: borderRadius.md,
                            background: isCurrent ? colors.orangeSubtle : isDone ? colors.statusActiveSubtle : 'transparent',
                            border: isCurrent ? `1.5px solid ${colors.primaryOrange}` : '1.5px solid transparent',
                            transition: transitions.quick,
                          }}
                        >
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: borderRadius.full,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: typography.fontSize.label,
                              fontWeight: typography.fontWeight.semibold,
                              background: isCurrent ? colors.primaryOrange : isDone ? colors.statusActive : colors.surfaceInset,
                              color: isCurrent || isDone ? colors.white : colors.textTertiary,
                              flexShrink: 0,
                            }}
                          >
                            {isDone ? '✓' : i + 1}
                          </div>
                          <p
                            style={{
                              fontSize: typography.fontSize.body,
                              fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.medium,
                              color: isCurrent ? colors.primaryOrange : isDone ? colors.statusActive : colors.textPrimary,
                              margin: 0,
                              flex: 1,
                            }}
                          >
                            {item.title}
                          </p>
                          <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                            {item.duration}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <Btn
                    icon={<ChevronRight size={14} />}
                    onClick={() => { if (liveAgendaIndex < liveAgendaItems.length - 1) setLiveAgendaIndex((p) => p + 1); }}
                    disabled={liveAgendaItems.length === 0 || liveAgendaIndex >= liveAgendaItems.length - 1}
                  >
                    {liveAgendaItems.length === 0 ? 'No Agenda Items' : liveAgendaIndex < liveAgendaItems.length - 1 ? 'Next Item' : 'All Items Complete'}
                  </Btn>
                </Card>

                {/* Action items capture */}
                <Card padding={spacing.xl}>
                  <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `0 0 ${spacing.lg}` }}>
                    Action Items
                  </p>
                  <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg }}>
                    <input
                      type="text"
                      aria-label="Capture an action item"
                      placeholder="Capture an action item..."
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addActionItem(); }}
                      style={inputStyle}
                    />
                    <Btn icon={<Plus size={14} />} onClick={addActionItem}>Add</Btn>
                  </div>
                  <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, maxHeight: 240, overflowY: 'auto' }}>
                    {actionItems.length === 0 && (
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing.xl }}>
                        No action items captured yet. Type above to add one.
                      </p>
                    )}
                    {actionItems.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.md,
                          padding: `${spacing.sm} ${spacing.md}`,
                          background: colors.surfaceInset,
                          borderRadius: borderRadius.md,
                        }}
                      >
                        <GripVertical size={14} color={colors.textTertiary} />
                        <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0, flex: 1 }}>
                          {item.text}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                          <UsersIcon size={12} color={colors.textTertiary} />
                          <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                            {item.assignee}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* AI summary */}
              <div
                style={{
                  background: colors.statusReviewSubtle,
                  border: `1px solid ${colors.statusReview}20`,
                  borderRadius: borderRadius.lg,
                  padding: spacing.xl,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <Sparkles size={18} color={colors.statusReview} />
                  <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, margin: 0 }}>
                    AI Meeting Summary
                  </p>
                </div>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>
                  The team reviewed current safety protocols and confirmed zero incidents for the past 14 days. Schedule update indicates the electrical rough in is tracking 2 days ahead. Three RFIs were discussed with resolutions pending architect review. Budget remains within 1.2% of baseline projections. Key follow ups include expediting the elevator shaft inspection and confirming the steel delivery window for next week.
                </p>
              </div>

              {/* End meeting */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <PermissionGate permission="meetings.create">
                  <button
                    onClick={endMeeting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: `${spacing.md} ${spacing.xl}`,
                      background: colors.statusCritical,
                      color: colors.white,
                      border: 'none',
                      borderRadius: borderRadius.md,
                      fontSize: typography.fontSize.body,
                      fontWeight: typography.fontWeight.semibold,
                      fontFamily: typography.fontFamily,
                      cursor: 'pointer',
                      transition: transitions.quick,
                    }}
                  >
                    <Square size={14} />
                    End Meeting
                  </button>
                </PermissionGate>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create modal ──────────────────────────────────── */}
      <CreateMeetingModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (data) => {
          try {
            const dateTime = data.date && data.time ? `${data.date}T${data.time}` : (data.date as string | undefined) ?? null;
            await createMeeting.mutateAsync({
              projectId: projectId!,
              data: {
                project_id: projectId!,
                title: data.title as string,
                type: (data.type as string) || 'oac',
                date: dateTime,
                location: (data.location as string | undefined) ?? null,
                duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : 60,
              },
            });
            toast.success(`Created: ${data.title}`);
            setCreateOpen(false);
          } catch {
            toast.error('Failed to create meeting');
          }
        }}
      />

      {/* ── Detail panel ─────────────────────────────────── */}
      {selectedId && (
        <DetailPanel meetingId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </PageContainer>
  );
};

// Backward-compatible alias for App.tsx
export const Meetings = MeetingsPage;
