// ─────────────────────────────────────────────────────────────────────────────
// IrisDraftDrawer — inline draft preview, the AI-prepares-humans-approve loop.
// ─────────────────────────────────────────────────────────────────────────────
// Triggered when the user clicks the "Draft" pill on a stream row or an Iris
// lane chip. Slides in from the right; loads via irisDraftStore.generateDraft
// (memoised by item.id); renders the actual draft content with explicit
// labelling, source pills, and Send / Edit / Dismiss buttons.
//
// "Iris drafted this — review before sending." — never just "AI". The text is
// editable in place. Send commits; Edit lets the user revise before commit;
// Dismiss closes without action. None of these auto-send anything to email
// or the wire — they update the in-memory store; the underlying mutation
// (e.g. send-email-to-vendor) is owned by feature pages.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, X, Send, Pencil, Check, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, typography, spacing, borderRadius } from '../../styles/theme'
import { useIrisDraftStore } from '../../stores/irisDraftStore'
import { useProject } from '../../hooks/queries'
import { useProjectId } from '../../hooks/useProjectId'
import { useAuth } from '../../hooks/useAuth'
import { useProfileNames, displayName as profileDisplayName } from '../../hooks/queries/profiles'
import type { StreamItem } from '../../types/stream'
import type { ProjectContextSnapshot } from '../../services/iris/types'

interface IrisDraftDrawerProps {
  item: StreamItem | null
  onClose: () => void
  /** Optional callback after the user clicks Send. Receives the final
   * (possibly-edited) draft text. Pages can wire this to their real send
   * pipeline (email, RFI response, etc.). */
  onSend?: (item: StreamItem, finalText: string) => void
}

const IRIS_INDIGO = '#4F46E5'

