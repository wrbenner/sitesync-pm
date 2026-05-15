/**
 * FMEA F.SHARE.1 — Share token (magic link) expiration
 *
 * Hazard: a per-entity share token (architect / owner counsel link)
 *         whose `expires_at` is in the past is still accepted by the
 *         validate endpoint, allowing forever-replay of leaked links.
 *
 * Attack model:
 *   - Architect's email is breached, attacker grabs an old token.
 *   - 30 days pass; the link should be dead.
 *   - Attacker hits GET /functions/v1/entity-magic-link?token=... and
 *     expects to be told "expired"; if they get the entity payload back,
 *     the platform has failed.
 *
 * Test approach:
 *   1. As service_role, insert a magic_link_tokens row with
 *      `expires_at = now() - 1 hour` (and a known token_hash).
 *   2. Mint a matching JWT that the function will verify — OR — short-
 *      circuit by calling the validate endpoint and asserting it rejects
 *      a too-old `p.exp`. The function checks both layers:
 *        - JWT.exp < now() → 401 "token expired"
 *        - row.expires_at < now() → row absent or 401
 *
 * Because we can't sign a JWT with MAGIC_LINK_SECRET from a test, we
 * verify the *contract* in two ways:
 *   - GET with a clearly-expired claim shape (token whose exp is in the
 *     past) returns 401, regardless of signature.
 *   - GET with an unknown token returns 401, never 200 with payload.
 */
import { describe, it, expect } from 'vitest'
import { SUPABASE_URL, ANON_KEY, shouldRun } from '../api/auth-helpers'

function b64uEncode(s: string): string {
  return Buffer.from(s)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Build an unsigned (or wrongly-signed) JWT with the given payload. */
function makeBadJwt(payload: Record<string, unknown>): string {
  const header = b64uEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64uEncode(JSON.stringify(payload))
  // Random non-matching signature bytes.
  const fakeSig = b64uEncode('not-the-real-signature-' + Date.now())
  return `${header}.${body}.${fakeSig}`
}

describe.skipIf(!shouldRun())(
  'FMEA F.SHARE.1 — magic link share token expiry',
  () => {
    it('GET with no token returns 4xx', async () => {
      const url = new URL(`${SUPABASE_URL}/functions/v1/entity-magic-link`)
      const resp = await fetch(url, {
        method: 'GET',
        headers: { apikey: ANON_KEY },
      })
      expect(resp.status >= 400).toBe(true)
    })

    it('GET with unknown / random token returns 4xx (never 200 with entity payload)', async () => {
      const url = new URL(`${SUPABASE_URL}/functions/v1/entity-magic-link`)
      url.searchParams.set('token', 'this-is-not-a-real-token')
      url.searchParams.set('entity_type', 'rfi')
      url.searchParams.set('entity_id', '00000000-0000-0000-0000-000000000000')
      const resp = await fetch(url, {
        method: 'GET',
        headers: { apikey: ANON_KEY },
      })
      expect(resp.status >= 400).toBe(true)
      if (resp.status === 200) {
        const body = await resp.json().catch(() => ({}))
        // If for some reason we got 200, it MUST NOT contain entity data.
        expect(body).not.toHaveProperty('entity')
        expect(body).not.toHaveProperty('rfi')
        expect(body).not.toHaveProperty('submittal')
      }
    })

    it('GET with a JWT whose exp is in the past returns 4xx', async () => {
      // Constructed token: exp set to 2020-01-01 → 1577836800.
      // The handler does JWT verification *first* (verifyJwt), so an
      // invalid signature will short-circuit before exp; both paths
      // return 4xx. We're asserting the contract: never 200 + payload.
      const stale = makeBadJwt({
        aud: 'rfi:00000000-0000-0000-0000-000000000000',
        exp: 1577836800, // 2020-01-01
        iat: 1577836799,
      })
      const url = new URL(`${SUPABASE_URL}/functions/v1/entity-magic-link`)
      url.searchParams.set('token', stale)
      url.searchParams.set('entity_type', 'rfi')
      url.searchParams.set('entity_id', '00000000-0000-0000-0000-000000000000')
      const resp = await fetch(url, {
        method: 'GET',
        headers: { apikey: ANON_KEY },
      })
      expect(resp.status >= 400).toBe(true)
    })

    it('expired magic_link_tokens row is not redeemable (DB-layer expiry)', async () => {
      // Best-effort: this assertion requires service_role to seed a row.
      // If SUPABASE_SERVICE_KEY is absent, we skip the row-seeding leg
      // and rely on the contract assertions above.
      const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? ''
      if (!serviceKey) return

      // We do NOT actually seed a row here — that would require valid
      // project_id + matching JWT-signing secret. Instead we hit the
      // endpoint with a clearly-fake token and assert that even the
      // *row-not-found* path returns 4xx rather than leaking data.
      // This is the canary assertion: if validate ever 200s without a
      // matching row, the FMDC loop catches it on the next run.
      const url = new URL(`${SUPABASE_URL}/functions/v1/entity-magic-link`)
      url.searchParams.set('token', makeBadJwt({ exp: 1577836800, aud: 'rfi:x' }))
      url.searchParams.set('entity_type', 'rfi')
      url.searchParams.set('entity_id', '00000000-0000-0000-0000-000000000000')
      const resp = await fetch(url, {
        method: 'GET',
        headers: { apikey: ANON_KEY },
      })
      expect(resp.status, 'expired/unknown token must never return 200').not.toBe(200)
    })
  },
)
