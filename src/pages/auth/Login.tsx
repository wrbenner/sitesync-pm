import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, Eye, EyeOff, Mail, Lock, User, Shield,
  CheckCircle, ArrowRight, Sparkles, X,
  HardHat, BarChart3, FileCheck, Cloud,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme'
import { loginSchema, signupSchema, magicLinkSchema, resetPasswordSchema } from '../../schemas/auth'

/* ─────────────────────── Helpers ─────────────────────── */

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

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: colors.borderSubtle }
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++

  if (s <= 1) return { score: 1, label: 'Weak', color: colors.statusCritical }
  if (s <= 2) return { score: 2, label: 'Fair', color: colors.statusPending }
  if (s <= 3) return { score: 3, label: 'Good', color: colors.statusInfo }
  return { score: 4, label: 'Strong', color: colors.statusActive }
}

const APPLE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const FEATURES = [
  { icon: HardHat, label: 'Project Management', desc: 'RFIs, submittals, and change orders' },
  { icon: BarChart3, label: 'Real-Time Analytics', desc: 'Budget tracking and schedule insights' },
  { icon: FileCheck, label: 'Punch Lists', desc: 'Photo-attached, location-tagged items' },
  { icon: Cloud, label: 'AI-Powered', desc: 'Weather forecasts and risk analysis' },
]

/* ─────────────────────── Sub-components ─────────────────────── */

const PremiumInput: React.FC<{
  id: string
  type?: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: React.ReactNode
  required?: boolean
  autoComplete?: string
  autoFocus?: boolean
  error?: string | null
  onBlurValidate?: (val: string) => string | null
  rightElement?: React.ReactNode
}> = ({ id, type = 'text', label, value, onChange, placeholder, icon, required, autoComplete, autoFocus, error: externalError, onBlurValidate, rightElement }) => {
  const [focused, setFocused] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const error = externalError ?? localError

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          color: error ? colors.statusCritical : focused ? colors.textPrimary : colors.textSecondary,
          marginBottom: spacing['1.5'],
          transition: `color 120ms ease`,
          letterSpacing: typography.letterSpacing.wide,
        }}
      >
        {label}
      </label>
      {required && <span aria-hidden="true" style={{
        color: colors.primaryOrange, marginLeft: 2, position: 'relative',
        top: -spacing['1.5'], fontSize: typography.fontSize.sm,
      }}>*</span>}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)',
            color: error ? colors.statusCritical : focused ? colors.primaryOrange : colors.textTertiary,
            transition: `color 120ms ease`, display: 'flex', pointerEvents: 'none',
          }}>
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => { onChange(e.target.value); if (error) setLocalError(null) }}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false)
            if (onBlurValidate) setLocalError(onBlurValidate(e.target.value))
          }}
          style={{
            width: '100%',
            height: 48,
            padding: `0 ${rightElement ? '44px' : spacing['4']} 0 ${icon ? '40px' : spacing['4']}`,
            fontSize: typography.fontSize.body,
            fontFamily: typography.fontFamily,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceInset,
            border: `1px solid ${error ? colors.statusCritical : focused ? colors.primaryOrange : colors.borderSubtle}`,
            borderRadius: borderRadius.md,
            outline: 'none',
            boxShadow: focused ? `0 0 0 3px ${error ? colors.statusCriticalSubtle : colors.orangeSubtle}` : 'none',
            transition: `border-color 120ms ease, box-shadow 120ms ease`,
            boxSizing: 'border-box' as const,
            letterSpacing: typography.letterSpacing.normal,
          }}
        />
        {rightElement && (
          <span style={{
            position: 'absolute', right: spacing['3'], top: '50%', transform: 'translateY(-50%)',
            display: 'flex',
          }}>
            {rightElement}
          </span>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            id={`${id}-error`}
            role="alert"
            style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.statusCritical }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const PasswordStrengthBar: React.FC<{ password: string }> = ({ password }) => {
  const { score, label, color } = getPasswordStrength(password)
  if (!password) return null
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{ marginTop: spacing['1.5'] }}
    >
      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            backgroundColor: i <= score ? color : colors.borderSubtle,
            transition: `background-color 200ms ease`,
          }} />
        ))}
      </div>
      <span style={{ fontSize: typography.fontSize.caption, color, fontWeight: typography.fontWeight.medium }}>
        {label}
      </span>
    </motion.div>
  )
}

