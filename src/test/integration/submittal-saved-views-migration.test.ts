// Phase 3 — migration smoke test for submittal_saved_views.
//
// Bugatti standard: the migration SQL is exercised against a real Postgres
// (the local Supabase instance) and the seed RPC is round-tripped end-to-end.
// Skips automatically when no DB URL is configured (CI runs use a different
// harness).
//
// Run locally with:
//   SUBMITTAL_SMOKE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npm test -- --run src/test/integration/submittal-saved-views-migration.test.ts

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const DB_URL = process.env.SUBMITTAL_SMOKE_DB_URL
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260508000000_submittal_saved_views.sql',
)

const TEST_SCOPED = DB_URL ? describe : describe.skip

TEST_SCOPED('submittal_saved_views migration smoke', () => {
  if (!DB_URL) return

  let sql: ReturnType<typeof postgres>
  let projectId: string
  let userId: string
  let cleanupRows: (() => Promise<void>) | null = null

  beforeAll(async () => {
    sql = postgres(DB_URL, { max: 1, idle_timeout: 5 })

    // 1. Apply the migration. IF NOT EXISTS / DROP POLICY IF EXISTS make
    //    this idempotent — re-running on a DB where prior state exists is fine.
    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8')
    await sql.unsafe(migrationSql)

    // 2. Set up a test project + a test member so the seed RPC's
    //    membership check passes. We create rows with random ids and clean up.
    const orgRows = await sql`
      INSERT INTO public.organizations (name)
      VALUES (${'smoketest-org-' + Date.now()})
      RETURNING id
    `
    const orgId = orgRows[0].id as string

    const userRows = await sql`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
      VALUES (gen_random_uuid(), ${'smoke-' + Date.now() + '@x.test'}, '', now(), now(), now(), 'authenticated', 'authenticated')
      RETURNING id
    `
    userId = userRows[0].id as string

    const projRows = await sql`
      INSERT INTO public.projects (name, organization_id)
      VALUES (${'smoketest-project-' + Date.now()}, ${orgId})
      RETURNING id
    `
    projectId = projRows[0].id as string

    await sql`
      INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (${projectId}, ${userId}, 'project_manager')
    `

    cleanupRows = async () => {
      // FK cascade handles the bulk; explicit so we don't leave smoke debris.
      await sql`DELETE FROM public.project_members WHERE project_id = ${projectId}`.catch(() => {})
      await sql`DELETE FROM public.submittal_saved_views WHERE project_id = ${projectId}`.catch(() => {})
      await sql`DELETE FROM public.projects WHERE id = ${projectId}`.catch(() => {})
      await sql`DELETE FROM public.organizations WHERE id = ${orgId}`.catch(() => {})
      await sql`DELETE FROM auth.users WHERE id = ${userId}`.catch(() => {})
    }
  }, 30_000)

  afterAll(async () => {
    if (cleanupRows) await cleanupRows()
    if (sql) await sql.end({ timeout: 5 })
  })

  it('creates the submittal_saved_views table', async () => {
    const r = await sql<{ exists: string | null }[]>`
      SELECT to_regclass('public.submittal_saved_views')::text AS exists
    `
    expect(r[0].exists).toBe('submittal_saved_views')
  })

  it('creates the 4-value scope enum', async () => {
    const r = await sql<{ values: string[] }[]>`
      SELECT array_agg(enumlabel ORDER BY enumsortorder) AS values
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'submittal_saved_view_scope'
    `
    expect(r[0].values).toEqual(['my', 'project', 'company', 'iris'])
  })

  it('creates the Iris seed RPC with SECURITY DEFINER', async () => {
    const r = await sql<{ prokind: string; prosecdef: boolean }[]>`
      SELECT prokind::text, prosecdef
        FROM pg_proc
       WHERE proname = 'seed_iris_suggested_submittal_views'
    `
    expect(r).toHaveLength(1)
    expect(r[0].prosecdef).toBe(true)
  })

  it('enforces the scope-owner check constraint', async () => {
    // my-scope without owner must fail.
    let blocked = false
    try {
      await sql`
        INSERT INTO public.submittal_saved_views (project_id, scope, owner_user_id, name)
        VALUES (${projectId}, 'my', NULL, 'should fail')
      `
    } catch (err) {
      blocked = true
      expect(String(err)).toMatch(/scope_owner_check/)
    }
    expect(blocked).toBe(true)

    // iris-scope WITH owner must fail.
    blocked = false
    try {
      await sql`
        INSERT INTO public.submittal_saved_views (project_id, scope, owner_user_id, name)
        VALUES (${projectId}, 'iris', ${userId}, 'should fail')
      `
    } catch (err) {
      blocked = true
      expect(String(err)).toMatch(/scope_owner_check/)
    }
    expect(blocked).toBe(true)
  })

  it('seed RPC returns 4 on first call and 0 on second (idempotent)', async () => {
    // auth.uid() reads request.jwt.claim.sub. set_config(..., true) is
    // transaction-local, so we call the RPC inside the same tx.
    const first = await sql.begin(async (tx) => {
      await tx`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
      const rows = await tx<{ count: number }[]>`
        SELECT public.seed_iris_suggested_submittal_views(${projectId}) AS count
      `
      return rows[0].count
    })
    expect(first).toBe(4)

    const seeded = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count
        FROM public.submittal_saved_views
       WHERE project_id = ${projectId} AND scope = 'iris'
    `
    expect(Number(seeded[0].count)).toBe(4)

    const second = await sql.begin(async (tx) => {
      await tx`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
      const rows = await tx<{ count: number }[]>`
        SELECT public.seed_iris_suggested_submittal_views(${projectId}) AS count
      `
      return rows[0].count
    })
    expect(second).toBe(0)
  })

  it('seeds the 4 documented Iris views by name', async () => {
    const r = await sql<{ name: string }[]>`
      SELECT name
        FROM public.submittal_saved_views
       WHERE project_id = ${projectId} AND scope = 'iris'
       ORDER BY created_at
    `
    const names = r.map((row) => row.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'Overdue at Architect',
        'Long-lead → Schedule Risk',
        'Resubmit count > 1',
        'Federal Closeout Package',
      ]),
    )
    expect(names).toHaveLength(4)
  })

  it('updates updated_at via trigger on UPDATE', async () => {
    const [before] = await sql<{ id: string; updated_at: string }[]>`
      SELECT id, updated_at FROM public.submittal_saved_views
       WHERE project_id = ${projectId} AND scope = 'iris'
       ORDER BY created_at
       LIMIT 1
    `
    expect(before).toBeDefined()
    // Wait so timestamps differ at the timestamptz resolution.
    await new Promise((r) => setTimeout(r, 25))
    await sql`
      UPDATE public.submittal_saved_views
         SET description = 'touched-by-test'
       WHERE id = ${before.id}
    `
    const [after] = await sql<{ updated_at: string }[]>`
      SELECT updated_at FROM public.submittal_saved_views
       WHERE id = ${before.id}
    `
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime(),
    )
  })

  it('is fully idempotent on re-apply', async () => {
    // Re-apply the entire migration; should not raise.
    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8')
    await expect(sql.unsafe(migrationSql)).resolves.not.toThrow()
  })
})
