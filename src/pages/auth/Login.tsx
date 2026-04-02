import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme'

function mapAuthError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('invalid') || msg.includes('credentials')) return 'Email or password is incorrect'
  if (msg.includes('email not confirmed')) return 'Please check your email to confirm your account'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts. Please try again in a few minutes'
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) return 'Unable to connect. Check your internet connection'
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'An account with this email already exists'
  if (msg.includes('password') && msg.includes('short')) return 'Password must be at least 6 characters'
  return message
}

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, resetPassword, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        setError(mapAuthError(signInError))
      } else {
        const returnTo = searchParams.get('returnTo')
        const destination = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard'
        navigate(destination)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)
    setResetLoading(true)

    const { error: err } = await resetPassword(resetEmail)

    if (err) {
      setResetError(err)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  const inputStyle: React.CSSProperties = {
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing['2'],
    letterSpacing: typography.letterSpacing.wide,
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box' as const,
        backgroundColor: colors.surfacePage,
        fontFamily: typography.fontFamily,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: 'clamp(16px, 4vw, 48px)',
        }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: spacing['5'] }}>
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
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <div
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            padding: spacing['8'],
            boxShadow: shadows.card,
          }}
        >
          <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <form onSubmit={handleSubmit} aria-label="Sign in to SiteSync" aria-describedby="login-error">
            {error && (
              <div
                id="login-error"
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
                {error}
              </div>
            )}

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={labelStyle} htmlFor="login-email">Email address</label>
              <input
                type="email"
                id="login-email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null) }}
                placeholder="you@company.com"
                required
                aria-required="true"
                aria-invalid={!!emailError || !!error}
                aria-describedby={emailError ? 'email-error' : error ? 'login-error' : undefined}
                autoComplete="email"
                style={{ ...inputStyle, borderColor: emailError ? colors.statusCritical : inputStyle.borderColor }}
                onFocus={(e) => { e.currentTarget.style.borderColor = emailError ? colors.statusCritical : colors.borderFocus; e.currentTarget.style.boxShadow = emailError ? 'none' : '0 0 0 2px #F47820' }}
                onBlur={(e) => {
                  const val = e.currentTarget.value
                  if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    setEmailError('Please enter a valid email address')
                    e.currentTarget.style.borderColor = colors.statusCritical
                  } else {
                    setEmailError(null)
                    e.currentTarget.style.borderColor = colors.borderDefault
                  }
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              {emailError && (
                <p id="email-error" role="alert" style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                  {emailError}
                </p>
              )}
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={labelStyle} htmlFor="login-password">Password</label>
              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                autoComplete="current-password"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus; e.currentTarget.style.boxShadow = '0 0 0 2px #F47820' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: spacing['4'] }}>
              <button
                type="button"
                onClick={() => { setShowReset(true); setResetEmail(email); setResetSent(false); setResetError(null) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.orangeText,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  padding: 0,
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              style={{
                width: '100%',
                minWidth: '160px',
                height: '48px',
                padding: `${spacing['3']} ${spacing['4']}`,
                fontSize: '16px',
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                color: colors.white,
                backgroundColor: loading ? colors.orangeHover : colors.primaryOrange,
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: `background-color ${transitions.quick}`,
                letterSpacing: typography.letterSpacing.normal,
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing['2'],
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = colors.orangeHover }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = colors.primaryOrange }}
            >
              {loading && <Loader2 size={16} style={{ animation: 'spin-loader 0.75s linear infinite' }} />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <p
          style={{
            textAlign: 'center',
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            marginTop: spacing['6'],
            letterSpacing: typography.letterSpacing.normal,
          }}
        >
          Don't have an account?{' '}
          <Link
            to="/signup"
            style={{
              color: colors.orangeText,
              textDecoration: 'none',
              fontWeight: typography.fontWeight.medium,
            }}
          >
            Create an account
          </Link>
        </p>
      </div>

      {/* Reset Password Modal */}
      {showReset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: colors.overlayDark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: zIndex.modal as number,
          }}
          onClick={() => setShowReset(false)}
        >
          <div
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.xl,
              padding: spacing['8'],
              width: '100%',
              maxWidth: '400px',
              boxShadow: shadows.panel,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                margin: 0,
                marginBottom: spacing['2'],
                letterSpacing: typography.letterSpacing.tight,
              }}
            >
              Reset Password
            </h2>
            <p
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textTertiary,
                margin: 0,
                marginBottom: spacing['6'],
                lineHeight: typography.lineHeight.normal,
              }}
            >
              Enter your email and we'll send you a link to reset your password.
            </p>

            {resetSent ? (
              <div>
                <div
                  style={{
                    padding: `${spacing['3']} ${spacing['4']}`,
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.statusActiveSubtle,
                    color: colors.statusActive,
                    fontSize: typography.fontSize.sm,
                    lineHeight: typography.lineHeight.normal,
                    marginBottom: spacing['5'],
                  }}
                >
                  Check your email for a password reset link.
                </div>
                <button
                  type="button"
                  onClick={() => setShowReset(false)}
                  style={{
                    width: '100%',
                    padding: `${spacing['3']} ${spacing['4']}`,
                    fontSize: typography.fontSize.body,
                    fontWeight: typography.fontWeight.medium,
                    fontFamily: typography.fontFamily,
                    color: colors.textSecondary,
                    backgroundColor: colors.surfacePage,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.md,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset}>
                {resetError && (
                  <div
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
                    {mapAuthError(resetError)}
                  </div>
                )}
                <div style={{ marginBottom: spacing['5'] }}>
                  <label style={labelStyle} htmlFor="reset-email">Email</label>
                  <input
                    type="email" id="reset-email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault }}
                  />
                </div>
                <div style={{ display: 'flex', gap: spacing['3'] }}>
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    style={{
                      flex: 1,
                      padding: `${spacing['3']} ${spacing['4']}`,
                      fontSize: typography.fontSize.body,
                      fontWeight: typography.fontWeight.medium,
                      fontFamily: typography.fontFamily,
                      color: colors.textSecondary,
                      backgroundColor: colors.surfacePage,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.md,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    style={{
                      flex: 1,
                      padding: `${spacing['3']} ${spacing['4']}`,
                      fontSize: typography.fontSize.body,
                      fontWeight: typography.fontWeight.semibold,
                      fontFamily: typography.fontFamily,
                      color: colors.white,
                      backgroundColor: colors.primaryOrange,
                      border: 'none',
                      borderRadius: borderRadius.md,
                      cursor: resetLoading ? 'not-allowed' : 'pointer',
                      opacity: resetLoading ? 0.7 : 1,
                    }}
                  >
                    {resetLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