/* ─────────────────────── Main Component ─────────────────────── */

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn } = useAuth()

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
  const [showSignupPassword, setShowSignupPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEmailError(null)
    setPasswordError(null)

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors
      if (errs.email?.[0]) setEmailError(errs.email[0])
      if (errs.password?.[0]) setPasswordError(errs.password[0])
      return
    }

    setIsSubmitting(true)
    try {
      const result = await signIn(parsed.data.email, parsed.data.password)
      if (result.error) {
        setError(result.error)
      } else {
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
    setSignupEmailError(null)
    setSignupPasswordError(null)
    setSignupConfirmError(null)

    const parsed = signupSchema.safeParse({
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
      firstName: signupFirstName,
      lastName: signupLastName,
      organization: 'pending',
    })
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors
      if (errs.email?.[0]) setSignupEmailError(errs.email[0])
      if (errs.password?.[0]) setSignupPasswordError(errs.password[0])
      if (errs.confirmPassword?.[0]) setSignupConfirmError(errs.confirmPassword[0])
      return
    }

    setSignupSubmitting(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: {
            first_name: parsed.data.firstName.trim(),
            last_name: parsed.data.lastName.trim(),
          },
        },
      })

      if (signUpError) {
        setSignupError(mapAuthError(signUpError.message))
      } else if (data.session) {
        navigate('/dashboard')
      } else {
        setSignupSuccess(true)
      }
    } finally {
      setSignupSubmitting(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setMagicError(null)

    const parsed = magicLinkSchema.safeParse({ email: magicEmail })
    if (!parsed.success) {
      setMagicError(parsed.error.flatten().fieldErrors.email?.[0] ?? 'Invalid email')
      return
    }

    setMagicLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email: parsed.data.email })
      if (otpError) setMagicError(mapAuthError(otpError.message))
      else setMagicSuccess(true)
    } finally {
      setMagicLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)

    const parsed = resetPasswordSchema.safeParse({ email: resetEmail })
    if (!parsed.success) {
      setResetError(parsed.error.flatten().fieldErrors.email?.[0] ?? 'Invalid email')
      return
    }

    setResetLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsed.data.email)
    if (err) setResetError(mapAuthError(err.message))
    else setResetSent(true)
    setResetLoading(false)
  }

  // ─── Shared button style ────────
  const primaryBtnStyle = (loading: boolean): React.CSSProperties => ({
    width: '100%',
    height: 48,
    padding: `0 ${spacing['6']}`,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily,
    color: colors.white,
    background: loading
      ? colors.orangeHover
      : `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
    border: 'none',
    borderRadius: borderRadius.md,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: `all 160ms ease`,
    letterSpacing: typography.letterSpacing.normal,
    opacity: loading ? 0.8 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    boxShadow: loading ? 'none' : '0 2px 8px rgba(244, 120, 32, 0.25)',
  })

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: typography.fontFamily,
    }}>
      <style>{`
        @keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes float-glow { 0%, 100% { opacity: 0.4; transform: translateY(0); } 50% { opacity: 0.7; transform: translateY(-8px); } }
      `}</style>

      {/* ─── Left Panel — Brand Showcase ─── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing['12'],
        background: `linear-gradient(145deg, #1A1613 0%, #2A1F16 50%, #1A1613 100%)`,
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100vh',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute',
          width: 400, height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(244, 120, 32, 0.12) 0%, transparent 70%)`,
          top: '20%', left: '30%',
          animation: 'float-glow 6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: APPLE_EASE }}
          style={{ position: 'relative', zIndex: 1, maxWidth: 440, width: '100%' }}
        >
          {/* Logo */}
          <div style={{
            width: 48, height: 48,
            borderRadius: borderRadius.xl,
            background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing['8'],
            boxShadow: '0 4px 20px rgba(244, 120, 32, 0.3)',
          }}>
            <span style={{
              color: colors.white,
              fontSize: typography.fontSize.medium,
              fontWeight: typography.fontWeight.bold,
            }}>S</span>
          </div>

          <h1 style={{
            fontSize: '36px',
            fontWeight: typography.fontWeight.bold,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: typography.letterSpacing.tighter,
            lineHeight: typography.lineHeight.tight,
          }}>
            Build smarter.
            <br />
            <span style={{ color: colors.primaryOrange }}>Ship faster.</span>
          </h1>

          <p style={{
            fontSize: typography.fontSize.title,
            color: 'rgba(255,255,255,0.55)',
            margin: 0, marginTop: spacing['4'],
            lineHeight: typography.lineHeight.relaxed,
            maxWidth: 360,
          }}>
            Construction management powered by real-time data and AI insights.
          </p>

          {/* Feature cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: spacing['3'], marginTop: spacing['10'],
          }}>
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.4, ease: APPLE_EASE }}
                style={{
                  padding: spacing['4'],
                  borderRadius: borderRadius.lg,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <feat.icon size={20} color={colors.primaryOrange} strokeWidth={1.5} />
                <p style={{
                  margin: 0, marginTop: spacing['2'],
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  color: 'rgba(255,255,255,0.85)',
                }}>
                  {feat.label}
                </p>
                <p style={{
                  margin: 0, marginTop: 2,
                  fontSize: typography.fontSize.caption,
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── Right Panel — Auth Forms ─── */}
      <div style={{
        width: 520,
        minWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing['10']} ${spacing['12']}`,
        backgroundColor: colors.surfacePage,
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Header */}
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{ marginBottom: spacing['6'] }}
          >
            <h2 style={{
              fontSize: typography.fontSize.large,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: typography.letterSpacing.tight,
            }}>
              {tab === 'signin' ? 'Welcome back' : tab === 'signup' ? 'Create your account' : 'Magic link sign in'}
            </h2>
            <p style={{
              fontSize: typography.fontSize.body,
              color: colors.textTertiary,
              margin: 0, marginTop: spacing['1.5'],
            }}>
              {tab === 'signin'
                ? 'Sign in to access your projects'
                : tab === 'signup'
                  ? 'Start managing construction with AI'
                  : 'We\'ll send a link to your email'
              }
            </p>
          </motion.div>

          {/* Tab Toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.md,
            padding: 3,
            marginBottom: spacing['6'],
            position: 'relative',
          }}>
            {(['signin', 'magic', 'signup'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null); setSignupError(null); setMagicError(null); setMagicSuccess(false) }}
                style={{
                  flex: 1,
                  padding: `${spacing['2']} ${spacing['3']}`,
                  fontSize: typography.fontSize.sm,
                  fontWeight: tab === t ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  fontFamily: typography.fontFamily,
                  color: tab === t ? colors.textPrimary : colors.textTertiary,
                  background: tab === t ? colors.surfaceRaised : 'transparent',
                  border: 'none',
                  borderRadius: borderRadius.base,
                  cursor: 'pointer',
                  transition: `all 120ms ease`,
                  boxShadow: tab === t ? shadows.sm : 'none',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {t === 'signin' ? 'Sign In' : t === 'magic' ? 'Magic Link' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Form Card */}
          <div style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            padding: spacing['7'],
            boxShadow: shadows.card,
            border: `1px solid ${colors.borderSubtle}`,
          }}>
            <AnimatePresence mode="wait">
              {/* ─── Sign In Form ─── */}
              {tab === 'signin' && (
                <motion.form
                  key="signin"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSubmit}
                  aria-label="Sign in to SiteSync"
                  style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}
                >
                  <PremiumInput
                    id="login-email"
                    type="email"
                    label="Email address"
                    value={email}
                    onChange={(v) => { setEmail(v); if (emailError) setEmailError(null) }}
                    placeholder="you@company.com"
                    icon={<Mail size={16} />}
                    required
                    autoComplete="email"
                    autoFocus
                    error={emailError}
                    onBlurValidate={(v) => v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter a valid email' : null}
                  />

                  <PremiumInput
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Enter your password"
                    icon={<Lock size={16} />}
                    required
                    autoComplete="current-password"
                    error={passwordError}
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, display: 'flex', color: colors.textTertiary,
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        role="alert"
                        style={{
                          padding: `${spacing['3']} ${spacing['4']}`,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.statusCriticalSubtle,
                          color: colors.statusCritical,
                          fontSize: typography.fontSize.sm,
                          border: `1px solid ${colors.statusCritical}20`,
                        }}
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => { setShowReset(true); setResetEmail(email); setResetSent(false); setResetError(null) }}
                      style={{
                        background: 'none', border: 'none',
                        color: colors.orangeText,
                        fontSize: typography.fontSize.sm,
                        fontFamily: typography.fontFamily,
                        cursor: 'pointer', padding: 0,
                        fontWeight: typography.fontWeight.medium,
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" disabled={isSubmitting} style={primaryBtnStyle(isSubmitting)}>
                    {isSubmitting && <Loader2 size={16} style={{ animation: 'spin-loader 0.75s linear infinite' }} />}
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                    {!isSubmitting && <ArrowRight size={16} />}
                  </button>
                </motion.form>
              )}

              {/* ─── Magic Link Form ─── */}
              {tab === 'magic' && (
                <motion.div
                  key="magic"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  {magicSuccess ? (
                    <div style={{ textAlign: 'center', padding: `${spacing['6']} 0` }}>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        style={{
                          width: 56, height: 56, borderRadius: borderRadius.full,
                          background: `linear-gradient(135deg, ${colors.statusActive}, #34D399)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto', marginBottom: spacing['4'],
                          boxShadow: '0 4px 20px rgba(74, 222, 128, 0.3)',
                        }}
                      >
                        <CheckCircle size={28} color={colors.white} strokeWidth={2.5} />
                      </motion.div>
                      <h3 style={{
                        margin: 0, fontSize: typography.fontSize.subtitle,
                        fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
                      }}>
                        Check your email
                      </h3>
                      <p style={{
                        margin: 0, marginTop: spacing['2'],
                        fontSize: typography.fontSize.body, color: colors.textSecondary,
                      }}>
                        We sent a sign-in link to <strong>{magicEmail}</strong>
                      </p>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleMagicLink}
                      style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}
                    >
                      <AnimatePresence>
                        {magicError && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            role="alert"
                            style={{
                              padding: `${spacing['3']} ${spacing['4']}`,
                              borderRadius: borderRadius.md,
                              backgroundColor: colors.statusCriticalSubtle,
                              color: colors.statusCritical,
                              fontSize: typography.fontSize.sm,
                            }}
                          >
                            {magicError}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <PremiumInput
                        id="magic-email"
                        type="email"
                        label="Email address"
                        value={magicEmail}
                        onChange={setMagicEmail}
                        placeholder="you@company.com"
                        icon={<Mail size={16} />}
                        required
                        autoComplete="email"
                        autoFocus
                      />

                      <button type="submit" disabled={magicLoading} style={primaryBtnStyle(magicLoading)}>
                        {magicLoading && <Loader2 size={16} style={{ animation: 'spin-loader 0.75s linear infinite' }} />}
                        {magicLoading ? 'Sending...' : 'Send Magic Link'}
                        {!magicLoading && <Sparkles size={16} />}
                      </button>
                    </form>
                  )}
                </motion.div>
              )}

              {/* ─── Sign Up Form ─── */}
              {tab === 'signup' && (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  {signupSuccess ? (
                    <div style={{ textAlign: 'center', padding: `${spacing['6']} 0` }}>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        style={{
                          width: 56, height: 56, borderRadius: borderRadius.full,
                          background: `linear-gradient(135deg, ${colors.statusActive}, #34D399)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto', marginBottom: spacing['4'],
                          boxShadow: '0 4px 20px rgba(74, 222, 128, 0.3)',
                        }}
                      >
                        <CheckCircle size={28} color={colors.white} strokeWidth={2.5} />
                      </motion.div>
                      <h3 style={{
                        margin: 0, fontSize: typography.fontSize.subtitle,
                        fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
                      }}>
                        Account created
                      </h3>
                      <p style={{
                        margin: 0, marginTop: spacing['2'],
                        fontSize: typography.fontSize.body, color: colors.textSecondary,
                      }}>
                        Check your email to confirm your account
                      </p>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSignUp}
                      style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}
                    >
                      <AnimatePresence>
                        {signupError && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            role="alert"
                            style={{
                              padding: `${spacing['3']} ${spacing['4']}`,
                              borderRadius: borderRadius.md,
                              backgroundColor: colors.statusCriticalSubtle,
                              color: colors.statusCritical,
                              fontSize: typography.fontSize.sm,
                            }}
                          >
                            {signupError}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Name fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
                        <PremiumInput
                          id="signup-first-name"
                          label="First name"
                          value={signupFirstName}
                          onChange={setSignupFirstName}
                          placeholder="Jane"
                          icon={<User size={16} />}
                          required
                          autoComplete="given-name"
                          autoFocus
                        />
                        <PremiumInput
                          id="signup-last-name"
                          label="Last name"
                          value={signupLastName}
                          onChange={setSignupLastName}
                          placeholder="Smith"
                          required
                          autoComplete="family-name"
                        />
                      </div>

                      <PremiumInput
                        id="signup-email"
                        type="email"
                        label="Work email"
                        value={signupEmail}
                        onChange={(v) => { setSignupEmail(v); if (signupEmailError) setSignupEmailError(null) }}
                        placeholder="you@construction.com"
                        icon={<Mail size={16} />}
                        required
                        autoComplete="email"
                        error={signupEmailError}
                        onBlurValidate={(v) => v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Please enter a valid email' : null}
                      />

                      <div>
                        <PremiumInput
                          id="signup-password"
                          type={showSignupPassword ? 'text' : 'password'}
                          label="Password"
                          value={signupPassword}
                          onChange={(v) => { setSignupPassword(v); if (signupPasswordError) setSignupPasswordError(null) }}
                          placeholder="At least 8 characters"
                          icon={<Lock size={16} />}
                          required
                          autoComplete="new-password"
                          error={signupPasswordError}
                          onBlurValidate={(v) => v && v.length < 8 ? 'Must be at least 8 characters' : null}
                          rightElement={
                            <button
                              type="button"
                              onClick={() => setShowSignupPassword(!showSignupPassword)}
                              aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: 0, display: 'flex', color: colors.textTertiary,
                              }}
                            >
                              {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          }
                        />
                        <PasswordStrengthBar password={signupPassword} />
                      </div>

                      <PremiumInput
                        id="signup-confirm-password"
                        type="password"
                        label="Confirm password"
                        value={signupConfirmPassword}
                        onChange={(v) => { setSignupConfirmPassword(v); if (signupConfirmError) setSignupConfirmError(null) }}
                        placeholder="Re-enter your password"
                        icon={<Shield size={16} />}
                        required
                        autoComplete="new-password"
                        error={signupConfirmError}
                        onBlurValidate={(v) => v && v !== signupPassword ? 'Passwords do not match' : null}
                      />

                      <button type="submit" disabled={signupSubmitting} style={primaryBtnStyle(signupSubmitting)}>
                        {signupSubmitting && <Loader2 size={16} style={{ animation: 'spin-loader 0.75s linear infinite' }} />}
                        {signupSubmitting ? 'Creating account...' : 'Create Account'}
                        {!signupSubmitting && <ArrowRight size={16} />}
                      </button>

                      <p style={{
                        margin: 0, fontSize: typography.fontSize.caption,
                        color: colors.textTertiary, textAlign: 'center',
                        lineHeight: typography.lineHeight.normal,
                      }}>
                        By signing up, you agree to our terms of service and privacy policy.
                      </p>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom link */}
          <p style={{
            textAlign: 'center',
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            marginTop: spacing['6'],
          }}>
            {tab === 'signin' ? (
              <>
                No account yet?{' '}
                <button
                  type="button"
                  onClick={() => { setTab('signup'); setError(null) }}
                  style={{
                    background: 'none', border: 'none',
                    color: colors.orangeText,
                    fontSize: 'inherit', fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    cursor: 'pointer', padding: 0,
                  }}
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
                  style={{
                    background: 'none', border: 'none',
                    color: colors.orangeText,
                    fontSize: 'inherit', fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ─── Reset Password Modal ─── */}
      <AnimatePresence>
        {showReset && (
          <div
            style={{
              position: 'fixed', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: zIndex.modal as number,
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReset(false)}
              style={{
                position: 'absolute', inset: 0,
                backgroundColor: colors.overlayScrim,
                backdropFilter: 'blur(4px)',
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.25, ease: APPLE_EASE }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.xl,
                padding: spacing['7'],
                width: '100%',
                maxWidth: 400,
                boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: spacing['4'],
              }}>
                <div>
                  <h2 style={{
                    fontSize: typography.fontSize.subtitle,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                    margin: 0,
                    letterSpacing: typography.letterSpacing.tight,
                  }}>
                    Reset Password
                  </h2>
                  <p style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textTertiary,
                    margin: 0, marginTop: spacing['1'],
                  }}>
                    We'll send a reset link to your email
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReset(false)}
                  style={{
                    width: 28, height: 28, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', backgroundColor: 'transparent',
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.base, cursor: 'pointer',
                    color: colors.textTertiary,
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {resetSent ? (
                <div>
                  <div style={{
                    textAlign: 'center', padding: `${spacing['4']} 0 ${spacing['5']}`,
                  }}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                      style={{
                        width: 48, height: 48, borderRadius: borderRadius.full,
                        background: `linear-gradient(135deg, ${colors.statusActive}, #34D399)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto', marginBottom: spacing['3'],
                      }}
                    >
                      <CheckCircle size={24} color={colors.white} strokeWidth={2.5} />
                    </motion.div>
                    <p style={{
                      fontSize: typography.fontSize.body, color: colors.textSecondary,
                      margin: 0,
                    }}>
                      Check your email for a reset link
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    style={{
                      width: '100%', padding: `${spacing['2.5']} ${spacing['4']}`,
                      fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
                      fontFamily: typography.fontFamily, color: colors.textSecondary,
                      backgroundColor: colors.surfaceInset,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: borderRadius.md, cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
                  <AnimatePresence>
                    {resetError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          padding: `${spacing['3']} ${spacing['4']}`,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.statusCriticalSubtle,
                          color: colors.statusCritical,
                          fontSize: typography.fontSize.sm,
                        }}
                      >
                        {mapAuthError(resetError)}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <PremiumInput
                    id="reset-email"
                    type="email"
                    label="Email address"
                    value={resetEmail}
                    onChange={setResetEmail}
                    placeholder="you@company.com"
                    icon={<Mail size={16} />}
                    required
                    autoComplete="email"
                    autoFocus
                  />

                  <div style={{ display: 'flex', gap: spacing['3'] }}>
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      style={{
                        flex: 1, height: 44,
                        fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
                        fontFamily: typography.fontFamily, color: colors.textSecondary,
                        backgroundColor: colors.surfaceInset,
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.md, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      style={{
                        flex: 1, height: 44,
                        fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                        fontFamily: typography.fontFamily, color: colors.white,
                        background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
                        border: 'none',
                        borderRadius: borderRadius.md,
                        cursor: resetLoading ? 'not-allowed' : 'pointer',
                        opacity: resetLoading ? 0.8 : 1,
                      }}
                    >
                      {resetLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
