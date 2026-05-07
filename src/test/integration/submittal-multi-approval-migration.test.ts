// Phase 7c-1 — migration smoke test.
//
// Same env-gated pattern as the prior smoke tests (auto-skips when
// SUBMITTAL_SMOKE_DB_URL isn't set). Asserts:
//   - submittal_step_comments table exists
//   - 5 RPCs created (advance_chain + record_disposition_v2 + send_back +
//     create/edit/delete step comments)
//   - submittal_reviewers got the 3 new columns
//
// Run locally with:
//   SUBMITTAL_SMOKE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
//     npm test -- --run src/test/integration/submittal-multi-approval-migration.test.ts

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

const DB_URL = process.env.SUBMITTAL_SMOKE_DB_URL
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260512000000_submittal_multi_approval.sql',
)

const TEST_SCOPED = DB_URL ? describe : describe.skip

TEST_SCOPED('submittal multi-approval migration smoke', () => {
  if (!DB_URL) return
  let sql: ReturnType<typeof postgres>
  let hasCanonicalSchema = false

  beforeAll(async () => {
    sql = postgres(DB_URL, { max: 1, idle_timeout: 5 })
    // Phase 7c-1's migration depends on submittal_reviewers (from the
    // canonical Submittals migration). If the local DB doesn't have that
    // table, we skip the smoke gracefully — the unit suite covers the
    // service path via mocks.
    const exists = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.submittal_reviewers') IS NOT NULL AS exists
    `
    hasCanonicalSchema = exists[0].exists === true
    if (!hasCanonicalSchema) {
      // eslint-disable-next-line no-console
      console.info('[multi-approval-smoke] skipping: canonical submittals schema not present on this DB')
      return
    }
    await sql.unsafe(fs.readFileSync(MIGRATION_PATH, 'utf8'))
  }, 30_000)

  afterAll(async () => {
    await sql?.end({ timeout: 5 })
  })

  it.skipIf(!hasCanonicalSchema)('creates submittal_step_comments table', async () => {
    const exists = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.submittal_step_comments') IS NOT NULL AS exists
    `
    expect(exists[0].exists).toBe(true)
  })

  it.skipIf(!hasCanonicalSchema)('creates the 6 multi-approval RPCs', async () => {
    const fns = await sql<{ proname: string }[]>`
      SELECT proname FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname IN (
           'submittal_advance_chain',
           'submittal_record_disposition_v2',
           'submittal_send_back',
           'submittal_create_step_comment',
           'submittal_edit_step_comment',
           'submittal_delete_step_comment'
         )
       ORDER BY proname
    `
    expect(fns.map((r) => r.proname)).toEqual([
      'submittal_advance_chain',
      'submittal_create_step_comment',
      'submittal_delete_step_comment',
      'submittal_edit_step_comment',
      'submittal_record_disposition_v2',
      'submittal_send_back',
    ])
  })

  it.skipIf(!hasCanonicalSchema)('adds iris_thread_summary + iris_summary_updated_at + is_open columns to submittal_reviewers', async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'submittal_reviewers'
         AND column_name IN ('iris_thread_summary', 'iris_summary_updated_at', 'is_open')
       ORDER BY column_name
    `
    expect(cols.map((c) => c.column_name)).toEqual([
      'iris_summary_updated_at',
      'iris_thread_summary',
      'is_open',
    ])
  })
})
