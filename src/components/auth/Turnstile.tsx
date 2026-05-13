// src/components/auth/Turnstile.tsx — BRT subsystem 2 §4.2
//
// Cloudflare Turnstile widget wrapper. Loads the CF script lazily, mounts
// the widget into a container ref, and fires onVerify(token) once the user
// passes the challenge. The token must be sent to the server (provision-org
// edge fn) which calls siteverify before trusting it.
//
// Configuration:
//   VITE_TURNSTILE_SITE_KEY — public site key (set at build time)
//
// If the site key is missing (e.g. local dev without Turnstile configured),
// the widget renders nothing and onVerify is called immediately with the
// sentinel string 'DEV_BYPASS'. The server-side verifier in provision-org
// treats DEV_BYPASS as valid only when TURNSTILE_SECRET_KEY is also unset,
// so production builds with the secret can never be bypassed.

import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

interface TurnstileWindow extends Window {
  turnstile?: {
    render: (
      container: HTMLElement,
      params: {
        sitekey: string
        callback: (token: string) => void
        'error-callback'?: () => void
        'expired-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
        appearance?: 'always' | 'interaction-only'
      },
    ) => string
    remove: (widgetId: string) => void
    reset: (widgetId: string) => void
  }
}

interface TurnstileProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

let scriptPromise: Promise<void> | null = null
function loadTurnstileScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Turnstile requires a browser environment'))
      return
    }
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load')), { once: true })
      if ((window as TurnstileWindow).turnstile) resolve()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script failed to load'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function Turnstile({ onVerify, onExpire, onError, theme = 'auto' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

  useEffect(() => {
    if (!siteKey) {
      // Dev-bypass: no site key configured. Pair must hold on server side.
      onVerify('DEV_BYPASS')
      return
    }
    let cancelled = false
    loadTurnstileScript()
      .then(() => {
        if (cancelled) return
        const ts = (window as TurnstileWindow).turnstile
        if (!ts || !containerRef.current) return
        widgetIdRef.current = ts.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          appearance: 'always',
          callback: (token: string) => onVerify(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onError?.(),
        })
      })
      .catch(() => onError?.())
    return () => {
      cancelled = true
      const ts = (window as TurnstileWindow).turnstile
      if (ts && widgetIdRef.current) {
        try { ts.remove(widgetIdRef.current) } catch { /* ignore */ }
        widgetIdRef.current = null
      }
    }
  }, [siteKey, theme, onVerify, onExpire, onError])

  if (!siteKey) return null
  return <div ref={containerRef} data-testid="turnstile-widget" />
}

export default Turnstile
