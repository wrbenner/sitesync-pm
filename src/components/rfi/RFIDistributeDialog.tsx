// ── RFIDistributeDialog ─────────────────────────────────────────────
// Minimum-viable "Forward to sub" dialog for RFI Detail. P0 item #8 from
// RFI_MODULE_BUILD_SPEC.
//
// Flow: PM clicks "Distribute" → dialog with recipient email + optional
// note → submit writes to rfi_distributions (RLS-checked) → toast + close.
// Distribution rows feed the audit story and (in P1) the email-out
// pipeline. For P0 we don't actually send the email — the persisted
// row is the demonstrable contract.
//
// Permission gating lives at the call-site (button is wrapped in
// PermissionGate). This dialog assumes the caller has rfis.edit.

import React, { useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { Send, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { invalidateEntity } from '../../api/invalidation'
import { Modal } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useRFI, useProject } from '../../hooks/queries'
import { sendRFIOutboundEmail } from '../../lib/email/rfiOutbound'

interface RFIDistributeDialogProps {
  rfiId: string
  projectId: string
  rfiNumber?: string | number | null
  open: boolean
  onClose: () => void
}

// Email is the only required field; name + message are optional.
// We use a minimal validator here (Zod schema) so callers can't
// accidentally insert empty / malformed rows. Server-side CHECK
// constraint enforces non-empty as a backstop.
const distributeSchema = z.object({
  recipient_email: z.string().trim().email('Enter a valid email'),
  recipient_name: z.string().trim().max(100).optional(),
  message: z.string().trim().max(2000).optional(),
})

// DistributePayload type was inferred from distributeSchema in P0 — the
// P1c rewrite uses ForwardParams below which carries the inferred shape
// inline. Type kept for grep-ability but unused now.

// P1c — distribute now actually sends the email through the existing
// send-email edge function. The rfi_distributions row is the durable
// record AND the threading anchor; the helper sets `message_id` on
// insert so inbound replies thread back via In-Reply-To even when the
// sender's client doesn't preserve plus-tag.
interface ForwardParams {
  rfiId: string
  projectId: string
  recipient_email: string
  recipient_name?: string
  message?: string
  rfi: { id: string; number: number | null; title: string; question: string | null } | null
  project: { id: string; name: string | null } | null
}

function useForwardRFI() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (params: ForwardParams) => {
      const detailUrl = `${window.location.origin}/rfis/${params.rfiId}`
      const result = await sendRFIOutboundEmail({
        ctx: {
          rfiId: params.rfiId,
          projectId: params.projectId,
          rfiNumber: params.rfi?.number ?? null,
          rfiTitle: params.rfi?.title ?? 'RFI',
          rfiQuestion: params.rfi?.question ?? null,
          projectName: params.project?.name ?? null,
          detailUrl,
          senderUserId: user?.id ?? null,
          message: params.message ?? null,
        },
        recipient: { email: params.recipient_email, name: params.recipient_name ?? null },
      })
      if (!result.ok) {
        throw new Error(result.error ?? 'Distribution failed')
      }
      return { rfiId: params.rfiId, projectId: params.projectId }
    },
    onSuccess: ({ rfiId, projectId }) => {
      // Invalidate the entity history so the "Distributed to ..." event
      // shows up in the audit timeline within the 1-second contract.
      invalidateEntity('rfi', projectId)
      queryClient.invalidateQueries({ queryKey: ['rfi_distributions', rfiId] })
    },
  })
}

export const RFIDistributeDialog: React.FC<RFIDistributeDialogProps> = ({
  rfiId, projectId, rfiNumber, open, onClose,
}) => {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const forward = useForwardRFI()
  // RFI + project lookups for the email body. These are cached so the
  // dialog doesn't add network round-trips on open.
  const { data: rfi } = useRFI(rfiId)
  const { data: project } = useProject(projectId)
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
  const projectCtx = project
    ? { id: (project as { id: string }).id, name: (project as { name?: string | null }).name ?? null }
    : null

  const reset = () => {
    setEmail('')
    setName('')
    setMessage('')
    setError(null)
  }

  const handleClose = () => {
    if (forward.isPending) return
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = distributeSchema.safeParse({
      recipient_email: email,
      recipient_name: name || undefined,
      message: message || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    try {
      await forward.mutateAsync({
        rfiId,
        projectId,
        ...parsed.data,
        rfi: rfiCtx,
        project: projectCtx,
      })
      toast.success(`RFI${rfiNumber ? ` #${rfiNumber}` : ''} distributed to ${parsed.data.recipient_email}`)
      reset()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Distribution failed'
      setError(msg)
    }
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={handleClose} title={`Distribute RFI${rfiNumber ? ` #${rfiNumber}` : ''}`} width="520px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], padding: spacing['1'] }}>
        <Field label="Recipient email" htmlFor="rfi-distribute-email" required>
          <input
            id="rfi-distribute-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="architect@firm.com"
            autoFocus
            required
            style={inputStyle}
            disabled={forward.isPending}
          />
        </Field>
        <Field label="Recipient name (optional)" htmlFor="rfi-distribute-name">
          <input
            id="rfi-distribute-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tom Brown"
            maxLength={100}
            style={inputStyle}
            disabled={forward.isPending}
          />
        </Field>
        <Field label="Note (optional)" htmlFor="rfi-distribute-message">
          <textarea
            id="rfi-distribute-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Loop in MEP. Please review section 09 21 16."
            maxLength={2000}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
            disabled={forward.isPending}
          />
        </Field>
        {error && (
          <div role="alert" style={{ color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['2'] }}>
          {/* Native buttons here so the submit-on-Enter form contract works.
              Btn from Primitives doesn't expose `type`. */}
          <button
            type="button"
            onClick={handleClose}
            disabled={forward.isPending}
            style={{ ...buttonBaseStyle, background: 'transparent', color: colors.textSecondary }}
          >
            <X size={14} /> Cancel
          </button>
          <button
            type="submit"
            disabled={forward.isPending || !email}
            style={{ ...buttonBaseStyle, background: colors.primaryOrange, color: 'white', opacity: (forward.isPending || !email) ? 0.6 : 1 }}
          >
            <Send size={14} /> {forward.isPending ? 'Distributing…' : 'Distribute'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

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
  padding: '8px 12px',
  fontSize: typography.fontSize.sm,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceRaised,
  border: `1.5px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  outline: 'none',
  fontFamily: 'inherit',
}

const Field: React.FC<{ label: string; htmlFor?: string; required?: boolean; children: React.ReactNode }> = ({
  label, htmlFor, required, children,
}) => (
  <label htmlFor={htmlFor} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary }}>
      {label}{required && <span style={{ color: colors.statusCritical, marginLeft: 4 }}>*</span>}
    </span>
    {children}
  </label>
)

export default RFIDistributeDialog
