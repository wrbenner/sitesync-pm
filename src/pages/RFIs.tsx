import React, { useState, useMemo, useCallback } from 'react';
import { DataTable } from '../components/shared/DataTable';
import { BulkActionBar } from '../components/shared/BulkActionBar';
import { createColumnHelper } from '@tanstack/react-table';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, DetailPanel, Avatar, Tag, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import EmptyState from '../components/ui/EmptyState';
import { MetricCardSkeleton, TableRowSkeleton } from '../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useRFIs } from '../hooks/queries';
import { AlertTriangle, FileQuestion, Plus, Clock, MessageSquare, Paperclip, Calendar, RefreshCw, Send, Sparkles, LayoutGrid, List, UserCheck, Flag, Download, XCircle } from 'lucide-react';
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

const rfiColHelper = createColumnHelper<any>();


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
  const { data: rfisResult, isPending: rfisLoading, error: rfisError, refetch } = useRFIs(projectId);
  const rfisRaw = rfisResult?.data ?? [];

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
  const [selectedRfiIds, setSelectedRfiIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
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
              {getAnnotationsForEntity('rfi', rfi.id).length > 0 && (
                <span title={getAnnotationsForEntity('rfi', rfi.id)[0]?.insight || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: spacing['2'], padding: '1px 5px', backgroundColor: `${colors.statusReview}10`, borderRadius: borderRadius.full, verticalAlign: 'middle' }}>
                  <Sparkles size={10} color={colors.statusReview} />
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
      cell: (info) => <PriorityTag priority={info.getValue() as any} />,
    }),
    rfiColHelper.accessor('status', {
      header: 'Status',
      size: 110,
      cell: (info) => info.getValue() === 'pending' ? (
        <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusInfoBright, backgroundColor: colors.statusInfoSubtle, padding: '2px 8px', borderRadius: borderRadius.full }}>Pending</span>
      ) : (
        <StatusTag status={info.getValue() as any} />
      ),
    }),
    rfiColHelper.accessor('submitDate', {
      header: 'Days',
      size: 70,
      cell: (info) => {
        const days = Math.ceil((Date.now() - new Date(info.getValue()).getTime()) / (1000 * 60 * 60 * 24));
        const dColor = days > 10 ? colors.statusCritical : days > 5 ? colors.statusPending : colors.statusActive;
        return <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: dColor, fontVariantNumeric: 'tabular-nums' as const }}>{days}d</span>;
      },
    }),
    rfiColHelper.accessor('dueDate', {
      header: 'Due',
      size: 100,
      cell: (info) => {
        const rfi = info.row.original;
        return (
          <span style={{ fontSize: typography.fontSize.sm, color: isOverdue(info.getValue()) && rfi.status !== 'approved' ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' as const }}>
            {formatDate(info.getValue())}
          </span>
        );
      },
    }),
  ], []);

  if (rfisLoading) {
    return (
      <PageContainer title="RFIs" subtitle="Loading...">
        <MetricCardSkeleton />
        <Card padding="0">
          <TableRowSkeleton rows={8} />
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
          icon={<FileQuestion size={28} color={colors.textTertiary} />}
          title="No RFIs yet"
          description="RFIs track design questions and field conflicts. Create your first to get started."
          action={{ label: 'Create RFI', onClick: () => setShowCreateModal(true) }}
        />
      </PageContainer>
    );
  }

  const allRfis = rfis || [];

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
          <DataTable
            data={allRfis}
            columns={rfiColumns}
            selectable
            onSelectionChange={setSelectedRfiIds}
            onRowClick={(row) => setSelectedRfi(row)}
            selectedRowId={selectedRfi?.id ?? null}
            getRowId={(row) => String(row.id)}
            emptyMessage="No RFIs match your filters"
          />
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

      <BulkActionBar
        selectedIds={selectedRfiIds}
        onClearSelection={() => setSelectedRfiIds([])}
        entityLabel="RFIs"
        actions={[
          {
            label: 'Reassign Ball-in-Court',
            icon: <UserCheck size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { assigned_to: 'Reassigned' }, projectId: projectId! })));
              addToast('success', `${ids.length} RFI${ids.length > 1 ? 's' : ''} reassigned`);
            },
          },
          {
            label: 'Change Priority',
            icon: <Flag size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { priority: 'high' }, projectId: projectId! })));
              addToast('success', `Priority updated for ${ids.length} RFI${ids.length > 1 ? 's' : ''}`);
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
            confirmMessage: `Close ${selectedRfiIds.length} selected RFI${selectedRfiIds.length > 1 ? 's' : ''}? This cannot be undone.`,
            onClick: async (ids) => {
              await Promise.all(ids.map((id) => updateRFI.mutateAsync({ id, updates: { status: 'closed' }, projectId: projectId! })));
              addToast('success', `${ids.length} RFI${ids.length > 1 ? 's' : ''} closed`);
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
