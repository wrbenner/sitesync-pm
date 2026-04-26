import React, { useState } from 'react'
import { Shield, CheckCircle2, AlertCircle, Smartphone, Trash2, Copy } from 'lucide-react'
import { Btn, Card, Modal } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { supabase } from '../../lib/supabase'
import { useMfa, type MfaFactor } from '../../hooks/useMfa'
import { toast } from 'sonner'

// ── MFA Enrollment Card ─────────────────────────────────────
//
// Single-purpose component for src/pages/UserProfile.tsx. Handles:
//   1. Reading current MFA state (factors + AAL).
//   2. Walking the user through TOTP enrollment (QR + verify code).
//   3. Letting them remove an existing factor.
//
// Uses Supabase JS MFA APIs:
//   supabase.auth.mfa.enroll       — creates a new TOTP factor in unverified state
//   supabase.auth.mfa.challenge    — issues a challenge for that factor
//   supabase.auth.mfa.verify       — verifies the user-entered TOTP code
//   supabase.auth.mfa.unenroll     — removes a factor

type EnrollmentStep = 'idle' | 'showing-qr' | 'verifying' | 'success'

interface EnrollmentDraft {
  factorId: string
  qrCodeSvg: string
  /** Base32 secret, exposed for password-manager copy-paste users. */
  secret: string
}

