import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'

export const Signup: React.FC = () => {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error: signUpError } = await signUp(email, password, name)

    if (signUpError) {
      setError(signUpError)
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
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
            <span style={{ color: '#fff', fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.title }}>S</span>
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

        {/* Signup Form */}
        <div
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            padding: spacing['8'],
            boxShadow: shadows.card,
          }}
        >
          <form onSubmit={handleSubmit}>
            {error && (
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
                {error}
              </div>
            )}

            <div style={{ marginBottom: spacing['5'] }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault }}
              />
            </div>

            <div style={{ marginBottom: spacing['5'] }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault }}
              />
            </div>

            <div style={{ marginBottom: spacing['5'] }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault }}
              />
            </div>

            <div style={{ marginBottom: spacing['6'] }}>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re enter your password"
                required
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderFocus }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderDefault }}
              />
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
                color: '#fff',
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
              {loading ? 'Creating Account...' : 'Create Account'}
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
