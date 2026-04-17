import React from 'react';
import { Btn, DetailPanel, Avatar, StatusTag, PriorityTag, RelatedItems } from '../../components/Primitives';
import { Camera, CheckCircle, MessageSquare, RefreshCw, XCircle } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { EditableDetailField } from '../../components/forms/EditableField';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { PresenceAvatars } from '../../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../../components/ui/EditingLockBanner';
import { getRelatedItemsForPunchItem, useAppNavigate } from '../../utils/connections';
import { toast } from 'sonner';
import type { PunchItem, Comment } from './types';
import {
  statusMap,
  statusLabel,
  formatDate,
  getDueDateColor,
} from './types';
import { StatusDot } from './PunchListTable';

interface PunchListDetailProps {
  selected: PunchItem | null;
  onClose: () => void;
  editingDetail: boolean;
  setEditingDetail: (v: boolean) => void;
  rejectNote: string;
  setRejectNote: (v: string) => void;
  showRejectNote: boolean;
  setShowRejectNote: (v: boolean) => void;
  isMobile: boolean;
  comments: Comment[];
  updatePunchItem: {
    mutateAsync: (args: { id: string; updates: Record<string, unknown>; projectId: string }) => Promise<unknown>;
  };
  projectId: string | null;
  handleMarkInProgress: () => void;
  handleMarkSubComplete: () => void;
  handleVerify: () => void;
  handleReject: () => void;
  handleAddPhoto: () => void;
}

export const PunchListDetail: React.FC<PunchListDetailProps> = ({
  selected,
  onClose,
  editingDetail,
  setEditingDetail,
  rejectNote,
  setRejectNote,
  showRejectNote,
  setShowRejectNote,
  isMobile,
  comments,
  updatePunchItem,
  projectId,
  handleMarkInProgress,
  handleMarkSubComplete,
  handleVerify,
  handleReject,
  handleAddPhoto,
}) => {
  const appNavigate = useAppNavigate();

  return (
    <DetailPanel
      open={!!selected}
      onClose={onClose}
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
              <PriorityTag priority={selected.priority as 'low' | 'medium' | 'high' | 'critical'} />
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
              displayContent={<PriorityTag priority={selected.priority as 'low' | 'medium' | 'high' | 'critical'} />}
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
                  <img loading="lazy"
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
                  <img loading="lazy"
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
  );
};
