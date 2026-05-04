// ─────────────────────────────────────────────────────────────────────────────
// MagicLinkOwnerRoute — /owner/:token entry point (Tab S, Wave 2)
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors MagicLinkSubRoute: validates the owner-portal magic-link token,
// hydrates an ActorContext (kind: 'magic_link', companyId from token row),
// and renders OwnerPortalPage scoped to the link's project.
//
// Data path is project-scoped only. Tokens are minted by the entity-magic-link
// Edge Function with entity_type='owner_portal' (see ownerLinkGenerator.ts).
// Audit attribution downstream picks up actor_kind='magic_link' from the
// ActorProvider so any read-side audit log entries are correctly tagged.
// ─────────────────────────────────────────────────────────────────────────────
import React, { Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Mail, Clock } from 'lucide-react'

import { ActorProvider } from '../contexts/ActorContext'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { validateOwnerMagicLink, type OwnerLinkValidation } from '../lib/ownerLinkGenerator'

const OwnerPortalPage = React.lazy(() => import('../pages/owner-portal'))

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['8'],
      backgroundColor: '#FAF7F0', // parchment — owner portal is a brand surface
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
      backgroundColor: colors.white,
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
export const MagicLinkOwnerRoute: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  return <MagicLinkOwnerRouteBody key={token ?? ''} token={token ?? ''} />
}

const MagicLinkOwnerRouteBody: React.FC<{ token: string }> = ({ token }) => {
  const [result, setResult] = useState<OwnerLinkValidation>({ status: 'pending' })

  useEffect(() => {
    let cancelled = false
    validateOwnerMagicLink(token).then((r) => {
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
          body="Hang tight — we're confirming your access."
        />
      </Centered>
    )
  }

  if (result.status !== 'ok' || !result.projectId || !result.magicLinkTokenId) {
    const title = result.status === 'expired' ? 'This link has expired' : 'This link can’t be opened'
    const body =
      result.status === 'expired'
        ? 'Owner-portal links expire for security. Ask your project manager to send a fresh one.'
        : 'The link is invalid or no longer active. Reach out to your project manager for a new one.'
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
        companyId: result.companyId ?? undefined,
      }}
    >
      <Suspense
        fallback={
          <Centered>
            <Card
              icon={<Clock size={24} aria-hidden />}
              title="Loading your project…"
              body="Pulling the latest status."
            />
          </Centered>
        }
      >
        <OwnerPortalPage
          projectId={result.projectId}
          projectName={result.projectName ?? null}
          projectAddress={result.projectAddress ?? null}
        />
      </Suspense>
    </ActorProvider>
  )
}

export default MagicLinkOwnerRoute
