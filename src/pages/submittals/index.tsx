import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { PageContainer, Card, Btn, EmptyState } from '../../components/Primitives';
import { PresenceAvatars } from '../../components/shared/PresenceAvatars';
import { colors, spacing, typography, borderRadius, shadows, transitions
} from '../../styles/theme';
import { useSubmittals, useSubmittalReviewers, useProject, useAIInsights } from '../../hooks/queries';
import { exportSubmittalLogXlsx } from '../../lib/exportXlsx';
import { ExportButton } from '../../components/shared/ExportButton';
import { AlertTriangle, ClipboardList, LayoutGrid, List, RefreshCw, Search, Upload } from 'lucide-react';
import { useCreateSubmittal, useUpdateSubmittal, useDeleteSubmittal } from '../../hooks/mutations';
import { useProjectId } from '../../hooks/useProjectId';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { PredictiveAlertBanner } from '../../components/ai/PredictiveAlert';
import { getPredictiveAlertsForPage } from '../../data/aiAnnotations';

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
import { SubmittalKPIs } from './SubmittalKPIs';
import { SubmittalTabBar } from './SubmittalTabBar';
import type { SubmittalStatusFilter } from './SubmittalTabBar';

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
  const [statusFilter, setStatusFilter] = useState<SubmittalStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const hasActiveFilters = statusFilter !== 'all' || searchQuery.trim() !== '';
  const clearFilters = () => { setStatusFilter('all'); setSearchQuery(''); };
  const navigate = useNavigate();
  const projectId = useProjectId();
  const createSubmittal = useCreateSubmittal();
  const updateSubmittal = useUpdateSubmittal();
  const deleteSubmittal = useDeleteSubmittal();
  const _queryClient = useQueryClient();
  const { data: submittalsResult, isPending: loading, error: submittalsError, refetch } = useSubmittals(projectId);
  const { data: project } = useProject(projectId);
  const { data: aiInsights } = useAIInsights(projectId, 'submittals');
  const specFileInputRef = useRef<HTMLInputElement>(null);

  // Real-time subscription for all project tables (submittals + adjacent entities).
  useRealtimeInvalidation(projectId);

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

  const inReviewCount = useMemo(() => allSubmittals.filter((s) => s.status === 'submitted' || s.status === 'review_in_progress' || s.status === 'under_review').length, [allSubmittals]);
  const rejectedCount = useMemo(() => allSubmittals.filter((s) => s.status === 'rejected').length, [allSubmittals]);
  const resubmitCount = useMemo(() => allSubmittals.filter((s) => s.status === 'revise_resubmit').length, [allSubmittals]);

  const tabCounts = useMemo<Record<SubmittalStatusFilter, number>>(() => ({
    all: totalCount,
    pending: pendingReviewCount,
    in_review: inReviewCount,
    approved: approvedCount,
    rejected: rejectedCount,
    revise_resubmit: resubmitCount,
  }), [totalCount, pendingReviewCount, inReviewCount, approvedCount, rejectedCount, resubmitCount]);

  // Compute average days in review for KPIs
  const avgDaysInReview = useMemo(() => {
    const reviewed = allSubmittals.filter((s) => s.status === 'approved' || s.status === 'approved_as_noted');
    if (reviewed.length === 0) return 0;
    const totalDays = reviewed.reduce((sum, s) => {
      const start = new Date((s.submission_date || s.submitted_at || s.created_at) as string);
      const end = new Date((s.updated_at || s.approval_date) as string);
      return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    }, 0);
    return Math.round(totalDays / reviewed.length);
  }, [allSubmittals]);

  const approvedThisWeek = useMemo(() => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return allSubmittals.filter((s) => {
      if (s.status !== 'approved' && s.status !== 'approved_as_noted') return false;
      const d = new Date((s.updated_at || s.approval_date) as string);
      return d >= weekAgo;
    }).length;
  }, [allSubmittals]);

  const filteredSubmittals = useMemo(() => {
    let rows = allSubmittals;
    if (statusFilter === 'in_review') {
      rows = rows.filter((s) => s.status === 'submitted' || s.status === 'review_in_progress' || s.status === 'under_review');
    } else if (statusFilter !== 'all') {
      rows = rows.filter((s) => s.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((s) => {
        const rec = s as Record<string, unknown>;
        return (
          String(rec.title ?? '').toLowerCase().includes(q) ||
          String(rec.number ?? '').toLowerCase().includes(q) ||
          String(rec.spec_section ?? '').toLowerCase().includes(q) ||
          String(rec.subcontractor ?? '').toLowerCase().includes(q)
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
    const shimmerBg = `linear-gradient(90deg, ${colors.surfaceInset} 25%, ${colors.surfaceHover} 50%, ${colors.surfaceInset} 75%)`;
    const shimmerStyle = (w: number | string, h: number) => ({
      width: typeof w === 'number' ? w : w,
      height: h,
      borderRadius: borderRadius.sm,
      background: shimmerBg,
      backgroundSize: '200% 100%',
      animation: 'sub-shimmer 1.5s ease-in-out infinite',
    } as React.CSSProperties);

    return (
      <PageContainer title="Submittals" subtitle="Loading...">
        <style>{`@keyframes sub-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        {/* KPI card skeletons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px',
              backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.xl,
            }}>
              <div style={{ ...shimmerStyle(40, 40), borderRadius: borderRadius.lg }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={shimmerStyle(80, 10)} />
                <div style={shimmerStyle(48, 20)} />
                <div style={shimmerStyle(100, 9)} />
              </div>
              <div style={{ ...shimmerStyle(56, 22), alignSelf: 'center' }} />
            </div>
          ))}
        </div>

        {/* Section header skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={shimmerStyle(130, 18)} />
            <div style={{ ...shimmerStyle(24, 18), borderRadius: borderRadius.full }} />
          </div>
          <div style={{ ...shimmerStyle(170, 22), borderRadius: borderRadius.full }} />
        </div>

        {/* Tab bar skeleton */}
        <Card padding="0">
          <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 4, padding: 3, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg }}>
              {[60, 55, 62, 65, 55, 62].map((w, i) => (
                <div key={i} style={{ ...shimmerStyle(w, 28), borderRadius: borderRadius.md }} />
              ))}
            </div>
            <div style={shimmerStyle(240, 32)} />
          </div>
          {/* Row skeletons */}
          <div style={{ padding: '12px 0' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '40px 90px 1fr 90px 100px 120px 80px',
                alignItems: 'center', gap: 12, padding: '10px 20px',
                borderBottom: i < 5 ? `1px solid ${colors.borderSubtle}` : 'none',
              }}>
                <div style={{ ...shimmerStyle(16, 16), borderRadius: 3 }} />
                <div style={shimmerStyle(70, 13)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={shimmerStyle('80%', 13)} />
                  <div style={shimmerStyle('50%', 10)} />
                </div>
                <div style={shimmerStyle(60, 13)} />
                <div style={{ ...shimmerStyle(72, 20), borderRadius: borderRadius.full }} />
                <div style={shimmerStyle(90, 13)} />
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <div style={{ ...shimmerStyle(10, 10), borderRadius: '50%' }} />
                  <div style={{ ...shimmerStyle(8, 1) }} />
                  <div style={{ ...shimmerStyle(10, 10), borderRadius: '50%' }} />
                  <div style={{ ...shimmerStyle(8, 1) }} />
                  <div style={{ ...shimmerStyle(10, 10), borderRadius: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
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
      subtitle={`${openCount} active · ${overdueCount > 0 ? `${overdueCount} overdue` : 'none overdue'}`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {/* View Toggle */}
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
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 56, height: 56, padding: `0 ${spacing['3']}`, border: 'none', cursor: 'pointer',
                borderRadius: borderRadius.base,
                backgroundColor: viewMode === 'table' ? colors.surfaceRaised : 'transparent',
                color: viewMode === 'table' ? colors.textPrimary : colors.textTertiary,
                boxShadow: viewMode === 'table' ? shadows.sm : 'none',
                transition: `all ${transitions.quick}`,
              }}
              onClick={() => setViewMode('table')}
              title="List View" aria-label="List View"
            >
              <List size={14} />
            </button>
            <button
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 56, height: 56, padding: `0 ${spacing['3']}`, border: 'none', cursor: 'pointer',
                borderRadius: borderRadius.base,
                backgroundColor: viewMode === 'kanban' ? colors.surfaceRaised : 'transparent',
                color: viewMode === 'kanban' ? colors.textPrimary : colors.textTertiary,
                boxShadow: viewMode === 'kanban' ? shadows.sm : 'none',
                transition: `all ${transitions.quick}`,
              }}
              onClick={() => setViewMode('kanban')}
              title="Board View" aria-label="Board View"
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_Submittal_Log" />
          <PresenceAvatars page="submittals" size={28} />

          {/* New Submittal */}
          <PermissionGate permission="submittals.create">
            <Btn onClick={() => setShowCreateModal(true)}>+ New Submittal</Btn>
          </PermissionGate>
        </div>
      }
    >
      {/* Predictive alerts */}
      {pageAlerts.map((alert) => (
        <div key={alert.id} style={{ marginBottom: spacing['3'] }}>
          <PredictiveAlertBanner alert={alert} />
        </div>
      ))}

      {/* ─── Premium KPI Cards ────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
        <SubmittalKPIs
          totalCount={totalCount}
          pendingReviewCount={pendingReviewCount}
          overdueCount={overdueCount}
          approvedCount={approvedCount}
          avgDaysInReview={avgDaysInReview}
          closedThisWeek={approvedThisWeek}
        />
      </motion.div>

      {/* ─── Section Header: "Submittal Register" ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{
            margin: 0, fontSize: typography.fontSize.subtitle,
            fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
            letterSpacing: typography.letterSpacing.tight,
          }}>
            Submittal Register
          </h2>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 22, padding: '0 7px',
            borderRadius: borderRadius.full,
            backgroundColor: colors.primaryOrange + '14',
            color: colors.primaryOrange,
            fontSize: 12, fontWeight: 700,
          }}>
            {totalCount}
          </span>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: borderRadius.full,
          backgroundColor: colors.surfaceInset,
          fontSize: 11, fontWeight: 500, color: colors.textTertiary,
          letterSpacing: '0.01em',
        }}>
          ↑/↓ navigate · Enter open
        </span>
      </motion.div>

      {/* ─── Table / Kanban Card ────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card padding="0">
          {/* Toolbar inside card: Tab Bar + Search + GroupBy */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderBottom: `1px solid ${colors.borderSubtle}`,
            flexWrap: 'wrap', gap: 12,
          }}>
            <SubmittalTabBar activeTab={statusFilter} onTabChange={setStatusFilter} counts={tabCounts} />
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
              {/* Search */}
              <div style={{ position: 'relative', width: 240 }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute', left: spacing['3'], top: '50%',
                    transform: 'translateY(-50%)', color: colors.textTertiary,
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
                    padding: `6px ${spacing['3']} 6px ${spacing['8']}`,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.full,
                    fontSize: 13, fontFamily: typography.fontFamily,
                    backgroundColor: colors.surfacePage, color: colors.textPrimary,
                    outline: 'none',
                    transition: `border-color ${transitions.quick}, box-shadow ${transitions.quick}`,
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
              {/* Group By (table mode only) */}
              {viewMode === 'table' && (
                <GroupBySelector value={groupBy} onChange={setGroupBy} />
              )}
            </div>
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
              allSubmittals={filteredSubmittals}
              onSelectSubmittal={(id) => setSelectedId(id)}
            />
          )}
        </Card>
      </motion.div>

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
