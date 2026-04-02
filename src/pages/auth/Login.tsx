import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme'

function mapAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid_credentials')) return 'Email or password is incorrect'
  if (m.includes('email not confirmed')) return 'Please check your email to confirm your account'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please try again in a few minutes'
  if (m.includes('fetch') || m.includes('network') || m.includes('failed')) return 'Unable to connect. Check your internet connection'
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists'
  return msg
}

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await signIn(email, password)

    if (signInError) {
      setError(mapAuthError(signInError))
      setLoading(false)
    } else {
      const returnTo = searchParams.get('returnTo')
      const destination = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard'
      navigate(destination)
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
    padding: `${spacing['3']} ${spacing['4']}`,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    outline: 'none',
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
        backgroundColor: colors.surfacePage,
        fontFamily: typography.fontFamily,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: spacing['8'],
        }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: spacing['8'] }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
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

            <div style={{ marginBottom: spacing['5'] }}>
              <label style={labelStyle} htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby="login-error"
                autoComplete="email"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault }}
              />
            </div>

            <div style={{ marginBottom: spacing['5'] }}>
              <label style={labelStyle} htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby="login-error"
                autoComplete="current-password"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault }}
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: spacing['5'] }}>
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
              style={{
                width: '100%',
                padding: `${spacing['3']} ${spacing['4']}`,
                fontSize: typography.fontSize.body,
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
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = colors.orangeHover }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = colors.primaryOrange }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
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
                    {resetError}
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
