// Phase 7c-1 — Comment composer at the bottom of the StepThreadPanel.
//
// Phase 7c-1 ships a tight textarea-based composer + ⌘+Enter to send.
// Phase 7c-2 swaps in the TipTap rich-text editor (reusing the RFI
// `RFICommentEditor` chrome) + @-mention dropdown + attachment dropzone.
// The textarea today is the structural composer that exercises the
// create RPC end-to-end.

import React, { useCallback, useState } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateStepComment } from '../../../../hooks/useStepComments'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  brandOrange: '#F47820',
  surface: '#FCFCFA',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface CommentComposerProps {
  reviewerStepId: string
  /** Whether the user is allowed to comment (project member). */
  canComment: boolean
  /** Optional autofocus on mount. */
  autoFocus?: boolean
  /** Fired after a successful comment — caller may close the composer or
   *  scroll the thread. */
  onSent?: (commentId: string) => void
}

export const CommentComposer: React.FC<CommentComposerProps> = ({
  reviewerStepId,
  canComment,
  autoFocus,
  onSent,
}) => {
  const [body, setBody] = useState('')
  const create = useCreateStepComment(reviewerStepId)

  const send = useCallback(async (): Promise<void> => {
    const trimmed = body.trim()
    if (!trimmed) {
      toast.error('Comment body is required.')
      return
    }
    try {
      const id = await create.mutateAsync({
        reviewer_step_id: reviewerStepId,
        body_md: trimmed,
      })
      setBody('')
      onSent?.(id)
    } catch (err) {
      toast.error('Could not post comment: ' + (err as Error).message)
    }
  }, [body, create, reviewerStepId, onSent])

  if (!canComment) {
    return (
      <div
        role="status"
        style={{
          padding: '10px 12px',
          backgroundColor: C.surface,
          border: `1px dashed ${C.borderSubtle}`,
          borderRadius: 6,
          fontSize: 11,
          color: C.ink3,
          fontFamily: FONT,
          fontStyle: 'italic',
        }}
      >
        Read-only — you don&apos;t have permission to post comments on this step.
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void send() }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 10,
        backgroundColor: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        fontFamily: FONT,
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            void send()
          }
        }}
        autoFocus={autoFocus}
        rows={3}
        placeholder="Add a comment to this reviewer step. ⌘+Enter to send."
        aria-label="Comment body"
        style={{
          padding: '8px 10px',
          border: 'none',
          borderRadius: 4,
          fontSize: 13,
          fontFamily: FONT,
          color: C.ink,
          backgroundColor: 'transparent',
          outline: 'none',
          resize: 'vertical',
          minHeight: 56,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: C.ink3 }}>
          ⌘+Enter to send · Phase 7c-2 wires TipTap + @-mentions + attachments
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="submit"
          disabled={create.isPending || body.trim().length === 0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            backgroundColor: create.isPending || body.trim().length === 0 ? '#F4D7BD' : C.brandOrange,
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: create.isPending || body.trim().length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: FONT,
          }}
        >
          <Send size={11} />
          {create.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  )
}

export default CommentComposer
