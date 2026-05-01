// ─────────────────────────────────────────────────────────────────────────────
// RFIs — enterprise inbox view (Tab P-RFIs, Wave 1)
// ─────────────────────────────────────────────────────────────────────────────
// Full-viewport. Sticky page header with count badge + filter chips +
// "+ New RFI". Dense sortable table beneath. No parchment, no Garamond,
// no centered max-width. Iris woven in as a per-row "Draft ready" pill.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircle, AlertTriangle, ChevronRight, Download, Flag, Loader2,
  MessageSquare, Plus, RefreshCw, Search, Send, Sparkles, UserCheck,
  Wand2, X, XCircle,
} from 'lucide-react';

import { ProjectGate } from '../components/ProjectGate';
import { supabase } from '../lib/supabase';
import { VirtualDataTable } from '../components/shared/VirtualDataTable';
import { BulkActionBar } from '../components/shared/BulkActionBar';
import {
  Avatar, Btn, DetailPanel, RelatedItems, useToast,
} from '../components/Primitives';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PermissionGate } from '../components/auth/PermissionGate';
import { useConfirm } from '../components/ConfirmDialog';
import { ExportButton } from '../components/shared/ExportButton';
import { PresenceAvatars } from '../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../components/ui/EditingLockBanner';
import { EditableDetailField } from '../components/forms/EditableField';
import RFICreateWizard from '../components/rfis/RFICreateWizard';
import { RFIKPIs } from './rfis/RFIKPIs';

import { useRFIs, useRFI, useProject } from '../hooks/queries';
import { useProfileNames, displayName, type ProfileMap } from '../hooks/queries/profiles';
import { useIrisDrafts } from '../hooks/useIrisDrafts';
import {
  useCreateRFI, useUpdateRFI, useDeleteRFI, useCreateRFIResponse,
} from '../hooks/mutations';
import { useProjectId } from '../hooks/useProjectId';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation';
import { useCopilotStore } from '../stores/copilotStore';

import { exportRFILogXlsx } from '../lib/exportXlsx';
import { useAppNavigate, getRelatedItemsForRfi } from '../utils/connections';
import { spacing, typography, borderRadius, zIndex } from '../styles/theme';
import type { RFI } from '../types/entities';

const QuickRFIButton = lazy(() => import('../components/field/QuickRFIButton'));

// ── Constants — DESIGN-RESET enterprise palette ─────────────────────────────
// True off-white surface: NOT parchment. Parchment is reserved for brand surfaces.
const SURFACE_PAGE = '#FCFCFA';
const SURFACE_INSET = '#F5F4F1';
const BORDER = '#E8E5DF';
const BORDER_STRONG = '#D9D5CD';
const INK = '#1A1613';
const INK_2 = '#5C5550';
const INK_3 = '#8C857E';

const STATUS = {
  critical: '#C93B3B',  // overdue
  high: '#B8472E',      // at risk
  medium: '#C4850C',    // pending / under review
  onTrack: '#2D8A6E',   // resolved / closed
  brandAction: '#F47820',
  iris: '#4F46E5',
  irisSubtle: '#4F46E512',
} as const;

// ── Local types ─────────────────────────────────────────────────────────────

type RFIRow = RFI & {
  rfiNumber: string;
  from: string;
  to: string;
  submitDate: string;
  dueDate: string;
};

type FilterChip = 'all' | 'open' | 'overdue' | 'awaiting_response' | 'closed';

interface ChipDef {
  id: FilterChip;
  label: string;
  isAlert?: boolean;
}

const CHIPS: ChipDef[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue', isAlert: true },
  { id: 'awaiting_response', label: 'Awaiting response' },
  { id: 'closed', label: 'Closed' },
];

// ── Date helpers ────────────────────────────────────────────────────────────

const isOverdue = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d < new Date();
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

const daysSince = (iso: string | null | undefined, end: string | null | undefined = null): number => {
  if (!iso) return 0;
  const start = new Date(iso).getTime();
  const finish = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(finish)) return 0;
  return Math.max(0, Math.floor((finish - start) / 86400000));
};

// ── Status pill — colored dot + label, DESIGN-RESET palette ─────────────────

function statusToTone(status: string | null | undefined, dueDate: string | null | undefined): {
  color: string;
  label: string;
} {
  const s = String(status ?? '').toLowerCase();
  if (s === 'closed' || s === 'answered') return { color: STATUS.onTrack, label: s === 'closed' ? 'Closed' : 'Answered' };
  if (isOverdue(dueDate) && s !== 'closed' && s !== 'answered') return { color: STATUS.critical, label: 'Overdue' };
  if (s === 'under_review' || s === 'submitted' || s === 'in_review') return { color: STATUS.medium, label: 'Under review' };
  if (s === 'open' || s === 'draft' || s === '') return { color: STATUS.high, label: 'Open' };
  return { color: INK_3, label: s.charAt(0).toUpperCase() + s.slice(1) };
}

