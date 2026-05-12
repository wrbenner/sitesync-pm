// src/components/admin/ImpersonationBanner.tsx — BRT sub-6 §4.3
//
// Tamper-resistant banner shown whenever an internal admin is operating
// inside another user's account.
//
// Hardening:
//   - Rendered via a portal on document.body so it can't be hidden by
//     parent CSS (overflow:hidden, transforms, etc.)
//   - z-index sits above any modal/overlay
//   - MutationObserver watches for removal; if removed, the page reloads
//     (the loud failure mode is intentional — losing this banner mid-session
//     is a P0 condition)
//   - Inline styles only; no className that could be CSS-overridden away
//
// The banner pulls session info from useImpersonation() (a hook that reads
// the active session_id from sessionStorage and validates it server-side).
// If no active session, the banner returns null and observes nothing.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ImpersonationBannerProps {
  /** Email or display name of the user being impersonated. */
  targetUser: string
  /** Org name being viewed. */
  orgName: string
  /** Wall-clock expiry; we'll show a countdown. */
  expiresAt: string
  /** End the session. Caller should call POST /functions/v1/end-impersonation
   *  and then refresh auth state. */
  onEnd: () => void
}

const BANNER_ID = 'impersonation-banner-root'

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 2_147_483_647, // max int32 — beats every modal stack
  background: '#B91C1C', // red-700
  color: 'white',
  padding: '10px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 14,
  fontWeight: 500,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  pointerEvents: 'auto',
}

const buttonStyle: React.CSSProperties = {
  marginLeft: 'auto',
  background: 'white',
  color: '#B91C1C',
  border: 'none',
  borderRadius: 4,
  padding: '6px 14px',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const min = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  return `${min}m ${sec.toString().padStart(2, '0')}s`
}

function ensureBannerRoot(): HTMLDivElement {
  let node = document.getElementById(BANNER_ID) as HTMLDivElement | null
  if (!node) {
    node = document.createElement('div')
    node.id = BANNER_ID
    document.body.appendChild(node)
  }
  return node
}

export default function ImpersonationBanner({ targetUser, orgName, expiresAt, onEnd }: ImpersonationBannerProps) {
  const [remaining, setRemaining] = useState(() => formatRemaining(expiresAt))
  // Lazy-init the portal root once during first render. SSR-safe (skipped
  // when window is absent) and stable across re-renders.
  const [root] = useState<HTMLDivElement | null>(() =>
    typeof window === 'undefined' ? null : ensureBannerRoot(),
  )

  // Live countdown.
  useEffect(() => {
    const id = window.setInterval(() => setRemaining(formatRemaining(expiresAt)), 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  // Tamper observer: if anything removes the banner root from the DOM,
  // the page reloads. The loud failure mode is intentional — losing this
  // banner mid-session would let an admin operate without the visible
  // accountability marker, which is exactly the P0 failure mode the spec
  // marks as a ship-stopper for I3.
  useEffect(() => {
    if (!root) return
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const removed of m.removedNodes) {
          if (removed instanceof HTMLElement && removed.id === BANNER_ID) {
            console.error('[impersonation] banner removed from DOM — reloading')
            window.location.reload()
            return
          }
        }
      }
    })
    observer.observe(document.body, { childList: true })
    return () => observer.disconnect()
  }, [root])

  if (!root) return null

  return createPortal(
    <div role="status" aria-live="polite" style={bannerStyle}>
      <span aria-hidden="true">⚠️</span>
      <span>
        Impersonating <strong>{targetUser}</strong> in <strong>{orgName}</strong>.
        Session ends in {remaining}.
      </span>
      <button type="button" onClick={onEnd} style={buttonStyle}>
        End impersonation
      </button>
    </div>,
    root,
  )
}
