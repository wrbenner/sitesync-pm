// ── RFIDistributeDialog (rebuilt) ───────────────────────────────────────
// Procore-grade composer for distributing an RFI to N recipients.
//
// Replaces the prior 1-recipient + 1-message dialog with:
//   • Recipient chip editor (one chip per email)
//   • Per-chip role pill (rfi_notification_recipient_role enum)
//   • Per-chip needs-response-by date
//   • Per-chip distribution_kind toggle (To / Cc / Bcc)
//   • Attachment picker (checkbox list over rfi_attachments)
//   • Rich-text body (TipTap via RFIRichTextEditor)
//
// Submit fans out one rfi_distributions row per chip via the existing
// sendRFIOutboundEmail helper; the helper now persists the per-chip
// columns introduced in the info-density schema migration (PR #376).
//
// Permission gating is at the call-site (button wraps in PermissionGate).

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { Send, X, Plus, Paperclip } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { invalidateEntity } from '../../api/invalidation'
import { Modal } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useRFI } from '../../hooks/queries/rfis'
import { useRFIAttachments, type RFIAttachment } from '../../hooks/queries/useRFIAttachments'
import {
  sendRFIOutboundEmail,
  type RFIOutboundRecipient,
  type RFIOutboundResult,
} from '../../lib/email/rfiOutbound'
import { RFIRichTextEditor } from './RFIRichTextEditor'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'

interface RFIDistributeDialogProps {
  rfiId: string
  projectId: string
  rfiNumber?: string | number | null
  open: boolean
  onClose: () => void
}

type DistributionKind = 'to' | 'cc' | 'bcc'
type RecipientRole = 'creator' | 'manager' | 'assignee' | 'distribution_group' | 'watcher'

const ROLE_LABELS: Readonly<Record<RecipientRole, string>> = {
  creator: 'Originator',
  manager: 'PM',
  assignee: 'Assignee',
  distribution_group: 'Distribution',
  watcher: 'Watcher',
}

interface RecipientChip {
  /** Local UUID (crypto.randomUUID) — chip is keyed off this, not email. */
  cid: string
  email: string
  name: string
  role: RecipientRole | ''
  needsBy: string
  kind: DistributionKind
}

const emailSchema = z.string().trim().email()

const newChip = (email = '', name = ''): RecipientChip => ({
  cid: crypto.randomUUID(),
  email,
  name,
  role: '',
  needsBy: '',
  kind: 'to',
})

interface FanoutParams {
  rfiId: string
  projectId: string
  recipients: RFIOutboundRecipient[]
  message: string | null
  rfi: { id: string; number: number | null; title: string; question: string | null } | null
  project: { id: string; name: string | null } | null
}

function useDistributeFanout() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (params: FanoutParams) => {
      const detailUrl = `${window.location.origin}/rfis/${params.rfiId}`
      const ctx = {
        rfiId: params.rfiId,
        projectId: params.projectId,
        rfiNumber: params.rfi?.number ?? null,
        rfiTitle: params.rfi?.title ?? 'RFI',
        rfiQuestion: params.rfi?.question ?? null,
        projectName: params.project?.name ?? null,
        detailUrl,
        senderUserId: user?.id ?? null,
        message: params.message,
      }
      const results = await Promise.allSettled(
        params.recipients.map((r) => sendRFIOutboundEmail({ ctx, recipient: r })),
      )
      const ok: RFIOutboundResult[] = []
      const errors: string[] = []
      results.forEach((res, idx) => {
        const recipientEmail = params.recipients[idx]?.email ?? '(unknown)'
        if (res.status === 'fulfilled' && res.value.ok) {
          ok.push(res.value)
        } else if (res.status === 'fulfilled') {
          errors.push(`${recipientEmail}: ${res.value.error ?? 'failed'}`)
        } else {
          const reason =
            res.reason instanceof Error ? res.reason.message : String(res.reason)
          errors.push(`${recipientEmail}: ${reason}`)
        }
      })
      return { ok, errors }
    },
    onSuccess: () => {
      invalidateEntity('rfi', '')
      queryClient.invalidateQueries({ queryKey: ['rfi_distributions'] })
    },
  })
}

