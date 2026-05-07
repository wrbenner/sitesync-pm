// Phase 7c-1 — Step thread panel.
//
// Right-rail panel that opens when the user clicks a comments cell in
// WorkflowChainTable (or via the keyboard shortcut). Shows:
//
//   ┌─────────────────────────────────────┐
//   │ Step 2 · Architect          [✕]    │
//   │ ✨ Iris: 3 comments — Walker 2h ago │
//   ├─────────────────────────────────────┤
//   │ [thread of comments, oldest first]  │
//   │ [edit-history toggle per chain]     │
//   ├─────────────────────────────────────┤
//   │ [composer at the bottom — ⌘+Enter]  │
//   └─────────────────────────────────────┘
//
// Esc closes; click outside the panel does NOT close (per ADR-004 — the
// panel is a focused worksurface, not a modal). Composer autofocuses on
// open so a coordinator can type immediately.

import React, { useEffect } from 'react'
import { X, MessageSquare } from 'lucide-react'
import { useStepComments } from '../../../../hooks/useStepComments'
import type { StepComment } from '../../../../services/submittalStepComments'
import { CommentRow } from './CommentRow'
import { CommentComposer } from './CommentComposer'
import { IrisThreadSummary } from './IrisThreadSummary'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const PANEL_WIDTH = 420

export interface StepThreadPanelProps {
  open: boolean
  onClose: () => void
  reviewerStepId: string | null
  /** Step header line (e.g. "Step 2 · Architect"). Caller composes from
   *  the WorkflowChainTable row's data. */
  stepLabel: string
  /** Per-step Iris summary from submittal_reviewers.iris_thread_summary. */
  irisSummary?: string | null
  /** Whether the current user is allowed to comment. */
  canComment: boolean
  /** Whether the current user can moderate (delete) any comment. */
  canModerate: boolean
  /** Caller's current user id — used to detect "isAuthor" for edit affordances. */
  currentUserId: string | null
  /** Optional resolver for author display names (typeahead reuse). */
  resolveAuthor?: (userId: string | null) => { name: string; avatar?: string } | null
}

export const StepThreadPanel: React.FC<StepThreadPanelProps> = ({
  open,
  onClose,
  reviewerStepId,
  stepLabel,
  irisSummary,
  canComment,
  canModerate,
  currentUserId,
  resolveAuthor,
}) => {
  const { comments, loading, refetch } = useStepComments(reviewerStepId)

  // Esc closes (ADR-004 — never modal, never full-page nav).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !reviewerStepId) return null

  // Collect raw thread (incl. edit-history rows) for CommentRow's history toggle.
  // The service-layer `listThread` returns the collapsed view; we still need
  // the raw rows for the history. Phase 7c-2 splits this into two queries
  // (collapsed + history) for cleaner cache shapes.
  const rawThread = comments

  const lastComment = comments.at(-1) as StepComment | undefined
  const lastCommenterName = lastComment ? resolveAuthor?.(lastComment.author_id)?.name ?? null : null

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={`${stepLabel} comments`}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        maxWidth: '95vw',
        backgroundColor: '#fff',
        borderLeft: `1px solid ${C.border}`,
        boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.06)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        color: C.ink,
        animation: 'sitesync-thread-slide 160ms ease-out',
      }}
    >
      <style>{`@keyframes sitesync-thread-slide { from { transform: translateX(${PANEL_WIDTH}px); } to { transform: translateX(0); } }`}</style>

      <header
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.borderSubtle}`,
          backgroundColor: C.surface,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <span style={{ color: C.ink2, marginTop: 2 }}>
          <MessageSquare size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.ink3,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Comment thread
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 2 }}>
            {stepLabel}
          </div>
          <div style={{ marginTop: 6 }}>
            <IrisThreadSummary
              irisSummary={irisSummary}
              commentCount={comments.length}
              lastCommenterName={lastCommenterName}
              lastCommentAt={lastComment?.created_at ?? null}
              compact={false}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comment thread"
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            color: C.ink2,
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
          }}
        >
          <X size={14} />
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
        {loading ? (
          <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>Loading thread…</p>
        ) : comments.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: C.ink3, fontStyle: 'italic' }}>
            No comments on this step yet. Add the first one below.
          </p>
        ) : (
          <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                rawThread={rawThread}
                reviewerStepId={reviewerStepId}
                isAuthor={c.author_id != null && c.author_id === currentUserId}
                canModerate={canModerate}
                resolveAuthor={resolveAuthor}
              />
            ))}
          </ul>
        )}
      </div>

      <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.borderSubtle}`, backgroundColor: C.surface }}>
        <CommentComposer
          reviewerStepId={reviewerStepId}
          canComment={canComment}
          autoFocus
          onSent={() => { void refetch() }}
        />
      </div>
    </aside>
  )
}

export default StepThreadPanel
