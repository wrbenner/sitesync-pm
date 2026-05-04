import React, { useEffect, useRef } from 'react';
import { PageContainer } from '../../components/Primitives';
import { spacing, borderRadius } from '../../styles/theme';
import { skeletonStyle } from '../../styles/animations';
import { useProjectId } from '../../hooks/useProjectId';
import { useProjects } from '../../hooks/queries';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useProjectStore } from '../../stores/projectStore';
import { WelcomeOnboarding } from './WelcomeOnboarding';
import { SundialDashboard } from './SundialDashboard';

const skel: React.CSSProperties = { ...skeletonStyle, borderRadius: borderRadius.lg };

function DashboardSkeleton() {
  return (
    <PageContainer>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: `${spacing['12']} 0` }}>
        <div style={{ ...skel, height: 32, width: 260, marginBottom: spacing['3'] }} />
        <div style={{ ...skel, height: 14, width: 180, marginBottom: spacing['12'], animationDelay: '0.08s' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['10'] }}>
          {[0, 1, 2, 3].map((i) => <div key={i} style={{ ...skel, height: 110, animationDelay: `${0.12 + i * 0.04}s` }} />)}
        </div>
        <div style={{ ...skel, height: 240, animationDelay: '0.3s' }} />
      </div>
    </PageContainer>
  );
}

const DashboardPage: React.FC = () => {
  const projectId = useProjectId();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const { data: allProjects, isPending: projectsLoading } = useProjects();

  // allProjects is a new array reference on every react-query refetch, so we
  // track the last ID we set via ref to avoid re-triggering setActiveProject
  // when the store update hasn't propagated to projectId yet.
  const lastAutoSetRef = useRef<string | null>(null);
  useEffect(() => {
    if (!allProjects || allProjects.length === 0) return;
    const validIds = new Set(allProjects.map((p) => p.id));
    if (projectId && validIds.has(projectId)) {
      lastAutoSetRef.current = null;
      return;
    }
    const fallbackId = allProjects[0].id;
    if (lastAutoSetRef.current === fallbackId) return;
    lastAutoSetRef.current = fallbackId;
    setActiveProject(fallbackId);
  }, [projectId, allProjects, setActiveProject]);

  // Fire idempotent project-level sweeps once per project mount. Eventually
  // these move to a scheduled cron — for now, dashboard-mount is the cheapest
  // surface to run them.
  const lastSweptProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (lastSweptProjectRef.current === projectId) return;
    lastSweptProjectRef.current = projectId;
    void import('../../lib/crossFeatureWorkflows').then(
      async ({ runRfiOverdueSweep, runMeetingActionItemTaskSweep }) => {
        const [rfiResults, actionResults] = await Promise.all([
          runRfiOverdueSweep(projectId),
          runMeetingActionItemTaskSweep(projectId),
        ]);
        const rfiCreated = rfiResults.filter((r) => r.created).length;
        const actionCreated = actionResults.filter((r) => r.created).length;
        if (rfiCreated > 0) console.info(`[rfi_overdue_sweep] created ${rfiCreated} follow-up task(s)`);
        if (actionCreated > 0) console.info(`[meeting_action_item_sweep] created ${actionCreated} task(s)`);
      },
    );
  }, [projectId]);

  if (projectsLoading) return <DashboardSkeleton />;
  if (!allProjects || allProjects.length === 0) return <WelcomeOnboarding onProjectCreated={() => {}} />;
  return <SundialDashboard />;
};

export const Dashboard: React.FC = () => (
  <ErrorBoundary message="The dashboard could not be displayed. Check your connection and try again.">
    <DashboardPage />
  </ErrorBoundary>
);
export default Dashboard;
