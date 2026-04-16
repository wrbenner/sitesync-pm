import React, { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { VirtualDataTable } from '../components/shared/VirtualDataTable';
import { BulkActionBar } from '../components/shared/BulkActionBar';
import { createColumnHelper } from '@tanstack/react-table';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, DetailPanel, Avatar, Tag, RelatedItems, useToast, MetricBox } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions, touchTarget } from '../styles/theme';
import { useRFIs } from '../hooks/queries';
import { AlertTriangle, FileQuestion, FilterX, Plus, Clock, MessageSquare, Paperclip, Calendar, RefreshCw, Send, Sparkles, LayoutGrid, List, UserCheck, Flag, Download, XCircle, Wand2, Loader2, X } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForRfi } from '../utils/connections';
import { useCreateRFI, useUpdateRFI } from '../hooks/mutations';
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

const QuickRFIButton = lazy(() => import('../components/field/QuickRFIButton'));

// ── Local RFI shape ──────────────────────────────────────
interface RFIRecord {
  id: string | number;
  rfiNumber: string;
  title: string;
  from: string;
  to: string;
  submitDate: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  drawing_reference?: string;
  ai_generated?: boolean;
  description?: string;
  created_at: string;
  closed_at?: string;
  updated_at?: string;
  assigned_to?: string;
  created_by?: string;
  project_id?: string;
  attachment_count?: number;
  number?: number;
}

const isOverdue = (dateStr: string) => !!dateStr && new Date(dateStr) < new Date();

// 25ms stagger — Linear speed, not sluggish
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.025 } },
};

// Spring physics for natural, physical feel
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 420, damping: 32 },
  },
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

const BallInCourtCell = React.memo<{ rfi: RFIRecord }>(({ rfi }) => {
  const party = rfi.assigned_to || null;
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
BallInCourtCell.displayName = 'BallInCourtCell';

const formatDate = (dateStr: string) =>
  dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const rfiColHelper = createColumnHelper<RFIRecord>();

const MetaItem = React.memo<{ label: string; children: React.ReactNode }>(({ label, children }) => (
  <div>
    <div style={{
      fontSize: typography.fontSize.xs,
      color: colors.textTertiary,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wider,
      fontWeight: typography.fontWeight.medium,
    }}>
      {label}
    </div>
    <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary }}>
      {children}
    </div>
  </div>
));
MetaItem.displayName = 'MetaItem';

