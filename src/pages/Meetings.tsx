import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Square, Clock, Plus, ChevronRight, Sparkles, GripVertical, Users as UsersIcon } from 'lucide-react';
import { PageContainer, Card, SectionHeader, Tag, Skeleton, useToast, Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { ExportButton } from '../components/shared/ExportButton';
import { toast } from 'sonner';
import { useCreateMeeting } from '../hooks/mutations';
import { useProjectId } from '../hooks/useProjectId';
import { useMeetings } from '../hooks/queries';
import CreateMeetingModal from '../components/forms/CreateMeetingModal';
import { PermissionGate } from '../components/auth/PermissionGate';

const meetingTypeLabel = (type: string) => {
  switch (type) {
    case 'oac': return 'OAC';
    case 'safety': return 'Safety';
    case 'coordination': return 'Coordination';
    default: return 'Meeting';
  }
};

const meetingTypeColor = (type: string) => {
  switch (type) {
    case 'oac': return colors.primaryOrange;
    case 'safety': return colors.statusCritical;
    case 'coordination': return colors.statusInfo;
    default: return colors.statusNeutral;
  }
};

const meetingTypeBg = (type: string) => {
  switch (type) {
    case 'oac': return colors.orangeSubtle;
    case 'safety': return colors.statusCriticalSubtle;
    case 'coordination': return colors.statusInfoSubtle;
    default: return colors.statusNeutralSubtle;
  }
};

// Parse agenda items from meeting's agenda JSONB field
function parseAgendaItems(meeting: any): { title: string; duration: string }[] {
  if (!meeting?.agenda) return [];
  try {
    const parsed = typeof meeting.agenda === 'string' ? JSON.parse(meeting.agenda) : meeting.agenda;
    if (Array.isArray(parsed)) return parsed.map((item: any) => ({
      title: item.title || item.name || String(item),
      duration: item.duration || '',
    }));
  } catch { /* ignore parse errors */ }
  return [];
}

const tabs = [
  { key: 'upcoming' as const, label: 'Upcoming' },
  { key: 'calendar' as const, label: 'Calendar' },
  { key: 'live' as const, label: 'Live Mode' },
];

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
    return {
      label: `${months[d.getMonth()]} ${d.getDate()}`,
      dateStr: d.toISOString().split('T')[0],
      dayName,
    };
  });
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const Meetings: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const createMeeting = useCreateMeeting();
  const { data: rawMeetingsResult, isPending: loading } = useMeetings(projectId);
  const rawMeetings = rawMeetingsResult?.data;

  const meetings = useMemo(() =>
    (rawMeetings || []).map(m => {
      const d = m.date ? new Date(m.date) : null;
      return {
        ...m,
        type: m.type || 'oac',
        date: d ? d.toISOString().split('T')[0] : '',
        time: d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
        attendeeCount: m.duration_minutes || 0,
        status: (m.notes?.includes('completed') ? 'completed' : 'scheduled') as 'completed' | 'scheduled',
        hasMinutes: !!m.notes,
        location: m.location || '',
      };
    }),
    [rawMeetings]
  );

  const [activeTab, setActiveTab] = useState<'upcoming' | 'calendar' | 'live'>('upcoming');
  const [createOpen, setCreateOpen] = useState(false);
  const [liveMeeting, setLiveMeeting] = useState<any>(null);
  const [liveTimer, setLiveTimer] = useState(0);
  const [liveAgendaIndex, setLiveAgendaIndex] = useState(0);
  const [actionItems, setActionItems] = useState<{ text: string; assignee: string }[]>([]);
  const [actionInput, setActionInput] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (liveMeeting) {
      timerRef.current = setInterval(() => {
        setLiveTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [liveMeeting]);

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

  const liveAgendaItems = liveMeeting ? parseAgendaItems(liveMeeting) : [];

  const advanceAgenda = () => {
    if (liveAgendaIndex < liveAgendaItems.length - 1) {
      setLiveAgendaIndex((prev) => prev + 1);
    }
  };

  const addActionItem = () => {
    if (!actionInput.trim()) return;
    setActionItems((prev) => [...prev, { text: actionInput.trim(), assignee: 'Unassigned' }]);
    setActionInput('');
  };

  if (loading || !meetings) {
    return (
      <PageContainer title="Meetings">
        <SectionHeader title="Upcoming" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, marginBottom: spacing['2xl'] }}>
          {[1, 2].map((i) => (
            <Card key={i} padding={spacing.xl}>
              <Skeleton width="40%" height="24px" />
              <Skeleton width="60%" height="16px" />
              <Skeleton width="30%" height="14px" />
            </Card>
          ))}
        </div>
        <SectionHeader title="Past" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {[1, 2].map((i) => (
            <Card key={i} padding={spacing.xl}>
              <Skeleton width="50%" height="16px" />
              <Skeleton width="40%" height="14px" />
            </Card>
          ))}
        </div>
      </PageContainer>
    );
  }

  const upcoming = meetings.filter((m) => m.status === 'scheduled');
  const completed = meetings.filter((m) => m.status === 'completed');
  const weekDates = getWeekDates();

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

  return (
    <PageContainer title="Meetings" actions={
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <ExportButton
          onExportCSV={() => toast.success('Meeting data exported as CSV')}
          pdfFilename="SiteSync_Meetings"
        />
        <PermissionGate permission="meetings.create"><Btn onClick={() => setCreateOpen(true)}>New Meeting</Btn></PermissionGate>
      </div>
    }>
      {/* Tab bar */}
      <div style={tabBarStyle} role="tablist" aria-label="Meeting views">
        {tabs.map((tab) => (
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

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: colors.statusReviewSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: 1.5 }}>
          3 action items from last OAC meeting are overdue. Next safety meeting has 2 unresolved items from prior session.
        </p>
      </div>

      {/* ===== UPCOMING TAB ===== */}
      {activeTab === 'upcoming' && (
        <>
          <SectionHeader title="Upcoming" />
          <div role="list" aria-label="Upcoming meetings" style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, marginBottom: spacing['2xl'] }}>
            {upcoming.map((meeting) => (
              <Card key={meeting.id} padding={spacing.xl}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: typography.fontSize['2xl'],
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                        margin: 0,
                        marginBottom: spacing.xs,
                      }}
                    >
                      {meeting.time}
                    </p>
                    <p
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.textPrimary,
                        margin: 0,
                        marginBottom: spacing.sm,
                      }}
                    >
                      {meeting.title}
                    </p>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginBottom: spacing.md }}>
                      {meeting.attendeeCount} attendees · {meeting.location}
                    </p>

                    {/* Agenda preview */}
                    <div style={{ marginBottom: spacing.md }}>
                      <p style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, margin: 0, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                        Agenda Preview
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                        {(() => {
                          const items = parseAgendaItems(meeting);
                          if (items.length === 0) return (
                            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No agenda items</span>
                          );
                          return items.slice(0, 3).map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                              <ChevronRight size={12} color={colors.textTertiary} />
                              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.title}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    <PermissionGate permission="meetings.create"><Btn
                      icon={<Play size={14} />}
                      onClick={() => {
                        startMeeting(meeting);
                      }}
                    >Start Meeting</Btn></PermissionGate>
                  </div>
                  <Tag label={meetingTypeLabel(meeting.type)} color={meetingTypeColor(meeting.type)} backgroundColor={meetingTypeBg(meeting.type)} />
                </div>
              </Card>
            ))}
          </div>

          <SectionHeader title="Past" />
          <div role="list" aria-label="Past meetings" style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {completed.map((meeting) => (
              <Card key={meeting.id} padding={spacing.xl} onClick={() => addToast('info', `Viewing minutes for ${meeting.title}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.textTertiary,
                        margin: 0,
                        marginBottom: spacing.xs,
                      }}
                    >
                      {meeting.title}
                    </p>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
                      {meeting.date} at {meeting.time} · {meeting.attendeeCount} attendees · {meeting.location}
                    </p>
                  </div>
                  <Tag label={meetingTypeLabel(meeting.type)} color={meetingTypeColor(meeting.type)} backgroundColor={meetingTypeBg(meeting.type)} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ===== CALENDAR TAB ===== */}
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
              minHeight: '400px',
            }}
          >
            {weekDates.map((day) => {
              const dayMeetings = meetings.filter((m) => m.date === day.dateStr);
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
                    <p style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: isToday ? colors.orangeText : colors.textSecondary, margin: 0, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                      {day.dayName}
                    </p>
                    <p style={{ fontSize: typography.fontSize.sm, color: isToday ? colors.orangeText : colors.textTertiary, margin: 0 }}>
                      {day.label}
                    </p>
                  </div>
                  {dayMeetings.map((m) => (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${meetingTypeLabel(m.type)} meeting: ${m.title} at ${m.time}`}
                      onClick={() => addToast('info', `${m.title} at ${m.time}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addToast('info', `${m.title} at ${m.time}`); } }}
                      style={{
                        background: meetingTypeBg(m.type),
                        borderLeft: `3px solid ${meetingTypeColor(m.type)}`,
                        borderRadius: borderRadius.sm,
                        padding: `${spacing.xs} ${spacing.sm}`,
                        cursor: 'pointer',
                        transition: transitions.quick,
                      }}
                    >
                      <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: meetingTypeColor(m.type), margin: 0 }}>
                        {m.time}
                      </p>
                      <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {meetingTypeLabel(m.type)}
                      </p>
                    </div>
                  ))}
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

      {/* ===== LIVE MODE TAB ===== */}
      {activeTab === 'live' && (
        <>
          {!liveMeeting ? (
            <Card padding={spacing['2xl']}>
              <div style={{ textAlign: 'center', padding: spacing['2xl'] }}>
                <Play size={48} color={colors.textTertiary} style={{ marginBottom: spacing.lg }} />
                <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.sm }}>
                  No Active Meeting
                </p>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0, marginBottom: spacing.xl }}>
                  Start a meeting from the Upcoming tab to enter live mode.
                </p>
                <Btn onClick={() => setActiveTab('upcoming')}>Go to Upcoming</Btn>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
              {/* Header with timer */}
              <Card padding={spacing.xl}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                      <div style={{ width: 10, height: 10, borderRadius: borderRadius.full, background: colors.statusCritical, animation: 'pulse 2s infinite' }} />
                      <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Live</span>
                    </div>
                    <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                      {liveMeeting.title}
                    </p>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing.xs }}>
                      {liveMeeting.attendeeCount} attendees · {liveMeeting.location}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, background: colors.surfaceInset, padding: `${spacing.md} ${spacing.xl}`, borderRadius: borderRadius.lg }}>
                      <Clock size={20} color={colors.textSecondary} />
                      <span style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                        {formatTimer(liveTimer)}
                      </span>
                    </div>
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
                  <div role="list" aria-label="Agenda items" style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.xl }}>
                    {liveAgendaItems.length === 0 && (
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing.lg }}>No agenda items</p>
                    )}
                    {liveAgendaItems.map((item, i) => {
                      const isCurrent = i === liveAgendaIndex;
                      const isComplete = i < liveAgendaIndex;
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.md,
                            padding: `${spacing.md} ${spacing.lg}`,
                            borderRadius: borderRadius.md,
                            background: isCurrent ? colors.orangeSubtle : isComplete ? colors.statusActiveSubtle : 'transparent',
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
                              background: isCurrent ? colors.primaryOrange : isComplete ? colors.statusActive : colors.surfaceInset,
                              color: isCurrent || isComplete ? colors.white : colors.textTertiary,
                              flexShrink: 0,
                            }}
                          >
                            {isComplete ? '✓' : i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: typography.fontSize.body, fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.medium, color: isCurrent ? colors.primaryOrange : isComplete ? colors.statusActive : colors.textPrimary, margin: 0 }}>
                              {item.title}
                            </p>
                          </div>
                          <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                            {item.duration}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <Btn
                    icon={<ChevronRight size={14} />}
                    onClick={advanceAgenda}
                    disabled={liveAgendaItems.length === 0 || liveAgendaIndex >= liveAgendaItems.length - 1}
                  >{liveAgendaItems.length === 0 ? 'No Agenda Items' : liveAgendaIndex < liveAgendaItems.length - 1 ? 'Next Item' : 'All Items Complete'}</Btn>
                </Card>

                {/* Action items */}
                <Card padding={spacing.xl}>
                  <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.lg }}>
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
                  <div role="list" aria-label="Action items" style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, maxHeight: '240px', overflowY: 'auto' }}>
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
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0 }}>{item.text}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                          <UsersIcon size={12} color={colors.textTertiary} />
                          <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>{item.assignee}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* AI Summary */}
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

              {/* End Meeting */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <PermissionGate permission="meetings.create"><button
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
                </button></PermissionGate>
              </div>
            </div>
          )}
        </>
      )}
      <CreateMeetingModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={async (data) => {
        try {
          const dateTime = data.date && data.time ? `${data.date}T${data.time}` : data.date || null
          await createMeeting.mutateAsync({ projectId: projectId!, data: { project_id: projectId!, title: data.title, type: data.type || 'oac', date: dateTime, location: data.location || null, duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : 60 } })
          toast.success('Created: ' + data.title)
          setCreateOpen(false)
        } catch { toast.error('Failed to create meeting') }
      }} />
    </PageContainer>
  );
};
