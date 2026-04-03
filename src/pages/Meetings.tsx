import React, { useState } from 'react';
import { Plus, Calendar, MapPin } from 'lucide-react';
import {
  PageContainer, Card, Tag, Btn, MetricBox,
} from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';

// ── Type helpers ──────────────────────────────────────────────────────────────

const MEETING_TYPE_LABELS: Record<string, string> = {
  oac: 'OAC',
  safety: 'Safety',
  subcontractor: 'Subcontractor',
  internal: 'Internal',
  coordination: 'Coordination',
};

const MEETING_TYPE_COLORS: Record<string, { fg: string; bg: string }> = {
  oac: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  safety: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  subcontractor: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  internal: { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  coordination: { fg: colors.statusReview, bg: colors.statusReviewSubtle },
};

function typeLabel(type: string): string {
  return MEETING_TYPE_LABELS[type] ?? 'Meeting';
}

function typeColors(type: string): { fg: string; bg: string } {
  return MEETING_TYPE_COLORS[type] ?? { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle };
}

// ── Mock data ─────────────────────────────────────────────────────────────────

interface MockAttendee {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface MockMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  location: string;
  attendees: MockAttendee[];
  actionItemsOpen: number;
  actionItemsTotal: number;
  status: 'scheduled' | 'completed';
}

interface MockActionItem {
  id: string;
  description: string;
  assignee: string;
  dueDate: string;
  status: 'open' | 'completed';
  meetingTitle: string;
}

const MOCK_ATTENDEES: Record<string, MockAttendee[]> = {
  oac8: [
    { id: 'a1', name: 'Marcus Chen', initials: 'MC', color: '#3B82F6' },
    { id: 'a2', name: 'Sarah Novak', initials: 'SN', color: '#8B5CF6' },
    { id: 'a3', name: 'James Ortiz', initials: 'JO', color: '#F47820' },
    { id: 'a4', name: 'Priya Kapoor', initials: 'PK', color: '#10B981' },
    { id: 'a5', name: 'Derek Walls', initials: 'DW', color: '#EF4444' },
    { id: 'a6', name: 'Amy Sutton', initials: 'AS', color: '#06B6D4' },
    { id: 'a7', name: 'Tom Brennan', initials: 'TB', color: '#F59E0B' },
    { id: 'a8', name: 'Lena Morrow', initials: 'LM', color: '#84CC16' },
  ],
  safety12: [
    { id: 'b1', name: 'Marcus Chen', initials: 'MC', color: '#3B82F6' },
    { id: 'b2', name: 'James Ortiz', initials: 'JO', color: '#F47820' },
    { id: 'b3', name: 'Derek Walls', initials: 'DW', color: '#EF4444' },
    { id: 'b4', name: 'Tom Brennan', initials: 'TB', color: '#F59E0B' },
    { id: 'b5', name: 'Lena Morrow', initials: 'LM', color: '#84CC16' },
    { id: 'b6', name: 'Carlos Rivera', initials: 'CR', color: '#7C3AED' },
    { id: 'b7', name: 'Dana Pierce', initials: 'DP', color: '#DB2777' },
    { id: 'b8', name: 'Ed Navarro', initials: 'EN', color: '#0891B2' },
    { id: 'b9', name: 'Fran Okafor', initials: 'FO', color: '#65A30D' },
    { id: 'b10', name: 'Grace Kim', initials: 'GK', color: '#DC2626' },
    { id: 'b11', name: 'Hal Stone', initials: 'HS', color: '#D97706' },
    { id: 'b12', name: 'Iris Park', initials: 'IP', color: '#059669' },
  ],
  mep6: [
    { id: 'c1', name: 'Sarah Novak', initials: 'SN', color: '#8B5CF6' },
    { id: 'c2', name: 'Priya Kapoor', initials: 'PK', color: '#10B981' },
    { id: 'c3', name: 'Carlos Rivera', initials: 'CR', color: '#7C3AED' },
    { id: 'c4', name: 'Dana Pierce', initials: 'DP', color: '#DB2777' },
    { id: 'c5', name: 'Ed Navarro', initials: 'EN', color: '#0891B2' },
    { id: 'c6', name: 'Amy Sutton', initials: 'AS', color: '#06B6D4' },
  ],
  internal4: [
    { id: 'd1', name: 'Marcus Chen', initials: 'MC', color: '#3B82F6' },
    { id: 'd2', name: 'Sarah Novak', initials: 'SN', color: '#8B5CF6' },
    { id: 'd3', name: 'Tom Brennan', initials: 'TB', color: '#F59E0B' },
    { id: 'd4', name: 'Lena Morrow', initials: 'LM', color: '#84CC16' },
  ],
  past1_5: [
    { id: 'e1', name: 'Marcus Chen', initials: 'MC', color: '#3B82F6' },
    { id: 'e2', name: 'Sarah Novak', initials: 'SN', color: '#8B5CF6' },
    { id: 'e3', name: 'James Ortiz', initials: 'JO', color: '#F47820' },
    { id: 'e4', name: 'Priya Kapoor', initials: 'PK', color: '#10B981' },
    { id: 'e5', name: 'Derek Walls', initials: 'DW', color: '#EF4444' },
  ],
  past2_10: [
    { id: 'f1', name: 'Marcus Chen', initials: 'MC', color: '#3B82F6' },
    { id: 'f2', name: 'James Ortiz', initials: 'JO', color: '#F47820' },
    { id: 'f3', name: 'Derek Walls', initials: 'DW', color: '#EF4444' },
    { id: 'f4', name: 'Tom Brennan', initials: 'TB', color: '#F59E0B' },
    { id: 'f5', name: 'Lena Morrow', initials: 'LM', color: '#84CC16' },
    { id: 'f6', name: 'Carlos Rivera', initials: 'CR', color: '#7C3AED' },
    { id: 'f7', name: 'Dana Pierce', initials: 'DP', color: '#DB2777' },
    { id: 'f8', name: 'Ed Navarro', initials: 'EN', color: '#0891B2' },
    { id: 'f9', name: 'Fran Okafor', initials: 'FO', color: '#65A30D' },
    { id: 'f10', name: 'Grace Kim', initials: 'GK', color: '#DC2626' },
  ],
  past3_7: [
    { id: 'g1', name: 'Sarah Novak', initials: 'SN', color: '#8B5CF6' },
    { id: 'g2', name: 'Priya Kapoor', initials: 'PK', color: '#10B981' },
    { id: 'g3', name: 'Carlos Rivera', initials: 'CR', color: '#7C3AED' },
    { id: 'g4', name: 'Dana Pierce', initials: 'DP', color: '#DB2777' },
    { id: 'g5', name: 'Ed Navarro', initials: 'EN', color: '#0891B2' },
    { id: 'g6', name: 'Amy Sutton', initials: 'AS', color: '#06B6D4' },
    { id: 'g7', name: 'Tom Brennan', initials: 'TB', color: '#F59E0B' },
  ],
};

const MOCK_MEETINGS: MockMeeting[] = [
  {
    id: 'm1',
    title: 'Weekly OAC Meeting #12',
    date: 'Apr 7, 2026',
    time: '10:00 AM',
    type: 'oac',
    location: 'Conference Room A, Level 3',
    attendees: MOCK_ATTENDEES.oac8,
    actionItemsOpen: 3,
    actionItemsTotal: 5,
    status: 'scheduled',
  },
  {
    id: 'm2',
    title: 'Daily Safety Standup',
    date: 'Apr 4, 2026',
    time: '7:00 AM',
    type: 'safety',
    location: 'Jobsite Trailer',
    attendees: MOCK_ATTENDEES.safety12,
    actionItemsOpen: 1,
    actionItemsTotal: 1,
    status: 'scheduled',
  },
  {
    id: 'm3',
    title: 'MEP Coordination Meeting',
    date: 'Apr 8, 2026',
    time: '2:00 PM',
    type: 'subcontractor',
    location: 'Zoom',
    attendees: MOCK_ATTENDEES.mep6,
    actionItemsOpen: 4,
    actionItemsTotal: 7,
    status: 'scheduled',
  },
  {
    id: 'm4',
    title: 'Internal PM Sync',
    date: 'Apr 5, 2026',
    time: '9:00 AM',
    type: 'internal',
    location: 'Office',
    attendees: MOCK_ATTENDEES.internal4,
    actionItemsOpen: 2,
    actionItemsTotal: 3,
    status: 'scheduled',
  },
  {
    id: 'm5',
    title: 'Weekly OAC Meeting #11',
    date: 'Mar 31, 2026',
    time: '10:00 AM',
    type: 'oac',
    location: 'Conference Room A, Level 3',
    attendees: MOCK_ATTENDEES.past1_5,
    actionItemsOpen: 0,
    actionItemsTotal: 4,
    status: 'completed',
  },
  {
    id: 'm6',
    title: 'Weekly Safety Standup',
    date: 'Mar 28, 2026',
    time: '7:00 AM',
    type: 'safety',
    location: 'Jobsite Trailer',
    attendees: MOCK_ATTENDEES.past2_10,
    actionItemsOpen: 0,
    actionItemsTotal: 2,
    status: 'completed',
  },
  {
    id: 'm7',
    title: 'Structural Steel Coordination',
    date: 'Mar 27, 2026',
    time: '1:00 PM',
    type: 'subcontractor',
    location: 'Zoom',
    attendees: MOCK_ATTENDEES.past3_7,
    actionItemsOpen: 0,
    actionItemsTotal: 6,
    status: 'completed',
  },
];

const MOCK_ACTION_ITEMS: MockActionItem[] = [
  {
    id: 'ai1',
    description: 'Submit revised RFI log to owner by end of week',
    assignee: 'Marcus Chen',
    dueDate: 'Apr 4, 2026',
    status: 'open',
    meetingTitle: 'Weekly OAC Meeting #12',
  },
  {
    id: 'ai2',
    description: 'Confirm concrete pour schedule with structural engineer',
    assignee: 'James Ortiz',
    dueDate: 'Apr 5, 2026',
    status: 'open',
    meetingTitle: 'Weekly OAC Meeting #12',
  },
  {
    id: 'ai3',
    description: 'Update safety signage at north stairwell entry',
    assignee: 'Derek Walls',
    dueDate: 'Apr 4, 2026',
    status: 'open',
    meetingTitle: 'Daily Safety Standup',
  },
  {
    id: 'ai4',
    description: 'Resolve ductwork routing conflict on Level 4 mechanical room',
    assignee: 'Carlos Rivera',
    dueDate: 'Apr 7, 2026',
    status: 'open',
    meetingTitle: 'MEP Coordination Meeting',
  },
  {
    id: 'ai5',
    description: 'Coordinate plumbing rough-in inspection with city inspector',
    assignee: 'Ed Navarro',
    dueDate: 'Apr 8, 2026',
    status: 'open',
    meetingTitle: 'MEP Coordination Meeting',
  },
  {
    id: 'ai6',
    description: 'Send updated draw schedule to owner rep',
    assignee: 'Sarah Novak',
    dueDate: 'Apr 9, 2026',
    status: 'open',
    meetingTitle: 'MEP Coordination Meeting',
  },
  {
    id: 'ai7',
    description: 'Review punch list from last OAC and close out items',
    assignee: 'Priya Kapoor',
    dueDate: 'Apr 6, 2026',
    status: 'open',
    meetingTitle: 'MEP Coordination Meeting',
  },
  {
    id: 'ai8',
    description: 'Finalize subcontractor schedule for May closeout',
    assignee: 'Tom Brennan',
    dueDate: 'Apr 5, 2026',
    status: 'open',
    meetingTitle: 'Internal PM Sync',
  },
  {
    id: 'ai9',
    description: 'Close out window glazing submittal with architect',
    assignee: 'Lena Morrow',
    dueDate: 'Apr 6, 2026',
    status: 'open',
    meetingTitle: 'Internal PM Sync',
  },
];

// ── Avatar stack ──────────────────────────────────────────────────────────────

function AvatarStack({ attendees }: { attendees: MockAttendee[] }) {
  const maxVisible = 4;
  const visible = attendees.slice(0, maxVisible);
  const overflow = attendees.length - maxVisible;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((a, i) => (
        <div
          key={a.id}
          title={a.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: borderRadius.full,
            background: a.color,
            border: `2px solid ${colors.surfaceRaised}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            color: colors.white,
            marginLeft: i === 0 ? 0 : -8,
            flexShrink: 0,
            zIndex: maxVisible - i,
            position: 'relative',
          }}
        >
          {a.initials}
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: borderRadius.full,
            background: colors.surfaceInset,
            border: `2px solid ${colors.surfaceRaised}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textSecondary,
            marginLeft: -8,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ── Meeting card ──────────────────────────────────────────────────────────────

function MeetingCard({ meeting }: { meeting: MockMeeting }) {
  const [hovered, setHovered] = useState(false);
  const tc = typeColors(meeting.type);
  const allDone = meeting.actionItemsOpen === 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        boxShadow: hovered ? shadows.cardHover : shadows.card,
        border: `1px solid ${hovered ? colors.borderDefault : colors.borderSubtle}`,
        cursor: 'pointer',
        transition: transitions.quick,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
      }}
    >
      {/* Top row: title + type badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              lineHeight: typography.lineHeight.snug,
            }}
          >
            {meeting.title}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              marginTop: spacing.xs,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>
              {meeting.date}
            </span>
            <span style={{ color: colors.borderDefault, fontSize: typography.fontSize.sm }}>·</span>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              {meeting.time}
            </span>
            {meeting.location && (
              <>
                <span style={{ color: colors.borderDefault, fontSize: typography.fontSize.sm }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  <MapPin size={11} />
                  {meeting.location}
                </span>
              </>
            )}
          </div>
        </div>
        <Tag label={typeLabel(meeting.type)} color={tc.fg} backgroundColor={tc.bg} />
      </div>

      {/* Bottom row: avatars + action items */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AvatarStack attendees={meeting.attendees} />
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: allDone ? colors.statusActive : (meeting.actionItemsOpen > 2 ? colors.statusPending : colors.textSecondary),
            }}
          >
            {meeting.actionItemsOpen}/{meeting.actionItemsTotal}
          </span>
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>action items open</span>
        </div>
      </div>
    </div>
  );
}

// ── MeetingsPage ──────────────────────────────────────────────────────────────

export const MeetingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showOpenOnly, setShowOpenOnly] = useState(true);

  const upcomingMeetings = MOCK_MEETINGS.filter((m) => m.status === 'scheduled');
  const pastMeetings = MOCK_MEETINGS.filter((m) => m.status === 'completed');
  const displayedMeetings = activeTab === 'upcoming' ? upcomingMeetings : pastMeetings;

  // Metrics
  const openActionItemsCount = MOCK_ACTION_ITEMS.filter((ai) => ai.status === 'open').length;
  const meetingsThisWeek = upcomingMeetings.filter(() => true).length; // all upcoming are this week in mock
  const totalAttendees = MOCK_MEETINGS.reduce((sum, m) => sum + m.attendees.length, 0);
  const avgAttendance = Math.round((totalAttendees / MOCK_MEETINGS.length));
  const avgAttendanceRate = Math.round((avgAttendance / 10) * 100); // normalized to a plausible rate

  const filteredActionItems = showOpenOnly
    ? MOCK_ACTION_ITEMS.filter((ai) => ai.status === 'open')
    : MOCK_ACTION_ITEMS;

  const TABS = [
    { key: 'upcoming' as const, label: 'Upcoming' },
    { key: 'past' as const, label: 'Past' },
  ];

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: spacing.xs,
    background: colors.surfaceInset,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
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

  const thStyle: React.CSSProperties = {
    padding: `${spacing.sm} ${spacing.lg}`,
    textAlign: 'left' as const,
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: typography.letterSpacing.wider,
    whiteSpace: 'nowrap' as const,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    background: colors.surfaceInset,
  };

  return (
    <PageContainer
      title="Meetings"
      actions={
        <Btn icon={<Plus size={14} />} onClick={() => {}}>
          Schedule Meeting
        </Btn>
      }
    >
      {/* Metric cards */}
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
          colorOverride={openActionItemsCount > 5 ? 'warning' : undefined}
        />
        <MetricBox label="Meetings This Week" value={meetingsThisWeek} />
        <MetricBox label="Avg Attendance Rate" value={`${avgAttendanceRate}%`} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
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
      </div>

      {/* Meeting list */}
      {displayedMeetings.length === 0 ? (
        <div
          style={{
            background: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            boxShadow: shadows.card,
            padding: spacing['2xl'],
          }}
        >
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
            <Btn icon={<Plus size={14} />} onClick={() => {}}>
              Schedule Meeting
            </Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {displayedMeetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}

      {/* Action items section */}
      <div style={{ marginTop: spacing['2xl'] }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.lg,
          }}
        >
          <div>
            <p
              style={{
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                margin: 0,
              }}
            >
              Action Items
            </p>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `${spacing.xs} 0 0` }}>
              Tracked across all meetings
            </p>
          </div>
          <button
            onClick={() => setShowOpenOnly((v) => !v)}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              background: showOpenOnly ? colors.primaryOrange : colors.surfaceRaised,
              color: showOpenOnly ? colors.white : colors.textSecondary,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              transition: transitions.quick,
            }}
          >
            {showOpenOnly ? 'Showing Open Only' : 'Show All'}
          </button>
        </div>

        <div
          style={{
            background: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            boxShadow: shadows.card,
            overflow: 'hidden',
          }}
        >
          {filteredActionItems.length === 0 ? (
            <div style={{ padding: spacing['2xl'], textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0 }}>
                No open action items. All caught up.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Assignee</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Source Meeting</th>
                </tr>
              </thead>
              <tbody>
                {filteredActionItems.map((item, idx) => {
                  const isLast = idx === filteredActionItems.length - 1;
                  const rowBorder = isLast ? 'none' : `1px solid ${colors.borderSubtle}`;
                  return (
                    <tr
                      key={item.id}
                      style={{ transition: transitions.quick }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = colors.surfaceHover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                    >
                      <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder, maxWidth: 320 }}>
                        <p
                          style={{
                            fontSize: typography.fontSize.sm,
                            color: colors.textPrimary,
                            margin: 0,
                            lineHeight: typography.lineHeight.normal,
                          }}
                        >
                          {item.description}
                        </p>
                      </td>
                      <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder, whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                          {item.assignee}
                        </span>
                      </td>
                      <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder, whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                          {item.dueDate}
                        </span>
                      </td>
                      <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                        <Tag
                          label={item.status === 'open' ? 'Open' : 'Completed'}
                          color={item.status === 'open' ? colors.statusPending : colors.statusActive}
                          backgroundColor={item.status === 'open' ? colors.statusPendingSubtle : colors.statusActiveSubtle}
                        />
                      </td>
                      <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                        <span
                          style={{
                            fontSize: typography.fontSize.sm,
                            color: colors.textTertiary,
                            fontStyle: 'italic',
                          }}
                        >
                          {item.meetingTitle}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default MeetingsPage;
