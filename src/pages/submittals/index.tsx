import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageContainer, Card, Btn, EmptyState } from '../../components/Primitives';
import { PresenceAvatars } from '../../components/shared/PresenceAvatars';
import { MetricCardSkeleton } from '../../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius, shadows, layout } from '../../styles/theme';
import { useSubmittals, useSubmittalReviewers, useProject, useAIInsights } from '../../hooks/queries';
import { exportSubmittalLogXlsx } from '../../lib/exportXlsx';
import { ExportButton } from '../../components/shared/ExportButton';
import { AlertTriangle, ClipboardList, LayoutGrid, List, RefreshCw, Search, Upload } from 'lucide-react';
import { useCreateSubmittal, useUpdateSubmittal, useDeleteSubmittal } from '../../hooks/mutations';
import { useProjectId } from '../../hooks/useProjectId';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { PredictiveAlertBanner } from '../../components/ai/PredictiveAlert';
import { getPredictiveAlertsForPage } from '../../data/aiAnnotations';
import CreateSubmittalModal from '../../components/forms/CreateSubmittalModal';
import SubmittalCreateWizard from '../../components/submittals/SubmittalCreateWizard';
import { toast } from 'sonner';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useCopilotStore } from '../../stores/copilotStore';
import { supabase } from '../../lib/supabase';
import { SubmittalsTable } from './SubmittalsTable';
import { SubmittalsKanban } from './SubmittalsKanban';
import { SubmittalDetail } from './SubmittalDetail';
import { GroupedSubmittalsView, GroupBySelector } from './GroupedSubmittalsView';
import type { GroupByMode } from './GroupedSubmittalsView';