export const MfaEnrollment: React.FC = () => {
  const { verifiedFactors, loading, refresh } = useMfa()
  const [step, setStep] = useState<EnrollmentStep>('idle')
  const [draft, setDraft] = useState<EnrollmentDraft | null>(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Start enrollment ────────────────────────────────────
  const startEnrollment = async () => {
    setErrorMsg(null)
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `SiteSync (${new Date().toLocaleDateString()})`,
      })
      if (error) throw error
      if (!data) throw new Error('Empty MFA enroll response')

      setDraft({
        factorId: data.id,
        qrCodeSvg: (data as { totp?: { qr_code?: string } }).totp?.qr_code ?? '',
        secret: (data as { totp?: { secret?: string } }).totp?.secret ?? '',
      })
      setStep('showing-qr')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to start MFA enrollment')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Verify the 6-digit code ─────────────────────────────
  const verifyCode = async () => {
    if (!draft) return
    if (!/^\d{6}$/.test(code)) {
      setErrorMsg('Enter the 6-digit code from your authenticator app')
      return
    }
    setErrorMsg(null)
    setSubmitting(true)
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: draft.factorId })
      if (challenge.error) throw challenge.error

      const verify = await supabase.auth.mfa.verify({
        factorId: draft.factorId,
        challengeId: challenge.data.id,
        code,
      })
      if (verify.error) throw verify.error

      setStep('success')
      setCode('')
      await refresh()
      toast.success('Multi-factor authentication enabled')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Invalid verification code')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelEnrollment = async () => {
    if (draft?.factorId) {
      // Best-effort cleanup of the unverified factor.
      await supabase.auth.mfa.unenroll({ factorId: draft.factorId }).catch(() => {})
    }
    setDraft(null)
    setStep('idle')
    setCode('')
    setErrorMsg(null)
  }

  const removeFactor = async (factor: MfaFactor) => {
    if (!confirm(`Remove this authenticator? You'll lose two-factor protection.`)) return
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) throw error
      await refresh()
      toast.success('Authenticator removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove authenticator')
    } finally {
      setSubmitting(false)
    }
  }

  const copySecret = async () => {
    if (!draft?.secret) return
    await navigator.clipboard.writeText(draft.secret)
    toast.success('Secret copied to clipboard')
  }

  const isEnrolled = verifiedFactors.length > 0
  const totpFactor = verifiedFactors.find((f) => f.factorType === 'totp')

  return (
    <Card padding={spacing['5']}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.md,
            background: isEnrolled ? `${colors.statusActive}15` : `${colors.statusPending}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Shield size={20} color={isEnrolled ? colors.statusActive : colors.statusPending} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Two-factor authentication
            </h3>
            {isEnrolled && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: borderRadius.full,
                  background: `${colors.statusActive}15`,
                  color: colors.statusActive,
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                <CheckCircle2 size={12} /> Enabled
              </span>
            )}
          </div>

          <p style={{ margin: `${spacing['1']} 0 ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.5 }}>
            {isEnrolled
              ? 'You’ll be asked for a 6-digit code from your authenticator app each time you sign in.'
              : 'Add a second factor (TOTP authenticator app like 1Password, Authy, Google Authenticator, or Apple Passwords) so even a leaked password can’t access your account.'}
          </p>

          {!isEnrolled && (
            <Btn variant="primary" size="sm" onClick={startEnrollment} disabled={loading || submitting} icon={<Smartphone size={14} />}>
              {submitting ? 'Starting…' : 'Enable two-factor authentication'}
            </Btn>
          )}

          {isEnrolled && totpFactor && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: spacing['3'], borderRadius: borderRadius.md, background: colors.surfaceInset }}>
              <div>
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                  {totpFactor.friendlyName ?? 'Authenticator app'}
                </div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: 2 }}>
                  Added {new Date(totpFactor.createdAt).toLocaleDateString()}
                </div>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => removeFactor(totpFactor)} disabled={submitting} icon={<Trash2 size={14} />}>
                Remove
              </Btn>
            </div>
          )}

          {errorMsg && step === 'idle' && (
            <div role="alert" style={{ marginTop: spacing['2'], display: 'flex', alignItems: 'center', gap: 6, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* ── Enrollment QR modal ─────────────────────────── */}
      <Modal
        open={step === 'showing-qr' || step === 'verifying' || step === 'success'}
        onClose={cancelEnrollment}
        title={step === 'success' ? 'Two-factor authentication enabled' : 'Set up authenticator app'}
        width="480px"
      >
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: spacing['4'] }}>
            <CheckCircle2 size={48} color={colors.statusActive} style={{ marginBottom: spacing['3'] }} />
            <p style={{ margin: 0, fontSize: typography.fontSize.base, color: colors.textPrimary }}>
              Two-factor authentication is now active on your account.
            </p>
            <Btn variant="primary" onClick={cancelEnrollment} style={{ marginTop: spacing['4'] }}>
              Done
            </Btn>
          </div>
        )}

        {(step === 'showing-qr' || step === 'verifying') && draft && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <ol style={{ margin: 0, paddingLeft: spacing['4'], fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
              <li>Open your authenticator app (1Password, Authy, Apple Passwords, Google Authenticator, etc.)</li>
              <li>Scan the QR code below, or paste the secret manually.</li>
              <li>Enter the 6-digit code your app generates.</li>
            </ol>

            {draft.qrCodeSvg && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: spacing['3'],
                  borderRadius: borderRadius.md,
                  background: '#fff',
                }}
                // Supabase returns a `data:image/svg+xml;...` URL for the QR.
                // Render as <img> rather than dangerouslySetInnerHTML so we never
                // inject arbitrary SVG into the DOM.
              >
                <img src={draft.qrCodeSvg} alt="MFA setup QR code" width={200} height={200} />
              </div>
            )}

            {draft.secret && (
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Or enter manually
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <code style={{ flex: 1, padding: spacing['2'], borderRadius: borderRadius.sm, background: colors.surfaceInset, fontSize: typography.fontSize.sm, fontFamily: 'monospace', userSelect: 'all', wordBreak: 'break-all' }}>
                    {draft.secret}
                  </code>
                  <Btn variant="ghost" size="sm" onClick={copySecret} icon={<Copy size={14} />}>Copy</Btn>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="mfa-otp-input"
                style={{
                  display: 'block',
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Verification code
              </label>
              <input
                id="mfa-otp-input"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  if (errorMsg) setErrorMsg(null)
                }}
                placeholder="123456"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                style={{
                  width: '100%',
                  padding: spacing['2'],
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.borderSubtle}`,
                  background: colors.surfaceRaised,
                  color: colors.textPrimary,
                  fontSize: typography.fontSize.lg,
                  fontFamily: 'monospace',
                  letterSpacing: '0.4em',
                  textAlign: 'center',
                }}
              />
            </div>

            {errorMsg && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={cancelEnrollment} disabled={submitting}>Cancel</Btn>
              <Btn variant="primary" onClick={verifyCode} disabled={submitting || code.length !== 6}>
                {submitting ? 'Verifying…' : 'Verify and enable'}
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
