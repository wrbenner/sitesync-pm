import React, { useState, useEffect, useRef} from 'react';
import { Paperclip, Reply, FileText, Image, X, SmilePlus } from 'lucide-react';
import { Avatar } from '../Primitives';
import { MentionInput } from '../activity/MentionInput';
import { UploadZone } from '../files/UploadZone';
import { colors, spacing, typography, borderRadius, shadows, transitions, touchTarget } from '../../styles/theme';
import { uploadProjectFile } from '../../lib/storage';
import { fetchReactions, addReaction, removeReaction } from '../../api/endpoints/messageReactions';

export interface ThreadMessage {
  id: number;
  initials: string;
  name: string;
  role: string;
  date: string;
  message: string;
  type: 'submitted' | 'comment' | 'response' | 'approved' | 'rejected';
  attachments?: number;
  attachmentUrls?: string[];
  reactions?: { emoji: string; userIds: string[] }[];
  parentMessageId?: number;
  parentPreview?: string;
}

export interface SendPayload {
  text: string;
  mentionedUserIds: string[];
  attachmentUrls: string[];
  parentMessageId?: number;
}

interface ConversationThreadProps {
  messages: ThreadMessage[];
  onSend?: (payload: SendPayload) => void;
  showInput?: boolean;
  projectId?: string;
  currentUserId?: string;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: colors.statusInfo },
  comment: { label: 'Comment', color: colors.textSecondary },
  response: { label: 'Response', color: colors.statusActive },
  approved: { label: 'Approved', color: colors.statusActive },
  rejected: { label: 'Rejected', color: colors.statusCritical },
};

const QUICK_EMOJIS = ['👍', '👎', '✅', '❌', '🔥', '💬'];

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
}

function fileNameFromUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? url);
  } catch {
    return url;
  }
}

