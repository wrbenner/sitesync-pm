import React, { useCallback, useMemo, useState } from 'react';
import { Btn, StatusTag, PriorityTag, DetailPanel, RelatedItems, useToast } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { Calendar, Clock, ArrowRight, CheckCircle, Paperclip, Sparkles } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForSubmittal } from '../../utils/connections';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { ApprovalChain } from '../../components/shared/ApprovalChain';
import type { ApprovalStep } from '../../components/shared/ApprovalChain';
import { EditableDetailField } from '../../components/forms/EditableField';
import { toast } from 'sonner';
import { PresenceAvatars } from '../../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../../components/ui/EditingLockBanner';
import { isOverdue, ReviewerStepper } from './types';
import type { ReviewerRow } from './types';

interface SubmittalDetailProps {
  selected: Record<string, unknown> | null;
  reviewersData: ReviewerRow[];
  onClose: () => void;
  projectId: string | undefined;
  updateSubmittalMutateAsync: (args: { id: string; updates: Record<string, unknown>; projectId: string }) => Promise<unknown>;
  deleteSubmittalMutateAsync?: (args: { id: string; projectId: string }) => Promise<unknown>;
  deletePending?: boolean;
}

export const SubmittalDetail: React.FC<SubmittalDetailProps> = ({
  selected,
  reviewersData,
  onClose,
  projectId,
  updateSubmittalMutateAsync,
  deleteSubmittalMutateAsync,
  deletePending = false,
}) => {
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
  const [editingDetail, setEditingDetail] = useState(false);

  const timeline: Array<{ date: string; event: string; by: string; status: 'complete' | 'active' | 'pending' }> = [];

  const approvalSteps: ApprovalStep[] = useMemo(() => selected ? [
    { id: 1, role: 'Subcontractor', name: (selected.from as string) || 'Contractor', initials: 'SC', status: 'approved', date: 'Submitted', comment: 'Initial submission' },
    { id: 2, role: 'General Contractor', name: 'GC Reviewer', initials: 'GC', status: 'approved', date: 'Reviewed' },
    { id: 3, role: 'Architect', name: 'Architect', initials: 'AR', status: selected.status === 'approved' ? 'approved' : selected.status === 'revise_resubmit' ? 'rejected' : 'pending', date: selected.status === 'approved' ? 'Approved' : undefined, comment: selected.status === 'revise_resubmit' ? 'Revisions required' : undefined },
    { id: 4, role: 'Owner', name: 'Owner', initials: 'OW', status: selected.status === 'approved' ? 'approved' : 'waiting' },
  ] : [], [selected]);

  const handleApprove = useCallback(() => {
    addToast('success', `${selected?.submittalNumber} approved successfully`);
    onClose();
  }, [selected, addToast, onClose]);

  const handleReject = useCallback(() => {
    addToast('error', `${selected?.submittalNumber} has been rejected`);
    onClose();
  }, [selected, addToast, onClose]);

  const handleRequestRevision = useCallback(() => {
    addToast('warning', `Revision requested for ${selected?.submittalNumber}`);
    onClose();
  }, [selected, addToast, onClose]);

  const handleClose = () => {
    setEditingDetail(false);
    onClose();
  };

  const handleDelete = useCallback(async () => {
    if (!selected || !projectId || !deleteSubmittalMutateAsync) return;
    const id = String(selected.id);
    const label = (selected.title as string) || (selected.submittalNumber as string) || `Submittal ${id.slice(0, 8)}`;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    try {
      await deleteSubmittalMutateAsync({ id, projectId });
      toast.success('Submittal deleted');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete submittal');
    }
  }, [selected, projectId, deleteSubmittalMutateAsync, onClose]);

  const dueDate = selected?.dueDate as string | undefined;

  return (
    <DetailPanel
      open={!!selected}
      onClose={handleClose}
      title={(selected?.submittalNumber as string) || ''}
    >
      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
          {/* Title + Edit Toggle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing['3'] }}>
              <h3 style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md, flex: 1 }}>
                {selected.title as string}
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
              {deleteSubmittalMutateAsync && (
                <PermissionGate permission="submittals.delete">
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deletePending}
                    aria-label="Delete this submittal"
                    data-testid="delete-submittal-button"
                  >
                    {deletePending ? 'Deleting…' : 'Delete'}
                  </Btn>
                </PermissionGate>
              )}
            </div>
            <EditingLockBanner entityType="submittal" entityId={String(selected.id)} isEditing={editingDetail} />
            <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
              <PriorityTag priority={selected.priority as 'low' | 'medium' | 'high' | 'critical'} />
              <StatusTag status={selected.status as 'pending' | 'approved' | 'under_review' | 'revise_resubmit' | 'complete' | 'active' | 'closed' | 'pending_approval'} />
            </div>
          </div>

          {/* Approval Stepper */}
          <ReviewerStepper status={selected.status as string} reviewers={reviewersData} />

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
            <EditableDetailField
              label="From"
              value={(selected.from as string) || ''}
              editing={editingDetail}
              type="text"
              onSave={async (val) => {
                await updateSubmittalMutateAsync({ id: String(selected.id), updates: { subcontractor: val }, projectId: projectId! });
                toast.success('Subcontractor updated');
              }}
            />
            <EditableDetailField
              label="Due Date"
              value={dueDate?.slice(0, 10) || ''}
              editing={editingDetail}
              type="date"
              onSave={async (val) => {
                await updateSubmittalMutateAsync({ id: String(selected.id), updates: { due_date: val }, projectId: projectId! });
                toast.success('Due date updated');
              }}
              displayContent={
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Calendar size={14} color={dueDate && isOverdue(dueDate) && selected.status !== 'approved' ? colors.statusCritical : colors.textSecondary} />
                  <span style={{
                    fontSize: typography.fontSize.base,
                    color: dueDate && isOverdue(dueDate) && selected.status !== 'approved' ? colors.statusCritical : colors.textPrimary,
                    fontWeight: typography.fontWeight.medium,
                  }}>
                    {dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </span>
                </div>
              }
            />
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
            <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed, margin: 0 }}>
              {(selected.description as string) || 'No description provided.'}
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
          <RelatedItems items={getRelatedItemsForSubmittal(selected.id as string | number)} onNavigate={appNavigate} />

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
  );
};
