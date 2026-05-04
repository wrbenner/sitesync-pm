/**
 * Punch List — enterprise inbox.
 *
 * Investor-readiness rewrite per `specs/homepage-redesign/DESIGN-RESET.md`:
 * full viewport, sticky header, dense default table, click-row-to-side-panel,
 * grouped By Trade and By Location views, On Plan view (drawing-overlay
 * machinery preserved), filter chips for status. Sub-scoped at the data layer
 * so subs only see their own items.
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { Plus, AlertTriangle, RefreshCw, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useToast } from '../../components/Primitives';
import { colors, spacing, typography } from '../../styles/theme';
import { usePunchItems, useProject } from '../../hooks/queries';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { useProjectId } from '../../hooks/useProjectId';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation';
import {
  useCreatePunchItem,
  useUpdatePunchItem,
  useDeletePunchItem,
} from '../../hooks/mutations';
import { useCopilotStore } from '../../stores/copilotStore';
import { usePunchListStore } from '../../stores/punchListStore';
import { usePhotoAnalysis } from '../../hooks/usePhotoAnalysis';
import { supabase } from '../../lib/supabase';
import { PermissionGate } from '../../components/auth/PermissionGate';
import PunchItemCreateWizard from '../../components/punch-list/PunchItemCreateWizard';
import { PunchListDetail } from './PunchListDetail';
import { PunchListPlanView } from './PunchListPlanView';
import { PunchListDenseTable } from './PunchListDenseTable';
import { PunchListGrouped } from './PunchListGrouped';
import type { PunchItem, Comment } from './types';

type ViewKey = 'table' | 'trade' | 'location' | 'plan';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'sub_complete' | 'verified';

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'table', label: 'Table' },
  { key: 'trade', label: 'By Trade' },
  { key: 'location', label: 'By Location' },
  { key: 'plan', label: 'On Plan' },
];

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'sub_complete', label: 'Awaiting Verification' },
  { key: 'verified', label: 'Closed' },
];

const EMPTY_COMMENTS: Array<{
  author: string;
  initials: string;
  created_at?: string;
  text: string;
}> = [];

// ── Map raw API row → PunchItem shape ──────────────────────────

function mapPunch(p: unknown): PunchItem {
  const pp = p as unknown as Record<string, unknown>;
  const photos = Array.isArray(pp.photos) ? pp.photos : [];
  return {
    id: pp.id as number,
    itemNumber: `PL-${String(pp.number ?? '').padStart(3, '0')}`,
    area:
      [pp.floor, pp.area].filter(Boolean).join(', ') || (pp.location as string) || '',
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
    responsible:
      pp.trade === 'general' ? 'gc' : pp.trade === 'owner' ? 'owner' : 'subcontractor',
    trade: (pp.trade as string) || '',
    location: (pp.location as string) || '',
  };
}

// ── Page ────────────────────────────────────────────────────────

const PunchListPage: React.FC = () => {
  const { setPageContext } = useCopilotStore();
  useEffect(() => {
    setPageContext('punch-list');
  }, [setPageContext]);

  const projectId = useProjectId();
  const { addToast } = useToast();
  const { hasPermission, role } = usePermissions();
  const { user } = useAuth();
  // project lookup retained for future header use; ignore unused-binding warning.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _project } = useProject(projectId);
  const {
    data: punchListResult,
    isLoading: queryLoading,
    error: punchError,
    refetch,
    fetchStatus,
  } = usePunchItems(projectId);
  useRealtimeInvalidation(projectId);
  const loading = queryLoading && fetchStatus === 'fetching';

  const createPunchItem = useCreatePunchItem();
  const updatePunchItem = useUpdatePunchItem();
  const deletePunchItem = useDeletePunchItem();

  const [view, setView] = useState<ViewKey>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectNote, setShowRejectNote] = useState(false);

  const isMobile = useIsMobile();

  // ── All items, mapped + sub-scoped ──
  // Sub-scope: when the actor's role is 'subcontractor', narrow to items where
  // `assigned_to` matches the user's email or full name. The Supabase RLS
  // layer is the source of truth; this is a defense-in-depth UI filter so a
  // sub never sees another sub's items even if RLS misconfigures.
  const allItems = useMemo<PunchItem[]>(() => {
    const raw = punchListResult?.data ?? [];
    let mapped = raw.map(mapPunch);
    if (role === 'subcontractor') {
      const handle =
        (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? '';
      const lower = handle.toLowerCase();
      if (lower) {
        mapped = mapped.filter((i) => i.assigned.toLowerCase() === lower);
      }
    }
    return mapped;
  }, [punchListResult?.data, role, user]);

  const counts = useMemo(() => {
    const total = allItems.length;
    const open = allItems.filter((i) => i.verification_status === 'open').length;
    const inProgress = allItems.filter(
      (i) => i.verification_status === 'in_progress',
    ).length;
    const subComplete = allItems.filter(
      (i) => i.verification_status === 'sub_complete',
    ).length;
    const verified = allItems.filter((i) => i.verification_status === 'verified').length;
    return { total, open, inProgress, subComplete, verified };
  }, [allItems]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return allItems;
    return allItems.filter((i) => i.verification_status === statusFilter);
  }, [allItems, statusFilter]);

  const selected = allItems.find((p) => p.id === selectedId) ?? null;

  // ── Comments wiring (preserved from prior page) ──
  const { loadComments, addComment } = usePunchListStore();
  useEffect(() => {
    if (selectedId) loadComments(String(selectedId));
  }, [selectedId, loadComments]);
  const selectedKey = String(selectedId ?? '');
  const storeComments = usePunchListStore(
    useCallback(
      (s: {
        comments: Record<
          string,
          Array<{ author: string; initials: string; created_at?: string; text: string }>
        >;
      }) => s.comments[selectedKey] ?? EMPTY_COMMENTS,
      [selectedKey],
    ),
  );
  const comments: Comment[] = useMemo(
    () =>
      storeComments.map((c) => ({
        author: c.author,
        initials: c.initials,
        time: c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
        text: c.text,
      })),
    [storeComments],
  );

  const handleAddComment = useCallback(
    async (text: string) => {
      if (!selected) return;
      const name = user?.user_metadata?.full_name || user?.email || 'You';
      const initials = name
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const result = await addComment(String(selected.id), name, initials, text);
      if (result.error) throw new Error(result.error);
    },
    [selected, user, addComment],
  );

  // ── Photo analysis (preserved) ──
  const {
    analyzePhoto,
    state: photoAnalysisState,
    result: photoAnalysisResult,
    error: photoAnalysisError,
  } = usePhotoAnalysis();
  useEffect(() => {
    if (photoAnalysisState === 'ready' && photoAnalysisResult) {
      const violations = photoAnalysisResult.safetyViolations.length;
      if (violations > 0)
        toast.warning(
          `AI detected ${violations} safety concern${violations > 1 ? 's' : ''}`,
        );
      else toast.success('AI photo analysis complete — no safety issues');
    } else if (photoAnalysisState === 'error' && photoAnalysisError) {
      toast.error(`Photo analysis failed: ${photoAnalysisError}`);
    }
  }, [photoAnalysisState, photoAnalysisResult, photoAnalysisError]);

  // ── Detail-panel mutation handlers (preserved contract) ──
  const handleMarkInProgress = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: { verification_status: 'in_progress' },
        projectId: projectId!,
      });
      toast.success(`${selected.itemNumber} marked in progress`);
      setSelectedId(null);
    } catch {
      toast.error('Failed to update');
    }
  }, [selected, updatePunchItem, projectId]);

  const handleMarkSubComplete = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: {
          verification_status: 'sub_complete',
          sub_completed_at: new Date().toISOString(),
        },
        projectId: projectId!,
      });
      toast.success(`${selected.itemNumber} marked complete — pending verification`);
      setSelectedId(null);
    } catch {
      toast.error('Failed to update');
    }
  }, [selected, updatePunchItem, projectId]);

  const handleVerify = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: {
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        },
        projectId: projectId!,
      });
      toast.success(`${selected.itemNumber} verified and closed`);
      setSelectedId(null);
    } catch {
      toast.error('Failed to verify');
    }
  }, [selected, updatePunchItem, projectId]);

  const handleReject = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: {
          verification_status: 'in_progress',
          rejection_reason: rejectNote || undefined,
        },
        projectId: projectId!,
      });
      toast.error(`${selected.itemNumber} rejected — returned to sub for rework`);
      setRejectNote('');
      setShowRejectNote(false);
      setSelectedId(null);
    } catch {
      toast.error('Failed to reject');
    }
  }, [selected, updatePunchItem, projectId, rejectNote]);

  const handleAddPhoto = useCallback(() => {
    if (!selected || !projectId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      addToast('info', 'Uploading photo...');
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${projectId}/${selected.id}/${Date.now()}.${ext}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from('punch-list-photos')
          .upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('punch-list-photos')
          .getPublicUrl(filePath);
        const publicUrl = urlData?.publicUrl;
        const photoField = selected.before_photo_url
          ? 'after_photo_url'
          : 'before_photo_url';
        await updatePunchItem.mutateAsync({
          id: String(selected.id),
          updates: { [photoField]: publicUrl },
          projectId: projectId!,
        });
        toast.success('Photo uploaded');
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) analyzePhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        toast.error(`Upload failed: ${(err as Error).message}`);
      }
    };
    input.click();
  }, [selected, projectId, addToast, updatePunchItem, analyzePhoto]);

  // ── Keyboard nav: j/k/Enter/c ──
  // The nav steers off the currently rendered list (filteredItems), not the
  // raw set, so 'j' inside the "Open" filter doesn't surface verified items.
  const filteredRef = useRef<PunchItem[]>([]);
  useEffect(() => {
    filteredRef.current = filteredItems;
  }, [filteredItems]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
        return;
      const list = filteredRef.current;
      if (list.length === 0) return;

      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const idx = selectedId ? list.findIndex((p) => p.id === selectedId) : -1;
        const nextIdx =
          e.key === 'j'
            ? Math.min(list.length - 1, idx < 0 ? 0 : idx + 1)
            : Math.max(0, idx < 0 ? 0 : idx - 1);
        setSelectedId(list[nextIdx].id);
      } else if (e.key === 'Enter') {
        if (selectedId) {
          // Explicit "open detail" — ensures focus is on the panel, even when
          // the row was just navigated to via j/k (panel already mounts on
          // selection, so this is a no-op when expanded).
          setEditingDetail(false);
        }
      } else if (e.key === 'c' && selectedId) {
        const item = list.find((p) => p.id === selectedId);
        if (!item) return;
        if (item.verification_status === 'verified') {
          toast.info(`${item.itemNumber} is already verified`);
          return;
        }
        // 'c' walks an item one step toward Verified along the existing
        // open → in_progress → sub_complete → verified pipeline.
        const next: Record<string, string> = {
          open: 'sub_complete',
          rejected: 'sub_complete',
          in_progress: 'sub_complete',
          sub_complete: 'verified',
        };
        const newStatus = next[item.verification_status];
        if (!newStatus) return;
        const extras: Record<string, unknown> = {};
        if (newStatus === 'sub_complete')
          extras.sub_completed_at = new Date().toISOString();
        if (newStatus === 'verified') extras.verified_at = new Date().toISOString();
        updatePunchItem
          .mutateAsync({
            id: String(item.id),
            updates: { verification_status: newStatus, ...extras },
            projectId: projectId!,
          })
          .then(() => toast.success(`${item.itemNumber} → ${newStatus.replace(/_/g, ' ')}`))
          .catch(() => toast.error('Failed to update'));
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingDetail(false);
        setShowRejectNote(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, updatePunchItem, projectId]);

  // ── Render ──
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#FCFCFA',
        fontFamily: typography.fontFamily,
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#FCFCFA',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          paddingLeft: spacing[6],
          paddingRight: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: spacing[3],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[3],
        }}
      >
        {/* Row 1 — title + count chip + view toggle + new */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[4],
            flexWrap: 'wrap',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: colors.textPrimary,
              letterSpacing: '-0.01em',
            }}
          >
            Punch List
          </h1>
          <CountChip
            total={counts.total}
            open={counts.open}
            verified={counts.verified}
          />

          <div
            role="tablist"
            aria-label="Punch list views"
            style={{
              display: 'inline-flex',
              background: '#F1ECE2',
              borderRadius: 6,
              padding: 2,
            }}
          >
            {VIEWS.map((v) => {
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setView(v.key)}
                  style={{
                    padding: '6px 14px',
                    border: 'none',
                    borderRadius: 4,
                    background: active ? colors.surfaceRaised : 'transparent',
                    color: active ? colors.textPrimary : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 2px rgba(26, 22, 19, 0.04)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          <PermissionGate
            permission="punch_list.create"
            fallback={
              <button
                type="button"
                disabled
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: colors.surfaceInset,
                  border: 'none',
                  borderRadius: 6,
                  color: colors.textTertiary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'not-allowed',
                }}
              >
                <Plus size={14} aria-hidden="true" />
                New Punch
              </button>
            }
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              data-testid="create-punch-item-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: colors.primaryOrange,
                border: 'none',
                borderRadius: 6,
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} aria-hidden="true" />
              New Punch
            </button>
          </PermissionGate>
        </div>

        {/* Row 2 — filter chips */}
        <div
          role="tablist"
          aria-label="Punch list filters"
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
        >
          {FILTERS.map((f) => {
            const active = statusFilter === f.key;
            const count =
              f.key === 'all'
                ? counts.total
                : f.key === 'open'
                  ? counts.open
                  : f.key === 'in_progress'
                    ? counts.inProgress
                    : f.key === 'sub_complete'
                      ? counts.subComplete
                      : counts.verified;
            return (
              <button
                key={f.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: active ? colors.textPrimary : 'transparent',
                  color: active ? '#FFFFFF' : colors.textSecondary,
                  border: active ? 'none' : `1px solid ${colors.borderSubtle}`,
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    opacity: 0.8,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <main
        style={{
          paddingLeft: spacing[6],
          paddingRight: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: spacing[8],
        }}
      >
        {punchError && !loading ? (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[3],
              padding: spacing[3],
              background: '#FCE7E7',
              border: '1px solid rgba(201, 59, 59, 0.20)',
              borderRadius: 6,
              color: '#9A2929',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              Failed to load punch list:{' '}
              {(punchError as Error).message || 'Check your connection and try again.'}
            </span>
            <button
              type="button"
              onClick={() => refetch()}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                background: 'transparent',
                border: '1px solid rgba(201, 59, 59, 0.40)',
                borderRadius: 4,
                color: '#9A2929',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : loading && allItems.length === 0 ? (
          <div
            role="status"
            style={{
              padding: spacing[8],
              textAlign: 'center',
              color: colors.textTertiary,
              fontSize: 13,
            }}
          >
            Loading punch list…
          </div>
        ) : allItems.length === 0 ? (
          <div
            style={{
              padding: spacing[8],
              textAlign: 'center',
              color: colors.textSecondary,
              fontSize: 14,
            }}
          >
            No punch items yet.{' '}
            {hasPermission('punch_list.create')
              ? 'Tap "New Punch" to add the first one.'
              : ''}
          </div>
        ) : view === 'plan' ? (
          <PunchListPlanView items={filteredItems} onSelectItem={(id) => setSelectedId(id)} />
        ) : view === 'trade' ? (
          <PunchListGrouped
            items={filteredItems}
            groupBy="trade"
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : view === 'location' ? (
          <PunchListGrouped
            items={filteredItems}
            groupBy="location"
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <PunchListDenseTable
            items={filteredItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}

        {allItems.length > 0 && (
          <div
            style={{
              marginTop: spacing[3],
              fontSize: 11,
              color: colors.textTertiary,
              fontFamily: typography.fontFamily,
            }}
          >
            <kbd style={kbd}>j</kbd>/<kbd style={kbd}>k</kbd> move ·{' '}
            <kbd style={kbd}>Enter</kbd> open · <kbd style={kbd}>c</kbd> mark complete ·{' '}
            <kbd style={kbd}>Esc</kbd> close
          </div>
        )}
      </main>

      {/* Slide-in detail panel — preserved component */}
      <PunchListDetail
        selected={selected}
        onClose={() => {
          setSelectedId(null);
          setEditingDetail(false);
          setShowRejectNote(false);
          setRejectNote('');
        }}
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
        projectId={projectId ?? null}
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
          toast.success(
            'Punch item created: ' + ((data.title as string) || 'New Item'),
          );
        }}
      />

      {isMobile && hasPermission('punch_list.create') && (
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          aria-label="Quick capture punch item"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: colors.primaryOrange,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(244, 120, 32, 0.40)',
            zIndex: 100,
          }}
        >
          <Camera size={22} color="white" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

// ── CountChip ──
function CountChip({
  total,
  open,
  verified,
}: {
  total: number;
  open: number;
  verified: number;
}) {
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        background: '#F1ECE2',
        fontFamily: typography.fontFamily,
        fontSize: 12,
        fontWeight: 500,
        color: colors.textSecondary,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ fontWeight: 600, color: colors.textPrimary }}>{total}</span>
      total
      <span style={{ opacity: 0.4 }}>·</span>
      <span style={{ color: colors.statusPending }}>{open}</span> open
      <span style={{ opacity: 0.4 }}>·</span>
      <span style={{ color: colors.moss }}>{pct}% verified</span>
    </span>
  );
}

// ── isMobile hook (local) ──
function useIsMobile(): boolean {
  const [m, setM] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const onResize = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return m;
}

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '0 4px',
  margin: '0 2px',
  fontFamily: typography.fontFamilyMono,
  fontSize: 10,
  background: '#F1ECE2',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: 3,
  color: colors.textSecondary,
};

export const PunchList: React.FC = () => (
  <ErrorBoundary message="The punch list could not be displayed. Check your connection and try again.">
    <PunchListPage />
  </ErrorBoundary>
);

export default PunchList;