export const RFIDistributeDialog: React.FC<RFIDistributeDialogProps> = ({
  rfiId,
  projectId,
  rfiNumber,
  open,
  onClose,
}) => {
  const fanout = useDistributeFanout()
  const { data: rfi } = useRFI(rfiId)
  const { data: attachments = [] } = useRFIAttachments(open ? rfiId : undefined)

  // Project lookup — used for email body context. Loose typing because
  // the query helper returns unknown rows.
  const [projectName, setProjectName] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const { data } = await fromTable('projects')
        .select('name')
        .eq('id' as never, projectId)
        .single()
      if (!cancelled) {
        setProjectName(((data as { name?: string | null } | null)?.name ?? null))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  const [chips, setChips] = useState<RecipientChip[]>([newChip()])
  const [bodyHtml, setBodyHtml] = useState('')
  const [pickedAttachmentIds, setPickedAttachmentIds] = useState<Set<string>>(new Set())
  const [submitError, setSubmitError] = useState<string | null>(null)
  const draftFocusRef = useRef<HTMLInputElement | null>(null)

  // Pre-fill recipient chips from project_rfi_settings.default_distribution
  // on first open. The settings table holds an array of email-or-userId
  // entries; resolve emails via supabase auth lookup later — for now we
  // accept email-shaped strings and let admins type the rest.
  const [hasPrefilled, setHasPrefilled] = useState(false)
  useEffect(() => {
    if (!open || hasPrefilled) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await fromTable('project_rfi_settings')
          .select('default_distribution')
          .eq('project_id' as never, projectId)
          .single()
        if (cancelled) return
        const raw = (data as { default_distribution?: unknown } | null)?.default_distribution
        if (!Array.isArray(raw) || raw.length === 0) {
          setHasPrefilled(true)
          return
        }
        const emails = raw
          .map((row) => {
            if (typeof row === 'string') return row
            if (row && typeof row === 'object') {
              const r = row as { email?: unknown }
              return typeof r.email === 'string' ? r.email : null
            }
            return null
          })
          .filter((e): e is string => !!e && emailSchema.safeParse(e).success)
        if (emails.length > 0) {
          setChips(emails.map((e) => newChip(e)))
        }
      } catch {
        // Settings might not exist yet — non-blocking.
      } finally {
        if (!cancelled) setHasPrefilled(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId, hasPrefilled])

  const reset = () => {
    setChips([newChip()])
    setBodyHtml('')
    setPickedAttachmentIds(new Set())
    setSubmitError(null)
    setHasPrefilled(false)
  }

  const handleClose = () => {
    if (fanout.isPending) return
    reset()
    onClose()
  }

  const updateChip = (cid: string, patch: Partial<RecipientChip>) => {
    setChips((prev) => prev.map((c) => (c.cid === cid ? { ...c, ...patch } : c)))
  }

  const removeChip = (cid: string) => {
    setChips((prev) => (prev.length > 1 ? prev.filter((c) => c.cid !== cid) : prev))
  }

  const addChip = () => {
    const next = newChip()
    setChips((prev) => [...prev, next])
    setTimeout(() => draftFocusRef.current?.focus(), 50)
  }

  const validRecipients: RFIOutboundRecipient[] = useMemo(() => {
    return chips
      .filter((c) => emailSchema.safeParse(c.email).success)
      .map((c) => ({
        email: c.email.trim(),
        name: c.name.trim() || null,
        recipient_role: c.role || null,
        needs_response_by: c.needsBy || null,
        distribution_kind: c.kind,
        attachment_ids: Array.from(pickedAttachmentIds),
      }))
  }, [chips, pickedAttachmentIds])

  const canSubmit = validRecipients.length > 0 && !fanout.isPending

  const toggleAttachment = (id: string) => {
    setPickedAttachmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Build the plain-text/HTML message context. RFIRichTextEditor produces
  // sanitized HTML via TipTap's schema — safe to pass to the email.
  const messageForEmail = useMemo(() => {
    const trimmed = bodyHtml.replace(/<p><\/p>/g, '').trim()
    return trimmed.length > 0 ? trimmed : null
  }, [bodyHtml])

  const rfiCtx = rfi
    ? {
        id: (rfi as { id: string }).id,
        number: (rfi as { number?: number | null }).number ?? null,
        title: (rfi as { title?: string }).title ?? 'RFI',
        question:
          (rfi as { question?: string | null }).question ??
          (rfi as { description?: string | null }).description ??
          null,
      }
    : null

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitError(null)
    try {
      const result = await fanout.mutateAsync({
        rfiId,
        projectId,
        recipients: validRecipients,
        message: messageForEmail,
        rfi: rfiCtx,
        project: { id: projectId, name: projectName },
      })
      if (result.errors.length > 0 && result.ok.length === 0) {
        setSubmitError(`All ${result.errors.length} send(s) failed. ${result.errors[0]}`)
        return
      }
      const num = rfiNumber ? ` #${rfiNumber}` : ''
      if (result.errors.length === 0) {
        toast.success(`RFI${num} distributed to ${result.ok.length} recipient${result.ok.length === 1 ? '' : 's'}`)
      } else {
        toast.warning(
          `RFI${num} sent to ${result.ok.length}/${result.ok.length + result.errors.length}; ${result.errors.length} failed`,
        )
      }
      reset()
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Distribution failed')
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Distribute RFI${rfiNumber ? ` #${rfiNumber}` : ''}`}
      width="640px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'], padding: spacing['1'] }}>
        {/* Recipient chips */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          <Label>Recipients</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chips.map((chip, idx) => (
              <ChipRow
                key={chip.cid}
                chip={chip}
                inputRef={idx === chips.length - 1 ? draftFocusRef : null}
                onUpdate={(patch) => updateChip(chip.cid, patch)}
                onRemove={() => removeChip(chip.cid)}
                canRemove={chips.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={addChip}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: borderRadius.base,
                border: `1px dashed ${colors.borderSubtle}`,
                background: 'transparent',
                color: colors.textSecondary,
                fontSize: typography.fontSize.sm,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} /> Add recipient
            </button>
          </div>
        </section>

        {/* Attachments picker */}
        {attachments.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            <Label>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Paperclip size={12} /> Attachments
              </span>
            </Label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                maxHeight: 160,
                overflowY: 'auto',
                padding: spacing['2'],
                backgroundColor: colors.surfaceInset,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.base,
              }}
            >
              {attachments.map((att: RFIAttachment) => (
                <label
                  key={att.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 6px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pickedAttachmentIds.has(att.id)}
                    onChange={() => toggleAttachment(att.id)}
                    style={{ accentColor: colors.primaryOrange }}
                  />
                  <span style={{ flex: 1, fontSize: 12, color: colors.textPrimary }}>
                    {att.filename}
                  </span>
                  {att.size_bytes != null && (
                    <span style={{ fontSize: 11, color: colors.textTertiary }}>
                      {Math.round(att.size_bytes / 1024)} KB
                    </span>
                  )}
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Message body */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          <Label>Message</Label>
          <RFIRichTextEditor
            value={bodyHtml}
            onChange={setBodyHtml}
            placeholder="Add a note to the recipients (optional). Markdown / formatting supported."
            ariaLabel="Distribution message body"
            minHeight={120}
          />
        </section>

        {submitError && (
          <div
            role="alert"
            style={{
              padding: '8px 12px',
              fontSize: typography.fontSize.sm,
              color: colors.red,
              backgroundColor: colors.surfaceInset,
              border: `1px solid ${colors.red}`,
              borderRadius: borderRadius.base,
            }}
          >
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: spacing['2'],
            marginTop: spacing['2'],
          }}
        >
          <span style={{ fontSize: 11, color: colors.textTertiary }}>
            {validRecipients.length} valid recipient{validRecipients.length === 1 ? '' : 's'} ·{' '}
            {pickedAttachmentIds.size} attachment{pickedAttachmentIds.size === 1 ? '' : 's'}
          </span>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={fanout.isPending}
              style={{ ...buttonBaseStyle, background: 'transparent', color: colors.textSecondary }}
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              style={{
                ...buttonBaseStyle,
                background: canSubmit ? colors.primaryOrange : colors.surfaceInset,
                color: canSubmit ? '#fff' : colors.textTertiary,
                opacity: canSubmit ? 1 : 0.7,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={14} /> {fanout.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

interface ChipRowProps {
  chip: RecipientChip
  inputRef: React.MutableRefObject<HTMLInputElement | null> | null
  onUpdate: (patch: Partial<RecipientChip>) => void
  onRemove: () => void
  canRemove: boolean
}

const ChipRow: React.FC<ChipRowProps> = ({ chip, inputRef, onUpdate, onRemove, canRemove }) => {
  const isValidEmail = chip.email.length === 0 || emailSchema.safeParse(chip.email).success

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 200px 130px 120px 30px',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <input
        ref={inputRef}
        type="email"
        value={chip.email}
        onChange={(e) => onUpdate({ email: e.target.value })}
        placeholder="recipient@firm.com"
        style={{
          ...inputStyle,
          borderColor: isValidEmail ? colors.borderSubtle : colors.red,
        }}
      />
      <input
        type="text"
        value={chip.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder="Name (optional)"
        style={inputStyle}
      />
      <select
        value={chip.role}
        onChange={(e) => onUpdate({ role: e.target.value as RecipientRole | '' })}
        style={inputStyle}
        aria-label="Recipient role"
      >
        <option value="">Role…</option>
        {(Object.keys(ROLE_LABELS) as RecipientRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={chip.needsBy}
        onChange={(e) => onUpdate({ needsBy: e.target.value })}
        style={inputStyle}
        aria-label="Needs response by"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Remove recipient"
        style={{
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: 6,
          background: 'transparent',
          color: canRemove ? colors.textTertiary : colors.borderSubtle,
          cursor: canRemove ? 'pointer' : 'not-allowed',
        }}
      >
        <X size={14} />
      </button>
      {/* Second row — distribution_kind toggle pills (To / Cc / Bcc) */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'inline-flex',
          gap: 4,
          paddingTop: 2,
          paddingBottom: 4,
          borderBottom: `1px dashed ${colors.borderSubtle}`,
        }}
      >
        {(['to', 'cc', 'bcc'] as DistributionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onUpdate({ kind: k })}
            style={{
              padding: '2px 10px',
              borderRadius: 999,
              border: `1px solid ${chip.kind === k ? colors.primaryOrange : colors.borderSubtle}`,
              backgroundColor: chip.kind === k ? colors.orangeSubtle : 'transparent',
              color: chip.kind === k ? colors.orangeText : colors.textTertiary,
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 600,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}
  >
    {children}
  </span>
)

const buttonBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.semibold,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: typography.fontSize.sm,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

// `supabase` import retained for future spec lookup; explicit reference
// keeps tree-shaking honest.
void supabase

export default RFIDistributeDialog