interface ReactionState {
  [messageId: number]: { emoji: string; userIds: string[] }[];
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  messages,
  onSend,
  showInput = true,
  projectId,
  currentUserId = 'current-user',
}) => {
  const [replyToId, setReplyToId] = useState<number | undefined>();
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [pendingAttachmentUrls, setPendingAttachmentUrls] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [reactions, setReactions] = useState<ReactionState>({});
  const [emojiPickerFor, setEmojiPickerFor] = useState<number | null>(null);
  const attachPopoverRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Load reactions for all messages from DB
  useEffect(() => {
    const messageIds = messages.map((m) => m.id);
    if (messageIds.length === 0) return;

    // Seed from prop data first
    const seed: ReactionState = {};
    messages.forEach((m) => {
      if (m.reactions && m.reactions.length > 0) seed[m.id] = m.reactions;
    });
    setTimeout(() => setReactions(seed), 0);

    // Then fetch live from DB
    Promise.all(
      messageIds.map(async (id) => {
        const rows = await fetchReactions(id);
        const grouped: { emoji: string; userIds: string[] }[] = [];
        rows.forEach(({ emoji, userId }) => {
          const existing = grouped.find((g) => g.emoji === emoji);
          if (existing) existing.userIds.push(userId);
          else grouped.push({ emoji, userIds: [userId] });
        });
        return { id, grouped };
      }),
    ).then((results) => {
      setReactions((prev) => {
        const next = { ...prev };
        results.forEach(({ id, grouped }) => {
          if (grouped.length > 0) next[id] = grouped;
        });
        return next;
      });
    });
  }, [messages.map((m) => m.id).join(',')]);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (attachPopoverRef.current && !attachPopoverRef.current.contains(e.target as Node)) {
        setAttachmentOpen(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFileReady = async (file: File) => {
    setUploadingCount((c) => c + 1);
    const { url, error } = projectId
      ? await uploadProjectFile(projectId, file)
      : { url: URL.createObjectURL(file), error: null };
    setUploadingCount((c) => c - 1);
    if (!error && url) {
      setPendingAttachmentUrls((prev) => [...prev, url]);
    }
  };

  const removePendingAttachment = (url: string) => {
    setPendingAttachmentUrls((prev) => prev.filter((u) => u !== url));
  };

  const handleSend = (text: string, mentionedUserIds: string[]) => {
    if (!text.trim() && pendingAttachmentUrls.length === 0) return;
    onSend?.({ text, mentionedUserIds, attachmentUrls: pendingAttachmentUrls, parentMessageId: replyToId });
    setPendingAttachmentUrls([]);
    setReplyToId(undefined);
    setAttachmentOpen(false);
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    setReactions((prev) => {
      const current = prev[messageId] ?? [];
      const group = current.find((g) => g.emoji === emoji);
      const hasReacted = group?.userIds.includes(currentUserId) ?? false;
      let next: { emoji: string; userIds: string[] }[];
      if (hasReacted) {
        next = current
          .map((g) => g.emoji === emoji ? { ...g, userIds: g.userIds.filter((id) => id !== currentUserId) } : g)
          .filter((g) => g.userIds.length > 0);
      } else {
        if (group) {
          next = current.map((g) => g.emoji === emoji ? { ...g, userIds: [...g.userIds, currentUserId] } : g);
        } else {
          next = [...current, { emoji, userIds: [currentUserId] }];
        }
      }
      return { ...prev, [messageId]: next };
    });

    const existing = reactions[messageId]?.find((g) => g.emoji === emoji);
    const hasReacted = existing?.userIds.includes(currentUserId) ?? false;
    if (hasReacted) {
      await removeReaction(messageId, currentUserId, emoji);
    } else {
      await addReaction(messageId, currentUserId, emoji);
    }
  };

  const replyToMsg = replyToId != null ? messages.find((m) => m.id === replyToId) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
      {messages.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: `${spacing['8']} ${spacing['4']}`, textAlign: 'center',
          color: colors.textTertiary,
        }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>
            No messages yet
          </p>
          <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm }}>
            Add a comment to start the conversation.
          </p>
        </div>
      )}
      {messages.map((msg, i) => {
        const cfg = typeConfig[msg.type] || typeConfig.comment;
        const msgReactions = reactions[msg.id] ?? [];
        const parentMsg = msg.parentMessageId != null ? messages.find((m) => m.id === msg.parentMessageId) : undefined;
        const isLastBeforeInput = i === messages.length - 1;

        return (
          <div
            key={msg.id}
            style={{
              position: 'relative',
              paddingLeft: msg.parentMessageId != null ? '60px' : '36px',
              paddingBottom: spacing['4'],
            }}
          >
            {/* Timeline line */}
            {!isLastBeforeInput && !msg.parentMessageId && (
              <div style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, backgroundColor: colors.borderSubtle }} />
            )}

            {/* Reply indent left border */}
            {msg.parentMessageId != null && (
              <div style={{ position: 'absolute', left: 36, top: 0, bottom: 0, width: 2, backgroundColor: colors.primaryOrange, borderRadius: 1 }} />
            )}

            {/* Avatar */}
            <div style={{ position: 'absolute', left: msg.parentMessageId != null ? 44 : 0, top: 0 }}>
              <Avatar initials={msg.initials} size={28} />
            </div>

            {/* Parent preview */}
            {parentMsg && (
              <div style={{
                marginBottom: spacing['2'],
                padding: `${spacing['1']} ${spacing['2']}`,
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.sm,
                borderLeft: `3px solid ${colors.borderDefault}`,
              }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Replying to <strong style={{ color: colors.textSecondary }}>{parentMsg.name}</strong>
                </span>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                  {parentMsg.message}
                </p>
              </div>
            )}

            {/* Content */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{msg.name}</span>
                <span style={{
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                  color: cfg.color, backgroundColor: `${cfg.color}12`,
                  padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm,
                  textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
                }}>
                  {cfg.label}
                </span>
              </div>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['2'] }}>
                {msg.role} · {msg.date}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>
                {msg.message}
              </p>

              {/* Legacy attachment count */}
              {msg.attachments && msg.attachments > 0 && !msg.attachmentUrls?.length && (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: spacing['2'] }}>
                  <Paperclip size={12} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{msg.attachments} attachment{msg.attachments > 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Attachment preview cards */}
              {msg.attachmentUrls && msg.attachmentUrls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['2'] }}>
                  {msg.attachmentUrls.map((url) => (
                    isImageUrl(url) ? (
                      <div key={url} style={{
                        borderRadius: borderRadius.md, overflow: 'hidden', border: `1px solid ${colors.borderSubtle}`,
                        width: 120, height: 80,
                      }}>
                        <img src={url} alt="attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: spacing['1'],
                        padding: `${spacing['1']} ${spacing['2']}`,
                        backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
                        border: `1px solid ${colors.borderSubtle}`, textDecoration: 'none',
                        fontSize: typography.fontSize.caption, color: colors.textSecondary,
                        maxWidth: 200, overflow: 'hidden',
                      }}>
                        <FileText size={12} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileNameFromUrl(url)}</span>
                      </a>
                    )
                  ))}
                </div>
              )}

              {/* Reactions + action row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: spacing['2'], flexWrap: 'wrap' }}>
                {/* Existing reaction pills */}
                {msgReactions.map((r) => {
                  const reacted = r.userIds.includes(currentUserId);
                  return (
                    <button
                      key={r.emoji}
                      onClick={() => toggleReaction(msg.id, r.emoji)}
                      aria-label={`${r.emoji} reaction, ${r.userIds.length} ${r.userIds.length === 1 ? 'person' : 'people'}`}
                      aria-pressed={reacted}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        padding: `0 ${spacing['2']}`,
                        minHeight: touchTarget.field,
                        border: `1px solid ${reacted ? colors.primaryOrange : colors.borderSubtle}`,
                        borderRadius: borderRadius.full,
                        backgroundColor: reacted ? colors.orangeSubtle : 'transparent',
                        cursor: 'pointer', fontFamily: typography.fontFamily,
                        fontSize: typography.fontSize.caption, color: reacted ? colors.primaryOrange : colors.textSecondary,
                        transition: `all ${transitions.instant}`,
                      }}
                    >
                      <span>{r.emoji}</span>
                      <span>{r.userIds.length}</span>
                    </button>
                  );
                })}

                {/* Add emoji button */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setEmojiPickerFor((prev) => prev === msg.id ? null : msg.id)}
                    aria-label="Add reaction"
                    aria-expanded={emojiPickerFor === msg.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: touchTarget.field, minHeight: touchTarget.field,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.full, backgroundColor: 'transparent',
                      cursor: 'pointer', color: colors.textTertiary,
                      transition: `all ${transitions.instant}`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primaryOrange; (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = colors.borderSubtle; (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
                  >
                    <SmilePlus size={14} />
                  </button>
                  {emojiPickerFor === msg.id && (
                    <div
                      ref={emojiPickerRef}
                      style={{
                        position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                        backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md,
                        boxShadow: shadows.dropdown, padding: spacing['2'],
                        display: 'flex', gap: spacing['1'], zIndex: 20,
                      }}
                    >
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => { toggleReaction(msg.id, emoji); setEmojiPickerFor(null); }}
                          aria-label={`React with ${emoji}`}
                          style={{
                            minWidth: touchTarget.field, minHeight: touchTarget.field,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: 'none', borderRadius: borderRadius.sm, backgroundColor: 'transparent',
                            cursor: 'pointer', fontSize: 18, fontFamily: typography.fontFamily,
                            transition: `background-color ${transitions.instant}`,
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reply button */}
                <button
                  onClick={() => setReplyToId((prev) => prev === msg.id ? undefined : msg.id)}
                  aria-label={`Reply to ${msg.name}`}
                  aria-pressed={replyToId === msg.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: `0 ${spacing['2']}`, border: 'none',
                    minHeight: touchTarget.field,
                    backgroundColor: 'transparent', cursor: 'pointer',
                    fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily,
                    color: replyToId === msg.id ? colors.primaryOrange : colors.textTertiary,
                    transition: `color ${transitions.instant}`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.primaryOrange; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = replyToId === msg.id ? colors.primaryOrange : colors.textTertiary; }}
                >
                  <Reply size={13} />
                  Reply
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Reply input */}
      {showInput && (
        <div style={{ marginTop: spacing['2'] }}>
          {/* Reply context banner */}
          {replyToMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${spacing['1']} ${spacing['3']}`,
              backgroundColor: colors.orangeSubtle, borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`,
              borderLeft: `3px solid ${colors.primaryOrange}`,
            }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange }}>
                Replying to <strong>{replyToMsg.name}</strong>: <span style={{ color: colors.textSecondary }}>{replyToMsg.message.slice(0, 60)}{replyToMsg.message.length > 60 ? '...' : ''}</span>
              </span>
              <button
                onClick={() => setReplyToId(undefined)}
                aria-label="Cancel reply"
                style={{
                  border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                  color: colors.textTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: touchTarget.field, minHeight: touchTarget.field,
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Pending attachment previews */}
          {pendingAttachmentUrls.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`,
              backgroundColor: colors.surfaceInset,
              borderTop: replyToMsg ? 'none' : undefined,
            }}>
              {pendingAttachmentUrls.map((url) => (
                <div key={url} style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  padding: `2px ${spacing['2']}`, backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.full, border: `1px solid ${colors.borderSubtle}`,
                  fontSize: typography.fontSize.caption, color: colors.textSecondary,
                }}>
                  {isImageUrl(url) ? <Image size={10} /> : <FileText size={10} />}
                  <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileNameFromUrl(url)}</span>
                  <button
                    onClick={() => removePendingAttachment(url)}
                    aria-label="Remove attachment"
                    style={{
                      border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                      color: colors.textTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: touchTarget.field, minHeight: touchTarget.field,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {uploadingCount > 0 && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, padding: `2px ${spacing['2']}` }}>
                  Uploading...
                </span>
              )}
            </div>
          )}

          {/* Input row */}
          <div style={{
            display: 'flex', gap: spacing['2'], alignItems: 'center',
            backgroundColor: colors.surfaceInset,
            borderRadius: replyToMsg || pendingAttachmentUrls.length > 0
              ? `0 0 ${borderRadius.full} ${borderRadius.full}`
              : borderRadius.full,
            padding: `0 ${spacing['1']} 0 0`,
          }}>
            {/* Attachment button + popover */}
            <div style={{ position: 'relative', flexShrink: 0 }} ref={attachPopoverRef}>
              <button
                onClick={() => setAttachmentOpen((v) => !v)}
                aria-label="Attach file"
                aria-expanded={attachmentOpen}
                style={{
                  minWidth: touchTarget.field, minHeight: touchTarget.field,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                  color: attachmentOpen ? colors.primaryOrange : colors.textTertiary,
                  borderRadius: borderRadius.full, transition: `color ${transitions.instant}`,
                  marginLeft: spacing['1'],
                }}
                title="Attach file (Cmd+Shift+A)"
              >
                <Paperclip size={16} />
              </button>
              {attachmentOpen && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
                  width: 340, backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg,
                  boxShadow: shadows.dropdown, padding: spacing['3'], zIndex: 30,
                  border: `1px solid ${colors.borderSubtle}`,
                }}>
                  <p style={{ margin: `0 0 ${spacing['2']} 0`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    Attach a file
                  </p>
                  <UploadZone
                    onUpload={() => setAttachmentOpen(false)}
                    onFileReady={handleFileReady}
                  />
                </div>
              )}
            </div>

            {/* MentionInput */}
            <div style={{ flex: 1 }}>
              <MentionInput
                onSend={handleSend}
                placeholder={replyToMsg ? `Reply to ${replyToMsg.name}... (@mention, Cmd+Enter)` : 'Add a comment... (@mention, Cmd+Enter)'}
                projectId={projectId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
