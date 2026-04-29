import React, { useMemo, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, ArrowUpRight, Lock } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { Btn } from '../../components/Primitives'
import { Eyebrow, Hairline } from '../../components/atoms'
import {
  runAudit,
  type AuditInput,
  type AuditSummary,
  type CheckResult,
  type CheckId,
} from './auditChecks'

interface PreSubmissionAuditProps {
  input: AuditInput
  /**
   * Called when the user clicks Submit. Receives the audit summary so the
   * caller can decide whether to invoke the network mutation. If `override`
   * is non-null, the user accepted gaps with a typed reason — caller must
   * persist it to `payapp_audit_overrides`.
   */
  onSubmit: (
    summary: AuditSummary,
    override: { reason: string; check_ids: CheckId[] } | null,
  ) => void | Promise<void>
  onFixLink?: (link: string) => void
  isSubmitting?: boolean
}

// ── Visual helpers ───────────────────────────────────────────────

function statusGlyph(status: CheckResult['status']) {
  if (status === 'pass') {
    return <CheckCircle2 size={18} color={colors.statusActive} aria-label="Passed" />
  }
  if (status === 'warn') {
    return <AlertTriangle size={18} color={colors.primaryOrange} aria-label="Warning" />
  }
  if (status === 'fail') {
    return <XCircle size={18} color={colors.statusCritical} aria-label="Failed" />
  }
  return <CheckCircle2 size={18} color={colors.ink4} aria-label="Skipped" />
}

// ── Component ────────────────────────────────────────────────────

export const PreSubmissionAudit: React.FC<PreSubmissionAuditProps> = ({
  input,
  onSubmit,
  onFixLink,
  isSubmitting = false,
}) => {
  const summary = useMemo(() => runAudit(input), [input])
  const [acceptingGaps, setAcceptingGaps] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const reasonValid = overrideReason.trim().length >= 12
  const canSubmitClean = summary.canSubmit
  const canSubmitWithOverride = !canSubmitClean && acceptingGaps && reasonValid

  const handleSubmit = useCallback(() => {
    if (canSubmitClean) {
      void onSubmit(summary, null)
      return
    }
    if (canSubmitWithOverride) {
      void onSubmit(summary, {
        reason: overrideReason.trim(),
        check_ids: summary.failedCheckIds,
      })
    }
  }, [canSubmitClean, canSubmitWithOverride, onSubmit, overrideReason, summary])

  const headerColor =
    summary.status === 'pass'
      ? colors.statusActive
      : summary.status === 'warn'
      ? colors.primaryOrange
      : colors.statusCritical

  const headerLabel =
    summary.status === 'pass'
      ? 'Ready to submit'
      : summary.status === 'warn'
      ? `${summary.warned} item${summary.warned === 1 ? '' : 's'} need attention`
      : `${summary.failed} of ${summary.total} checks failed`

  return (
    <section
      aria-label="Pre-submission audit"
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.lg,
        padding: spacing['5'],
        background: colors.surface1,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['4'],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <Eyebrow color="muted">Pre-submission audit</Eyebrow>
          <div
            style={{
              fontFamily: typography.fontFamilySerif,
              fontSize: '22px',
              lineHeight: 1.2,
              color: headerColor,
              marginTop: spacing['2'],
            }}
          >
            {headerLabel}
          </div>
        </div>
        <div
          style={{
            ...typography.eyebrow,
            color: colors.ink3,
            fontSize: '11px',
          }}
        >
          {summary.passed} / {summary.total} pass
        </div>
      </div>

      <Hairline weight={1} spacing="tight" />

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['3'],
        }}
      >
        {summary.results.map((r) => (
          <li
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr auto',
              gap: spacing['3'],
              alignItems: 'flex-start',
            }}
          >
            <div style={{ paddingTop: 2 }}>{statusGlyph(r.status)}</div>
            <div>
              <div
                style={{
                  fontFamily: typography.fontFamily,
                  fontSize: '14px',
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                }}
              >
                {r.label}
              </div>
              {r.detail && (
                <div
                  style={{
                    fontFamily: typography.fontFamily,
                    fontSize: '13px',
                    color: r.status === 'fail' ? colors.statusCritical : colors.ink2,
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {r.detail}
                </div>
              )}
            </div>
            {r.fix_link && r.status !== 'pass' && (
              <button
                type="button"
                onClick={() => onFixLink?.(r.fix_link!)}
                aria-label={`Jump to fix for ${r.label}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: 'none',
                  color: colors.primaryOrange,
                  fontFamily: typography.fontFamily,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Fix <ArrowUpRight size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <Hairline weight={1} spacing="tight" />

      {!canSubmitClean && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['2'],
            background: colors.statusCriticalSubtle,
            border: `1px solid ${colors.statusCritical}`,
            borderRadius: borderRadius.md,
            padding: spacing['4'],
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing['2'],
              fontFamily: typography.fontFamily,
              fontSize: '13px',
              color: colors.textPrimary,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={acceptingGaps}
              onChange={(e) => setAcceptingGaps(e.target.checked)}
              style={{ marginTop: 2 }}
              aria-describedby="override-reason-help"
            />
            <span>
              I accept these gaps and want to submit anyway. I understand this is logged.
            </span>
          </label>
          {acceptingGaps && (
            <>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why submitting is acceptable despite the failed checks…"
                rows={3}
                aria-label="Override reason"
                aria-invalid={!reasonValid}
                style={{
                  width: '100%',
                  fontFamily: typography.fontFamily,
                  fontSize: '13px',
                  padding: spacing['3'],
                  border: `1px solid ${reasonValid ? colors.border : colors.statusCritical}`,
                  borderRadius: borderRadius.md,
                  background: colors.surface0,
                  color: colors.textPrimary,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <span
                id="override-reason-help"
                style={{
                  fontSize: '11px',
                  color: colors.ink3,
                  fontFamily: typography.fontFamily,
                }}
              >
                {overrideReason.trim().length} / 12 minimum
              </span>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
        <Btn
          onClick={handleSubmit}
          disabled={(!canSubmitClean && !canSubmitWithOverride) || isSubmitting}
          variant="primary"
        >
          {!canSubmitClean && !canSubmitWithOverride ? (
            <>
              <Lock size={14} style={{ marginRight: 6 }} />
              Submit blocked
            </>
          ) : isSubmitting ? (
            'Submitting…'
          ) : (
            'Submit to Owner'
          )}
        </Btn>
      </div>
    </section>
  )
}
