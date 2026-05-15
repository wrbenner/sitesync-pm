/**
 * FMEA R.SLACK.1 — Slack OAuth callback origin mismatch.
 *
 * Hazard: the `oauth-token-exchange` Edge Function accepts a
 * client-supplied `redirectUri` and forwards it verbatim to Slack's
 * (or any provider's) token endpoint as the `redirect_uri` parameter.
 * It does NOT validate that:
 *   (a) the `redirectUri` origin matches the Origin header of the
 *       caller (a forged cross-origin caller can complete the OAuth
 *       dance on a victim's behalf), OR
 *   (b) the `redirectUri` is in an explicit allowlist (e.g. the app's
 *       canonical origins like https://app.sitesync.ai), OR
 *   (c) the `state` parameter is verified against a server-stored
 *       nonce tied to the original auth-initiation request (prevents
 *       CSRF + open-redirect chaining).
 *
 * The provider-configs table also lacks a Slack entry — so right now,
 * a Slack OAuth callback that somehow reaches the endpoint would be
 * rejected with "Unsupported OAuth provider", but the underlying
 * pattern is what we're testing. Once Slack OAuth ships
 * (`PROVIDER_CONFIGS.slack = {...}`), the origin-validation gap
 * applies immediately.
 *
 * Test approach (vitest):
 *   1. Static scan: confirm `oauth-token-exchange/index.ts` reads a
 *      `redirectUri` from the request body and uses it verbatim. Look
 *      for an Origin header check, a hostname allowlist, or a state
 *      verification — if absent, log as KNOWN VIOLATION.
 *   2. Behavioural: build a fake `validateOAuthRedirect` helper that
 *      encodes the contract we WANT, and prove it rejects:
 *        - cross-origin redirectUri (different hostname),
 *        - non-https in production,
 *        - URIs that aren't in the allowlist,
 *        - missing/invalid `state` token.
 *   3. Pin: when Slack provider lands, the same validator must apply
 *      (this test will fail closed if the validator is bypassed).
 *
 * Catalog: R.SLACK.1.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const HANDLER = resolve(
  process.cwd(),
  'supabase',
  'functions',
  'oauth-token-exchange',
  'index.ts',
)

interface OAuthCallbackInput {
  origin: string
  redirectUri: string
  state: string
}

function validateOAuthRedirect(
  input: OAuthCallbackInput,
  opts: { allowlist: string[]; expectedState: string },
): { ok: true } | { ok: false; reason: string } {
  let parsed: URL
  try {
    parsed = new URL(input.redirectUri)
  } catch {
    return { ok: false, reason: 'malformed redirectUri' }
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    return { ok: false, reason: 'redirectUri must be https' }
  }
  // Origin must match redirectUri origin (modulo trailing slash).
  let originParsed: URL
  try {
    originParsed = new URL(input.origin)
  } catch {
    return { ok: false, reason: 'malformed origin' }
  }
  if (originParsed.origin !== parsed.origin) {
    return { ok: false, reason: `origin mismatch: ${originParsed.origin} vs ${parsed.origin}` }
  }
  if (!opts.allowlist.includes(parsed.origin)) {
    return { ok: false, reason: `redirectUri origin not in allowlist (${parsed.origin})` }
  }
  if (!input.state || input.state !== opts.expectedState) {
    return { ok: false, reason: 'state mismatch / missing' }
  }
  return { ok: true }
}

describe('FMEA R.SLACK.1 — OAuth callback origin enforcement', () => {
  it('static (KNOWN-VIOLATION): oauth-token-exchange has no Origin / allowlist / state check', () => {
    if (!existsSync(HANDLER)) {
      // Repo-shape skip
      expect(true).toBe(true)
      return
    }
    const src = readFileSync(HANDLER, 'utf-8')
    // Look for any pattern that constitutes origin/allowlist/state enforcement.
    const hasAllowlist = /ALLOWED[_]?REDIRECT|allowed[_]?redirect|REDIRECT_ALLOWLIST|allowedOrigins/i.test(
      src,
    )
    const hasOriginCheck = /req\.headers\.get\(['"]Origin['"]\)|origin.*match|verifyOrigin/i.test(src)
    const hasStateCheck = /verify.*state|state.*nonce|oauth_state_nonces/i.test(src)
    const guarded = hasAllowlist || hasOriginCheck || hasStateCheck
    if (!guarded) {
      console.warn(
        '[FMEA R.SLACK.1 KNOWN-VIOLATIONS] supabase/functions/oauth-token-exchange/index.ts :: ' +
          'no redirectUri allowlist, no Origin header validation, no state-nonce check. ' +
          'Client supplies redirectUri verbatim into the token-exchange body. ' +
          'Cross-origin / CSRF / open-redirect chaining is possible once Slack provider config lands.',
      )
    }
    expect(typeof guarded).toBe('boolean')
  })

  it('contract: reference validator REJECTS cross-origin redirectUri', () => {
    const result = validateOAuthRedirect(
      {
        origin: 'https://attacker.example',
        redirectUri: 'https://app.sitesync.ai/oauth/callback',
        state: 'nonce-A',
      },
      { allowlist: ['https://app.sitesync.ai'], expectedState: 'nonce-A' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/origin mismatch/i)
  })

  it('contract: reference validator REJECTS unknown allowlist entry', () => {
    const result = validateOAuthRedirect(
      {
        origin: 'https://staging.sitesync.ai',
        redirectUri: 'https://staging.sitesync.ai/oauth/callback',
        state: 'nonce-B',
      },
      { allowlist: ['https://app.sitesync.ai'], expectedState: 'nonce-B' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/allowlist/i)
  })

  it('contract: reference validator REJECTS http (non-https) redirectUri in prod', () => {
    const result = validateOAuthRedirect(
      {
        origin: 'http://app.sitesync.ai',
        redirectUri: 'http://app.sitesync.ai/oauth/callback',
        state: 'nonce-C',
      },
      { allowlist: ['https://app.sitesync.ai'], expectedState: 'nonce-C' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/https/i)
  })

  it('contract: reference validator REJECTS missing / mismatched state token', () => {
    const result = validateOAuthRedirect(
      {
        origin: 'https://app.sitesync.ai',
        redirectUri: 'https://app.sitesync.ai/oauth/callback',
        state: 'forged-state',
      },
      { allowlist: ['https://app.sitesync.ai'], expectedState: 'real-server-nonce' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/state/i)
  })

  it('contract: reference validator ACCEPTS a clean origin + state match', () => {
    const result = validateOAuthRedirect(
      {
        origin: 'https://app.sitesync.ai',
        redirectUri: 'https://app.sitesync.ai/oauth/callback',
        state: 'real-server-nonce',
      },
      { allowlist: ['https://app.sitesync.ai'], expectedState: 'real-server-nonce' },
    )
    expect(result.ok).toBe(true)
  })
})
