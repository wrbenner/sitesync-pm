/**
 * RFICloseDialog — captures Procore-grade close metadata before flipping
 * status to 'closed'.
 *
 * Procore's Close action records: disposition (the architect/engineer's
 * decision label), the response that is the official answer, a free-text
 * summary for the audit chain, the actual schedule + cost impact, and the
 * signoff user. SiteSync mirrors all six and stores them on the rfis row
 * via the columns introduced in `20260510010000_rfi_information_density`.
 *
 * On submit:
 *   1. UPDATE rfis SET
 *        status                  = 'closed',
 *        closed_disposition      = <enum>,
 *        closed_summary          = <text>,
 *        final_response_id       = <uuid | null>,
 *        schedule_actual_days    = <int | null>,
 *        cost_actual_cents       = <bigint | null>,
 *        closed_signoff_user_id  = <uuid>
 *   2. The existing audit-log trigger captures the close in one row.
 *
 * Permission: caller is responsible for gating the trigger button. This
 * dialog assumes the caller already passed `rfis.edit`.
 */

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { useUpdateRFI } from '../../hooks/mutations/rfis'
import { useRFIResponsesList } from '../../hooks/queries/useRFIResponses'
import { useAuth } from '../../hooks/useAuth'
import { dollarsToCents } from '../../types/money'
import { colors, spacing, typography, zIndex } from '../../styles/theme'

type CloseDisposition =
  | 'approved'
  | 'approved_as_noted'
  | 'revise_and_resubmit'
  | 'returned_for_clarification'
  | 'no_comment'
  | 'forwarded'

interface Props {
  open: boolean
  onClose: () => void
  rfiId: string
  projectId: string
  rfiNumber?: number | null
  /** Whether the RFI claims schedule impact (drives schedule-actual visibility). */
  scheduleImpactStatus: string | null
  /** Whether the RFI claims cost impact (drives cost-actual visibility). */
  costImpactStatus: string | null
  /** Called after status flip succeeds — caller refetches detail data. */
  onClosed?: () => void | Promise<void>
}

const DISPOSITION_OPTIONS: ReadonlyArray<{
  value: CloseDisposition
  label: string
  help: string
}> = [
  {
    value: 'approved',
    label: 'Approved',
    help: 'The proposed approach / question is accepted as-is.',
  },
  {
    value: 'approved_as_noted',
    label: 'Approved as Noted',
    help: 'Accepted with adjustments captured in the final response.',
  },
  {
    value: 'revise_and_resubmit',
    label: 'Revise and Resubmit',
    help: 'Cannot approve in current form; revise and submit a new RFI.',
  },
  {
    value: 'returned_for_clarification',
    label: 'Returned for Clarification',
    help: 'Question is unclear or incomplete; clarify and resubmit.',
  },
  {
    value: 'no_comment',
    label: 'No Comment',
    help: 'Not within the responder’s scope to comment on.',
  },
  {
    value: 'forwarded',
    label: 'Forwarded',
    help: 'Routed to a different responsible party (track in linked RFIs).',
  },
]

