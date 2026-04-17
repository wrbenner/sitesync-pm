import React, { useState } from 'react';
import { Plus, Calendar, MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  PageContainer, Tag, Btn, MetricBox, Skeleton,
} from '../components/Primitives';
import { MetricCardSkeleton } from '../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useMeetings } from '../hooks/queries';
import { useProjectActionItems } from '../hooks/queries/meeting-enhancements';
import { useProjectId } from '../hooks/useProjectId';
import { PermissionGate } from '../components/auth/PermissionGate';
import CreateMeetingModal from '../components/forms/CreateMeetingModal';

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

interface MeetingListItem {
  id: string;
  title: string;
  status: string;
  type: string;
  date: string;
  location: string | null;
  attendees: Array<{ id: string; name: string }>;
}

interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  dueDate: string;
  status: string;
  meetingTitle: string;
}

// ── Skeleton loading state ────────────────────────────────────────────────────

const MeetingsSkeleton: React.FC = () => (
  <PageContainer title="Meetings">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, marginBottom: spacing['2xl'] }}>
      {[0, 1, 2, 3].map((i) => <MetricCardSkeleton key={i} />)}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ background: colors.surfaceRaised, borderRadius: borderRadius.xl, padding: spacing.xl, boxShadow: shadows.card }}>
          <Skeleton style={{ height: 20, width: '40%', marginBottom: spacing.sm }} />
          <Skeleton style={{ height: 16, width: '60%' }} />
        </div>
      ))}
    </div>
  </PageContainer>
);

// ── Meeting card ──────────────────────────────────────────────────────────────

const MeetingCard: React.FC<{ meeting: MeetingListItem }> = ({ meeting }) => {
  const tc = typeColors(meeting.type);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        background: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        boxShadow: hovered ? shadows.hover : shadows.card,
        padding: spacing.xl,
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing.lg,
        cursor: 'pointer',
        transition: transitions.quick,
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: borderRadius.lg,
          background: tc.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Calendar size={18} color={tc.fg} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            {meeting.title}
          </p>
          <Tag
            label={typeLabel(meeting.type)}
            color={tc.fg}
            backgroundColor={tc.bg}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            {meeting.date ? new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
          </span>
          {meeting.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              <MapPin size={12} />
              {meeting.location}
            </span>
          )}
        </div>
      </div>
      <Tag
        label={meeting.status === 'scheduled' ? 'Upcoming' : 'Completed'}
        color={meeting.status === 'scheduled' ? colors.statusInfo : colors.statusActive}
        backgroundColor={meeting.status === 'scheduled' ? colors.statusInfoSubtle : colors.statusActiveSubtle}
      />
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const Meetings: React.FC = () => {
  const projectId = useProjectId();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showOpenOnly, setShowOpenOnly] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: meetingsResult, isPending, error, refetch } = useMeetings(projectId);
  const { data: actionItemsData } = useProjectActionItems(projectId);
  const allMeetings = (meetingsResult?.data ?? []) as unknown as MeetingListItem[];

  if (isPending) return <MeetingsSkeleton />;

  if (error) {
    return (
      <PageContainer title="Meetings">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: spacing.lg, textAlign: 'center' }}>
          <AlertTriangle size={48} color={colors.statusDanger} />
          <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            Failed to load meetings
          </p>
          <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0 }}>
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Btn variant="secondary" icon={<RefreshCw size={14} />} onClick={() => refetch()}>
            Retry
          </Btn>
        </div>
      </PageContainer>
    );
  }

  const upcomingMeetings = allMeetings.filter((m) => m.status === 'scheduled');
  const pastMeetings = allMeetings.filter((m) => m.status === 'completed');
  const displayedMeetings = activeTab === 'upcoming' ? upcomingMeetings : pastMeetings;

  const allActionItems: ActionItem[] = (actionItemsData ?? []).map((ai) => {
    const aiRow = ai as unknown as {
      id: string;
      description: string;
      assigned_to: string | null;
      due_date: string | null;
      status: string;
      meetings: { title?: string } | { title?: string }[] | null;
    };
    const meetingRef = Array.isArray(aiRow.meetings) ? aiRow.meetings[0] : aiRow.meetings;
    return {
      id: aiRow.id,
      description: aiRow.description,
      assignee: aiRow.assigned_to ?? 'Unassigned',
      dueDate: aiRow.due_date ?? '',
      status: aiRow.status,
      meetingTitle: meetingRef?.title ?? '',
    };
  });
  const openActionItemsCount = allActionItems.filter((ai) => ai.status === 'open').length;
  const meetingsThisWeek = upcomingMeetings.length;
  const totalAttendees = allMeetings.reduce((sum, m) => sum + (m.attendees?.length ?? 0), 0);
  const avgAttendance = allMeetings.length > 0 ? Math.round(totalAttendees / allMeetings.length) : 0;
  const avgAttendanceRate = Math.round((avgAttendance / 10) * 100);

  const filteredActionItems = showOpenOnly
    ? allActionItems.filter((ai) => ai.status === 'open')
    : allActionItems;

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
        <PermissionGate permission="meetings.create">
          <Btn icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
            Schedule Meeting
          </Btn>
        </PermissionGate>
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
            <PermissionGate permission="meetings.create">
              <Btn icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
                Schedule Meeting
              </Btn>
            </PermissionGate>
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

      {showCreateModal && projectId && (
        <CreateMeetingModal onClose={() => setShowCreateModal(false)} projectId={projectId} />
      )}
    </PageContainer>
  );
};
