import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'

interface DeleteAccountDialogProps {
  open: boolean
  onClose: () => void
}

const REQUIRED_CONFIRMATION = 'DELETE MY ACCOUNT'

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: colors.overlayDark,
  backdropFilter: 'blur(4px)',
  zIndex: zIndex.modal as number,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const contentStyle: React.CSSProperties = {
  width: 480,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: '90vh',
  overflowY: 'auto',
  backgroundColor: colors.white,
  borderRadius: borderRadius.xl,
  boxShadow: shadows.panel,
  padding: spacing['6'],
  position: 'relative',
  fontFamily: typography.fontFamily,
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({ open, onClose }) => {
  const [confirmation, setConfirmation] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const signOut = useAuthStore((s) => s.signOut)

  const isValid = confirmation === REQUIRED_CONFIRMATION

  const handleDelete = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation, reason: reason || undefined },
      })
      if (error) {
        const message = error.message || 'Failed to delete account'
        toast.error(message)
        setSubmitting(false)
        return
      }
      toast.success('Account deleted. Signing you out…')
      // Auth row is gone; clear local session.
      await signOut()
      // Force navigation to a clean state.
      window.location.replace('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account')
      setSubmitting(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitting) {
      setConfirmation('')
      setReason('')
      onClose()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle}>
          <Dialog.Content style={contentStyle} aria-describedby="delete-account-desc">
            <button
              onClick={onClose}
              disabled={submitting}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: spacing['3'],
                right: spacing['3'],
                background: 'transparent',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                color: colors.textTertiary,
                padding: spacing['1'],
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['4'] }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  backgroundColor: `${colors.statusCritical}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.statusCritical, flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <Dialog.Title
                style={{
                  margin: 0,
                  fontSize: typography.fontSize.lg,
                  fontWeight: typography.fontWeight.bold,
                  color: colors.textPrimary,
                }}
              >
                Delete your account?
              </Dialog.Title>
            </div>

            <Dialog.Description
              id="delete-account-desc"
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                lineHeight: 1.5,
                marginBottom: spacing['4'],
              }}
            >
              This permanently deletes your SiteSync account, profile, organization
              memberships, and personal preferences. Project data you contributed
              to (daily logs, RFIs, photos) is retained for the project record but
              your name will be removed. This action cannot be undone.
            </Dialog.Description>

            <ul
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.textSecondary,
                backgroundColor: colors.surfaceInset,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.lg,
                padding: spacing['3'],
                margin: 0,
                marginBottom: spacing['4'],
                listStyle: 'disc',
                paddingLeft: spacing['6'],
              }}
            >
              <li>You will be signed out of every device immediately.</li>
              <li>Your email becomes available for re-registration.</li>
              <li>If you are the sole admin of an organization, transfer ownership first or this will fail.</li>
            </ul>

            <label style={{ display: 'block', marginBottom: spacing['4'] }}>
              <span
                style={{
                  display: 'block',
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                  marginBottom: spacing['2'],
                }}
              >
                Type <span style={{ fontFamily: 'monospace', color: colors.statusCritical }}>{REQUIRED_CONFIRMATION}</span> to confirm
              </span>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={submitting}
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: '100%',
                  padding: `${spacing['3']} ${spacing['3']}`,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  backgroundColor: submitting ? colors.surfaceInset : colors.white,
                }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: spacing['5'] }}>
              <span
                style={{
                  display: 'block',
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                  marginBottom: spacing['2'],
                }}
              >
                Reason (optional)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                rows={3}
                maxLength={500}
                placeholder="Help us improve. This is anonymous."
                style={{
                  width: '100%',
                  padding: spacing['3'],
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  resize: 'vertical',
                  backgroundColor: submitting ? colors.surfaceInset : colors.white,
                }}
              />
            </label>

            <div
              style={{
                display: 'flex',
                gap: spacing['3'],
                // On phones, stack buttons vertically so the destructive
                // action is visible without scrolling. Cancel goes on top
                // (the safer reach), destructive on bottom (full-width,
                // intentional press required).
                flexDirection: 'column-reverse',
                // Sticky footer so the Delete CTA stays visible when warning
                // copy + confirmation field push the dialog past iPhone
                // height — without this the user only saw "Cancel" and the
                // primary button was clipped below the fold.
                position: 'sticky',
                bottom: -spacing['6'],
                marginLeft: -spacing['6'],
                marginRight: -spacing['6'],
                marginBottom: -spacing['6'],
                paddingLeft: spacing['6'],
                paddingRight: spacing['6'],
                paddingTop: spacing['4'],
                paddingBottom: `calc(${spacing['6']} + env(safe-area-inset-bottom, 0px))`,
                backgroundColor: colors.white,
                borderTop: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: `${spacing['3']} ${spacing['4']}`,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: borderRadius.lg,
                  backgroundColor: colors.white,
                  color: colors.textPrimary,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  minHeight: 56,
                  width: '100%',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!isValid || submitting}
                style={{
                  padding: `${spacing['3']} ${spacing['4']}`,
                  border: 'none',
                  borderRadius: borderRadius.lg,
                  backgroundColor: !isValid || submitting ? `${colors.statusCritical}80` : colors.statusCritical,
                  color: colors.white,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: !isValid || submitting ? 'not-allowed' : 'pointer',
                  minHeight: 56,
                  width: '100%',
                }}
              >
                {submitting ? 'Deleting…' : 'Permanently delete'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
