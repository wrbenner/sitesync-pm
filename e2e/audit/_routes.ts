/**
 * Shared route list for the runtime audit. Mirrors the ROUTES array in
 * e2e/polish-audit.spec.ts so a route added there for screenshots is
 * also covered by the click-through audit. We keep them as separate
 * files so dropping one of the audits doesn't drop the other.
 */

export interface AuditRoute {
  hash: string
  slug: string
  /** Tier 1 = critical; Tier 3 = supporting. Drives audit-time budget. */
  tier: 1 | 2 | 3
}

const DEMO_RFI = 'b0000001-0000-0000-0000-000000000001'

export const AUDIT_ROUTES: AuditRoute[] = [
  { hash: '/dashboard',              slug: '02-dashboard',      tier: 1 },
  { hash: '/daily-log',              slug: '03-daily-log',      tier: 1 },
  { hash: '/rfis',                   slug: '04-rfis',           tier: 1 },
  { hash: `/rfis/${DEMO_RFI}`,       slug: '05-rfi-detail',     tier: 1 },
  { hash: '/profile',                slug: '06-profile',        tier: 1 },
  { hash: '/conversation',           slug: '07-conversation',   tier: 1 },
  { hash: '/drawings',               slug: '10-drawings',       tier: 2 },
  { hash: '/schedule',               slug: '11-schedule',       tier: 2 },
  { hash: '/punch-list',             slug: '12-punch-list',     tier: 2 },
  { hash: '/submittals',             slug: '13-submittals',     tier: 2 },
  { hash: '/budget',                 slug: '14-budget',         tier: 2 },
  { hash: '/ai',                     slug: '15-ai-copilot',     tier: 2 },
  { hash: '/settings',               slug: '16-settings',       tier: 2 },
  { hash: '/settings/team',          slug: '17-team',           tier: 2 },
  { hash: '/settings/notifications', slug: '18-notifs',         tier: 2 },
  { hash: '/change-orders',          slug: '20-change-orders',  tier: 3 },
  { hash: '/safety',                 slug: '21-safety',         tier: 3 },
  { hash: '/workforce',              slug: '22-workforce',      tier: 3 },
  { hash: '/crews',                  slug: '23-crews',          tier: 3 },
  { hash: '/time-tracking',          slug: '24-time-tracking',  tier: 3 },
  { hash: '/directory',              slug: '25-directory',      tier: 3 },
  { hash: '/meetings',               slug: '26-meetings',       tier: 3 },
  { hash: '/pay-apps',               slug: '27-pay-apps',       tier: 3 },
  { hash: '/contracts',              slug: '28-contracts',      tier: 3 },
  { hash: '/equipment',              slug: '29-equipment',      tier: 3 },
  { hash: '/permits',                slug: '30-permits',        tier: 3 },
  { hash: '/files',                  slug: '31-files',          tier: 3 },
  { hash: '/reports',                slug: '32-reports',        tier: 3 },
  { hash: '/integrations',           slug: '33-integrations',   tier: 3 },
  { hash: '/audit-trail',            slug: '34-audit-trail',    tier: 3 },
  { hash: '/security',               slug: '35-security',       tier: 3 },
]

/**
 * Console-error allowlist. Patterns that match here are filtered out
 * before the audit reports failures. Add to this list ONLY when the
 * noise is from a third-party script we don't control. Each entry
 * carries a rationale so reviewers know why it's silenced.
 */
export const CONSOLE_ERROR_ALLOWLIST: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /Sentry/i,                       reason: 'Sentry SDK init logs' },
  { pattern: /\bdevbypass\b/i,                reason: 'VITE_DEV_BYPASS dev-mode banner' },
  { pattern: /HMR/i,                          reason: 'Vite HMR bookkeeping' },
  { pattern: /WebSocket connection.*HMR/i,    reason: 'HMR socket reconnect noise' },
  { pattern: /\bResizeObserver loop\b/i,      reason: 'Benign Chrome ResizeObserver warning' },
  { pattern: /Refused to connect to .*supabase/, reason: 'Test env without supabase access' },
]

export function isAllowlistedError(text: string): boolean {
  return CONSOLE_ERROR_ALLOWLIST.some((e) => e.pattern.test(text))
}
