import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PageContainer, Card, Btn, EmptyState } from '../../components/Primitives';
import { MetricCardSkeleton } from '../../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { useSubmittals, useSubmittalReviewers } from '../../hooks/queries';
import { AlertTriangle, ClipboardList, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { useCreateSubmittal, useUpdateSubmittal } from '../../hooks/mutations';
import { useProjectId } from '../../hooks/useProjectId';
import { useNavigate } from 'react-router-dom';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { PredictiveAlertBanner } from '../../components/ai/PredictiveAlert';
import { getPredictiveAlertsForPage } from '../../data/aiAnnotations';
import CreateSubmittalModal from '../../components/forms/CreateSubmittalModal';
import { toast } from 'sonner';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useCopilotStore } from '../../stores/copilotStore';
import { SubmittalsTable } from './SubmittalsTable';
import { SubmittalsKanban } from './SubmittalsKanban';
import { SubmittalDetail } from './SubmittalDetail';

const SubmittalsPage: React.FC = () => {
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('submittals'); }, [setPageContext]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const hasActiveFilters = statusFilter !== null;
  const clearFilters = () => setStatusFilter(null);
  const navigate = useNavigate();
  const projectId = useProjectId();
  const createSubmittal = useCreateSubmittal();
  const updateSubmittal = useUpdateSubmittal();
  const { data: submittalsResult, isPending: loading, error: submittalsError, refetch } = useSubmittals(projectId);
  const selectedIdStr = selectedId != null ? String(selectedId) : undefined;
  const { data: reviewersData = [] } = useSubmittalReviewers(selectedIdStr);
  const submittalsRaw = submittalsResult?.data ?? [];

  // Map API data to component shape
  const submittals = useMemo(() => submittalsRaw.map((s: Record<string, unknown>) => ({
    ...s,
    submittalNumber: s.number ? `SUB-${String(s.number).padStart(3, '0')}` : String(s.id ?? '').slice(0, 8),
    from: (s.subcontractor as string) || (s.created_by as string) || '',
    dueDate: (s.due_date as string) || '',
  })), [submittalsRaw]);

  const allSubmittals = submittals || [];
  const pageAlerts = getPredictiveAlertsForPage('submittals');
  const openCount = useMemo(() => allSubmittals.filter((s) => s.status !== 'approved').length, [allSubmittals]);
  const totalCount = allSubmittals.length;
  const pendingReviewCount = useMemo(() => allSubmittals.filter((s) => s.status === 'submitted' || s.status === 'review_in_progress').length, [allSubmittals]);
  const approvedCount = useMemo(() => allSubmittals.filter((s) => s.status === 'approved' || s.status === 'approved_as_noted').length, [allSubmittals]);
  const overdueCount = useMemo(() => allSubmittals.filter((s) => {
    const due = (s.due_date as string | undefined) || (s.dueDate as string | undefined);
    if (!due) return false;
    return s.status !== 'approved' && s.status !== 'approved_as_noted' && new Date(due) < new Date();
  }).length, [allSubmittals]);

  const STATUS_FILTER_TABS: Array<{ label: string; value: string | null }> = [
    { label: 'All', value: null },
    { label: 'Pending', value: 'pending' },
    { label: 'In Review', value: 'in_review' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Resubmit', value: 'revise_resubmit' },
  ];

  const filteredSubmittals = useMemo(() => {
    if (!statusFilter) return allSubmittals;
    if (statusFilter === 'in_review') return allSubmittals.filter((s) => s.status === 'submitted' || s.status === 'review_in_progress' || s.status === 'under_review');
    return allSubmittals.filter((s) => s.status === statusFilter);
  }, [allSubmittals, statusFilter]);

  const selected = allSubmittals.find((s) => s.id === selectedId) || null;

  const toggleBtnStyle = useCallback((active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: active ? colors.primaryOrange : 'transparent',
    color: active ? colors.white : colors.textTertiary,
    transition: 'all 150ms ease',
  }), []);


  if (!projectId) {
    return (
      <PageContainer title="Submittals">
        <EmptyState
          icon={<ClipboardList size={32} color={colors.textTertiary} />}
          title="No project selected"
          description="Select a project from the sidebar to view and manage submittals."
        />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer title="Submittals" subtitle="Loading...">
        <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['6'] }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <Card padding="0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 52,
                borderBottom: `1px solid ${colors.borderLight}`,
                padding: `0 ${spacing['4']}`,
                display: 'grid',
                gridTemplateColumns: '100px 1fr 140px 100px 90px',
                alignItems: 'center',
                gap: spacing['4'],
                animation: 'submittals-pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.08}s`,
              }}
            >
              <div style={{ width: 76, height: 14, borderRadius: borderRadius.sm, backgroundColor: colors.border }} />
              <div style={{ height: 14, borderRadius: borderRadius.sm, backgroundColor: colors.border }} />
              <div style={{ width: 110, height: 14, borderRadius: borderRadius.sm, backgroundColor: colors.border }} />
              <div style={{ width: 80, height: 22, borderRadius: borderRadius.full, backgroundColor: colors.border }} />
              <div style={{ width: 72, height: 14, borderRadius: borderRadius.sm, backgroundColor: colors.border }} />
            </div>
          ))}
        </Card>
        <style>{`
          @keyframes submittals-pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </PageContainer>
    );
  }

  if (submittalsError) {
    return (
      <PageContainer title="Submittals" subtitle="">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          padding: `${spacing['4']} ${spacing['5']}`,
          backgroundColor: colors.statusCriticalSubtle,
          border: `1px solid ${colors.statusCritical}40`,
          borderRadius: borderRadius.md,
          color: colors.statusCritical,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
            Unable to load submittals. Check your connection and try again.
          </span>
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Btn>
        </div>
      </PageContainer>
    );
  }

  if (!submittals.length && !hasActiveFilters) {
    return (
      <PageContainer
        title="Submittals"
        subtitle="No items"
        actions={<PermissionGate permission="submittals.create"><Btn onClick={() => setShowCreateModal(true)} data-testid="create-submittal-button">New Submittal</Btn></PermissionGate>}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${spacing['20']} ${spacing['8']}`,
          gap: spacing['5'],
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: borderRadius.xl,
            backgroundColor: colors.orangeSubtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ClipboardList size={32} color={colors.primaryOrange} />
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
              No submittals yet
            </h3>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, maxWidth: 380 }}>
              Track material approvals to keep procurement on schedule
            </p>
          </div>
          <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['2'] }}>
            <PermissionGate permission="submittals.create">
              <Btn variant="primary" onClick={() => setShowCreateModal(true)}>Create Submittal</Btn>
            </PermissionGate>
            <Btn variant="secondary" onClick={() => {}}>Import from Spec</Btn>
          </div>
        </div>
        <CreateSubmittalModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            await createSubmittal.mutateAsync({ projectId: projectId!, data: { ...data, project_id: projectId! } });
            toast.success('Submittal created: ' + (data.title || 'New Submittal'));
          }}
        />
      </PageContainer>
    );
  }


  return (
    <PageContainer
      title="Submittals"
      subtitle={`${allSubmittals.length} total \u00b7 ${openCount} open`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div style={{ display: 'flex', borderRadius: borderRadius.full, overflow: 'hidden', border: `1px solid ${colors.borderLight}` }}>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'table'), borderRadius: `${borderRadius.full} 0 0 ${borderRadius.full}` }}
              onClick={() => setViewMode('table')}
              title="Table View"
              aria-label="Table View"
            >
              <List size={16} />
            </button>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'kanban'), borderRadius: `0 ${borderRadius.full} ${borderRadius.full} 0` }}
              onClick={() => setViewMode('kanban')}
              title="Board View"
              aria-label="Board View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <PermissionGate permission="submittals.create">
            <Btn onClick={() => setShowCreateModal(true)}>New Submittal</Btn>
          </PermissionGate>
        </div>
      }
    >
      {submittalsError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          marginBottom: spacing['4'],
          backgroundColor: colors.statusCriticalSubtle,
          border: `1px solid ${colors.statusCritical}40`,
          borderRadius: borderRadius.md,
          color: colors.statusCritical,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
            Unable to load submittals. Check your connection and try again.
          </span>
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Btn>
        </div>
      )}

      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {/* KPI Metric Cards */}
      <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        {[
          { label: 'Total Submittals', value: totalCount, color: colors.textPrimary, bg: colors.white },
          { label: 'Pending Review', value: pendingReviewCount, color: colors.statusPending, bg: colors.statusPendingSubtle },
          { label: 'Approved', value: approvedCount, color: colors.statusActive, bg: colors.statusActiveSubtle },
          { label: 'Overdue', value: overdueCount, color: colors.statusCritical, bg: colors.statusCriticalSubtle },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{
            flex: '1 1 140px',
            padding: `${spacing['4']} ${spacing['5']}`,
            backgroundColor: bg,
            border: `1px solid ${colors.borderLight}`,
            borderRadius: borderRadius.lg,
          }}>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing['2'] }}>{label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: typography.fontWeight.bold, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['4'], borderBottom: `1px solid ${colors.borderLight}`, paddingBottom: 0 }}>
        {STATUS_FILTER_TABS.map(({ label, value }) => {
          const active = statusFilter === value;
          return (
            <button
              key={label}
              onClick={() => setStatusFilter(value)}
              style={{
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none',
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.normal,
                color: active ? colors.primaryOrange : colors.textSecondary,
                backgroundColor: 'transparent',
                borderBottom: active ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {viewMode === 'table' ? (
        <SubmittalsTable
          filteredSubmittals={filteredSubmittals}
          allSubmittals={allSubmittals}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          loading={loading}
          onRowClick={(sub) => navigate(`/projects/${projectId}/submittals/${(sub as Record<string, unknown>).id}`)}
          clearFilters={clearFilters}
          projectId={projectId}
          updateSubmittalMutateAsync={updateSubmittal.mutateAsync}
        />
      ) : (
        <SubmittalsKanban
          allSubmittals={allSubmittals}
          onSelectSubmittal={(id) => setSelectedId(id)}
        />
      )}

      <SubmittalDetail
        selected={selected as Record<string, unknown> | null}
        reviewersData={reviewersData}
        onClose={() => setSelectedId(null)}
        projectId={projectId}
        updateSubmittalMutateAsync={updateSubmittal.mutateAsync}
      />

      <CreateSubmittalModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await createSubmittal.mutateAsync({
            projectId: projectId!,
            data: { ...data, project_id: projectId! },
          });
          toast.success('Submittal created: ' + (data.title || 'New Submittal'));
        }}
      />
    </PageContainer>
  );
};

const Submittals: React.FC = () => (
  <ErrorBoundary message="Submittals could not be displayed. Check your connection and try again.">
    <SubmittalsPage />
  </ErrorBoundary>
);

export { Submittals };
export default Submittals;
