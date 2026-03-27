import React from 'react';
import { PageContainer, Skeleton } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { useQuery } from '../hooks/useQuery';
import { getProject, getMetrics } from '../api/endpoints/projects';
import { getTasks } from '../api/endpoints/tasks';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';

export const Dashboard: React.FC = () => {
  const { data: projectData } = useQuery('project', getProject);
  const { data: metrics } = useQuery('metrics', getMetrics);
  const { data: tasks } = useQuery('tasks', getTasks);

  if (!metrics || !tasks || !projectData) {
    return (
      <PageContainer>
        <Skeleton width="100%" height="88px" />
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="240px" />)}
        </div>
      </PageContainer>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== 'done');

  return (
    <PageContainer>
      {/* Project Pulse Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing['6'],
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.card,
          marginBottom: spacing['6'],
        }}
      >
        <div>
          <h1 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, letterSpacing: typography.letterSpacing.tight, lineHeight: typography.lineHeight.tight }}>
            {projectData.name}
          </h1>
          <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginTop: spacing['1'] }}>
            {projectData.address}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['8'] }}>
          <div style={{ display: 'flex', gap: spacing['8'], alignItems: 'baseline' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{activeTasks.length}</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>active tasks</p>
            </div>
            <div style={{ width: 1, height: 32, backgroundColor: colors.borderSubtle }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>${(metrics.budgetSpent / 1000000).toFixed(1)}M</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>of ${(metrics.budgetTotal / 1000000).toFixed(1)}M</p>
            </div>
            <div style={{ width: 1, height: 32, backgroundColor: colors.borderSubtle }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{projectData.daysRemaining}</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>days left</p>
            </div>
          </div>

          {/* Progress ring */}
          <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
            <svg width={56} height={56} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={28} cy={28} r={23} fill="none" stroke={colors.borderSubtle} strokeWidth="4" />
              <circle cx={28} cy={28} r={23} fill="none" stroke={colors.primaryOrange} strokeWidth="4"
                strokeDasharray={2 * Math.PI * 23} strokeDashoffset={2 * Math.PI * 23 * (1 - metrics.progress / 100)} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: 1 }}>{metrics.progress}%</span>
              <span style={{ fontSize: '7px', color: colors.textTertiary, marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Grid */}
      <DashboardGrid />
    </PageContainer>
  );
};
