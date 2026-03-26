import React from 'react';
import { AlertCircle, TrendingUp, Target } from 'lucide-react';
import { Card, SectionHeader, MetricBox } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { schedulePhases, metrics } from '../data/mockData';

export const Schedule: React.FC = () => {
  const today = new Date();

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
      <SectionHeader title="Schedule" />

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing.xl,
        }}
      >
        <MetricBox
          label="Days Behind Schedule"
          value={metrics.daysBeforeSchedule}
          icon={<AlertCircle color={colors.green} />}
        />
        <MetricBox
          label="Milestones Hit"
          value={`${metrics.milestonesHit}/${metrics.milestoneTotal}`}
          icon={<Target color={colors.blue} />}
        />
        <MetricBox
          label="AI Confidence"
          value={metrics.aiConfidenceLevel}
          unit="%"
          icon={<TrendingUp color={colors.green} />}
        />
      </div>

      {/* Gantt Chart */}
      <Card padding={spacing.lg}>
        <h3
          style={{
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.lg,
          }}
        >
          Project Timeline
        </h3>

        {/* Timeline Container */}
        <div style={{ overflowX: 'auto', marginBottom: spacing.lg }}>
          <div
            style={{
              minWidth: '800px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', marginBottom: spacing.md }}>
              <div style={{ width: '150px', flexShrink: 0 }} />
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingRight: spacing.lg,
                  fontSize: typography.fontSize.xs,
                  color: colors.textTertiary,
                  fontWeight: typography.fontWeight.semibold,
                }}
              >
                {['Q3 2023', 'Q4 2023', 'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'].map(
                  (q) => (
                    <span key={q}>{q}</span>
                  )
                )}
              </div>
            </div>

            {/* Phases */}
            {schedulePhases.map((phase) => {
              const startDate = new Date(phase.startDate);
              const endDate = new Date(phase.endDate);
              const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const daysPassed = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const progressPercent = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

              const isCompleted = phase.completed;
              const isBehind = !isCompleted && endDate < today;

              return (
                <div
                  key={phase.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingBottom: spacing.md,
                    paddingTop: spacing.md,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <div style={{ width: '150px', flexShrink: 0 }}>
                    <p
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                        margin: 0,
                      }}
                    >
                      {phase.name}
                    </p>
                    <p
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.textSecondary,
                        margin: 0,
                      }}
                    >
                      {phase.progress}%
                    </p>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      height: '32px',
                      backgroundColor: colors.lightBackground,
                      borderRadius: borderRadius.sm,
                      position: 'relative',
                      overflow: 'hidden',
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {/* Progress bar */}
                    <div
                      style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        backgroundColor: isCompleted
                          ? colors.tealSuccess
                          : isBehind
                            ? colors.red
                            : phase.critical
                              ? colors.primaryOrange
                              : colors.blue,
                        transition: 'width 300ms ease-in-out',
                        borderRadius: borderRadius.sm,
                      }}
                    />

                    {/* Today line */}
                    {!isCompleted && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          width: '2px',
                          height: '100%',
                          backgroundColor: colors.textPrimary,
                          opacity: 0.3,
                        }}
                      />
                    )}
                  </div>

                  {isBehind && (
                    <span style={{ fontSize: typography.fontSize.xs, color: colors.red }}>
                      Behind
                    </span>
                  )}
                  {isCompleted && (
                    <span style={{ fontSize: typography.fontSize.xs, color: colors.tealSuccess }}>
                      Done
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p
          style={{
            fontSize: typography.fontSize.xs,
            color: colors.textTertiary,
            margin: 0,
            marginTop: spacing.lg,
          }}
        >
          Current date indicated by vertical line. Critical path phases shown in orange.
        </p>
      </Card>
    </main>
  );
};
