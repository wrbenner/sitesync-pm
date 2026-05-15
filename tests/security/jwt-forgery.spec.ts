/**
 * FMEA G.JWT.1 — Server-side JWT validation
 *
 * Hazard: server doesn't validate JWT signature; a forged JWT with
 *         arbitrary claims is accepted and the call succeeds.
 *
 * Attack model:
 *   - Take a well-formed Supabase anon JWT (header.payload.signature).
 *   - Mutate the payload (e.g. promote the `role` claim to
 *     `service_role` or change `sub` to a different user).
 *   - Sign with a wrong HMAC key (or no signature at all).
 *   - Hit a protected RPC / edge function.
 *
 * Expectation: every protected endpoint returns 401 (or, for RLS-only
 * endpoints, returns *zero rows* — never the impersonated user's rows).
 *
 * Skip-gracefully when SUPABASE_URL / SUPABASE_ANON_KEY are not set.
 */
import { describe, it, expect } from 'vitest'
import { SUPABASE_URL, ANON_KEY, shouldRun } from '../api/auth-helpers'

/** Base64url helpers (no padding) — match JWT wire format. */
function b64uEncode(buf: Uint8Array | string): string {
  const bytes = typeof buf === 'string' ? new TextEncoder().encode(buf) : buf
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Produce a JWT with a bogus HMAC signature using a wrong key. */
async function forgeJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = b64uEncode(JSON.stringify(header))
  const payloadB64 = b64uEncode(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  // Wrong key — Supabase server will reject this.
  const wrongKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('not-the-real-jwt-secret-deadbeef'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    wrongKey,
    new TextEncoder().encode(signingInput),
  )
  const sigB64 = b64uEncode(new Uint8Array(sig))
  return `${signingInput}.${sigB64}`
}

describe.skipIf(!shouldRun())('FMEA G.JWT.1 — forged JWT rejection', () => {
  it('forged service_role JWT is rejected by REST', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const forged = await forgeJwt({
      sub: '00000000-0000-0000-0000-000000000000',
      role: 'service_role',
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
      exp: futureExp,
      aud: 'authenticated',
    })

    // Attempt to read a sensitive table that anon can never reach (audit_log)
    // using the forged token in the Authorization header.
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/audit_log?limit=1`, {
      method: 'GET',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${forged}`,
      },
    })

    // PostgREST / GoTrue rejects bad signatures with 401 (or, if the gateway
    // ignores Authorization on bad sig, falls back to anon and returns empty
    // — anything other than a populated array is a pass).
    if (resp.status === 401) {
      expect(resp.status).toBe(401)
      return
    }
    // Soft-pass path: the gateway downgraded to anon; verify we did NOT
    // get audit_log rows (which only service_role can read).
    const body = await resp.json().catch(() => [])
    expect(
      Array.isArray(body) ? body.length : 0,
      'forged service_role JWT must NOT return audit_log rows',
    ).toBe(0)
  })

  it('JWT with stripped signature is rejected', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const header = b64uEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = b64uEncode(
      JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000000',
        role: 'service_role',
        iss: 'supabase',
        iat: Math.floor(Date.now() / 1000),
        exp: futureExp,
        aud: 'authenticated',
      }),
    )
    const tokenNoSig = `${header}.${payload}.` // empty signature segment

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/audit_log?limit=1`, {
      method: 'GET',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${tokenNoSig}`,
      },
    })

    if (resp.status === 401) {
      expect(resp.status).toBe(401)
      return
    }
    const body = await resp.json().catch(() => [])
    expect(
      Array.isArray(body) ? body.length : 0,
      'unsigned JWT must NOT return audit_log rows',
    ).toBe(0)
  })

  it('"alg: none" JWT is rejected (algorithm confusion)', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const header = b64uEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    const payload = b64uEncode(
      JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000000',
        role: 'service_role',
        iss: 'supabase',
        iat: Math.floor(Date.now() / 1000),
        exp: futureExp,
        aud: 'authenticated',
      }),
    )
    const tokenAlgNone = `${header}.${payload}.`

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/audit_log?limit=1`, {
      method: 'GET',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${tokenAlgNone}`,
      },
    })

    if (resp.status === 401) {
      expect(resp.status).toBe(401)
      return
    }
    const body = await resp.json().catch(() => [])
    expect(
      Array.isArray(body) ? body.length : 0,
      '"alg: none" must NOT return audit_log rows',
    ).toBe(0)
  })
})
