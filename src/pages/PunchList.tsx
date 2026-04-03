import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { VirtualDataTable } from '../components/shared/VirtualDataTable';
import { createColumnHelper } from '@tanstack/react-table';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, DetailPanel, Avatar, RelatedItems, useToast, Skeleton, MetricBox } from '../components/Primitives';
import { ErrorBoundary } from '../components/ErrorBoundary';
import PunchListSkeleton from '../components/field/PunchListSkeleton';
import EmptyState from '../components/ui/EmptyState';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { usePunchItems, useDirectoryContacts } from '../hooks/queries';
import { AlertTriangle, Camera, CheckCircle, CheckSquare, Inbox, MessageSquare, RefreshCw, Search, Sparkles, XCircle } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useAppNavigate, getRelatedItemsForPunchItem } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { toast } from 'sonner';
import { useProjectId } from '../hooks/useProjectId';
import { useCreatePunchItem, useUpdatePunchItem } from '../hooks/mutations';
import CreatePunchItemModal from '../components/forms/CreatePunchItemModal';
import { BulkActionBar } from '../components/shared/BulkActionBar';
import { InlineEditCell, EditableDetailField } from '../components/forms/EditableField';
import { ArrowUp, Trash2, UserCheck, Pencil } from 'lucide-react';
import { PermissionGate } from '../components/auth/PermissionGate';
import { PresenceAvatars } from '../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../components/ui/EditingLockBanner';

const statusMap: Record<string, 'pending' | 'active' | 'complete'> = {
  open: 'pending',
  in_progress: 'active',
  sub_complete: 'active',
  verified: 'complete',
  rejected: 'pending',
};

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  sub_complete: 'Sub Complete',
  verified: 'Verified',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#F5A623',
  in_progress: '#3B82F6',
  sub_complete: '#8B5CF6',
  verified: '#4EC896',
  rejected: '#E74C3C',
};

const plColHelper = createColumnHelper<PunchItem>();

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.open;
  const label = statusLabel[status] ?? status;
  return (
    <div
      role="img"
      aria-label={`Status: ${label}`}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 500, color }}>{label}</span>
    </div>
  );
};

const PhotoThumbnail: React.FC<{ url: string; alt: string }> = ({ url, alt }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <img
        src={url}
        alt={alt}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, cursor: 'zoom-in', display: 'block' }}
      />
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          <img
            src={url}
            alt={alt}
            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: borderRadius.md, border: `1px solid ${colors.borderDefault}`, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'block' }}
          />
        </div>
      )}
    </div>
  );
};

const responsibleColors: Record<string, { bg: string; text: string }> = {
  subcontractor: { bg: 'rgba(58, 123, 200, 0.10)', text: colors.statusInfo },
  gc: { bg: 'rgba(244, 120, 32, 0.10)', text: colors.primaryOrange },
  owner: { bg: 'rgba(124, 93, 199, 0.10)', text: colors.statusReview },
};

const responsibleLabel: Record<string, string> = {
  subcontractor: 'Subcontractor',
  gc: 'General Contractor',
  owner: 'Owner',
};

interface PunchItem {
  id: number;
  itemNumber: string;
  area: string;
  description: string;
  assigned: string;
  priority: string;
  status: string;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  sub_completed_at: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  rejection_reason: string | null;
  hasPhoto: boolean;
  photoCount?: number;
  dueDate: string;
  createdDate: string;
  reportedBy: string;
  responsible: string;
  trade: string;
  location: string;
}

interface Comment {
  author: string;
  initials: string;
  time: string;
  text: string;
}

function getDaysRemaining(dueDate: string): number {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
}

function getDueDateColor(dueDate: string): string {
  const days = getDaysRemaining(dueDate);
  if (days <= 0) return '#E74C3C';
  if (days <= 4) return '#F5A623';
  return colors.statusActive;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}

