// src/pages/auth/VerifyPending.tsx — BRT sub-2 §4.1
//
// Landing page after sign-up (or after a sign-in attempt on an unverified
// account). Tells the user to check their email and offers a resend link.
// The Supabase verification email itself is sent server-side by the
// signUp call — this page is just the human-facing waiting room.

import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Mail, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface LocationState {
  email?: string
}

export const VerifyPending: React.FC = () => {
  const location = useLocation()
  const stateEmail = (location.state as LocationState | null)?.email ?? null

  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)

  const resend = async () => {
    if (!stateEmail) {
      setResendError('We don\'t have your email here — sign in again or use the link in your original email.')
      setResendStatus('error')
      return
    }
    setResendStatus('sending')
    setResendError(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email: stateEmail })
    if (error) {
      setResendError(error.message)
      setResendStatus('error')
      return
    }
    setResendStatus('sent')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        backgroundColor: colors.surfacePage,
        fontFamily: typography.fontFamily,
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: '#FFF1E6',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing['4'],
          }}
          aria-hidden="true"
        >
          <Mail size={24} color={colors.primaryOrange} />
        </div>

        <h1
          style={{
            fontFamily: '"EB Garamond", Garamond, "Cormorant Garamond", "Times New Roman", serif',
            fontStyle: 'italic',
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1.15,
            color: colors.textPrimary,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Check your inbox.
        </h1>

        <p
          style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            margin: 0,
            marginTop: spacing['3'],
            marginBottom: spacing['5'],
            lineHeight: typography.lineHeight.normal,
          }}
        >
          {stateEmail ? (
            <>We sent a verification link to <strong style={{ color: colors.textPrimary }}>{stateEmail}</strong>.</>
          ) : (
            <>We sent a verification link to your email.</>
          )}
          {' '}Click it to activate your SiteSync account.
        </p>

        <div
          style={{
            padding: spacing['4'],
            borderRadius: borderRadius.md,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderDefault}`,
            textAlign: 'left',
            marginBottom: spacing['5'],
          }}
        >
          <p
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              margin: 0,
              marginBottom: spacing['2'],
            }}
          >
            Didn't see the email?
          </p>
          <ul
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              margin: 0,
              paddingLeft: spacing['4'],
              lineHeight: typography.lineHeight.normal,
            }}
          >
            <li>Check your spam folder.</li>
            <li>The link expires in 24 hours.</li>
            <li>Make sure you entered the right email.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={resend}
          disabled={resendStatus === 'sending' || resendStatus === 'sent'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            padding: '10px 20px',
            backgroundColor: resendStatus === 'sent' ? '#E6F9F1' : colors.primaryOrange,
            color: resendStatus === 'sent' ? '#0F5132' : colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.medium,
            cursor: resendStatus === 'sending' ? 'wait' : (resendStatus === 'sent' ? 'default' : 'pointer'),
            opacity: resendStatus === 'sending' ? 0.7 : 1,
            transition: 'background-color 0.15s ease',
          }}
        >
          {resendStatus === 'sending' && (
            <Loader2
              size={16}
              style={{ animation: 'spin-loader 0.8s linear infinite' }}
              aria-hidden="true"
            />
          )}
          {resendStatus === 'sent'
            ? 'Sent — check your inbox'
            : resendStatus === 'sending'
              ? 'Sending…'
              : 'Resend verification email'}
        </button>
        <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {resendError && (
          <p
            role="alert"
            style={{
              marginTop: spacing['3'],
              fontSize: typography.fontSize.sm,
              color: colors.statusCritical,
            }}
          >
            {resendError}
          </p>
        )}

        <div style={{ marginTop: spacing['6'] }}>
          <Link
            to="/login"
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              textDecoration: 'none',
            }}
          >
            Already verified? Sign in →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default VerifyPending
