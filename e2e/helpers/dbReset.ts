/**
 * dbReset — reset the test DB to a known seed between scenarios.
 *
 * Two modes:
 *   • 'truncate' (default for teardown): wipes test-scoped rows by
 *     DELETE-ing where project_id IN (test fixture project IDs).
 *     Fast, doesn't touch anything outside the test fixtures.
 *   • 'reseed' (default for setup): truncate + re-run the test seed.
 *
 * Spec calls for "Supabase branch reset" — that requires Supabase Branching
 * with billing-tier support. v1 uses the local truncate+reseed approach
 * which gives the same isolation guarantee for the test fixtures we own.
 * Branching wires in when the customer-facing branching feature is GA on
 * our project.
 *
 * The fixtures' project IDs are deterministic (seeded UUIDs in
 * e2e/fixtures/projects/) so the truncate is bounded — never touches
 * non-fixture data.
 */

// `postgres` is loaded dynamically inside resetTestDb so the module's
// top-level constants (FIXTURE_PROJECT_IDS) are importable in unit tests
// without requiring the `postgres` runtime dep.
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface DbResetOptions {
  /** Connection string — defaults to local Supabase. */
  databaseUrl?: string
  /** 'reseed' (default) or 'truncate'. */
  mode?: 'reseed' | 'truncate'
}

const DEFAULT_DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

// Re-export from the dep-free fixtureIds module so callers can import
// either path. Unit tests import from `./fixtureIds` directly to avoid
// the `postgres` runtime resolution.
export { FIXTURE_PROJECT_IDS } from './fixtureIds'
import { FIXTURE_PROJECT_IDS as FIXTURE_PROJECT_IDS_LOCAL } from './fixtureIds'

const SCOPED_TABLES = [
  'rfi_responses',
  'rfis',
  'submittal_approvals',
  'submittals',
  'punch_items',
  'tasks',
  'daily_log_entries',
  'daily_logs',
  'change_orders',
  'meeting_action_items',
  'meeting_attendees',
  'meetings',
  'activity_feed',
  'notifications',
  'directory_contacts',
  'crews',
  'workforce_members',
  'media_links',
  'crew_checkins',
  'incidents',
  'safety_observations',
  'audit_chain_checkpoints',
  'daily_log_revisions',
  'project_members',
  'projects',
] as const

export async function resetTestDb(opts: DbResetOptions): Promise<void> {
  // @ts-expect-error optional runtime dependency — installed as needed by CI
  const { default: postgres } = await import('postgres')
  const sql = postgres(opts.databaseUrl ?? DEFAULT_DB_URL, {
    max: 1,
    idle_timeout: 5,
  })
  try {
    await sql`SET session_replication_role = replica`
    for (const table of SCOPED_TABLES) {
      await sql.unsafe(
        `DELETE FROM ${table} WHERE project_id = ANY($1::uuid[])`,
        [FIXTURE_PROJECT_IDS_LOCAL as unknown as string[]],
      ).catch(() => {
        // Some tables may not exist on every deployment (e.g. crew_checkins
        // before the platinum-field migration). Skip gracefully.
      })
    }
    await sql`SET session_replication_role = origin`

    if ((opts.mode ?? 'reseed') === 'reseed') {
      // Apply the e2e seed file if present. Empty seed = no-op (which is
      // correct for scenarios that build their own state in-test).
      const seedPath = 'e2e/fixtures/projects/seed.sql'
      try {
        const seedSql = await readFile(seedPath, 'utf8')
        await sql.unsafe(seedSql)
      } catch {
        // No seed file is a valid configuration.
      }
    }
  } finally {
    await sql.end()
  }
}

/** Read all fixture JSONs from a directory. Used by tests that need to
 *  spread per-identity test data without a per-scenario JSON. */
export async function readFixtureDir(subdir: string): Promise<Record<string, unknown>[]> {
  const dir = join('e2e/fixtures', subdir)
  const out: Record<string, unknown>[] = []
  try {
    const entries = await readdir(dir)
    for (const name of entries) {
      if (!name.endsWith('.json')) continue
      const raw = await readFile(join(dir, name), 'utf8')
      out.push(JSON.parse(raw))
    }
  } catch {
    // Empty fixture dir is fine.
  }
  return out
}
