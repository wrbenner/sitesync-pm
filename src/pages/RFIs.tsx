import React, { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { VirtualDataTable } from '../components/shared/VirtualDataTable';
import { BulkActionBar } from '../components/shared/BulkActionBar';
import { createColumnHelper } from '@tanstack/react-table';
import { PageContainer, Btn, StatusTag, PriorityTag, DetailPanel, Avatar, RelatedItems, useToast, EmptyState } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../styles/theme';
import { RFIKPIs } from './rfis/RFIKPIs';
import { RFITabBar, type RFIStatusFilter } from './rfis/RFITabBar';
import { useRFIs, useRFI, useProject } from '../hooks/queries';
import { exportRFILogXlsx } from '../lib/exportXlsx';
import { ExportButton } from '../components/shared/ExportButton';
import { AlertTriangle, FileQuestion, FilterX, Plus, MessageSquare, Calendar, RefreshCw, Send, Sparkles, LayoutGrid, List, UserCheck, Flag, Download, XCircle, Wand2, Loader2, X, AlertCircle, ChevronRight, DollarSign } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForRfi } from '../utils/connections';
import { useCreateRFI, useUpdateRFI, useDeleteRFI, useCreateRFIResponse } from '../hooks/mutations';
import { useProjectId } from '../hooks/useProjectId';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation';
import { useNavigate } from 'react-router-dom';
import { useCopilotStore } from '../stores/copilotStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PermissionGate } from '../components/auth/PermissionGate';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner, PageInsightBanners } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { KanbanBoard } from '../components/shared/KanbanBoard';
import type { KanbanColumn } from '../components/shared/KanbanBoard';
import RFICreateWizard from '../components/rfis/RFICreateWizard';
import { EditableDetailField } from '../components/forms/EditableField';
import { toast } from 'sonner';
import type { RFI } from '../types/entities';

/** RFI row enriched with computed display fields. */
type RFIRow = RFI & {
  rfiNumber: string;
  from: string;
  to: string;
  submitDate: string;
  dueDate: string;
};
import { PresenceAvatars } from '../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../components/ui/EditingLockBanner';
import { useReducedMotion } from '../hooks/useReducedMotion';

const QuickRFIButton = lazy(() => import('../components/field/QuickRFIButton'));

const isOverdue = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d < new Date();
};

const BIC_COLORS: Record<string, string> = {
  GC: colors.statusInfo,
  Architect: colors.statusReview,
  Engineer: '#4EC896',
  Owner: colors.brand400,
  Subcontractor: colors.gray500,
  Sub: colors.gray500,
};

const getBicColor = (party: string): string => {
  if (BIC_COLORS[party]) return BIC_COLORS[party];
  const key = Object.keys(BIC_COLORS).find(k => party.toLowerCase().includes(k.toLowerCase()));
  return key ? BIC_COLORS[key] : colors.gray500;
};

const deriveBic = (rfi: RFIRow): string => {
  const assigned = rfi.assigned_to || rfi.to || '';
  if (assigned) return assigned;
  const status = String(rfi.status ?? '').toLowerCase();
  if (status === 'closed' || status === 'answered') return 'Resolved';
  if (status === 'in_review' || status === 'under_review' || status === 'submitted') return 'Architect';
  return 'GC';
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatShortDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const rfiColHelper = createColumnHelper<RFIRow>();

// MetricCard replaced by RFIKPIs component

// ─── Ball In Court Badge ─────────────────────────────────

const BicBadge: React.FC<{ party: string }> = React.memo(({ party }) => {
  const color = getBicColor(party);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '9999px',
      backgroundColor: `${color}12`, fontSize: '11px',
      fontWeight: 500, color,
      letterSpacing: '0.01em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, flexShrink: 0, display: 'inline-block', opacity: 0.8 }} />
      {party}
    </span>
  );
});

const BallInCourtCell: React.FC<{ rfi: RFIRow }> = React.memo(({ rfi }) => {
  const party = rfi.assigned_to || null;
  if (!party) {
    return (
      <span style={{ fontSize: '11px', color: colors.textTertiary, fontStyle: 'normal', opacity: 0.5 }}>
        —
      </span>
    );
  }
  return <BicBadge party={party} />;
});

// ─── Main Page Component ─────────────────────────────────

