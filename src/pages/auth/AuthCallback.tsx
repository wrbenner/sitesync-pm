// src/pages/auth/AuthCallback.tsx — BRT sub-2 §4.2
//
// OAuth callback handler. After the user completes Google sign-in, the
// browser lands here with a session in the URL hash. supabase-js processes
// the hash automatically on init; this page waits for the auth store to
// surface the user, then either:
//   - First-time user (no profile yet) → /onboarding to provision the org
//   - Returning user (has profile + organization_id) → /day
//   - Returning user with no org → /onboarding (fallback for half-provisioned)

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { user, profile, organization, initialized } = useAuthStore()
  const [waited, setWaited] = useState(false)

  // Give supabase-js a beat to process the hash + populate authStore.
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 4000)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!initialized || !user) return
    // Has a fully-provisioned account? Send to dashboard.
    if (profile?.organization_id && organization) {
      navigate('/day', { replace: true })
      return
    }
    // Has profile but no org → finish onboarding.
    navigate('/onboarding', { replace: true })
  }, [initialized, user, profile, organization, navigate])

  if (!initialized || (!user && !waited)) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        <p style={{ color: '#5C5C5C' }}>Finishing sign-in…</p>
      </main>
    )
  }

  if (!user && waited) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>Sign-in didn't complete</h1>
        <p style={{ color: '#5C5C5C', marginBottom: 16 }}>
          The sign-in attempt didn't return a session. This can happen when a
          browser extension blocks third-party cookies, or when the OAuth
          provider rejects the redirect.
        </p>
        <p style={{ color: '#5C5C5C', fontSize: 13 }}>
          <Link to="/login" style={{ color: '#0066FF' }}>Try again →</Link>
        </p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <p style={{ color: '#5C5C5C' }}>Signed in. Redirecting…</p>
    </main>
  )
}
