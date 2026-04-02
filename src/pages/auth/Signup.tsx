import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'

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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [company, setCompany] = useState('')

  const [firstNameError, setFirstNameError] = useState<string | null>(null)
  const [lastNameError, setLastNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
  const [companyError, setCompanyError] = useState<string | null>(null)

  const [submitError, setSubmitError] = useState<{ text: string; linkToLogin?: boolean } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    const ok = [
      validateFirstName(firstName),
      validateLastName(lastName),
      validateEmail(email),
      validatePassword(password),
      validateConfirmPassword(confirmPassword),
      validateCompany(company),
    ].every(Boolean)

    if (!ok) return

    setIsSubmitting(true)
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } },
      })

      if (authError) {
        setSubmitError(mapSignupError(authError.message))
        return
      }

      if (!data.user) {
        setSubmitError({ text: 'Signup failed. Please try again.' })
        return
      }

      const userId = data.user.id

      // Insert organization row
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: company.trim() })
        .select('id')
        .single()

      const organizationId = orgError ? null : orgData?.id ?? null

      // Insert user profile row (non-fatal if table not yet provisioned)
      await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)('users').insert({
        id: userId,
        email,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        organization_id: organizationId,
      })

      navigate('/dashboard')
    } finally {
      setIsSubmitting(false)
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
    if (!hasError) e.currentTarget.style.boxShadow = '0 0 0 2px #F47820'
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
              fontSize: typography.fontSize.heading,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: typography.letterSpacing.tight,
            }}
          >
            SiteSync AI
          </h1>
          <p
            style={{
              fontSize: typography.fontSize.body,
              color: colors.textTertiary,
              margin: 0,
              marginTop: spacing['2'],
              letterSpacing: typography.letterSpacing.normal,
            }}
          >
            Create your account to get started
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
            <div style={{ marginBottom: spacing['6'] }}>
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
