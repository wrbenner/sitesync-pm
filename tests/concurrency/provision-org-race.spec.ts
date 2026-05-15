/**
 * FMEA I.PROV.1 — Concurrent provision-org creates duplicate slug.
 *
 * Hazard: when 10 callers race `provision_organization()` with the same
 * canonical slug AND the same owner, only ONE organization row should land
 * in the table. The v2 RPC (20261017000000) added an idempotency check
 * on (canonical_slug, owner). This spec verifies that contract holds under
 * tight parallel pressure.
 *
 * Expected outcome (current code):
 *   - All 10 calls succeed (idempotent — return the same org_id)
 *   - DB has exactly 1 organization with that slug
 *   - DB has exactly 1 owner organization_members row for that org
 *
 * Failure mode (if hazard is present):
 *   - Multiple rows with the same canonical slug (race in WHILE EXISTS loop)
 *   - OR multiple owner rows (race in INSERT into organization_members)
 *
 * Skip-gracefully: when SUPABASE_URL/SERVICE_KEY unset, test is skipped.
 * Cleanup: afterAll deletes the seeded user + every org row created in the run.
 *
 * Catalog: I.PROV.1 (Section I, hazard #10 in priority list).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const SHOULD_RUN = Boolean(SUPABASE_URL && SERVICE_KEY)

const RACE_TIMESTAMP = Date.now()
const SLUG = `race-test-${RACE_TIMESTAMP}`
const OWNER_EMAIL = `race-prov-${RACE_TIMESTAMP}@sitesync-staging.local`
const N_RACERS = 10

let admin: SupabaseClient
let ownerId: string | null = null
let createdOrgIds: string[] = []

beforeAll(async () => {
  if (!SHOULD_RUN) return
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // Create a deterministic owner — re-runs reuse the same email so we don't
  // pile users into auth.users.
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = list.data?.users?.find((u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase())
  if (found) {
    ownerId = found.id
  } else {
    const created = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: 'RaceProv!2026',
      email_confirm: true,
    })
    ownerId = created.data.user?.id ?? null
  }
})

afterAll(async () => {
  if (!SHOULD_RUN || !ownerId) return
  // Delete all orgs created in the race (cascades members + audit).
  if (createdOrgIds.length > 0) {
    await admin.from('organizations').delete().in('id', createdOrgIds)
  }
  // Also sweep any org with the race slug pattern, in case some rows escaped
  // the unique-id collector.
  await admin.from('organizations').delete().like('slug', `${SLUG}%`)
  // Leave the auth user in place — listUsers reuse keeps re-runs idempotent.
})

describe.skipIf(!SHOULD_RUN)('FMEA I.PROV.1 — provision_organization race', () => {
  it('10 parallel callers with same (slug, owner) produce exactly 1 organization', async () => {
    expect(ownerId, 'owner user must exist').toBeTruthy()

    // Promise.all fires all 10 RPC calls without awaiting between them. JS
    // event loop will interleave the network sends; Supabase REST + pg
    // executes them in parallel.
    const calls = Array.from({ length: N_RACERS }, () =>
      admin.rpc('provision_organization', {
        p_name: `Race Org ${RACE_TIMESTAMP}`,
        p_slug: SLUG,
        p_owner: ownerId,
        p_metadata: {},
      }),
    )
    const results = await Promise.all(calls)

    // Every call should succeed (idempotent v2). If a Wave-1 hazard sneaks
    // in (e.g., concurrent unique-violation), at least one will error. We
    // tolerate "duplicate key" as an idempotency-equivalent outcome — the
    // contract is "no duplicate row created", not "every call succeeds".
    const successes = results.filter((r) => !r.error)
    const errors = results.filter((r) => r.error)
    const successIds = successes
      .map((r) => r.data as string | null)
      .filter((v): v is string => Boolean(v))
    const uniqueIds = new Set(successIds)

    // Collect for cleanup before assertions.
    createdOrgIds = Array.from(uniqueIds)

    // KEY ASSERTION: only one distinct org id ever appears across responses.
    expect(uniqueIds.size, `expected 1 distinct org_id across ${N_RACERS} racers; got ${uniqueIds.size}. errors: ${JSON.stringify(errors.map((e) => e.error?.message))}`).toBe(1)

    // Verify against the source of truth: organizations table.
    const { data: orgs, error: orgErr } = await admin
      .from('organizations')
      .select('id, slug')
      .like('slug', `${SLUG}%`)
    expect(orgErr).toBeNull()
    const matching = (orgs ?? []).filter((o) => (o as { slug: string }).slug === SLUG)
    expect(matching.length, `expected exactly 1 organization with slug=${SLUG}; got ${matching.length}`).toBe(1)

    // Verify organization_members has exactly one owner row.
    const { data: members } = await admin
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', matching[0]!.id)
      .eq('user_id', ownerId)
    const ownerRows = (members ?? []).filter((m) => (m as { role: string }).role === 'owner')
    expect(ownerRows.length, 'expected exactly 1 owner row for the seeded org').toBe(1)
  }, 30_000)
})