export const RFICloseDialog: React.FC<Props> = ({
  open,
  onClose,
  rfiId,
  projectId,
  rfiNumber = null,
  scheduleImpactStatus,
  costImpactStatus,
  onClosed,
}) => {
  const { user } = useAuth()
  const updateRFI = useUpdateRFI()
  const { data: responses = [] } = useRFIResponsesList(open ? rfiId : '')

  const [disposition, setDisposition] = useState<CloseDisposition | ''>('')
  const [summary, setSummary] = useState('')
  const [finalResponseId, setFinalResponseId] = useState<string | null>(null)
  const [scheduleActual, setScheduleActual] = useState('')
  const [costActual, setCostActual] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showSchedule = scheduleImpactStatus === 'yes'
  const showCost = costImpactStatus === 'yes'

  const visibleResponses = useMemo(
    () => responses.filter((r) => !r.deleted_at && !r.is_internal),
    [responses],
  )

  const reset = () => {
    setDisposition('')
    setSummary('')
    setFinalResponseId(null)
    setScheduleActual('')
    setCostActual('')
    setSubmitting(false)
    setError(null)
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const summaryOk = summary.trim().length >= 20
  const canSubmit =
    disposition !== '' &&
    summaryOk &&
    !submitting &&
    user?.id != null

  const handleSubmit = async () => {
    if (!canSubmit) return
    const dispositionValue: CloseDisposition = disposition as CloseDisposition
    setSubmitting(true)
    setError(null)

    const updates: Record<string, unknown> = {
      status: 'closed',
      closed_disposition: dispositionValue,
      closed_summary: summary.trim(),
      final_response_id: finalResponseId,
      closed_signoff_user_id: user!.id,
      closed_at: new Date().toISOString(),
    }
    if (showSchedule && scheduleActual.trim() !== '') {
      const days = Number.parseInt(scheduleActual.trim(), 10)
      updates.schedule_actual_days = Number.isFinite(days) ? days : null
    }
    if (showCost && costActual.trim() !== '') {
      const dollars = Number.parseFloat(costActual.trim())
      updates.cost_actual_cents = Number.isFinite(dollars)
        ? dollarsToCents(dollars)
        : null
    }

    try {
      await updateRFI.mutateAsync({ id: rfiId, projectId, updates })
      if (onClosed) await onClosed()
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close RFI.')
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
            maxWidth: 580,
            maxHeight: 'calc(100vh - 32px)',
            backgroundColor: colors.surfaceRaised,
            borderRadius: 16,
            border: `1px solid ${colors.borderSubtle}`,
            boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
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
              <CheckCircle2 size={16} style={{ color: colors.primaryOrange }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                }}
              >
                Close {rfiNumber != null ? `RFI-${String(rfiNumber).padStart(3, '0')}` : 'RFI'}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              aria-label="Cancel close"
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

          {/* Body — scrollable so 6 fields don't blow the modal height */}
          <div
            style={{
              padding: spacing['5'],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['4'],
              overflowY: 'auto',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: colors.textSecondary,
                lineHeight: 1.55,
              }}
            >
              Closing captures the audit trail. Disposition, summary, and the
              chosen final response all land in the row + audit chain.
            </p>

            {/* Disposition */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <FieldLabel required>Disposition</FieldLabel>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                {DISPOSITION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    aria-label={opt.label}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${
                        disposition === opt.value ? colors.primaryOrange : colors.borderSubtle
                      }`,
                      backgroundColor:
                        disposition === opt.value ? colors.orangeSubtle : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="rfi-close-disposition"
                      value={opt.value}
                      checked={disposition === opt.value}
                      onChange={() => setDisposition(opt.value)}
                      style={{ marginTop: 3, accentColor: colors.primaryOrange }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                        }}
                      >
                        {opt.label}
                      </span>
                      <span style={{ fontSize: 10.5, color: colors.textTertiary, lineHeight: 1.35 }}>
                        {opt.help}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Final Response */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <FieldLabel>Final response (which one is the answer?)</FieldLabel>
              {visibleResponses.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: colors.textTertiary,
                    backgroundColor: colors.surfaceInset,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: 8,
                    fontStyle: 'italic',
                  }}
                >
                  No responses yet. Closing without a linked response is allowed but
                  noted in the audit chain.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                  {visibleResponses.map((r) => {
                    const isPicked = finalResponseId === r.id
                    const preview =
                      r.content.length > 140 ? `${r.content.slice(0, 140)}…` : r.content
                    return (
                      <label
                        key={r.id}
                        aria-label={preview}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${
                            isPicked ? colors.primaryOrange : colors.borderSubtle
                          }`,
                          backgroundColor: isPicked ? colors.orangeSubtle : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name="rfi-close-final-response"
                          checked={isPicked}
                          onChange={() =>
                            setFinalResponseId((prev) => (prev === r.id ? null : r.id))
                          }
                          style={{ marginTop: 3, accentColor: colors.primaryOrange }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                          <span style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 1.4 }}>
                            {preview}
                          </span>
                          <span style={{ fontSize: 10.5, color: colors.textTertiary }}>
                            {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <FieldLabel required>
                Summary{' '}
                <span style={{ color: colors.textTertiary, marginLeft: 6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  (20+ characters — the audit-chain narrative)
                </span>
              </FieldLabel>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="What got decided? Capture the reasoning so future readers (and counsel) understand why."
                style={textAreaStyle}
              />
              <span
                style={{
                  fontSize: 11,
                  color: summaryOk ? colors.green : colors.textTertiary,
                  alignSelf: 'flex-end',
                }}
              >
                {summary.trim().length}/20 chars
              </span>
            </div>

            {/* Schedule actual */}
            {showSchedule && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <FieldLabel>Schedule actual (days)</FieldLabel>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={scheduleActual}
                  onChange={(e) => setScheduleActual(e.target.value)}
                  placeholder="Days the answer cost the schedule"
                  style={inputStyle}
                />
              </div>
            )}

            {/* Cost actual */}
            {showCost && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <FieldLabel>Cost actual ($)</FieldLabel>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={costActual}
                  onChange={(e) => setCostActual(e.target.value)}
                  placeholder="Actual cost impact in dollars"
                  style={inputStyle}
                />
              </div>
            )}

            {error && (
              <p
                role="alert"
                style={{
                  margin: 0,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: colors.red,
                  backgroundColor: colors.surfaceInset,
                  border: `1px solid ${colors.red}`,
                  borderRadius: 8,
                }}
              >
                {error}
              </p>
            )}
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
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Closing…
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} /> Close RFI
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

const FieldLabel: React.FC<{ required?: boolean; children: React.ReactNode }> = ({
  required,
  children,
}) => (
  <label
    style={{
      fontSize: 11,
      fontWeight: 600,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}
  >
    {children}
    {required && <span style={{ color: colors.red, marginLeft: 4 }}>*</span>}
  </label>
)

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 13,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceInset,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: 8,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const textAreaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
}

export default RFICloseDialog
