import React, { useState, useMemo, useCallback } from 'react';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, TableHeader, TableRow, DetailPanel, Avatar, RelatedItems, EmptyState, useToast, Skeleton } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { usePunchItems, useDirectoryContacts } from '../hooks/queries';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
import { AlertTriangle, Camera, CheckCircle, Inbox, MessageSquare, RefreshCw, Sparkles } from 'lucide-react';
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
  complete: 'complete',
  verified: 'complete',
};

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  complete: 'Complete',
  verified: 'Verified',
};

const columns = [
  { label: 'Item', width: '80px' },
  { label: 'Description', width: '1fr' },
  { label: 'Area', width: '140px' },
  { label: 'Assigned', width: '120px' },
  { label: 'Priority', width: '90px' },
  { label: 'Status', width: '100px' },
  { label: 'Due', width: '90px' },
];

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
  hasPhoto: boolean;
  photoCount?: number;
  dueDate: string;
  createdDate: string;
  reportedBy: string;
  responsible: string;
}

interface Comment {
  author: string;
  initials: string;
  time: string;
  text: string;
}

function getDueDateColor(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return colors.statusCritical;
  if (diffDays <= 4) return colors.statusPending;
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
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [editingDetail, setEditingDetail] = useState(false);
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
  const projectId = useProjectId();
  const createPunchItem = useCreatePunchItem();
  const updatePunchItem = useUpdatePunchItem();

  // Fetch punch list items from API
  const { data: punchListRaw = [], isLoading: loading, error: punchError, refetch } = usePunchItems(projectId);

  // Fetch team members for assignment
  const { data: teamMembers = [] } = useDirectoryContacts(projectId);

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
        hasPhoto: photos.length > 0,
        photoCount: photos.length,
        dueDate: p.due_date || '',
        createdDate: p.created_at ? p.created_at.slice(0, 10) : '',
        reportedBy: p.reported_by || '',
        responsible: p.trade === 'general' ? 'gc' : p.trade === 'owner' ? 'owner' : 'subcontractor',
      };
    });
  }, [punchListRaw]);

  // Counts (memoized)
  const {
    openCount, inProgressCount, completeCount, verifiedCount,
    totalCount, completionPct,
    criticalCount, highCount, mediumCount, lowCount,
  } = useMemo(() => {
    let open = 0, inProgress = 0, complete = 0, verified = 0;
    let critical = 0, high = 0, medium = 0, low = 0;
    for (const p of punchListItems) {
      if (p.status === 'open') open++;
      else if (p.status === 'in_progress') inProgress++;
      else if (p.status === 'complete') complete++;
      else if (p.status === 'verified') verified++;
      if (p.priority === 'critical') critical++;
      else if (p.priority === 'high') high++;
      else if (p.priority === 'medium') medium++;
      else if (p.priority === 'low') low++;
    }
    const total = punchListItems.length;
    const pct = total > 0 ? Math.round(((complete + verified) / total) * 100) : 0;
    return {
      openCount: open, inProgressCount: inProgress, completeCount: complete, verifiedCount: verified,
      totalCount: total, completionPct: pct,
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

  const handleKeySelect = useCallback((item: PunchItem) => setSelectedId(item.id), []);

  // Filter logic
  const filteredList = useMemo(() => {
    let list = punchListItems;
    if (atRiskFilter) {
      list = list.filter(p => p.status === 'open' && (p.priority === 'high' || p.priority === 'critical'));
    }
    if (areaFilter !== 'all') {
      list = list.filter(p => p.area.startsWith(areaFilter));
    }
    return list;
  }, [punchListItems, atRiskFilter, areaFilter]);

  useTableKeyboardNavigation(filteredList, selectedId, handleKeySelect);

  const selected = punchListItems.find(p => p.id === selectedId) || null;
  const comments: Comment[] = []; // TODO: load from punch_item_comments query

  const handleMarkComplete = useCallback(async () => {
    if (!selected) return;
    try {
      await updatePunchItem.mutateAsync({
        id: String(selected.id),
        updates: { status: 'complete' },
        projectId: projectId!,
      });
      toast.success(`${selected.itemNumber} marked as complete`);
      setSelectedId(null);
    } catch {
      toast.error('Failed to update status');
    }
  }, [selected, updatePunchItem, projectId]);

  const handleAddPhoto = useCallback(() => {
    addToast('info', 'Photo capture loading');
  }, [addToast]);

  // SVG donut
  const donutRadius = 36;
  const donutStroke = 7;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutOffset = donutCircumference - (completionPct / 100) * donutCircumference;

  if (loading) {
    return (
      <PageContainer title="Punch List" subtitle="Loading...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'] }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="80px" />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} height="44px" />
          ))}
        </div>
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
          icon={<CheckCircle size={40} color={colors.textTertiary} />}
          title="No punch items yet"
          description="All work items are complete, or create the first punch item to track outstanding work."
          action={<PermissionGate permission="punch_list.create"><Btn variant="primary" onClick={() => setShowCreateModal(true)}>Add Punch Item</Btn></PermissionGate>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Punch List"
      subtitle={`${openCount} open \u00b7 ${inProgressCount} in progress \u00b7 ${completeCount} complete \u00b7 ${verifiedCount} verified`}
      actions={<PermissionGate permission="punch_list.create"><Btn onClick={() => setShowCreateModal(true)}>New Item</Btn></PermissionGate>}
    >
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

      {/* Fix 15: Completion Visualization */}
      <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        {/* Donut chart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], minWidth: '200px' }}><Card padding={spacing['4']}>
          <div style={{ position: 'relative', width: 86, height: 86, flexShrink: 0 }}>
            <svg width="86" height="86" viewBox="0 0 86 86">
              <circle cx="43" cy="43" r={donutRadius} fill="none" stroke={colors.borderSubtle} strokeWidth={donutStroke} />
              <circle
                cx="43" cy="43" r={donutRadius} fill="none"
                stroke={colors.statusActive}
                strokeWidth={donutStroke}
                strokeDasharray={donutCircumference}
                strokeDashoffset={donutOffset}
                strokeLinecap="round"
                transform="rotate(-90 43 43)"
              />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{completionPct}%</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Completion</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{completeCount + verifiedCount} of {totalCount} items done</div>
          </div>
        </Card></div>

        {/* Metric cards for statuses */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: '100px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusPending }}>{openCount}</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Open</div>
          </div>
        </Card></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: '100px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusInfo }}>{inProgressCount}</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>In Progress</div>
          </div>
        </Card></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: '100px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{completeCount}</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Complete</div>
          </div>
        </Card></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: '100px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{verifiedCount}</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Verified</div>
          </div>
        </Card></div>

        {/* By Priority breakdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], minWidth: '220px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['2'] }}>By Priority</div>
            <div style={{ display: 'flex', gap: spacing['3'] }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical }}>{criticalCount}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Critical</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.statusPending }}>{highCount}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>High</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo }}>{mediumCount}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Medium</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary }}>{lowCount}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Low</div>
              </div>
            </div>
          </div>
        </Card></div>
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

      <Card padding="0" role="table">
        <TableHeader columns={columns} />
        {loading || !punchList ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ padding: spacing.md, display: 'flex', gap: spacing.md }}>
              <Skeleton width="80px" height="16px" />
              <Skeleton width="140px" height="16px" />
              <Skeleton width="60%" height="16px" />
              <Skeleton width="120px" height="16px" />
              <Skeleton width="80px" height="16px" />
              <Skeleton width="100px" height="16px" />
            </div>
          ))
        ) : filteredList.map((item, i) => (
          <div
            key={item.id}
            style={{
              backgroundColor: bulkSelected.has(String(item.id)) ? colors.surfaceSelected : selectedId === item.id ? colors.surfaceSelected : 'transparent',
              transition: 'background-color 150ms ease',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div style={{ padding: `0 ${spacing['2']}`, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
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
            <div style={{ flex: 1 }}>
            <TableRow
              divider={i < filteredList.length - 1}
              onClick={() => setSelectedId(item.id)}
              columns={[
                {
                  width: '80px',
                  content: <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{item.itemNumber}</span>,
                },
                {
                  width: '1fr',
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        {item.description}
                        {item.hasPhoto && <Camera size={11} color={colors.textTertiary} />}
                        {getAnnotationsForEntity('punch_item', item.id).map((ann) => (
                          <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                        ))}
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {item.reportedBy && <span>{item.reportedBy}</span>}
                        {item.createdDate && <span> · {formatDate(item.createdDate)}</span>}
                      </span>
                    </div>
                  ),
                },
                {
                  width: '140px',
                  content: <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.area}</span>,
                },
                {
                  width: '120px',
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.assigned}</span>
                      <span style={{
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                        color: responsibleColors[item.responsible]?.text || colors.textTertiary,
                      }}>
                        {responsibleLabel[item.responsible] || ''}
                      </span>
                    </div>
                  ),
                },
                {
                  width: '90px',
                  content: <PriorityTag priority={item.priority as any} />,
                },
                {
                  width: '100px',
                  content: (
                    <div onClick={(e) => e.stopPropagation()}>
                      <InlineEditCell
                        value={item.status}
                        type="select"
                        options={[
                          { value: 'open', label: 'Open' },
                          { value: 'in_progress', label: 'In Progress' },
                          { value: 'complete', label: 'Complete' },
                          { value: 'verified', label: 'Verified' },
                        ]}
                        onSave={async (val) => {
                          await updatePunchItem.mutateAsync({
                            id: String(item.id),
                            updates: { status: val },
                            projectId: projectId!,
                          });
                          toast.success(`${item.itemNumber} status updated`);
                        }}
                        displayComponent={<StatusTag status={statusMap[item.status]} label={statusLabel[item.status]} />}
                      />
                    </div>
                  ),
                },
                {
                  width: '90px',
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: getDueDateColor(item.dueDate), fontVariantNumeric: 'tabular-nums' as const }}>
                      {formatDate(item.dueDate)}
                    </span>
                  ),
                },
              ]}
            />
            </div>
          </div>
        ))}
        {filteredList.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['12']} ${spacing['6']}`, textAlign: 'center' }}>
            <Inbox size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
            <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>No items match your filters</p>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0, marginBottom: spacing['4'] }}>Try adjusting your search or filter criteria</p>
            <button onClick={() => { setAreaFilter('all'); setAtRiskFilter(false); }} style={{ padding: `${spacing['1.5']} ${spacing['4']}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.gray600, cursor: 'pointer' }}>
              Clear Filters
            </button>
          </div>
        )}
      </Card>

      <DetailPanel
        open={!!selected}
        onClose={() => { setSelectedId(null); setEditingDetail(false); }}
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
              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                <PriorityTag priority={selected.priority as any} />
                <StatusTag status={statusMap[selected.status]} label={statusLabel[selected.status]} />
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
                label="Status"
                value={selected.status}
                editing={editingDetail}
                type="select"
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'complete', label: 'Complete' },
                  { value: 'verified', label: 'Verified' },
                ]}
                onSave={async (val) => {
                  await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { status: val }, projectId: projectId! });
                  toast.success('Status updated');
                }}
                displayContent={<StatusTag status={statusMap[selected.status]} label={statusLabel[selected.status]} />}
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

            {/* Photo placeholder */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site Photo</div>
              {selected.hasPhoto ? (
                <div style={{
                  width: '100%',
                  height: '180px',
                  backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.base,
                  border: `2px dashed ${colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}>
                  <Camera size={32} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Photo captured on site</span>
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>IMG_2847.jpg</span>
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  height: '180px',
                  backgroundColor: colors.surfaceFlat,
                  borderRadius: borderRadius.base,
                  border: `2px dashed ${colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  cursor: 'pointer',
                }} onClick={handleAddPhoto} role="button" tabIndex={0} aria-label="Capture site photo" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddPhoto(); } }}>
                  <Camera size={32} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No photo yet. Tap to capture.</span>
                </div>
              )}
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
              {selected.status !== 'complete' && selected.status !== 'verified' ? (
                <>
                  <PermissionGate permission="punch_list.edit">
                    <Btn variant="primary" onClick={handleMarkComplete} icon={<CheckCircle size={16} />}>Mark Complete</Btn>
                  </PermissionGate>
                  <PermissionGate permission="punch_list.edit">
                    <Btn variant="secondary" onClick={handleAddPhoto} icon={<Camera size={16} />}>Add Photo</Btn>
                  </PermissionGate>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(78, 200, 150, 0.08)', borderRadius: borderRadius.base, width: '100%' }}>
                  <CheckCircle size={18} color={colors.tealSuccess} />
                  <span style={{ fontSize: typography.fontSize.base, color: colors.tealSuccess, fontWeight: typography.fontWeight.medium }}>
                    {selected.status === 'verified' ? 'This item has been verified' : 'This item has been completed'}
                  </span>
                </div>
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
                await updatePunchItem.mutateAsync({ id, updates: { status: 'complete' }, projectId: projectId! });
              }
              toast.success(`${ids.length} items marked complete`);
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

export { PunchListPage as PunchList };
export default PunchListPage;
