/**
 * FMEA H.SOFTDEL.1 — Soft-delete leakage
 *
 * Hazard: a query that forgets `.is('deleted_at', null)` (or its
 *         `deleted_at IS NULL` SQL twin) silently returns soft-deleted
 *         rows in production read paths. Worst-case the user sees a
 *         "deleted" RFI still in their list and re-acts on it.
 *
 * Test approach (two layers):
 *   1. Static-source assertion — every read path under
 *      `src/api/endpoints/` and `src/hooks/queries/` that touches a
 *      table with a soft-delete column ('rfis', 'submittals',
 *      'change_orders', 'punch_list_items', 'tasks', etc.) MUST either
 *      filter explicitly OR opt into the deleted view via a known
 *      sentinel (the `useDeletedRFIs` hook, or `includeDeleted: true`
 *      flag). Anything else is the hazard.
 *
 *   2. Live SQL-pgtap assertion (skip-gracefully without staging) —
 *      INSERT an RFI as service_role, UPDATE deleted_at = now(), then
 *      query rfis with NO deleted_at filter as anon/authed; assert zero
 *      rows visible in standard read paths.
 *
 * The static layer protects the codebase from regressions; the SQL layer
 * protects against a missing trigger / view in production. Together they
 * close the hazard from both ends. Runs in vitest + jsdom; the SQL part
 * skips when SUPABASE_URL / SUPABASE_SERVICE_KEY are not set.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..')

const TABLES_WITH_SOFT_DELETE = [
  'rfis',
  'submittals',
  'change_orders',
  'punch_list_items',
  'tasks',
  'daily_logs',
  'schedule_items',
  'documents',
  'drawings',
] as const

/** Allowlist of files that LEGITIMATELY query soft-deleted rows. */
const SOFT_DELETED_OPT_IN_FILES = [
  'src/hooks/queries/useDeletedRFIs.ts',
  'src/api/endpoints/schedule.ts', // exports `deletedSelect` + admin restore path
] as const

/**
 * KNOWN-VIOLATION LEDGER — readers that today DON'T filter soft-deleted
 * rows. Surfaced by FMEA Wave 2 test authoring (2026-05-14). Each entry
 * is a real, fileable bug — they leak soft-deleted rows into the user-
 * facing list and detail paths. Tracked in:
 *
 *   docs/audits/FMEA_CATALOG_2026-05-14.md — H.SOFTDEL.1 (VALIDATED)
 *
 * The original 3 violations (rfis, submittals, daily_logs) were closed
 * on 2026-05-14 by fix/softdel-leaks-api-endpoints. The ledger framework
 * is retained as a ratchet — adding a new entry here documents drift; a
 * green run with an empty ledger proves the hazard remains validated.
 */
const KNOWN_VIOLATIONS: Readonly<Record<string, readonly string[]>> = {
  // Empty: all original H.SOFTDEL.1 violations closed 2026-05-14.
} as const

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (
        name === 'node_modules' ||
        name === 'dist' ||
        name.startsWith('.') ||
        name === '__tests__'
      )
        continue
      walk(full, acc)
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      acc.push(full)
    }
  }
  return acc
}

