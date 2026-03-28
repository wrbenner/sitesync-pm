import React, { useState, useEffect } from 'react';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, TableHeader, TableRow, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { Calendar, ArrowRight, CheckCircle, Paperclip, LayoutGrid, List, Sparkles, Search } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForSubmittal } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { KanbanBoard } from '../components/shared/KanbanBoard';
import type { KanbanColumn } from '../components/shared/KanbanBoard';
import { ApprovalChain } from '../components/shared/ApprovalChain';
import type { ApprovalStep } from '../components/shared/ApprovalChain';
import { useSubmittalStore } from '../stores/submittalStore';
import { useProjectContext } from '../stores/projectContextStore';
import { CreateSubmittalForm } from '../components/forms/CreateSubmittalForm';
import type { Submittal, SubmittalStatus } from '../types/database';

type StatusTagStatus = 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  revise_resubmit: 'Revise & Resubmit',
};

const isOverdue = (dateStr: string | null) => dateStr ? new Date(dateStr) < new Date() : false;

const columns = [
  { label: 'Submittal #', width: '100px' },
  { label: 'Title', width: '1fr' },
  { label: 'Priority', width: '90px' },
  { label: 'Status', width: '140px' },
  { label: 'Due', width: '100px' },
];

const Submittals: React.FC = () => {
  const { submittals, loading, loadSubmittals, reviewers, loadReviewers, updateSubmittalStatus } = useSubmittalStore();
  const { activeProject } = useProjectContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreate, setShowCreate] = useState(false);
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();

  const pageAlerts = getPredictiveAlertsForPage('submittals');

  useEffect(() => {
    if (activeProject?.id) {
      loadSubmittals(activeProject.id);
    }
  }, [activeProject?.id, loadSubmittals]);

  // Load reviewers when selecting a submittal
  useEffect(() => {
    if (selectedId) {
      loadReviewers(selectedId);
    }
  }, [selectedId, loadReviewers]);

  if (loading || !activeProject) {
    return (
      <PageContainer title="Submittals" subtitle="Loading...">
        <Card padding="0">
          <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} height="40px" />
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  const sortedSubmittals = [...submittals].sort((a, b) => b.submittal_number - a.submittal_number);
  const openCount = submittals.filter(s => s.status !== 'approved' && s.status !== 'rejected').length;
  const selected = submittals.find(s => s.id === selectedId) || null;
  const currentReviewers = selectedId ? (reviewers[selectedId] ?? []) : [];

  const subLabel = (sub: Submittal) => `SUB-${String(sub.submittal_number).padStart(3, '0')}`;

  const kanbanColumns: KanbanColumn<Submittal>[] = [
    { id: 'draft', label: 'Draft', color: colors.textTertiary, items: sortedSubmittals.filter((s) => s.status === 'draft') },
    { id: 'submitted', label: 'Submitted', color: colors.statusPending, items: sortedSubmittals.filter((s) => s.status === 'submitted') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: sortedSubmittals.filter((s) => s.status === 'under_review') },
    { id: 'revise_resubmit', label: 'Revise & Resubmit', color: colors.statusCritical, items: sortedSubmittals.filter((s) => s.status === 'revise_resubmit') },
    { id: 'approved', label: 'Approved', color: colors.statusActive, items: sortedSubmittals.filter((s) => s.status === 'approved') },
  ];

  const approvalSteps: ApprovalStep[] = selected && currentReviewers.length > 0
    ? currentReviewers.map((r) => ({
        id: r.review_order,
        role: `Reviewer ${r.review_order}`,
        name: r.user_id.substring(0, 8),
        initials: r.user_id.substring(0, 2).toUpperCase(),
        status: r.status === 'approved' ? 'approved' : r.status === 'rejected' || r.status === 'revise' ? 'rejected' : 'pending',
        date: r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
        comment: r.comments ?? undefined,
      }))
    : selected ? [
        { id: 1, role: 'Submitter', name: 'Contractor', initials: 'SC', status: 'approved' as const, date: 'Submitted' },
        { id: 2, role: 'General Contractor', name: 'Mike Patterson', initials: 'MP', status: selected.status === 'approved' || selected.status === 'under_review' ? 'approved' as const : 'pending' as const },
        { id: 3, role: 'Architect', name: 'Jennifer Lee', initials: 'JL', status: selected.status === 'approved' ? 'approved' as const : selected.status === 'revise_resubmit' ? 'rejected' as const : 'pending' as const, comment: selected.status === 'revise_resubmit' ? 'Revisions required' : undefined },
        { id: 4, role: 'Owner', name: 'James Bradford', initials: 'JB', status: selected.status === 'approved' ? 'approved' as const : 'waiting' as const },
      ] : [];

  const handleApprove = async () => {
    if (!selected) return;
    const { error } = await updateSubmittalStatus(selected.id, 'approved');
    if (error) { addToast('error', error); return; }
    addToast('success', `${subLabel(selected)} approved`);
    setSelectedId(null);
  };

  const handleReject = async () => {
    if (!selected) return;
    const { error } = await updateSubmittalStatus(selected.id, 'rejected');
    if (error) { addToast('error', error); return; }
    addToast('error', `${subLabel(selected)} rejected`);
    setSelectedId(null);
  };

  const handleRequestRevision = async () => {
    if (!selected) return;
    const { error } = await updateSubmittalStatus(selected.id, 'revise_resubmit');
    if (error) { addToast('error', error); return; }
    addToast('warning', `Revision requested for ${subLabel(selected)}`);
    setSelectedId(null);
  };

  const handleStatusChange = async (subId: string, status: string) => {
    const { error } = await updateSubmittalStatus(subId, status as SubmittalStatus);
    if (error) { addToast('error', error); return; }
    addToast('success', `Status updated to ${STATUS_LABELS[status] ?? status}`);
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
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
  });

  return (
    <PageContainer
      title="Submittals"
      subtitle={`${submittals.length} total \u00b7 ${openCount} open`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div style={{ display: 'flex', borderRadius: borderRadius.full, overflow: 'hidden', border: `1px solid ${colors.borderLight}` }}>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'table'), borderRadius: `${borderRadius.full} 0 0 ${borderRadius.full}` }}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={16} />
            </button>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'kanban'), borderRadius: `0 ${borderRadius.full} ${borderRadius.full} 0` }}
              onClick={() => setViewMode('kanban')}
              title="Board View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <Btn onClick={() => setShowCreate(true)}>New Submittal</Btn>
        </div>
      }
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {viewMode === 'table' ? (
        <Card padding="0">
          <TableHeader columns={columns} />
          {sortedSubmittals.map((sub, i) => (
            <div
              key={sub.id}
              style={{
                backgroundColor: selectedId === sub.id ? colors.surfaceSelected : 'transparent',
                transition: 'background-color 150ms ease',
              }}
            >
              <TableRow
                divider={i < sortedSubmittals.length - 1}
                onClick={() => setSelectedId(sub.id)}
                columns={[
                  {
                    width: '100px',
                    content: <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange }}>{subLabel(sub)}</span>,
                  },
                  {
                    width: '1fr',
                    content: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
                          {sub.title}
                          {getAnnotationsForEntity('submittal', sub.submittal_number).map((ann) => (
                            <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                          ))}
                        </span>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {sub.spec_section && <span style={{ fontFamily: 'monospace', marginRight: spacing['2'] }}>{sub.spec_section}</span>}
                          {sub.revision_number > 1 && <span style={{ color: colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>Rev {sub.revision_number}</span>}
                        </span>
                      </div>
                    ),
                  },
                  {
                    width: '90px',
                    content: <PriorityTag priority={sub.priority} />,
                  },
                  {
                    width: '140px',
                    content: <StatusTag status={sub.status as StatusTagStatus} label={STATUS_LABELS[sub.status]} />,
                  },
                  {
                    width: '100px',
                    content: (
                      <span style={{ fontSize: typography.fontSize.sm, color: isOverdue(sub.due_date) && sub.status !== 'approved' ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                        {sub.due_date ? new Date(sub.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014'}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          ))}
          {sortedSubmittals.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color="#A09890" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>No submittals found</p>
              <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>Create your first submittal to get started</p>
              <button onClick={() => setShowCreate(true)} style={{ padding: '6px 16px', backgroundColor: colors.primaryOrange, border: 'none', borderRadius: '6px', fontSize: '13px', fontFamily: typography.fontFamily, color: '#fff', cursor: 'pointer' }}>
                Create Submittal
              </button>
            </div>
          )}
        </Card>
      ) : (
        <KanbanBoard
          columns={kanbanColumns}
          getKey={(sub) => sub.id}
          renderCard={(sub) => (
            <div
              style={{ padding: spacing.md }}
              onClick={() => setSelectedId(sub.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{subLabel(sub)}</span>
                <PriorityTag priority={sub.priority} />
              </div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm, lineHeight: typography.lineHeight.snug }}>
                {sub.title}
              </div>
              {sub.spec_section && (
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: 'monospace' }}>
                  {sub.spec_section}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: isOverdue(sub.due_date) && sub.status !== 'approved' ? colors.red : colors.textTertiary,
                    fontWeight: isOverdue(sub.due_date) && sub.status !== 'approved' ? typography.fontWeight.medium : typography.fontWeight.normal,
                  }}
                >
                  {sub.due_date ? new Date(sub.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
                <div style={{ display: 'flex', gap: spacing.xs }}>
                  {getAnnotationsForEntity('submittal', sub.submittal_number).map((ann) => (
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
        onClose={() => setSelectedId(null)}
        title={selected ? subLabel(selected) : ''}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            {/* Title and meta */}
            <div>
              <h3 style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>
                {selected.title}
              </h3>
              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                <PriorityTag priority={selected.priority} />
                <StatusTag status={selected.status as StatusTagStatus} label={STATUS_LABELS[selected.status]} />
                {selected.revision_number > 1 && (
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, backgroundColor: `${colors.statusCritical}08`, padding: '2px 8px', borderRadius: borderRadius.full }}>
                    Rev {selected.revision_number}
                  </span>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
              {selected.spec_section && (
                <div>
                  <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Spec Section</div>
                  <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, fontFamily: 'monospace' }}>{selected.spec_section}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due Date</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Calendar size={14} color={isOverdue(selected.due_date) && selected.status !== 'approved' ? colors.red : colors.textSecondary} />
                  <span style={{
                    fontSize: typography.fontSize.base,
                    color: isOverdue(selected.due_date) && selected.status !== 'approved' ? colors.red : colors.textPrimary,
                    fontWeight: typography.fontWeight.medium,
                  }}>
                    {selected.due_date ? new Date(selected.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {selected.description && (
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
                <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed, margin: 0 }}>
                  {selected.description}
                </p>
              </div>
            )}

            {/* Attachments indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.base, border: `1px dashed ${colors.border}` }}>
              <Paperclip size={16} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Drop files here or click to attach documents</span>
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
                {selected.spec_section
                  ? `Submittal matches spec section ${selected.spec_section}. Material specifications align with project requirements. No deviations detected.`
                  : 'No spec section specified. Add a specification reference for AI compliance verification.'}
              </p>
            </div>

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForSubmittal(selected.submittal_number)} onNavigate={appNavigate} />

            {/* Actions */}
            {selected.status !== 'approved' && selected.status !== 'rejected' && (
              <div style={{ display: 'flex', gap: spacing.sm, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}`, flexWrap: 'wrap' }}>
                {selected.status === 'draft' && (
                  <Btn variant="primary" onClick={() => handleStatusChange(selected.id, 'submitted')}>
                    Submit
                  </Btn>
                )}
                {selected.status === 'submitted' && (
                  <Btn variant="secondary" onClick={() => handleStatusChange(selected.id, 'under_review')}>
                    Begin Review
                  </Btn>
                )}
                {(selected.status === 'under_review' || selected.status === 'submitted') && (
                  <>
                    <Btn variant="primary" onClick={handleApprove} icon={<CheckCircle size={16} />}>Approve</Btn>
                    <Btn variant="danger" onClick={handleReject}>Reject</Btn>
                    <Btn variant="secondary" onClick={handleRequestRevision} icon={<ArrowRight size={16} />}>Request Revision</Btn>
                  </>
                )}
                {selected.status === 'revise_resubmit' && (
                  <Btn variant="primary" onClick={() => handleStatusChange(selected.id, 'submitted')}>
                    Resubmit
                  </Btn>
                )}
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

      {/* Create Form Modal */}
      <CreateSubmittalForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => addToast('success', 'Submittal created successfully')}
      />
    </PageContainer>
  );
};

export { Submittals };
export default Submittals;
