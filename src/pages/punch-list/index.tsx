import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageContainer, Card, Btn, useToast } from '../../components/Primitives';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import PunchListSkeleton from '../../components/field/PunchListSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { colors, spacing, typography } from '../../styles/theme';
import { usePunchItems, useProject } from '../../hooks/queries';
import { exportPunchListXlsx } from '../../lib/exportXlsx';
import { ExportButton } from '../../components/shared/ExportButton';
import {
  AlertTriangle, CheckSquare, RefreshCw, Camera, List, LayoutGrid,
  Plus, Map, X,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { getPredictiveAlertsForPage } from '../../data/aiAnnotations';
import { toast } from 'sonner';
import { useProjectId } from '../../hooks/useProjectId';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation';
import { useCreatePunchItem, useUpdatePunchItem, useDeletePunchItem } from '../../hooks/mutations';
import PunchItemCreateWizard from '../../components/punch-list/PunchItemCreateWizard';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { useCopilotStore } from '../../stores/copilotStore';
import { usePunchListStore } from '../../stores/punchListStore';
import { usePhotoAnalysis } from '../../hooks/usePhotoAnalysis';
import { supabase } from '../../lib/supabase';
import { PunchListReport } from '../../components/export/PunchListReport';

import type { PunchItem, Comment } from './types';
import { getDaysRemaining } from './types';
import { PunchListTable } from './PunchListTable';
import { PunchListDetail } from './PunchListDetail';
import { PunchListBulk } from './PunchListBulk';
import { PunchListFilters } from './PunchListFilters';
import { PunchListKanban } from './PunchListKanban';
import { PunchListPlanView } from './PunchListPlanView';
import { PresenceAvatars } from '../../components/shared/PresenceAvatars';

// Stable empty array to avoid infinite re-render with Zustand + useSyncExternalStore
const EMPTY_COMMENTS: Array<{ author: string; initials: string; created_at?: string; text: string }> = [];

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
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'plans'>('list');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ref lets the keyboard handler read the latest filteredList without
  // referencing it in the dep array (the variable is declared below).
  const filteredListRef = useRef<PunchItem[]>([]);

  // ── Keyboard shortcuts (Linear-inspired) ──────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;

      // Navigation: J/K for next/prev item
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const list = filteredListRef.current;
        const currentIdx = selectedId ? list.findIndex(p => p.id === selectedId) : -1;
        const nextIdx = e.key === 'j'
          ? Math.min(currentIdx + 1, list.length - 1)
          : Math.max(currentIdx - 1, 0);
        if (list[nextIdx]) setSelectedId(list[nextIdx].id);
      }
      // Escape: close detail panel
      if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingDetail(false);
        setShowRejectNote(false);
      }
      // N: new item
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowCreateModal(true);
      }
      // 1/2/3: switch view modes
      if (e.key === '1') setViewMode('list');
      if (e.key === '2') setViewMode('kanban');
      if (e.key === '3') setViewMode('plans');
      // ?: show shortcuts
      if (e.key === '?') setShowShortcuts(s => !s);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  const { addToast } = useToast();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const projectId = useProjectId();
  const createPunchItem = useCreatePunchItem();
  const updatePunchItem = useUpdatePunchItem();
  const deletePunchItem = useDeletePunchItem();

  // Fetch punch list items from API
  const { data: punchListResult, isLoading: queryLoading, error: punchError, refetch, fetchStatus } = usePunchItems(projectId);
  const punchListRaw = useMemo(() => punchListResult?.data ?? [], [punchListResult?.data]);
  const { data: project } = useProject(projectId);
  useRealtimeInvalidation(projectId);
  const loading = queryLoading && fetchStatus === 'fetching';

  const handleExportXlsx = useCallback(() => {
    const projectName = project?.name ?? 'Project';
    const rows = punchListRaw.map((p) => {
      const rec = p as Record<string, unknown>;
      return {
        number: String(rec.number ?? rec.id ?? ''),
        area: (rec.location as string) ?? (rec.area as string) ?? '',
        description: (rec.title as string) ?? (rec.description as string) ?? '',
        assignedTo: (rec.assigned_to as string) ?? '',
        priority: (rec.priority as string) ?? '',
        status: (rec.status as string) ?? '',
        dueDate: (rec.due_date as string) ?? '',
      };
    });
    exportPunchListXlsx(projectName, rows);
  }, [project?.name, punchListRaw]);

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

  // Counts
  const {
    openCount, inProgressCount, subCompleteCount, verifiedCount,
    totalCount, completionPct, overdueCount,
  } = useMemo(() => {
    let open = 0, inProgress = 0, subComplete = 0, verified = 0, overdue = 0;
    const now = new Date();
    for (const p of punchListItems) {
      if (p.verification_status === 'in_progress') inProgress++;
      else if (p.verification_status === 'sub_complete') subComplete++;
      else if (p.verification_status === 'verified') verified++;
      else open++;
      if (p.verification_status === 'open' && p.dueDate && new Date(p.dueDate) < now) overdue++;
    }
    const total = punchListItems.length;
    const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { openCount: open, inProgressCount: inProgress, subCompleteCount: subComplete, verifiedCount: verified, totalCount: total, completionPct: pct, overdueCount: overdue };
  }, [punchListItems]);

  // Areas for filter
  const uniqueAreas = useMemo(() => {
    const areas = punchListItems.map(p => p.area.split(',')[0].trim());
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

  // Keep the ref in sync so the J/K keyboard handler reads the latest list.
  useEffect(() => { filteredListRef.current = filteredList; }, [filteredList]);

  const hasActiveFilters = atRiskFilter || areaFilter !== 'all' || statusFilter !== 'all';

  const clearAllFilters = useCallback(() => {
    setAtRiskFilter(false);
    setAreaFilter('all');
    setStatusFilter('all');
  }, []);

  const selected = punchListItems.find(p => p.id === selectedId) || null;

  // ── Comments ──────────────────────────────────────────
  const { loadComments, addComment } = usePunchListStore();
  useEffect(() => {
    if (selectedId) loadComments(String(selectedId));
  }, [selectedId, loadComments]);
  const selectedKey = String(selectedId ?? '');
  const storeComments = usePunchListStore(
    useCallback((s: { comments: Record<string, Array<{ author: string; initials: string; created_at?: string; text: string }>> }) => s.comments[selectedKey] ?? EMPTY_COMMENTS, [selectedKey])
  );
  const comments: Comment[] = useMemo(() => {
    return storeComments.map((c) => ({
      author: c.author, initials: c.initials,
      time: c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
      text: c.text,
    }));
  }, [storeComments]);

  const handleAddComment = useCallback(async (text: string) => {
    if (!selected) return;
    const name = user?.user_metadata?.full_name || user?.email || 'You';
    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const result = await addComment(String(selected.id), name, initials, text);
    if (result.error) throw new Error(result.error);
  }, [selected, user, addComment]);

  // ── Photo analysis ────────────────────────────────────
  const { analyzePhoto, state: photoAnalysisState, result: photoAnalysisResult, error: photoAnalysisError } = usePhotoAnalysis();
  useEffect(() => {
    if (photoAnalysisState === 'ready' && photoAnalysisResult) {
      const violations = photoAnalysisResult.safetyViolations.length;
      if (violations > 0) toast.warning(`AI detected ${violations} safety concern${violations > 1 ? 's' : ''}`);
      else toast.success('AI photo analysis complete — no safety issues');
    } else if (photoAnalysisState === 'error' && photoAnalysisError) {
      toast.error(`Photo analysis failed: ${photoAnalysisError}`);
    }
  }, [photoAnalysisState, photoAnalysisResult, photoAnalysisError]);

  // ── Handlers ──────────────────────────────────────────
  const handleMarkInProgressById = useCallback(async (item: PunchItem) => {
    try {
      await updatePunchItem.mutateAsync({ id: String(item.id), updates: { verification_status: 'in_progress' }, projectId: projectId! });
      toast.success(`${item.itemNumber} marked in progress`);
      setAriaAnnouncement(`${item.itemNumber} marked in progress`);
    } catch { toast.error('Failed to update'); }
  }, [updatePunchItem, projectId]);

  const handleMarkSubCompleteById = useCallback(async (item: PunchItem) => {
    try {
      await updatePunchItem.mutateAsync({ id: String(item.id), updates: { verification_status: 'sub_complete', sub_completed_at: new Date().toISOString() }, projectId: projectId! });
      toast.success(`${item.itemNumber} marked complete — pending verification`);
      setAriaAnnouncement(`${item.itemNumber} marked Sub Complete`);
    } catch { toast.error('Failed to update'); }
  }, [updatePunchItem, projectId]);

  const handleVerifyById = useCallback(async (item: PunchItem) => {
    try {
      await updatePunchItem.mutateAsync({ id: String(item.id), updates: { verification_status: 'verified', verified_at: new Date().toISOString() }, projectId: projectId! });
      toast.success(`${item.itemNumber} verified and closed`);
      setAriaAnnouncement(`${item.itemNumber} verified`);
    } catch { toast.error('Failed to verify'); }
  }, [updatePunchItem, projectId]);

  const handleRejectById = useCallback(async (item: PunchItem, reason: string) => {
    try {
      await updatePunchItem.mutateAsync({ id: String(item.id), updates: { verification_status: 'in_progress', rejection_reason: reason || undefined }, projectId: projectId! });
      toast.success(`${item.itemNumber} rejected — returned to sub for rework`);
      setAriaAnnouncement(`${item.itemNumber} rejected`);
      setInlineRejectId(null);
      setInlineRejectNote('');
    } catch { toast.error('Failed to reject'); }
  }, [updatePunchItem, projectId]);

  // Detail panel actions
  const handleMarkInProgress = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { verification_status: 'in_progress' }, projectId: projectId! });
      toast.success(`${selected.itemNumber} marked in progress`);
      setSelectedId(null);
    } catch { toast.error('Failed to update'); }
  }, [selected, updatePunchItem, projectId]);

  const handleMarkSubComplete = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { verification_status: 'sub_complete', sub_completed_at: new Date().toISOString() }, projectId: projectId! });
      toast.success(`${selected.itemNumber} marked complete — pending verification`);
      setSelectedId(null);
    } catch { toast.error('Failed to update'); }
  }, [selected, updatePunchItem, projectId]);

  const handleVerify = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { verification_status: 'verified', verified_at: new Date().toISOString() }, projectId: projectId! });
      toast.success(`${selected.itemNumber} verified and closed`);
      setSelectedId(null);
    } catch { toast.error('Failed to verify'); }
  }, [selected, updatePunchItem, projectId]);

  const handleReject = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { verification_status: 'in_progress', rejection_reason: rejectNote || undefined }, projectId: projectId! });
      toast.error(`${selected.itemNumber} rejected — returned to sub for rework`);
      setRejectNote(''); setShowRejectNote(false); setSelectedId(null);
    } catch { toast.error('Failed to reject'); }
  }, [selected, updatePunchItem, projectId, rejectNote]);

  const handleAddPhoto = useCallback(() => {
    if (!selected || !projectId) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      addToast('info', 'Uploading photo...');
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${projectId}/${selected.id}/${Date.now()}.${ext}`;
      try {
        const { error: uploadError } = await supabase.storage.from('punch-list-photos').upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('punch-list-photos').getPublicUrl(filePath);
        const publicUrl = urlData?.publicUrl;
        const photoField = selected.before_photo_url ? 'after_photo_url' : 'before_photo_url';
        await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { [photoField]: publicUrl }, projectId: projectId! });
        toast.success('Photo uploaded');
        const reader = new FileReader();
        reader.onload = () => { if (reader.result) analyzePhoto(reader.result as string); };
        reader.readAsDataURL(file);
      } catch (err) { toast.error(`Upload failed: ${(err as Error).message}`); }
    };
    input.click();
  }, [selected, projectId, addToast, updatePunchItem, analyzePhoto]);

  // Kanban drag
  const handleKanbanMove = useCallback(async (itemId: string | number, _from: string, toColumn: string) => {
    const statusMap: Record<string, string> = { open: 'open', in_progress: 'in_progress', sub_complete: 'sub_complete', verified: 'verified' };
    const newStatus = statusMap[toColumn];
    if (!newStatus) return;
    const extras: Record<string, unknown> = {};
    if (newStatus === 'sub_complete') extras.sub_completed_at = new Date().toISOString();
    if (newStatus === 'verified') extras.verified_at = new Date().toISOString();
    try {
      await updatePunchItem.mutateAsync({ id: String(itemId), updates: { verification_status: newStatus, ...extras }, projectId: projectId! });
      const item = punchListItems.find(p => p.id === itemId);
      toast.success(`${item?.itemNumber ?? 'Item'} moved to ${toColumn.replace(/_/g, ' ')}`);
    } catch { toast.error('Failed to move item'); }
  }, [updatePunchItem, projectId, punchListItems]);

  // ── Loading / Error / Empty states ────────────────────
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: colors.statusCriticalSubtle,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={28} color={colors.statusCritical} />
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: colors.textPrimary, margin: 0, marginBottom: 4 }}>
                Failed to load punch list
              </p>
              <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0 }}>
                {(punchError as Error).message || 'Check your connection and try again.'}
              </p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>
              Try Again
            </Btn>
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
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_Punch_List"
              pdfDocument={<PunchListReport projectName={project?.name ?? 'Project'} items={[]} />}
            />
            <PermissionGate permission="punch_list.create"
              fallback={<Btn onClick={() => toast.error("You don't have permission to create items")}>New Item</Btn>}
            >
              <Btn onClick={() => setShowCreateModal(true)} data-testid="create-punch-item-button">
                New Item
              </Btn>
            </PermissionGate>
          </div>
        }
      >
        <EmptyState
          icon={CheckSquare}
          title="No punch list items yet"
          description="Items will appear here as deficiencies are identified during inspections. Snap a photo to get started."
          action={hasPermission('punch_list.create')
            ? { label: 'Add Punch Item', onClick: () => setShowCreateModal(true) }
            : { label: 'Add Punch Item', onClick: () => toast.error("You don't have permission to create items") }
          }
        />

        <PunchItemCreateWizard
          projectId={projectId!}
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            await createPunchItem.mutateAsync({ projectId: projectId!, data });
            toast.success('Punch item created: ' + ((data.title as string) || 'New Item'));
          }}
        />
      </PageContainer>
    );
  }

  // ── Main Render ───────────────────────────────────────
  return (
    <PageContainer
      title="Punch List"
      subtitle={`${openCount} open · ${subCompleteCount} pending · ${verifiedCount} closed`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PresenceAvatars page="punch-list" size={28} />

          {/* View toggle — minimal, refined, 3-way */}
          <div style={{
            display: 'flex',
            backgroundColor: colors.surfaceInset,
            borderRadius: 10,
            padding: 3,
          }}>
            {([
              { mode: 'list' as const, icon: List, label: 'List view', key: '1' },
              { mode: 'kanban' as const, icon: LayoutGrid, label: 'Board view', key: '2' },
              { mode: 'plans' as const, icon: Map, label: 'Plans view', key: '3' },
            ]).map(({ mode, icon: Icon, label, key }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-label={`${label} (${key})`}
                aria-pressed={viewMode === mode}
                title={`${label} (${key})`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 28, border: 'none', cursor: 'pointer',
                  borderRadius: 7,
                  backgroundColor: viewMode === mode ? colors.surfaceRaised : 'transparent',
                  color: viewMode === mode ? colors.textPrimary : colors.textTertiary,
                  boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>

          <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_Punch_List"
            pdfDocument={
              <PunchListReport projectName={project?.name ?? 'Project'}
                items={punchListItems.map(p => ({
                  itemNumber: p.itemNumber, area: p.area, description: p.description,
                  assigned: p.assigned, priority: p.priority, status: p.verification_status,
                }))}
              />
            }
          />

          <PermissionGate permission="punch_list.create"
            fallback={<Btn onClick={() => toast.error("You don't have permission to create items")}>New Item</Btn>}
          >
            <button
              onClick={() => setShowCreateModal(true)}
              data-testid="create-punch-item-button"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                border: 'none', cursor: 'pointer',
                backgroundColor: colors.primaryOrange,
                color: colors.white,
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                transition: 'all 0.15s',
                boxShadow: '0 2px 8px rgba(244, 120, 32, 0.3)',
              }}
            >
              <Plus size={15} /> New Item
            </button>
          </PermissionGate>
        </div>
      }
    >
      {/* Screen reader live region */}
      <div aria-live="polite" aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
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

      {viewMode === 'list' ? (
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
      ) : viewMode === 'kanban' ? (
        <PunchListKanban
          items={filteredList}
          onSelectItem={(id) => setSelectedId(id)}
          onMoveItem={handleKanbanMove}
        />
      ) : (
        <PunchListPlanView
          items={filteredList}
          onSelectItem={(id) => setSelectedId(id)}
        />
      )}

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
        deletePunchItem={deletePunchItem}
        projectId={projectId}
        handleMarkInProgress={handleMarkInProgress}
        handleMarkSubComplete={handleMarkSubComplete}
        handleVerify={handleVerify}
        handleReject={handleReject}
        handleAddPhoto={handleAddPhoto}
        onAddComment={handleAddComment}
      />

      <PunchItemCreateWizard
        projectId={projectId!}
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await createPunchItem.mutateAsync({ projectId: projectId!, data });
          toast.success('Punch item created: ' + ((data.title as string) || 'New Item'));
        }}
      />

      {/* Mobile FAB */}
      {isMobile && (
        <PermissionGate permission="punch_list.create">
          <button
            onClick={() => setShowCreateModal(true)}
            aria-label="Quick capture punch item"
            style={{
              position: 'fixed', bottom: 24, right: 24,
              width: 56, height: 56, borderRadius: '50%',
              backgroundColor: colors.primaryOrange,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(244, 120, 32, 0.45)',
              zIndex: 100,
              transition: 'transform 0.2s, box-shadow 0.2s',
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
        deletePunchItem={deletePunchItem}
        projectId={projectId}
      />

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: 16,
              padding: '28px 32px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              minWidth: 340,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>Keyboard Shortcuts</span>
              <button
                onClick={() => setShowShortcuts(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>
            {[
              { key: 'J / K', desc: 'Next / Previous item' },
              { key: 'N', desc: 'New punch item' },
              { key: 'Esc', desc: 'Close detail panel' },
              { key: '1', desc: 'List view' },
              { key: '2', desc: 'Board view' },
              { key: '3', desc: 'Plans view' },
              { key: '?', desc: 'Toggle shortcuts' },
            ].map(s => (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}>
                <span style={{ fontSize: 13, color: colors.textSecondary }}>{s.desc}</span>
                <kbd style={{
                  padding: '2px 8px', borderRadius: 5,
                  fontSize: 12, fontWeight: 600,
                  fontFamily: typography.fontFamilyMono,
                  backgroundColor: colors.surfaceInset,
                  border: `1px solid ${colors.borderDefault}`,
                  color: colors.textPrimary,
                }}>
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shortcuts hint (bottom-right) */}
      {!isMobile && !showShortcuts && (
        <button
          onClick={() => setShowShortcuts(true)}
          title="Keyboard shortcuts (?)"
          style={{
            position: 'fixed', bottom: 16, right: 16, zIndex: 50,
            width: 28, height: 28, borderRadius: 7,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: colors.textTertiary,
            fontFamily: typography.fontFamilyMono,
          }}
        >
          ?
        </button>
      )}
    </PageContainer>
  );
};

export const PunchList: React.FC = () => (
  <ErrorBoundary message="The punch list could not be displayed. Check your connection and try again.">
    <PunchListPage />
  </ErrorBoundary>
);

export default PunchList;
