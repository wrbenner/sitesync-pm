/**
 * FMEA F.DEL.1 — Account deletion completes (auth.users row gone)
 *
 * Hazard: the delete-account edge function deletes user-owned rows in
 *         public schema but the `auth.users` row remains, leaving the
 *         email still bound to an unusable identity. Re-signup with the
 *         same email creates a "phantom" account or fails confusingly.
 *
 * Attack model:
 *   - Apple App Store Guideline 5.1.1(v) requires complete deletion.
 *   - A negligent delete leaves auth.users → email never re-usable.
 *   - Worse, if cascade misses an org_member row, the user can sign in
 *     with their old session and still see prior org data.
 *
 * Test approach (staging-only, gated):
 *   1. Sign up a throwaway user via the admin API.
 *   2. Invoke the delete-account edge function as that user (with the
 *      required "DELETE MY ACCOUNT" confirmation string).
 *   3. Assert:
 *        a. service_role lookup of the user_id returns null (auth.users
 *           row is gone).
 *        b. organization_members for that user_id is empty.
 *        c. re-signup with the same email succeeds and yields a NEW
 *           user_id (phantom account check).
 *
 * Gated on SUPABASE_SERVICE_KEY presence; otherwise skipped.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, ANON_KEY, shouldRun } from '../api/auth-helpers'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const FULLY_WIRED = Boolean(shouldRun() && SERVICE_KEY)

describe.skipIf(!FULLY_WIRED)(
  'FMEA F.DEL.1 — account deletion cleanup',
  () => {
    it('delete-account removes auth.users row + allows email reuse', async () => {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const stamp = Date.now()
      const email = `fmea-del-${stamp}@fmea-test.invalid`
      const password = 'Fmea-Test-' + stamp + 'Aa1!'

      // 1. create a throwaway user via admin.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      expect(createErr).toBeFalsy()
      const userId1 = created.user?.id
      expect(userId1).toBeTruthy()

      // 2. sign in as that user → capture access_token.
      const anon = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
        email,
        password,
      })
      expect(signInErr).toBeFalsy()
      const access = signIn?.session?.access_token
      expect(access).toBeTruthy()

      // 3. call delete-account edge fn as that user.
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmation: 'DELETE MY ACCOUNT', reason: 'fmea-test' }),
      })

      // The function may run async cascade; the response should be 2xx.
      expect(resp.status, `delete-account returned ${resp.status}`).toBeLessThan(400)

      // 4. assert auth.users row is gone.
      const { data: lookup } = await admin.auth.admin.getUserById(userId1 as string)
      expect(
        lookup?.user,
        'auth.users row STILL EXISTS after delete-account — F.DEL.1 hazard confirmed',
      ).toBeFalsy()

      // 5. assert organization_members is clean.
      const { data: members } = await admin
        .from('organization_members')
        .select('user_id')
        .eq('user_id', userId1 as string)
      expect((members ?? []).length, 'organization_members row leaked past delete').toBe(0)

      // 6. re-signup with the same email → must succeed and yield a NEW id.
      const { data: recreated, error: recreateErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      expect(recreateErr, 'email reuse after delete must succeed').toBeFalsy()
      const userId2 = recreated.user?.id
      expect(userId2).toBeTruthy()
      expect(userId2).not.toBe(userId1)

      // cleanup the second one.
      if (userId2) {
        await admin.auth.admin.deleteUser(userId2)
      }
    }, 60_000)
  },
)
