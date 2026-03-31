import React, { useState, useMemo, useCallback } from 'react';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, TableHeader, TableRow, DetailPanel, RelatedItems, Skeleton, EmptyState, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useSubmittals } from '../hooks/queries';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
import { AlertTriangle, Calendar, Clock, ArrowRight, CheckCircle, ClipboardList, Paperclip, LayoutGrid, List, RefreshCw, Sparkles, Search } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForSubmittal } from '../utils/connections';
import { useCreateSubmittal, useUpdateSubmittal } from '../hooks/mutations';
import { useProjectId } from '../hooks/useProjectId';
import { PermissionGate } from '../components/auth/PermissionGate';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { KanbanBoard } from '../components/shared/KanbanBoard';
import type { KanbanColumn } from '../components/shared/KanbanBoard';
import { ApprovalChain } from '../components/shared/ApprovalChain';
import type { ApprovalStep } from '../components/shared/ApprovalChain';
import CreateSubmittalModal from '../components/forms/CreateSubmittalModal';
import { EditableDetailField } from '../components/forms/EditableField';
import { toast } from 'sonner';
import { PresenceAvatars } from '../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../components/ui/EditingLockBanner';

const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();

const columns = [
  { label: 'Submittal #', width: '100px' },
  { label: 'Title', width: '1fr' },
  { label: 'From', width: '150px' },
  { label: 'Priority', width: '90px' },
  { label: 'Status', width: '130px' },
  { label: 'Due', width: '100px' },
];

