import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import * as Sentry from '@sentry/react'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'
import { signupSchema } from '../../schemas/auth'
import { Turnstile } from '../../components/auth/Turnstile'
import { isDisposableEmail } from '../../lib/auth/disposableEmails'
import { checkPasswordSafe } from '../../lib/auth/passwordChecks'
import { useTrack } from '../../hooks/useTrack'

function mapSignupError(message: string): { text: string; linkToLogin?: boolean } {
  const msg = message.toLowerCase()
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already registered')) {
    return { text: 'An account with this email already exists. Try signing in instead.', linkToLogin: true }
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return { text: 'Too many attempts. Please try again in a few minutes.' }
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) {
    return { text: 'Unable to connect. Check your internet connection.' }
  }
  if (msg.includes('password') && msg.includes('short')) {
    return { text: 'Password must be at least 8 characters.' }
  }
  return { text: message }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const Signup: React.FC = () => {
  const navigate = useNavigate()
  const track = useTrack()
  const [signupStartedAt] = useState<number>(() => Date.now())

  // BRT sub-2 §6: signup_started fires once on mount.
  useEffect(() => {
    track('signup_started', { source: 'signup_page' })
  }, [track])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  const [firstNameError, setFirstNameError] = useState<string | null>(null)
  const [lastNameError, setLastNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
  const [companyError, setCompanyError] = useState<string | null>(null)

  const [submitError, setSubmitError] = useState<{ text: string; linkToLogin?: boolean } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // BRT sub-0 day-4 P0-I: required Terms/Privacy acceptance.
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedTermsError, setAcceptedTermsError] = useState<string | null>(null)
  // BRT sub-2 §4.2: Cloudflare Turnstile token. Empty until the widget
  // fires its callback. provision-org verifies server-side via siteverify.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const onTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), [])

  const validateFirstName = (val: string) => {
    if (!val.trim()) { setFirstNameError('First name is required'); return false }
    setFirstNameError(null); return true
  }
  const validateLastName = (val: string) => {
    if (!val.trim()) { setLastNameError('Last name is required'); return false }
    setLastNameError(null); return true
  }
  const validateEmail = (val: string) => {
    if (!val.trim()) { setEmailError('Email is required'); return false }
    if (!EMAIL_RE.test(val)) { setEmailError('Please enter a valid email address'); return false }
    if (isDisposableEmail(val)) {
      setEmailError('We don\'t accept signups from disposable email providers. Please use your work email.')
      return false
    }
    setEmailError(null); return true
  }
  const validatePassword = (val: string) => {
    if (!val) { setPasswordError('Password is required'); return false }
    if (val.length < 8) { setPasswordError('Password must be at least 8 characters'); return false }
    setPasswordError(null); return true
  }
  const validateConfirmPassword = (val: string) => {
    if (!val) { setConfirmPasswordError('Please confirm your password'); return false }
    if (val !== password) { setConfirmPasswordError('Passwords do not match'); return false }
    setConfirmPasswordError(null); return true
  }
  const validateCompany = (val: string) => {
    if (!val.trim()) { setCompanyError('Company name is required'); return false }
    setCompanyError(null); return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    const parsed = signupSchema.safeParse({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      organization: company,
      jobTitle,
      acceptedTerms,
    })
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors
      if (errs.firstName?.[0]) setFirstNameError(errs.firstName[0])
      if (errs.lastName?.[0]) setLastNameError(errs.lastName[0])
      if (errs.email?.[0]) setEmailError(errs.email[0])
      if (errs.password?.[0]) setPasswordError(errs.password[0])
      if (errs.confirmPassword?.[0]) setConfirmPasswordError(errs.confirmPassword[0])
      if (errs.organization?.[0]) setCompanyError(errs.organization[0])
      if (errs.acceptedTerms?.[0]) setAcceptedTermsError(errs.acceptedTerms[0])
      // Fall back on legacy per-field validators for any remaining UX cases
      validateFirstName(firstName)
      validateLastName(lastName)
      validateEmail(email)
      validatePassword(password)
      validateConfirmPassword(confirmPassword)
      validateCompany(company)
      return
    }
    setAcceptedTermsError(null)

    if (!turnstileToken) {
      setSubmitError({ text: 'Please complete the human-verification challenge before continuing.' })
      return
    }

    // BRT sub-2 §4.3: pwned-password k-anonymity check at submit (not per
    // keystroke — latency + rate limits). Fails open on network errors.
    const pwSafe = await checkPasswordSafe(password)
    if (!pwSafe.ok) {
      setPasswordError(pwSafe.reason ?? 'Password rejected. Please choose a different one.')
      return
    }

    setIsSubmitting(true)
    track('signup_email_submitted', {})
    // Diagnostic flags consumed by the outer-catch fallback below. If
    // supabase.auth.signUp() succeeded we MUST get the user to /verify-pending
    // even when downstream provisioning (provision-org / profile insert /
    // track) throws — the auth.users row already exists, so dropping them
    // on /signup with an inline error is worse than landing on the inbox-
    // check page where they can complete verification and recover via
    // support if provisioning needs a retry.
    let authSucceededUserId: string | null = null
    let profileInsertOk: boolean | null = null
    let trackOk: boolean | null = null
    // try/catch (no finally) — React Compiler doesn't lower try/finally.
    // Loading state is cleared in both branches explicitly.
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } },
      })

      if (authError) {
        setSubmitError(mapSignupError(authError.message))
        setIsSubmitting(false)
        return
      }

      if (!data.user) {
        setSubmitError({ text: 'Signup failed. Please try again.' })
        setIsSubmitting(false)
        return
      }

      const userId = data.user.id
      authSucceededUserId = userId

      // BRT sub-2 §4.1 — provision the org via the atomic edge function
      // (replaces the prior 3-step ad-hoc insert that had no slug retry,
      // no atomicity, no audit-log entry). Failure here doesn't roll back
      // the auth user; a follow-up signup-rollback edge function (separate
      // slice) handles the half-provisioned-account cleanup.
      const { data: provisionData, error: provisionError } = await supabase.functions.invoke(
        'provision-org',
        { body: { name: company.trim(), turnstile_token: turnstileToken } },
      )

      let organizationId: string | null = null
      if (provisionError) {
        console.error('[signup] provision-org failed:', provisionError)
      } else if (provisionData) {
        const pd = provisionData as { organization_id?: unknown }
        if (typeof pd.organization_id === 'string') {
          organizationId = pd.organization_id
          track('signup_org_provisioned', { org_id: organizationId })
        }
      }

      // Create user profile (links to the freshly provisioned org).
      // BRT sub-0 day-4 P0-I: capture terms_accepted_at — required by the
      // schema; checkbox was the gate.
      // Diagnostic instrumentation (signup failure investigation): the
      // profile insert is wrapped so we capture both the structured error
      // (PostgREST code + message) and a Sentry breadcrumb. We do NOT
      // re-throw — the auth user already exists; failing the profile
      // insert silently mirrors the existing "fail-open" stance for
      // provision-org and is preferable to dropping the user on /signup
      // with an unrecoverable mid-flow error.
      try {
        const { error: profileError } = await fromTable('profiles').insert({
          user_id: userId,
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          job_title: jobTitle.trim() || null,
          organization_id: organizationId,
          terms_accepted_at: new Date().toISOString(),
        } as never)
        if (profileError) {
          profileInsertOk = false
          console.error('[signup] profile insert failed:', profileError)
          Sentry.captureException(profileError, {
            tags: { area: 'signup', step: 'profile_insert' },
            extra: { userId, organizationId },
          })
        } else {
          profileInsertOk = true
        }
      } catch (err) {
        profileInsertOk = false
        console.error('[signup] profile insert failed:', err)
        Sentry.captureException(err, {
          tags: { area: 'signup', step: 'profile_insert' },
          extra: { userId, organizationId },
        })
      }

      // BRT sub-2 §4.1: hand off to /verify-pending so the user has a
      // clear "check your inbox" landing instead of an inline success card
      // that lives on the form route. The state.email lets VerifyPending
      // offer a resend button without making the user re-type their email.
      if (organizationId) {
        try {
          track('signup_completed', {
            org_id: organizationId,
            total_seconds: Math.round((Date.now() - signupStartedAt) / 1000),
          })
          trackOk = true
        } catch (err) {
          trackOk = false
          console.error('[signup] track(signup_completed) failed:', err)
          Sentry.captureException(err, {
            tags: { area: 'signup', step: 'track_completed' },
            extra: { userId, organizationId },
          })
        }
      }
      setIsSubmitting(false)
      // Diagnostic — surfaces in browser console / CI logs even when Sentry
      // isn't receiving. Lets the next test run see WHICH downstream steps
      // completed vs. failed when the redirect fires.
      console.warn('[signup] navigating to /verify-pending', {
        userId,
        organizationId,
        profileInsertOk,
        trackOk,
      })
      try {
        navigate('/verify-pending', { state: { email } })
      } catch (err) {
        console.error('[signup] navigate(/verify-pending) failed:', err)
        Sentry.captureException(err, {
          tags: { area: 'signup', step: 'navigate_verify_pending' },
          extra: { userId, organizationId },
        })
      }
    } catch (err) {
      console.error('[signup] unexpected error:', err)
      Sentry.captureException(err, {
        tags: { area: 'signup', step: 'unexpected_outer_catch' },
        extra: { authSucceededUserId, profileInsertOk, trackOk },
      })
      setIsSubmitting(false)
      // Fallback navigation — if auth.signUp() succeeded the user already
      // exists in auth.users. Anything that throws between line 170 and the
      // navigate above (provision-org, profile insert, track, etc.) lands
      // here; without this fallback the user is stranded on /signup with an
      // inline error even though their account exists. Landing on
      // /verify-pending lets them complete email verification and recover.
      if (authSucceededUserId) {
        console.warn('[signup] navigating to /verify-pending despite errors:', {
          userId: authSucceededUserId,
          profileInsertOk,
          trackOk,
          error: err instanceof Error ? err.message : String(err),
        })
        try {
          navigate('/verify-pending', { state: { email } })
          return
        } catch (navErr) {
          console.error('[signup] fallback navigate(/verify-pending) failed:', navErr)
          Sentry.captureException(navErr, {
            tags: { area: 'signup', step: 'fallback_navigate_verify_pending' },
            extra: { userId: authSucceededUserId },
          })
        }
      }
      setSubmitError({
        text: err instanceof Error
          ? `Signup hit an unexpected error: ${err.message}`
          : 'Signup hit an unexpected error. Please try again.',
      })
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    height: '48px',
    padding: `${spacing['3']} ${spacing['4']}`,
    fontSize: '16px',
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    outline: 'none',
    boxShadow: 'none',
    transition: `border-color ${transitions.quick}`,
    boxSizing: 'border-box' as const,
    letterSpacing: typography.letterSpacing.normal,
  }

  const inputError: React.CSSProperties = {
    ...inputBase,
    borderColor: colors.statusCritical,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing['2'],
    letterSpacing: typography.letterSpacing.wide,
  }

  const fieldErrorStyle: React.CSSProperties = {
    margin: `${spacing['1']} 0 0`,
    fontSize: typography.fontSize.sm,
    color: colors.statusCritical,
    lineHeight: typography.lineHeight.normal,
  }

  const requiredMark = (
    <span style={{ color: colors.statusCritical, marginLeft: '2px' }}>*</span>
  )

  function fieldFocus(e: React.FocusEvent<HTMLInputElement>, hasError: boolean) {
    e.currentTarget.style.borderColor = hasError ? colors.statusCritical : colors.borderFocus
    if (!hasError) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(244,120,32,0.15)'
  }
  function fieldBlurStyle(e: React.FocusEvent<HTMLInputElement>, hasError: boolean) {
    e.currentTarget.style.borderColor = hasError ? colors.statusCritical : colors.borderDefault
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box' as const,
        backgroundColor: colors.surfacePage,
        fontFamily: typography.fontFamily,
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: spacing['6'] }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: borderRadius.lg,
              backgroundColor: colors.primaryOrange,
              marginBottom: spacing['4'],
            }}
          >
            <span style={{ color: colors.white, fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.title }}>S</span>
          </div>
          <h1
            style={{
              // Brand surface — serif italic welcome per DESIGN-RESET.
              fontFamily: '"EB Garamond", Garamond, "Cormorant Garamond", "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: 36,
              fontWeight: 500,
              lineHeight: 1.1,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Get started.
          </h1>
          <p
            style={{
              fontSize: typography.fontSize.body,
              color: colors.textTertiary,
              margin: 0,
              marginTop: spacing['3'],
              letterSpacing: typography.letterSpacing.normal,
              fontFamily: typography.fontFamily,
            }}
          >
            Create your account to get started.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            padding: spacing['8'],
            boxShadow: shadows.card,
          }}
        >
          <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

          <form onSubmit={handleSubmit} noValidate aria-label="Create SiteSync account">

            {submitError && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  padding: `${spacing['3']} ${spacing['4']}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.statusCriticalSubtle,
                  color: colors.statusCritical,
                  fontSize: typography.fontSize.sm,
                  marginBottom: spacing['5'],
                  lineHeight: typography.lineHeight.normal,
                }}
              >
                {submitError.text}
                {submitError.linkToLogin && (
                  <>
                    {' '}
                    <Link
                      to="/login"
                      style={{ color: colors.statusCritical, fontWeight: typography.fontWeight.medium, textDecoration: 'underline' }}
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* First Name + Last Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['4'] }}>
              <div>
                <label style={labelStyle} htmlFor="signup-first-name">
                  First Name{requiredMark}
                </label>
                <input
                  type="text"
                  id="signup-first-name"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); if (firstNameError) setFirstNameError(null) }}
                  onBlur={(e) => { validateFirstName(e.currentTarget.value); fieldBlurStyle(e, !!firstNameError) }}
                  onFocus={(e) => fieldFocus(e, !!firstNameError)}
                  autoComplete="given-name"
                  required
                  aria-required="true"
                  aria-invalid={!!firstNameError}
                  aria-describedby={firstNameError ? 'first-name-error' : undefined}
                  style={firstNameError ? inputError : inputBase}
                />
                {firstNameError && (
                  <p id="first-name-error" role="alert" style={fieldErrorStyle}>{firstNameError}</p>
                )}
              </div>
              <div>
                <label style={labelStyle} htmlFor="signup-last-name">
                  Last Name{requiredMark}
                </label>
                <input
                  type="text"
                  id="signup-last-name"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); if (lastNameError) setLastNameError(null) }}
                  onBlur={(e) => { validateLastName(e.currentTarget.value); fieldBlurStyle(e, !!lastNameError) }}
                  onFocus={(e) => fieldFocus(e, !!lastNameError)}
                  autoComplete="family-name"
                  required
                  aria-required="true"
                  aria-invalid={!!lastNameError}
                  aria-describedby={lastNameError ? 'last-name-error' : undefined}
                  style={lastNameError ? inputError : inputBase}
                />
                {lastNameError && (
                  <p id="last-name-error" role="alert" style={fieldErrorStyle}>{lastNameError}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: spacing['4'] }}>
              <label style={labelStyle} htmlFor="signup-email">
                Email{requiredMark}
              </label>
              <input
                type="email"
                id="signup-email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null) }}
                onBlur={(e) => { validateEmail(e.currentTarget.value); fieldBlurStyle(e, !!emailError) }}
                onFocus={(e) => fieldFocus(e, !!emailError)}
                autoComplete="email"
                required
                aria-required="true"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'signup-email-error' : undefined}
                style={emailError ? inputError : inputBase}
              />
              {emailError && (
                <p id="signup-email-error" role="alert" style={fieldErrorStyle}>{emailError}</p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: spacing['4'] }}>
              <label style={labelStyle} htmlFor="signup-password">
                Password{requiredMark}
              </label>
              <input
                type="password"
                id="signup-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null) }}
                onBlur={(e) => { validatePassword(e.currentTarget.value); fieldBlurStyle(e, !!passwordError) }}
                onFocus={(e) => fieldFocus(e, !!passwordError)}
                autoComplete="new-password"
                required
                aria-required="true"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'signup-password-error' : 'signup-password-hint'}
                style={passwordError ? inputError : inputBase}
              />
              {passwordError ? (
                <p id="signup-password-error" role="alert" style={fieldErrorStyle}>{passwordError}</p>
              ) : (
                <p id="signup-password-hint" style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  Minimum 8 characters
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: spacing['4'] }}>
              <label style={labelStyle} htmlFor="signup-confirm-password">
                Confirm Password{requiredMark}
              </label>
              <input
                type="password"
                id="signup-confirm-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); if (confirmPasswordError) setConfirmPasswordError(null) }}
                onBlur={(e) => { validateConfirmPassword(e.currentTarget.value); fieldBlurStyle(e, !!confirmPasswordError) }}
                onFocus={(e) => fieldFocus(e, !!confirmPasswordError)}
                autoComplete="new-password"
                required
                aria-required="true"
                aria-invalid={!!confirmPasswordError}
                aria-describedby={confirmPasswordError ? 'signup-confirm-error' : undefined}
                style={confirmPasswordError ? inputError : inputBase}
              />
              {confirmPasswordError && (
                <p id="signup-confirm-error" role="alert" style={fieldErrorStyle}>{confirmPasswordError}</p>
              )}
            </div>

            {/* Company */}
            <div style={{ marginBottom: spacing['4'] }}>
              <label style={labelStyle} htmlFor="signup-company">
                Company / Organization{requiredMark}
              </label>
              <input
                type="text"
                id="signup-company"
                value={company}
                onChange={(e) => { setCompany(e.target.value); if (companyError) setCompanyError(null) }}
                onBlur={(e) => { validateCompany(e.currentTarget.value); fieldBlurStyle(e, !!companyError) }}
                onFocus={(e) => fieldFocus(e, !!companyError)}
                autoComplete="organization"
                required
                aria-required="true"
                aria-invalid={!!companyError}
                aria-describedby={companyError ? 'signup-company-error' : undefined}
                style={companyError ? inputError : inputBase}
              />
              {companyError && (
                <p id="signup-company-error" role="alert" style={fieldErrorStyle}>{companyError}</p>
              )}
            </div>

            {/* Job Title */}
            <div style={{ marginBottom: spacing['6'] }}>
              <label style={labelStyle} htmlFor="signup-job-title">
                Job Title
              </label>
              <input
                type="text"
                id="signup-job-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus; e.currentTarget.style.boxShadow = '0 0 0 2px #F47820' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; e.currentTarget.style.boxShadow = 'none' }}
                autoComplete="organization-title"
                placeholder="e.g. Project Manager, Superintendent"
                style={inputBase}
              />
            </div>

            {/* BRT sub-0 day-4 P0-I: required Terms of Service + Privacy Policy acceptance */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], marginTop: spacing['2'] }}>
              <input
                id="signup-accept-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked)
                  if (e.target.checked) setAcceptedTermsError(null)
                }}
                style={{ marginTop: '4px', cursor: 'pointer' }}
                aria-invalid={acceptedTermsError ? 'true' : undefined}
                aria-describedby={acceptedTermsError ? 'signup-accept-terms-error' : undefined}
              />
              <label
                htmlFor="signup-accept-terms"
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textSecondary,
                  letterSpacing: typography.letterSpacing.normal,
                  lineHeight: 1.5,
                  cursor: 'pointer',
                }}
              >
                I accept the{' '}
                <Link to="/terms" style={{ color: colors.primaryOrange, textDecoration: 'underline' }}>
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link to="/privacy" style={{ color: colors.primaryOrange, textDecoration: 'underline' }}>
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            {acceptedTermsError && (
              <p
                id="signup-accept-terms-error"
                role="alert"
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.statusCritical,
                  margin: 0,
                  marginTop: spacing['1'],
                  letterSpacing: typography.letterSpacing.normal,
                }}
              >
                {acceptedTermsError}
              </p>
            )}

            {/* BRT sub-2 §4.2 — Cloudflare Turnstile. Server-side verified
                in provision-org via siteverify. Renders nothing in dev when
                VITE_TURNSTILE_SITE_KEY is unset (passthrough sentinel). */}
            <div style={{ marginTop: spacing['5'], display: 'flex', justifyContent: 'center' }}>
              <Turnstile onVerify={onTurnstileVerify} />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              style={{
                width: '100%',
                height: '48px',
                padding: `${spacing['3']} ${spacing['4']}`,
                fontSize: '16px',
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                color: colors.white,
                backgroundColor: isSubmitting ? colors.orangeHover : colors.primaryOrange,
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: `background-color ${transitions.quick}`,
                letterSpacing: typography.letterSpacing.normal,
                opacity: isSubmitting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing['2'],
              }}
              onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = colors.orangeHover }}
              onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = colors.primaryOrange }}
            >
              {isSubmitting && <Loader2 size={16} style={{ animation: 'spin-loader 0.75s linear infinite' }} />}
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Sign in link */}
        <p
          style={{
            textAlign: 'center',
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            marginTop: spacing['6'],
            letterSpacing: typography.letterSpacing.normal,
          }}
        >
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: colors.orangeText,
              textDecoration: 'none',
              fontWeight: typography.fontWeight.medium,
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
