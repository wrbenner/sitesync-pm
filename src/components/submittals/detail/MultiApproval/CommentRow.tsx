// Phase 7c-1 — Single comment row in the StepThreadPanel.
//
// Renders body, author, timestamp, attachments, mentions. Edit-history
// chain is reachable via "Show edit history" toggle (when multiple
// versions exist). Author may edit/delete their own; PM/admin may
// delete any.

import React, { useState } from 'react'
import { Edit2, Trash2, Paperclip, History as HistoryIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  useEditStepComment,
  useDeleteStepComment,
} from '../../../../hooks/useStepComments'
import {
  getEditHistory,
  type StepComment,
} from '../../../../services/submittalStepComments'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
  critical: '#C93B3B',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface CommentRowProps {
  comment: StepComment
  rawThread: StepComment[]
  reviewerStepId: string
  /** When the current user is the comment author. */
  isAuthor: boolean
  /** When the current user is a PM/admin/owner (can delete any comment). */
  canModerate: boolean
  /** Resolves a user id to a display name (e.g. via `useProfileNames`). */
  resolveAuthor?: (userId: string | null) => { name: string; avatar?: string } | null
}

export const CommentRow: React.FC<CommentRowProps> = ({
  comment,
  rawThread,
  reviewerStepId,
  isAuthor,
  canModerate,
  resolveAuthor,
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body_md)
  const [historyOpen, setHistoryOpen] = useState(false)
  const edit = useEditStepComment(reviewerStepId)
  const del = useDeleteStepComment(reviewerStepId)

  const author = resolveAuthor?.(comment.author_id) ?? null
  const authorName = author?.name ?? 'Unknown'

  const editHistory = comment.parent_comment_id != null
    ? getEditHistory(rawThread, rootIdOf(rawThread, comment.id))
    : getEditHistory(rawThread, comment.id)

  const hasEdits = editHistory.length > 1

  const handleSaveEdit = async (): Promise<void> => {
    if (draft.trim().length === 0) {
      toast.error('Comment body cannot be empty.')
      return
    }
    try {
      await edit.mutateAsync({
        comment_id: comment.id,
        body_md: draft.trim(),
        attachments: comment.attachments,
        mentions: comment.mentions,
      })
      setEditing(false)
      toast.success('Comment updated.')
    } catch (err) {
      toast.error('Could not update comment: ' + (err as Error).message)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm('Delete this comment? It stays in the audit log but is hidden from the thread.')) return
    try {
      await del.mutateAsync(comment.id)
      toast.success('Comment deleted.')
    } catch (err) {
      toast.error('Could not delete comment: ' + (err as Error).message)
    }
  }

  if (comment.is_deleted) {
    return (
      <li
        style={{
          padding: '8px 12px',
          backgroundColor: C.surfaceInset,
          border: `1px dashed ${C.borderSubtle}`,
          borderRadius: 4,
          fontSize: 12,
          color: C.ink3,
          fontStyle: 'italic',
          fontFamily: FONT,
        }}
      >
        [comment deleted by {authorName}{' '}{formatRelative(comment.created_at)}]
      </li>
    )
  }

  return (
    <li
      style={{
        padding: '10px 12px',
        backgroundColor: '#fff',
        border: `1px solid ${C.borderSubtle}`,
        borderRadius: 6,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: C.brandOrange,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {authorName.slice(0, 1).toUpperCase()}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{authorName}</span>
        <span style={{ fontSize: 11, color: C.ink3 }}>{formatRelative(comment.created_at)}</span>
        {hasEdits && (
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            title="Show edit history"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 6px',
              fontSize: 10,
              fontWeight: 600,
              color: C.ink3,
              backgroundColor: C.surfaceInset,
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              fontFamily: FONT,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <HistoryIcon size={9} /> {editHistory.length} version{editHistory.length === 1 ? '' : 's'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        {(isAuthor || canModerate) && !editing && (
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {isAuthor && (
              <button
                type="button"
                onClick={() => { setEditing(true); setDraft(comment.body_md) }}
                aria-label="Edit comment"
                title="Edit"
                style={iconBtnStyle}
              >
                <Edit2 size={11} />
              </button>
            )}
            {(isAuthor || canModerate) && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Delete comment"
                title="Delete"
                style={{ ...iconBtnStyle, color: C.critical }}
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </header>

      {comment.reason_code && (
        <span
          style={{
            display: 'inline-block',
            alignSelf: 'flex-start',
            fontSize: 10,
            fontWeight: 700,
            color: C.brandOrange,
            backgroundColor: 'rgba(244, 120, 32, 0.10)',
            padding: '1px 6px',
            borderRadius: 3,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          ↩ Send-back: {comment.reason_code.replace(/_/g, ' ')}
        </span>
      )}

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            style={{
              padding: '6px 8px',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              fontSize: 13,
              fontFamily: FONT,
              color: C.ink,
              resize: 'vertical',
              minHeight: 64,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              type="button"
              onClick={() => { setEditing(false); setDraft(comment.body_md) }}
              style={secondaryBtnStyle}
              disabled={edit.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={edit.isPending || draft.trim().length === 0}
              style={{
                ...primaryBtnStyle,
                backgroundColor: edit.isPending ? '#F4D7BD' : C.brandOrange,
              }}
            >
              {edit.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: C.ink,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {comment.body_md}
          </p>
          {comment.attachments.length > 0 && (
            <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {comment.attachments.map((a, i) => (
                <li key={i}>
                  <a
                    href={a.url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      fontSize: 11,
                      color: C.ink2,
                      backgroundColor: C.surfaceInset,
                      borderRadius: 3,
                      textDecoration: 'none',
                    }}
                  >
                    <Paperclip size={10} /> {a.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {historyOpen && hasEdits && (
        <div
          style={{
            marginTop: 4,
            padding: '8px 10px',
            backgroundColor: C.surfaceInset,
            borderRadius: 4,
            fontSize: 11,
            color: C.ink2,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: C.ink3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Edit history
          </div>
          <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {editHistory.map((v) => (
              <li key={v.id} style={{ fontSize: 11, color: C.ink2 }}>
                <em style={{ color: C.ink3 }}>{formatRelative(v.created_at)}:</em>{' '}
                <span style={{ whiteSpace: 'pre-wrap' }}>{v.body_md}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function rootIdOf(rows: StepComment[], id: string): string {
  const byId = new Map(rows.map((r) => [r.id, r]))
  let cur = id
  const seen = new Set<string>()
  while (true) {
    if (seen.has(cur)) return cur
    seen.add(cur)
    const r = byId.get(cur)
    if (!r || !r.parent_comment_id) return cur
    cur = r.parent_comment_id
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  borderRadius: 3,
  color: C.ink3,
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '5px 10px',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: FONT,
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '5px 10px',
  backgroundColor: '#fff',
  color: C.ink,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: FONT,
}

export default CommentRow
