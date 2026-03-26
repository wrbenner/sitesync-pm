import React from 'react';
import { Users, Clock, AlertTriangle, Cloud } from 'lucide-react';
import { Card, SectionHeader, MetricBox } from '../components/Primitives';
import { colors, spacing, typography } from '../styles/theme';
import { dailyLogHistory } from '../data/mockData';

export const DailyLog: React.FC = () => {
  const today = dailyLogHistory[0];

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
      <SectionHeader title="Daily Log" subtitle="Site activity and weather" />

      {/* Today's Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing.xl,
        }}
      >
        <MetricBox
          label="Workers on Site"
          value={today.workers}
          icon={<Users color={colors.green} />}
        />
        <MetricBox
          label="Man Hours"
          value={today.manHours.toLocaleString()}
          icon={<Clock color={colors.blue} />}
        />
        <MetricBox
          label="Incidents"
          value={today.incidents}
          icon={<AlertTriangle color={today.incidents > 0 ? colors.red : colors.green} />}
        />
        <MetricBox
          label="Weather"
          value={today.weather}
          icon={<Cloud color={colors.blue} />}
        />
      </div>

      {/* Daily Log Entries */}
      <div>
        <SectionHeader title="Log History" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          {dailyLogHistory.map((log, index) => (
            <Card key={log.id} padding={spacing.lg}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <h3
                  style={{
                    fontSize: typography.fontSize.lg,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                    margin: 0,
                  }}
                >
                  {new Date(log.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
                {index === 0 && (
                  <span
                    style={{
                      fontSize: typography.fontSize.xs,
                      backgroundColor: colors.tealSuccess,
                      color: colors.white,
                      padding: `${spacing.xs} ${spacing.sm}`,
                      borderRadius: '12px',
                      fontWeight: typography.fontWeight.semibold,
                    }}
                  >
                    Today
                  </span>
                )}
              </div>

              <p
                style={{
                  fontSize: typography.fontSize.base,
                  color: colors.textSecondary,
                  margin: 0,
                  marginBottom: spacing.lg,
                  lineHeight: typography.lineHeight.relaxed,
                }}
              >
                {log.summary}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: spacing.lg,
                  padding: `${spacing.md} 0`,
                  borderTop: `1px solid ${colors.border}`,
                  borderBottom: `1px solid ${colors.border}`,
                  marginBottom: spacing.lg,
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.textSecondary,
                      margin: 0,
                      marginBottom: spacing.xs,
                      textTransform: 'uppercase',
                    }}
                  >
                    Workers
                  </p>
                  <p
                    style={{
                      fontSize: typography.fontSize.lg,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      margin: 0,
                    }}
                  >
                    {log.workers}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.textSecondary,
                      margin: 0,
                      marginBottom: spacing.xs,
                      textTransform: 'uppercase',
                    }}
                  >
                    Man Hours
                  </p>
                  <p
                    style={{
                      fontSize: typography.fontSize.lg,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      margin: 0,
                    }}
                  >
                    {log.manHours.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.textSecondary,
                      margin: 0,
                      marginBottom: spacing.xs,
                      textTransform: 'uppercase',
                    }}
                  >
                    Incidents
                  </p>
                  <p
                    style={{
                      fontSize: typography.fontSize.lg,
                      fontWeight: typography.fontWeight.semibold,
                      color: log.incidents > 0 ? colors.red : colors.green,
                      margin: 0,
                    }}
                  >
                    {log.incidents}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.textSecondary,
                      margin: 0,
                      marginBottom: spacing.xs,
                      textTransform: 'uppercase',
                    }}
                  >
                    Weather
                  </p>
                  <p
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      margin: 0,
                    }}
                  >
                    {log.weather}
                  </p>
                </div>
              </div>

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
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
};
