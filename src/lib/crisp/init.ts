// src/lib/crisp/init.ts — BRT subsystem 6 §4.1
//
// Crisp chat embed. Loaded lazily (idle-callback) so the 30 KB widget
// doesn't sit on the cold-open critical path. Identify-on-auth so
// support sees who's chatting + which org/plan.
//
// Suppressed on `/print/*` and document-export routes so PDF generation
// doesn't render the chat bubble. Suppressed in DEV unless the env var
// VITE_CRISP_FORCE_DEV is set to "true".
//
// Dock placement: lower-right (Crisp default). Free-tier 2 operators.
//
// Privacy: Crisp is listed as a subprocessor in our Privacy Policy. The
// identify call sends user.id, email, and org name only — never project,
// RFI, or draft content (those would land in Crisp's chat history db).

declare global {
  interface Window {
    $crisp?: unknown[]
    CRISP_WEBSITE_ID?: string
    CRISP_RUNTIME_CONFIG?: { session_merge?: boolean }
  }
}

const PRINT_ROUTE_PATTERNS = [/^\/print\//, /^\/export\//, /\/pdf-preview$/]

export function shouldSuppressCrisp(pathname: string): boolean {
  return PRINT_ROUTE_PATTERNS.some((re) => re.test(pathname))
}

let initialized = false

/**
 * Lazy-load the Crisp script. Idempotent. Safe to call multiple times.
 *
 * Returns immediately if:
 *   - SSR (no window)
 *   - VITE_CRISP_WEBSITE_ID unset
 *   - on a print/export route
 *   - in DEV without VITE_CRISP_FORCE_DEV
 */
export function initCrisp(): void {
  if (initialized) return
  if (typeof window === 'undefined') return

  const websiteId = import.meta.env.VITE_CRISP_WEBSITE_ID
  if (!websiteId) return

  if (shouldSuppressCrisp(window.location.pathname)) return

  if (import.meta.env.DEV && import.meta.env.VITE_CRISP_FORCE_DEV !== 'true') return

  initialized = true
  window.$crisp = []
  window.CRISP_WEBSITE_ID = websiteId

  const idle = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void
  }).requestIdleCallback

  const inject = () => {
    const s = document.createElement('script')
    s.src = 'https://client.crisp.chat/l.js'
    s.async = true
    document.head.appendChild(s)
  }

  if (idle) idle(inject, { timeout: 4000 })
  else setTimeout(inject, 2500)
}

/**
 * Identify the current user to Crisp once they're signed in.
 * Called from authStore.onAuthStateChange. Safe to call before initCrisp;
 * Crisp queues the calls in window.$crisp until the script is ready.
 */
export function identifyCrispUser(params: {
  email: string
  fullName?: string | null
  orgName?: string | null
  plan?: string | null
  signupAt?: string | null
}): void {
  if (typeof window === 'undefined') return
  if (!window.$crisp) window.$crisp = []
  const $crisp = window.$crisp as Array<unknown[]>

  $crisp.push(['set', 'user:email', [params.email]])
  if (params.fullName) {
    $crisp.push(['set', 'user:nickname', [params.fullName]])
  }
  // company is the Crisp-side aggregator for B2B segmentation
  if (params.orgName) {
    $crisp.push(['set', 'user:company', [params.orgName]])
  }

  const data: Array<[string, string]> = []
  if (params.plan) data.push(['plan', params.plan])
  if (params.signupAt) data.push(['signup_at', params.signupAt])
  if (data.length > 0) {
    $crisp.push(['set', 'session:data', [data]])
  }
}

/**
 * Reset Crisp on signout so the next user on the same device starts a clean
 * conversation thread.
 */
export function resetCrispSession(): void {
  if (typeof window === 'undefined' || !window.$crisp) return
  const $crisp = window.$crisp as Array<unknown[]>
  $crisp.push(['do', 'session:reset'])
}
