import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PageContainer, Card, Btn, useToast } from '../../components/Primitives';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import PunchListSkeleton from '../../components/field/PunchListSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { colors, spacing, typography } from '../../styles/theme';
import { usePunchItems } from '../../hooks/queries';
import { AlertTriangle, CheckSquare, RefreshCw, Camera } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { getPredictiveAlertsForPage } from '../../data/aiAnnotations';
import { toast } from 'sonner';
import { useProjectId } from '../../hooks/useProjectId';
import { useCreatePunchItem, useUpdatePunchItem } from '../../hooks/mutations';
import CreatePunchItemModal from '../../components/forms/CreatePunchItemModal';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { useCopilotStore } from '../../stores/copilotStore';

import type { PunchItem, Comment } from './types';
import { getDaysRemaining } from './types';
import { PunchListTable } from './PunchListTable';
import { PunchListDetail } from './PunchListDetail';
import { PunchListBulk } from './PunchListBulk';
import { PunchListFilters } from './PunchListFilters';

const PunchListPage: React.FC = () => {
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('punch-list'); }, [setPageContext]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [atRiskFilter, setAtRiskFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [editingDetail, setEditingDetail] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectNote, setShowRejectNote] = useState(false);
  const [inlineRejectId, setInlineRejectId] = useState<number | null>(null);
  const [inlineRejectNote, setInlineRejectNote] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { addToast } = useToast();
  const { hasPermission } = usePermissions();
  const projectId = useProjectId();
  const createPunchItem = useCreatePunchItem();
  const updatePunchItem = useUpdatePunchItem();

  // Fetch punch list items from API
  const { data: punchListResult, isLoading: loading, error: punchError, refetch } = usePunchItems(projectId);
  const punchListRaw = punchListResult?.data ?? [];

  const pageAlerts = getPredictiveAlertsForPage('punchlist');

  // Map API data to component shape
  const punchListItems: PunchItem[] = useMemo(() => {
    return punchListRaw.map((p: unknown) => {
      const pp = p as Record<string, unknown>;
      const photos = Array.isArray(pp.photos) ? pp.photos : [];
      return {
        id: pp.id as number,
        itemNumber: `PL-${String(pp.number ?? '').padStart(3, '0')}`,
        area: [pp.floor, pp.area].filter(Boolean).join(', ') || (pp.location as string) || '',
        description: (pp.title as string) || (pp.description as string) || '',
        assigned: (pp.assigned_to as string) || '',
        priority: (pp.priority as string) || 'medium',
        status: (pp.status as string) || 'open',
        verification_status: (pp.verification_status as string) ?? 'open',
        verified_by: (pp.verified_by as string) ?? null,
        verified_at: (pp.verified_at as string) ?? null,
        sub_completed_at: (pp.sub_completed_at as string) ?? null,
        before_photo_url: (pp.before_photo_url as string) ?? null,
        after_photo_url: (pp.after_photo_url as string) ?? null,
        rejection_reason: (pp.rejection_reason as string) ?? null,
        hasPhoto: photos.length > 0,
        photoCount: photos.length,
        dueDate: (pp.due_date as string) || '',
        createdDate: pp.created_at ? (pp.created_at as string).slice(0, 10) : '',
        reportedBy: (pp.reported_by as string) || '',
        responsible: pp.trade === 'general' ? 'gc' : pp.trade === 'owner' ? 'owner' : 'subcontractor',
        trade: (pp.trade as string) || '',
        location: (pp.location as string) || '',
      };
    });
  }, [punchListRaw]);

  // Counts (memoized)
  const {
    openCount, inProgressCount, subCompleteCount, verifiedCount,
    totalCount, completionPct, overdueCount,
  } = useMemo(() => {
    let open = 0, inProgress = 0, subComplete = 0, verified = 0, rejected = 0, overdue = 0;
    let critical = 0, high = 0, medium = 0, low = 0;
    const now = new Date();
    for (const p of punchListItems) {
      if (p.verification_status === 'in_progress') inProgress++;
      else if (p.verification_status === 'sub_complete') subComplete++;
      else if (p.verification_status === 'verified') verified++;
      else if (p.verification_status === 'rejected') rejected++;
      else open++;
      if (p.priority === 'critical') critical++;
      else if (p.priority === 'high') high++;
      else if (p.priority === 'medium') medium++;
      else if (p.priority === 'low') low++;
      if (p.verification_status === 'open' && p.dueDate && new Date(p.dueDate) < now) overdue++;
    }
    const total = punchListItems.length;
    const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
    return {
      openCount: open, inProgressCount: inProgress, subCompleteCount: subComplete, verifiedCount: verified, rejectedCount: rejected,
      totalCount: total, completionPct: pct, overdueCount: overdue,
      criticalCount: critical, highCount: high, mediumCount: medium, lowCount: low,
    };
  }, [punchListItems]);

  // Areas for filter
  const uniqueAreas = useMemo(() => {
    const areas = punchListItems.map(p => {
      const parts = p.area.split(',');
      return parts[0].trim();
    });
    return ['all', ...Array.from(new Set(areas)).sort()];
  }, [punchListItems]);

  // Filter logic
  const filteredList = useMemo(() => {
    let list = punchListItems;
    if (statusFilter === 'overdue') {
      list = list.filter(p => p.dueDate && getDaysRemaining(p.dueDate) <= 0 && p.verification_status !== 'verified');
    } else if (statusFilter !== 'all') {
      list = list.filter(p => p.verification_status === statusFilter);
    }
    if (atRiskFilter) {
      list = list.filter(p => p.verification_status === 'open' && (p.priority === 'high' || p.priority === 'critical'));
    }
    if (areaFilter !== 'all') {
      list = list.filter(p => p.area.startsWith(areaFilter));
    }
    return list;
  }, [punchListItems, statusFilter, atRiskFilter, areaFilter]);

  const hasActiveFilters = atRiskFilter || areaFilter !== 'all' || statusFilter !== 'all';

  const clearAllFilters = useCallback(() => {
    setAtRiskFilter(false);
    setAreaFilter('all');
    setStatusFilter('all');
  }, []);

  const selected = punchListItems.find(p => p.id === selectedId) || null;
  const comments: Comment[] = []; // TODO: load from punch_item_comments query

  // ── Handlers for inline row actions ────────────────────
  const handleMarkInProgressById = useCallback(async (item: PunchItem) => {
    try {
      await updatePunchItem.mutateAsync({
        id: String(item.id),
        updates: { verification_status: 'in_progress' },
        projectId: projectId!,
      });
      toast.success(`${item.itemNumber} marked in progress.`);
      setAriaAnnouncement(`${item.itemNumber} marked in progress`);
    } catch {
      toast.error('Failed to update status');
    }
  }, [updatePunchItem, projectId]);

  const handleMarkSubCompleteById = useCallback(async (item: PunchItem) => {
    try {
      await updatePunchItem.mutateAsync({
        id: String(item.id),
        updates: { verification_status: 'sub_complete', sub_completed_at: new Date().toISOString() },
        projectId: projectId!,
      });
      toast.success(`${item.itemNumber} marked Sub Complete. Superintendent notified for verification.`);
      setAriaAnnouncement(`${item.itemNumber} marked Sub Complete`);
    } catch {
      toast.error('Failed to update status');
    }
  }, [updatePunchItem, projectId]);

  const handleVerifyById = useCallback(async (item: PunchItem) => {
    try {
      await updatePunchItem.mutateAsync({
        id: String(item.id),
        updates: { verification_status: 'verified', verified_at: new Date().toISOString() },
        projectId: projectId!,
      });
      toast.success(`${item.itemNumber} verified and closed.`);
      setAriaAnnouncement(`${item.itemNumber} verified and closed`);
    } catch {
      toast.error('Failed to verify item');
    }
  }, [updatePunchItem, projectId]);

  const handleRejectById = useCallback(async (item: PunchItem, reason: string) => {
    try {
      await updatePunchItem.mutateAsync({
        id: String(item.id),
        updates: { verification_status: 'open', rejection_reason: reason || undefined },
        projectId: projectId!,
      });
      toast.success(`${item.itemNumber} rejected. Returned to open.`);
      setAriaAnnouncement(`${item.itemNumber} rejected and returned to open`);
      setInlineRejectId(null);
      setInlineRejectNote('');
    } catch {
      toast.error('Failed to reject item');
    }
  }, [updatePunchItem, projectId]);

  // ── Handlers for detail panel actions ──────────────────
  const handleMarkInProgress = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: { verification_status: 'in_progress' },
        projectId: projectId!,
      });
      toast.success(`${selected.itemNumber} marked in progress.`);
      setAriaAnnouncement(`${selected.itemNumber} marked in progress`);
      setSelectedId(null);
    } catch {
      toast.error('Failed to update status');
    }
  }, [selected, updatePunchItem, projectId]);

  const handleMarkSubComplete = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: { verification_status: 'sub_complete', sub_completed_at: new Date().toISOString() },
        projectId: projectId!,
      });
      toast.success(`${selected.itemNumber} marked Sub Complete. Superintendent notified for verification.`);
      setAriaAnnouncement(`${selected.itemNumber} marked Sub Complete`);
      setSelectedId(null);
    } catch {
      toast.error('Failed to update status');
    }
  }, [selected, updatePunchItem, projectId]);

  const handleVerify = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: { verification_status: 'verified', verified_at: new Date().toISOString() },
        projectId: projectId!,
      });
      toast.success(`${selected.itemNumber} verified and closed.`);
      setAriaAnnouncement(`${selected.itemNumber} verified and closed`);
      setSelectedId(null);
    } catch {
      toast.error('Failed to verify item');
    }
  }, [selected, updatePunchItem, projectId]);

  const handleReject = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: { verification_status: 'open', rejection_reason: rejectNote || undefined },
        projectId: projectId!,
      });
      toast.error(`${selected.itemNumber} rejected. Subcontractor notified to rework.`);
      setAriaAnnouncement(`${selected.itemNumber} rejected`);
      setRejectNote('');
      setShowRejectNote(false);
      setSelectedId(null);
    } catch {
      toast.error('Failed to reject item');
    }
  }, [selected, updatePunchItem, projectId, rejectNote]);

  const handleAddPhoto = useCallback(() => {
    addToast('info', 'Photo capture loading');
  }, [addToast]);

  if (loading) {
    return (
      <PageContainer title="Punch List" subtitle="Loading...">
        <PunchListSkeleton />
      </PageContainer>
    );
  }

  if (punchError) {
    return (
      <PageContainer title="Punch List" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Failed to load punch list</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{(punchError as Error).message || 'Unable to fetch punch items'}</p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Try Again</Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (!punchListItems.length) {
    return (
      <PageContainer
        title="Punch List"
        subtitle="No items"
        actions={<PermissionGate permission="punch_list.create"><Btn onClick={() => setShowCreateModal(true)}>New Item</Btn></PermissionGate>}
      >
        <EmptyState
          icon={CheckSquare}
          title="No punch list items. Your project is looking clean!"
          description="Items will appear here as deficiencies are identified during inspections."
          action={{ label: 'Add Punch Item', onClick: () => setShowCreateModal(true) }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Punch List"
      subtitle={`${openCount} open \u00b7 ${subCompleteCount} pending verification \u00b7 ${verifiedCount} verified`}
      actions={<PermissionGate permission="punch_list.create"><Btn onClick={() => setShowCreateModal(true)}>New Item</Btn></PermissionGate>}
    >
      {/* Screen reader live region for status change announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {ariaAnnouncement}
      </div>

      <PunchListFilters
        isMobile={isMobile}
        pageAlerts={pageAlerts}
        completionPct={completionPct}
        totalCount={totalCount}
        openCount={openCount}
        inProgressCount={inProgressCount}
        subCompleteCount={subCompleteCount}
        verifiedCount={verifiedCount}
        overdueCount={overdueCount}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        atRiskFilter={atRiskFilter}
        setAtRiskFilter={setAtRiskFilter}
        areaFilter={areaFilter}
        setAreaFilter={setAreaFilter}
        uniqueAreas={uniqueAreas}
      />

      <PunchListTable
        filteredList={filteredList}
        hasActiveFilters={hasActiveFilters}
        clearAllFilters={clearAllFilters}
        isMobile={isMobile}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        bulkSelected={bulkSelected}
        setBulkSelected={setBulkSelected}
        hasPermission={hasPermission}
        updatePunchItem={updatePunchItem}
        projectId={projectId}
        inlineRejectId={inlineRejectId}
        setInlineRejectId={setInlineRejectId}
        inlineRejectNote={inlineRejectNote}
        setInlineRejectNote={setInlineRejectNote}
        handleMarkInProgressById={handleMarkInProgressById}
        handleMarkSubCompleteById={handleMarkSubCompleteById}
        handleVerifyById={handleVerifyById}
        handleRejectById={handleRejectById}
      />

      <PunchListDetail
        selected={selected}
        onClose={() => { setSelectedId(null); setEditingDetail(false); setShowRejectNote(false); setRejectNote(''); }}
        editingDetail={editingDetail}
        setEditingDetail={setEditingDetail}
        rejectNote={rejectNote}
        setRejectNote={setRejectNote}
        showRejectNote={showRejectNote}
        setShowRejectNote={setShowRejectNote}
        isMobile={isMobile}
        comments={comments}
        updatePunchItem={updatePunchItem}
        projectId={projectId}
        handleMarkInProgress={handleMarkInProgress}
        handleMarkSubComplete={handleMarkSubComplete}
        handleVerify={handleVerify}
        handleReject={handleReject}
        handleAddPhoto={handleAddPhoto}
      />

      <CreatePunchItemModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await createPunchItem.mutateAsync({
            projectId: projectId!,
            data: { ...data, project_id: projectId! },
          });
          toast.success('Punch item created: ' + (data.title || 'New Item'));
        }}
      />

      {/* Mobile FAB: quick punch item capture */}
      {isMobile && (
        <PermissionGate permission="punch_list.create">
          <button
            onClick={() => setShowCreateModal(true)}
            aria-label="Quick capture punch item"
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: colors.primaryOrange,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(244, 120, 32, 0.4)',
              zIndex: 100,
            }}
          >
            <Camera size={24} color="white" />
          </button>
        </PermissionGate>
      )}

      <PunchListBulk
        bulkSelected={bulkSelected}
        setBulkSelected={setBulkSelected}
        updatePunchItem={updatePunchItem}
        projectId={projectId}
      />
    </PageContainer>
  );
};

export const PunchList: React.FC = () => (
  <ErrorBoundary message="The punch list could not be displayed. Check your connection and try again.">
    <PunchListPage />
  </ErrorBoundary>
);

export default PunchList;
