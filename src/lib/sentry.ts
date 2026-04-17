// SiteSync AI — Sentry Error Tracking & Performance Monitoring
// Captures errors, traces, session replays, and custom breadcrumbs.

import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  release: `sitesync@${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Performance: 10% of transactions in production
  tracesSampleRate: 0.1,

  // Session Replay: 1% baseline, 100% on error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  // Filter noisy breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'xhr' && breadcrumb.data?.url?.includes('posthog')) {
      return null
    }
    return breadcrumb
  },

  // Strip PII from error reports
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address
    }
    return event
  },
})

// ── User Context ────────────────────────────────────────

export function setSentryUser(id: string, email: string, role?: string) {
  Sentry.setUser({ id, email, ...(role ? { role } : {}) })
}

export function clearSentryUser() {
  Sentry.setUser(null)
}

// ── Custom Breadcrumbs ──────────────────────────────────

export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({ category, message, data, level: 'info' })
}

export function addNavigationBreadcrumb(from: string, to: string) {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `${from} → ${to}`,
    data: { from, to },
    level: 'info',
  })
}

export function addMutationBreadcrumb(entity: string, action: string, id?: string) {
  Sentry.addBreadcrumb({
    category: 'mutation',
    message: `${action} ${entity}${id ? ` (${id})` : ''}`,
    data: { entity, action, id },
    level: 'info',
  })
}

export function addAIBreadcrumb(action: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'ai',
    message: action,
    data,
    level: 'info',
  })
}

// ── Performance ─────────────────────────────────────────

/** Wrap a heavy component with Sentry profiling */
export const withProfiler = Sentry.withProfiler

/** Start a custom performance span */
export function startSpan(name: string, op: string) {
  return Sentry.startInactiveSpan({ name, op })
}

export default Sentry
