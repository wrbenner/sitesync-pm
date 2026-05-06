// ── RFIResponseComposer ─────────────────────────────────────────────────
// Bugatti-grade response composer that drives every P1b feature on the
// reply path:
//   • Response Type chip (P1b #6) — colored badge for the seven enum values
//   • Internal / External toggle (P1b #7) — sub roles can't see internal
//   • @-mention support (P1b #10) — typed `@` opens a member picker;
//     selected mentions render as chips and persist in `mentioned_user_ids`
//   • Cmd+Enter sends. Toggle row is keyboard-reachable.
//
// Persistence flows through `useCreateRFIResponseFull` so every send is
// audited (kind:response_create, mention count, is_internal).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Lock, Globe, AtSign, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCreateRFIResponseFull,
  RESPONSE_TYPES,
  type RFIResponseType,
} from '../../hooks/queries/useRFIResponses'
import { useProjectDirectory } from '../../hooks/queries/useProjectDirectory'
import { dispatchNotification } from '../../lib/notifications'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIResponseComposerProps {
  rfiId: string
  projectId: string
  rfiNumber?: number | null
}

interface MentionToken {
  userId: string
  display: string
}

export const RFIResponseComposer: React.FC<RFIResponseComposerProps> = ({
  rfiId,
  projectId,
  rfiNumber,
}) => {
  const create = useCreateRFIResponseFull()
  const { data: directory } = useProjectDirectory(projectId)

  const [text, setText] = useState('')
  const [responseType, setResponseType] = useState<RFIResponseType>('answered')
  const [isInternal, setIsInternal] = useState(false)
  const [mentions, setMentions] = useState<MentionToken[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const candidates = useMemo(() => {
    if (mentionQuery == null) return []
    const q = mentionQuery.toLowerCase()
    const all = directory?.members ?? []
    return all
      .filter((m) => !mentions.some((x) => x.userId === m.value))
      .filter((m) => m.label.toLowerCase().includes(q))
      .slice(0, 6)
  }, [mentionQuery, mentions, directory])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    setText(next)

    // Detect "@<query>" at the cursor — opens the picker.
    const cursor = e.target.selectionStart ?? next.length
    const before = next.slice(0, cursor)
    const match = before.match(/(?:^|\s)@(\w*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  const insertMention = useCallback(
    (userId: string, display: string) => {
      // Replace the trailing "@<query>" with "@display " and persist
      // the mention token.
      setText((prev) => {
        const replaced = prev.replace(/(^|\s)@(\w*)$/, (_, lead) => `${lead}@${display} `)
        return replaced
      })
      setMentions((m) => [...m, { userId, display }])
      setMentionQuery(null)
      window.requestAnimationFrame(() => textareaRef.current?.focus())
    },
    [],
  )

  const removeMention = (userId: string) => {
    setMentions((m) => m.filter((x) => x.userId !== userId))
  }

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      // Filter mentions to only those whose `@display` token is still in
      // the body. Removing the text removes the mention.
      const liveMentions = mentions.filter((m) => trimmed.includes(`@${m.display}`))

      await create.mutateAsync({
        rfiId,
        projectId,
        content: trimmed,
        responseType,
        isInternal,
        mentionedUserIds: liveMentions.map((m) => m.userId),
      })

      // Fan out @-mention notifications via the existing dispatcher.
      // Best-effort — failures don't block the send.
      const numberLabel = rfiNumber != null ? `RFI-${String(rfiNumber).padStart(3, '0')}` : 'RFI'
      await Promise.allSettled(
        liveMentions.map((m) =>
          dispatchNotification({
            event: 'mention',
            userId: m.userId,
            projectId,
            title: `${numberLabel} mention`,
            message: `You were mentioned: ${trimmed.slice(0, 200)}`,
            actionRoute: `/rfis/${rfiId}`,
            resourceId: rfiId,
            resourceUrl: `/rfis/${rfiId}`,
            severity: 'medium',
          }),
        ),
      )

      setText('')
      setMentions([])
      setMentionQuery(null)
      // Reset to defaults so the next reply starts fresh; users explicitly
      // opt into internal each time.
      setIsInternal(false)
      setResponseType('answered')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send response')
    } finally {
      setSending(false)
    }
  }, [text, mentions, sending, rfiId, projectId, responseType, isInternal, create, rfiNumber])

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [text])

  const internalBg = isInternal ? '#FFFBEB' : colors.surfaceInset
  const internalBorder = isInternal ? '#F59E0B' : colors.borderSubtle

  return (
    <div
      style={{
        borderTop: `1px solid ${colors.borderSubtle}`,
        backgroundColor: internalBg,
        padding: `${spacing['3']} ${spacing['4']}`,
        borderRadius: '0 0 16px 16px',
        transition: 'background-color 0.15s',
      }}
    >
      {isInternal && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
            fontSize: 11,
            fontWeight: 600,
            color: '#92400E',
            marginBottom: spacing['2'],
          }}
        >
          <Lock size={11} /> Internal — visible to GC team only
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          marginBottom: spacing['2'],
          flexWrap: 'wrap',
        }}
      >
        <select
          value={responseType}
          onChange={(e) => setResponseType(e.target.value as RFIResponseType)}
          aria-label="Response type"
          style={{
            padding: '4px 8px',
            fontSize: typography.fontSize.caption,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${internalBorder}`,
            borderRadius: borderRadius.sm,
            cursor: 'pointer',
          }}
        >
          {RESPONSE_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setIsInternal((v) => !v)}
          aria-pressed={isInternal}
          title={isInternal ? 'Switch to external reply' : 'Switch to internal note'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            fontSize: typography.fontSize.caption,
            fontWeight: 500,
            color: isInternal ? '#92400E' : colors.textTertiary,
            backgroundColor: isInternal ? '#FEF3C7' : 'transparent',
            border: `1px solid ${isInternal ? '#F59E0B' : colors.borderSubtle}`,
            borderRadius: borderRadius.sm,
            cursor: 'pointer',
          }}
        >
          {isInternal ? <Lock size={11} /> : <Globe size={11} />}
          {isInternal ? 'Internal Note' : 'External Reply'}
        </button>

        {mentions.length > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {mentions.map((m) => (
              <span
                key={m.userId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 10,
                  backgroundColor: colors.orangeSubtle,
                  color: colors.primaryOrange,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <AtSign size={10} /> {m.display}
                <button
                  type="button"
                  onClick={() => removeMention(m.userId)}
                  aria-label={`Remove mention of ${m.display}`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.primaryOrange,
                    padding: 0,
                    marginLeft: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder={
            isInternal
              ? 'Write an internal note… (⌘+Enter to send)'
              : 'Write a response… (⌘+Enter to send, type @ to mention)'
          }
          rows={1}
          aria-label={isInternal ? 'Internal note' : 'External reply'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void handleSend()
            } else if (e.key === 'Escape' && mentionQuery != null) {
              setMentionQuery(null)
            }
          }}
          style={{
            width: '100%',
            padding: '11px 50px 11px 14px',
            fontSize: 14,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceRaised,
            border: `1.5px solid ${internalBorder}`,
            borderRadius: 12,
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            minHeight: 44,
            maxHeight: 220,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          title="Send (⌘+Enter)"
          aria-label="Send response"
          style={{
            position: 'absolute',
            right: 6,
            bottom: 6,
            width: 36,
            height: 36,
            borderRadius: 12,
            border: 'none',
            backgroundColor: text.trim() && !sending ? colors.primaryOrange : colors.surfaceDisabled,
            color: text.trim() && !sending ? colors.white : colors.textDisabled,
            cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          <Send size={14} />
        </button>

        {/* Mention picker */}
        {mentionQuery != null && candidates.length > 0 && (
          <ul
            role="listbox"
            aria-label="Mention suggestions"
            style={{
              position: 'absolute',
              left: 8,
              bottom: '100%',
              marginBottom: 4,
              listStyle: 'none',
              padding: 4,
              minWidth: 220,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 10,
            }}
          >
            {candidates.map((c) => (
              <li key={c.value} role="option">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertMention(c.value, c.label)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: `${spacing['1']} ${spacing['2']}`,
                    border: 'none',
                    borderRadius: borderRadius.sm,
                    background: 'transparent',
                    color: colors.textPrimary,
                    fontSize: typography.fontSize.sm,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <AtSign size={11} style={{ color: colors.primaryOrange }} />
                  <span>{c.label}</span>
                  {c.sublabel && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: colors.textTertiary }}>
                      {c.sublabel}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default RFIResponseComposer
