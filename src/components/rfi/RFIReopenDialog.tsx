/**
 * RFIReopenDialog — captures reopen reason + category before transitioning
 * a closed/answered RFI back to open.
 *
 * Procore prompts for a free-text reason on Reopen; SiteSync goes one step
 * further with a categorical enum (matches the new `reopen_category` CHECK
 * constraint from PR #350) — the UI nudges users toward the four buckets
 * the legal team needs for downstream chain-of-custody analysis:
 *
 *   - new_information      (RFI was answered, then conditions changed)
 *   - incorrect_answer     (the response turned out to be wrong)
 *   - change_in_scope      (drawing/spec revision invalidates the answer)
 *   - other                (free-text reason in `reopen_reason`)
 *
 * On submit:
 *   1. Update rfis.{reopen_reason, reopen_category}
 *   2. Trigger the Reopen state-machine transition (caller-supplied
 *      onReopen handler — typically calls into `handleTransition('Reopen')`
 *      on the detail page so the existing audit-aware path runs).
 *
 * Permission: caller is responsible for gating the trigger button. This
 * dialog assumes the caller already passed the rfis.edit gate.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, RotateCcw } from 'lucide-react'
import { useUpdateRFI } from '../../hooks/mutations/rfis'
import { colors, spacing, typography, zIndex } from '../../styles/theme'

type ReopenCategory = 'new_information' | 'incorrect_answer' | 'change_in_scope' | 'other'

interface Props {
  open: boolean
  onClose: () => void
  rfiId: string
  projectId: string
  rfiNumber?: number | null
  /**
   * Called after the reopen_reason + reopen_category have persisted. The
   * detail page wires this to the existing handleTransition('Reopen') so
   * the state-machine + audit_log path is preserved.
   */
  onReopen: () => Promise<void> | void
}

const CATEGORY_OPTIONS: ReadonlyArray<{ value: ReopenCategory; label: string; help: string }> = [
  {
    value: 'new_information',
    label: 'New information',
    help: 'Conditions changed after the RFI was closed; the original answer is now incomplete.',
  },
  {
    value: 'incorrect_answer',
    label: 'Incorrect answer',
    help: 'The response was wrong as given; the chain needs the correction recorded.',
  },
  {
    value: 'change_in_scope',
    label: 'Change in scope',
    help: 'Drawing or spec revision invalidated the prior answer.',
  },
  {
    value: 'other',
    label: 'Other',
    help: 'Free-text reason captured below; reviewer should categorise on follow-up.',
  },
]

export const RFIReopenDialog: React.FC<Props> = ({
  open,
  onClose,
  rfiId,
  projectId,
  rfiNumber = null,
  onReopen,
}) => {
  const [category, setCategory] = useState<ReopenCategory | ''>('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const updateRFI = useUpdateRFI()

  const reset = () => {
    setCategory('')
    setReason('')
    setSubmitting(false)
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const canSubmit = category !== '' && reason.trim().length >= 10 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await updateRFI.mutateAsync({
        id: rfiId,
        projectId,
        updates: {
          reopen_reason: reason.trim(),
          reopen_category: category,
        },
      })
      await onReopen()
      reset()
      onClose()
    } catch {
      // Caller surfaces toast via mutation onError; just leave the dialog
      // open so the user can retry.
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: zIndex.modal as number,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 520,
            backgroundColor: colors.surfaceRaised,
            borderRadius: 16,
            border: `1px solid ${colors.borderSubtle}`,
            boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${spacing['4']} ${spacing['5']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={16} style={{ color: colors.primaryOrange }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                }}
              >
                Reopen {rfiNumber != null ? `RFI-${String(rfiNumber).padStart(3, '0')}` : 'RFI'}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              aria-label="Cancel reopen"
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.textTertiary,
                cursor: submitting ? 'not-allowed' : 'pointer',
                padding: 4,
                display: 'inline-flex',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: spacing['5'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, lineHeight: 1.55 }}>
              Reopen captures the audit trail. Pick the category and write what changed — both fields are
              persisted onto the RFI record, then the state-machine transition fires.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Category{' '}
                <span style={{ color: colors.red }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${
                        category === opt.value ? colors.primaryOrange : colors.borderSubtle
                      }`,
                      backgroundColor: category === opt.value ? colors.orangeSubtle : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="rfi-reopen-category"
                      value={opt.value}
                      checked={category === opt.value}
                      onChange={() => setCategory(opt.value)}
                      style={{ marginTop: 3, accentColor: colors.primaryOrange }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                        }}
                      >
                        {opt.label}
                      </span>
                      <span style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 1.4 }}>
                        {opt.help}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="rfi-reopen-reason"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Reason <span style={{ color: colors.red }}>*</span>
                <span style={{ color: colors.textTertiary, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                  (10+ characters)
                </span>
              </label>
              <textarea
                id="rfi-reopen-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="What changed? Be specific. This lands in the audit chain."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 13,
                  color: colors.textPrimary,
                  backgroundColor: colors.surfaceInset,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 8,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: spacing['2'],
              padding: `${spacing['3']} ${spacing['5']}`,
              borderTop: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${colors.borderSubtle}`,
                backgroundColor: 'transparent',
                color: colors.textSecondary,
                fontSize: 13,
                fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: canSubmit ? colors.primaryOrange : colors.surfaceInset,
                color: canSubmit ? '#fff' : colors.textTertiary,
                fontSize: 13,
                fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Reopening…
                </>
              ) : (
                <>
                  <RotateCcw size={13} /> Reopen RFI
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default RFIReopenDialog
