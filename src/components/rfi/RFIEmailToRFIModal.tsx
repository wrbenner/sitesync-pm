// ── RFIEmailToRFIModal ──────────────────────────────────────────────────
// P2b deliverable #5 — paste an email body, run it through the
// multi-pass Iris pipeline, surface the resulting draft for review.
//
// Two entry points (both land here):
//   1. The unmatched-inbound triage panel ("Convert to RFI" action).
//   2. Free-paste from anywhere via this modal.
//
// On accept, opens the draft preview which writes the actual RFI.
// PermissionGate wraps the trigger.

import React, { useState } from 'react'
import { Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '../Primitives'
import { PermissionGate } from '../auth/PermissionGate'
import { useCreateIrisRFIDraftV2 } from '../../hooks/queries/useIrisRFIDraftV2'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIEmailToRFIModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  onDraftReady: (draftId: string) => void
}

export const RFIEmailToRFIModal: React.FC<RFIEmailToRFIModalProps> = ({ open, onClose, projectId, onDraftReady }) => {
  const [body, setBody] = useState('')
  const createDraft = useCreateIrisRFIDraftV2()

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (trimmed.length < 20) {
      toast.error('Paste a longer email body (≥ 20 characters)')
      return
    }
    try {
      const { draftId } = await createDraft.mutateAsync({ projectId, description: trimmed })
      onDraftReady(draftId)
      setBody('')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not draft RFI')
    }
  }

  if (!open) return null

  return (
    <PermissionGate permission="rfis.create">
      <Modal open={open} onClose={onClose} title="Convert email to RFI" width="560px">
        <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            Paste an email below. Iris will extract the question(s), suggest a subject, related RFI, and ball-in-court.
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Paste email body here…"
            style={{
              padding: spacing['3'],
              fontSize: typography.fontSize.sm,
              fontFamily: 'inherit',
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              outline: 'none',
              resize: 'vertical',
              minHeight: 180,
              color: colors.textPrimary,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>
              <X size={13} /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createDraft.isPending}
              style={{ ...buttonBaseStyle, background: colors.primaryOrange, color: 'white' }}
            >
              <Send size={13} /> {createDraft.isPending ? 'Drafting…' : 'Run Iris draft'}
            </button>
          </div>
        </div>
      </Modal>
    </PermissionGate>
  )
}

const buttonBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  fontSize: typography.fontSize.caption,
  fontWeight: 600,
  border: 'none',
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  background: 'transparent',
  color: colors.textSecondary,
  border: `1px solid ${colors.borderSubtle}`,
}

export default RFIEmailToRFIModal
