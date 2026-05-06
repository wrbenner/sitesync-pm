// ─────────────────────────────────────────────────────────────────────────────
// MagicLinkSubRoute — /sub/:token entry point (Tab C / Wave 1)
// ─────────────────────────────────────────────────────────────────────────────
// Validates a sub magic-link token, hydrates an ActorContext (kind:
// 'magic_link', plus magic_link_token_id + companyId), and renders the same
// DayPage component the authenticated stream uses. Tab B owns DayPage; this
// route wrapper only registers identity.
//
// Wave 1: the validate Edge Function may not exist yet. The validator is a
// thin fetch with a typed result; if the endpoint 404s or the token fails,
// the wrapper renders an "expired link" placeholder instead of the stream.
// ─────────────────────────────────────────────────────────────────────────────

import React, { Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Mail, Clock } from 'lucide-react'
import { ActorProvider } from '../contexts/ActorContext'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

const DayPage = React.lazy(() => import('../pages/day/index'))

type ValidationStatus = 'pending' | 'ok' | 'expired' | 'invalid' | 'error'

interface ValidationResult {
  status: ValidationStatus
  magicLinkTokenId?: string
  companyId?: string
  expiresAt?: string
  errorMessage?: string
}

const FUNCTION_BASE =
  (typeof window !== 'undefined' && (window as unknown as { VITE_SUPABASE_URL?: string }).VITE_SUPABASE_URL) ||
  (import.meta as unknown as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL ||
  ''

// Wave 1 stub: hits /functions/v1/sub-magic-link if present. Wave 2 wires the
// real Edge Function. Until then we surface a typed validation result and the
// wrapper degrades to the "link expired" placeholder rather than crashing.
async function validateSubMagicLink(token: string): Promise<ValidationResult> {
  if (!token) return { status: 'invalid', errorMessage: 'Missing token.' }
  if (!FUNCTION_BASE) {
    // No backend wired in this environment — treat as expired so the user
    // sees a recoverable empty state instead of a runtime error.
    return { status: 'error', errorMessage: 'Validation service unavailable.' }
  }
  try {
    const res = await fetch(
      `${FUNCTION_BASE}/functions/v1/sub-magic-link?token=${encodeURIComponent(token)}`,
    )
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      const message = (detail as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`
      const status: ValidationStatus = res.status === 410 || res.status === 401 ? 'expired' : 'invalid'
      return { status, errorMessage: message }
    }
    const data = (await res.json()) as {
      ok?: boolean
      magic_link_token_id?: string
      company_id?: string
      expires_at?: string
      error?: { message?: string }
    }
    if (!data.ok || !data.magic_link_token_id || !data.company_id) {
      return { status: 'invalid', errorMessage: data.error?.message ?? 'Token rejected.' }
    }
    return {
      status: 'ok',
      magicLinkTokenId: data.magic_link_token_id,
      companyId: data.company_id,
      expiresAt: data.expires_at,
    }
  } catch (err) {
    return { status: 'error', errorMessage: (err as Error).message }
  }
}

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['8'],
      backgroundColor: colors.surfacePage,
      fontFamily: typography.fontFamily,
    }}
  >
    {children}
  </div>
)

const Card: React.FC<{ icon: React.ReactNode; title: string; body: string }> = ({ icon, title, body }) => (
  <div
    style={{
      maxWidth: 420,
      width: '100%',
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      padding: spacing['8'],
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing['3'],
    }}
  >
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        backgroundColor: colors.surfaceInset,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textSecondary,
      }}
    >
      {icon}
    </div>
    <h1
      style={{
        margin: 0,
        fontSize: typography.fontSize.heading,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
      }}
    >
      {title}
    </h1>
    <p style={{ margin: 0, fontSize: typography.fontSize.body, color: colors.textSecondary, lineHeight: 1.5 }}>
      {body}
    </p>
  </div>
)

// Outer reads the param and keys the body by token — every token change
// remounts the body, so `result` re-initializes to 'pending' without us
// needing to sync state inside an effect.
export const MagicLinkSubRoute: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  return <MagicLinkSubRouteBody key={token ?? ''} token={token ?? ''} />
}

const MagicLinkSubRouteBody: React.FC<{ token: string }> = ({ token }) => {
  const [result, setResult] = useState<ValidationResult>({ status: 'pending' })

  useEffect(() => {
    let cancelled = false
    validateSubMagicLink(token).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  if (result.status === 'pending') {
    return (
      <Centered>
        <Card
          icon={<Clock size={24} aria-hidden />}
          title="Verifying your link…"
          body="Hang tight — we're checking your access."
        />
      </Centered>
    )
  }

  if (result.status !== 'ok') {
    const title = result.status === 'expired' ? 'This link has expired' : 'This link can’t be opened'
    const body =
      result.status === 'expired'
        ? 'Magic links expire for security. Ask your project contact to send a fresh one.'
        : 'The link is invalid or no longer active. Reach out to whoever shared it for a new one.'
    return (
      <Centered>
        <Card icon={<Mail size={24} aria-hidden />} title={title} body={body} />
      </Centered>
    )
  }

  return (
    <ActorProvider
      value={{
        kind: 'magic_link',
        magicLinkTokenId: result.magicLinkTokenId,
        companyId: result.companyId,
      }}
    >
      <Suspense
        fallback={
          <Centered>
            <Card icon={<Clock size={24} aria-hidden />} title="Loading your stream…" body="Pulling today's items." />
          </Centered>
        }
      >
        <DayPage />
      </Suspense>
    </ActorProvider>
  )
}

export default MagicLinkSubRoute
