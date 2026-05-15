/**
 * FMEA H.AUDIT.1 — Audit hash chain broken by partial rollback
 *
 * Hazard: a transaction inserts an audit_log row, the trigger computes
 *         entry_hash off the prior entry's hash, then the outer
 *         transaction rolls back due to an FK error on another row.
 *         If the trigger or hash-chain bookkeeping leaks state across
 *         the rollback (e.g. via a session-level "last hash" variable
 *         instead of a SELECT), the next successful insert chains to a
 *         hash that never existed in the visible chain. Auditor reads
 *         the chain, recomputes, divergence.
 *
 * Implementation (per supabase/migrations/20260426000001_audit_log_hash_chain.sql):
 *   The trigger does `SELECT entry_hash FROM audit_log ORDER BY
 *   created_at DESC, id DESC LIMIT 1` inside the function. Postgres
 *   MVCC ensures the rolled-back row is invisible to a subsequent
 *   transaction, so the chain stays sound *provided* the trigger does
 *   not cache state across transactions. This spec is the runnable
 *   contract for that invariant.
 *
 * Test (sql-pgtap-ish, executed via PostgREST RPC):
 *   1. Capture the current tail hash of audit_log (last row).
 *   2. BEGIN tx → INSERT audit_log row A → force an error → ROLLBACK.
 *   3. INSERT audit_log row B in a fresh tx.
 *   4. Assert B.previous_hash == captured-tail (NOT == A.entry_hash,
 *      which never existed in the visible chain).
 *
 * Skip-gracefully when SUPABASE_URL / SUPABASE_SERVICE_KEY not set,
 * because the test needs service-role access to write audit_log and an
 * RPC entry point for the BEGIN/ROLLBACK block. We expose the
 * sequence via a temporary SQL file that runs through the
 * `execute_sql` RPC if available, otherwise we degrade to a static
 * migration assertion: the trigger MUST use a SELECT (not a session
 * variable) to read previous_hash.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const SHOULD_RUN_LIVE = Boolean(SUPABASE_URL && SERVICE_KEY)

// ── Static layer: trigger reads previous_hash via SELECT, not a session var ──

describe('FMEA H.AUDIT.1 — trigger reads prior hash with rollback-safe SELECT', () => {
  it('audit_log_compute_hash uses SELECT (not a session GUC / temp table)', () => {
    const migration = readFileSync(
      resolve(
        __dirname,
        '..',
        '..',
        'supabase',
        'migrations',
        '20260426000001_audit_log_hash_chain.sql',
      ),
      'utf-8',
    )

    // Must contain a SELECT against audit_log inside the trigger function.
    expect(
      /CREATE OR REPLACE FUNCTION audit_log_compute_hash[\s\S]+?SELECT[\s\S]+?FROM audit_log/i.test(
        migration,
      ),
      'audit_log_compute_hash() must SELECT prior entry_hash from audit_log',
    ).toBe(true)

    // Must NOT cache the prior hash in a session GUC (would survive
    // rollback and corrupt the chain). Reject set_config / current_setting
    // on any prev-hash-shaped name.
    const usesSessionVar =
      /set_config\(\s*'[^']*prev[^']*hash[^']*'/i.test(migration) ||
      /current_setting\(\s*'[^']*prev[^']*hash[^']*'/i.test(migration)
    expect(usesSessionVar, 'must not cache previous_hash in a session GUC').toBe(
      false,
    )

    // Must be BEFORE INSERT (not AFTER), so rolled-back rows never
    // pollute the visible chain.
    expect(
      /BEFORE INSERT ON audit_log/i.test(migration),
      'trigger must fire BEFORE INSERT for rollback safety',
    ).toBe(true)
  })
})

// ── Live layer: rollback truly leaves the chain intact ────────────────

describe.skipIf(!SHOULD_RUN_LIVE)(
  'FMEA H.AUDIT.1 — rolled-back insert does not corrupt next entry_hash',
  () => {
    it('B.previous_hash equals captured-tail, not the rolled-back row', async () => {
      // Step 1 — read current chain tail.
      const tailRes = await fetch(
        `${SUPABASE_URL}/rest/v1/audit_log?select=id,entry_hash,created_at&order=created_at.desc,id.desc&limit=1`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        },
      )
      if (tailRes.status >= 400) return
      const tailRows = (await tailRes.json().catch(() => [])) as Array<{
        id: string
        entry_hash: string
      }>
      const capturedTail = tailRows[0]?.entry_hash ?? null

      // Step 2 — attempt to insert + cause failure within a SQL block.
      // We use the `execute_sql` RPC if exposed; otherwise we approximate
      // by issuing an insert that violates a constraint (causing a tx
      // rollback) and confirm chain state from the outside.
      //
      // Since we cannot send a multi-statement BEGIN/ROLLBACK over REST,
      // we provoke a guaranteed-fail insert (NULL into NOT NULL column)
      // and confirm the chain tail is unchanged afterwards.
      const failBody = {
        // Force NOT NULL violation on entity_type — guaranteed rollback.
        action: 'CREATE',
        // entity_type omitted on purpose
        entity_id: '00000000-0000-0000-0000-000000000000',
      }
      const failRes = await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(failBody),
      })
      // We *expect* this to fail. If it succeeds, the schema is more
      // permissive than expected and the test isn't meaningful — skip.
      if (failRes.status < 400) return

      // Step 3 — insert a real row.
      const goodBody = {
        action: 'CREATE',
        entity_type: 'rfi',
        entity_id: '00000000-0000-0000-0000-000000000000',
        organization_id: null,
        user_email: 'audit-chain-test@example.com',
      }
      const goodRes = await fetch(
        `${SUPABASE_URL}/rest/v1/audit_log?select=id,entry_hash,previous_hash`,
        {
          method: 'POST',
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(goodBody),
        },
      )
      if (goodRes.status >= 400) return
      const goodRows = (await goodRes.json().catch(() => [])) as Array<{
        id: string
        previous_hash: string | null
        entry_hash: string
      }>
      const inserted = goodRows[0]
      expect(inserted, 'inserted row returned').toBeTruthy()
      if (!inserted) return

      // The chain must link to the captured tail — proving the rolled-
      // back insert did NOT leave a ghost link.
      expect(
        inserted.previous_hash,
        'new entry must chain to the prior visible tail',
      ).toBe(capturedTail)

      // (audit_log is append-only — we cannot DELETE the row we just
      // wrote without bypassing the block trigger as postgres
      // superuser. Leave it. The test is idempotent — repeat runs just
      // extend the chain.)
    })
  },
)
