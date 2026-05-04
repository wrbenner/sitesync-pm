import React, { useCallback, useState } from 'react'
import { Camera, CheckCircle2, XCircle, Mic } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { Btn } from '../Primitives'
import { Eyebrow, Hairline, PageQuestion } from '../atoms'

// ── Types ─────────────────────────────────────────────────────────

export type InspectionEvidence =
  | { kind: 'photo'; url: string; caption?: string }
  | { kind: 'verbal'; description: string }

export interface InspectionResult {
  outcome: 'pass' | 'fail'
  evidence: InspectionEvidence
  /** Spec section / scope tag — used to notify the right sub on fail. */
  specSection?: string
  inspector?: string
}

interface InspectionFlowProps {
  /**
   * Optional: spec section pre-filled (e.g. "07 92 00 — Joint Sealants").
   * The fail path uses it to auto-route the punch item to the right sub.
   */
  specSection?: string
  /**
   * Called when the user completes a 2-tap flow. The caller is responsible
   * for creating the punch item (fail), writing the daily-log entry, and
   * notifying the spec-section sub.
   */
  onComplete: (result: InspectionResult) => void | Promise<void>
  /**
   * Hook to capture a photo. Returns a public/signed URL or null if the
   * user aborted. The component handles the rest of the flow.
   */
  onCapturePhoto: () => Promise<{ url: string } | null>
}

type Step = 'arrive' | 'fail-evidence' | 'verbal-fallback' | 'done'

// ── Component ─────────────────────────────────────────────────────

export const InspectionFlow: React.FC<InspectionFlowProps> = ({
  specSection,
  onComplete,
  onCapturePhoto,
}) => {
  const [step, setStep] = useState<Step>('arrive')
  const [verbal, setVerbal] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<'pass' | 'fail' | null>(null)

  const finishPass = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onComplete({
        outcome: 'pass',
        // Pass requires no physical evidence — verbal log entry is fine.
        evidence: { kind: 'verbal', description: 'Inspector marked pass at site walk.' },
        specSection,
      })
      setOutcome('pass')
      setStep('done')
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }, [onComplete, specSection])

  const finishFailWithPhoto = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const photo = await onCapturePhoto()
      if (!photo) {
        // User cancelled out of the camera — don't lose the flow,
        // offer the verbal fallback so they still capture *something*.
        setStep('verbal-fallback')
        return
      }
      await onComplete({
        outcome: 'fail',
        evidence: { kind: 'photo', url: photo.url, caption: 'Red tag at inspection' },
        specSection,
      })
      setOutcome('fail')
      setStep('done')
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }, [onCapturePhoto, onComplete, specSection])

  const finishVerbalFail = useCallback(async () => {
    if (verbal.trim().length < 8) {
      setError('Describe what failed — at least a sentence.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onComplete({
        outcome: 'fail',
        evidence: { kind: 'verbal', description: verbal.trim() },
        specSection,
      })
      setOutcome('fail')
      setStep('done')
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }, [onComplete, specSection, verbal])

  // ── Render by step ──────────────────────────────────

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['4'],
    padding: spacing['5'],
    background: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.lg,
    minHeight: 240,
  }

  if (step === 'done') {
    return (
      <div style={containerStyle} role="status" aria-live="polite">
        <Eyebrow color={outcome === 'pass' ? 'default' : 'orange'}>
          Inspection logged
        </Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {outcome === 'pass' ? (
            <CheckCircle2 size={28} color={colors.statusActive} aria-hidden />
          ) : (
            <XCircle size={28} color={colors.statusCritical} aria-hidden />
          )}
          <PageQuestion size="medium">
            {outcome === 'pass' ? <em>Inspector said pass.</em> : <em>Inspector said fail.</em>}
          </PageQuestion>
        </div>
        <p
          style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: '15px',
            color: colors.ink2,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {outcome === 'pass'
            ? 'Logged to today\'s daily log. Nice walk.'
            : 'Punch item created, sub notified, daily log updated.'}
        </p>
      </div>
    )
  }

  if (step === 'verbal-fallback') {
    return (
      <div style={containerStyle}>
        <Eyebrow color="muted">No physical tag</Eyebrow>
        <PageQuestion size="medium">
          <em>Describe what failed.</em>
        </PageQuestion>
        <textarea
          value={verbal}
          onChange={(e) => setVerbal(e.target.value)}
          rows={4}
          aria-label="Inspection failure description"
          aria-invalid={error !== null}
          placeholder="e.g. Sealant joint at GL-7 not tooled per spec…"
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '14px',
            padding: spacing['3'],
            border: `1px solid ${error ? colors.statusCritical : colors.border}`,
            borderRadius: borderRadius.md,
            background: colors.surfaceFlat,
            color: colors.textPrimary,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <Hairline weight={1} spacing="tight" />
        <p
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '12px',
            color: colors.ink3,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Logged as <strong>verbal evidence</strong>. SiteSync will prompt you for a follow-up photo within 24 hours.
        </p>
        {error && (
          <span style={{ color: colors.statusCritical, fontSize: '12px' }}>{error}</span>
        )}
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
          <Btn
            onClick={() => setStep('arrive')}
            variant="ghost"
            size="sm"
            disabled={submitting}
          >
            Back
          </Btn>
          <Btn
            onClick={finishVerbalFail}
            variant="primary"
            size="sm"
            disabled={submitting}
            icon={<Mic size={14} />}
          >
            {submitting ? 'Logging…' : 'Log verbal fail'}
          </Btn>
        </div>
      </div>
    )
  }

  // arrive (and fail-evidence, which is identical until photo capture)
  return (
    <div style={containerStyle}>
      <Eyebrow color="muted">Inspection</Eyebrow>
      <PageQuestion size="medium">
        <em>Inspector here.</em>
      </PageQuestion>
      {specSection && (
        <p
          style={{
            ...typography.eyebrow,
            color: colors.ink3,
            margin: 0,
            fontSize: '11px',
          }}
        >
          {specSection}
        </p>
      )}
      <Hairline weight={1} spacing="tight" />
      {error && (
        <span style={{ color: colors.statusCritical, fontSize: '12px' }}>{error}</span>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: spacing['3'],
        }}
      >
        <Btn
          onClick={finishPass}
          variant="primary"
          fullWidth
          disabled={submitting}
          icon={<CheckCircle2 size={16} />}
        >
          Pass
        </Btn>
        <Btn
          onClick={finishFailWithPhoto}
          variant="danger"
          fullWidth
          disabled={submitting}
          icon={<Camera size={16} />}
        >
          Fail with photo
        </Btn>
      </div>
      <button
        type="button"
        onClick={() => setStep('verbal-fallback')}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.ink3,
          fontFamily: typography.fontFamily,
          fontSize: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          padding: spacing['2'],
          textDecoration: 'underline',
        }}
      >
        No physical tag — describe verbally
      </button>
    </div>
  )
}