export const IrisDraftDrawer: React.FC<IrisDraftDrawerProps> = ({
  item,
  onClose,
  onSend,
}) => {
  const projectId = useProjectId()
  const { data: project } = useProject(projectId)
  const { user } = useAuth()

  const generate = useIrisDraftStore((s) => s.generateDraft)
  const reject = useIrisDraftStore((s) => s.rejectDraft)
  const clear = useIrisDraftStore((s) => s.clearDraft)
  const editStore = useIrisDraftStore((s) => s.editDraft)
  // Subscribe per project-scoped key so the drawer updates when its draft
  // lands and so the *same* itemId in a different project doesn't share state.
  const scopedKey = item ? `${projectId ?? '_'}:${item.id}` : null
  const draft = useIrisDraftStore((s) => (scopedKey ? s.drafts.get(scopedKey) : undefined))
  const isLoading = useIrisDraftStore((s) => (scopedKey ? s.loading.has(scopedKey) : false))

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Resolve assignedTo (likely a UUID) to a real profile name so the prompt
  // template can put a human's name in the greeting instead of a UUID — and
  // so the model never falls back to "[Recipient's Name]" placeholder text.
  const recipientLookupId = useMemo(() => {
    const raw = item?.assignedTo?.trim() ?? ''
    if (!raw) return null
    // Only run the profiles query for things that look like UUIDs. Free-text
    // role labels ("GC", "Architect") are passed straight through to the prompt.
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw : null
  }, [item?.assignedTo])

  const { data: profileMap } = useProfileNames(recipientLookupId ? [recipientLookupId] : [])

  const ctx: ProjectContextSnapshot = useMemo(() => {
    const userFullName =
      (user as { user_metadata?: { full_name?: string } } | null)?.user_metadata?.full_name ??
      (user as { email?: string } | null)?.email ??
      null

    // Recipient resolution priority:
    //   1. Resolved profile name (UUID → "Walker Benner")
    //   2. Free-text label that wasn't a UUID ("GC review")
    //   3. null — template opens with "Hey —" rather than fabricating a name
    let recipientName: string | null = null
    if (recipientLookupId) {
      const resolved = profileDisplayName(profileMap, recipientLookupId, '')
      if (resolved && resolved !== 'Unknown') recipientName = resolved
    } else if (item?.assignedTo) {
      recipientName = item.assignedTo
    }

    // Sender first name for casual sign-off. Same firstNameOf helper logic
    // (kept inline so this component doesn't depend on the templates module
    // for a one-line splitter).
    const userFirstName = userFullName
      ? (() => {
          const local = userFullName.split('@')[0]
          const head = local.split(/[\s._-]+/)[0]
          return head ? head.charAt(0).toUpperCase() + head.slice(1) : userFullName
        })()
      : null

    return {
      projectId: projectId ?? null,
      projectName: (project as { name?: string } | undefined)?.name ?? null,
      userName: userFullName,
      recipientName,
      userFirstName,
    }
  }, [projectId, project, user, item?.assignedTo, recipientLookupId, profileMap])

  // Trigger generation when the drawer opens (and only if no draft exists yet).
  useEffect(() => {
    if (!item) return
    if (!draft && !isLoading) {
      void generate(item, ctx)
    }
  }, [item, draft, isLoading, generate, ctx])

  // ESC closes; CMD+ENTER sends (when not editing); reset edit state on close.
  useEffect(() => {
    if (!item) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (draft && (draft.status === 'pending' || draft.status === 'edited')) {
          e.preventDefault()
          handleSend()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, draft])

  // Reset edit-mode when the item changes.
  useEffect(() => {
    setEditing(false)
    setEditValue('')
  }, [item?.id])

  function startEdit() {
    if (!draft) return
    setEditValue(draft.editedContent ?? draft.content)
    setEditing(true)
    // focus next tick
    queueMicrotask(() => textareaRef.current?.focus())
  }

  function commitEdit() {
    if (!item || !draft) return
    editStore(item.id, editValue, projectId)
    setEditing(false)
  }

  function handleSend() {
    if (!item || !draft) return
    const finalText = draft.editedContent ?? draft.content
    // Clear instead of approve: keeping an "approved" draft pinned in the
    // store makes the row look perpetually "sent" and prevents the user
    // from drafting a fresh reply on the same item later. Send is the
    // terminal action — the side-effect is owned by the destination page.
    clear(item.id, projectId)
    onSend?.(item, finalText)
    onClose()
  }

  function handleDismiss() {
    if (!item) return
    reject(item.id, projectId)
    onClose()
  }

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(26, 22, 19, 0.30)',
              zIndex: 90,
            }}
          />
          {/* Drawer */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Iris drafted reply"
            data-demo-step="iris-draft-stream"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(520px, 100vw)',
              background: colors.surfaceRaised,
              borderLeft: `1px solid ${colors.borderDefault}`,
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {/* Header */}
            <header
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: spacing[3],
                padding: `${spacing[4]} ${spacing[5]}`,
                borderBottom: `1px solid ${colors.borderDefault}`,
                background: 'rgba(79, 70, 229, 0.04)',
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: 'rgba(79, 70, 229, 0.10)',
                  color: IRIS_INDIGO,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <Sparkles size={16} strokeWidth={2} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: typography.fontFamily,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: IRIS_INDIGO,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    lineHeight: 1.2,
                  }}
                >
                  Iris drafted this · review before sending
                </h2>
                <span
                  style={{
                    fontFamily: typography.fontFamily,
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.ink,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close draft preview"
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: borderRadius.sm,
                  cursor: 'pointer',
                  color: colors.ink3,
                  flexShrink: 0,
                }}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </header>

            {/* Body */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `${spacing[4]} ${spacing[5]}` }}>
              {isLoading && !draft && <DraftLoading />}
              {draft?.error && <DraftError message={draft.error} />}
              {draft && !draft.error && (
                <>
                  {/* Confidence + sources */}
                  <DraftMeta confidence={item.irisEnhancement?.confidence ?? 0.7} sources={draft.sources} />

                  {/* Content */}
                  {editing ? (
                    <textarea
                      ref={textareaRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: 280,
                        padding: spacing[3],
                        fontFamily: typography.fontFamily,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: colors.ink,
                        background: colors.surfaceInset,
                        border: `1px solid ${colors.borderDefault}`,
                        borderRadius: borderRadius.md,
                        resize: 'vertical',
                      }}
                    />
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        padding: spacing[3],
                        background: colors.surfaceInset,
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.md,
                        fontFamily: typography.fontFamily,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: colors.ink,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {draft.editedContent ?? draft.content}
                    </pre>
                  )}
                </>
              )}
            </div>

            {/* Footer actions */}
            {draft && !draft.error && (
              <footer
                style={{
                  display: 'flex',
                  gap: spacing[2],
                  padding: `${spacing[3]} ${spacing[5]}`,
                  borderTop: `1px solid ${colors.borderDefault}`,
                  background: colors.surfaceFlat,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={handleDismiss}
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    background: 'transparent',
                    color: colors.ink3,
                    border: 'none',
                    fontFamily: typography.fontFamily,
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
                {editing ? (
                  <button
                    type="button"
                    onClick={commitEdit}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: `${spacing[2]} ${spacing[3]}`,
                      background: 'transparent',
                      color: colors.ink2,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.md,
                      fontFamily: typography.fontFamily,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <Check size={13} strokeWidth={2} />
                    Save edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startEdit}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: `${spacing[2]} ${spacing[3]}`,
                      background: 'transparent',
                      color: colors.ink2,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.md,
                      fontFamily: typography.fontFamily,
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <Pencil size={13} strokeWidth={2} />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSend}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: `${spacing[2]} ${spacing[4]}`,
                    background: colors.ink,
                    color: colors.parchment ?? '#FAF7F0',
                    border: 'none',
                    borderRadius: borderRadius.md,
                    fontFamily: typography.fontFamily,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Send size={13} strokeWidth={2} />
                  Send
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function DraftLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[2],
        padding: `${spacing[6]} 0`,
      }}
    >
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '13px',
          color: colors.ink3,
        }}
      >
        Iris is drafting…
      </span>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {[80, 95, 70, 88, 60].map((w, i) => (
          <span
            key={i}
            style={{
              display: 'block',
              height: 12,
              width: `${w}%`,
              background: colors.surfaceInset,
              borderRadius: 3,
              animation: 'iris-shimmer 1400ms ease-in-out infinite',
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
      <style>{`@keyframes iris-shimmer { 0%,100% { opacity: 0.5 } 50% { opacity: 0.85 } }`}</style>
    </div>
  )
}

function DraftError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: spacing[3],
        padding: spacing[4],
        background: 'rgba(201, 59, 59, 0.06)',
        border: `1px solid rgba(201, 59, 59, 0.20)`,
        borderRadius: borderRadius.md,
      }}
    >
      <AlertTriangle size={18} color="#C93B3B" strokeWidth={2} aria-hidden />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '13px',
            fontWeight: 600,
            color: '#C93B3B',
          }}
        >
          Iris couldn't draft this one
        </span>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '12px',
            color: colors.ink3,
          }}
        >
          {message}
        </span>
      </div>
    </div>
  )
}

function DraftMeta({ confidence, sources }: { confidence: number; sources: string[] }) {
  const pct = Math.round(confidence * 100)
  const tone =
    confidence >= 0.8 ? '#2D8A6E' : confidence >= 0.6 ? '#C4850C' : '#B8472E'
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: spacing[2],
        alignItems: 'center',
        padding: `${spacing[2]} 0 ${spacing[4]}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        marginBottom: spacing[4],
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          background: colors.surfaceInset,
          borderRadius: 999,
          fontFamily: typography.fontFamily,
          fontSize: '11px',
          fontWeight: 500,
          color: colors.ink2,
        }}
      >
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />
        Iris confidence {pct}%
      </span>
      {sources.length > 0 && (
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '11px',
            color: colors.ink3,
          }}
        >
          Drawn from {sources.join(' · ')}
        </span>
      )}
    </div>
  )
}

export default IrisDraftDrawer