const RFIsPage: React.FC = () => {
  const projectId = useProjectId();
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('rfis'); }, [setPageContext]);
  const { data: rfisResult, isPending: rfisLoading, error: rfisError, refetch } = useRFIs(projectId);
  const rfisRaw = rfisResult?.data ?? [];

  const rfis = useMemo<RFIRecord[]>(() => rfisRaw.map((r: Record<string, unknown>) => ({
    ...r,
    rfiNumber: r.number ? `RFI-${String(r.number).padStart(3, '0')}` : String(r.id ?? '').slice(0, 8),
    from: (r.created_by as string) || '',
    to: (r.assigned_to as string) || '',
    submitDate: typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : '',
    dueDate: (r.due_date as string) || '',
  } as RFIRecord)), [rfisRaw]);

  const totalOpen = useMemo(() => rfis.filter((r) => r.status !== 'closed').length, [rfis]);
  const overdueCount = useMemo(() => rfis.filter((r) => r.status !== 'closed' && isOverdue(r.dueDate)).length, [rfis]);
  const avgDaysToClose = useMemo(() => {
    const closed = rfis.filter((r) => r.status === 'closed' && r.closed_at && r.created_at);
    if (!closed.length) return 0;
    const total = closed.reduce((sum, r) => sum + Math.floor((new Date(r.closed_at!).getTime() - new Date(r.created_at).getTime()) / 86400000), 0);
    return Math.round(total / closed.length);
  }, [rfis]);
  const closedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return rfis.filter((r) => r.status === 'closed' && r.closed_at && new Date(r.closed_at).getTime() >= weekAgo).length;
  }, [rfis]);

  const [selectedRfi, setSelectedRfi] = useState<RFIRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [announcement, setAnnouncement] = useState('');
  const announcedLoadRef = useRef(false);
  const { addToast } = useToast();

  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [aiDraftInput, setAiDraftInput] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiPrefill, setAiPrefill] = useState<Record<string, unknown> | null>(null);
  const [aiPrefillKey, setAiPrefillKey] = useState(0);

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
    const count = statusFilter === 'all' ? rfis.length : rfis.filter((r) => r.status === statusFilter).length;
    setAnnouncement(`Showing ${count} of ${rfis.length} RFIs`);
  }, [statusFilter, rfis]);

  const appNavigate = useAppNavigate();
  const navigate = useNavigate();
  const createRFI = useCreateRFI();
  const updateRFI = useUpdateRFI();

  const handleStatusChange = useCallback(async (rfiId: string, newStatus: string) => {
    try {
      await updateRFI.mutateAsync({ id: rfiId, updates: { status: newStatus }, projectId: projectId! });
      addToast('success', 'Status updated');
    } catch {
      addToast('error', 'Failed to update status');
    }
  }, [updateRFI, projectId, addToast]);

  useEffect(() => {
    setAiSuggestion(null);
    setAiSuggestionLoading(false);
    setAiSuggestionError(false);
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
        body: { projectId, description: selectedRfi.description || selectedRfi.title },
      });
      if (error || !data) throw new Error('AI suggestion failed');
      setAiSuggestion(data.response ?? data.description ?? '');
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
        const annotations = getAnnotationsForEntity('rfi', String(rfi.id));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
              {info.getValue()}
              {(rfi.ai_generated || annotations.length > 0) && (
                <span
                  title={rfi.ai_generated ? 'AI assisted' : (annotations[0]?.insight || 'AI assisted')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: spacing['2'], padding: '1px 5px', backgroundColor: `${colors.statusReview}10`, borderRadius: borderRadius.full, verticalAlign: 'middle' }}
                >
                  <Sparkles size={10} color={colors.statusReview} />
                </span>
              )}
            </span>
            {rfi.drawing_reference && (
              <span style={{ fontSize: typography.fontSize.caption, color: colors.orangeText }}>{rfi.drawing_reference}</span>
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
      cell: (info) => <span aria-label={`Priority: ${info.getValue()}`}><PriorityTag priority={info.getValue()} /></span>,
    }),
    rfiColHelper.accessor('status', {
      header: 'Status',
      size: 160,
      cell: (info) => {
        const rfi = info.row.original;
        const overdue = rfi.dueDate && new Date(rfi.dueDate) < new Date() && rfi.status !== 'closed';
        const val = info.getValue();
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {val === 'pending' ? (
              <span role="status" aria-label={`Status: ${val}`} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusInfoBright, backgroundColor: colors.statusInfoSubtle, padding: '2px 8px', borderRadius: borderRadius.full, display: 'inline-block' }}>Pending</span>
            ) : (
              <span role="status" aria-label={`Status: ${val}`}><StatusTag status={val as 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval'} /></span>
            )}
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
        <span style={{ fontSize: typography.fontSize.xs, textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Ball In Court</span>
      ),
      size: 150,
      cell: (info) => <BallInCourtCell rfi={info.row.original} />,
    }),
    rfiColHelper.display({
      id: 'days_open',
      header: 'Days Open',
      size: 90,
      cell: (info) => {
        const rfi = info.row.original;
        let days: number;
        if (rfi.status === 'closed') {
          days = Math.floor((new Date(rfi.closed_at || rfi.updated_at || rfi.created_at).getTime() - new Date(rfi.created_at).getTime()) / 86400000);
        } else {
          days = Math.floor((Date.now() - new Date(rfi.created_at).getTime()) / 86400000);
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
        const val = info.getValue();
        const overdue = !!val && new Date(val) < new Date() && rfi.status !== 'closed';
        return (
          <span style={{ fontSize: typography.fontSize.sm, color: overdue ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' as const }}>
            {formatDate(val)}
          </span>
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
          if (e.target.checked) setSelectedIds(new Set(rfis.map((r) => String(r.id))));
          else setSelectedIds(new Set());
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select all RFIs"
        style={{ cursor: 'pointer' }}
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
          style={{ cursor: 'pointer' }}
        />
      );
    },
  }), [selectedIds, rfis]);

  const allRfiColumns = useMemo(() => [checkboxColumn, ...rfiColumns], [checkboxColumn, rfiColumns]);

  const allRfis = rfis || [];

  const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'pending_response', label: 'Pending Response' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'closed', label: 'Closed' },
  ];

  const filteredRfis = useMemo(() => {
    if (statusFilter === 'all') return allRfis;
    if (statusFilter === 'overdue') return allRfis.filter((r) => r.status !== 'closed' && isOverdue(r.dueDate));
    if (statusFilter === 'pending_response') return allRfis.filter((r) => r.status === 'pending' || r.status === 'under_review');
    return allRfis.filter((r) => r.status === statusFilter);
  }, [allRfis, statusFilter]);

  const kanbanColumns: KanbanColumn<RFIRecord>[] = useMemo(() => [
    { id: 'draft', label: 'In Draft', color: colors.textTertiary, items: allRfis.filter((r) => r.status === 'draft') },
    { id: 'pending', label: 'Submitted', color: colors.statusPending, items: allRfis.filter((r) => r.status === 'pending' || r.status === 'open') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: allRfis.filter((r) => r.status === 'under_review') },
    { id: 'approved', label: 'Answered', color: colors.statusActive, items: allRfis.filter((r) => r.status === 'approved' || r.status === 'answered') },
    { id: 'closed', label: 'Closed', color: colors.statusNeutral, items: allRfis.filter((r) => r.status === 'closed') },
  ], [allRfis]);

  if (rfisLoading) {
    return (
      <PageContainer title="RFIs" subtitle="Loading...">
        <style>{`@keyframes rfi-skeleton-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['4'] }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              <div style={{ width: 32, height: 32, borderRadius: borderRadius.md, backgroundColor: colors.borderSubtle, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
              <div style={{ width: '60%', height: 28, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.05}s` }} />
              <div style={{ width: '80%', height: 14, borderRadius: borderRadius.sm, backgroundColor: colors.borderSubtle, animation: 'rfi-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1 + 0.1}s` }} />
            </div>
          ))}
        </div>
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['4']} ${spacing['4']}`, backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, border: `1px solid ${colors.statusCritical}30` }}
        >
          <AlertTriangle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, flex: 1 }}>
            {(rfisError as Error)?.message || 'Unable to load RFIs. Check your connection and try again.'}
          </span>
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Btn>
        </motion.div>
      </PageContainer>
    );
  }

  if (!rfis.length) {
    return (
      <PageContainer title="RFIs" subtitle="No items">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['12']} ${spacing['6']}`, gap: spacing['5'], textAlign: 'center' }}
        >
          <div style={{ width: 80, height: 80, borderRadius: borderRadius['2xl'], backgroundColor: colors.surfaceInset, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.borderSubtle}` }}>
            <FileQuestion size={36} color={colors.textTertiary} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            <h3 style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
              No RFIs yet
            </h3>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, maxWidth: 440, lineHeight: typography.lineHeight.relaxed }}>
              When questions arise in the field, create an RFI to get a documented answer from the architect or engineer.
            </p>
          </div>
          <PermissionGate permission="rfis.create">
            <Btn onClick={() => setShowCreateModal(true)}>
              <Plus size={16} style={{ marginRight: spacing.xs }} />
              Create First RFI
            </Btn>
          </PermissionGate>
        </motion.div>
        <CreateRFIModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            try {
              await createRFI.mutateAsync({ projectId: projectId!, data: { ...data, project_id: projectId! } });
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

  return (
    <PageContainer
      title="RFIs"
      subtitle={`${totalOpen} open · ${overdueCount} overdue`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="rfi-interactive"
              aria-pressed={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: `0 ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                backgroundColor: viewMode === 'table' ? colors.surfaceRaised : 'transparent',
                color: viewMode === 'table' ? colors.textPrimary : colors.textTertiary,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily, cursor: 'pointer',
                boxShadow: viewMode === 'table' ? shadows.sm : 'none',
                minHeight: touchTarget.min, transition: transitions.quick,
                gap: spacing['1'],
              }}
            >
              <List size={14} /> Table
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="rfi-interactive"
              aria-pressed={viewMode === 'kanban'}
              onClick={() => setViewMode('kanban')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: `0 ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                backgroundColor: viewMode === 'kanban' ? colors.surfaceRaised : 'transparent',
                color: viewMode === 'kanban' ? colors.textPrimary : colors.textTertiary,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily, cursor: 'pointer',
                boxShadow: viewMode === 'kanban' ? shadows.sm : 'none',
                minHeight: touchTarget.min, transition: transitions.quick,
                gap: spacing['1'],
              }}
            >
              <LayoutGrid size={14} /> Kanban
            </motion.button>
          </div>

          <PermissionGate permission="rfis.create">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAIDraftModal(true)}
              aria-label="Draft an RFI with AI assistance"
              className="rfi-interactive"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                padding: `0 ${spacing['3.5']}`, border: 'none', borderRadius: borderRadius.md,
                backgroundColor: colors.indigoSubtle, color: colors.indigo,
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                boxShadow: `0 0 0 1px ${colors.statusReviewSubtle}`,
                minHeight: touchTarget.min, transition: transitions.quick,
              }}
            >
              <Wand2 size={14} />
              AI Draft RFI
            </motion.button>
            <Btn onClick={() => setShowCreateModal(true)} aria-label="Create new Request for Information">
              <Plus size={16} style={{ marginRight: spacing.xs }} />
              New RFI
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      <style>{`
        .rfi-interactive:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
        @keyframes rfi-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {announcement}
      </div>

      {/* KPI metric cards — spring stagger, hover lift */}
      <motion.div
        aria-label="RFI metrics"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['4'] }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} whileHover={{ y: -2, transition: { duration: 0.15, ease: 'easeOut' } }} style={{ borderRadius: borderRadius.lg }}>
          <MetricBox label="Total Open" value={totalOpen} />
        </motion.div>
        <motion.div variants={itemVariants} whileHover={{ y: -2, transition: { duration: 0.15, ease: 'easeOut' } }} style={{ borderRadius: borderRadius.lg }}>
          <MetricBox label="Overdue" value={overdueCount} colorOverride={overdueCount > 0 ? 'danger' : undefined} />
        </motion.div>
        <motion.div variants={itemVariants} whileHover={{ y: -2, transition: { duration: 0.15, ease: 'easeOut' } }} style={{ borderRadius: borderRadius.lg }}>
          <MetricBox label="Avg Days to Close" value={avgDaysToClose} unit="days" />
        </motion.div>
        <motion.div variants={itemVariants} whileHover={{ y: -2, transition: { duration: 0.15, ease: 'easeOut' } }} style={{ borderRadius: borderRadius.lg }}>
          <MetricBox label="Closed This Week" value={closedThisWeek} />
        </motion.div>
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
                    : tab.key === 'overdue' ? allRfis.filter((r) => r.status !== 'closed' && isOverdue(r.dueDate)).length
                    : tab.key === 'pending_response' ? allRfis.filter((r) => r.status === 'pending' || r.status === 'under_review').length
                    : allRfis.filter((r) => r.status === tab.key).length;
                  const isSelected = statusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      role="tab"
                      className="rfi-interactive"
                      aria-selected={isSelected}
                      onClick={() => setStatusFilter(tab.key)}
                      style={{
                        padding: `0 ${spacing['3']}`,
                        border: 'none',
                        borderRadius: borderRadius.full,
                        backgroundColor: isSelected ? colors.primaryOrange : 'transparent',
                        color: isSelected ? colors.white : colors.textSecondary,
                        fontSize: typography.fontSize.sm,
                        fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.medium,
                        fontFamily: typography.fontFamily,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap' as const,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: spacing['1.5'],
                        minHeight: touchTarget.min,
                        transition: transitions.quick,
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
                  <FilterX size={40} color={colors.textTertiary} />
                  <div>
                    <h3 style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
                      No RFIs match this filter
                    </h3>
                    <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, margin: 0 }}>
                      Try a different filter or clear to see all RFIs.
                    </p>
                  </div>
                  <Btn variant="secondary" onClick={() => setStatusFilter('all')}>
                    Clear Filter
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
                    const overdue = isOverdue(rfi.dueDate) && rfi.status !== 'closed';
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
              getKey={(rfi) => String(rfi.id)}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{rfi.rfiNumber}</span>
                    <PriorityTag priority={rfi.priority} />
                  </div>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>{rfi.title}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{rfi.from}</span>
                    {rfi.dueDate && (
                      <span style={{ fontSize: typography.fontSize.caption, color: isOverdue(rfi.dueDate) ? colors.statusCritical : colors.textTertiary }}>{formatDate(rfi.dueDate)}</span>
                    )}
                  </div>
                  {getAnnotationsForEntity('rfi', String(rfi.id)).map((ann) => (
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
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { assigned_to: 'Reassigned' }, projectId: projectId! })));
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
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { priority: 'high' }, projectId: projectId! })));
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
              const selected = allRfis.filter((r) => ids.includes(String(r.id)));
              const csv = ['RFI #,Title,From,Priority,Status,Due Date',
                ...selected.map((r) => `${r.rfiNumber},"${r.title}",${r.from},${r.priority},${r.status},${r.dueDate}`),
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
              try {
                await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { status: 'closed' }, projectId: projectId! })));
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
            {/* Title + presence + edit */}
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
            </div>

            <EditingLockBanner entityType="RFI" entityId={String(selectedRfi.id)} isEditing={editingDetail} />

            {/* Meta grid — surfaceInset not surfaceFlat (which is dark navy) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: spacing.lg,
              padding: spacing.lg,
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.borderSubtle}`,
            }}>
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
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { priority: val }, projectId: projectId! });
                  selectedRfi.priority = val as 'low' | 'medium' | 'high' | 'critical';
                  toast.success('Priority updated');
                }}
                displayContent={<PriorityTag priority={selectedRfi.priority} />}
              />
              <EditableDetailField
                label="Status"
                value={selectedRfi.status}
                editing={editingDetail}
                type="select"
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'under_review', label: 'Under Review' },
                  { value: 'answered', label: 'Answered' },
                  { value: 'closed', label: 'Closed' },
                ]}
                onSave={async (val) => {
                  await handleStatusChange(String(selectedRfi.id), val);
                  selectedRfi.status = val;
                }}
                displayContent={<StatusTag status={selectedRfi.status as 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval'} />}
              />
              <EditableDetailField
                label="Assigned To"
                value={selectedRfi.to || ''}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { assigned_to: val }, projectId: projectId! });
                  selectedRfi.to = val;
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
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { due_date: val }, projectId: projectId! });
                  selectedRfi.dueDate = val;
                  toast.success('Due date updated');
                }}
                displayContent={
                  selectedRfi.dueDate ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                      <Calendar size={14} style={{ color: colors.textTertiary }} />
                      <span style={{
                        color: isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'approved' ? colors.statusCritical : colors.textPrimary,
                        fontWeight: isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'approved' ? typography.fontWeight.medium : typography.fontWeight.normal,
                      }}>
                        {formatDate(selectedRfi.dueDate)}
                      </span>
                    </div>
                  ) : undefined
                }
              />
              <MetaItem label="From">
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  {selectedRfi.from && (
                    <Avatar initials={selectedRfi.from.split(' ').map((w: string) => w[0]).join('').slice(0, 2)} size={24} />
                  )}
                  <span>{selectedRfi.from || 'Unknown'}</span>
                </div>
              </MetaItem>
              <MetaItem label="Submitted">
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Clock size={14} style={{ color: colors.textTertiary }} />
                  <span>{selectedRfi.submitDate ? formatDate(selectedRfi.submitDate) : 'Unknown'}</span>
                </div>
              </MetaItem>
            </div>

            {/* Description — real data, not placeholder */}
            <div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                Description
              </div>
              {selectedRfi.description ? (
                <p style={{ margin: 0, fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                  {selectedRfi.description}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: typography.fontSize.base, color: colors.textTertiary, lineHeight: typography.lineHeight.relaxed, fontStyle: 'italic' }}>
                  No description provided.
                </p>
              )}
            </div>

            {/* Attachments — dynamic */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, border: `1px dashed ${colors.border}` }}>
              <Paperclip size={16} style={{ color: colors.textTertiary }} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                {typeof selectedRfi.attachment_count === 'number'
                  ? selectedRfi.attachment_count === 0
                    ? 'No attachments'
                    : `${selectedRfi.attachment_count} attachment${selectedRfi.attachment_count !== 1 ? 's' : ''}`
                  : 'Attachments'}
              </span>
            </div>

            {/* Response Timeline */}
            <div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
                Response Timeline
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: `${spacing['8']} ${spacing['4']}`, gap: spacing['3'], textAlign: 'center',
                backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
                border: `1px solid ${colors.borderSubtle}`,
              }}>
                <MessageSquare size={28} color={colors.textTertiary} />
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, lineHeight: typography.lineHeight.relaxed, maxWidth: 280 }}>
                  No responses yet. Submit a response below to start the conversation.
                </p>
              </div>
            </div>

            {/* AI Suggest Response */}
            {aiSuggestion !== null ? (
              <div style={{ padding: spacing['3'], backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                  <Sparkles size={12} color={colors.statusReview} />
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>
                    AI Suggested Response
                  </span>
                </div>
                <textarea
                  value={aiSuggestion}
                  onChange={(e) => setAiSuggestion(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: spacing['2'], border: `1px solid rgba(139,92,246,0.2)`, borderRadius: borderRadius.sm, fontSize: typography.fontSize.sm, color: colors.textSecondary, backgroundColor: 'transparent', resize: 'vertical' as const, fontFamily: typography.fontFamily, lineHeight: 1.5, boxSizing: 'border-box' as const, outline: 'none' }}
                />
              </div>
            ) : aiSuggestionError ? (
              <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, display: 'flex', alignItems: 'center', gap: spacing['2'], border: `1px solid ${colors.borderSubtle}` }}>
                <Sparkles size={12} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>AI suggestions temporarily unavailable</span>
              </div>
            ) : (
              <div>
                <Btn
                  variant="secondary"
                  size="sm"
                  icon={aiSuggestionLoading ? <Loader2 size={14} style={{ animation: 'rfi-spin 1s linear infinite' }} /> : <Wand2 size={14} />}
                  onClick={fetchAISuggestion}
                  disabled={aiSuggestionLoading}
                >
                  {aiSuggestionLoading ? 'Fetching suggestion...' : 'AI Suggest Response'}
                </Btn>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
              <div style={{ flex: 1 }}>
                <PermissionGate permission="rfis.respond">
                  <Btn
                    fullWidth
                    icon={<Send size={15} />}
                    onClick={async () => {
                      await handleStatusChange(String(selectedRfi.id), 'approved');
                      addToast('success', 'Response submitted successfully');
                      setSelectedRfi(null);
                    }}
                  >
                    Submit Response
                  </Btn>
                </PermissionGate>
              </div>
              <div style={{ flex: 1 }}>
                <PermissionGate permission="rfis.respond">
                  <Btn
                    variant="secondary"
                    fullWidth
                    icon={<MessageSquare size={15} />}
                    onClick={() => addToast('info', 'Comment box opening soon')}
                  >
                    Add Comment
                  </Btn>
                </PermissionGate>
              </div>
            </div>

            <RelatedItems items={getRelatedItemsForRfi(String(selectedRfi.id))} onNavigate={appNavigate} />
          </div>
        )}
      </DetailPanel>

      <CreateRFIModal
        key={aiPrefillKey}
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setAiPrefill(null); }}
        initialValues={aiPrefill ?? undefined}
        onSubmit={async (data) => {
          try {
            await createRFI.mutateAsync({ projectId: projectId!, data: { ...data, project_id: projectId! } });
            toast.success('RFI created successfully');
          } catch (err) {
            toast.error('Failed to create RFI. Please try again.');
            throw err;
          }
        }}
      />

      {/* AI Draft RFI Modal — spring physics */}
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
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: spacing['1.5'], color: colors.textTertiary, display: 'flex', alignItems: 'center', borderRadius: borderRadius.base, minWidth: touchTarget.min, minHeight: touchTarget.min, justifyContent: 'center' }}
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
                style={{ width: '100%', padding: spacing['3'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, color: colors.textPrimary, backgroundColor: colors.surfacePage, resize: 'none' as const, fontFamily: typography.fontFamily, boxSizing: 'border-box' as const, outline: 'none' }}
              />

              {aiDraftLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['3'], color: colors.statusReview, fontSize: typography.fontSize.sm }}>
                  <Loader2 size={14} style={{ animation: 'rfi-spin 1s linear infinite' }} />
                  AI is drafting your RFI...
                </div>
              )}

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
