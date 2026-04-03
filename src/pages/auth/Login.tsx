import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme'

function mapAuthError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('invalid') || msg.includes('credentials')) return 'Email or password is incorrect'
  if (msg.includes('email not confirmed')) return 'Please check your email to confirm your account'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts. Please try again in a few minutes'
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) return 'Unable to connect. Check your internet connection'
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'An account with this email already exists'
  if (msg.includes('user already registered')) return 'An account with this email already exists'
  if (msg.includes('password') && msg.includes('short')) return 'Password must be at least 6 characters'
  return message
}

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Tab state
  const [tab, setTab] = useState<'signin' | 'signup' | 'magic'>('signin')

  // Sign in state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)

  // Magic link state
  const [magicEmail, setMagicEmail] = useState('')
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSuccess, setMagicSuccess] = useState(false)
  const [magicError, setMagicError] = useState<string | null>(null)

  // Sign up state
  const [signupFirstName, setSignupFirstName] = useState('')
  const [signupLastName, setSignupLastName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [signupSubmitting, setSignupSubmitting] = useState(false)
  const [signupEmailError, setSignupEmailError] = useState<string | null>(null)
  const [signupPasswordError, setSignupPasswordError] = useState<string | null>(null)
  const [signupConfirmError, setSignupConfirmError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(mapAuthError(signInError.message))
      } else if (data.session) {
        const returnTo = searchParams.get('returnTo')
        const destination = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard'
        navigate(destination)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignupError(null)

    // Validate before submitting
    let hasError = false
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) {
      setSignupEmailError('Please enter a valid email address')
      hasError = true
    }
    if (signupPassword.length < 8) {
      setSignupPasswordError('Password must be at least 8 characters')
      hasError = true
    }
    if (signupPassword !== signupConfirmPassword) {
      setSignupConfirmError('Passwords do not match')
      hasError = true
    }
    if (hasError) return

    setSignupSubmitting(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            first_name: signupFirstName.trim(),
            last_name: signupLastName.trim(),
          },
        },
      })

      if (signUpError) {
        setSignupError(mapAuthError(signUpError.message))
      } else if (data.session) {
        // Email confirmation is disabled — user is already signed in
        navigate('/dashboard')
      } else {
        // Email confirmation required
        setSignupSuccess(true)
      }
    } finally {
      setSignupSubmitting(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setMagicError(null)
    setMagicLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email: magicEmail })
      if (otpError) {
        setMagicError(mapAuthError(otpError.message))
      } else {
        setMagicSuccess(true)
      }
    } finally {
      setMagicLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)
    setResetLoading(true)

    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail)

    if (err) {
      setResetError(mapAuthError(err.message))
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
            {tab === 'signin' ? 'Sign in to your account' : tab === 'magic' ? 'Sign in without a password' : 'Create a new account'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${colors.borderDefault}`,
            marginBottom: spacing['5'],
          }}
        >
          {(['signin', 'magic', 'signup'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError(null); setSignupError(null); setMagicError(null); setMagicSuccess(false) }}
              style={{
                flex: 1,
                padding: `${spacing['3']} ${spacing['2']}`,
                fontSize: typography.fontSize.sm,
                fontWeight: tab === t ? typography.fontWeight.semibold : typography.fontWeight.normal,
                fontFamily: typography.fontFamily,
                color: tab === t ? colors.primaryOrange : colors.textSecondary,
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
                marginBottom: '-1px',
                cursor: 'pointer',
                transition: `color ${transitions.quick}, border-color ${transitions.quick}`,
                letterSpacing: typography.letterSpacing.normal,
              }}
            >
              {t === 'signin' ? 'Sign In' : t === 'magic' ? 'Magic Link' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Form Card */}
        <div
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            padding: spacing['8'],
            boxShadow: shadows.card,
          }}
        >
          <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <form onSubmit={handleSubmit} aria-label="Sign in to SiteSync" aria-describedby="login-error" style={{ display: tab === 'signin' ? 'block' : 'none' }}>
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
                    setEmailError('Enter a valid email address')
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
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                  autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus; e.currentTarget.style.boxShadow = '0 0 0 2px #F47820' }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.borderDefault
                    e.currentTarget.style.boxShadow = 'none'
                    if (!e.currentTarget.value) setPasswordError('Password is required')
                    else setPasswordError(null)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: colors.textTertiary,
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p role="alert" style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                  {passwordError}
                </p>
              )}
            </div>

            {error && (
              <div role="alert" aria-live="polite" style={{ color: '#E74C3C', fontSize: '14px', padding: '8px 12px', backgroundColor: '#FEF2F2', borderRadius: '8px', marginTop: '8px', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}

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
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              style={{
                width: '100%',
                minWidth: '160px',
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
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Magic Link Form */}
          {tab === 'magic' && (
            <form onSubmit={handleMagicLink} aria-label="Sign in with magic link">
              {magicSuccess ? (
                <div
                  role="status"
                  style={{
                    padding: `${spacing['4']} ${spacing['5']}`,
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.statusActiveSubtle,
                    color: colors.statusActive,
                    fontSize: typography.fontSize.sm,
                    lineHeight: typography.lineHeight.normal,
                    textAlign: 'center',
                  }}
                >
                  Check your email for a sign in link.
                </div>
              ) : (
                <>
                  {magicError && (
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
                      {magicError}
                    </div>
                  )}
                  <div style={{ marginBottom: spacing['6'] }}>
                    <label style={labelStyle} htmlFor="magic-email">Email address</label>
                    <input
                      type="email"
                      id="magic-email"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus; e.currentTarget.style.boxShadow = '0 0 0 2px #F47820' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={magicLoading}
                    aria-busy={magicLoading}
                    style={{
                      width: '100%',
                      height: '48px',
                      padding: `${spacing['3']} ${spacing['4']}`,
                      fontSize: '16px',
                      fontWeight: typography.fontWeight.semibold,
                      fontFamily: typography.fontFamily,
                      color: colors.white,
                      backgroundColor: magicLoading ? colors.orangeHover : colors.primaryOrange,
                      border: 'none',
                      borderRadius: borderRadius.md,
                      cursor: magicLoading ? 'not-allowed' : 'pointer',
                      transition: `background-color ${transitions.quick}`,
                      opacity: magicLoading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing['2'],
                    }}
                    onMouseEnter={(e) => { if (!magicLoading) e.currentTarget.style.backgroundColor = colors.orangeHover }}
                    onMouseLeave={(e) => { if (!magicLoading) e.currentTarget.style.backgroundColor = colors.primaryOrange }}
                  >
                    {magicLoading && <Loader2 size={16} style={{ animation: 'spin-loader 0.75s linear infinite' }} />}
                    {magicLoading ? 'Sending link...' : 'Send Magic Link'}
                  </button>
                </>
              )}
            </form>
          )}

          {/* Sign Up Form */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp} aria-label="Create a SiteSync account" aria-describedby="signup-error">
              {signupSuccess ? (
                <div
                  role="status"
                  style={{
                    padding: `${spacing['4']} ${spacing['5']}`,
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.statusActiveSubtle,
                    color: colors.statusActive,
                    fontSize: typography.fontSize.sm,
                    lineHeight: typography.lineHeight.normal,
                    textAlign: 'center',
                  }}
                >
                  Check your email to confirm your account.
                </div>
              ) : (
                <>
                  {signupError && (
                    <div
                      id="signup-error"
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
                      {signupError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['4'] }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle} htmlFor="signup-first-name">First Name</label>
                      <input
                        type="text"
                        id="signup-first-name"
                        value={signupFirstName}
                        onChange={(e) => setSignupFirstName(e.target.value)}
                        placeholder="Jane"
                        required
                        autoComplete="given-name"
                        style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus; e.currentTarget.style.boxShadow = '0 0 0 2px #F47820' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; e.currentTarget.style.boxShadow = 'none' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle} htmlFor="signup-last-name">Last Name</label>
                      <input
                        type="text"
                        id="signup-last-name"
                        value={signupLastName}
                        onChange={(e) => setSignupLastName(e.target.value)}
                        placeholder="Smith"
                        required
                        autoComplete="family-name"
                        style={inputStyle}
                        onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus; e.currentTarget.style.boxShadow = '0 0 0 2px #F47820' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; e.currentTarget.style.boxShadow = 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: spacing['4'] }}>
                    <label style={labelStyle} htmlFor="signup-email">Email address</label>
                    <input
                      type="email"
                      id="signup-email"
                      value={signupEmail}
                      onChange={(e) => { setSignupEmail(e.target.value); if (signupEmailError) setSignupEmailError(null) }}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      aria-invalid={!!signupEmailError}
                      aria-describedby={signupEmailError ? 'signup-email-error' : undefined}
                      style={{ ...inputStyle, borderColor: signupEmailError ? colors.statusCritical : inputStyle.borderColor }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = signupEmailError ? colors.statusCritical : colors.borderFocus; e.currentTarget.style.boxShadow = signupEmailError ? 'none' : '0 0 0 2px #F47820' }}
                      onBlur={(e) => {
                        const val = e.currentTarget.value
                        if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                          setSignupEmailError('Please enter a valid email address')
                          e.currentTarget.style.borderColor = colors.statusCritical
                        } else {
                          setSignupEmailError(null)
                          e.currentTarget.style.borderColor = colors.borderDefault
                        }
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                    {signupEmailError && (
                      <p id="signup-email-error" role="alert" style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                        {signupEmailError}
                      </p>
                    )}
                  </div>

                  <div style={{ marginBottom: spacing['4'] }}>
                    <label style={labelStyle} htmlFor="signup-password">Password</label>
                    <input
                      type="password"
                      id="signup-password"
                      value={signupPassword}
                      onChange={(e) => { setSignupPassword(e.target.value); if (signupPasswordError) setSignupPasswordError(null) }}
                      placeholder="At least 8 characters"
                      required
                      autoComplete="new-password"
                      aria-invalid={!!signupPasswordError}
                      aria-describedby={signupPasswordError ? 'signup-password-error' : undefined}
                      style={{ ...inputStyle, borderColor: signupPasswordError ? colors.statusCritical : inputStyle.borderColor }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = signupPasswordError ? colors.statusCritical : colors.borderFocus; e.currentTarget.style.boxShadow = signupPasswordError ? 'none' : '0 0 0 2px #F47820' }}
                      onBlur={(e) => {
                        if (e.currentTarget.value && e.currentTarget.value.length < 8) {
                          setSignupPasswordError('Password must be at least 8 characters')
                          e.currentTarget.style.borderColor = colors.statusCritical
                        } else {
                          setSignupPasswordError(null)
                          e.currentTarget.style.borderColor = colors.borderDefault
                        }
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                    {signupPasswordError && (
                      <p id="signup-password-error" role="alert" style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                        {signupPasswordError}
                      </p>
                    )}
                  </div>

                  <div style={{ marginBottom: spacing['6'] }}>
                    <label style={labelStyle} htmlFor="signup-confirm-password">Confirm Password</label>
                    <input
                      type="password"
                      id="signup-confirm-password"
                      value={signupConfirmPassword}
                      onChange={(e) => { setSignupConfirmPassword(e.target.value); if (signupConfirmError) setSignupConfirmError(null) }}
                      placeholder="Re-enter your password"
                      required
                      autoComplete="new-password"
                      aria-invalid={!!signupConfirmError}
                      aria-describedby={signupConfirmError ? 'signup-confirm-error' : undefined}
                      style={{ ...inputStyle, borderColor: signupConfirmError ? colors.statusCritical : inputStyle.borderColor }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = signupConfirmError ? colors.statusCritical : colors.borderFocus; e.currentTarget.style.boxShadow = signupConfirmError ? 'none' : '0 0 0 2px #F47820' }}
                      onBlur={(e) => {
                        if (e.currentTarget.value && e.currentTarget.value !== signupPassword) {
                          setSignupConfirmError('Passwords do not match')
                          e.currentTarget.style.borderColor = colors.statusCritical
                        } else {
                          setSignupConfirmError(null)
                          e.currentTarget.style.borderColor = colors.borderDefault
                        }
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                    {signupConfirmError && (
                      <p id="signup-confirm-error" role="alert" style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.statusCritical }}>
                        {signupConfirmError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={signupSubmitting}
                    aria-busy={signupSubmitting}
                    style={{
                      width: '100%',
                      minWidth: '160px',
                      height: '48px',
                      padding: `${spacing['3']} ${spacing['4']}`,
                      fontSize: '16px',
                      fontWeight: typography.fontWeight.semibold,
                      fontFamily: typography.fontFamily,
                      color: colors.white,
                      backgroundColor: signupSubmitting ? colors.orangeHover : colors.primaryOrange,
                      border: 'none',
                      borderRadius: borderRadius.md,
                      cursor: signupSubmitting ? 'not-allowed' : 'pointer',
                      transition: `background-color ${transitions.quick}`,
                      letterSpacing: typography.letterSpacing.normal,
                      opacity: signupSubmitting ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing['2'],
                    }}
                    onMouseEnter={(e) => { if (!signupSubmitting) e.currentTarget.style.backgroundColor = colors.orangeHover }}
                    onMouseLeave={(e) => { if (!signupSubmitting) e.currentTarget.style.backgroundColor = colors.primaryOrange }}
                  >
                    {signupSubmitting && <Loader2 size={16} style={{ animation: 'spin-loader 0.75s linear infinite' }} />}
                    {signupSubmitting ? 'Creating account...' : 'Create Account'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>

        {/* Bottom toggle link */}
        <p
          style={{
            textAlign: 'center',
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            marginTop: spacing['6'],
            letterSpacing: typography.letterSpacing.normal,
          }}
        >
          {tab === 'signin' ? (
            <>
              No account yet?{' '}
              <button
                type="button"
                onClick={() => { setTab('signup'); setError(null) }}
                style={{ background: 'none', border: 'none', color: colors.orangeText, fontSize: 'inherit', fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium, cursor: 'pointer', padding: 0 }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setTab('signin'); setSignupError(null) }}
                style={{ background: 'none', border: 'none', color: colors.orangeText, fontSize: 'inherit', fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium, cursor: 'pointer', padding: 0 }}
              >
                Sign in
              </button>
            </>
          )}
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
