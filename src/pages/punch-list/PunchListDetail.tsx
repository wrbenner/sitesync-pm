import React, { useState, useCallback } from 'react';
import { Btn, DetailPanel, Avatar } from '../../components/Primitives';
import {
  Camera, CheckCircle, MessageSquare, RefreshCw, XCircle,
  MapPin, Wrench, Calendar, User, Clock,
  Play, Eye, Shield, AlertTriangle, Send,
} from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';
import { EditableDetailField } from '../../components/forms/EditableField';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { PresenceAvatars } from '../../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../../components/ui/EditingLockBanner';
import { getRelatedItemsForPunchItem, useAppNavigate } from '../../utils/connections';
import { RelatedItems } from '../../components/Primitives';
import { toast } from 'sonner';
import type { PunchItem, Comment } from './types';
import {
  formatDate,
  getDueDateColor,
  getBallInCourt,
} from './types';

// ── Verification Pipeline ───────────────────────────────
const PIPELINE = [
  { key: 'open', label: 'Open', icon: AlertTriangle },
  { key: 'in_progress', label: 'Started', icon: Play },
  { key: 'sub_complete', label: 'Complete', icon: Eye },
  { key: 'verified', label: 'Verified', icon: CheckCircle },
];
const STEP_IDX: Record<string, number> = { open: 0, rejected: 0, in_progress: 1, sub_complete: 2, verified: 3 };

