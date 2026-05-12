// src/pages/auth/VerifySuccess.tsx — BRT sub-2 §4.1
//
// Landing page after the user clicks the verification link in their email.
// At this point Supabase Auth has set the verified flag and (typically)
// auto-signed-in the user. We confirm and route them to onboarding.

import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function VerifySuccess() {
  const navigate = useNavigate()
  const { user, initialized } = useAuthStore()

  useEffect(() => {
    if (!initialized) return
    // Auto-redirect signed-in users so they don't sit on this success page.
    if (user) {
      const t = window.setTimeout(() => navigate('/onboarding'), 1500)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [user, initialized, navigate])

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <div
        aria-hidden="true"
        style={{
          width: 56, height: 56, borderRadius: 28,
          background: '#15803D20', color: '#15803D',
          margin: '0 auto 24px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 700,
        }}
      >
        ✓
      </div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Email verified</h1>
      {user ? (
        <p style={{ color: '#5C5C5C' }}>
          Taking you to onboarding…{' '}
          <Link to="/onboarding" style={{ color: '#0066FF' }}>Click here if you don't redirect.</Link>
        </p>
      ) : (
        <p style={{ color: '#5C5C5C' }}>
          Your email is confirmed.{' '}
          <Link to="/login" style={{ color: '#0066FF' }}>Sign in to continue.</Link>
        </p>
      )}
    </main>
  )
}