const StatusPill: React.FC<{ status: string | null | undefined; dueDate: string | null | undefined }> = React.memo(
  ({ status, dueDate }) => {
    const { color, label } = statusToTone(status, dueDate);
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '2px 8px', borderRadius: 999,
        backgroundColor: `${color}10`,
        color, fontSize: 12, fontWeight: 500, lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: color, flexShrink: 0,
        }} />
        {label}
      </span>
    );
  },
);

// ── Ball-in-Court cell ──────────────────────────────────────────────────────

// `assigned` is typically a uuid FK to auth.users; the resolved display name
// comes from the profileMap keyed by that uuid. We render the name (with
// initials as the avatar fallback) — never the raw uuid.
const BicCell: React.FC<{
  assigned: string | null | undefined;
  profileMap?: ProfileMap;
}> = React.memo(({ assigned, profileMap }) => {
  if (!assigned) {
    return <span style={{ fontSize: 12, color: INK_3 }}>—</span>;
  }
  const resolved = displayName(profileMap, assigned, assigned);
  const initials = resolved
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '').join('');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        backgroundColor: SURFACE_INSET, color: INK_2,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600, flexShrink: 0,
        border: `1px solid ${BORDER}`,
      }}>
        {initials || '·'}
      </span>
      <span style={{
        fontSize: 13, color: INK_2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {resolved}
      </span>
    </div>
  );
});

// ── Iris pill ───────────────────────────────────────────────────────────────

const IrisDraftPill: React.FC<{ onClick?: (e: React.MouseEvent) => void }> = ({ onClick }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
    aria-label="Iris drafted a response — review before sending"
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 999,
      backgroundColor: STATUS.irisSubtle, color: STATUS.iris,
      border: 'none', cursor: onClick ? 'pointer' : 'default',
      fontSize: 11, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}
  >
    <Sparkles size={10} />
    Draft ready
  </button>
);

// ── Filter chip ─────────────────────────────────────────────────────────────

const Chip: React.FC<{
  active: boolean;
  alert?: boolean;
  count: number;
  label: string;
  onClick: () => void;
}> = ({ active, alert, count, label, onClick }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 11px', borderRadius: 6,
      backgroundColor: active ? INK : 'transparent',
      color: active ? '#FFFFFF' : alert && count > 0 ? STATUS.critical : INK_2,
      border: active ? '1px solid transparent' : `1px solid ${BORDER}`,
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      lineHeight: 1.2,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      fontFamily: typography.fontFamily,
      transition: 'all 120ms ease',
    }}
  >
    {label}
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      borderRadius: 999, backgroundColor: active ? '#FFFFFF22' : SURFACE_INSET,
      color: active ? '#FFFFFFCC' : alert && count > 0 ? STATUS.critical : INK_3,
      fontSize: 11, fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {count}
    </span>
  </button>
);

const colHelper = createColumnHelper<RFIRow>();

// ─────────────────────────────────────────────────────────────────────────────