const RFIsPage: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const projectId = useProjectId();
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('rfis'); }, [setPageContext]);
  const { data: rfisResult, isPending: rfisLoading, error: rfisError, refetch } = useRFIs(projectId);
  const rfisRaw = rfisResult?.data ?? [];
  const { data: project } = useProject(projectId);
  useRealtimeInvalidation(projectId);

  const handleExportXlsx = React.useCallback(() => {
    const projectName = project?.name ?? 'Project';
    const rows = rfisRaw.map((r) => ({
      number: r.number ? `RFI-${String(r.number).padStart(3, '0')}` : String(r.id ?? '').slice(0, 8),
      title: r.title ?? '',
      priority: r.priority ?? '',
      status: r.status ?? '',
      from: r.created_by ?? '',
      assignedTo: r.assigned_to ?? '',
      dueDate: r.due_date ?? '',
      createdAt: typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : '',
    }));
    exportRFILogXlsx(projectName, rows);
  }, [project?.name, rfisRaw]);

  // Map API data to component shape
  const rfis: RFIRow[] = useMemo(() => rfisRaw.map((r) => ({
    ...r,
    rfiNumber: r.number ? `RFI-${String(r.number).padStart(3, '0')}` : String(r.id ?? '').slice(0, 8),
    from: r.created_by || '',
    to: r.assigned_to || '',
    submitDate: typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : '',
    dueDate: r.due_date || '',
  })), [rfisRaw]);

  // Derive metrics from data
  const openCount = useMemo(() => rfis.filter((r) => r.status === 'open').length, [rfis]);
  const totalOpen = useMemo(() => rfis.filter((r) => r.status !== 'closed').length, [rfis]);
  const overdueCount = useMemo(() => rfis.filter((r) => r.status !== 'closed' && r.dueDate && isOverdue(r.dueDate)).length, [rfis]);
  const avgDaysToClose = useMemo(() => {
    const closed = rfis.filter((r) => r.status === 'closed' && r.closed_date && r.created_at);
    if (!closed.length) return 0;
    const total = closed.reduce((sum, r) => sum + Math.floor((new Date(r.closed_date!).getTime() - new Date(r.created_at!).getTime()) / 86400000), 0);
    return Math.round(total / closed.length);
  }, [rfis]);
  const closedThisWeek = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- Date.now() for UI time-window filter; acceptable impurity in memoized computation
    const weekAgo = Date.now() - 7 * 86400000;
    return rfis.filter((r) => r.status === 'closed' && r.closed_date && new Date(r.closed_date).getTime() >= weekAgo).length;
  }, [rfis]);
  const totalCostImpact = useMemo(() => rfis.reduce((sum, r) => sum + Number(r.cost_impact ?? 0), 0), [rfis]);

  const [selectedRfi, setSelectedRfi] = useState<RFIRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RFIStatusFilter>('all');
  const [announcement, setAnnouncement] = useState('');
  const announcedLoadRef = useRef(false);
  const { addToast } = useToast();

  // AI Draft modal state
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [aiDraftInput, setAiDraftInput] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [_aiPrefill, setAiPrefill] = useState<Record<string, unknown> | null>(null);
  const [aiPrefillKey, setAiPrefillKey] = useState(0);

  // Response text state (shared between manual entry and AI suggestion)
  const [responseText, setResponseText] = useState('');
  const [responseSubmitting, setResponseSubmitting] = useState(false);

  // AI Suggest Response state (detail panel)
  const [_aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [aiSuggestionError, setAiSuggestionError] = useState(false);

  useEffect(() => {
    if (!rfisLoading && !announcedLoadRef.current) {
      announcedLoadRef.current = true;
      setAnnouncement(`${rfisRaw.length} RFIs loaded`);
    }
  }, [rfisLoading, rfisRaw.length]);

  useEffect(() => {
    if (!announcedLoadRef.current) return;
    const count = statusFilter === 'all' ? rfis.length : rfis.filter((r) => r.status === statusFilter).length;
    setAnnouncement(`Showing ${count} of ${rfis.length} RFIs`);
  }, [statusFilter, rfis]);

  const appNavigate = useAppNavigate();
  const navigate = useNavigate();
  const createRFI = useCreateRFI();
  const updateRFI = useUpdateRFI();
  const deleteRFI = useDeleteRFI();
  const createRFIResponse = useCreateRFIResponse();

  const handleDeleteRFI = useCallback(async () => {
    if (!selectedRfi || !projectId) return;
    const rfiId = String(selectedRfi.id);
    const rfiLabel = (selectedRfi.title as string) || `RFI ${rfiId.slice(0, 8)}`;
    if (!window.confirm(`Delete "${rfiLabel}"? This cannot be undone.`)) return;
    try {
      await deleteRFI.mutateAsync({ id: rfiId, projectId });
      toast.success('RFI deleted');
      setSelectedRfi(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete RFI');
    }
  }, [selectedRfi, projectId, deleteRFI]);

  // Fetch full detail (with responses) when an RFI is selected in the side panel
  const selectedRfiId = selectedRfi ? String(selectedRfi.id) : undefined;
  const { data: rfiDetail } = useRFI(selectedRfiId);
  const rfiResponses = useMemo(() => rfiDetail?.responses ?? [], [rfiDetail]);

  const handleStatusChange = useCallback(async (rfiId: string, newStatus: string) => {
    if (!projectId) {
      addToast('error', 'No project selected');
      return;
    }
    try {
      await updateRFI.mutateAsync({ id: rfiId, updates: { status: newStatus }, projectId });
      addToast('success', 'Status updated');
    } catch {
      addToast('error', 'Failed to update status');
    }
  }, [updateRFI, projectId, addToast]);

  const handleKanbanMove = useCallback(async (itemId: string | number, _fromColumn: string, toColumn: string) => {
    await handleStatusChange(String(itemId), toColumn);
  }, [handleStatusChange]);

  // Reset response state when detail panel switches to a different RFI
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state reset on RFI change; no external system involved
    setAiSuggestion(null);
    setAiSuggestionLoading(false);
    setAiSuggestionError(false);
    setResponseText('');
    setResponseSubmitting(false);
  }, [selectedRfi?.id]);

  const handleAIDraft = useCallback(async () => {
    if (!aiDraftInput.trim()) return;
    setAiDraftLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-rfi-draft', {
        body: { projectId, description: aiDraftInput },
      });
      if (error || !data) throw new Error('AI draft failed');
      setAiPrefill({ title: data.title ?? '', description: data.description ?? '' });
      setAiPrefillKey((k) => k + 1);
      setShowAIDraftModal(false);
      setAiDraftInput('');
      setShowCreateModal(true);
    } catch {
      toast.error('AI drafting unavailable. You can still create the RFI manually.');
      setShowAIDraftModal(false);
      setAiDraftInput('');
      setShowCreateModal(true);
    } finally {
      setAiDraftLoading(false);
    }
  }, [aiDraftInput, projectId]);

  const fetchAISuggestion = useCallback(async () => {
    if (!selectedRfi) return;
    setAiSuggestionLoading(true);
    setAiSuggestionError(false);
    try {
      const { data, error } = await supabase.functions.invoke('ai-rfi-draft', {
        body: { projectId, description: (selectedRfi.description as string) || (selectedRfi.title as string) },
      });
      if (error || !data) throw new Error('AI suggestion failed');
      const suggestion = String(data.response ?? data.description ?? '');
      setAiSuggestion(suggestion);
      setResponseText(suggestion);
    } catch {
      setAiSuggestionError(true);
      setAiSuggestion(null);
    } finally {
      setAiSuggestionLoading(false);
    }
  }, [selectedRfi, projectId]);

  const pageAlerts = getPredictiveAlertsForPage('rfis');

  // ─── Table Columns ─────────────────────────────────────

  const rfiColumns = useMemo(() => [
    rfiColHelper.accessor('rfiNumber', {
      header: '#',
      size: 90,
      cell: (info) => (
        <span style={{
          fontSize: '11px', fontWeight: 600, color: colors.primaryOrange,
          fontFamily: typography.fontFamilyMono,
          letterSpacing: '0.02em',
        }}>
          {info.getValue()}
        </span>
      ),
    }),
    rfiColHelper.accessor('title', {
      header: 'Subject',
      size: 380,
      cell: (info) => {
        const rfi = info.row.original;
        const overdue = rfi.dueDate && new Date(rfi.dueDate) < new Date() && rfi.status !== 'closed';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px', color: colors.textPrimary,
                fontWeight: 500, lineHeight: 1.4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {info.getValue()}
              </div>
              {(rfi.drawing_reference || rfi.spec_section) && (
                <div style={{
                  fontSize: '11px', color: colors.textTertiary, marginTop: '2px',
                  display: 'flex', gap: '8px', alignItems: 'center',
                }}>
                  {rfi.drawing_reference && (
                    <span style={{ color: colors.primaryOrange }}>{rfi.drawing_reference as string}</span>
                  )}
                  {rfi.spec_section && (
                    <span>{rfi.spec_section as string}</span>
                  )}
                </div>
              )}
            </div>
            {overdue && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                backgroundColor: colors.statusCritical,
                flexShrink: 0, animation: 'rfi-pulse 2s ease-in-out infinite',
              }} />
            )}
            {(rfi.ai_generated || getAnnotationsForEntity('rfi', rfi.id).length > 0) && (
              <Sparkles size={12} color="#8B5CF6" style={{ flexShrink: 0, opacity: 0.6 }} />
            )}
          </div>
        );
      },
    }),
    rfiColHelper.accessor('priority', {
      header: 'Priority',
      size: 90,
      cell: (info) => <PriorityTag priority={info.getValue() as 'low' | 'medium' | 'high' | 'critical'} />,
    }),
    rfiColHelper.accessor('status', {
      header: 'Status',
      size: 130,
      cell: (info) => (
        <StatusTag status={info.getValue() as 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval'} />
      ),
    }),
    rfiColHelper.display({
      id: 'ball_in_court',
      header: 'Ball In Court',
      size: 150,
      cell: (info) => <BallInCourtCell rfi={info.row.original} />,
    }),
    rfiColHelper.display({
      id: 'days_open',
      header: 'Age',
      size: 70,
      cell: (info) => {
        const rfi = info.row.original;
        let days: number;
        if (rfi.status === 'closed') {
          days = Math.floor((new Date((rfi.closed_date || rfi.updated_at) as string).getTime() - new Date(rfi.created_at as string).getTime()) / 86400000);
        } else {
          // eslint-disable-next-line react-hooks/purity -- Date.now() for age-in-days display; acceptable in cell renderer
          days = Math.floor((Date.now() - new Date(rfi.created_at as string).getTime()) / 86400000);
        }
        const dColor = days > 10 ? colors.statusCritical : days > 5 ? colors.statusPending : colors.textTertiary;
        return (
          <span style={{
            fontSize: '11px', fontWeight: 600, color: dColor,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: typography.fontFamilyMono,
          }}>
            {days}d
          </span>
        );
      },
    }),
    rfiColHelper.accessor('dueDate', {
      header: 'Due',
      size: 100,
      cell: (info) => {
        const rfi = info.row.original;
        const overdue = !!info.getValue() && new Date(info.getValue()) < new Date() && rfi.status !== 'closed';
        return (
          <span style={{
            fontSize: '11px',
            color: overdue ? colors.statusCritical : colors.textTertiary,
            fontWeight: overdue ? 600 : 400,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: typography.fontFamilyMono,
          }}>
            {formatShortDate(info.getValue())}
          </span>
        );
      },
    }),
    rfiColHelper.accessor('cost_impact', {
      header: '$',
      size: 85,
      cell: (info) => {
        const val = Number(info.getValue() ?? 0);
        if (!val) return <span style={{ color: colors.textTertiary, fontSize: '12px' }}>—</span>;
        return (
          <span style={{
            fontSize: '11px', fontWeight: 600,
            color: val > 0 ? colors.statusCritical : colors.statusActive,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: typography.fontFamilyMono,
          }}>
            {val > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, notation: 'compact' }).format(val)}
          </span>
        );
      },
    }),
  ], []);

  const checkboxColumn = useMemo(() => rfiColHelper.display({
    id: 'select',
    size: 40,
    header: () => (
      <input
        type="checkbox"
        checked={selectedIds.size > 0 && selectedIds.size === rfis.length}
        ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < rfis.length; }}
        onChange={(e) => {
          if (e.target.checked) setSelectedIds(new Set(rfis.map((r) => String(r.id))));
          else setSelectedIds(new Set());
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select all RFIs"
        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: colors.primaryOrange }}
      />
    ),
    cell: (info) => {
      const id = String(info.row.original.id);
      return (
        <input
          type="checkbox"
          checked={selectedIds.has(id)}
          onChange={() => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select RFI ${id}`}
          style={{ cursor: 'pointer', width: 16, height: 16, accentColor: colors.primaryOrange }}
        />
      );
    },
  }), [selectedIds, rfis]);

  const allRfiColumns = useMemo(() => [checkboxColumn, ...rfiColumns], [checkboxColumn, rfiColumns]);

  const allRfis = rfis || [];

  // Tab counts for the sliding tab bar
  const tabCounts = useMemo(() => ({
    all: allRfis.length,
    open: allRfis.filter((r) => r.status === 'open').length,
    under_review: allRfis.filter((r) => r.status === 'under_review').length,
    answered: allRfis.filter((r) => r.status === 'answered').length,
    overdue: allRfis.filter((r) => r.status !== 'closed' && r.dueDate && new Date(r.dueDate) < new Date()).length,
    closed: allRfis.filter((r) => r.status === 'closed').length,
  }), [allRfis]);

  const filteredRfis = useMemo(() => {
    if (statusFilter === 'all') return allRfis;
    if (statusFilter === 'overdue') return allRfis.filter((r) => r.status !== 'closed' && r.dueDate && new Date(r.dueDate) < new Date());
    return allRfis.filter((r) => r.status === statusFilter);
  }, [allRfis, statusFilter]);

  const kanbanColumns: KanbanColumn<RFIRow>[] = useMemo(() => [
    { id: 'draft', label: 'Draft', color: colors.textTertiary, items: allRfis.filter((r) => r.status === 'draft') },
    { id: 'open', label: 'Open', color: colors.statusInfo, items: allRfis.filter((r) => r.status === 'open') },
    { id: 'under_review', label: 'Under Review', color: colors.statusPending, items: allRfis.filter((r) => r.status === 'under_review') },
    { id: 'answered', label: 'Answered', color: colors.statusActive, items: allRfis.filter((r) => r.status === 'answered') },
    { id: 'closed', label: 'Closed', color: colors.statusNeutral, items: allRfis.filter((r) => r.status === 'closed') },
  ], [allRfis]);

  // ─── Early returns ─────────────────────────────────────

  if (!projectId) {
    return (
      <PageContainer title="RFIs">
        <EmptyState
          icon={<FileQuestion size={32} color={colors.textTertiary} />}
          title="No project selected"
          description="Select a project from the sidebar to view and manage RFIs."
        />
      </PageContainer>
    );
  }

  if (rfisLoading) {
    return (
      <PageContainer title="RFIs" subtitle="Loading...">
        <style>{`
          @keyframes rfi-skeleton-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
          @keyframes rfi-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          .rfi-skeleton-shimmer {
            background: linear-gradient(90deg, ${colors.surfaceInset} 25%, ${colors.surfaceHover} 50%, ${colors.surfaceInset} 75%);
            background-size: 200% 100%;
            animation: rfi-shimmer 1.8s ease-in-out infinite;
          }
        `}</style>
        {/* KPI Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
              border: `1px solid ${colors.borderSubtle}`, padding: '18px 20px',
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.12}s`,
            }}>
              <div className="rfi-skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: borderRadius.lg, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="rfi-skeleton-shimmer" style={{ width: '50%', height: 10, borderRadius: 4, marginBottom: 8 }} />
                <div className="rfi-skeleton-shimmer" style={{ width: '70%', height: 20, borderRadius: 4, marginBottom: 6 }} />
                <div className="rfi-skeleton-shimmer" style={{ width: '60%', height: 10, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
        {/* Section header skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
          <div className="rfi-skeleton-shimmer" style={{ width: 140, height: 18, borderRadius: 4 }} />
          <div className="rfi-skeleton-shimmer" style={{ width: 120, height: 16, borderRadius: 4 }} />
        </div>
        {/* Table Skeleton */}
        <div style={{
          backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
          border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden',
        }}>
          {/* Tab bar skeleton */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rfi-skeleton-shimmer" style={{ width: 60 + i * 8, height: 28, borderRadius: borderRadius.md }} />
            ))}
          </div>
          {/* Row skeletons */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              height: 52, borderBottom: `1px solid ${colors.borderSubtle}`,
              display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px',
            }}>
              <div className="rfi-skeleton-shimmer" style={{ width: 16, height: 16, borderRadius: 3 }} />
              <div className="rfi-skeleton-shimmer" style={{ width: 60, height: 12, borderRadius: 4 }} />
              <div className="rfi-skeleton-shimmer" style={{ width: 180 + (i % 3) * 40, height: 12, borderRadius: 4, flex: 1 }} />
              <div className="rfi-skeleton-shimmer" style={{ width: 50, height: 18, borderRadius: 10 }} />
              <div className="rfi-skeleton-shimmer" style={{ width: 60, height: 18, borderRadius: 10 }} />
              <div className="rfi-skeleton-shimmer" style={{ width: 80, height: 12, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </PageContainer>
    );
  }

  if (rfisError) {
    return (
      <PageContainer title="RFIs">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '12px', padding: '60px 20px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '16px',
            backgroundColor: `${colors.statusCritical}08`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={24} color={colors.statusCritical} />
          </div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>
            Unable to load RFIs
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: colors.textTertiary, maxWidth: 360 }}>
            {(rfisError as Error)?.message || 'Check your connection and try again.'}
          </p>
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>
            Retry
          </Btn>
        </div>
      </PageContainer>
    );
  }

  if (!rfis.length) {
    return (
      <PageContainer title="RFIs">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '80px 24px', gap: '16px', textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '20px',
            backgroundColor: colors.surfaceInset,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '8px',
          }}>
            <FileQuestion size={32} color={colors.textTertiary} />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: colors.textPrimary }}>
            No RFIs yet
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: colors.textTertiary, maxWidth: 400, lineHeight: 1.6 }}>
            No RFIs have been created on this project yet. When questions arise in the field, create an RFI to get a documented answer from the design team.
          </p>
          <PermissionGate permission="rfis.create">
            <Btn onClick={() => setShowCreateModal(true)} data-testid="create-rfi-button-empty">
              <Plus size={16} style={{ marginRight: '6px' }} />
              Create First RFI
            </Btn>
          </PermissionGate>
        </div>
        <RFICreateWizard
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            if (!projectId) { toast.error('No project selected'); return; }
            try {
              await createRFI.mutateAsync({ projectId, data: { ...data, project_id: projectId } });
              toast.success('RFI created successfully');
            } catch (err) {
              toast.error('Failed to create RFI. Please try again.');
              throw err;
            }
          }}
        />
      </PageContainer>
    );
  }

  // ─── Main Render ───────────────────────────────────────

  return (
    <PageContainer
      title="RFIs"
      subtitle={`${totalOpen} active · ${overdueCount > 0 ? `${overdueCount} overdue` : 'none overdue'}`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex', backgroundColor: colors.surfaceInset,
            borderRadius: '10px', padding: '3px', gap: '2px',
          }}>
            <button
              aria-pressed={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', border: 'none', borderRadius: '8px',
                backgroundColor: viewMode === 'table' ? colors.surfaceRaised : 'transparent',
                color: viewMode === 'table' ? colors.textPrimary : colors.textTertiary,
                fontSize: '12px', fontWeight: 500, fontFamily: typography.fontFamily,
                cursor: 'pointer', boxShadow: viewMode === 'table' ? shadows.sm : 'none',
                transition: 'all 0.15s',
              }}
            >
              <List size={13} /> List
            </button>
            <button
              aria-label="Kanban view"
              aria-pressed={viewMode === 'kanban'}
              onClick={() => setViewMode('kanban')}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', border: 'none', borderRadius: '8px',
                backgroundColor: viewMode === 'kanban' ? colors.surfaceRaised : 'transparent',
                color: viewMode === 'kanban' ? colors.textPrimary : colors.textTertiary,
                fontSize: '12px', fontWeight: 500, fontFamily: typography.fontFamily,
                cursor: 'pointer', boxShadow: viewMode === 'kanban' ? shadows.sm : 'none',
                transition: 'all 0.15s',
              }}
            >
              <LayoutGrid size={13} /> Board
            </button>
          </div>

          <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_RFI_Log" />

          <PermissionGate permission="rfis.create">
            <button
              onClick={() => setShowAIDraftModal(true)}
              aria-label="Draft an RFI with AI assistance"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '7px 14px', border: 'none', borderRadius: '10px',
                backgroundColor: colors.indigoSubtle, color: colors.indigo,
                fontSize: '13px', fontWeight: 500, fontFamily: typography.fontFamily,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <Wand2 size={13} />
              AI Draft
            </button>
            <Btn onClick={() => setShowCreateModal(true)} aria-label="Create new Request for Information" data-testid="create-rfi-button">
              <Plus size={15} style={{ marginRight: '4px' }} />
              New RFI
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      <style>{`
        @keyframes rfi-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .rfi-interactive:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        .rfi-table-row:hover .rfi-row-accent { opacity: 1 !important; }
        .rfi-table-row:hover .rfi-row-action { opacity: 1 !important; }
        .rfi-kanban-card:hover { box-shadow: ${shadows.cardHover}; transform: translateY(-1px); }
      `}</style>

      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}
      <PageInsightBanners page="rfis" />

      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {announcement}
      </div>

      {/* ─── Premium KPI Dashboard ─────────────────────── */}
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <RFIKPIs
          totalOpen={totalOpen}
          openCount={openCount}
          overdueCount={overdueCount}
          avgDaysToClose={avgDaysToClose}
          closedThisWeek={closedThisWeek}
          totalCostImpact={totalCostImpact}
          totalRfis={rfis.length}
          closedCount={rfis.filter((r) => r.status === 'closed').length}
        />
      </motion.div>

      {/* ─── Section Header ─────────────────────────────── */}
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: spacing['3'],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <h2 style={{
            margin: 0, fontSize: typography.fontSize.title, fontWeight: 600,
            color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
          }}>
            RFI Register
          </h2>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 22, padding: '0 6px',
            borderRadius: borderRadius.full,
            backgroundColor: colors.surfaceInset,
            color: colors.textTertiary,
            fontSize: 12, fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {rfis.length}
          </span>
        </div>
        <span style={{
          fontSize: 11, color: colors.textTertiary, fontWeight: 500,
          padding: `2px ${spacing['2']}`, backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.sm,
          fontFamily: typography.fontFamily,
        }}>
          ↑/↓ navigate · Enter open
        </span>
      </motion.div>

      {/* ─── Table / Kanban ────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
      {viewMode === 'table' ? (
        <motion.div
          key="table-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
        <div style={{
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.xl,
          overflow: 'hidden',
        }}>
          {/* Premium Status Filter Tabs */}
          <div style={{
            padding: '10px 16px',
            borderBottom: `1px solid ${colors.borderSubtle}`,
            overflowX: 'auto',
          }}>
            <RFITabBar
              activeTab={statusFilter}
              onTabChange={setStatusFilter}
              counts={tabCounts}
            />
          </div>

          {/* Table Content */}
          {filteredRfis.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '60px 20px', gap: '12px', textAlign: 'center',
            }}>
              <FilterX size={36} color={colors.textTertiary} style={{ opacity: 0.5 }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.textPrimary }}>
                No RFIs match this filter
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: colors.textTertiary }}>
                Try a different status filter
              </p>
              <Btn variant="secondary" size="sm" onClick={() => setStatusFilter('all')}>
                Show All
              </Btn>
            </div>
          ) : (
            <VirtualDataTable
              aria-label="RFI Register"
              data={filteredRfis}
              columns={allRfiColumns}
              rowHeight={52}
              containerHeight={Math.min(600, filteredRfis.length * 52 + 48)}
              onRowClick={(rfi) => navigate(`/rfis/${rfi.id}`)}
              selectedRowId={null}
              getRowId={(row) => String(row.id)}
              getRowAriaLabel={(rfi) => `RFI ${rfi.rfiNumber}: ${rfi.title}, status ${rfi.status}`}
              getRowStyle={(rfi) => {
                const overdue = rfi.dueDate && new Date(rfi.dueDate) < new Date() && rfi.status !== 'closed';
                return overdue ? { backgroundColor: `${colors.statusCritical}04` } : {};
              }}
              loading={rfisLoading}
              emptyMessage="No RFIs match your filters"
              onRowToggleSelectByIndex={(i) => {
                const id = String(allRfis[i]?.id);
                if (!id) return;
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
            />
          )}
        </div>
        </motion.div>
      ) : (
        <motion.div
          key="kanban-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
        <KanbanBoard
          columns={kanbanColumns}
          getKey={(rfi) => rfi.id}
          onMoveItem={handleKanbanMove}
          renderCard={(rfi) => {
            const cardOverdue = isOverdue(rfi.dueDate) && rfi.status !== 'closed';
            // eslint-disable-next-line react-hooks/purity -- Date.now() for kanban card age display; acceptable
            const daysOpen = Math.floor((Date.now() - new Date(rfi.created_at as string).getTime()) / 86400000);
            return (
              <div
                className="rfi-kanban-card"
                style={{
                  padding: '16px', cursor: 'pointer',
                  borderRadius: borderRadius.lg,
                  position: 'relative',
                  transition: `all 200ms cubic-bezier(0.16, 1, 0.3, 1)`,
                  borderLeft: cardOverdue ? `3px solid ${colors.statusCritical}` : '3px solid transparent',
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open RFI ${rfi.rfiNumber}: ${rfi.title}`}
                onClick={() => setSelectedRfi(rfi)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRfi(rfi); } }}
              >
                {/* Card Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  marginBottom: '8px',
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: colors.primaryOrange,
                    fontFamily: typography.fontFamilyMono, letterSpacing: '0.02em',
                  }}>
                    {rfi.rfiNumber}
                  </span>
                  <PriorityTag priority={rfi.priority} />
                  {rfi.is_auto_generated && (
                    <Sparkles size={10} color={colors.primaryOrange} style={{ opacity: 0.7 }} />
                  )}
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px', fontWeight: 600,
                    color: daysOpen > 10 ? colors.statusCritical : daysOpen > 5 ? colors.statusPending : colors.textTertiary,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {daysOpen}d
                  </span>
                </div>

                {/* Card Title */}
                <p style={{
                  fontSize: '13px', fontWeight: 500, color: colors.textPrimary,
                  margin: '0 0 12px', lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                } as React.CSSProperties}>
                  {rfi.title}
                </p>

                {/* Card Footer */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <BicBadge party={deriveBic(rfi)} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={10} color={cardOverdue ? colors.statusCritical : colors.textTertiary} />
                    <span style={{
                      fontSize: '11px',
                      color: cardOverdue ? colors.statusCritical : colors.textTertiary,
                      fontWeight: cardOverdue ? 600 : 400,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatShortDate(rfi.dueDate)}
                    </span>
                  </div>
                </div>

                {/* Cost impact micro-badge */}
                {rfi.cost_impact != null && Number(rfi.cost_impact) > 0 && (
                  <div style={{
                    marginTop: '8px', paddingTop: '8px',
                    borderTop: `1px solid ${colors.borderSubtle}`,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <DollarSign size={10} color={colors.statusCritical} />
                    <span style={{
                      fontSize: '11px', fontWeight: 600, color: colors.statusCritical,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      +{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, notation: 'compact' }).format(Number(rfi.cost_impact))}
                    </span>
                  </div>
                )}

                {getAnnotationsForEntity('rfi', rfi.id).map((ann) => (
                  <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                ))}
              </div>
            );
          }}
        />
        </motion.div>
      )}
      </AnimatePresence>

      {/* ─── Bulk Actions ─────────────────────────────── */}
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onClearSelection={() => setSelectedIds(new Set())}
        entityLabel="RFIs"
        actions={[
          {
            label: 'Reassign',
            icon: <UserCheck size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              if (!projectId) { addToast('error', 'No project selected'); return; }
              const assignee = window.prompt('Enter the name of the new assignee:');
              if (!assignee?.trim()) return;
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { assigned_to: assignee.trim() }, projectId })));
                addToast('success', `${ids.length} RFI${ids.length > 1 ? 's' : ''} reassigned`);
              } catch {
                addToast('error', 'Failed to reassign');
              }
            },
          },
          {
            label: 'Priority',
            icon: <Flag size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              if (!projectId) { addToast('error', 'No project selected'); return; }
              const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
              const priority = window.prompt(`Enter priority (${VALID_PRIORITIES.join(', ')}):`)?.trim().toLowerCase();
              if (!priority) return;
              if (!VALID_PRIORITIES.includes(priority as typeof VALID_PRIORITIES[number])) {
                addToast('error', `Invalid: use ${VALID_PRIORITIES.join(', ')}`);
                return;
              }
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { priority }, projectId })));
                addToast('success', `Priority updated for ${ids.length} RFIs`);
              } catch {
                addToast('error', 'Failed to update priority');
              }
            },
          },
          {
            label: 'Export',
            icon: <Download size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              const selected = allRfis.filter((r) => ids.includes(String(r.id)));
              const csv = ['RFI #,Title,From,Priority,Status,Due Date',
                ...selected.map((r) => `${r.rfiNumber},"${String(r.title ?? '')}",${r.from},${r.priority},${r.status},${r.dueDate}`),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'rfis-export.csv'; a.click();
              URL.revokeObjectURL(url);
            },
          },
          {
            label: 'Close',
            icon: <XCircle size={14} />,
            variant: 'danger',
            confirm: true,
            confirmMessage: `Close ${selectedIds.size} selected RFI${selectedIds.size > 1 ? 's' : ''}?`,
            onClick: async (ids) => {
              if (!projectId) { addToast('error', 'No project selected'); return; }
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { status: 'closed' }, projectId })));
                addToast('success', `${ids.length} RFIs closed`);
              } catch {
                addToast('error', 'Failed to close RFIs');
              }
            },
          },
        ]}
      />

      {/* ─── Detail Panel (Kanban selection) ──────────── */}
      <DetailPanel
        open={!!selectedRfi}
        onClose={() => { setSelectedRfi(null); setEditingDetail(false); }}
        title={selectedRfi?.rfiNumber || ''}
        width="560px"
      >
        {selectedRfi && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Premium Header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 700, color: colors.primaryOrange,
                    fontFamily: typography.fontFamilyMono, letterSpacing: '0.02em',
                    padding: '2px 8px', backgroundColor: `${colors.primaryOrange}08`,
                    borderRadius: borderRadius.sm, border: `1px solid ${colors.primaryOrange}15`,
                  }}>
                    {selectedRfi.rfiNumber}
                  </span>
                  <StatusTag status={selectedRfi.status as 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval'} />
                  <PriorityTag priority={selectedRfi.priority as 'low' | 'medium' | 'high' | 'critical'} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PresenceAvatars entityId={String(selectedRfi.id)} size={22} />
                  <PermissionGate permission="rfis.edit">
                    <Btn variant={editingDetail ? 'primary' : 'secondary'} size="sm" onClick={() => setEditingDetail(!editingDetail)}>
                      {editingDetail ? 'Done' : 'Edit'}
                    </Btn>
                  </PermissionGate>
                </div>
              </div>
              <h3 style={{
                margin: 0, fontSize: '18px', fontWeight: 600,
                color: colors.textPrimary, lineHeight: 1.35,
                letterSpacing: typography.letterSpacing.tight,
              }}>
                {selectedRfi.title}
              </h3>
              {/* Days open indicator */}
              {(() => {
                // eslint-disable-next-line react-hooks/purity -- Date.now() for days-open display in detail panel; acceptable
                const daysOpen = Math.floor((Date.now() - new Date(selectedRfi.created_at as string).getTime()) / 86400000);
                const overdue = isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'closed';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: daysOpen > 10 ? colors.statusCritical : daysOpen > 5 ? colors.statusPending : colors.textTertiary,
                    }}>
                      {daysOpen}d open
                    </span>
                    {overdue && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '11px', fontWeight: 600, color: colors.statusCritical,
                      }}>
                        <AlertCircle size={10} /> Overdue
                      </span>
                    )}
                    {selectedRfi.dueDate && !overdue && selectedRfi.status !== 'closed' && (
                      <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                        Due {formatShortDate(selectedRfi.dueDate)}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <EditingLockBanner entityType="RFI" entityId={String(selectedRfi.id)} isEditing={editingDetail} />

            {/* Metadata — Clean 2-col grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
              padding: '16px', backgroundColor: colors.surfaceInset,
              borderRadius: '12px', border: `1px solid ${colors.borderSubtle}`,
            }}>
              <EditableDetailField
                label="Assigned To"
                value={selectedRfi.to || ''}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  if (!projectId) { toast.error('No project selected'); return; }
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { assigned_to: val }, projectId });
                  setSelectedRfi((prev) => prev ? { ...prev, to: val, assigned_to: val } : prev);
                  toast.success('Updated');
                }}
                displayContent={
                  selectedRfi.to ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Avatar initials={selectedRfi.to.split(' ').map((w: string) => w[0]).join('').slice(0, 2)} size={20} />
                      <span style={{ fontSize: '13px' }}>{selectedRfi.to}</span>
                    </div>
                  ) : undefined
                }
              />
              <EditableDetailField
                label="Due Date"
                value={selectedRfi.dueDate?.slice(0, 10) || ''}
                editing={editingDetail}
                type="date"
                onSave={async (val) => {
                  if (!projectId) { toast.error('No project selected'); return; }
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { due_date: val }, projectId });
                  setSelectedRfi((prev) => prev ? { ...prev, dueDate: val, due_date: val } : prev);
                  toast.success('Updated');
                }}
                displayContent={
                  <span style={{
                    fontSize: '13px',
                    color: isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'closed' ? colors.statusCritical : colors.textPrimary,
                    fontWeight: isOverdue(selectedRfi.dueDate) ? 600 : 400,
                  }}>
                    {formatDate(selectedRfi.dueDate)}
                  </span>
                }
              />
              <EditableDetailField
                label="Ball in Court"
                value={String(selectedRfi.ball_in_court ?? '')}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  if (!projectId) { toast.error('No project selected'); return; }
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { ball_in_court: val }, projectId });
                  setSelectedRfi((prev) => prev ? { ...prev, ball_in_court: val } : prev);
                  toast.success('Updated');
                }}
                displayContent={selectedRfi.ball_in_court ? <BicBadge party={selectedRfi.ball_in_court as string} /> : undefined}
              />
              <EditableDetailField
                label="Cost Impact"
                value={selectedRfi.cost_impact != null ? String(selectedRfi.cost_impact) : ''}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  if (!projectId) { toast.error('No project selected'); return; }
                  const numVal = val ? parseFloat(val) : null;
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { cost_impact: numVal }, projectId });
                  setSelectedRfi((prev) => prev ? { ...prev, cost_impact: numVal } : prev);
                  toast.success('Updated');
                }}
                displayContent={
                  selectedRfi.cost_impact != null && Number(selectedRfi.cost_impact) !== 0 ? (
                    <span style={{ color: Number(selectedRfi.cost_impact) > 0 ? colors.statusCritical : colors.statusActive, fontWeight: 600, fontSize: '13px' }}>
                      {Number(selectedRfi.cost_impact) > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(Number(selectedRfi.cost_impact))}
                    </span>
                  ) : undefined
                }
              />
              {selectedRfi.spec_section && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Spec</div>
                  <span style={{ fontSize: '13px', color: colors.textPrimary }}>{selectedRfi.spec_section as string}</span>
                </div>
              )}
              {selectedRfi.drawing_reference && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Drawing</div>
                  <span style={{ fontSize: '13px', color: colors.primaryOrange }}>{selectedRfi.drawing_reference as string}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedRfi.description && (
              <div style={{
                padding: '14px 16px', backgroundColor: colors.surfaceInset,
                borderRadius: '12px', border: `1px solid ${colors.borderSubtle}`,
              }}>
                <p style={{
                  margin: 0, fontSize: '13px', color: colors.textSecondary,
                  lineHeight: 1.65, whiteSpace: 'pre-wrap',
                }}>
                  {selectedRfi.description as string}
                </p>
              </div>
            )}

            {/* Responses */}
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {rfiResponses.length} {rfiResponses.length === 1 ? 'Response' : 'Responses'}
                </span>
                <button
                  onClick={() => navigate(`/rfis/${selectedRfi.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '12px', color: colors.primaryOrange, fontWeight: 500,
                    padding: '4px 8px', borderRadius: '6px',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.orangeSubtle)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Full view <ChevronRight size={12} />
                </button>
              </div>

              {rfiResponses.length === 0 ? (
                <div style={{
                  padding: '24px', textAlign: 'center',
                  backgroundColor: colors.surfaceInset, borderRadius: '12px',
                  border: `1px dashed ${colors.borderSubtle}`,
                }}>
                  <MessageSquare size={20} color={colors.textTertiary} style={{ opacity: 0.4, marginBottom: '6px' }} />
                  <p style={{ margin: 0, fontSize: '13px', color: colors.textTertiary }}>
                    No responses yet
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rfiResponses.slice(0, 3).map((response, idx) => (
                    <div
                      key={response.id ?? idx}
                      style={{
                        padding: '12px 14px', backgroundColor: colors.surfaceInset,
                        borderRadius: '10px', border: `1px solid ${colors.borderSubtle}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <Avatar initials={(response.author_id ?? 'U').slice(0, 2).toUpperCase()} size={20} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: colors.textSecondary }}>
                          {response.author_id ? response.author_id.slice(0, 8) : 'Unknown'}
                        </span>
                        <span style={{ fontSize: '11px', color: colors.textTertiary, marginLeft: 'auto' }}>
                          {response.created_at ? formatShortDate(response.created_at) : ''}
                        </span>
                      </div>
                      <p style={{
                        margin: 0, fontSize: '13px', color: colors.textPrimary, lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      } as React.CSSProperties}>
                        {response.content ?? (response as Record<string, unknown>).response_text as string ?? ''}
                      </p>
                    </div>
                  ))}
                  {rfiResponses.length > 3 && (
                    <button
                      onClick={() => navigate(`/rfis/${selectedRfi.id}`)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '12px', color: colors.primaryOrange, fontWeight: 500,
                        padding: '8px', textAlign: 'center',
                      }}
                    >
                      View all {rfiResponses.length} responses →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Response Input */}
            <PermissionGate permission="rfis.respond">
              <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: colors.textSecondary }}>
                    Quick Response
                  </span>
                  <button
                    onClick={fetchAISuggestion}
                    disabled={aiSuggestionLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: 'none', border: `1px solid ${colors.borderSubtle}`,
                      padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '11px', color: colors.indigo, fontWeight: 500,
                      transition: 'all 0.12s',
                    }}
                  >
                    {aiSuggestionLoading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={11} />}
                    AI Suggest
                  </button>
                </div>
                {aiSuggestionError && (
                  <div style={{ marginBottom: '6px', fontSize: '11px', color: colors.textTertiary }}>
                    AI unavailable — type manually
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Type your response..."
                    rows={2}
                    disabled={responseSubmitting}
                    style={{
                      flex: 1, padding: '10px 12px',
                      border: `1px solid ${colors.borderSubtle}`, borderRadius: '10px',
                      fontSize: '13px', color: colors.textPrimary,
                      backgroundColor: colors.surfacePage, resize: 'none',
                      fontFamily: typography.fontFamily, lineHeight: 1.5,
                      boxSizing: 'border-box', outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryOrange)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = colors.borderSubtle)}
                  />
                  <button
                    disabled={!responseText.trim() || responseSubmitting}
                    onClick={async () => {
                      if (!responseText.trim() || !projectId) return;
                      setResponseSubmitting(true);
                      try {
                        await createRFIResponse.mutateAsync({
                          data: { rfi_id: selectedRfi.id, content: responseText },
                          rfiId: String(selectedRfi.id),
                          projectId,
                        });
                        setResponseText('');
                        setAiSuggestion(null);
                        toast.success('Response sent');
                      } catch {
                        toast.error('Failed to send');
                      } finally {
                        setResponseSubmitting(false);
                      }
                    }}
                    style={{
                      width: 40, height: 40, borderRadius: '10px', border: 'none',
                      backgroundColor: responseText.trim() && !responseSubmitting ? colors.primaryOrange : colors.surfaceInset,
                      color: responseText.trim() && !responseSubmitting ? colors.white : colors.textTertiary,
                      cursor: responseText.trim() && !responseSubmitting ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.15s', alignSelf: 'flex-end',
                    }}
                  >
                    {responseSubmitting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </PermissionGate>

            {/* Delete */}
            <PermissionGate permission="rfis.delete">
              <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '14px' }}>
                <button
                  onClick={handleDeleteRFI}
                  disabled={deleteRFI.isPending}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '12px', color: colors.statusCritical, fontWeight: 500,
                    padding: '6px 0', opacity: 0.7, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                >
                  {deleteRFI.isPending ? 'Deleting…' : 'Delete this RFI'}
                </button>
              </div>
            </PermissionGate>

            <RelatedItems items={getRelatedItemsForRfi(selectedRfi.id)} onNavigate={appNavigate} />
          </div>
        )}
      </DetailPanel>

      {/* ─── Create Modal ─────────────────────────────── */}
      <RFICreateWizard
        key={aiPrefillKey}
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setAiPrefill(null); }}
        onSubmit={async (data) => {
          if (!projectId) { toast.error('No project selected'); return; }
          try {
            await createRFI.mutateAsync({ projectId, data: { ...data, project_id: projectId } });
            toast.success('RFI created successfully');
          } catch (err) {
            toast.error('Failed to create RFI. Please try again.');
            throw err;
          }
        }}
      />

      {/* ─── AI Draft Modal ───────────────────────────── */}
      <AnimatePresence>
        {showAIDraftModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="AI Draft RFI"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: zIndex.popover, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              padding: '16px',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAIDraftModal(false); setAiDraftInput(''); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                backgroundColor: colors.surfaceRaised, borderRadius: '16px',
                padding: '24px', width: '100%', maxWidth: 480,
                boxShadow: '0 24px 80px -12px rgba(0,0,0,0.2)',
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '10px',
                    backgroundColor: colors.indigoSubtle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Wand2 size={16} color={colors.indigo} />
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: colors.textPrimary }}>AI Draft RFI</span>
                </div>
                <button
                  onClick={() => { setShowAIDraftModal(false); setAiDraftInput(''); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px', color: colors.textTertiary, display: 'flex',
                    borderRadius: '8px', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceInset)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Input */}
              <label style={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>
                Describe the issue in your own words
              </label>
              <textarea
                value={aiDraftInput}
                onChange={(e) => setAiDraftInput(e.target.value)}
                placeholder="e.g. The structural drawing conflicts with the architectural plan on grid line C…"
                rows={4}
                disabled={aiDraftLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiDraftInput.trim() && !aiDraftLoading) {
                    e.preventDefault();
                    handleAIDraft();
                  }
                }}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: `1.5px solid ${colors.borderSubtle}`, borderRadius: '12px',
                  fontSize: '14px', color: colors.textPrimary,
                  backgroundColor: colors.surfacePage, resize: 'none',
                  fontFamily: typography.fontFamily, boxSizing: 'border-box',
                  outline: 'none', lineHeight: 1.6,
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.indigo)}
                onBlur={(e) => (e.currentTarget.style.borderColor = colors.borderSubtle)}
              />
              {aiDraftLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', color: colors.indigo, fontSize: '13px' }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Generating draft…
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowAIDraftModal(false); setAiDraftInput(''); }}
                  disabled={aiDraftLoading}
                  style={{
                    padding: '8px 16px', border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: '10px', backgroundColor: 'transparent',
                    cursor: 'pointer', fontSize: '13px', color: colors.textSecondary,
                    fontWeight: 500, fontFamily: typography.fontFamily,
                    transition: 'all 0.12s',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIDraft}
                  disabled={!aiDraftInput.trim() || aiDraftLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 18px', border: 'none', borderRadius: '10px',
                    backgroundColor: aiDraftInput.trim() && !aiDraftLoading ? colors.indigo : colors.surfaceInset,
                    color: aiDraftInput.trim() && !aiDraftLoading ? colors.white : colors.textTertiary,
                    cursor: aiDraftInput.trim() && !aiDraftLoading ? 'pointer' : 'not-allowed',
                    fontSize: '13px', fontWeight: 600, fontFamily: typography.fontFamily,
                    transition: 'all 0.15s',
                  }}
                >
                  <Wand2 size={13} />
                  Generate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <Suspense fallback={null}>
        <QuickRFIButton />
      </Suspense>
    </PageContainer>
  );
};

const RFIs: React.FC = () => (
  <ErrorBoundary message="RFIs could not be displayed. Check your connection and try again.">
    <RFIsPage />
  </ErrorBoundary>
);

export { RFIs };
