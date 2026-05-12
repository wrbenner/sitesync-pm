// src/pages/auth/VerifyPending.tsx — BRT sub-2 §4.1
//
// "Check your email" landing page after sign-up. The Supabase Auth flow
// has already sent the verification email; this page exists to:
//   - tell the user what to do next
//   - offer a resend (rate-limited at the Supabase Auth layer)
//   - explain why we don't drop them into the dashboard yet

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const COOLDOWN_MS = 60_000

export default function VerifyPending() {
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const [pending, setPending] = useState(false)
  const [hasResent, setHasResent] = useState(false)
  const [cooling, setCooling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cooldown timer: when set, flip back to "can resend" after COOLDOWN_MS.
  // No Date.now() during render — the effect owns the wall-clock read.
  useEffect(() => {
    if (!cooling) return
    const t = window.setTimeout(() => setCooling(false), COOLDOWN_MS)
    return () => window.clearTimeout(t)
  }, [cooling])

  const resend = async () => {
    if (!email) {
      setError('No email on file. Try signing in.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const { error: e } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (e) {
        setError(e.message)
      } else {
        setHasResent(true)
        setCooling(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resend failed')
    }
    setPending(false)
  }

  const canResend = !cooling

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Check your email</h1>
      <p style={{ color: '#5C5C5C', marginBottom: 12 }}>
        We sent a verification link to{' '}
        {email ? <strong style={{ color: '#1A1A1A' }}>{email}</strong> : 'your inbox'}.
      </p>
      <p style={{ color: '#5C5C5C', marginBottom: 32 }}>
        Click the link to finish setting up your account. The link expires in 24 hours.
      </p>

      {hasResent && (
        <p style={{ color: '#15803D', fontSize: 14, marginBottom: 16 }}>
          Verification email resent. Check your inbox (and spam folder).
        </p>
      )}

      {error && (
        <p style={{ color: '#7F1D1D', fontSize: 14, marginBottom: 16 }}>{error}</p>
      )}

      <button
        type="button"
        onClick={resend}
        disabled={pending || !canResend || !email}
        style={{
          padding: '10px 16px',
          background: 'white',
          border: '1px solid #D6D6D6',
          borderRadius: 6,
          cursor: pending || !canResend || !email ? 'not-allowed' : 'pointer',
          opacity: pending || !canResend || !email ? 0.6 : 1,
          fontSize: 14,
        }}
      >
        {pending ? 'Sending…' : !canResend ? 'Resend in 60s' : 'Resend verification email'}
      </button>

      <p style={{ marginTop: 32, fontSize: 13, color: '#5C5C5C' }}>
        Already verified? <Link to="/login" style={{ color: '#0066FF' }}>Sign in</Link>
      </p>
    </main>
  )
}
