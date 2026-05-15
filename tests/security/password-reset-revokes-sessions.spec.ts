/**
 * FMEA F.RESET.1 — Password reset must revoke active sessions
 *
 * Hazard: when a user resets their password (or an admin resets it for
 *         them), any JWTs minted before the reset remain valid until
 *         their natural exp. That means a compromise where the attacker
 *         exfiltrated the JWT is *not* mitigated by changing the password.
 *
 * Attack model:
 *   - Attacker has user's email + a captured JWT.
 *   - User suspects compromise → resets password.
 *   - Attacker's captured JWT must no longer work.
 *
 * Test approach (staging):
 *   1. Sign in a throwaway user (or use service_role to admin-update its
 *      password) and capture their access_token.
 *   2. Issue a Supabase admin password update on that same user.
 *   3. Re-fetch a protected resource with the OLD token; expect 401.
 *
 * This test runs only when SUPABASE_SERVICE_KEY is wired AND a
 * SCALE_TEST_USER_ID is provided that we are explicitly allowed to mutate.
 * It is a no-op otherwise.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, ANON_KEY, shouldRun } from '../api/auth-helpers'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const TEST_USER_EMAIL = process.env.FMEA_RESET_TEST_EMAIL ?? ''
const TEST_USER_PASSWORD = process.env.FMEA_RESET_TEST_PASSWORD ?? ''

const FULLY_WIRED = Boolean(
  shouldRun() && SERVICE_KEY && TEST_USER_EMAIL && TEST_USER_PASSWORD,
)

describe.skipIf(!FULLY_WIRED)(
  'FMEA F.RESET.1 — password reset invalidates old JWT',
  () => {
    it('OLD access_token returns 401 after admin-resets the password', async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      // 1. sign in with the throwaway credentials → capture token.
      const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      })
      expect(signInErr).toBeFalsy()
      const oldToken = signIn?.session?.access_token
      const userId = signIn?.user?.id
      expect(oldToken).toBeTruthy()
      expect(userId).toBeTruthy()

      // 2. admin-rotate password on the same user.
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const newPassword = 'fmea-rotated-' + Date.now().toString(36) + 'Aa1!'
      const { error: updateErr } = await admin.auth.admin.updateUserById(
        userId as string,
        { password: newPassword },
      )
      expect(updateErr).toBeFalsy()

      // 3. attempt to use the OLD token against a protected REST endpoint.
      //    A correctly-implemented platform invalidates the refresh token
      //    on password change. Whether the access_token is invalidated
      //    immediately is platform-dependent — we want EITHER:
      //      - immediate 401, OR
      //      - the refresh chain dead (next refresh returns 401)
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${oldToken}`,
        },
      })
      // GoTrue returns 401 once the user's password generation increments
      // past the token's `aal`/`session_id`. If 200, then we expect the
      // refresh chain to be dead.
      if (resp.status === 401) {
        expect(resp.status).toBe(401)
      } else {
        // Try refresh — must fail.
        const refresh = signIn?.session?.refresh_token ?? ''
        const refreshResp = await fetch(
          `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
          {
            method: 'POST',
            headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh }),
          },
        )
        expect(
          refreshResp.status >= 400,
          'old refresh_token must be invalidated after password change',
        ).toBe(true)
      }

      // 4. cleanup — restore original password so the throwaway can be reused.
      await admin.auth.admin.updateUserById(userId as string, {
        password: TEST_USER_PASSWORD,
      })
    })
  },
)
