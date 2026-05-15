/**
 * FMEA F.IMP.1 — Admin impersonation token must invalidate on logout
 *
 * Hazard: an internal admin starts an impersonation session against a
 *         customer user, then logs out of their own admin account. The
 *         impersonation session JWT continues to work, granting the
 *         logged-out admin (or anyone who exfiltrates the token)
 *         indefinite access to the customer's data.
 *
 * Defense contract (per `supabase/functions/start-impersonation` +
 * `supabase/functions/end-impersonation`):
 *   - `impersonation_sessions` row has `expires_at` (short TTL, e.g.
 *     30m) AND a `closed_at` set on admin logout.
 *   - The cron `cron-impersonation-expire` closes any session whose
 *     `expires_at` has passed.
 *   - On admin logout, the client MUST call `end-impersonation` for
 *     the active session_id, OR the JWT must include a claim that
 *     references the parent admin session id so revocation cascades.
 *
 * Test approach (contract probe — staging-only):
 *   1. Call `end-impersonation` with a fabricated session_id as anon →
 *      expect 401/4xx (must authenticate).
 *   2. Call `end-impersonation` with a valid admin JWT but a non-existent
 *      session_id → expect 4xx (no silent-success on phantom session).
 *   3. Static check: `start-impersonation` source includes the
 *      pre-condition that customer notification is sent BEFORE the
 *      session JWT is minted (so we can't accidentally invert).
 *   4. Static check: there exists a cron handler
 *      `cron-impersonation-expire` that closes expired sessions.
 *
 * The full lifecycle test (start → admin-logout → impersonation JWT
 * dies) requires a real admin JWT + cooperating customer fixture, and
 * is gated on those env vars.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SUPABASE_URL, ANON_KEY, shouldRun, tokenFor } from '../api/auth-helpers'

const START_FN = resolve(
  __dirname,
  '../../supabase/functions/start-impersonation/index.ts',
)
const END_FN = resolve(__dirname, '../../supabase/functions/end-impersonation/index.ts')
const CRON_FN = resolve(
  __dirname,
  '../../supabase/functions/cron-impersonation-expire/index.ts',
)

describe('FMEA F.IMP.1 — impersonation revocation contract', () => {
  it('start-impersonation source notifies customer BEFORE minting session', () => {
    if (!existsSync(START_FN)) {
      // file moved — fail loudly so the catalog gets re-checked.
      throw new Error(`start-impersonation source missing at ${START_FN}`)
    }
    const src = readFileSync(START_FN, 'utf-8')
    // Contract: comments + code must establish the notify-first ordering.
    expect(src).toMatch(/notification[\s\S]{0,200}before/i)
    expect(src).toMatch(/start_impersonation_session/i)
  })

  it('end-impersonation handler exists', () => {
    expect(existsSync(END_FN)).toBe(true)
  })

  it('cron-impersonation-expire handler exists', () => {
    expect(existsSync(CRON_FN)).toBe(true)
  })

  // ── Live probes ────────────────────────────────────────
  describe.skipIf(!shouldRun())('live edge-fn contract', () => {
    it('end-impersonation refuses anon caller', async () => {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/end-impersonation`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: '00000000-0000-0000-0000-000000000000' }),
      })
      expect(resp.status, 'anon must not be able to end any session').toBeGreaterThanOrEqual(400)
    })

    it('end-impersonation with phantom session_id does not 200-with-success', async () => {
      const jwt = tokenFor('authed')
      if (!jwt) return // skip silently — no authed JWT wired
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/end-impersonation`, {
        method: 'POST',
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: '00000000-0000-0000-0000-deadbeef0001' }),
      })
      // Acceptable: 4xx ("not found", "forbidden", "not admin").
      // Disallowed: 200 + { ok: true, closed: true } for a session that
      // never existed — that would mean the function trusts arbitrary
      // input.
      if (resp.status === 200) {
        const body = (await resp.json().catch(() => ({}))) as { closed?: boolean }
        expect(
          body.closed,
          'end-impersonation reported closed=true for a phantom session_id',
        ).not.toBe(true)
      } else {
        expect(resp.status).toBeGreaterThanOrEqual(400)
      }
    })
  })

  it.todo(
    'full lifecycle: admin starts impersonation → admin logs out → impersonation JWT returns 401 on next REST call',
  )
})
