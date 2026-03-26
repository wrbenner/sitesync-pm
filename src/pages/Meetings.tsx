import React from 'react';
import { Calendar, Users, FileText, AlertTriangle, Zap } from 'lucide-react';
import { Card, SectionHeader } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { meetings } from '../data/mockData';

const getMeetingTypeIcon = (type: string) => {
  switch (type) {
    case 'oac':
      return { icon: Calendar, color: colors.blue, label: 'OAC' };
    case 'safety':
      return { icon: AlertTriangle, color: colors.red, label: 'Safety' };
    case 'coordination':
      return { icon: Zap, color: colors.tealSuccess, label: 'Coordination' };
    default:
      return { icon: Calendar, color: colors.blue, label: 'Meeting' };
  }
};

export const Meetings: React.FC = () => {
  const upcomingMeetings = meetings.filter((m) => m.status === 'scheduled');
  const completedMeetings = meetings.filter((m) => m.status === 'completed');

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.lightBackground,
        padding: spacing.xl,
        marginLeft: '260px',
      }}
    >
      <SectionHeader title="Meetings" />

      {/* Upcoming Meetings */}
      <div style={{ marginBottom: spacing.xl }}>
        <h2
          style={{
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.lg,
          }}
        >
          Upcoming
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          {upcomingMeetings.map((meeting) => {
            const typeInfo = getMeetingTypeIcon(meeting.type);
            const IconComponent = typeInfo.icon;

            return (
              <Card key={meeting.id} padding={spacing.lg}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.lg }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: borderRadius.md,
                      backgroundColor: typeInfo.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.white,
                      flexShrink: 0,
                    }}
                  >
                    <IconComponent size={24} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        fontSize: typography.fontSize.lg,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                        margin: 0,
                        marginBottom: spacing.sm,
                      }}
                    >
                      {meeting.title}
                    </h3>

                    <div
                      style={{
                        display: 'flex',
                        gap: spacing.lg,
                        flexWrap: 'wrap',
                        marginBottom: spacing.md,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                        <Calendar size={14} color={colors.textSecondary} />
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                          {meeting.date} at {meeting.time}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                        <Users size={14} color={colors.textSecondary} />
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                          {meeting.attendeeCount} attendees
                        </span>
                      </div>
                    </div>

                    <p
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        margin: 0,
                        marginBottom: spacing.md,
                      }}
                    >
                      {meeting.location}
                    </p>

                    <button
                      style={{
                        backgroundColor: 'transparent',
                        border: `1px solid ${colors.border}`,
                        color: colors.textPrimary,
                        padding: `${spacing.sm} ${spacing.md}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: typography.fontSize.sm,
                        fontFamily: typography.fontFamily,
                        fontWeight: typography.fontWeight.medium,
                      }}
                    >
                      View Details
                    </button>
                  </div>

                  <span
                    style={{
                      fontSize: typography.fontSize.xs,
                      backgroundColor: colors.amber,
                      color: colors.white,
                      padding: `${spacing.xs} ${spacing.sm}`,
                      borderRadius: '12px',
                      fontWeight: typography.fontWeight.semibold,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Scheduled
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Completed Meetings */}
      {completedMeetings.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              marginBottom: spacing.lg,
            }}
          >
            Completed
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            {completedMeetings.map((meeting) => {
              const typeInfo = getMeetingTypeIcon(meeting.type);
              const IconComponent = typeInfo.icon;

              return (
                <Card key={meeting.id} padding={spacing.lg}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.lg }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: borderRadius.md,
                        backgroundColor: colors.lightBackground,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: typeInfo.color,
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={24} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: typography.fontSize.lg,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                          margin: 0,
                          marginBottom: spacing.sm,
                        }}
                      >
                        {meeting.title}
                      </h3>

                      <div style={{ display: 'flex', gap: spacing.lg, marginBottom: spacing.md }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                          {meeting.date}
                        </span>
                      </div>

                      {meeting.hasMinutes && (
                        <button
                          style={{
                            backgroundColor: colors.lightBackground,
                            border: `1px solid ${colors.border}`,
                            color: colors.textPrimary,
                            padding: `${spacing.sm} ${spacing.md}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: typography.fontSize.sm,
                            fontFamily: typography.fontFamily,
                            fontWeight: typography.fontWeight.medium,
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.sm,
                          }}
                        >
                          <FileText size={14} />
                          View Minutes
                        </button>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.tealSuccess,
                        padding: `${spacing.xs} ${spacing.sm}`,
                        fontWeight: typography.fontWeight.semibold,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Completed
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
};
