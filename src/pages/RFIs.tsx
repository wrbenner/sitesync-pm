import React, { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { VirtualDataTable } from '../components/shared/VirtualDataTable';
import { BulkActionBar } from '../components/shared/BulkActionBar';
import { createColumnHelper } from '@tanstack/react-table';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, DetailPanel, Avatar, Tag, RelatedItems, useToast, MetricBox, EmptyState } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../styles/theme';
import { useRFIs, useRFI, useProject } from '../hooks/queries';
import { exportRFILogXlsx } from '../lib/exportXlsx';
import { ExportButton } from '../components/shared/ExportButton';
import { AlertTriangle, FileQuestion, FilterX, Plus, Clock, MessageSquare, Calendar, RefreshCw, Send, Sparkles, LayoutGrid, List, UserCheck, Flag, Download, XCircle, Wand2, Loader2, X } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForRfi } from '../utils/connections';
import { useCreateRFI, useUpdateRFI, useDeleteRFI, useCreateRFIResponse } from '../hooks/mutations';
import { useProjectId } from '../hooks/useProjectId';
import { useNavigate } from 'react-router-dom';
import { useCopilotStore } from '../stores/copilotStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PermissionGate } from '../components/auth/PermissionGate';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { KanbanBoard } from '../components/shared/KanbanBoard';
import type { KanbanColumn } from '../components/shared/KanbanBoard';
import CreateRFIModal from '../components/forms/CreateRFIModal';
import { EditableDetailField } from '../components/forms/EditableField';
import { toast } from 'sonner';
import { PresenceAvatars } from '../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../components/ui/EditingLockBanner';
import { useReducedMotion } from '../hooks/useReducedMotion';

const QuickRFIButton = lazy(() => import('../components/field/QuickRFIButton'));

const isOverdue = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d < new Date();
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 420, damping: 32 } },
};

const BIC_COLORS: Record<string, string> = {
  GC: colors.statusInfo,
  Architect: colors.statusReview,
  Engineer: colors.tealSuccess,
  Owner: colors.brand400,
  Subcontractor: colors.gray500,
  Sub: colors.gray500,
};

const getBicColor = (party: string): string => {
  if (BIC_COLORS[party]) return BIC_COLORS[party];
  const key = Object.keys(BIC_COLORS).find(k => party.toLowerCase().includes(k.toLowerCase()));
  return key ? BIC_COLORS[key] : colors.gray500;
};

const deriveBic = (rfi: Record<string, unknown>): string => {
  const assigned = (rfi.assigned_to as string) || (rfi.to as string) || '';
  if (assigned) return assigned;
  const status = String(rfi.status ?? '').toLowerCase();
  if (status === 'closed' || status === 'answered') return 'Resolved';
  if (status === 'in_review' || status === 'under_review' || status === 'submitted') return 'Architect';
  return 'GC';
};

const BicBadge: React.FC<{ party: string }> = React.memo(({ party }) => {
  const color = getBicColor(party);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: borderRadius.full, backgroundColor: `${color}15`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, flexShrink: 0, display: 'inline-block' }} />
      {party}
    </span>
  );
});


const BallInCourtCell: React.FC<{ rfi: Record<string, unknown> }> = React.memo(({ rfi }) => {
  const party = (rfi.assigned_to as string | null) || null;
  if (!party) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.gray500, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontStyle: 'italic' }}>Unassigned</span>
      </span>
    );
  }
  const color = getBicColor(party);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{party}</span>
    </span>
  );
});

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const rfiColHelper = createColumnHelper<unknown>();


const MetaItem: React.FC<{ label: string; children: React.ReactNode }> = React.memo(({ label, children }) => (
  <div>
    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: typography.fontWeight.medium }}>
      {label}
    </div>
    <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary }}>
      {children}
    </div>
  </div>
));

