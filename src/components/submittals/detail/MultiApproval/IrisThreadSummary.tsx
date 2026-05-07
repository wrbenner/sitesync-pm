// Phase 7c-1 — Iris thread summary chip.
//
// Displays the per-step Iris one-line summary above the comments cell
// (in WorkflowChainTable) or above the thread (in StepThreadPanel header).
//
// Phase 7c-1 ships a deterministic placeholder ("3 comments · last from
// Walker 2h ago") when `iris_thread_summary` is null. Phase 7c-2 wires the
// LLM-generated summary via the submittal-thread-summarize edge fn.

import React from 'react'
import { Sparkles } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface IrisThreadSummaryProps {
  /** Iris-generated summary from `submittal_reviewers.iris_thread_summary`.
   *  When null/undefined, the deterministic fallback renders. */
  irisSummary: string | null | undefined
  /** Total comment count on the thread (after edit-history collapse). */
  commentCount: number
  /** Last commenter's display name (Phase 7c-2 augments). */
  lastCommenterName?: string | null
  /** Last comment timestamp (ISO). */
  lastCommentAt?: string | null
  /** When true, render as a one-line chip; false → inline body text. */
  compact?: boolean
}

export const IrisThreadSummary: React.FC<IrisThreadSummaryProps> = ({
  irisSummary,
  commentCount,
  lastCommenterName,
  lastCommentAt,
  compact = false,
}) => {
  const text = irisSummary ?? buildDeterministicFallback({
    commentCount,
    lastCommenterName,
    lastCommentAt,
  })
  if (!text) return null

  if (compact) {
    return (
      <span
        title={text}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          fontSize: 10,
          fontWeight: 500,
          color: C.brandOrange,
          backgroundColor: 'rgba(244, 120, 32, 0.06)',
          borderRadius: 3,
          fontFamily: FONT,
          whiteSpace: 'nowrap',
          maxWidth: 220,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <Sparkles size={9} /> {text}
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '8px 10px',
        backgroundColor: 'rgba(244, 120, 32, 0.06)',
        border: '1px solid rgba(244, 120, 32, 0.18)',
        borderRadius: 4,
        fontFamily: FONT,
      }}
    >
      <Sparkles size={11} color={C.brandOrange} style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.brandOrange,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          Iris summary
        </div>
        <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.4 }}>{text}</div>
      </div>
    </div>
  )
}

// ── Deterministic fallback ─────────────────────────────────────────────────

export function buildDeterministicFallback(input: {
  commentCount: number
  lastCommenterName?: string | null
  lastCommentAt?: string | null
}): string | null {
  if (input.commentCount === 0) return null
  const ago = input.lastCommentAt ? formatRelative(input.lastCommentAt) : null
  const author = input.lastCommenterName ?? 'someone'
  if (input.commentCount === 1) {
    return ago ? `1 comment · ${author} ${ago}` : `1 comment from ${author}`
  }
  return ago
    ? `${input.commentCount} comments · last from ${author} ${ago}`
    : `${input.commentCount} comments`
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

export default IrisThreadSummary
