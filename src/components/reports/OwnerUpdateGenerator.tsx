import React, { useCallback, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Sparkles,
  Send,
  Copy as CopyIcon,
  Trash2,
  Loader2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { generateIrisDraft } from '../../services/iris'
import type { ProjectContextSnapshot } from '../../services/iris/types'
import type { StreamItem } from '../../types/stream'

// Iris brand color — DESIGN-RESET indigo accent.
const IRIS_INDIGO = '#4F46E5'
const IRIS_INDIGO_HOVER = '#4338CA'
const IRIS_INDIGO_TINT = '#EEF2FF'

const TRIGGER_ITEM_ID = 'iris-owner-update-trigger'

/**
 * Build the synthetic stream item that drives the Iris draft request.
 * Owner Update is on-demand only — there's no real stream record behind it,
 * but `generateIrisDraft` expects a StreamItem-shaped trigger so we make a
 * minimal one here.
 */
function buildTriggerItem(periodDays: number): StreamItem {
  return {
    id: TRIGGER_ITEM_ID,
    type: 'task',
    cardType: 'draft',
    title: 'Owner Update',
    reason: `On-demand owner update for the last ${periodDays} day${periodDays === 1 ? '' : 's'}`,
    urgency: 'medium',
    dueDate: null,
    assignedTo: null,
    waitingOnYou: false,
    overdue: false,
    createdAt: new Date().toISOString(),
    sourceData: null,
    sourceTrail: [],
    actions: [],
    irisEnhancement: {
      draftAvailable: true,
      draftType: 'owner_update',
      confidence: 0.5,
      summary: 'Draft owner update from project data',
    },
  }
}

interface OwnerUpdateGeneratorProps {
  /**
   * Snapshot of project data the template will use. The page is responsible
   * for assembling this — the component does not reach into stores itself,
   * so the same component can be unit-tested or reused with mock data.
   */
  context: ProjectContextSnapshot
  /**
   * Optional: persist the sent update somewhere (Supabase, audit log, etc.).
   * If absent, the "Send" button copies the body to the clipboard with a
   * toast — sufficient for the demo path.
   */
  onSend?: (body: string) => Promise<void> | void
  /**
   * Optional secondary action rendered below the Generate Update CTA.
   * Tab S mounts <OwnerLinkButton> here so the magic-link share lives
   * on the same card as the draft generator without restructuring.
   */
  secondaryAction?: React.ReactNode
}

/**
 * Top-of-page Iris card on /reports. Compact pitch + primary button. On
 * click, opens a modal with the editable draft preview, source citations,
 * confidence indicator, and Copy/Send/Discard actions.
 *
 * Iris rule: AI prepares, humans approve. The draft is labeled
 * "Iris drafted this — review before sending" prominently inside the modal.
 * No auto-send. No drafts on page load.
 */
export const OwnerUpdateGenerator: React.FC<OwnerUpdateGeneratorProps> = ({
  context,
  onSend,
  secondaryAction,
}) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [confidence, setConfidence] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const periodDays = context.reportingPeriodDays ?? 7

  const reset = useCallback(() => {
    setBody('')
    setSources([])
    setConfidence(null)
    setError(null)
    setLoading(false)
    setSending(false)
  }, [])

  const handleGenerate = useCallback(async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    try {
      const draft = await generateIrisDraft(buildTriggerItem(periodDays), context)
      setBody(draft.content)
      setSources(draft.sources)
      setConfidence(draft.confidence ?? 0.5)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Iris could not draft this update.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [context, periodDays])

  const handleCopy = useCallback(async () => {
    if (!body) return
    try {
      await navigator.clipboard.writeText(body)
      toast.success('Owner update copied to clipboard')
    } catch {
      toast.error('Could not copy — paste manually from the preview')
    }
  }, [body])

  const handleSend = useCallback(async () => {
    if (!body) return
    setSending(true)
    try {
      if (onSend) {
        await onSend(body)
        toast.success('Owner update sent')
      } else {
        // Fallback for the demo path — surface the message via clipboard.
        await navigator.clipboard.writeText(body)
        toast.success('Owner update copied — paste into your email and send')
      }
      setOpen(false)
      reset()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send owner update'
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }, [body, onSend, reset])

  const handleDiscard = useCallback(() => {
    setOpen(false)
    reset()
  }, [reset])

  const confidenceLabel = useMemo(() => {
    if (confidence == null) return ''
    if (confidence >= 0.75) return 'high'
    if (confidence >= 0.4) return 'medium'
    return 'low'
  }, [confidence])

  // ── Trigger card ─────────────────────────────────────────────────────────
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['1'],
          padding: spacing['5'],
          borderRadius: borderRadius.lg,
          border: `1px solid ${IRIS_INDIGO}25`,
          backgroundColor: IRIS_INDIGO_TINT,
          marginBottom: spacing['5'],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: borderRadius.md,
              backgroundColor: IRIS_INDIGO,
              color: colors.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <Sparkles size={20} strokeWidth={2.25} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                fontFamily: typography.fontFamily,
                marginBottom: 2,
              }}
            >
              Owner Update
            </div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                fontFamily: typography.fontFamily,
                lineHeight: 1.5,
              }}
            >
              Iris can prepare an owner update from the last {periodDays} days of project activity.
              You'll review before sending.
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['4']}`,
              backgroundColor: loading ? IRIS_INDIGO_HOVER : IRIS_INDIGO,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: loading ? 'wait' : 'pointer',
              flexShrink: 0,
            }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
            {loading ? 'Drafting…' : 'Generate Update'}
          </button>
        </div>
        {secondaryAction && (
          <div style={{ paddingLeft: 60 /* align under the description, not the icon */ }}>
            {secondaryAction}
          </div>
        )}
      </div>

      {/* ── Preview modal ──────────────────────────────────────────────── */}
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next && !sending) {
            setOpen(false)
            reset()
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 22, 41, 0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing['4'],
            }}
          >
            <Dialog.Content
              aria-describedby={undefined}
              style={{
                width: 'min(720px, 100%)',
                maxHeight: '90vh',
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                padding: spacing['5'],
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontFamily: typography.fontFamily,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: spacing['3'],
                }}
              >
                <div>
                  <Dialog.Title
                    style={{
                      margin: 0,
                      fontSize: typography.fontSize.subtitle,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    Owner Update — Preview
                  </Dialog.Title>
                  <div
                    role="status"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: spacing['1'],
                      padding: '2px 8px',
                      borderRadius: 999,
                      backgroundColor: IRIS_INDIGO_TINT,
                      color: IRIS_INDIGO,
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      letterSpacing: 0.2,
                    }}
                  >
                    <Sparkles size={11} strokeWidth={2.5} />
                    Iris drafted this — review before sending
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close preview"
                    disabled={sending}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: sending ? 'not-allowed' : 'pointer',
                      padding: spacing['1'],
                      borderRadius: borderRadius.sm,
                      color: colors.textTertiary,
                      display: 'flex',
                    }}
                  >
                    <X size={20} />
                  </button>
                </Dialog.Close>
              </div>

              {/* Body — editable textarea */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {loading && (
                  <div
                    style={{
                      flex: 1,
                      minHeight: 240,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.borderSubtle}`,
                      backgroundColor: colors.surfaceInset,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: spacing['2'],
                      color: colors.textSecondary,
                      fontSize: typography.fontSize.sm,
                    }}
                  >
                    <Loader2 size={20} color={IRIS_INDIGO} style={{ animation: 'spin 1s linear infinite' }} />
                    Iris is drafting from {periodDays} days of activity…
                  </div>
                )}

                {!loading && error && (
                  <div
                    role="alert"
                    style={{
                      flex: 1,
                      minHeight: 200,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.statusCritical}40`,
                      backgroundColor: `${colors.statusCritical}08`,
                      padding: spacing['4'],
                      color: colors.statusCritical,
                      fontSize: typography.fontSize.sm,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: spacing['2'],
                    }}
                  >
                    <strong>Iris couldn't draft this update.</strong>
                    <span style={{ color: colors.textSecondary }}>{error}</span>
                  </div>
                )}

                {!loading && !error && (
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    aria-label="Owner update draft"
                    style={{
                      flex: 1,
                      minHeight: 280,
                      maxHeight: '50vh',
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: spacing['3'],
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.md,
                      fontSize: typography.fontSize.body,
                      fontFamily: typography.fontFamily,
                      lineHeight: 1.55,
                      color: colors.textPrimary,
                      backgroundColor: colors.white,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                )}
              </div>

              {/* Source pill row */}
              {!loading && !error && sources.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing['2'],
                    flexWrap: 'wrap',
                    marginTop: spacing['3'],
                    paddingTop: spacing['3'],
                    borderTop: `1px solid ${colors.borderSubtle}`,
                  }}
                  aria-label="Sources Iris used"
                >
                  <span
                    style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textTertiary,
                      letterSpacing: typography.letterSpacing.wider,
                      textTransform: 'uppercase',
                      paddingTop: 4,
                    }}
                  >
                    Sources
                  </span>
                  {sources.map((s, i) => (
                    <span
                      key={`${s}-${i}`}
                      title={s}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 9px',
                        borderRadius: 999,
                        border: `1px solid ${colors.borderSubtle}`,
                        backgroundColor: colors.surfaceInset,
                        color: colors.textSecondary,
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        whiteSpace: 'nowrap',
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Confidence + footer actions */}
              {!loading && !error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: spacing['3'],
                    marginTop: spacing['3'],
                    paddingTop: spacing['3'],
                    borderTop: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: typography.fontSize.caption,
                      color: colors.textTertiary,
                    }}
                  >
                    Iris confidence: {confidenceLabel || '—'} — review before sending.
                  </span>
                  <div style={{ display: 'flex', gap: spacing['2'] }}>
                    <button
                      type="button"
                      onClick={handleDiscard}
                      disabled={sending}
                      style={ghostBtnStyle}
                    >
                      <Trash2 size={13} />
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={sending || !body}
                      style={secondaryBtnStyle}
                    >
                      <CopyIcon size={13} />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || !body}
                      style={primaryBtnStyle(sending)}
                    >
                      {sending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

// ── Local button styles ─────────────────────────────────────────────────────

const baseBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.semibold,
  borderRadius: borderRadius.md,
  cursor: 'pointer',
  border: '1px solid transparent',
}

const ghostBtnStyle: React.CSSProperties = {
  ...baseBtn,
  backgroundColor: 'transparent',
  color: colors.textSecondary,
  borderColor: colors.borderSubtle,
}

const secondaryBtnStyle: React.CSSProperties = {
  ...baseBtn,
  backgroundColor: colors.white,
  color: colors.textPrimary,
  borderColor: colors.borderDefault,
}

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  ...baseBtn,
  backgroundColor: disabled ? IRIS_INDIGO_HOVER : IRIS_INDIGO,
  color: colors.white,
  cursor: disabled ? 'wait' : 'pointer',
})