const RFIsPage: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const projectId = useProjectId();
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('rfis'); }, [setPageContext]);
  const { data: rfisResult, isPending: rfisLoading, error: rfisError, refetch } = useRFIs(projectId);
  const rfisRaw = rfisResult?.data ?? [];
  const { data: project } = useProject(projectId);

  const handleExportXlsx = React.useCallback(() => {
    const projectName = project?.name ?? 'Project';
    const rows = rfisRaw.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        number: rec.number ? `RFI-${String(rec.number).padStart(3, '0')}` : String(rec.id ?? '').slice(0, 8),
        title: (rec.title as string) ?? '',
        priority: (rec.priority as string) ?? '',
        status: (rec.status as string) ?? '',
        from: (rec.created_by as string) ?? '',
        assignedTo: (rec.assigned_to as string) ?? '',
        dueDate: (rec.due_date as string) ?? '',
        createdAt: typeof rec.created_at === 'string' ? rec.created_at.slice(0, 10) : '',
      };
    });
    exportRFILogXlsx(projectName, rows);
  }, [project?.name, rfisRaw]);

  // Map API data to component shape
  const rfis = useMemo(() => rfisRaw.map((r: Record<string, unknown>) => ({
    ...r,
    rfiNumber: r.number ? `RFI-${String(r.number).padStart(3, '0')}` : String(r.id ?? '').slice(0, 8),
    from: (r.created_by as string) || '',
    to: (r.assigned_to as string) || '',
    submitDate: typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : '',
    dueDate: (r.due_date as string) || '',
  })), [rfisRaw]);

  // Derive metrics from data
  const openCount = useMemo(() => rfis.filter((r: Record<string, unknown>) => r.status === 'open').length, [rfis]);
  const totalOpen = useMemo(() => rfis.filter((r: Record<string, unknown>) => r.status !== 'closed').length, [rfis]);
  const overdueCount = useMemo(() => rfis.filter((r: Record<string, unknown>) => r.status !== 'closed' && r.dueDate && isOverdue(r.dueDate as string)).length, [rfis]);
  const avgDaysToClose = useMemo(() => {
    const closed = rfis.filter((r: Record<string, unknown>) => r.status === 'closed' && r.closed_date && r.created_at);
    if (!closed.length) return 0;
    const total = closed.reduce((sum: number, r: Record<string, unknown>) => sum + Math.floor((new Date(r.closed_date as string).getTime() - new Date(r.created_at as string).getTime()) / 86400000), 0);
    return Math.round(total / closed.length);
  }, [rfis]);
  const closedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return rfis.filter((r: Record<string, unknown>) => r.status === 'closed' && r.closed_date && new Date(r.closed_date as string).getTime() >= weekAgo).length;
  }, [rfis]);
  const [selectedRfi, setSelectedRfi] = useState<Record<string, unknown> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [announcement, setAnnouncement] = useState('');
  const announcedLoadRef = useRef(false);
  const { addToast } = useToast();

  // AI Draft modal state
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [aiDraftInput, setAiDraftInput] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiPrefill, setAiPrefill] = useState<Record<string, unknown> | null>(null);
  const [aiPrefillKey, setAiPrefillKey] = useState(0);

  // Response text state (shared between manual entry and AI suggestion)
  const [responseText, setResponseText] = useState('');
  const [responseSubmitting, setResponseSubmitting] = useState(false);

  // AI Suggest Response state (detail panel)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
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
    const count = statusFilter === 'all' ? rfis.length : rfis.filter((r: Record<string, unknown>) => r.status === statusFilter).length;
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
      setResponseText(suggestion); // pre-fill the response textarea
    } catch {
      setAiSuggestionError(true);
      setAiSuggestion(null);
    } finally {
      setAiSuggestionLoading(false);
    }
  }, [selectedRfi, projectId]);

  const pageAlerts = getPredictiveAlertsForPage('rfis');

  const rfiColumns = useMemo(() => [
    rfiColHelper.accessor('rfiNumber', {
      header: 'RFI #',
      size: 90,
      cell: (info) => (
        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{info.getValue()}</span>
      ),
    }),
    rfiColHelper.accessor('title', {
      header: 'Title',
      size: 360,
      cell: (info) => {
        const rfi = info.row.original;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
              {info.getValue()}
              {rfi.is_auto_generated && (
                <span title="Auto-generated from drawing discrepancy" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: spacing['2'], padding: '1px 6px', backgroundColor: `${colors.primaryOrange}15`, color: colors.primaryOrange, borderRadius: borderRadius.full, fontSize: 10, fontWeight: typography.fontWeight.semibold, verticalAlign: 'middle', letterSpacing: 0.3 }}>
                  <Sparkles size={10} color={colors.primaryOrange} />
                  AUTO
                </span>
              )}
              {(rfi.ai_generated || getAnnotationsForEntity('rfi', rfi.id).length > 0) && (
                <span title={rfi.ai_generated ? 'AI assisted' : (getAnnotationsForEntity('rfi', rfi.id)[0]?.insight || 'AI assisted')} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: spacing['2'], padding: '1px 5px', backgroundColor: `${colors.statusReview}10`, borderRadius: borderRadius.full, verticalAlign: 'middle' }}>
                  <Sparkles size={10} color="#8B5CF6" />
                </span>
              )}
            </span>
            {rfi.drawing_reference && (
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                <span style={{ color: colors.orangeText }}>{rfi.drawing_reference}</span>
              </span>
            )}
          </div>
        );
      },
    }),
    rfiColHelper.accessor('from', {
      header: 'From',
      size: 140,
      cell: (info) => <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{info.getValue()}</span>,
    }),
    rfiColHelper.accessor('priority', {
      header: 'Priority',
      size: 90,
      cell: (info) => <span aria-label={`Priority: ${info.getValue()}`}><PriorityTag priority={info.getValue() as 'low' | 'medium' | 'high' | 'critical'} /></span>,
    }),
    rfiColHelper.accessor('status', {
      header: 'Status',
      size: 160,
      cell: (info) => {
        const rfi = info.row.original;
        const overdue = rfi.dueDate && new Date(rfi.dueDate) < new Date() && rfi.status !== 'closed';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span role="status" aria-label={`Status: ${info.getValue()}`}><StatusTag status={info.getValue() as 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval'} /></span>
            {overdue && (
              <Tag label="OVERDUE" color={colors.statusCritical} backgroundColor={colors.statusCriticalSubtle} />
            )}
          </div>
        );
      },
    }),
    rfiColHelper.display({
      id: 'ball_in_court',
      header: () => (
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Ball In Court</span>
      ),
      size: 150,
      cell: (info) => <BallInCourtCell rfi={info.row.original} />,
    }),
    rfiColHelper.display({
      id: 'days_open',
      header: 'Days Open',
      size: 90,
      cell: (info) => {
        const rfi = info.row.original as Record<string, unknown>;
        let days: number;
        if (rfi.status === 'closed') {
          days = Math.floor((new Date((rfi.closed_date || rfi.updated_at) as string).getTime() - new Date(rfi.created_at as string).getTime()) / 86400000);
        } else {
          days = Math.floor((Date.now() - new Date(rfi.created_at as string).getTime()) / 86400000);
        }
        const dColor = days > 10 ? colors.statusCritical : days > 5 ? colors.statusPending : colors.statusActive;
        return <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: dColor, fontVariantNumeric: 'tabular-nums' as const }}>{days}</span>;
      },
    }),
    rfiColHelper.accessor('dueDate', {
      header: 'Due',
      size: 100,
      cell: (info) => {
        const rfi = info.row.original;
        const overdue = !!info.getValue() && new Date(info.getValue()) < new Date() && rfi.status !== 'closed';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: overdue ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' as const }}>
              {formatDate(info.getValue())}
            </span>
          </div>
        );
      },
    }),
  ], []);

  const checkboxColumn = useMemo(() => rfiColHelper.display({
    id: 'select',
    size: 44,
    header: () => (
      <input
        type="checkbox"
        checked={selectedIds.size > 0 && selectedIds.size === rfis.length}
        ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < rfis.length; }}
        onChange={(e) => {
          if (e.target.checked) setSelectedIds(new Set(rfis.map((r: unknown) => String(r.id))));
          else setSelectedIds(new Set());
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select all RFIs"
        style={{ cursor: 'pointer' }}
      />
    ),
    cell: (info: unknown) => {
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
          style={{ cursor: 'pointer' }}
        />
      );
    },
  }), [selectedIds, rfis]);

  const allRfiColumns = useMemo(() => [checkboxColumn, ...rfiColumns], [checkboxColumn, rfiColumns]);

  const allRfis = rfis || [];

  const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'open', label: 'Open' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'answered', label: 'Answered' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'closed', label: 'Closed' },
  ];

  const filteredRfis = useMemo(() => {
    if (statusFilter === 'all') return allRfis;
    if (statusFilter === 'overdue') return allRfis.filter((r: Record<string, unknown>) => r.status !== 'closed' && r.dueDate && new Date(r.dueDate as string) < new Date());
    return allRfis.filter((r: Record<string, unknown>) => r.status === statusFilter);
  }, [allRfis, statusFilter]);

  const kanbanColumns: KanbanColumn<unknown>[] = useMemo(() => [
    { id: 'draft', label: 'Draft', color: colors.textTertiary, items: allRfis.filter((r) => r.status === 'draft') },
    { id: 'open', label: 'Open', color: colors.statusInfo, items: allRfis.filter((r) => r.status === 'open') },
    { id: 'under_review', label: 'Under Review', color: colors.statusPending, items: allRfis.filter((r) => r.status === 'under_review') },
    { id: 'answered', label: 'Answered', color: colors.statusActive, items: allRfis.filter((r) => r.status === 'answered') },
    { id: 'closed', label: 'Closed', color: colors.statusNeutral, items: allRfis.filter((r) => r.status === 'closed') },
  ], [allRfis]);

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
        <style>{`@keyframes rfi-skeleton-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }`}</style>
        {/* 4 metric card placeholders */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['4'] }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              <div style={{ width: 32, height: 32, borderRadius: borderRadius.md, backgroundColor: colors.borderSubtle, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
              <div style={{ width: '60%', height: 28, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.05}s` }} />
              <div style={{ width: '80%', height: 14, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.1}s` }} />
            </div>
          ))}
        </div>
        {/* 8 table row placeholders */}
        <Card padding="0">
          <div style={{ padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', gap: spacing['3'] }}>
            {[44, 90, 360, 110, 90, 120, 70, 100].map((w, i) => (
              <div key={i} style={{ width: w, height: 14, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ width: 44, height: 16, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, flexShrink: 0, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${rowIdx * 0.08}s` }} />
              <div style={{ width: 90, height: 16, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, flexShrink: 0, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${rowIdx * 0.08}s` }} />
              <div style={{ width: 320, height: 16, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, flexShrink: 0, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${rowIdx * 0.08 + 0.05}s` }} />
              <div style={{ width: 88, height: 24, borderRadius: borderRadius.full, backgroundColor: colors.borderSubtle, flexShrink: 0, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${rowIdx * 0.08 + 0.05}s` }} />
              <div style={{ width: 72, height: 24, borderRadius: borderRadius.full, backgroundColor: colors.borderSubtle, flexShrink: 0, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${rowIdx * 0.08 + 0.1}s` }} />
              <div style={{ width: 100, height: 24, borderRadius: borderRadius.full, backgroundColor: colors.borderSubtle, flexShrink: 0, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${rowIdx * 0.08 + 0.1}s` }} />
              <div style={{ width: 48, height: 16, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, flexShrink: 0, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${rowIdx * 0.08 + 0.15}s` }} />
              <div style={{ width: 80, height: 16, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, flexShrink: 0, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${rowIdx * 0.08 + 0.15}s` }} />
            </div>
          ))}
        </Card>
      </PageContainer>
    );
  }

  if (rfisError) {
    return (
      <PageContainer title="RFIs" subtitle="0 open · 0 overdue">
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, border: `1px solid ${colors.statusCritical}30` }}>
          <AlertTriangle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 }}>{(rfisError as Error)?.message || 'Unable to load RFIs'}</span>
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Btn>
        </div>
      </PageContainer>
    );
  }

  if (!rfis.length) {
    return (
      <PageContainer title="RFIs" subtitle="No items">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['12']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center' }}>
          <FileQuestion size={48} color={colors.textTertiary} />
          <h3 style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            No RFIs have been created for this project yet
          </h3>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, maxWidth: 440, lineHeight: typography.lineHeight.relaxed }}>
            When questions arise in the field, create an RFI to get a documented answer
          </p>
          <PermissionGate permission="rfis.create">
            <Btn onClick={() => setShowCreateModal(true)} data-testid="create-rfi-button-empty">
              Create First RFI
            </Btn>
          </PermissionGate>
        </div>
        <CreateRFIModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            if (!projectId) {
              toast.error('No project selected');
              return;
            }
            try {
              await createRFI.mutateAsync({
                projectId,
                data: { ...data, project_id: projectId },
              });
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

  // (moved to before early returns)

  return (
    <PageContainer
      title="RFIs"
      subtitle={`${openCount} open · ${overdueCount} overdue`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            <motion.button whileTap={{ scale: 0.97 }} className="rfi-interactive" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', border: 'none', borderRadius: borderRadius.full, backgroundColor: viewMode === 'table' ? colors.surfaceRaised : 'transparent', color: viewMode === 'table' ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: viewMode === 'table' ? shadows.sm : 'none', minHeight: 44 }}>
              <List size={14} style={{ marginRight: 4 }} /> Table
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} className="rfi-interactive" aria-pressed={viewMode === 'kanban'} onClick={() => setViewMode('kanban')} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', border: 'none', borderRadius: borderRadius.full, backgroundColor: viewMode === 'kanban' ? colors.surfaceRaised : 'transparent', color: viewMode === 'kanban' ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: viewMode === 'kanban' ? shadows.sm : 'none', minHeight: 44 }}>
              <LayoutGrid size={14} style={{ marginRight: 4 }} /> Kanban
            </motion.button>
          </div>
          <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_RFI_Log" />
          <PermissionGate permission="rfis.create">
            <button
              onClick={() => setShowAIDraftModal(true)}
              aria-label="Draft an RFI with AI assistance"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                padding: '7px 14px', border: 'none', borderRadius: borderRadius.md,
                backgroundColor: colors.indigoSubtle,
                color: colors.indigo, fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily,
                cursor: 'pointer', whiteSpace: 'nowrap' as const,
                boxShadow: `0 0 0 1px ${colors.statusReviewSubtle}`,
                minHeight: 44,
              }}
            >
              <Wand2 size={14} />
              AI Draft RFI
            </button>
            <Btn onClick={() => setShowCreateModal(true)} aria-label="Create new Request for Information" data-testid="create-rfi-button">
              <Plus size={16} style={{ marginRight: spacing.xs }} />
              New RFI
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      <style>{`
        .rfi-interactive:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        .rfi-metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 768px) { .rfi-metric-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .rfi-metric-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {announcement}
      </div>

      {/* KPI metric cards */}
      <motion.div
        aria-label="RFI metrics"
        className="rfi-metric-grid"
        style={{ gap: spacing['4'], marginBottom: spacing['4'] }}
        variants={reducedMotion ? undefined : containerVariants}
        initial={reducedMotion ? undefined : 'hidden'}
        animate={reducedMotion ? undefined : 'visible'}
      >
        <motion.div variants={reducedMotion ? undefined : itemVariants} whileHover={reducedMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}><MetricBox label="Total Open" value={totalOpen} /></motion.div>
        <motion.div variants={reducedMotion ? undefined : itemVariants} whileHover={reducedMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}><MetricBox label="Overdue" value={overdueCount} colorOverride={overdueCount > 0 ? 'danger' : undefined} /></motion.div>
        <motion.div variants={reducedMotion ? undefined : itemVariants} whileHover={reducedMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}><MetricBox label="Avg Days to Close" value={avgDaysToClose} unit="days" /></motion.div>
        <motion.div variants={reducedMotion ? undefined : itemVariants} whileHover={reducedMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}><MetricBox label="Closed This Week" value={closedThisWeek} /></motion.div>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
      {viewMode === 'table' ? (
        <motion.div
          key="table-view"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
        <Card padding="0">
          <div
            role="tablist"
            aria-label="Filter RFIs by status"
            style={{ display: 'flex', gap: 0, padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, overflowX: 'auto' }}
          >
            {STATUS_TABS.map((tab) => {
              const count = tab.key === 'all' ? allRfis.length
                : tab.key === 'overdue' ? allRfis.filter((r: Record<string, unknown>) => r.status !== 'closed' && r.dueDate && new Date(r.dueDate as string) < new Date()).length
                : allRfis.filter((r: Record<string, unknown>) => r.status === tab.key).length;
              const isSelected = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  className="rfi-interactive"
                  aria-selected={isSelected}
                  onClick={() => setStatusFilter(tab.key)}
                  style={{
                    padding: `${spacing['1.5']} ${spacing['3']}`,
                    border: 'none',
                    borderRadius: borderRadius.full,
                    backgroundColor: isSelected ? colors.primaryOrange : 'transparent',
                    color: isSelected ? colors.white : colors.textSecondary,
                    fontSize: typography.fontSize.sm,
                    fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.medium,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap' as const,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['1.5'],
                    minHeight: 40,
                  }}
                >
                  {tab.label}
                  <span style={{
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.medium,
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : colors.surfaceInset,
                    color: isSelected ? colors.white : colors.textTertiary,
                    borderRadius: borderRadius.full,
                    padding: '1px 6px',
                    minWidth: 18,
                    textAlign: 'center' as const,
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {filteredRfis.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['20']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center' }}
            >
              <FilterX size={48} color={colors.textTertiary} />
              <h3 style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                No RFIs match your current filters
              </h3>
              <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, margin: 0 }}>
                Try adjusting your search or filter criteria.
              </p>
              <Btn variant="secondary" onClick={() => setStatusFilter('all')}>
                Clear Filters
              </Btn>
            </motion.div>
          ) : (
            <VirtualDataTable
              aria-label="RFI Register"
              data={filteredRfis}
              columns={allRfiColumns}
              rowHeight={48}
              containerHeight={600}
              onRowClick={(rfi) => navigate(`/projects/${projectId}/rfis/${rfi.id}`)}
              selectedRowId={null}
              getRowId={(row) => String(row.id)}
              getRowAriaLabel={(rfi) => `RFI ${rfi.rfiNumber}: ${rfi.title}, status ${rfi.status}`}
              getRowStyle={(rfi) => {
                const overdue = rfi.dueDate && new Date(rfi.dueDate) < new Date() && rfi.status !== 'closed';
                return overdue ? { backgroundColor: colors.statusCriticalSubtle } : {};
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
        </Card>
        </motion.div>
      ) : (
        <motion.div
          key="kanban-view"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
        <KanbanBoard
          columns={kanbanColumns}
          getKey={(rfi) => rfi.id}
          onMoveItem={handleKanbanMove}
          renderCard={(rfi) => (
            <motion.div
              whileHover={{ y: -2, boxShadow: shadows.cardHover }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ padding: spacing['3'], cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-label={`Open RFI ${rfi.rfiNumber}: ${rfi.title}`}
              onClick={() => setSelectedRfi(rfi)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRfi(rfi); } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'], flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{rfi.rfiNumber}</span>
                <PriorityTag priority={rfi.priority} />
                <BicBadge party={deriveBic(rfi)} />
                {rfi.is_auto_generated && (
                  <span title="Auto-generated from drawing discrepancy" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', backgroundColor: `${colors.primaryOrange}15`, color: colors.primaryOrange, borderRadius: borderRadius.full, fontSize: 10, fontWeight: typography.fontWeight.semibold, letterSpacing: 0.3 }}>
                    <Sparkles size={10} color={colors.primaryOrange} />
                    AUTO
                  </span>
                )}
              </div>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>{rfi.title}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{rfi.from}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: isOverdue(rfi.dueDate) ? colors.statusCritical : colors.textTertiary }}>{formatDate(rfi.dueDate)}</span>
              </div>
              {getAnnotationsForEntity('rfi', rfi.id).map((ann) => (
                <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
              ))}
            </motion.div>
          )}
        />
        </motion.div>
      )}
      </AnimatePresence>

      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onClearSelection={() => setSelectedIds(new Set())}
        entityLabel="RFIs"
        actions={[
          {
            label: 'Reassign Ball in Court',
            icon: <UserCheck size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              if (!projectId) { addToast('error', 'No project selected'); return; }
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { assigned_to: 'Reassigned' }, projectId })));
                addToast('success', `${ids.length} RFI${ids.length > 1 ? 's' : ''} reassigned`);
              } catch {
                addToast('error', 'Failed to reassign RFIs. Please try again.');
              }
            },
          },
          {
            label: 'Change Priority',
            icon: <Flag size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              if (!projectId) { addToast('error', 'No project selected'); return; }
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { priority: 'high' }, projectId })));
                addToast('success', `Priority updated for ${ids.length} RFI${ids.length > 1 ? 's' : ''}`);
              } catch {
                addToast('error', 'Failed to update priority. Please try again.');
              }
            },
          },
          {
            label: 'Export Selected',
            icon: <Download size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              const selected = allRfis.filter((r: Record<string, unknown>) => ids.includes(String(r.id)));
              const csv = ['RFI #,Title,From,Priority,Status,Due Date',
                ...selected.map((r: Record<string, unknown>) => `${r.rfiNumber},"${String(r.title ?? '')}",${r.from},${r.priority},${r.status},${r.dueDate}`),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'rfis-export.csv'; a.click();
              URL.revokeObjectURL(url);
            },
          },
          {
            label: 'Mark as Closed',
            icon: <XCircle size={14} />,
            variant: 'danger',
            confirm: true,
            confirmMessage: `Close ${selectedIds.size} selected RFI${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`,
            onClick: async (ids) => {
              if (!projectId) { addToast('error', 'No project selected'); return; }
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { status: 'closed' }, projectId })));
                addToast('success', `${ids.length} RFI${ids.length > 1 ? 's' : ''} closed`);
              } catch {
                addToast('error', 'Failed to close RFIs. Please try again.');
              }
            },
          },
        ]}
      />

      {/* Detail Panel */}
      <DetailPanel
        open={!!selectedRfi}
        onClose={() => { setSelectedRfi(null); setEditingDetail(false); }}
        title={selectedRfi?.rfiNumber || ''}
        width="560px"
      >
        {selectedRfi && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            {/* Title + Edit Toggle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing['3'] }}>
              <h3 style={{ margin: 0, fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: typography.lineHeight.tight, flex: 1 }}>
                {selectedRfi.title}
              </h3>
              <PresenceAvatars entityId={String(selectedRfi.id)} size={24} />
              <PermissionGate permission="rfis.edit">
                <Btn
                  variant={editingDetail ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setEditingDetail(!editingDetail)}
                >
                  {editingDetail ? 'Done' : 'Edit'}
                </Btn>
              </PermissionGate>
              <PermissionGate permission="rfis.delete">
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteRFI}
                  disabled={deleteRFI.isPending}
                  aria-label="Delete this RFI"
                  data-testid="delete-rfi-button"
                >
                  {deleteRFI.isPending ? 'Deleting…' : 'Delete'}
                </Btn>
              </PermissionGate>
            </div>
            <EditingLockBanner entityType="RFI" entityId={String(selectedRfi.id)} isEditing={editingDetail} />

            {/* Meta Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: spacing.lg,
                padding: spacing.lg,
                backgroundColor: colors.surfaceFlat,
                borderRadius: borderRadius.md,
              }}
            >
              <EditableDetailField
                label="Priority"
                value={selectedRfi.priority}
                editing={editingDetail}
                type="select"
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
                onSave={async (val) => {
                  if (!projectId) { toast.error('No project selected'); return; }
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { priority: val }, projectId });
                  setSelectedRfi((prev: unknown) => prev ? { ...prev, priority: val } : prev);
                  toast.success('Priority updated');
                }}
                displayContent={<PriorityTag priority={selectedRfi.priority as 'low' | 'medium' | 'high' | 'critical'} />}
              />
              <EditableDetailField
                label="Status"
                value={selectedRfi.status}
                editing={editingDetail}
                type="select"
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'submitted', label: 'Submitted' },
                  { value: 'in_review', label: 'In Review' },
                  { value: 'answered', label: 'Answered' },
                  { value: 'closed', label: 'Closed' },
                ]}
                onSave={async (val) => {
                  await handleStatusChange(String(selectedRfi.id), val);
                  setSelectedRfi((prev: unknown) => prev ? { ...prev, status: val } : prev);
                }}
                displayContent={<StatusTag status={selectedRfi.status as 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval'} />}
              />
              <EditableDetailField
                label="Assigned To"
                value={selectedRfi.to || ''}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  if (!projectId) { toast.error('No project selected'); return; }
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { assigned_to: val }, projectId });
                  setSelectedRfi((prev: unknown) => prev ? { ...prev, to: val, assigned_to: val } : prev);
                  toast.success('Assignee updated');
                }}
                displayContent={
                  selectedRfi.to ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <Avatar initials={selectedRfi.to.split(' ').map((w: string) => w[0]).join('').slice(0, 2)} size={24} />
                      <span>{selectedRfi.to}</span>
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
                  setSelectedRfi((prev: unknown) => prev ? { ...prev, dueDate: val, due_date: val } : prev);
                  toast.success('Due date updated');
                }}
                displayContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <Calendar size={14} style={{ color: colors.textTertiary }} />
                    <span style={{
                      color: isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'answered' && selectedRfi.status !== 'closed' ? colors.statusCritical : colors.textPrimary,
                      fontWeight: isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'answered' && selectedRfi.status !== 'closed' ? typography.fontWeight.medium : typography.fontWeight.normal,
                    }}>
                      {formatDate(selectedRfi.dueDate)}
                    </span>
                  </div>
                }
              />
              <MetaItem label="From">
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <Avatar initials={selectedRfi.from.split(' ').map((w: string) => w[0]).join('').slice(0, 2)} size={24} />
                  <span>{selectedRfi.from}</span>
                </div>
              </MetaItem>
              <MetaItem label="Submitted">
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Clock size={14} style={{ color: colors.textTertiary }} />
                  <span>{formatDate(selectedRfi.submitDate)}</span>
                </div>
              </MetaItem>
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Description
              </div>
              <p style={{ margin: 0, fontSize: typography.fontSize.base, color: selectedRfi.description ? colors.textSecondary : colors.textTertiary, lineHeight: typography.lineHeight.relaxed, fontStyle: selectedRfi.description ? 'normal' : 'italic' }}>
                {selectedRfi.description || 'No description provided.'}
              </p>
            </div>

            {/* Response Timeline */}
            <div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Response Timeline
              </div>
              {rfiResponses.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: spacing['2'], padding: `${spacing['6']} ${spacing['4']}`,
                    backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md,
                    border: `1px dashed ${colors.borderSubtle}`, textAlign: 'center',
                  }}
                >
                  <MessageSquare size={20} color={colors.textTertiary} />
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    No responses yet
                  </p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, lineHeight: typography.lineHeight.relaxed }}>
                    Responses and comments will appear here as the RFI is worked
                  </p>
                </motion.div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                  {rfiResponses.map((response, idx) => (
                    <motion.div
                      key={response.id ?? idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.04 }}
                      style={{ padding: spacing['3'], backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}` }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          <Avatar initials={(response.author_id ?? 'U').slice(0, 2).toUpperCase()} size={22} />
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                            {response.author_id ? response.author_id.slice(0, 8) : 'Unknown'}
                          </span>
                        </div>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {response.created_at ? formatDate(response.created_at) : ''}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary, lineHeight: typography.lineHeight.relaxed }}>
                        {response.content ?? (response as Record<string, unknown>).response_text as string ?? ''}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Response Input */}
            <PermissionGate permission="rfis.respond">
              <div style={{ borderTop: `1px solid ${colors.borderLight}`, paddingTop: spacing.md }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    Your Response
                  </span>
                  <Btn
                    variant="secondary"
                    size="sm"
                    icon={aiSuggestionLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={13} />}
                    onClick={fetchAISuggestion}
                    disabled={aiSuggestionLoading}
                  >
                    {aiSuggestionLoading ? 'Generating...' : 'AI Suggest'}
                  </Btn>
                </div>
                {aiSuggestionError && (
                  <div style={{ marginBottom: spacing['2'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    AI suggestions unavailable — type your response manually
                  </div>
                )}
                {aiSuggestion && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['2'] }}>
                    <Sparkles size={11} color={colors.statusReview} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>AI suggestion pre-filled — review and edit before sending</span>
                  </div>
                )}
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response or use AI Suggest to generate a draft..."
                  rows={4}
                  disabled={responseSubmitting}
                  aria-label="Response text"
                  style={{ width: '100%', padding: spacing['3'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, color: colors.textPrimary, backgroundColor: colors.surfacePage, resize: 'vertical' as const, fontFamily: typography.fontFamily, lineHeight: typography.lineHeight.relaxed, boxSizing: 'border-box' as const, outline: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setResponseText(''); setAiSuggestion(null); }
                  }}
                />
                <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                  <Btn
                    fullWidth
                    icon={responseSubmitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                    disabled={!responseText.trim() || responseSubmitting}
                    onClick={async () => {
                      if (!responseText.trim() || !projectId) return;
                      const rfi = selectedRfi as Record<string, unknown>;
                      setResponseSubmitting(true);
                      try {
                        await createRFIResponse.mutateAsync({
                          data: { rfi_id: rfi.id, content: responseText },
                          rfiId: String(rfi.id),
                          projectId,
                        });
                        await updateRFI.mutateAsync({ id: String(rfi.id), updates: { status: 'answered' }, projectId });
                        setSelectedRfi((prev: unknown) => prev ? { ...prev, status: 'answered' } : prev);
                        setResponseText('');
                        setAiSuggestion(null);
                        toast.success('Response submitted successfully');
                      } catch {
                        toast.error('Failed to submit response. Please try again.');
                      } finally {
                        setResponseSubmitting(false);
                      }
                    }}
                  >
                    {responseSubmitting ? 'Submitting...' : 'Submit Response'}
                  </Btn>
                  <Btn
                    variant="secondary"
                    fullWidth
                    icon={responseSubmitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageSquare size={14} />}
                    disabled={!responseText.trim() || responseSubmitting}
                    onClick={async () => {
                      if (!responseText.trim() || !projectId) return;
                      const rfi = selectedRfi as Record<string, unknown>;
                      setResponseSubmitting(true);
                      try {
                        await createRFIResponse.mutateAsync({
                          data: { rfi_id: rfi.id, content: responseText },
                          rfiId: String(rfi.id),
                          projectId,
                        });
                        setResponseText('');
                        setAiSuggestion(null);
                        toast.success('Comment added');
                      } catch {
                        toast.error('Failed to add comment. Please try again.');
                      } finally {
                        setResponseSubmitting(false);
                      }
                    }}
                  >
                    Add Comment
                  </Btn>
                </div>
              </div>
            </PermissionGate>

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForRfi(selectedRfi.id)} onNavigate={appNavigate} />
          </div>
        )}
      </DetailPanel>

      <CreateRFIModal
        key={aiPrefillKey}
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setAiPrefill(null); }}
        initialValues={aiPrefill ?? undefined}
        onSubmit={async (data) => {
          if (!projectId) {
            toast.error('No project selected');
            return;
          }
          try {
            await createRFI.mutateAsync({
              projectId,
              data: { ...data, project_id: projectId },
            });
            toast.success('RFI created successfully');
          } catch (err) {
            toast.error('Failed to create RFI. Please try again.');
            throw err;
          }
        }}
      />

      {/* AI Draft RFI Modal */}
      <AnimatePresence>
        {showAIDraftModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="AI Draft RFI"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: colors.overlayBackdrop, zIndex: zIndex.popover, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing['4'] }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAIDraftModal(false); setAiDraftInput(''); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl, padding: spacing['6'], width: '100%', maxWidth: 480, boxShadow: shadows.panel }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <Wand2 size={18} color={colors.statusReview} />
                  <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>AI Draft RFI</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, backgroundColor: colors.surfaceHover }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setShowAIDraftModal(false); setAiDraftInput(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: spacing['1.5'], color: colors.textTertiary, display: 'flex', alignItems: 'center', borderRadius: borderRadius.base, minWidth: 32, minHeight: 32, justifyContent: 'center' }}
                  aria-label="Close"
                >
                  <X size={18} />
                </motion.button>
              </div>
              <label style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, display: 'block', marginBottom: spacing['2'] }}>
                Describe the issue in your own words
              </label>
              <textarea
                value={aiDraftInput}
                onChange={(e) => setAiDraftInput(e.target.value)}
                placeholder="e.g. The structural drawing conflicts with the architectural plan on grid line C, the beam depth does not match"
                rows={4}
                disabled={aiDraftLoading}
                aria-label="Describe the issue for AI drafting"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiDraftInput.trim() && !aiDraftLoading) {
                    e.preventDefault();
                    handleAIDraft();
                  }
                }}
                style={{ width: '100%', padding: spacing['3'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, color: colors.textPrimary, backgroundColor: colors.surfacePage, resize: 'none' as const, fontFamily: typography.fontFamily, boxSizing: 'border-box' as const, outline: 'none' }}
              />
              {aiDraftLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['3'], color: colors.statusReview, fontSize: typography.fontSize.sm }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  AI is drafting your RFI...
                </div>
              )}
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['4'], justifyContent: 'flex-end' }}>
                <Btn variant="secondary" onClick={() => { setShowAIDraftModal(false); setAiDraftInput(''); }} disabled={aiDraftLoading}>
                  Cancel
                </Btn>
                <Btn
                  onClick={handleAIDraft}
                  disabled={!aiDraftInput.trim() || aiDraftLoading}
                  icon={<Wand2 size={14} />}
                >
                  Generate RFI
                </Btn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
export default RFIs;