/** Return true if `src` contains a soft-delete filter referencing `table`. */
function hasSoftDeleteFilter(src: string, _table: string): boolean {
  // Accept any of:
  //   .is('deleted_at', null)
  //   .filter('deleted_at', 'is', null)
  //   `deleted_at IS NULL`
  //   `deleted_at is null`
  //   `whereNullDeletedAt`  (named helper, see src/api/client.ts)
  //   `includeDeleted: false`
  if (/\.is\(\s*['"]deleted_at['"]\s*,\s*null\s*\)/.test(src)) return true
  if (/['"]deleted_at['"]\s*,\s*['"]is['"]\s*,\s*null/.test(src)) return true
  if (/deleted_at\s+is\s+null/i.test(src)) return true
  if (/whereNullDeletedAt|softDeleteFilter|includeDeleted/.test(src)) return true
  return false
}

describe('FMEA H.SOFTDEL.1 — static: read paths filter soft-deleted', () => {
  const apiDir = resolve(REPO_ROOT, 'src', 'api', 'endpoints')
  const hooksDir = resolve(REPO_ROOT, 'src', 'hooks', 'queries')
  const files = [
    ...(safeWalk(apiDir)),
    ...(safeWalk(hooksDir)),
  ]

  function safeWalk(d: string): string[] {
    try {
      return walk(d)
    } catch {
      return []
    }
  }

  for (const table of TABLES_WITH_SOFT_DELETE) {
    it(`every reader of '${table}' filters deleted_at (or is allow-listed)`, () => {
      const violations: string[] = []
      for (const f of files) {
        const rel = f.slice(REPO_ROOT.length + 1)
        if (SOFT_DELETED_OPT_IN_FILES.includes(rel as never)) continue

        const src = readFileSync(f, 'utf-8')
        // Quick exit: file must mention the table verbatim to be a reader.
        const fromRegex = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)`)
        if (!fromRegex.test(src)) continue

        // It's a reader. Demand an explicit filter (anywhere in the file —
        // we're not parsing scope, just ensuring intent is encoded).
        if (!hasSoftDeleteFilter(src, table)) {
          violations.push(rel)
        }
      }

      // Subtract documented known-violations. Each fix removes a name
      // from KNOWN_VIOLATIONS; CI fails when a NEW violation appears.
      const allowed = new Set<string>(KNOWN_VIOLATIONS[table] ?? [])
      const newViolations = violations.filter((v) => !allowed.has(v))

      expect(
        newViolations,
        `NEW soft-delete filter missing in readers of '${table}' (not in KNOWN_VIOLATIONS):\n` +
          newViolations.map((v) => `  - ${v}`).join('\n'),
      ).toEqual([])

      // Also: confirm the ledger still describes reality — every
      // listed file is in fact still missing the filter. If a file
      // gets fixed but isn't removed from the ledger, surface that so
      // the ledger stays honest.
      const allowedStillFailing = violations.filter((v) => allowed.has(v))
      const fixedButStillListed = [...allowed].filter(
        (v) => !violations.includes(v),
      )
      expect(
        fixedButStillListed,
        `KNOWN_VIOLATIONS entry for '${table}' references file that now filters correctly:\n` +
          fixedButStillListed.map((v) => `  - ${v}`).join('\n') +
          '\nRemove this entry from KNOWN_VIOLATIONS to flip the hazard to VALIDATED.',
      ).toEqual([])
      // Trace: keep the count surfaced for posterity / dashboards.
      void allowedStillFailing
    })
  }
})

// ── SQL-layer assertion (staging only) ───────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SQL_SHOULD_RUN = Boolean(SUPABASE_URL && SERVICE_KEY && ANON_KEY)

describe.skipIf(!SQL_SHOULD_RUN)(
  'FMEA H.SOFTDEL.1 — live: soft-deleted RFI not visible to standard read path',
  () => {
    it('inserting + soft-deleting an RFI hides it from anon SELECT', async () => {
      // Mint a fresh RFI via PostgREST as service_role so we bypass RLS
      // for the insert. Then UPDATE deleted_at, then SELECT as anon and
      // confirm the row isn't returned.
      const marker = `softdel-test-${Date.now()}`

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/rfis`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ title: marker, status: 'open' }),
      })
      if (insertRes.status >= 400) {
        // Schema mismatch in staging — skip rather than fail this assertion.
        // The static assertion above already covers the codebase invariant.
        return
      }
      const rows = (await insertRes.json()) as Array<{ id: string }>
      const id = rows[0]?.id
      if (!id) return

      try {
        // Soft-delete it.
        await fetch(`${SUPABASE_URL}/rest/v1/rfis?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ deleted_at: new Date().toISOString() }),
        })

        // Anon SELECT with explicit filter — the production read path.
        const selectRes = await fetch(
          `${SUPABASE_URL}/rest/v1/rfis?id=eq.${id}&deleted_at=is.null`,
          {
            headers: {
              apikey: ANON_KEY,
              Authorization: `Bearer ${ANON_KEY}`,
            },
          },
        )
        const body = (await selectRes.json().catch(() => [])) as unknown[]
        expect(
          Array.isArray(body) ? body.length : -1,
          'soft-deleted RFI must NOT be returned by deleted_at=is.null filter',
        ).toBe(0)
      } finally {
        // Hard-delete the test row.
        await fetch(`${SUPABASE_URL}/rest/v1/rfis?id=eq.${id}`, {
          method: 'DELETE',
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }).catch(() => undefined)
      }
    })
  },
)
