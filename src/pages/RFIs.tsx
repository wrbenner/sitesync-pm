import React, { useState, useMemo, useCallback } from 'react';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, TableHeader, TableRow, DetailPanel, Avatar, Tag, RelatedItems, Skeleton, EmptyState, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useRFIs } from '../hooks/queries';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
import { AlertTriangle, HelpCircle, Plus, Clock, MessageSquare, Paperclip, Calendar, RefreshCw, Send, Sparkles, LayoutGrid, List, Search } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForRfi } from '../utils/connections';
import { useCreateRFI, useUpdateRFI } from '../hooks/mutations';
import { useProjectId } from '../hooks/useProjectId';
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

const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const columns = [
  { label: 'RFI #', width: '90px' },
  { label: 'Title', width: '1fr' },
  { label: 'From', width: '140px' },
  { label: 'Priority', width: '90px' },
  { label: 'Status', width: '110px' },
  { label: 'Days', width: '70px' },
  { label: 'Due', width: '100px' },
];


const MetaItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: typography.fontWeight.medium }}>
      {label}
    </div>
    <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary }}>
      {children}
    </div>
  </div>
);

const RFIs: React.FC = () => {
  const projectId = useProjectId();
  const { data: rfisRaw = [], isPending: rfisLoading, error: rfisError, refetch } = useRFIs(projectId);

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
  const overdueCount = useMemo(() => rfis.filter((r: Record<string, unknown>) => r.status === 'open' && r.dueDate && isOverdue(r.dueDate as string)).length, [rfis]);
  const [selectedRfi, setSelectedRfi] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
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

  const pageAlerts = getPredictiveAlertsForPage('rfis');

  if (rfisLoading) {
    return (
      <PageContainer title="RFIs" subtitle="Loading...">
        <Card padding="0">
          <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height="44px" />
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (rfisError) {
    return (
      <PageContainer title="RFIs" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Failed to load RFIs</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{(rfisError as Error).message || 'Unable to fetch request data'}</p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Try Again</Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (!rfis.length) {
    return (
      <PageContainer
        title="RFIs"
        subtitle="No items"
        actions={
          <PermissionGate permission="rfis.create">
            <Btn onClick={() => setShowCreateModal(true)}>
              <Plus size={16} style={{ marginRight: spacing.xs }} />
              New RFI
            </Btn>
          </PermissionGate>
        }
      >
        <EmptyState
          icon={<HelpCircle size={40} color={colors.textTertiary} />}
          title="No RFIs yet"
          description="Submit an RFI to get clarification or approvals from the design team."
          action={<PermissionGate permission="rfis.create"><Btn variant="primary" onClick={() => setShowCreateModal(true)}>Submit RFI</Btn></PermissionGate>}
        />
      </PageContainer>
    );
  }

  const allRfis = rfis || [];
  const totalPages = useMemo(() => Math.ceil(allRfis.length / perPage), [allRfis, perPage]);
  const paginatedRfis = useMemo(() => allRfis.slice((page - 1) * perPage, page * perPage), [allRfis, page, perPage]);

  useTableKeyboardNavigation(paginatedRfis, selectedRfi?.id ?? null, setSelectedRfi);

  const kanbanColumns: KanbanColumn<any>[] = useMemo(() => [
    { id: 'draft', label: 'In Draft', color: colors.textTertiary, items: [] },
    { id: 'pending', label: 'Submitted', color: colors.statusPending, items: allRfis.filter((r) => r.status === 'pending') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: [] },
    { id: 'approved', label: 'Answered', color: colors.statusActive, items: allRfis.filter((r) => r.status === 'approved') },
    { id: 'closed', label: 'Closed', color: colors.statusNeutral, items: [] },
  ], [allRfis]);

  return (
    <PageContainer
      title="RFIs"
      subtitle={`${openCount} open · ${overdueCount} overdue`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            <button onClick={() => setViewMode('table')} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', border: 'none', borderRadius: borderRadius.full, backgroundColor: viewMode === 'table' ? colors.surfaceRaised : 'transparent', color: viewMode === 'table' ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <List size={14} style={{ marginRight: 4 }} /> Table
            </button>
            <button onClick={() => setViewMode('kanban')} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', border: 'none', borderRadius: borderRadius.full, backgroundColor: viewMode === 'kanban' ? colors.surfaceRaised : 'transparent', color: viewMode === 'kanban' ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <LayoutGrid size={14} style={{ marginRight: 4 }} /> Kanban
            </button>
          </div>
          <PermissionGate permission="rfis.create">
            <Btn onClick={() => setShowCreateModal(true)}>
              <Plus size={16} style={{ marginRight: spacing.xs }} />
              New RFI
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {viewMode === 'table' ? (
        <Card padding="0">
          <div role="table">
          <TableHeader columns={columns} />
          {paginatedRfis.map((rfi, i) => (
            <TableRow
              key={rfi.id}
              divider={i < paginatedRfis.length - 1}
              onClick={() => setSelectedRfi(rfi)}
              selected={selectedRfi?.id === rfi.id}
              columns={[
                {
                  width: '90px',
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{rfi.rfiNumber}</span>
                  ),
                },
                {
                  width: '1fr',
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
                        {rfi.title}
                        {getAnnotationsForEntity('rfi', rfi.id).length > 0 && (
                          <span title={getAnnotationsForEntity('rfi', rfi.id)[0]?.insight || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: spacing['2'], padding: '1px 5px', backgroundColor: `${colors.statusReview}10`, borderRadius: borderRadius.full, verticalAlign: 'middle' }}>
                            <Sparkles size={10} color={colors.statusReview} />
                          </span>
                        )}
                      </span>
                      {rfi.drawing_reference && (
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          <span style={{ color: colors.orangeText }}>{rfi.drawing_reference}</span>
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  width: '140px',
                  content: <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{rfi.from}</span>,
                },
                {
                  width: '90px',
                  content: <PriorityTag priority={rfi.priority as any} />,
                },
                {
                  width: '110px',
                  content: rfi.status === 'pending' ? (
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusInfoBright, backgroundColor: colors.statusInfoSubtle, padding: '2px 8px', borderRadius: borderRadius.full }}>Pending</span>
                  ) : (
                    <StatusTag status={rfi.status as any} />
                  ),
                },
                {
                  width: '70px',
                  content: (() => {
                    const days = Math.ceil((Date.now() - new Date(rfi.submitDate).getTime()) / (1000 * 60 * 60 * 24));
                    const dColor = days > 10 ? colors.statusCritical : days > 5 ? colors.statusPending : colors.statusActive;
                    return <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: dColor, fontVariantNumeric: 'tabular-nums' as const }}>{days}d</span>;
                  })(),
                },
                {
                  width: '100px',
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: isOverdue(rfi.dueDate) && rfi.status !== 'approved' ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' as const }}>
                      {formatDate(rfi.dueDate)}
                    </span>
                  ),
                },
              ]}
            />
          ))}
          </div>
          {paginatedRfis.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color={colors.textTertiary} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: '4px' }}>No items match your filters</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0, marginBottom: '16px' }}>Try adjusting your search or filter criteria</p>
              <button onClick={() => setPage(1)} style={{ padding: '6px 16px', backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.gray600, cursor: 'pointer' }}>
                Clear Filters
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing.md} ${spacing.xl}`, borderTop: `1px solid ${colors.borderLight}` }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, allRfis.length)} of {allRfis.length}
            </span>
            <div style={{ display: 'flex', gap: spacing['1'] }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, backgroundColor: 'transparent', cursor: page > 1 ? 'pointer' : 'default', color: page > 1 ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, backgroundColor: 'transparent', cursor: page < totalPages ? 'pointer' : 'default', color: page < totalPages ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>Next</button>
            </div>
          </div>
        </Card>
      ) : (
        <KanbanBoard
          columns={kanbanColumns}
          getKey={(rfi) => rfi.id}
          renderCard={(rfi) => (
            <div style={{ padding: spacing['3'], cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`Open RFI ${rfi.rfiNumber}: ${rfi.title}`} onClick={() => setSelectedRfi(rfi)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRfi(rfi); } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{rfi.rfiNumber}</span>
                <PriorityTag priority={rfi.priority} />
              </div>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>{rfi.title}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{rfi.from}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: isOverdue(rfi.dueDate) ? colors.statusCritical : colors.textTertiary }}>{formatDate(rfi.dueDate)}</span>
              </div>
              {getAnnotationsForEntity('rfi', rfi.id).map((ann) => (
                <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
              ))}
            </div>
          )}
        />
      )}

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
                  await updateRFI.mutateAsync({ id: String(selectedRfi.id), updates: { priority: val }, projectId: projectId! });
                  selectedRfi.priority = val;
                  toast.success('Priority updated');
                }}
                displayContent={<PriorityTag priority={selectedRfi.priority as any} />}
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
                displayContent={<StatusTag status={selectedRfi.status as any} />}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <Calendar size={14} style={{ color: colors.textTertiary }} />
                    <span style={{
                      color: isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'approved' ? colors.statusCritical : colors.textPrimary,
                      fontWeight: isOverdue(selectedRfi.dueDate) && selectedRfi.status !== 'approved' ? typography.fontWeight.medium : typography.fontWeight.normal,
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
              <p style={{ margin: 0, fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                Requesting clarification on the specification details referenced in the current drawing set.
                The field team has identified a discrepancy between the architectural drawings and the structural
                details that needs to be resolved before proceeding with installation. Please review the attached
                markup and provide direction on the preferred approach. This item is blocking work on the affected
                area and requires a timely response to maintain schedule.
              </p>
            </div>

            {/* Attachments hint */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm, border: `1px dashed ${colors.border}` }}>
              <Paperclip size={16} style={{ color: colors.textTertiary }} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>2 attachments (markup sketch, spec reference)</span>
            </div>

            {/* Response Timeline */}
            <div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Response Timeline
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {([] as Array<{initials: string; name: string; role: string; date: string; message: string; type: string}>).map((entry, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: spacing.md, position: 'relative' }}>
                    {/* Timeline line */}
                    {idx < ([] as Array<{initials: string; name: string; role: string; date: string; message: string; type: string}>).length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '17px',
                          top: '40px',
                          bottom: '-4px',
                          width: '2px',
                          backgroundColor: colors.borderLight,
                        }}
                      />
                    )}
                    {/* Avatar */}
                    <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                      <Avatar initials={entry.initials} size={36} />
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: idx < ([] as Array<{initials: string; name: string; role: string; date: string; message: string; type: string}>).length - 1 ? spacing.xl : '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                          {entry.name}
                        </span>
                        <Tag
                          label={entry.type === 'submitted' ? 'Submitted' : entry.type === 'comment' ? 'Comment' : 'Response'}
                          color={entry.type === 'response' ? colors.tealSuccess : entry.type === 'submitted' ? colors.statusPending : colors.blue}
                          backgroundColor={entry.type === 'response' ? 'rgba(78,200,150,0.1)' : entry.type === 'submitted' ? colors.statusPendingSubtle : 'rgba(59,130,246,0.1)'}
                        />
                      </div>
                      <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm }}>
                        {entry.role} · {entry.date}
                      </div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                        {entry.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Suggested Response */}
            <div style={{ marginTop: spacing['4'], padding: spacing['3'], backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                <Sparkles size={12} color={colors.statusReview} />
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: '0.4px' }}>AI Suggested Response</span>
              </div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
                Based on similar RFIs resolved on this project, the recommended response is to reference specification section and provide clarification with marked up drawing detail.
              </p>
            </div>

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

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForRfi(selectedRfi.id)} onNavigate={appNavigate} />
          </div>
        )}
      </DetailPanel>

      <CreateRFIModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await createRFI.mutateAsync({
            projectId: projectId!,
            data: { ...data, project_id: projectId! },
          });
          toast.success('RFI created: ' + (data.title || 'New RFI'));
        }}
      />
    </PageContainer>
  );
};

export { RFIs };
export default RFIs;