const SubmittalsPage: React.FC = () => {
  // Selector-based access avoids re-rendering this page on every copilot state
  // change (typing indicator, conversation updates, etc).
  const setPageContext = useCopilotStore((s) => s.setPageContext);
  useEffect(() => { setPageContext('submittals'); }, [setPageContext]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [groupBy, setGroupBy] = useState<GroupByMode>('spec_section');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const hasActiveFilters = statusFilter !== null || searchQuery.trim() !== '';
  const clearFilters = () => { setStatusFilter(null); setSearchQuery(''); };
  const navigate = useNavigate();
  const projectId = useProjectId();
  const createSubmittal = useCreateSubmittal();
  const updateSubmittal = useUpdateSubmittal();
  const deleteSubmittal = useDeleteSubmittal();
  const queryClient = useQueryClient();
  const { data: submittalsResult, isPending: loading, error: submittalsError, refetch } = useSubmittals(projectId);
  const { data: project } = useProject(projectId);
  const { data: aiInsights } = useAIInsights(projectId, 'submittals');
  const specFileInputRef = useRef<HTMLInputElement>(null);

  // Real-time subscription for submittal changes
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel('submittals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submittals', filter: `project_id=eq.${projectId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['submittals', projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

  const handleSpecImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    const storagePath = `${projectId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('submittal-specs').upload(storagePath, file);
    if (error) {
      toast.error('Failed to upload spec: ' + error.message);
    } else {
      toast.success(`Spec uploaded: ${file.name}`);
    }
    e.target.value = '';
  }, [projectId]);

  const handleExportXlsx = useCallback(() => {
    const projectName = project?.name ?? 'Project';
    const rows = (submittalsResult?.data ?? []).map((s) => {
      const rec = s as Record<string, unknown>;
      return {
        number: String(rec.number ?? rec.id ?? ''),
        title: (rec.title as string) ?? '',
        specSection: (rec.spec_section as string) ?? '',
        subcontractor: (rec.subcontractor as string) ?? (rec.assigned_to as string) ?? '',
        status: (rec.status as string) ?? '',
        revision: String(rec.revision ?? ''),
        leadTime: String(rec.lead_time ?? ''),
        dueDate: (rec.due_date as string) ?? '',
      };
    });
    exportSubmittalLogXlsx(projectName, rows);
  }, [project?.name, submittalsResult?.data]);
  const { data: reviewersData = [] } = useSubmittalReviewers(selectedId ?? undefined);
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

  const STATUS_FILTER_TABS: Array<{ label: string; value: string | null; count: number }> = [
    { label: 'All', value: null, count: totalCount },
    { label: 'Pending', value: 'pending', count: pendingReviewCount },
    { label: 'In Review', value: 'in_review', count: allSubmittals.filter((s) => s.status === 'submitted' || s.status === 'review_in_progress' || s.status === 'under_review').length },
    { label: 'Approved', value: 'approved', count: approvedCount },
    { label: 'Rejected', value: 'rejected', count: allSubmittals.filter((s) => s.status === 'rejected').length },
    { label: 'Resubmit', value: 'revise_resubmit', count: allSubmittals.filter((s) => s.status === 'revise_resubmit').length },
  ];

  const filteredSubmittals = useMemo(() => {
    let rows = allSubmittals;
    if (statusFilter === 'in_review') {
      rows = rows.filter((s) => s.status === 'submitted' || s.status === 'review_in_progress' || s.status === 'under_review');
    } else if (statusFilter) {
      rows = rows.filter((s) => s.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((s) => {
        const rec = s as Record<string, unknown>;
        return (
          String(rec.title ?? '').toLowerCase().includes(q) ||
          String(rec.number ?? '').toLowerCase().includes(q) ||
          String(rec.spec_section ?? '').toLowerCase().includes(q)
        );
      });
    }
    return rows;
  }, [allSubmittals, statusFilter, searchQuery]);

  const selected = allSubmittals.find((s) => s.id === selectedId) || null;

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
          {Array.from({ length: 4 }).map((_, i) => (
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
        actions={
          <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
            <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_Submittal_Log" />
            <PermissionGate permission="submittals.create"><Btn onClick={() => setShowCreateModal(true)} data-testid="create-submittal-button">New Submittal</Btn></PermissionGate>
          </div>
        }
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${spacing['24']} ${spacing['8']}`,
          gap: spacing['4'],
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: borderRadius.full,
            backgroundColor: colors.orangeSubtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ClipboardList size={28} color={colors.primaryOrange} />
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            <h3 style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
              No submittals yet
            </h3>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, maxWidth: 340 }}>
              Track material approvals to keep procurement on schedule.
            </p>
          </div>
          <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['3'] }}>
            <PermissionGate permission="submittals.create">
              <Btn variant="primary" onClick={() => setShowCreateModal(true)}>Create Submittal</Btn>
            </PermissionGate>
            <Btn variant="secondary" icon={<Upload size={14} />} onClick={() => specFileInputRef.current?.click()}>Import from Spec</Btn>
            <input ref={specFileInputRef} type="file" accept=".pdf,.docx,.xlsx,.csv" style={{ display: 'none' }} onChange={handleSpecImport} />
          </div>
        </div>
        <SubmittalCreateWizard
          projectId={projectId!}
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
      subtitle={`${allSubmittals.length} total`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <PresenceAvatars page="submittals" size={28} />
          <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_Submittal_Log" />
        </div>
      }
    >
      {/* Predictive alerts - subtle placement */}
      {pageAlerts.map((alert) => (
        <div key={alert.id} style={{ marginBottom: spacing['3'] }}>
          <PredictiveAlertBanner alert={alert} />
        </div>
      ))}

      {/* Hero Metric Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['8'],
        padding: `${spacing['5']} ${spacing['6']}`,
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        border: `1px solid ${colors.borderSubtle}`,
        marginBottom: spacing['5'],
        boxShadow: shadows.sm,
      }}>
        {[
          { label: 'Total', value: totalCount, color: colors.textPrimary },
          { label: 'Pending Review', value: pendingReviewCount, color: colors.statusPending },
          { label: 'Approved', value: approvedCount, color: colors.statusActive },
          { label: 'Overdue', value: overdueCount, color: colors.statusCritical },
        ].map(({ label, value, color }, idx) => (
          <React.Fragment key={label}>
            {idx > 0 && (
              <div style={{ width: 1, height: 32, backgroundColor: colors.borderSubtle }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['0.5'] }}>
              <span style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
              }}>
                {label}
              </span>
              <span style={{
                fontSize: typography.fontSize.large,
                fontWeight: typography.fontWeight.semibold,
                color,
                lineHeight: typography.lineHeight.none,
              }}>
                {value}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Unified Toolbar: Search + Filters + View Toggle + New Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        marginBottom: spacing['5'],
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '0 1 280px', minWidth: 200 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: spacing['3'],
              top: '50%',
              transform: 'translateY(-50%)',
              color: colors.textTertiary,
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search submittals..."
            aria-label="Search submittals"
            data-testid="search-submittals"
            style={{
              width: '100%',
              padding: `${spacing['2']} ${spacing['3']} ${spacing['2']} ${spacing['8']}`,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.full,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              backgroundColor: colors.surfacePage,
              color: colors.textPrimary,
              outline: 'none',
              transition: 'border-color 150ms ease, box-shadow 150ms ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.primaryOrange;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.orangeSubtle}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.borderSubtle;
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: spacing['1'], alignItems: 'center', flex: '1 1 auto' }}>
          {STATUS_FILTER_TABS.map(({ label, value, count }) => {
            const active = statusFilter === value;
            return (
              <button
                key={label}
                onClick={() => setStatusFilter(value)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing['1'],
                  padding: `${spacing['1.5']} ${spacing['3']}`,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: typography.fontSize.label,
                  fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
                  color: active ? colors.white : colors.textSecondary,
                  backgroundColor: active ? colors.primaryOrange : colors.surfaceInset,
                  borderRadius: borderRadius.full,
                  transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                  lineHeight: typography.lineHeight.normal,
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.medium,
                    color: active ? 'rgba(255,255,255,0.8)' : colors.textTertiary,
                    backgroundColor: active ? 'rgba(255,255,255,0.2)' : colors.borderSubtle,
                    borderRadius: borderRadius.full,
                    padding: `0 ${spacing['1.5']}`,
                    minWidth: 18,
                    textAlign: 'center',
                    lineHeight: '18px',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Group By (only shown in table mode) */}
        {viewMode === 'table' && (
          <GroupBySelector value={groupBy} onChange={setGroupBy} />
        )}

        {/* View Toggle (segmented control) */}
        <div style={{
          display: 'flex',
          borderRadius: borderRadius.md,
          overflow: 'hidden',
          border: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceInset,
          padding: spacing['0.5'],
          gap: spacing['0.5'],
        }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 28,
              border: 'none',
              cursor: 'pointer',
              borderRadius: borderRadius.base,
              backgroundColor: viewMode === 'table' ? colors.surfaceRaised : 'transparent',
              color: viewMode === 'table' ? colors.textPrimary : colors.textTertiary,
              boxShadow: viewMode === 'table' ? shadows.sm : 'none',
              transition: 'all 150ms ease',
            }}
            onClick={() => setViewMode('table')}
            title="Table View"
            aria-label="Table View"
          >
            <List size={14} />
          </button>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 28,
              border: 'none',
              cursor: 'pointer',
              borderRadius: borderRadius.base,
              backgroundColor: viewMode === 'kanban' ? colors.surfaceRaised : 'transparent',
              color: viewMode === 'kanban' ? colors.textPrimary : colors.textTertiary,
              boxShadow: viewMode === 'kanban' ? shadows.sm : 'none',
              transition: 'all 150ms ease',
            }}
            onClick={() => setViewMode('kanban')}
            title="Board View"
            aria-label="Board View"
          >
            <LayoutGrid size={14} />
          </button>
        </div>

        {/* New Submittal Button */}
        <PermissionGate permission="submittals.create">
          <Btn onClick={() => setShowCreateModal(true)}>New Submittal</Btn>
        </PermissionGate>
      </div>

      {/* Content area */}
      {viewMode === 'table' ? (
        groupBy !== 'none' ? (
          <GroupedSubmittalsView
            filteredSubmittals={filteredSubmittals}
            groupBy={groupBy}
            onRowClick={(sub) => navigate(`/submittals/${(sub as Record<string, unknown>).id}`)}
          />
        ) : (
          <SubmittalsTable
            filteredSubmittals={filteredSubmittals}
            allSubmittals={allSubmittals}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            loading={loading}
            onRowClick={(sub) => navigate(`/submittals/${(sub as Record<string, unknown>).id}`)}
            clearFilters={clearFilters}
            projectId={projectId}
            updateSubmittalMutateAsync={updateSubmittal.mutateAsync}
          />
        )
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
        deleteSubmittalMutateAsync={deleteSubmittal.mutateAsync}
        deletePending={deleteSubmittal.isPending}
      />

      <SubmittalCreateWizard
        projectId={projectId!}
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

      {/* Hidden spec file input for import */}
      <input ref={specFileInputRef} type="file" accept=".pdf,.docx,.xlsx,.csv" style={{ display: 'none' }} onChange={handleSpecImport} />
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