const RFIsPage: React.FC = () => {
  const projectId = useProjectId();
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('rfis'); }, [setPageContext]);

  const { data: rfisResult, isPending: rfisLoading, error: rfisError, refetch } = useRFIs(projectId);
  const { data: project } = useProject(projectId);
  const { data: drafts } = useIrisDrafts(projectId, { status: ['pending'] });
  useRealtimeInvalidation(projectId);

  const rfisRaw = rfisResult?.data ?? [];

  const navigate = useNavigate();
  const appNavigate = useAppNavigate();
  const createRFI = useCreateRFI();
  const updateRFI = useUpdateRFI();
  const deleteRFI = useDeleteRFI();
  const createRFIResponse = useCreateRFIResponse();
  const { addToast } = useToast();
  const { confirm: confirmDeleteRfi, dialog: deleteRfiDialog } = useConfirm();

  const rfis: RFIRow[] = useMemo(() => rfisRaw.map((r) => ({
    ...r,
    rfiNumber: r.number ? `RFI-${String(r.number).padStart(3, '0')}` : String(r.id ?? '').slice(0, 8),
    from: r.created_by || '',
    to: r.assigned_to || '',
    submitDate: typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : '',
    dueDate: r.due_date || '',
  })), [rfisRaw]);

  // Resolve every user-id surfaced on the page to a display name. Without
  // this, BicCell renders the raw `assigned_to` uuid instead of the name.
  const allUserIds = useMemo(() => {
    const ids: string[] = [];
    for (const r of rfisRaw) {
      if (r.assigned_to) ids.push(r.assigned_to as string);
      if (r.ball_in_court) ids.push(r.ball_in_court as string);
      if (r.created_by) ids.push(r.created_by as string);
    }
    return ids;
  }, [rfisRaw]);
  const { data: profileMap } = useProfileNames(allUserIds);

  // Pending Iris draft index keyed by RFI id (action_type === 'rfi.draft').
  const draftRfiIds = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts ?? []) {
      if (d.action_type !== 'rfi.draft') continue;
      if (d.related_resource_type === 'rfi' && d.related_resource_id) {
        set.add(d.related_resource_id);
      }
    }
    return set;
  }, [drafts]);

  // ── KPI metrics ───────────────────────────────────────────────────────────
  const totalOpen = useMemo(() => rfis.filter((r) => r.status !== 'closed').length, [rfis]);
  const openCount = useMemo(() => rfis.filter((r) => r.status === 'open').length, [rfis]);
  const overdueCount = useMemo(() =>
    rfis.filter((r) => r.status !== 'closed' && r.dueDate && isOverdue(r.dueDate)).length,
  [rfis]);
  const closedCount = useMemo(() => rfis.filter((r) => r.status === 'closed').length, [rfis]);
  const closedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return rfis.filter((r) =>
      r.status === 'closed' && r.closed_date && new Date(r.closed_date).getTime() >= weekAgo,
    ).length;
  }, [rfis]);
  const avgDaysToClose = useMemo(() => {
    const closed = rfis.filter((r) => r.status === 'closed' && r.closed_date && r.created_at);
    if (!closed.length) return 0;
    const total = closed.reduce((sum, r) =>
      sum + daysSince(r.created_at as string, r.closed_date as string), 0);
    return Math.round(total / closed.length);
  }, [rfis]);
  const totalCostImpact = useMemo(() =>
    rfis.reduce((sum, r) => sum + Number(r.cost_impact ?? 0), 0),
  [rfis]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeChip, setActiveChip] = useState<FilterChip>('all');
  const [search, setSearch] = useState('');
  const [selectedRfi, setSelectedRfi] = useState<RFIRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingDetail, setEditingDetail] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const announcedLoadRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // AI Draft modal
  const [showAIDraftModal, setShowAIDraftModal] = useState(false);
  const [aiDraftInput, setAiDraftInput] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiPrefillKey, setAiPrefillKey] = useState(0);

  // Detail-panel response state
  const [responseText, setResponseText] = useState('');
  const [responseSubmitting, setResponseSubmitting] = useState(false);
  const [, setAiSuggestion] = useState<string | null>(null);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [aiSuggestionError, setAiSuggestionError] = useState(false);

  // Reset response state when detail panel switches
  useEffect(() => {
    setAiSuggestion(null);
    setAiSuggestionLoading(false);
    setAiSuggestionError(false);
    setResponseText('');
    setResponseSubmitting(false);
  }, [selectedRfi?.id]);

  useEffect(() => {
    if (!rfisLoading && !announcedLoadRef.current) {
      announcedLoadRef.current = true;
      setAnnouncement(`${rfisRaw.length} RFIs loaded`);
    }
  }, [rfisLoading, rfisRaw.length]);

  // Detail data for selected RFI
  const selectedRfiId = selectedRfi ? String(selectedRfi.id) : undefined;
  const { data: rfiDetail } = useRFI(selectedRfiId);
  const rfiResponses = useMemo(() => rfiDetail?.responses ?? [], [rfiDetail]);

  // ── Filters + counts ─────────────────────────────────────────────────────
  const chipCounts = useMemo<Record<FilterChip, number>>(() => ({
    all: rfis.length,
    open: rfis.filter((r) => r.status === 'open').length,
    overdue: rfis.filter((r) => r.status !== 'closed' && r.dueDate && isOverdue(r.dueDate)).length,
    awaiting_response: rfis.filter((r) => r.status === 'under_review' || r.status === 'submitted').length,
    closed: rfis.filter((r) => r.status === 'closed').length,
  }), [rfis]);

  const filteredRfis = useMemo(() => {
    let out = rfis;
    if (activeChip === 'open') out = out.filter((r) => r.status === 'open');
    else if (activeChip === 'closed') out = out.filter((r) => r.status === 'closed');
    else if (activeChip === 'overdue') out = out.filter((r) => r.status !== 'closed' && r.dueDate && isOverdue(r.dueDate));
    else if (activeChip === 'awaiting_response') out = out.filter((r) => r.status === 'under_review' || r.status === 'submitted');

    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const title = (r.title ?? '').toLowerCase();
        const num = r.rfiNumber.toLowerCase();
        const assigned = (r.assigned_to ?? '').toLowerCase();
        return title.includes(q) || num.includes(q) || assigned.includes(q);
      });
    }
    return out;
  }, [rfis, activeChip, search]);

  useEffect(() => {
    if (!announcedLoadRef.current) return;
    setAnnouncement(`Showing ${filteredRfis.length} of ${rfis.length} RFIs`);
  }, [filteredRfis.length, rfis.length]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleExportXlsx = useCallback(() => {
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

  const handleStatusChange = useCallback(async (rfiId: string, newStatus: string) => {
    if (!projectId) { addToast('error', 'No project selected'); return; }
    try {
      await updateRFI.mutateAsync({ id: rfiId, updates: { status: newStatus }, projectId });
      addToast('success', 'Status updated');
    } catch {
      addToast('error', 'Failed to update status');
    }
  }, [updateRFI, projectId, addToast]);

  const handleDeleteRFI = useCallback(async () => {
    if (!selectedRfi || !projectId) return;
    const rfiId = String(selectedRfi.id);
    const rfiLabel = (selectedRfi.title as string) || `RFI ${rfiId.slice(0, 8)}`;
    const ok = await confirmDeleteRfi({
      title: 'Delete RFI?',
      description: `"${rfiLabel}" — this is a contractual artifact. Deleting it removes it from the dispute record. Consider voiding instead.`,
      destructiveLabel: 'Delete RFI',
      typeToConfirm: 'DELETE',
    });
    if (!ok) return;
    try {
      await deleteRFI.mutateAsync({ id: rfiId, projectId });
      toast.success('RFI deleted');
      setSelectedRfi(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete RFI');
    }
  }, [selectedRfi, projectId, deleteRFI, confirmDeleteRfi]);

  const handleAIDraft = useCallback(async () => {
    if (!aiDraftInput.trim()) return;
    setAiDraftLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-rfi-draft', {
        body: { projectId, description: aiDraftInput },
      });
      if (error || !data) throw new Error('AI draft failed');
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

  // ── Page-level keyboard shortcuts: / focuses search, e acts on selected ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === '/' && !isField) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'e' && !isField) {
        // Open the selected RFI's detail (act = open, where the user can act).
        if (selectedIds.size === 1) {
          const id = Array.from(selectedIds)[0];
          const rfi = rfis.find((r) => String(r.id) === id);
          if (rfi) {
            e.preventDefault();
            navigate(`/rfis/${rfi.id}`);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, rfis, selectedIds]);

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns = useMemo(() => ([
    colHelper.display({
      id: 'select',
      size: 40,
      header: () => (
        <input
          type="checkbox"
          checked={selectedIds.size > 0 && selectedIds.size === filteredRfis.length}
          ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredRfis.length; }}
          onChange={(e) => {
            if (e.target.checked) setSelectedIds(new Set(filteredRfis.map((r) => String(r.id))));
            else setSelectedIds(new Set());
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select all visible RFIs"
          style={{ cursor: 'pointer', width: 14, height: 14, accentColor: STATUS.brandAction }}
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
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              });
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select RFI ${id}`}
            style={{ cursor: 'pointer', width: 14, height: 14, accentColor: STATUS.brandAction }}
          />
        );
      },
    }),
    colHelper.accessor('rfiNumber', {
      header: '#',
      size: 96,
      cell: (info) => (
        <span style={{
          fontSize: 12, fontWeight: 600, color: INK_2,
          fontFamily: typography.fontFamilyMono,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {info.getValue()}
        </span>
      ),
    }),
    colHelper.accessor('title', {
      header: 'Title',
      size: 380,
      cell: (info) => {
        const r = info.row.original;
        return (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 13, color: INK, fontWeight: 500, lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {info.getValue()}
            </div>
            {(r.drawing_reference || r.spec_section) && (
              <div style={{
                fontSize: 11, color: INK_3, marginTop: 2,
                display: 'flex', gap: 8,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {r.drawing_reference && <span>{r.drawing_reference as string}</span>}
                {r.spec_section && <span>{r.spec_section as string}</span>}
              </div>
            )}
          </div>
        );
      },
    }),
    colHelper.accessor('assigned_to', {
      header: 'Ball-in-Court',
      size: 180,
      cell: (info) => <BicCell assigned={info.getValue() as string | null} profileMap={profileMap} />,
    }),
    colHelper.accessor('status', {
      header: 'Status',
      size: 130,
      cell: (info) => (
        <StatusPill
          status={info.getValue() as string | null}
          dueDate={info.row.original.dueDate}
        />
      ),
    }),
    colHelper.accessor('dueDate', {
      header: 'Due',
      size: 96,
      cell: (info) => {
        const r = info.row.original;
        const overdue = !!info.getValue() && isOverdue(info.getValue() as string) && r.status !== 'closed';
        return (
          <span style={{
            fontSize: 12,
            color: overdue ? STATUS.critical : INK_2,
            fontWeight: overdue ? 600 : 400,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatShortDate(info.getValue() as string)}
          </span>
        );
      },
    }),
    colHelper.display({
      id: 'days_open',
      header: 'Days Open',
      size: 90,
      cell: (info) => {
        const r = info.row.original;
        const days = r.status === 'closed'
          ? daysSince(r.created_at as string, (r.closed_date || r.updated_at) as string)
          : daysSince(r.created_at as string);
        const c = days > 10 ? STATUS.critical : days > 5 ? STATUS.medium : INK_3;
        return (
          <span style={{
            fontSize: 12, fontWeight: 500, color: c,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {days}d
          </span>
        );
      },
    }),
    colHelper.accessor('cost_impact', {
      header: '$ Impact',
      size: 110,
      cell: (info) => {
        const val = Number(info.getValue() ?? 0);
        if (!val) return <span style={{ color: INK_3, fontSize: 12 }}>—</span>;
        return (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: val > 0 ? STATUS.critical : STATUS.onTrack,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {val > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', {
              style: 'currency', currency: 'USD', minimumFractionDigits: 0, notation: 'compact',
            }).format(val)}
          </span>
        );
      },
    }),
    colHelper.accessor('schedule_impact', {
      header: 'Sched',
      size: 96,
      cell: (info) => {
        const raw = (info.getValue() as string | number | null) ?? '';
        if (raw === '' || raw == null) return <span style={{ color: INK_3, fontSize: 12 }}>—</span>;
        const txt = typeof raw === 'number' ? `${raw}d` : String(raw);
        return (
          <span style={{
            fontSize: 12, fontWeight: 500, color: INK_2,
            fontVariantNumeric: 'tabular-nums',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {txt}
          </span>
        );
      },
    }),
    colHelper.display({
      id: 'iris',
      header: 'Iris',
      size: 110,
      cell: (info) => {
        const id = String(info.row.original.id);
        if (!draftRfiIds.has(id)) return <span style={{ color: INK_3, fontSize: 12 }}>—</span>;
        return (
          <IrisDraftPill
            onClick={() => navigate(`/rfis/${id}`)}
          />
        );
      },
    }),
  ] as ColumnDef<RFIRow, unknown>[]), [selectedIds, filteredRfis, draftRfiIds, navigate, profileMap]);

  // ── Early returns ────────────────────────────────────────────────────────
  if (!projectId) return <ProjectGate />;

  if (rfisError) {
    return (
      <PageShell>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, padding: '60px 20px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            backgroundColor: `${STATUS.critical}10`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={24} color={STATUS.critical} />
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: INK }}>Unable to load RFIs</h3>
          <p style={{ margin: 0, fontSize: 14, color: INK_3, maxWidth: 360 }}>
            {(rfisError as Error)?.message || 'Check your connection and try again.'}
          </p>
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>
            Retry
          </Btn>
        </div>
      </PageShell>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <PageShell>
      {/* SR-only live region */}
      <div aria-live="polite" aria-atomic="true" style={{
        position: 'absolute', width: 1, height: 1, overflow: 'hidden',
        clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
      }}>
        {announcement}
      </div>

      {/* ── Sticky page header ─────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: SURFACE_PAGE,
          borderBottom: `1px solid ${BORDER}`,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{
            margin: 0,
            fontFamily: typography.fontFamily,
            fontSize: 18, fontWeight: 600,
            color: INK, letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}>
            RFIs
          </h1>
          <span aria-label={`${rfis.length} total`} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 24, height: 22, padding: '0 7px',
            borderRadius: 999,
            backgroundColor: SURFACE_INSET, color: INK_2,
            fontSize: 12, fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {rfis.length}
          </span>
        </div>

        <div role="tablist" aria-label="Filter RFIs by status" style={{
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {CHIPS.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              count={chipCounts[c.id] ?? 0}
              active={activeChip === c.id}
              alert={c.isAlert}
              onClick={() => setActiveChip(c.id)}
            />
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 240, maxWidth: 380 }}>
          <label style={{ position: 'relative', display: 'block' }}>
            <Search size={14} color={INK_3} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }} />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search RFIs… (press / to focus)"
              aria-label="Search RFIs"
              style={{
                width: '100%', height: 32, padding: '0 10px 0 30px',
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                backgroundColor: '#FFFFFF',
                fontFamily: typography.fontFamily, fontSize: 13,
                color: INK, outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = BORDER_STRONG)}
              onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
            />
          </label>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_RFI_Log" />
          <PermissionGate permission="rfis.create">
            <button
              onClick={() => setShowAIDraftModal(true)}
              aria-label="Draft an RFI with Iris"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', border: `1px solid ${STATUS.iris}33`,
                borderRadius: 6, backgroundColor: STATUS.irisSubtle,
                color: STATUS.iris, fontSize: 13, fontWeight: 600,
                fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Wand2 size={13} />
              Iris draft
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              aria-label="Create new RFI"
              data-testid="create-rfi-button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', border: 'none', borderRadius: 6,
                backgroundColor: STATUS.brandAction, color: '#FFFFFF',
                fontSize: 13, fontWeight: 600,
                fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Plus size={14} />
              New RFI
            </button>
          </PermissionGate>
        </div>
      </header>

      {/* ── KPI strip ──────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 24px 0 24px' }}>
        <RFIKPIs
          totalOpen={totalOpen}
          openCount={openCount}
          overdueCount={overdueCount}
          avgDaysToClose={avgDaysToClose}
          closedThisWeek={closedThisWeek}
          totalCostImpact={totalCostImpact}
          totalRfis={rfis.length}
          closedCount={closedCount}
        />
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <main style={{ padding: '16px 24px 32px 24px' }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {rfisLoading && rfis.length === 0 ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  height: 44, marginBottom: 6, borderRadius: 4,
                  background: `linear-gradient(90deg, ${SURFACE_INSET} 0%, #FFFFFF 50%, ${SURFACE_INSET} 100%)`,
                  backgroundSize: '200% 100%',
                  animation: 'rfi-shimmer 1.6s ease-in-out infinite',
                }} />
              ))}
              <style>{`@keyframes rfi-shimmer { 0%,100% { background-position: 200% 0; } 50% { background-position: -200% 0; } }`}</style>
            </div>
          ) : (
            <VirtualDataTable
              aria-label="RFI Register"
              data={filteredRfis}
              columns={columns}
              rowHeight={44}
              containerHeight={Math.max(220, Math.min(720, filteredRfis.length * 44 + 48))}
              onRowClick={(rfi) => navigate(`/rfis/${rfi.id}`)}
              selectedRowId={null}
              getRowId={(row) => String(row.id)}
              getRowAriaLabel={(rfi) => `RFI ${rfi.rfiNumber}: ${rfi.title}, status ${rfi.status}`}
              getRowStyle={(rfi) => {
                const overdue = rfi.dueDate && isOverdue(rfi.dueDate) && rfi.status !== 'closed';
                if (!overdue) return {};
                return { boxShadow: `inset 3px 0 0 0 ${STATUS.critical}` };
              }}
              loading={rfisLoading}
              emptyMessage={
                rfis.length === 0 ? 'No RFIs yet on this project' : 'No RFIs match the current filters'
              }
              onRowToggleSelectByIndex={(i) => {
                const id = String(filteredRfis[i]?.id);
                if (!id) return;
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                });
              }}
            />
          )}
        </div>
      </main>

      {/* ── Bulk actions ──────────────────────────────────────────────── */}
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
              const selected = rfis.filter((r) => ids.includes(String(r.id)));
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

      {/* ── Detail Panel (preserved) ─────────────────────────────────── */}
      <DetailPanel
        open={!!selectedRfi}
        onClose={() => { setSelectedRfi(null); setEditingDetail(false); }}
        title={selectedRfi?.rfiNumber || ''}
        width="560px"
      >
        {selectedRfi && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: STATUS.brandAction,
                  fontFamily: typography.fontFamilyMono, letterSpacing: '0.02em',
                  padding: '2px 8px', backgroundColor: `${STATUS.brandAction}10`,
                  borderRadius: 4,
                }}>
                  {selectedRfi.rfiNumber}
                </span>
                <StatusPill status={selectedRfi.status as string | null} dueDate={selectedRfi.dueDate} />
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PresenceAvatars entityId={String(selectedRfi.id)} size={22} />
                  <PermissionGate permission="rfis.edit">
                    <Btn variant={editingDetail ? 'primary' : 'secondary'} size="sm" onClick={() => setEditingDetail(!editingDetail)}>
                      {editingDetail ? 'Done' : 'Edit'}
                    </Btn>
                  </PermissionGate>
                </div>
              </div>
              <h3 style={{
                margin: 0, fontFamily: typography.fontFamily,
                fontSize: 18, fontWeight: 600, color: INK, lineHeight: 1.35,
                letterSpacing: '-0.01em',
              }}>
                {selectedRfi.title}
              </h3>
              {(() => {
                const days = daysSince(selectedRfi.created_at as string);
                const overdue = isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'closed';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: days > 10 ? STATUS.critical : days > 5 ? STATUS.medium : INK_3,
                    }}>
                      {days}d open
                    </span>
                    {overdue && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600, color: STATUS.critical,
                      }}>
                        <AlertCircle size={10} /> Overdue
                      </span>
                    )}
                    {selectedRfi.dueDate && !overdue && selectedRfi.status !== 'closed' && (
                      <span style={{ fontSize: 11, color: INK_3 }}>
                        Due {formatShortDate(selectedRfi.dueDate)}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <EditingLockBanner entityType="RFI" entityId={String(selectedRfi.id)} isEditing={editingDetail} />

            {/* Metadata */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              padding: 14, backgroundColor: SURFACE_INSET, borderRadius: 8,
              border: `1px solid ${BORDER}`,
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Avatar initials={selectedRfi.to.split(' ').map((w: string) => w[0]).join('').slice(0, 2)} size={20} />
                      <span style={{ fontSize: 13 }}>{selectedRfi.to}</span>
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
                    fontSize: 13,
                    color: isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'closed' ? STATUS.critical : INK,
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
                displayContent={selectedRfi.ball_in_court ? (
                  <BicCell assigned={selectedRfi.ball_in_court as string} profileMap={profileMap} />
                ) : undefined}
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
                    <span style={{
                      color: Number(selectedRfi.cost_impact) > 0 ? STATUS.critical : STATUS.onTrack,
                      fontWeight: 600, fontSize: 13,
                    }}>
                      {Number(selectedRfi.cost_impact) > 0 ? '+' : ''}
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
                        .format(Number(selectedRfi.cost_impact))}
                    </span>
                  ) : undefined
                }
              />
            </div>

            {/* Description */}
            {selectedRfi.description && (
              <div style={{
                padding: 14, backgroundColor: SURFACE_INSET, borderRadius: 8,
                border: `1px solid ${BORDER}`,
              }}>
                <p style={{
                  margin: 0, fontSize: 13, color: INK_2, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {selectedRfi.description as string}
                </p>
              </div>
            )}

            {/* Responses */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: INK_3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {rfiResponses.length} {rfiResponses.length === 1 ? 'Response' : 'Responses'}
                </span>
                <button
                  onClick={() => navigate(`/rfis/${selectedRfi.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: STATUS.brandAction, fontWeight: 500,
                    padding: '4px 6px', borderRadius: 4,
                  }}
                >
                  Full view <ChevronRight size={12} />
                </button>
              </div>

              {rfiResponses.length === 0 ? (
                <div style={{
                  padding: 18, textAlign: 'center',
                  backgroundColor: SURFACE_INSET, borderRadius: 8,
                  border: `1px dashed ${BORDER}`,
                }}>
                  <MessageSquare size={20} color={INK_3} style={{ opacity: 0.5, marginBottom: 6 }} />
                  <p style={{ margin: 0, fontSize: 13, color: INK_3 }}>No responses yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rfiResponses.slice(0, 3).map((response, idx) => (
                    <div
                      key={response.id ?? idx}
                      style={{
                        padding: 12, backgroundColor: SURFACE_INSET,
                        borderRadius: 6, border: `1px solid ${BORDER}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Avatar initials={(response.author_id ?? 'U').slice(0, 2).toUpperCase()} size={20} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: INK_2 }}>
                          {response.author_id ? response.author_id.slice(0, 8) : 'Unknown'}
                        </span>
                        <span style={{ fontSize: 11, color: INK_3, marginLeft: 'auto' }}>
                          {response.created_at ? formatShortDate(response.created_at) : ''}
                        </span>
                      </div>
                      <p style={{
                        margin: 0, fontSize: 13, color: INK, lineHeight: 1.5,
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
                        fontSize: 12, color: STATUS.brandAction, fontWeight: 500,
                        padding: 8, textAlign: 'center',
                      }}
                    >
                      View all {rfiResponses.length} responses →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick response */}
            <PermissionGate permission="rfis.respond">
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: INK_2 }}>Quick response</span>
                  <button
                    onClick={fetchAISuggestion}
                    disabled={aiSuggestionLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: `1px solid ${BORDER}`,
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 11, color: STATUS.iris, fontWeight: 500,
                    }}
                  >
                    {aiSuggestionLoading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={11} />}
                    Iris suggest
                  </button>
                </div>
                {aiSuggestionError && (
                  <div style={{ marginBottom: 6, fontSize: 11, color: INK_3 }}>
                    Iris unavailable — type manually
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Type your response..."
                    rows={2}
                    disabled={responseSubmitting}
                    style={{
                      flex: 1, padding: '10px 12px',
                      border: `1px solid ${BORDER}`, borderRadius: 6,
                      fontSize: 13, color: INK,
                      backgroundColor: '#FFFFFF', resize: 'none',
                      fontFamily: typography.fontFamily, lineHeight: 1.5,
                      boxSizing: 'border-box', outline: 'none',
                    }}
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
                    aria-label="Send response"
                    style={{
                      width: 36, height: 36, borderRadius: 6, border: 'none',
                      backgroundColor: responseText.trim() && !responseSubmitting ? STATUS.brandAction : SURFACE_INSET,
                      color: responseText.trim() && !responseSubmitting ? '#FFFFFF' : INK_3,
                      cursor: responseText.trim() && !responseSubmitting ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, alignSelf: 'flex-end',
                    }}
                  >
                    {responseSubmitting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </PermissionGate>

            {/* Status quick-actions */}
            <PermissionGate permission="rfis.edit">
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedRfi.status !== 'closed' && (
                  <Btn
                    variant="secondary" size="sm"
                    onClick={() => handleStatusChange(String(selectedRfi.id), 'closed')}
                  >
                    Close RFI
                  </Btn>
                )}
                {selectedRfi.status !== 'under_review' && selectedRfi.status !== 'closed' && (
                  <Btn
                    variant="secondary" size="sm"
                    onClick={() => handleStatusChange(String(selectedRfi.id), 'under_review')}
                  >
                    Send for review
                  </Btn>
                )}
              </div>
            </PermissionGate>

            <PermissionGate permission="rfis.delete">
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                <button
                  onClick={handleDeleteRFI}
                  disabled={deleteRFI.isPending}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: STATUS.critical, fontWeight: 500,
                    padding: '6px 0',
                  }}
                >
                  {deleteRFI.isPending ? 'Deleting…' : 'Delete this RFI'}
                </button>
              </div>
            </PermissionGate>

            <RelatedItems items={getRelatedItemsForRfi(selectedRfi.id as unknown as number)} onNavigate={appNavigate} />
          </div>
        )}
      </DetailPanel>

      {/* Create modal */}
      <RFICreateWizard
        key={aiPrefillKey}
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

      {/* AI Draft Modal */}
      <AnimatePresence>
        {showAIDraftModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Iris Draft RFI"
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
              padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAIDraftModal(false); setAiDraftInput(''); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                backgroundColor: '#FFFFFF', borderRadius: 12,
                padding: 24, width: '100%', maxWidth: 480,
                border: `1px solid ${BORDER}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    backgroundColor: STATUS.irisSubtle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Wand2 size={16} color={STATUS.iris} />
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 600, color: INK }}>Iris Draft RFI</span>
                </div>
                <button
                  onClick={() => { setShowAIDraftModal(false); setAiDraftInput(''); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 6, color: INK_3, display: 'flex',
                    borderRadius: 6,
                  }}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <label style={{ fontSize: 13, fontWeight: 500, color: INK_2, display: 'block', marginBottom: 8 }}>
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
                  border: `1px solid ${BORDER}`, borderRadius: 8,
                  fontSize: 14, color: INK,
                  backgroundColor: '#FFFFFF', resize: 'none',
                  fontFamily: typography.fontFamily, boxSizing: 'border-box',
                  outline: 'none', lineHeight: 1.6,
                }}
              />
              {aiDraftLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: STATUS.iris, fontSize: 13 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Generating draft…
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowAIDraftModal(false); setAiDraftInput(''); }}
                  disabled={aiDraftLoading}
                  style={{
                    padding: '8px 16px', border: `1px solid ${BORDER}`,
                    borderRadius: 6, backgroundColor: 'transparent',
                    cursor: 'pointer', fontSize: 13, color: INK_2,
                    fontWeight: 500, fontFamily: typography.fontFamily,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIDraft}
                  disabled={!aiDraftInput.trim() || aiDraftLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 18px', border: 'none', borderRadius: 6,
                    backgroundColor: aiDraftInput.trim() && !aiDraftLoading ? STATUS.iris : SURFACE_INSET,
                    color: aiDraftInput.trim() && !aiDraftLoading ? '#FFFFFF' : INK_3,
                    cursor: aiDraftInput.trim() && !aiDraftLoading ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 600, fontFamily: typography.fontFamily,
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <Suspense fallback={null}>
        <QuickRFIButton />
      </Suspense>
      {deleteRfiDialog}
    </PageShell>
  );
};

// ── Page shell — full-viewport, no max-width, #FCFCFA surface ──────────────

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    role="region"
    aria-label="RFIs"
    style={{
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      backgroundColor: SURFACE_PAGE,
      fontFamily: typography.fontFamily,
      color: INK,
    }}
  >
    {children}
  </div>
);

// Suppress unused-import warnings for primitives kept for re-export elsewhere.
void spacing; void borderRadius;

const RFIs: React.FC = () => (
  <ErrorBoundary message="RFIs could not be displayed. Check your connection and try again.">
    <RFIsPage />
  </ErrorBoundary>
);

export { RFIs };
