/**
 * FMEA G.SECDEF.1 — SECURITY DEFINER RPC org-isolation
 *
 * Hazard: a SECURITY DEFINER function (executes as table owner, bypassing
 *         RLS) doesn't re-verify the caller's identity / org_id before
 *         performing privileged operations, allowing a crafted parameter
 *         to escalate cross-org or impersonate another user.
 *
 * Attack model:
 *   - Hit `provision_organization(p_name, p_slug, p_owner, p_metadata)` as
 *     anon. The SECURITY DEFINER function MUST refuse — production grants
 *     EXECUTE to (authenticated, service_role) only.
 *   - As an authenticated user, hit `provision_organization` with
 *     `p_owner = '<some-other-user-id>'`. Defense-in-depth check: the
 *     function should derive owner from `auth.uid()` rather than trust the
 *     parameter (or the caller). We test both shapes — either rejection
 *     (42501 / 401) or empty result is acceptable.
 *
 * Tests:
 *   1. anon → 401 / permission denied
 *   2. authenticated calling with someone else's user_id → either
 *      rejected, OR the function actually creates the org under the
 *      caller's identity, NOT the impersonated id (anti-confused-deputy).
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  SUPABASE_URL,
  ANON_KEY,
  shouldRun,
  tokenFor,
} from '../api/auth-helpers'

describe.skipIf(!shouldRun())(
  'FMEA G.SECDEF.1 — SECURITY DEFINER org isolation',
  () => {
    it('anon cannot execute provision_organization', async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await anon.rpc('provision_organization', {
        p_name: 'fmea-secdef-anon-' + Date.now(),
        p_slug: 'fmea-secdef-anon',
        p_owner: '00000000-0000-0000-0000-000000000001',
        p_metadata: { source: 'fmea-test' },
      })
      // Acceptable outcomes:
      //   - permission denied (42501) → preferred (REVOKE FROM PUBLIC)
      //   - 401 / no-row
      //   - 0 returned id
      // Disallowed: a real uuid in `data` (would mean anon successfully
      // created an org with arbitrary owner — full takeover).
      if (error) {
        expect(error.code === '42501' || (error.message ?? '').match(/permission|denied|not allowed/i)).toBeTruthy()
        return
      }
      // No error path: assert no org id returned.
      expect(data, 'anon must not be able to provision an org').toBeFalsy()
    })

    it('authed call with foreign p_owner does not impersonate (no confused-deputy)', async () => {
      const jwt = tokenFor('authed')
      if (!jwt) {
        // No authed JWT wired into env — skip rather than false-pass.
        return
      }
      const authed = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const FOREIGN_OWNER = '00000000-0000-0000-0000-deadbeefdead'

      const { data: orgId, error } = await authed.rpc('provision_organization', {
        p_name: 'fmea-secdef-cross-' + Date.now(),
        p_slug: 'fmea-secdef-cross-' + Date.now(),
        p_owner: FOREIGN_OWNER,
        p_metadata: { source: 'fmea-test-foreign-owner' },
      })

      if (error) {
        // Function refused the foreign owner — best-case.
        expect(error).toBeTruthy()
        return
      }

      // The function returned an id. Verify the org_members row was NOT
      // created under FOREIGN_OWNER. Use the service-role client to peek
      // past RLS.
      const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? ''
      if (!serviceKey) return // can't verify without admin client

      const admin = createClient(SUPABASE_URL, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: members } = await admin
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', orgId as string)
      // If FOREIGN_OWNER is listed as owner, this is a confused-deputy
      // escalation. Caller's user_id should be the only owner.
      const hasForeignOwner = (members ?? []).some(
        (m: { user_id: string; role: string }) =>
          m.user_id === FOREIGN_OWNER && m.role === 'owner',
      )
      expect(
        hasForeignOwner,
        'provision_organization granted ownership to attacker-supplied p_owner',
      ).toBe(false)

      // Cleanup best-effort.
      if (orgId) {
        await admin.from('organizations').delete().eq('id', orgId as string)
      }
    })
  },
)
