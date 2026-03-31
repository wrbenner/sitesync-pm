import React, { useMemo } from 'react';
import { PageContainer, Skeleton } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useProject, useSchedulePhases, useBudgetItems, useRFIs, usePunchItems } from '../hooks/queries';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';

export const Dashboard: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { data: phases } = useSchedulePhases(projectId);
  const { data: budgetItems } = useBudgetItems(projectId);
  const { data: rfis } = useRFIs(projectId);
  const { data: punchItems } = usePunchItems(projectId);

  // Compute KPIs from real data
  const overallProgress = useMemo(() =>
    phases?.length
      ? Math.round(phases.reduce((s, p) => s + (p.percent_complete || 0), 0) / phases.length)
      : 0,
    [phases]
  );

  const { budgetSpent, budgetTotal } = useMemo(() => ({
    budgetSpent: budgetItems?.reduce((s, b) => s + (b.actual_amount || 0), 0) || 0,
    budgetTotal: budgetItems?.reduce((s, b) => s + (b.original_amount || 0), 0) || 1,
  }), [budgetItems]);

  const activeItemCount = useMemo(() => {
    const openRfis = rfis?.filter(r => r.status === 'open' || r.status === 'under_review').length || 0;
    const openPunch = punchItems?.filter(p => p.status === 'open' || p.status === 'in_progress').length || 0;
    return openRfis + openPunch;
  }, [rfis, punchItems]);

  const daysRemaining = useMemo(() =>
    project?.target_completion
      ? Math.max(0, Math.ceil((new Date(project.target_completion).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0,
    [project?.target_completion]
  );

  const projectAddress = useMemo(() =>
    [project?.address, project?.city, project?.state].filter(Boolean).join(', '),
    [project?.address, project?.city, project?.state]
  );

  const circumference = 2 * Math.PI * 23;

  // Animated numbers
  const animProgress = useAnimatedNumber(overallProgress);
  const animBudgetSpent = useAnimatedNumber(Math.round(budgetSpent / 1000000 * 10) / 10);
  const animBudgetTotal = useAnimatedNumber(Math.round(budgetTotal / 1000000 * 10) / 10);
  const animActiveItems = useAnimatedNumber(activeItemCount);
  const animDaysRemaining = useAnimatedNumber(daysRemaining);

  if (!project) {
    return (
      <PageContainer>
        <Skeleton width="100%" height="88px" />
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="240px" />)}
        </div>
      </PageContainer>
    );
  }

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
            {project.name}
          </h1>
          <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, marginTop: spacing['1'] }}>
            {projectAddress}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['8'] }}>
          <div style={{ display: 'flex', gap: spacing['8'], alignItems: 'baseline' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{Math.round(animActiveItems)}</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>active items</p>
            </div>
            <div style={{ width: 1, height: 32, backgroundColor: colors.borderSubtle }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>${animBudgetSpent.toFixed(1)}M</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>of ${animBudgetTotal.toFixed(1)}M</p>
            </div>
            <div style={{ width: 1, height: 32, backgroundColor: colors.borderSubtle }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{Math.round(animDaysRemaining)}</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>days left</p>
            </div>
          </div>

          {/* Progress ring */}
          <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
            <svg width={56} height={56} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={28} cy={28} r={23} fill="none" stroke={colors.borderSubtle} strokeWidth="4" />
              <circle cx={28} cy={28} r={23} fill="none" stroke={colors.primaryOrange} strokeWidth="4"
                strokeDasharray={circumference} strokeDashoffset={circumference * (1 - overallProgress / 100)} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: 1 }}>{Math.round(animProgress)}%</span>
              <span style={{ fontSize: '7px', color: colors.textTertiary, marginTop: 1, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Grid */}
      <DashboardGrid />
    </PageContainer>
  );
};