const PunchListPage: React.FC = () => {
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
  const appNavigate = useAppNavigate();
  const projectId = useProjectId();
  const createPunchItem = useCreatePunchItem();
  const updatePunchItem = useUpdatePunchItem();

  // Fetch punch list items from API
  const { data: punchListResult, isLoading: loading, error: punchError, refetch } = usePunchItems(projectId);
  const punchListRaw = punchListResult?.data ?? [];

  // Fetch team members for assignment
  const { data: teamMembersResult } = useDirectoryContacts(projectId);
  const teamMembers = teamMembersResult?.data ?? [];

  const pageAlerts = getPredictiveAlertsForPage('punchlist');

  // Map API data to component shape
  const punchListItems: PunchItem[] = useMemo(() => {
    return punchListRaw.map((p: any) => {
      const photos = Array.isArray(p.photos) ? p.photos : [];
      return {
        id: p.id,
        itemNumber: `PL-${String(p.number ?? '').padStart(3, '0')}`,
        area: [p.floor, p.area].filter(Boolean).join(', ') || p.location || '',
        description: p.title || p.description || '',
        assigned: p.assigned_to || '',
        priority: p.priority || 'medium',
        status: p.status || 'open',
        verification_status: p.verification_status ?? 'open',
        verified_by: p.verified_by ?? null,
        verified_at: p.verified_at ?? null,
        sub_completed_at: p.sub_completed_at ?? null,
        before_photo_url: p.before_photo_url ?? null,
        after_photo_url: p.after_photo_url ?? null,
        rejection_reason: p.rejection_reason ?? null,
        hasPhoto: photos.length > 0,
        photoCount: photos.length,
        dueDate: p.due_date || '',
        createdDate: p.created_at ? p.created_at.slice(0, 10) : '',
        reportedBy: p.reported_by || '',
        responsible: p.trade === 'general' ? 'gc' : p.trade === 'owner' ? 'owner' : 'subcontractor',
        trade: p.trade || '',
        location: p.location || '',
      };
    });
  }, [punchListRaw]);

  // Counts (memoized)
  const {
    openCount, inProgressCount, subCompleteCount, verifiedCount, rejectedCount,
    totalCount, completionPct, overdueCount,
    criticalCount, highCount, mediumCount, lowCount,
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
      const now = Date.now();
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
      toast.success(`${item.itemNumber} marked sub-complete. Superintendent notified for verification.`);
      setAriaAnnouncement(`${item.itemNumber} marked sub-complete`);
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
      toast.success(`${selected.itemNumber} marked sub-complete. Superintendent notified for verification.`);
      setAriaAnnouncement(`${selected.itemNumber} marked sub-complete`);
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

  const plColumns = useMemo(() => [
    plColHelper.display({
      id: 'select',
      size: 40,
      header: () => null,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="checkbox"
              checked={bulkSelected.has(String(item.id))}
              onChange={(e) => {
                const next = new Set(bulkSelected);
                if (e.target.checked) next.add(String(item.id));
                else next.delete(String(item.id));
                setBulkSelected(next);
              }}
              style={{ width: 16, height: 16, accentColor: colors.primaryOrange, cursor: 'pointer' }}
              aria-label={`Select ${item.itemNumber}`}
            />
          </div>
        );
      },
    }),
    plColHelper.accessor('itemNumber', {
      header: 'Item',
      size: 80,
      cell: (info) => <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{info.getValue()}</span>,
    }),
    plColHelper.accessor('description', {
      header: 'Description',
      size: 300,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug, flex: 1, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {info.getValue()}
                {getAnnotationsForEntity('punch_item', item.id).map((ann: any) => (
                  <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                ))}
              </span>
              {item.before_photo_url && <PhotoThumbnail url={item.before_photo_url} alt="Before photo" />}
            </div>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {item.reportedBy && <span>{item.reportedBy}</span>}
              {item.createdDate && <span> · {formatDate(item.createdDate)}</span>}
            </span>
          </div>
        );
      },
    }),
    plColHelper.accessor('area', {
      header: 'Location',
      size: 180,
      cell: (info) => {
        const item = info.row.original;
        const parts = [info.getValue(), item.location].filter(Boolean).join(', ').split(',').map((s: string) => s.trim()).filter(Boolean);
        if (parts.length <= 1) {
          return <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{parts[0] || '\u2014'}</span>;
        }
        return (
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' as const }}>
            {parts.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: colors.textTertiary, fontSize: 10 }}>{'>'}</span>}
                <span>{part}</span>
              </React.Fragment>
            ))}
          </span>
        );
      },
    }),
    plColHelper.accessor('assigned', {
      header: 'Assigned',
      size: 120,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{info.getValue()}</span>
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: responsibleColors[item.responsible]?.text || colors.textTertiary }}>
              {responsibleLabel[item.responsible] || ''}
            </span>
          </div>
        );
      },
    }),
    plColHelper.accessor('priority', {
      header: 'Priority',
      size: 90,
      cell: (info) => <PriorityTag priority={info.getValue() as any} />,
    }),
    plColHelper.accessor('verification_status', {
      header: 'Status',
      size: 130,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <InlineEditCell
              value={info.getValue()}
              type="select"
              options={[
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'sub_complete', label: 'Sub Complete' },
                { value: 'verified', label: 'Verified' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              onSave={async (val) => {
                await updatePunchItem.mutateAsync({ id: String(item.id), updates: { verification_status: val }, projectId: projectId! });
                toast.success(`${item.itemNumber} status updated`);
              }}
              displayComponent={<StatusDot status={info.getValue()} />}
            />
          </div>
        );
      },
    }),
    plColHelper.accessor('dueDate', {
      header: 'Due',
      size: 110,
      cell: (info) => {
        const val = info.getValue();
        if (!val) return null;
        const days = getDaysRemaining(val);
        const color = getDueDateColor(val);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color, fontVariantNumeric: 'tabular-nums' as const }}>
              {formatDate(val)}
            </span>
            {days <= 0 ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#E74C3C' }}>{Math.abs(days)} days overdue</span>
            ) : days <= 4 ? (
              <span style={{ fontSize: 10, color: '#F5A623' }}>{days}d left</span>
            ) : (
              <span style={{ fontSize: 10, color: colors.textTertiary }}>{days}d left</span>
            )}
          </div>
        );
      },
    }),
    plColHelper.accessor('trade', {
      header: 'Responsible',
      size: 110,
      cell: (info) => {
        const trade = info.getValue()?.toLowerCase() ?? '';
        const item = info.row.original;
        let bg = 'transparent';
        let label = item.responsible === 'gc' ? 'GC' : item.responsible === 'owner' ? 'Owner' : trade || 'Sub';
        const isSubTrade = trade.includes('electric') || trade.includes('plumb') || trade.includes('hvac') || trade.includes('drywall') || trade.includes('paint');
        let textColor = '#F5A623';
        if (item.responsible === 'gc') {
          bg = 'rgba(59,130,246,0.10)';
          textColor = '#3B82F6';
        } else if (item.responsible === 'owner') {
          bg = 'rgba(244,120,32,0.10)';
          textColor = colors.primaryOrange as string;
        } else if (isSubTrade || item.responsible === 'subcontractor') {
          bg = 'rgba(245,166,35,0.12)';
          textColor = '#F5A623';
        }
        return (
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: borderRadius.full, backgroundColor: bg, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: textColor, whiteSpace: 'nowrap' as const }}>
            {label}
          </span>
        );
      },
    }),
    plColHelper.display({
      id: 'inline_actions',
      header: '',
      size: 160,
      cell: (info) => {
        const item = info.row.original;
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {item.verification_status === 'open' && hasPermission('punch_list.edit') && (
              <button
                onClick={() => handleMarkInProgressById(item)}
                style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: '#EFF6FF', color: STATUS_COLORS.in_progress, border: `1px solid ${STATUS_COLORS.in_progress}40`, borderRadius: borderRadius.base, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
              >
                Start
              </button>
            )}
            {item.verification_status === 'in_progress' && hasPermission('punch_list.edit') && (
              <button
                onClick={() => handleMarkSubCompleteById(item)}
                style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: '#F5F3FF', color: STATUS_COLORS.sub_complete, border: `1px solid ${STATUS_COLORS.sub_complete}40`, borderRadius: borderRadius.base, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
              >
                Mark Complete
              </button>
            )}
            {item.verification_status === 'sub_complete' && hasPermission('punch_list.verify') && (
              <>
                <button
                  onClick={() => handleVerifyById(item)}
                  style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: colors.statusActiveSubtle, color: colors.statusActive, border: `1px solid ${colors.statusActive}40`, borderRadius: borderRadius.base, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                >
                  Verify
                </button>
                {inlineRejectId === item.id ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Reason..."
                      value={inlineRejectNote}
                      autoFocus
                      onChange={(e) => setInlineRejectNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRejectById(item, inlineRejectNote);
                        if (e.key === 'Escape') { setInlineRejectId(null); setInlineRejectNote(''); }
                      }}
                      style={{ padding: '2px 6px', fontSize: 11, fontFamily: 'inherit', border: `1px solid ${colors.statusCritical}80`, borderRadius: borderRadius.base, width: 110, outline: 'none', color: colors.textPrimary }}
                    />
                    <button
                      onClick={() => handleRejectById(item, inlineRejectNote)}
                      style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: colors.statusCriticalSubtle, color: colors.statusCritical, border: `1px solid ${colors.statusCritical}40`, borderRadius: borderRadius.base, cursor: 'pointer' }}
                    >
                      Send
                    </button>
                    <button
                      onClick={() => { setInlineRejectId(null); setInlineRejectNote(''); }}
                      style={{ padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', backgroundColor: 'transparent', color: colors.textTertiary, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, cursor: 'pointer' }}
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setInlineRejectId(item.id); setInlineRejectNote(''); }}
                    style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', backgroundColor: colors.statusCriticalSubtle, color: colors.statusCritical, border: `1px solid ${colors.statusCritical}40`, borderRadius: borderRadius.base, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                  >
                    Reject
                  </button>
                )}
              </>
            )}
          </div>
        );
      },
    }),
  ], [bulkSelected, setBulkSelected, updatePunchItem, projectId, hasPermission, handleMarkInProgressById, handleMarkSubCompleteById, handleVerifyById, handleRejectById, inlineRejectId, inlineRejectNote]);

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

      {/* Predictive Alert Banners */}
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {/* AI Insight Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>AI Analysis: 2 punch items trending overdue based on current response times. Completion rate at {completionPct}%. Floor 8 has the highest concentration of open items.</p>
          <button onClick={() => setAtRiskFilter(true)} style={{ marginTop: spacing['2'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.statusReview, color: 'white', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer' }}>View At Risk Items</button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? '8px' : spacing['3'], marginBottom: spacing['4'] }}>
        <MetricBox label="Total Items" value={totalCount} />
        <MetricBox label="Open" value={openCount} colorOverride={openCount > 0 ? 'warning' : undefined} />
        <MetricBox label="In Progress" value={inProgressCount} />
        <MetricBox
          label="Awaiting Verification"
          value={subCompleteCount}
          bgColorOverride={subCompleteCount > 0 ? 'rgba(139, 92, 246, 0.07)' : undefined}
          valueColorOverride={subCompleteCount > 0 ? '#8B5CF6' : undefined}
        />
        <MetricBox label="Verified" value={verifiedCount} colorOverride={verifiedCount > 0 ? 'success' : undefined} />
        <MetricBox label="Overdue" value={overdueCount} colorOverride={overdueCount > 0 ? 'danger' : undefined} />
      </div>

      {/* Completion Progress Bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: spacing['4'] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>
              {verifiedCount} of {totalCount} items verified ({completionPct}%)
            </span>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.semibold }}>{completionPct}%</span>
          </div>
          <div style={{ height: 6, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${completionPct}%`,
                backgroundColor: colors.statusActive,
                borderRadius: borderRadius.full,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['3'], flexWrap: 'wrap' as const }}>
        {[
          { value: 'all', label: 'All', count: totalCount, color: colors.textSecondary, activeBg: `${colors.primaryOrange}15`, activeColor: colors.primaryOrange },
          { value: 'open', label: 'Open', count: openCount, color: STATUS_COLORS.open, activeBg: '#FEF3C7', activeColor: STATUS_COLORS.open },
          { value: 'in_progress', label: 'In Progress', count: inProgressCount, color: STATUS_COLORS.in_progress, activeBg: '#EFF6FF', activeColor: STATUS_COLORS.in_progress },
          { value: 'sub_complete', label: 'Awaiting Verification', count: subCompleteCount, color: STATUS_COLORS.sub_complete, activeBg: '#F5F3FF', activeColor: STATUS_COLORS.sub_complete },
          { value: 'verified', label: 'Verified', count: verifiedCount, color: STATUS_COLORS.verified, activeBg: `${STATUS_COLORS.verified}20`, activeColor: STATUS_COLORS.verified },
          { value: 'overdue', label: 'Overdue', count: overdueCount, color: STATUS_COLORS.rejected, activeBg: `${STATUS_COLORS.rejected}15`, activeColor: STATUS_COLORS.rejected },
        ].map(tab => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setAtRiskFilter(false); }}
              style={{
                padding: `${spacing['1']} ${spacing['3']}`,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                backgroundColor: isActive ? tab.activeBg : 'transparent',
                color: isActive ? tab.activeColor : colors.textSecondary,
                border: `1px solid ${isActive ? tab.activeColor : colors.borderDefault}`,
                borderRadius: borderRadius.full,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                transition: 'all 0.1s',
              }}
            >
              {tab.label}
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, opacity: 0.8 }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Area/Floor Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
        <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Filter by Area:</label>
        <select
          value={areaFilter}
          onChange={(e) => { setAreaFilter(e.target.value); setAtRiskFilter(false); }}
          style={{
            padding: `${spacing['1']} ${spacing['3']}`,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.base,
            backgroundColor: colors.white,
            color: colors.textPrimary,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {uniqueAreas.map(area => (
            <option key={area} value={area}>{area === 'all' ? 'All Areas' : area}</option>
          ))}
        </select>
        {atRiskFilter && (
          <button
            onClick={() => setAtRiskFilter(false)}
            style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              fontSize: typography.fontSize.caption,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              backgroundColor: colors.statusCriticalSubtle,
              color: colors.statusCritical,
              border: `1px solid ${colors.statusCritical}`,
              borderRadius: borderRadius.full,
              cursor: 'pointer',
            }}
          >
            Showing At Risk Items \u00d7
          </button>
        )}
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {filteredList.length === 0 && hasActiveFilters && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['3'], padding: `${spacing['8']} ${spacing['4']}`, textAlign: 'center' }}>
              <Search size={32} color={colors.textTertiary} />
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>No punch items match your current filters</p>
              <button
                onClick={clearAllFilters}
                style={{ padding: `${spacing['2']} ${spacing['4']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.base, cursor: 'pointer' }}
              >
                Clear All Filters
              </button>
            </div>
          )}
          {filteredList.map((item) => {
            const statusDotColor = STATUS_COLORS[item.verification_status] ?? STATUS_COLORS.open;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(item.id); } }}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.borderDefault}`,
                  padding: '16px',
                  minHeight: '72px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Card content */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: '16px', fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: 1.3 }}>
                      {item.description}
                    </div>
                    {item.area && (
                      <div style={{ fontSize: '14px', color: colors.textTertiary }}>{item.area}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '44px', minWidth: '44px' }}
                        aria-label={`Status: ${statusLabel[item.verification_status] ?? item.verification_status}`}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusDotColor, flexShrink: 0 }} aria-hidden="true" />
                        <span style={{ fontSize: '13px', color: statusDotColor, fontWeight: 500 }} aria-hidden="true">
                          {statusLabel[item.verification_status] ?? item.verification_status}
                        </span>
                      </div>
                      <PriorityTag priority={item.priority as any} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                      {item.assigned && (
                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>{item.assigned}</span>
                      )}
                      {item.dueDate && (
                        <span style={{ fontSize: '13px', fontWeight: 500, color: getDueDateColor(item.dueDate) }}>
                          Due {formatDate(item.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Before photo thumbnail */}
                  {item.before_photo_url && (
                    <div style={{ flexShrink: 0 }}>
                      <img
                        src={item.before_photo_url}
                        alt="Before"
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card padding="0">
          {filteredList.length === 0 && hasActiveFilters ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['3'], padding: `${spacing['12']} ${spacing['4']}`, textAlign: 'center' }}>
              <Search size={36} color={colors.textTertiary} />
              <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, margin: 0 }}>No punch items match your current filters</p>
              <button
                onClick={clearAllFilters}
                style={{ padding: `${spacing['2']} ${spacing['4']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.base, cursor: 'pointer' }}
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <VirtualDataTable
              aria-label="Punch list items"
              data={filteredList}
              columns={plColumns}
              rowHeight={48}
              containerHeight={600}
              onRowClick={(row) => setSelectedId(row.id)}
              selectedRowId={selectedId}
              getRowId={(row) => String(row.id)}
              emptyMessage="No items match your filters"
            />
          )}
        </Card>
      )}

      <DetailPanel
        open={!!selected}
        onClose={() => { setSelectedId(null); setEditingDetail(false); setShowRejectNote(false); setRejectNote(''); }}
        title={selected?.itemNumber || ''}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            {/* Title + Edit Toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing['3'] }}>
                <h3 style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md, flex: 1 }}>
                  {selected.description}
                </h3>
                <PresenceAvatars entityId={String(selected.id)} size={24} />
                <PermissionGate permission="punch_list.edit">
                  <Btn
                    variant={editingDetail ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setEditingDetail(!editingDetail)}
                  >
                    {editingDetail ? 'Done' : 'Edit'}
                  </Btn>
                </PermissionGate>
              </div>
              <EditingLockBanner entityType="punch item" entityId={String(selected.id)} isEditing={editingDetail} />
              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                <PriorityTag priority={selected.priority as any} />
                <StatusTag status={statusMap[selected.verification_status]} label={statusLabel[selected.verification_status] ?? selected.verification_status} />
                <StatusDot status={selected.verification_status} />
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
              <EditableDetailField
                label="Area / Location"
                value={selected.area}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { location: val }, projectId: projectId! });
                  toast.success('Location updated');
                }}
              />
              <EditableDetailField
                label="Assigned To"
                value={selected.assigned}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { assigned_to: val }, projectId: projectId! });
                  toast.success('Assignee updated');
                }}
                displayContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <Avatar initials={selected.assigned.split(' ').map((n: string) => n[0]).join('')} size={28} />
                    <span style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{selected.assigned}</span>
                  </div>
                }
              />
              <EditableDetailField
                label="Priority"
                value={selected.priority}
                editing={editingDetail}
                type="select"
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
                onSave={async (val) => {
                  await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { priority: val }, projectId: projectId! });
                  toast.success('Priority updated');
                }}
                displayContent={<PriorityTag priority={selected.priority as any} />}
              />
              <EditableDetailField
                label="Verification Status"
                value={selected.verification_status}
                editing={editingDetail}
                type="select"
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'sub_complete', label: 'Sub Complete' },
                  { value: 'verified', label: 'Verified' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                onSave={async (val) => {
                  await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { verification_status: val }, projectId: projectId! });
                  toast.success('Status updated');
                }}
                displayContent={<StatusDot status={selected.verification_status} />}
              />
              <EditableDetailField
                label="Due Date"
                value={selected.dueDate}
                editing={editingDetail}
                type="date"
                onSave={async (val) => {
                  await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { due_date: val }, projectId: projectId! });
                  toast.success('Due date updated');
                }}
                displayContent={
                  <div style={{ fontSize: typography.fontSize.base, color: getDueDateColor(selected.dueDate), fontWeight: typography.fontWeight.medium }}>{selected.dueDate}</div>
                }
              />
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reported By</div>
                <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{selected.reportedBy}</div>
              </div>
            </div>

            {/* Before / After Photos */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Before / After Photos</div>
              <div style={isMobile ? {
                display: 'flex',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                gap: 0,
                borderRadius: borderRadius.base,
              } : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
                {/* Before Photo */}
                <div style={isMobile ? { scrollSnapAlign: 'start', minWidth: '100%', flexShrink: 0 } : {}}>
                  <div style={{ fontSize: typography.fontSize.caption, fontWeight: 600, color: colors.textSecondary, marginBottom: spacing.xs }}>Before</div>
                  {selected.before_photo_url ? (
                    <img
                      src={selected.before_photo_url}
                      alt="Before"
                      style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: borderRadius.base, border: `1px solid ${colors.border}` }}
                    />
                  ) : (
                    <div
                      style={{ width: '100%', height: '140px', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.base, border: `2px dashed ${colors.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, cursor: 'pointer' }}
                      onClick={handleAddPhoto} role="button" tabIndex={0} aria-label="Add before photo"
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddPhoto(); } }}
                    >
                      <Camera size={24} color={colors.textTertiary} />
                      <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Add before photo</span>
                    </div>
                  )}
                </div>
                {/* After Photo */}
                <div style={isMobile ? { scrollSnapAlign: 'start', minWidth: '100%', flexShrink: 0 } : {}}>
                  <div style={{ fontSize: typography.fontSize.caption, fontWeight: 600, color: colors.textSecondary, marginBottom: spacing.xs }}>After</div>
                  {selected.after_photo_url ? (
                    <img
                      src={selected.after_photo_url}
                      alt="After"
                      style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: borderRadius.base, border: `1px solid ${colors.border}` }}
                    />
                  ) : (
                    <div
                      style={{ width: '100%', height: '140px', backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.base, border: `2px dashed ${colors.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, cursor: selected.verification_status === 'open' ? 'not-allowed' : 'pointer', opacity: selected.verification_status === 'open' ? 0.5 : 1 }}
                      onClick={selected.verification_status !== 'open' ? handleAddPhoto : undefined}
                      role="button" tabIndex={selected.verification_status !== 'open' ? 0 : -1}
                      aria-label="Add after photo"
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && selected.verification_status !== 'open') { e.preventDefault(); handleAddPhoto(); } }}
                    >
                      <Camera size={24} color={colors.textTertiary} />
                      <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                        {selected.verification_status === 'open' ? 'Available after sub completes' : 'Add after photo'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {selected.rejection_reason && (
                <div style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base, border: `1px solid ${colors.statusCritical}20` }}>
                  <span style={{ fontSize: typography.fontSize.xs, fontWeight: 600, color: colors.statusCritical }}>Rejection Reason: </span>
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.statusCritical }}>{selected.rejection_reason}</span>
                </div>
              )}
            </div>

            {/* Status History Timeline */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Status History</div>
              <div style={{ position: 'relative', paddingLeft: spacing['5'] }}>
                {/* Vertical line */}
                <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 1, backgroundColor: colors.borderLight }} />
                {[
                  selected.createdDate ? {
                    label: 'Item reported',
                    sub: selected.reportedBy,
                    date: formatDate(selected.createdDate),
                    dot: colors.statusCritical,
                  } : null,
                  selected.sub_completed_at ? {
                    label: 'Marked complete by sub',
                    sub: selected.assigned,
                    date: formatDate(selected.sub_completed_at),
                    dot: colors.statusPending,
                  } : null,
                  selected.rejection_reason ? {
                    label: 'Rejected by superintendent',
                    sub: selected.rejection_reason,
                    date: '',
                    dot: colors.statusCritical,
                  } : null,
                  selected.verified_at ? {
                    label: 'Verified and closed',
                    sub: selected.verified_by || '',
                    date: formatDate(selected.verified_at),
                    dot: colors.statusActive,
                  } : null,
                ].filter(Boolean).map((event, idx) => event && (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], marginBottom: spacing['3'], position: 'relative' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: event.dot, border: `2px solid white`, boxShadow: `0 0 0 1px ${event.dot}`, flexShrink: 0, marginTop: 1, zIndex: 1 }} />
                    <div>
                      <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{event.label}</div>
                      {event.sub && <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{event.sub}</div>}
                    </div>
                    {event.date && <div style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' as const }}>{event.date}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
                <MessageSquare size={16} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Comments ({comments.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                {comments.length === 0 && (
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center', padding: spacing.lg }}>
                    No comments yet
                  </p>
                )}
                {comments.map((comment, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: spacing.md }}>
                    <Avatar initials={comment.initials} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.xs }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                          {comment.author}
                        </span>
                        <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                          {comment.time}
                        </span>
                      </div>
                      <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed, margin: 0 }}>
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForPunchItem(selected.id)} onNavigate={appNavigate} />

            {/* Actions */}
            <div style={{ display: 'flex', gap: spacing.sm, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
              {selected.verification_status === 'open' && (
                <PermissionGate permission="punch_list.edit">
                  <Btn variant="secondary" onClick={handleMarkInProgress} icon={<CheckCircle size={16} />}>Start Work</Btn>
                </PermissionGate>
              )}
              {selected.verification_status === 'in_progress' && (
                <PermissionGate permission="punch_list.edit">
                  <Btn variant="primary" onClick={handleMarkSubComplete} icon={<CheckCircle size={16} />}>Mark Complete</Btn>
                </PermissionGate>
              )}
              {selected.verification_status === 'sub_complete' && (
                <>
                  <PermissionGate permission="punch_list.verify">
                    <Btn variant="primary" onClick={handleVerify} icon={<CheckCircle size={16} />}>Verify</Btn>
                  </PermissionGate>
                  <PermissionGate permission="punch_list.verify">
                    {showRejectNote ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, width: '100%' }}>
                        <textarea
                          autoFocus
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="Describe what needs to be corrected (required)"
                          rows={3}
                          style={{ width: '100%', padding: spacing.sm, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.statusCritical}80`, borderRadius: borderRadius.base, resize: 'none', outline: 'none', color: colors.textPrimary, backgroundColor: colors.statusCriticalSubtle, boxSizing: 'border-box' as const }}
                        />
                        <div style={{ display: 'flex', gap: spacing.sm }}>
                          <Btn variant="secondary" size="sm" icon={<XCircle size={14} />} onClick={handleReject} style={{ color: colors.statusCritical, borderColor: colors.statusCritical }}>Confirm Reject</Btn>
                          <Btn variant="secondary" size="sm" onClick={() => { setShowRejectNote(false); setRejectNote(''); }}>Cancel</Btn>
                        </div>
                      </div>
                    ) : (
                      <Btn variant="secondary" onClick={() => setShowRejectNote(true)}>Reject</Btn>
                    )}
                  </PermissionGate>
                </>
              )}
              {selected.verification_status === 'rejected' && (
                <PermissionGate permission="punch_list.edit">
                  <Btn variant="secondary" onClick={handleMarkSubComplete} icon={<RefreshCw size={16} />}>Resubmit</Btn>
                </PermissionGate>
              )}
              {selected.verification_status === 'verified' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(78, 200, 150, 0.08)', borderRadius: borderRadius.base, width: '100%' }}>
                  <CheckCircle size={18} color={colors.tealSuccess} />
                  <div>
                    <span style={{ fontSize: typography.fontSize.base, color: colors.tealSuccess, fontWeight: typography.fontWeight.medium }}>Verified and closed</span>
                    {selected.verified_by && (
                      <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, display: 'block' }}>by {selected.verified_by}{selected.verified_at ? ` on ${formatDate(selected.verified_at)}` : ''}</span>
                    )}
                  </div>
                </div>
              )}
              {selected.verification_status !== 'verified' && (
                <PermissionGate permission="punch_list.edit">
                  <Btn variant="secondary" onClick={handleAddPhoto} icon={<Camera size={16} />}>Add Photo</Btn>
                </PermissionGate>
              )}
            </div>
          </div>
        )}
      </DetailPanel>

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
      )}

      <PermissionGate permission="punch_list.edit">
      <BulkActionBar
        selectedIds={Array.from(bulkSelected)}
        onClearSelection={() => setBulkSelected(new Set())}
        entityLabel="punch items"
        actions={[
          {
            label: 'Mark Complete',
            icon: <CheckCircle size={14} />,
            variant: 'primary',
            onClick: async (ids) => {
              for (const id of ids) {
                await updatePunchItem.mutateAsync({ id, updates: { verification_status: 'sub_complete', sub_completed_at: new Date().toISOString() }, projectId: projectId! });
              }
              toast.success(`${ids.length} items marked sub-complete. Superintendent notified.`);
            },
          },
          {
            label: 'Change Priority',
            icon: <ArrowUp size={14} />,
            onClick: async (ids) => {
              for (const id of ids) {
                await updatePunchItem.mutateAsync({ id, updates: { priority: 'high' }, projectId: projectId! });
              }
              toast.success(`${ids.length} items set to high priority`);
            },
          },
          {
            label: 'Delete',
            icon: <Trash2 size={14} />,
            variant: 'danger',
            confirm: true,
            confirmMessage: `Are you sure you want to delete ${bulkSelected.size} punch items? This cannot be undone.`,
            onClick: async (ids) => {
              toast.success(`${ids.length} items deleted`);
            },
          },
        ]}
      />
      </PermissionGate>
    </PageContainer>
  );
};

export const PunchList: React.FC = () => (
  <ErrorBoundary message="The punch list could not be displayed. Check your connection and try again.">
    <PunchListPage />
  </ErrorBoundary>
);

export default PunchList;