const VerificationPipeline: React.FC<{ status: string }> = ({ status }) => {
  const cur = STEP_IDX[status] ?? 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '14px 20px',
      backgroundColor: colors.surfaceRaised,
      borderRadius: 14,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      {PIPELINE.map((step, i) => {
        const Icon = step.icon;
        const done = i < cur;
        const current = i === cur;
        const isRejected = current && status === 'rejected';
        const nodeColor = done ? colors.statusActive
          : isRejected ? colors.statusCritical
          : current ? colors.primaryOrange
          : colors.textTertiary;

        return (
          <React.Fragment key={step.key}>
            {i > 0 && (
              <div style={{
                flex: 1, height: 2,
                backgroundColor: done ? colors.statusActive : colors.borderSubtle,
                transition: 'background-color 0.4s ease',
              }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                backgroundColor: done ? `${colors.statusActive}18` : current ? `${nodeColor}18` : colors.surfaceInset,
                border: `2px solid ${nodeColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
              }}>
                {done ? (
                  <CheckCircle size={14} style={{ color: colors.statusActive }} />
                ) : (
                  <Icon size={12} style={{ color: nodeColor }} />
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: current ? 700 : 500,
                color: current ? nodeColor : colors.textTertiary,
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
              {isRejected && (
                <span style={{
                  position: 'absolute', top: -6, right: -12,
                  fontSize: 8, fontWeight: 800,
                  color: colors.statusCritical,
                  backgroundColor: colors.statusCriticalSubtle,
                  padding: '1px 5px', borderRadius: 100,
                  letterSpacing: '0.02em',
                }}>
                  REJECTED
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Metadata Pill ───────────────────────────────────────
const MetaPill: React.FC<{
  icon: typeof MapPin;
  label: string;
  value: string;
  color?: string;
}> = ({ icon: Icon, label, value, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', borderRadius: 100,
    backgroundColor: colors.surfaceInset,
    border: `1px solid ${colors.borderSubtle}`,
  }}>
    <Icon size={11} style={{ color: color || colors.textTertiary }} />
    <span style={{
      fontSize: 10, color: colors.textTertiary,
      textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600,
    }}>
      {label}
    </span>
    <span style={{
      fontSize: 12, color: color || colors.textPrimary,
      fontWeight: 600,
    }}>
      {value}
    </span>
  </div>
);

// ── Props ───────────────────────────────────────────────
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
  deletePunchItem?: {
    mutateAsync: (args: { id: string; projectId: string }) => Promise<unknown>;
    isPending: boolean;
  };
  projectId: string | null;
  handleMarkInProgress: () => void;
  handleMarkSubComplete: () => void;
  handleVerify: () => void;
  handleReject: () => void;
  handleAddPhoto: () => void;
  onAddComment?: (text: string) => Promise<void>;
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
  _isMobile,
  comments,
  updatePunchItem,
  deletePunchItem,
  projectId,
  handleMarkInProgress,
  handleMarkSubComplete,
  handleVerify,
  handleReject,
  handleAddPhoto,
  onAddComment,
}) => {
  const appNavigate = useAppNavigate();
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim() || !onAddComment) return;
    setIsSubmittingComment(true);
    try {
      await onAddComment(commentText.trim());
      setCommentText('');
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentText, onAddComment]);

  const handleDelete = React.useCallback(async () => {
    if (!selected || !projectId || !deletePunchItem) return;
    const label = selected.description || `Punch item ${selected.itemNumber}`;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    try {
      await deletePunchItem.mutateAsync({ id: String(selected.id), projectId });
      toast.success('Punch item deleted');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete punch item');
    }
  }, [selected, projectId, deletePunchItem, onClose]);

  return (
    <DetailPanel
      open={!!selected}
      onClose={onClose}
      title={selected?.itemNumber || ''}
    >
      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ── Photo Hero ──────────────────────────── */}
          <div style={{ margin: `-${spacing['4']} -${spacing['4']} 0`, position: 'relative' }}>
            {selected.before_photo_url ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={selected.before_photo_url}
                  alt="Before"
                  loading="lazy"
                  style={{
                    width: '100%', height: 220, objectFit: 'cover', display: 'block',
                  }}
                />
                {/* Gradient overlay */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                }} />
                {/* Before/After toggle */}
                {selected.after_photo_url && (
                  <div style={{
                    position: 'absolute', top: 12, left: 12,
                    display: 'flex', gap: 4,
                  }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                      backgroundColor: 'rgba(255,255,255,0.9)', color: colors.textPrimary,
                    }}>
                      Before
                    </span>
                  </div>
                )}
                {/* Item number badge */}
                <span style={{
                  position: 'absolute', bottom: 12, left: 16,
                  fontSize: 13, fontWeight: 700,
                  color: 'white',
                  fontFamily: typography.fontFamilyMono,
                  textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}>
                  {selected.itemNumber}
                </span>
                {/* Add after photo button */}
                {!selected.after_photo_url && selected.verification_status !== 'verified' && (
                  <PermissionGate permission="punch_list.edit">
                    <button
                      onClick={handleAddPhoto}
                      style={{
                        position: 'absolute', bottom: 12, right: 16,
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 12px', borderRadius: 100,
                        border: 'none', cursor: 'pointer',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        color: colors.textPrimary,
                        fontSize: 11, fontWeight: 600,
                        transition: 'transform 0.15s',
                      }}
                    >
                      <Camera size={12} /> Add After
                    </button>
                  </PermissionGate>
                )}
              </div>
            ) : (
              <div
                onClick={handleAddPhoto}
                style={{
                  height: 160,
                  backgroundColor: colors.surfaceInset,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  backgroundColor: colors.surfaceHover,
                  border: `2px dashed ${colors.borderDefault}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Camera size={20} style={{ color: colors.textTertiary }} />
                </div>
                <span style={{ fontSize: 13, color: colors.textTertiary, fontWeight: 500 }}>
                  Tap to add photo
                </span>
              </div>
            )}
          </div>

          {/* ── Content Area ────────────────────────── */}
          <div style={{ padding: `20px 0`, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header: Title + Actions */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <h3 style={{
                  fontSize: 20, fontWeight: 700,
                  color: colors.textPrimary,
                  margin: 0, lineHeight: 1.3, flex: 1,
                }}>
                  {selected.description}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
                  {deletePunchItem && (
                    <PermissionGate permission="punch_list.delete">
                      <Btn variant="ghost" size="sm" onClick={handleDelete}
                        disabled={deletePunchItem.isPending}
                        data-testid="delete-punch-item-button"
                      >
                        {deletePunchItem.isPending ? '...' : 'Delete'}
                      </Btn>
                    </PermissionGate>
                  )}
                </div>
              </div>
              <EditingLockBanner entityType="punch item" entityId={String(selected.id)} isEditing={editingDetail} />
            </div>

            {/* Verification Pipeline */}
            <VerificationPipeline status={selected.verification_status} />

            {/* Metadata Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.area && <MetaPill icon={MapPin} label="Location" value={selected.area} />}
              {selected.trade && <MetaPill icon={Wrench} label="Trade" value={selected.trade} />}
              {selected.assigned && <MetaPill icon={User} label="Assigned" value={selected.assigned} />}
              {selected.priority && (
                <MetaPill
                  icon={AlertTriangle} label="Priority"
                  value={selected.priority.charAt(0).toUpperCase() + selected.priority.slice(1)}
                  color={selected.priority === 'critical' ? colors.statusCritical : selected.priority === 'high' ? colors.primaryOrange : undefined}
                />
              )}
              {selected.dueDate && (
                <MetaPill
                  icon={Calendar} label="Due"
                  value={formatDate(selected.dueDate)}
                  color={getDueDateColor(selected.dueDate)}
                />
              )}
            </div>

            {/* Ball-in-Court indicator */}
            {selected.verification_status !== 'verified' && (() => {
              const bic = getBallInCourt(selected);
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', borderRadius: 12,
                  backgroundColor: colors.orangeSubtle,
                  border: `1px solid ${colors.primaryOrange}20`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    backgroundColor: colors.primaryOrange,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <User size={14} style={{ color: colors.white }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: colors.primaryOrange, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Ball in Court
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                      {bic.label}
                      {bic.role && <span style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 6 }}>({bic.role})</span>}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Rejection Banner */}
            {selected.rejection_reason && selected.verification_status !== 'verified' && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 16px', borderRadius: 12,
                backgroundColor: colors.statusCriticalSubtle,
                border: `1px solid ${colors.statusCritical}25`,
              }}>
                <XCircle size={16} style={{ color: colors.statusCritical, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.statusCritical, marginBottom: 2 }}>
                    Rejection Reason
                  </div>
                  <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.5 }}>
                    {selected.rejection_reason}
                  </div>
                </div>
              </div>
            )}

            {/* Editable Detail Fields */}
            {editingDetail && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                padding: 16, backgroundColor: colors.surfaceInset,
                borderRadius: 14, border: `1px solid ${colors.borderSubtle}`,
              }}>
                <EditableDetailField
                  label="Location" value={selected.area} editing type="text"
                  onSave={async (val) => {
                    await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { location: val }, projectId: projectId! });
                    toast.success('Location updated');
                  }}
                />
                <EditableDetailField
                  label="Assigned To" value={selected.assigned} editing type="text"
                  onSave={async (val) => {
                    await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { assigned_to: val }, projectId: projectId! });
                    toast.success('Assignee updated');
                  }}
                />
                <EditableDetailField
                  label="Priority" value={selected.priority} editing type="select"
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
                />
                <EditableDetailField
                  label="Due Date" value={selected.dueDate} editing type="date"
                  onSave={async (val) => {
                    await updatePunchItem.mutateAsync({ id: String(selected.id), updates: { due_date: val }, projectId: projectId! });
                    toast.success('Due date updated');
                  }}
                />
              </div>
            )}

            {/* ── Action Buttons ─────────────────────── */}
            <div style={{
              padding: 16, borderRadius: 14,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
            }}>
              {selected.verification_status === 'open' && (
                <PermissionGate permission="punch_list.edit">
                  <button onClick={handleMarkInProgress} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 20px', borderRadius: 10,
                    border: 'none', cursor: 'pointer',
                    backgroundColor: colors.statusInfo,
                    color: colors.white,
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}>
                    <Play size={16} /> Start Work
                  </button>
                </PermissionGate>
              )}
              {selected.verification_status === 'in_progress' && (
                <PermissionGate permission="punch_list.edit">
                  <button onClick={handleMarkSubComplete} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 20px', borderRadius: 10,
                    border: 'none', cursor: 'pointer',
                    backgroundColor: colors.statusReview,
                    color: colors.white,
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}>
                    <CheckCircle size={16} /> Mark Complete
                  </button>
                </PermissionGate>
              )}
              {selected.verification_status === 'sub_complete' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <PermissionGate permission="punch_list.verify">
                    <button onClick={handleVerify} style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '12px 20px', borderRadius: 10,
                      border: 'none', cursor: 'pointer',
                      backgroundColor: colors.statusActive,
                      color: colors.white,
                      fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}>
                      <Shield size={16} /> Verify & Close
                    </button>
                  </PermissionGate>
                  <PermissionGate permission="punch_list.verify">
                    {showRejectNote ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea
                          autoFocus value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="What needs to be fixed? (required for the sub)"
                          rows={2}
                          style={{
                            width: '100%', padding: '10px 14px', fontSize: 13,
                            fontFamily: 'inherit', lineHeight: 1.5,
                            border: `1.5px solid ${colors.statusCritical}50`,
                            borderRadius: 10, resize: 'none', outline: 'none',
                            color: colors.textPrimary,
                            backgroundColor: colors.statusCriticalSubtle,
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleReject}
                            disabled={!rejectNote.trim()}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              padding: '10px 16px', borderRadius: 10,
                              border: 'none', cursor: rejectNote.trim() ? 'pointer' : 'not-allowed',
                              backgroundColor: rejectNote.trim() ? colors.statusCritical : colors.surfaceDisabled,
                              color: rejectNote.trim() ? colors.white : colors.textDisabled,
                              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                            }}>
                            <XCircle size={14} /> Reject & Return
                          </button>
                          <button onClick={() => { setShowRejectNote(false); setRejectNote(''); }}
                            style={{
                              padding: '10px 16px', borderRadius: 10,
                              border: `1px solid ${colors.borderDefault}`,
                              backgroundColor: 'transparent', cursor: 'pointer',
                              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                              color: colors.textSecondary,
                            }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowRejectNote(true)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 16px', borderRadius: 10,
                        border: `1.5px solid ${colors.statusCritical}30`,
                        backgroundColor: colors.statusCriticalSubtle,
                        color: colors.statusCritical,
                        fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        <XCircle size={14} /> Reject
                      </button>
                    )}
                  </PermissionGate>
                </div>
              )}
              {selected.verification_status === 'rejected' && (
                <PermissionGate permission="punch_list.edit">
                  <button onClick={handleMarkSubComplete} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 20px', borderRadius: 10,
                    border: 'none', cursor: 'pointer',
                    backgroundColor: colors.primaryOrange,
                    color: colors.white,
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}>
                    <RefreshCw size={16} /> Resubmit for Verification
                  </button>
                </PermissionGate>
              )}
              {selected.verification_status === 'verified' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', borderRadius: 10,
                  backgroundColor: `${colors.statusActive}12`,
                  border: `1px solid ${colors.statusActive}30`,
                }}>
                  <CheckCircle size={20} style={{ color: colors.statusActive }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.statusActive }}>
                      Verified & Closed
                    </div>
                    {selected.verified_by && (
                      <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>
                        by {selected.verified_by}{selected.verified_at ? ` · ${formatDate(selected.verified_at)}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Status History Timeline ─────────────── */}
            <div style={{
              padding: 16, borderRadius: 14,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 12,
                fontSize: 12, fontWeight: 700, color: colors.textTertiary,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <Clock size={12} /> Activity
              </div>
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{
                  position: 'absolute', left: 6, top: 8, bottom: 8,
                  width: 1, backgroundColor: colors.borderSubtle,
                }} />
                {[
                  selected.createdDate ? {
                    label: 'Item reported', sub: selected.reportedBy,
                    date: formatDate(selected.createdDate), dot: colors.statusPending,
                  } : null,
                  selected.sub_completed_at ? {
                    label: 'Marked complete by sub', sub: selected.assigned,
                    date: formatDate(selected.sub_completed_at), dot: colors.statusReview,
                  } : null,
                  selected.rejection_reason ? {
                    label: 'Rejected — returned to sub', sub: selected.rejection_reason,
                    date: '', dot: colors.statusCritical,
                  } : null,
                  selected.verified_at ? {
                    label: 'Verified and closed', sub: selected.verified_by || '',
                    date: formatDate(selected.verified_at), dot: colors.statusActive,
                  } : null,
                ].filter(Boolean).map((event, idx) => event && (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    marginBottom: 12, position: 'relative',
                  }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      backgroundColor: event.dot,
                      border: '2px solid white',
                      boxShadow: `0 0 0 1px ${event.dot}40`,
                      flexShrink: 0, zIndex: 1,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                        {event.label}
                      </div>
                      {event.sub && (
                        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>
                          {event.sub}
                        </div>
                      )}
                    </div>
                    {event.date && (
                      <span style={{ fontSize: 11, color: colors.textTertiary, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {event.date}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Comments ───────────────────────────── */}
            <div style={{
              padding: 16, borderRadius: 14,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 12,
                fontSize: 12, fontWeight: 700, color: colors.textTertiary,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <MessageSquare size={12} /> Comments ({comments.length})
              </div>
              {comments.length === 0 ? (
                <p style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', padding: '8px 0', margin: 0 }}>
                  No comments yet
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                  {comments.map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10 }}>
                      <Avatar initials={c.initials} size={28} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                            {c.author}
                          </span>
                          <span style={{ fontSize: 11, color: colors.textTertiary }}>
                            {c.time}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, margin: 0 }}>
                          {c.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Comment input */}
              {onAddComment && (
                <div style={{
                  display: 'flex', gap: 8, alignItems: 'flex-end',
                  borderTop: comments.length > 0 ? `1px solid ${colors.borderSubtle}` : 'none',
                  paddingTop: comments.length > 0 ? 12 : 0,
                }}>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleSubmitComment();
                      }
                    }}
                    style={{
                      flex: 1, padding: '8px 12px', fontSize: 13,
                      fontFamily: 'inherit', lineHeight: 1.5,
                      border: `1.5px solid ${colors.borderDefault}`,
                      borderRadius: 10, resize: 'none', outline: 'none',
                      color: colors.textPrimary,
                      backgroundColor: colors.surface,
                      boxSizing: 'border-box',
                      minHeight: 36,
                    }}
                    onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = colors.primaryOrange; }}
                    onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = colors.borderDefault; }}
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || isSubmittingComment}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      border: 'none', cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                      backgroundColor: commentText.trim() ? colors.primaryOrange : colors.surfaceInset,
                      color: commentText.trim() ? colors.white : colors.textTertiary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.15s',
                    }}
                    title="Send comment (⌘+Enter)"
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForPunchItem(selected.id)} onNavigate={appNavigate} />

            {/* Photo Add Button (if no photo hero) */}
            {!selected.before_photo_url && selected.verification_status !== 'verified' && (
              <PermissionGate permission="punch_list.edit">
                <button onClick={handleAddPhoto} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 10,
                  border: `1.5px dashed ${colors.borderDefault}`,
                  backgroundColor: 'transparent', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  color: colors.textTertiary,
                  transition: 'all 0.15s',
                }}>
                  <Camera size={14} /> Add Photo
                </button>
              </PermissionGate>
            )}
          </div>
        </div>
      )}
    </DetailPanel>
  );
};