const Submittals: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
  const projectId = useProjectId();
  const createSubmittal = useCreateSubmittal();
  const updateSubmittal = useUpdateSubmittal();
  const { data: submittalsRaw = [], isPending: loading, error: submittalsError, refetch } = useSubmittals(projectId);

  // Map API data to component shape
  const submittals = useMemo(() => submittalsRaw.map((s: Record<string, unknown>) => ({
    ...s,
    submittalNumber: s.number ? `SUB-${String(s.number).padStart(3, '0')}` : String(s.id ?? '').slice(0, 8),
    from: (s.subcontractor as string) || (s.created_by as string) || '',
    dueDate: (s.due_date as string) || '',
  })), [submittalsRaw]);

  if (loading) {
    return (
      <PageContainer title="Submittals" subtitle="Loading...">
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

  if (submittalsError) {
    return (
      <PageContainer title="Submittals" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Failed to load submittals</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{(submittalsError as Error).message || 'Unable to fetch submittal data'}</p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Try Again</Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (!submittals.length) {
    return (
      <PageContainer
        title="Submittals"
        subtitle="No items"
        actions={<PermissionGate permission="submittals.create"><Btn onClick={() => setShowCreateModal(true)}>New Submittal</Btn></PermissionGate>}
      >
        <EmptyState
          icon={<ClipboardList size={40} color={colors.textTertiary} />}
          title="No submittals yet"
          description="Create a submittal to track shop drawings, product data, and material approvals."
          action={<PermissionGate permission="submittals.create"><Btn variant="primary" onClick={() => setShowCreateModal(true)}>New Submittal</Btn></PermissionGate>}
        />
      </PageContainer>
    );
  }

  const allSubmittals = submittals;

  const handleKeySelect = useCallback((sub: Record<string, unknown>) => setSelectedId(sub.id as number), []);
  useTableKeyboardNavigation(allSubmittals, selectedId, handleKeySelect);

  const pageAlerts = getPredictiveAlertsForPage('submittals');
  const openCount = useMemo(() => allSubmittals.filter((s: Record<string, unknown>) => s.status !== 'approved').length, [allSubmittals]);
  const selected = allSubmittals.find((s: Record<string, unknown>) => s.id === selectedId) || null;
  const timeline: Array<{ date: string; event: string; by: string; status: 'complete' | 'active' | 'pending' }> = [];

  const kanbanColumns: KanbanColumn<any>[] = useMemo(() => [
    { id: 'pending', label: 'Pending', color: colors.statusPending, items: allSubmittals.filter((s) => s.status === 'pending') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: allSubmittals.filter((s) => s.status === 'under_review') },
    { id: 'revise_resubmit', label: 'Revise & Resubmit', color: colors.statusCritical, items: allSubmittals.filter((s) => s.status === 'revise_resubmit') },
    { id: 'approved', label: 'Approved', color: colors.statusActive, items: allSubmittals.filter((s) => s.status === 'approved') },
  ], [allSubmittals]);

  const approvalSteps: ApprovalStep[] = useMemo(() => selected ? [
    { id: 1, role: 'Subcontractor', name: selected.from || 'Contractor', initials: 'SC', status: 'approved', date: 'Submitted', comment: 'Initial submission' },
    { id: 2, role: 'General Contractor', name: 'GC Reviewer', initials: 'GC', status: 'approved', date: 'Reviewed' },
    { id: 3, role: 'Architect', name: 'Architect', initials: 'AR', status: selected.status === 'approved' ? 'approved' : selected.status === 'revise_resubmit' ? 'rejected' : 'pending', date: selected.status === 'approved' ? 'Approved' : undefined, comment: selected.status === 'revise_resubmit' ? 'Revisions required' : undefined },
    { id: 4, role: 'Owner', name: 'Owner', initials: 'OW', status: selected.status === 'approved' ? 'approved' : 'waiting' },
  ] : [], [selected]);

  const handleApprove = useCallback(() => {
    addToast('success', `${selected?.submittalNumber} approved successfully`);
    setSelectedId(null);
  }, [selected, addToast]);

  const handleReject = useCallback(() => {
    addToast('error', `${selected?.submittalNumber} has been rejected`);
    setSelectedId(null);
  }, [selected, addToast]);

  const handleRequestRevision = useCallback(() => {
    addToast('warning', `Revision requested for ${selected?.submittalNumber}`);
    setSelectedId(null);
  }, [selected, addToast]);

  const toggleBtnStyle = useCallback((active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: active ? colors.primaryOrange : 'transparent',
    color: active ? colors.white : colors.textTertiary,
    transition: 'all 150ms ease',
  }), []);

  return (
    <PageContainer
      title="Submittals"
      subtitle={`${allSubmittals.length} total \u00b7 ${openCount} open`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div style={{ display: 'flex', borderRadius: borderRadius.full, overflow: 'hidden', border: `1px solid ${colors.borderLight}` }}>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'table'), borderRadius: `${borderRadius.full} 0 0 ${borderRadius.full}` }}
              onClick={() => setViewMode('table')}
              title="Table View"
              aria-label="Table View"
            >
              <List size={16} />
            </button>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'kanban'), borderRadius: `0 ${borderRadius.full} ${borderRadius.full} 0` }}
              onClick={() => setViewMode('kanban')}
              title="Board View"
              aria-label="Board View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <PermissionGate permission="submittals.create">
            <Btn onClick={() => setShowCreateModal(true)}>New Submittal</Btn>
          </PermissionGate>
        </div>
      }
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {viewMode === 'table' ? (
        <Card padding="0">
          <div role="table" aria-label="Submittals list">
          <TableHeader columns={columns} />
          {allSubmittals.map((sub, i) => (
            <div
              key={sub.id}
              style={{
                backgroundColor: selectedId === sub.id ? colors.surfaceSelected : 'transparent',
                transition: 'background-color 150ms ease',
              }}
            >
              <TableRow
                divider={i < allSubmittals.length - 1}
                onClick={() => setSelectedId(sub.id)}
                columns={[
                  {
                    width: '100px',
                    content: <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{sub.submittalNumber}</span>,
                  },
                  {
                    width: '1fr',
                    content: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
                          {sub.title}
                          {getAnnotationsForEntity('submittal', sub.id).map((ann) => (
                            <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                          ))}
                        </span>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {sub.spec_section && <span style={{ fontFamily: 'monospace', marginRight: spacing['2'] }}>{sub.spec_section}</span>}
                          {sub.lead_time_weeks != null && sub.lead_time_weeks > 0 && (() => { const wks = sub.lead_time_weeks; const c = wks > 12 ? colors.statusCritical : wks >= 8 ? colors.statusPending : colors.statusActive; return <span style={{ color: c }}>{wks} wk lead</span>; })()}
                        </span>
                      </div>
                    ),
                  },
                  {
                    width: '150px',
                    content: <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{sub.from}</span>,
                  },
                  {
                    width: '90px',
                    content: <PriorityTag priority={sub.priority as any} />,
                  },
                  {
                    width: '130px',
                    content: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                        <StatusTag status={sub.status as any} />
                        {sub.revision_number > 1 && <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, backgroundColor: `${colors.statusCritical}08`, padding: '1px 5px', borderRadius: borderRadius.full }}>C{sub.revision_number}</span>}
                      </span>
                    ),
                  },
                  {
                    width: '100px',
                    content: (
                      <span style={{ fontSize: typography.fontSize.sm, color: isOverdue(sub.dueDate) && sub.status !== 'approved' ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' as const }}>
                        {new Date(sub.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          ))}
          </div>
          {allSubmittals.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color={colors.textTertiary} style={{ marginBottom: spacing.md }} />
              <p style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>No items match your filters</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0, marginBottom: spacing.lg }}>Try adjusting your search or filter criteria</p>
              <button onClick={() => window.location.reload()} style={{ padding: `${spacing['1.5']} ${spacing.lg}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.gray600, cursor: 'pointer' }}>
                Clear Filters
              </button>
            </div>
          )}
        </Card>
      ) : (
        <KanbanBoard
          columns={kanbanColumns}
          getKey={(sub: any) => sub.id}
          renderCard={(sub: any) => (
            <div
              style={{ padding: spacing.md, cursor: 'pointer' }}
              onClick={() => setSelectedId(sub.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(sub.id); } }}
              role="button"
              tabIndex={0}
              aria-label={`View submittal ${sub.submittalNumber}: ${sub.title}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{sub.submittalNumber}</span>
                <PriorityTag priority={sub.priority as any} />
              </div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm, lineHeight: typography.lineHeight.snug }}>
                {sub.title}
              </div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>
                {sub.from}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: isOverdue(sub.dueDate) && sub.status !== 'approved' ? colors.statusCritical : colors.textTertiary,
                    fontWeight: isOverdue(sub.dueDate) && sub.status !== 'approved' ? typography.fontWeight.medium : typography.fontWeight.normal,
                  }}
                >
                  {new Date(sub.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div style={{ display: 'flex', gap: spacing.xs }}>
                  {getAnnotationsForEntity('submittal', sub.id).map((ann) => (
                    <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                  ))}
                </div>
              </div>
            </div>
          )}
        />
      )}

      <DetailPanel
        open={!!selected}
        onClose={() => { setSelectedId(null); setEditingDetail(false); }}
        title={selected?.submittalNumber || ''}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            {/* Title + Edit Toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing['3'] }}>
                <h3 style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md, flex: 1 }}>
                  {selected.title}
                </h3>
                <PresenceAvatars entityId={String(selected.id)} size={24} />
                <PermissionGate permission="submittals.edit">
                  <Btn
                    variant={editingDetail ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setEditingDetail(!editingDetail)}
                  >
                    {editingDetail ? 'Done' : 'Edit'}
                  </Btn>
                </PermissionGate>
              </div>
              <EditingLockBanner entityType="submittal" entityId={String(selected.id)} isEditing={editingDetail} />
              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                <PriorityTag priority={selected.priority as any} />
                <StatusTag status={selected.status as any} />
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
              <EditableDetailField
                label="From"
                value={selected.from || ''}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  await updateSubmittal.mutateAsync({ id: String(selected.id), updates: { subcontractor: val }, projectId: projectId! });
                  toast.success('Subcontractor updated');
                }}
              />
              <EditableDetailField
                label="Due Date"
                value={selected.dueDate?.slice(0, 10) || ''}
                editing={editingDetail}
                type="date"
                onSave={async (val) => {
                  await updateSubmittal.mutateAsync({ id: String(selected.id), updates: { due_date: val }, projectId: projectId! });
                  toast.success('Due date updated');
                }}
                displayContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <Calendar size={14} color={isOverdue(selected.dueDate) && selected.status !== 'approved' ? colors.statusCritical : colors.textSecondary} />
                    <span style={{
                      fontSize: typography.fontSize.base,
                      color: isOverdue(selected.dueDate) && selected.status !== 'approved' ? colors.statusCritical : colors.textPrimary,
                      fontWeight: typography.fontWeight.medium,
                    }}>
                      {new Date(selected.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                }
              />
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
              <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed, margin: 0 }}>
                {(selected as any).description || 'No description provided.'}
              </p>
            </div>

            {/* Attachments indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.base }}>
              <Paperclip size={16} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>3 attachments (shop drawings, spec sheet, cover letter)</span>
            </div>

            {/* Review Timeline */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Review Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {timeline.map((entry, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: spacing.lg, position: 'relative', paddingBottom: idx < timeline.length - 1 ? spacing.xl : 0 }}>
                    {/* Timeline line */}
                    {idx < timeline.length - 1 && (
                      <div style={{
                        position: 'absolute',
                        left: '11px',
                        top: '24px',
                        bottom: 0,
                        width: '2px',
                        backgroundColor: entry.status === 'complete' ? colors.tealSuccess : colors.borderLight,
                      }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: borderRadius.full,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      backgroundColor: entry.status === 'complete' ? colors.tealSuccess
                        : entry.status === 'active' ? colors.statusInfo
                        : colors.surfaceInset,
                    }}>
                      {entry.status === 'complete' ? (
                        <CheckCircle size={14} color={colors.white} />
                      ) : entry.status === 'active' ? (
                        <Clock size={14} color={colors.white} />
                      ) : (
                        <Clock size={14} color={colors.textTertiary} />
                      )}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                        {entry.event}
                      </div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs }}>
                        {entry.by} &middot; {entry.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approval Chain */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approval Chain</div>
              <ApprovalChain steps={approvalSteps} />
            </div>

            {/* AI Compliance Check */}
            <div style={{ marginTop: spacing['4'], padding: spacing['3'], backgroundColor: `${colors.statusActive}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusActive}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                <Sparkles size={12} color={colors.statusActive} />
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusActive, textTransform: 'uppercase', letterSpacing: '0.4px' }}>AI Compliance Check</span>
              </div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
                Submittal matches spec section 09 21 16 (Gypsum Board Assemblies). Material specifications align with project requirements. No deviations detected.
              </p>
            </div>

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForSubmittal(selected.id)} onNavigate={appNavigate} />

            {/* Actions */}
            {selected.status !== 'approved' && (
              <div style={{ display: 'flex', gap: spacing.sm, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
                <PermissionGate permission="submittals.approve">
                  <Btn variant="primary" onClick={handleApprove} icon={<CheckCircle size={16} />}>Approve</Btn>
                </PermissionGate>
                <PermissionGate permission="submittals.approve">
                  <Btn variant="danger" onClick={handleReject}>Reject</Btn>
                </PermissionGate>
                <PermissionGate permission="submittals.approve">
                  <Btn variant="secondary" onClick={handleRequestRevision} icon={<ArrowRight size={16} />}>Request Revision</Btn>
                </PermissionGate>
              </div>
            )}
            {selected.status === 'approved' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(78, 200, 150, 0.08)', borderRadius: borderRadius.base }}>
                <CheckCircle size={18} color={colors.tealSuccess} />
                <span style={{ fontSize: typography.fontSize.base, color: colors.tealSuccess, fontWeight: typography.fontWeight.medium }}>This submittal has been approved</span>
              </div>
            )}
          </div>
        )}
      </DetailPanel>

      <CreateSubmittalModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await createSubmittal.mutateAsync({
            projectId: projectId!,
            data: { ...data, project_id: projectId! },
          });
          toast.success('Submittal created: ' + (data.title || 'New Submittal'));
        }}
      />
    </PageContainer>
  );
};

export { Submittals };
export default Submittals;
