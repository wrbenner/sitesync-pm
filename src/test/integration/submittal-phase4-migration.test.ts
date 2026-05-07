// Phase 4 — migration smoke test for the Packages + spec_sections seed
// + Iris view extension migration.
//
// Same env-gated pattern as the Phase 3 saved-views smoke (auto-skips when
// SUBMITTAL_SMOKE_DB_URL isn't set). Asserts:
//   * the four package-CRUD RPCs exist with the expected signatures
//   * spec_sections is created and seeded with ≥100 rows
//   * the Iris seed RPC now returns 7 (4 Items + 3 view-type-aware)
//   * package round-trip: create → set members → update → delete
//
// Run locally with:
//   SUBMITTAL_SMOKE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npm test -- --run src/test/integration/submittal-phase4-migration.test.ts

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const DB_URL = process.env.SUBMITTAL_SMOKE_DB_URL

const PHASE3_MIGRATION = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260508000000_submittal_saved_views.sql',
)
const PHASE4_MIGRATION = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260509000000_submittal_phase4_packages_specs.sql',
)

const TEST_SCOPED = DB_URL ? describe : describe.skip

TEST_SCOPED('submittal phase 4 migration smoke', () => {
  if (!DB_URL) return

  let sql: ReturnType<typeof postgres>
  let projectId: string
  let userId: string
  let orgId: string
  let cleanup: (() => Promise<void>) | null = null

  beforeAll(async () => {
    sql = postgres(DB_URL, { max: 1, idle_timeout: 5 })

    // Apply Phase 3 (saved views + seed RPC) then Phase 4. Both are idempotent.
    // The canonical Submittals migration (submittals + submittal_packages tables)
    // is assumed already-applied — Phase 4 is additive and references those tables.
    await sql.unsafe(fs.readFileSync(PHASE3_MIGRATION, 'utf8'))
    await sql.unsafe(fs.readFileSync(PHASE4_MIGRATION, 'utf8'))

    // Test fixtures.
    const orgRows = await sql`
      INSERT INTO public.organizations (name)
      VALUES (${'p4-smoke-org-' + Date.now()})
      RETURNING id
    `
    orgId = orgRows[0].id as string

    const userRows = await sql`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
      VALUES (gen_random_uuid(), ${'p4-smoke-' + Date.now() + '@x.test'}, '', now(), now(), now(), 'authenticated', 'authenticated')
      RETURNING id
    `
    userId = userRows[0].id as string

    const projRows = await sql`
      INSERT INTO public.projects (name, organization_id)
      VALUES (${'p4-smoke-project-' + Date.now()}, ${orgId})
      RETURNING id
    `
    projectId = projRows[0].id as string

    await sql`
      INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (${projectId}, ${userId}, 'project_manager')
    `

    cleanup = async () => {
      await sql`DELETE FROM public.submittals WHERE project_id = ${projectId}`.catch(() => {})
      await sql`DELETE FROM public.submittal_packages WHERE project_id = ${projectId}`.catch(() => {})
      await sql`DELETE FROM public.submittal_saved_views WHERE project_id = ${projectId}`.catch(() => {})
      await sql`DELETE FROM public.project_members WHERE project_id = ${projectId}`.catch(() => {})
      await sql`DELETE FROM public.projects WHERE id = ${projectId}`.catch(() => {})
      await sql`DELETE FROM public.organizations WHERE id = ${orgId}`.catch(() => {})
      await sql`DELETE FROM auth.users WHERE id = ${userId}`.catch(() => {})
    }
  }, 30_000)

  afterAll(async () => {
    if (cleanup) await cleanup()
    await sql?.end({ timeout: 5 })
  })

  it('creates the four package-CRUD RPCs', async () => {
    const fns = await sql<{ proname: string }[]>`
      SELECT proname FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname IN (
           'submittal_create_package',
           'submittal_update_package',
           'submittal_set_package_members',
           'submittal_delete_package'
         )
       ORDER BY proname
    `
    expect(fns.map((r) => r.proname)).toEqual([
      'submittal_create_package',
      'submittal_delete_package',
      'submittal_set_package_members',
      'submittal_update_package',
    ])
  })

  it('creates and seeds the spec_sections reference table with ≥100 rows', async () => {
    const exists = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.spec_sections') IS NOT NULL AS exists
    `
    expect(exists[0].exists).toBe(true)

    const count = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM public.spec_sections
    `
    expect(count[0].count).toBeGreaterThanOrEqual(100)

    // Spot-check a few well-known sections.
    const known = await sql<{ section_number: string; title: string; division: number }[]>`
      SELECT section_number, title, division FROM public.spec_sections
       WHERE section_number IN ('03 30 00', '08 41 13', '23 31 13')
       ORDER BY section_number
    `
    expect(known).toHaveLength(3)
    expect(known.find((r) => r.section_number === '03 30 00')?.title).toMatch(/Cast-in-Place Concrete/i)
    expect(known.find((r) => r.section_number === '08 41 13')?.division).toBe(8)
  })

  it('Iris seed now returns 7 view-type-aware suggestions for a fresh project', async () => {
    // Run as the test user so auth.uid() resolves.
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
      const result = await tx<{ seed_iris_suggested_submittal_views: number }[]>`
        SELECT public.seed_iris_suggested_submittal_views(${projectId})
      `
      expect(result[0].seed_iris_suggested_submittal_views).toBe(7)
    })

    const seeded = await sql<{ name: string; view_type: string | null }[]>`
      SELECT name, view_state->>'viewType' AS view_type
        FROM public.submittal_saved_views
       WHERE project_id = ${projectId} AND scope = 'iris'
       ORDER BY created_at
    `
    expect(seeded).toHaveLength(7)
    const byView = seeded.reduce<Record<string, string[]>>((acc, row) => {
      const k = row.view_type ?? 'unknown'
      acc[k] = acc[k] ?? []
      acc[k].push(row.name)
      return acc
    }, {})
    expect(byView.items?.length).toBe(4)
    expect(byView.packages?.length).toBe(1)
    expect(byView.spec_sections?.length).toBe(1)
    expect(byView.ball_in_court?.length).toBe(1)

    expect(byView.packages?.[0]).toBe('Long-running packages')
    expect(byView.spec_sections?.[0]).toBe('Drawing-heavy divisions')
    expect(byView.ball_in_court?.[0]).toBe('Architect plate')
  })

  it('package-CRUD round-trip is verifiable when submittal_packages exists', async () => {
    // The canonical Submittals migration owns submittal_packages + submittals.
    // When the smoke DB has them, we round-trip create → set members → update
    // → delete inside a single rolled-back transaction. When it doesn't, the
    // existence check below skips this case so the smoke stays green on
    // partially-migrated environments. The unit suite at
    // src/test/services/submittalPackages.test.ts covers all four mutation
    // paths via mocked supabase.
    const exists = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.submittal_packages') IS NOT NULL AS exists
    `
    if (!exists[0].exists) {
      // Skip cleanly — log so it's visible in the smoke report.
      // eslint-disable-next-line no-console
      console.info('[phase4-smoke] skipping package round-trip: submittal_packages not present in this DB')
      return
    }

    await sql.begin(async (tx) => {
      await tx`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`

      // Create with no submittals attached — independent of the submittals
      // table shape (env-portable). Then assert the package landed.
      const created = await tx<{ submittal_create_package: string }[]>`
        SELECT public.submittal_create_package(
          ${projectId}, 'Smoke Package', 'desc', NULL, '03 30 00', ${[] as string[]}::uuid[]
        )
      `
      const packageId = created[0].submittal_create_package
      expect(packageId).toMatch(/^[0-9a-f-]{36}$/i)

      // Update title.
      await tx`
        SELECT public.submittal_update_package(${packageId}, 'Renamed', NULL, NULL, '08 41 13')
      `
      const updated = await tx<{ title: string; csi_section: string }[]>`
        SELECT title, csi_section FROM public.submittal_packages WHERE id = ${packageId}
      `
      expect(updated[0].title).toBe('Renamed')
      expect(updated[0].csi_section).toBe('08 41 13')

      // setMembers with empty array is a no-op when there are no current members.
      await tx`
        SELECT public.submittal_set_package_members(${packageId}, ${[] as string[]}::uuid[])
      `

      // Delete.
      await tx`SELECT public.submittal_delete_package(${packageId})`
      const gone = await tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.submittal_packages WHERE id = ${packageId}
      `
      expect(gone[0].count).toBe(0)
    })
  })
})
