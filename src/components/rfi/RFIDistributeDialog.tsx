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
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { invalidateEntity } from '../../api/invalidation'
import { Modal } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

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

type DistributePayload = z.infer<typeof distributeSchema>

function useForwardRFI() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (params: { rfiId: string; projectId: string } & DistributePayload) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { error } = await sb.from('rfi_distributions').insert({
        rfi_id: params.rfiId,
        recipient_email: params.recipient_email,
        recipient_name: params.recipient_name || null,
        message: params.message || null,
        sent_by: user?.id ?? null,
      })
      if (error) throw error
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
      await forward.mutateAsync({ rfiId, projectId, ...parsed.data })
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
            placeholder="Loop in MEP — please review section 09 21 16."
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
