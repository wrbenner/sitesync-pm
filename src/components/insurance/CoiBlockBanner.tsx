import React, { useState, useCallback } from 'react'
import { ShieldAlert, Upload, Unlock } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { Btn } from '../Primitives'
import { Eyebrow } from '../atoms'
import {
  isSubBlocked,
  validateOverrideReason,
  type CoiBlockRow,
} from '../../lib/coi/expirationGate'

interface CoiBlockBannerProps {
  blocks: CoiBlockRow[]
  subcontractorId?: string | null
  companyName?: string | null
  /** Called when foreman taps "Upload current cert". */
  onUploadCoi: (block: CoiBlockRow) => void
  /**
   * GC override. Receives the block + reason. The component already validates
   * the reason length; the caller should still re-validate server-side.
   */
  onOverride?: (block: CoiBlockRow, reason: string) => void | Promise<void>
  /** PM/admin sees override controls; foremen don't. */
  canOverride?: boolean
  now?: Date
}

export const CoiBlockBanner: React.FC<CoiBlockBannerProps> = ({
  blocks,
  subcontractorId,
  companyName,
  onUploadCoi,
  onOverride,
  canOverride = false,
  now = new Date(),
}) => {
  const block = isSubBlocked(blocks, { subcontractorId, companyName }, now)
  const [showOverride, setShowOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reasonError, setReasonError] = useState<string | null>(null)

  const handleOverride = useCallback(async () => {
    if (!block || !onOverride) return
    const validated = validateOverrideReason(reason)
    if (validated.error) {
      setReasonError(validated.error.userMessage)
      return
    }
    setReasonError(null)
    setSubmitting(true)
    try {
      await onOverride(block, validated.data!)
      setShowOverride(false)
      setReason('')
    } finally {
      setSubmitting(false)
    }
  }, [block, onOverride, reason])

  if (!block) return null

  const expiredOn = new Date(block.expired_on).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        border: `1px solid ${colors.statusCritical}`,
        background: colors.statusCriticalSubtle,
        borderRadius: borderRadius.lg,
        padding: spacing['5'],
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['3'],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
        <ShieldAlert size={22} color={colors.statusCritical} aria-hidden />
        <div style={{ flex: 1 }}>
          <Eyebrow color="muted">Compliance hold</Eyebrow>
          <div
            style={{
              fontFamily: typography.fontFamilySerif,
              fontSize: '20px',
              lineHeight: 1.25,
              color: colors.statusCritical,
              marginTop: 2,
            }}
          >
            {block.company_name}'s COI expired on {expiredOn}.
          </div>
          <p
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '14px',
              color: colors.textPrimary,
              margin: `${spacing['2']} 0 0`,
              lineHeight: 1.5,
              maxWidth: 560,
            }}
          >
            Crew check-in is blocked until a current Certificate of Insurance is uploaded.
            Upload now to clear the hold.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['3'] }}>
        <Btn
          onClick={() => onUploadCoi(block)}
          variant="primary"
          icon={<Upload size={14} />}
        >
          Upload current cert
        </Btn>
        {canOverride && onOverride && !showOverride && (
          <Btn
            onClick={() => setShowOverride(true)}
            variant="ghost"
            icon={<Unlock size={14} />}
          >
            Override (GC only)
          </Btn>
        )}
      </div>

      {showOverride && canOverride && onOverride && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['2'],
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            padding: spacing['3'],
          }}
        >
          <label
            htmlFor="coi-override-reason"
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '12px',
              color: colors.ink2,
              fontWeight: typography.fontWeight.medium,
            }}
          >
            Reason for override (logged to audit trail)
          </label>
          <textarea
            id="coi-override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Renewal in hand from carrier, paperwork delayed by 24h…"
            rows={3}
            aria-invalid={reasonError !== null}
            style={{
              width: '100%',
              fontFamily: typography.fontFamily,
              fontSize: '13px',
              padding: spacing['3'],
              border: `1px solid ${reasonError ? colors.statusCritical : colors.border}`,
              borderRadius: borderRadius.md,
              background: colors.surface0,
              color: colors.textPrimary,
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          {reasonError && (
            <span
              style={{
                fontSize: '12px',
                color: colors.statusCritical,
                fontFamily: typography.fontFamily,
              }}
            >
              {reasonError}
            </span>
          )}
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn
              onClick={() => {
                setShowOverride(false)
                setReason('')
                setReasonError(null)
              }}
              variant="ghost"
              size="sm"
              disabled={submitting}
            >
              Cancel
            </Btn>
            <Btn
              onClick={handleOverride}
              variant="danger"
              size="sm"
              disabled={submitting}
            >
              {submitting ? 'Logging…' : 'Confirm override'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
