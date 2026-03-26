import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  HelpCircle,
  CheckSquare,
  Brain,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Calendar,
  Plus,
  FileText,
} from 'lucide-react';
import { Card, MetricBox, SectionHeader, Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { projectData, metrics, aiInsights, upcomingMeetings } from '../data/mockData';

export const Dashboard: React.FC = () => {
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return colors.red;
      case 'warning':
        return colors.amber;
      case 'info':
        return colors.blue;
      case 'success':
        return colors.green;
      default:
        return colors.blue;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'success':
        return <CheckCircle size={18} />;
      default:
        return <AlertCircle size={18} />;
    }
  };

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
      {/* Project Header */}
      <div style={{ marginBottom: spacing.xl }}>
        <h1
          style={{
            fontSize: typography.fontSize['5xl'],
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.sm,
          }}
        >
          {projectData.name}
        </h1>
        <p
          style={{
            fontSize: typography.fontSize.base,
            color: colors.textSecondary,
            margin: 0,
            marginBottom: spacing.xs,
          }}
        >
          {projectData.address}
        </p>
        <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
            }}
          >
            {projectData.type}
          </span>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
            }}
          >
            •
          </span>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
            }}
          >
            {projectData.daysRemaining} days remaining
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing.xl,
        }}
      >
        <MetricBox
          label="Progress"
          value={metrics.progress}
          unit="%"
          icon={<TrendingUp color={colors.tealSuccess} />}
        />
        <MetricBox
          label="Budget Spent"
          value={`$${(metrics.budgetSpent / 1000000).toFixed(1)}M`}
          unit={`of $${(metrics.budgetTotal / 1000000).toFixed(1)}M`}
          icon={<DollarSign color={colors.blue} />}
        />
        <MetricBox
          label="Active Crews"
          value={metrics.crewsActive}
          icon={<Users color={colors.primaryOrange} />}
        />
        <MetricBox
          label="RFIs Open"
          value={metrics.rfiOpen}
          change={1}
          changeLabel="this week"
          icon={<HelpCircle color={colors.amber} />}
        />
        <MetricBox
          label="Punch List"
          value={metrics.punchListOpen}
          icon={<CheckSquare color={colors.red} />}
        />
        <MetricBox
          label="AI Health Score"
          value={metrics.aiHealthScore}
          icon={<Brain color={colors.green} />}
        />
      </div>

      {/* Main Content Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: spacing.xl,
          marginBottom: spacing.xl,
        }}
      >
        {/* AI Insights */}
        <div>
          <SectionHeader
            title="AI Insights"
            subtitle="Powered by machine learning"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            {aiInsights.map((insight) => (
              <Card
                key={insight.id}
                padding={spacing.lg}
                onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: borderRadius.md,
                      backgroundColor: getSeverityColor(insight.severity),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.white,
                      flexShrink: 0,
                    }}
                  >
                    {getSeverityIcon(insight.severity)}
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
                      {insight.title}
                    </h3>
                    <p
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        margin: 0,
                        marginBottom: spacing.md,
                      }}
                    >
                      {insight.description}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <button
                        style={{
                          backgroundColor: 'transparent',
                          border: `1px solid ${colors.primaryOrange}`,
                          color: colors.primaryOrange,
                          padding: `${spacing.xs} ${spacing.md}`,
                          borderRadius: borderRadius.sm,
                          cursor: 'pointer',
                          fontSize: typography.fontSize.sm,
                          fontFamily: typography.fontFamily,
                          fontWeight: typography.fontWeight.medium,
                        }}
                      >
                        {insight.actionButton}
                      </button>
                      <span
                        style={{
                          fontSize: typography.fontSize.xs,
                          color: colors.textTertiary,
                        }}
                      >
                        {Math.floor((Date.now() - insight.timestamp.getTime()) / 3600000)}h ago
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Activity & Quick Actions */}
        <div>
          {/* Upcoming Meetings */}
          <div style={{ marginBottom: spacing.xl }}>
            <SectionHeader title="Today's Activity" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {upcomingMeetings.slice(0, 3).map((meeting) => (
                <Card key={meeting.id} padding={spacing.md}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: borderRadius.md,
                        backgroundColor:
                          meeting.type === 'oac'
                            ? colors.blue
                            : meeting.type === 'safety'
                              ? colors.red
                              : colors.tealSuccess,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: colors.white,
                      }}
                    >
                      <Calendar size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                          margin: 0,
                          marginBottom: spacing.xs,
                        }}
                      >
                        {meeting.title}
                      </p>
                      <p
                        style={{
                          fontSize: typography.fontSize.xs,
                          color: colors.textTertiary,
                          margin: 0,
                        }}
                      >
                        {meeting.time} • {meeting.attendees} attendees
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <SectionHeader title="Quick Actions" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: spacing.md,
              }}
            >
              <Btn
                variant="secondary"
                size="md"
                icon={<Plus size={16} />}
                onClick={() => console.log('Create RFI')}
              >
                Create RFI
              </Btn>
              <Btn
                variant="secondary"
                size="md"
                icon={<FileText size={16} />}
                onClick={() => console.log('Daily Log')}
              >
                Daily Log
              </Btn>
              <Btn
                variant="secondary"
                size="md"
                icon={<DollarSign size={16} />}
                onClick={() => console.log('Change Order')}
              >
                Change Order
              </Btn>
              <Btn
                variant="secondary"
                size="md"
                icon={<AlertTriangle size={16} />}
                onClick={() => console.log('Flag Issue')}
              >
                Flag Issue
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
