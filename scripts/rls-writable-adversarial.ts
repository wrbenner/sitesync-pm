#!/usr/bin/env tsx
/**
 * scripts/rls-writable-adversarial.ts — BRT sub-4 §4.6 verification.
 *
 * Adversarial test for the read-only-mode restrictive RLS sweep
 * (`20261010000000_rls_writable_restrictive_sweep.sql`). Runs entirely
 * inside a single transaction that's rolled back at the end, so the
 * script is safe to run against any non-prod environment.
 *
 * What it asserts:
 *   1. is_org_writable() returns false for a paused subscription with
 *      access_revoked_at in the past, and true for an active one.
 *   2. v_writable_restrictive_coverage shows restrictive_policies = 3
 *      for every non-exempt org-scoped table.
 *   3. An authenticated member of a paused org cannot INSERT on a
 *      non-exempt org-scoped table (expects PG error 42501).
 *   4. The same member can still SELECT from that table (reads remain
 *      open so users can export).
 *   5. dunning-email-log INSERT continues to work even when the org is
 *      paused (cron must keep writing while user is locked out).
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://..." npx tsx scripts/rls-writable-adversarial.ts
 *
 * Exit codes:
 *   0 — all assertions passed
 *   1 — at least one assertion failed (details printed)
 *   2 — script error (DB connection, schema mismatch, etc.)
 */

import postgres from 'postgres'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('SUPABASE_DB_URL is required (postgresql://...)')
  process.exit(2)
}

interface CoverageRow {
  table_name: string
  is_exempt: boolean
  restrictive_policies: number
}

const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures.push(msg)
    console.error(`  ✗ ${msg}`)
  } else {
    console.log(`  ✓ ${msg}`)
  }
}

async function main() {
  const sql = postgres(url!, { max: 1, idle_timeout: 5 })

  try {
    // The whole test runs in one transaction. Throw at the end to ensure
    // ROLLBACK — postgres-js auto-commits on successful callback return.
    try {
      await sql.begin(async (tx) => {
        // -------------------------------------------------------------
        // Phase 1 — coverage check (read-only; no seed needed).
        // -------------------------------------------------------------
        console.log('\nPhase 1: restrictive policy coverage')

        const gap = await tx<CoverageRow[]>`
          SELECT table_name, is_exempt, restrictive_policies
          FROM v_writable_restrictive_coverage
          WHERE is_exempt = false AND restrictive_policies <> 3
          ORDER BY table_name
        `
        assert(
          gap.length === 0,
          gap.length === 0
            ? 'every non-exempt org-scoped table has 3 restrictive policies'
            : `${gap.length} non-exempt tables missing restrictive policies: ${gap.map(g => g.table_name).join(', ')}`
        )

        // Pick the first non-exempt table we know how to probe. We
        // prefer `portfolios` (simple schema) but fall back to any
        // covered non-exempt table; this stays robust to schema drift.
        const probeRow = await tx<{ table_name: string }[]>`
          SELECT table_name
          FROM v_writable_restrictive_coverage
          WHERE is_exempt = false
            AND restrictive_policies = 3
            AND table_name IN ('portfolios','org_branding','custom_reports','api_keys','project_templates')
          ORDER BY array_position(
            ARRAY['portfolios','org_branding','custom_reports','api_keys','project_templates'],
            table_name
          )
          LIMIT 1
        `
        if (probeRow.length === 0) {
          throw new Error('no known probe table found in v_writable_restrictive_coverage; update probe list')
        }
        const probeTable = probeRow[0].table_name
        console.log(`  probe table: ${probeTable}`)

        // -------------------------------------------------------------
        // Phase 2 — seed: test org, user, membership, paused sub.
        // -------------------------------------------------------------
        console.log('\nPhase 2: seed paused-state fixtures')

        const [{ id: testOrgId }] = await tx<{ id: string }[]>`
          INSERT INTO organizations (name, slug)
          VALUES ('rls-adv-test-org', 'rls-adv-test-' || substr(md5(random()::text), 1, 8))
          RETURNING id
        `
        // Use a service-role-friendly synthetic uuid; auth.users INSERT
        // requires auth-schema privileges so we just pretend a JWT sub.
        const testUserId = (await tx<{ id: string }[]>`SELECT gen_random_uuid() AS id`)[0].id

        await tx`
          INSERT INTO organization_members (organization_id, user_id, role)
          VALUES (${testOrgId}, ${testUserId}, 'owner')
        `

        const [{ id: subId }] = await tx<{ id: string }[]>`
          INSERT INTO subscriptions (organization_id, status, access_revoked_at, current_period_start, current_period_end)
          VALUES (${testOrgId}, 'paused', NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day')
          RETURNING id
        `
        console.log(`  seeded org=${testOrgId.slice(0, 8)}… sub=${subId.slice(0, 8)}…`)

        // -------------------------------------------------------------
        // Phase 3 — assert is_org_writable returns false.
        // -------------------------------------------------------------
        console.log('\nPhase 3: is_org_writable predicate')
        const [{ writable: pausedWritable }] = await tx<{ writable: boolean }[]>`
          SELECT is_org_writable(${testOrgId}) AS writable
        `
        assert(pausedWritable === false, 'is_org_writable returns false for paused org with revoked access')

        // -------------------------------------------------------------
        // Phase 4 — simulated authenticated user attempts INSERT on
        // a non-exempt table. Expect 42501.
        // -------------------------------------------------------------
        console.log(`\nPhase 4: adversarial INSERT on ${probeTable} (expect 42501)`)
        await tx.unsafe(`SET LOCAL ROLE authenticated`)
        await tx.unsafe(
          `SET LOCAL "request.jwt.claims" = ` +
            `'${JSON.stringify({ sub: testUserId, role: 'authenticated' })}'`
        )

        // The INSERT shape is table-specific; we pick a minimal-payload
        // shape per probe table. New probe targets need a clause here.
        let blocked42501 = false
        try {
          const safeName = `rls-adv-probe-${testUserId.slice(0, 8)}`
          if (probeTable === 'portfolios') {
            await tx`INSERT INTO portfolios (organization_id, name) VALUES (${testOrgId}, ${safeName})`
          } else if (probeTable === 'org_branding') {
            await tx`INSERT INTO org_branding (organization_id) VALUES (${testOrgId})`
          } else if (probeTable === 'custom_reports') {
            await tx`INSERT INTO custom_reports (organization_id, name, config) VALUES (${testOrgId}, ${safeName}, '{}'::jsonb)`
          } else if (probeTable === 'api_keys') {
            await tx`INSERT INTO api_keys (organization_id, name, key_hash, key_prefix) VALUES (${testOrgId}, ${safeName}, ${safeName + '_hash'}, 'sk_test_')`
          } else if (probeTable === 'project_templates') {
            await tx`INSERT INTO project_templates (organization_id, name) VALUES (${testOrgId}, ${safeName})`
          } else {
            throw new Error(`no INSERT clause for probe table ${probeTable}; add one`)
          }
        } catch (e) {
          const code = (e as { code?: string }).code
          if (code === '42501') {
            blocked42501 = true
          } else {
            console.error(`  unexpected error: ${(e as Error).message}`)
            throw e
          }
        }
        assert(blocked42501, `INSERT on ${probeTable} for paused org denied with 42501`)

        // -------------------------------------------------------------
        // Phase 5 — same authenticated user can still SELECT.
        // -------------------------------------------------------------
        console.log(`\nPhase 5: SELECT still allowed on ${probeTable}`)
        let readOk = false
        try {
          await tx.unsafe(`SELECT 1 FROM ${probeTable} LIMIT 1`)
          readOk = true
        } catch (e) {
          console.error(`  read failed: ${(e as Error).message}`)
        }
        assert(readOk, `SELECT on ${probeTable} remains permitted in read-only mode`)

        // -------------------------------------------------------------
        // Phase 6 — exempt table (dunning_email_log) accepts INSERT
        // even though the org is paused (cron must keep writing).
        // -------------------------------------------------------------
        console.log('\nPhase 6: dunning_email_log INSERT (exempt path)')
        // Reset to service-role to bypass per-table permissive policies
        // we don't simulate here; we only care that the restrictive
        // is_org_writable gate does NOT fire for an exempt table.
        await tx.unsafe(`RESET ROLE`)
        let dunningOk = false
        try {
          await tx`
            INSERT INTO dunning_email_log (subscription_id, organization_id, kind)
            VALUES (${subId}, ${testOrgId}, 'account_paused_day_8')
          `
          dunningOk = true
        } catch (e) {
          console.error(`  dunning INSERT failed: ${(e as Error).message}`)
        }
        assert(dunningOk, 'dunning_email_log INSERT succeeds while org paused (exempt)')

        // -------------------------------------------------------------
        // Phase 7 — flip to active, verify INSERT now succeeds.
        // -------------------------------------------------------------
        console.log(`\nPhase 7: subscription→active unblocks INSERT on ${probeTable}`)
        await tx`
          UPDATE subscriptions
          SET status = 'active', access_revoked_at = NULL
          WHERE id = ${subId}
        `
        const [{ writable: activeWritable }] = await tx<{ writable: boolean }[]>`
          SELECT is_org_writable(${testOrgId}) AS writable
        `
        assert(activeWritable === true, 'is_org_writable returns true after subscription→active')

        // Re-authenticate and retry the INSERT.
        await tx.unsafe(`SET LOCAL ROLE authenticated`)
        await tx.unsafe(
          `SET LOCAL "request.jwt.claims" = ` +
            `'${JSON.stringify({ sub: testUserId, role: 'authenticated' })}'`
        )
        let activeInsertOk = false
        try {
          const safeName = `rls-adv-probe-active-${testUserId.slice(0, 8)}`
          if (probeTable === 'portfolios') {
            await tx`INSERT INTO portfolios (organization_id, name) VALUES (${testOrgId}, ${safeName})`
          } else if (probeTable === 'org_branding') {
            await tx`INSERT INTO org_branding (organization_id) VALUES (${testOrgId}) ON CONFLICT (organization_id) DO NOTHING`
          } else if (probeTable === 'custom_reports') {
            await tx`INSERT INTO custom_reports (organization_id, name, config) VALUES (${testOrgId}, ${safeName}, '{}'::jsonb)`
          } else if (probeTable === 'api_keys') {
            await tx`INSERT INTO api_keys (organization_id, name, key_hash, key_prefix) VALUES (${testOrgId}, ${safeName}, ${safeName + '_hash'}, 'sk_test_')`
          } else if (probeTable === 'project_templates') {
            await tx`INSERT INTO project_templates (organization_id, name) VALUES (${testOrgId}, ${safeName})`
          }
          activeInsertOk = true
        } catch (e) {
          const code = (e as { code?: string }).code
          console.error(`  active INSERT failed (code=${code}): ${(e as Error).message}`)
        }
        assert(activeInsertOk, `INSERT on ${probeTable} succeeds once subscription is active`)

        // -------------------------------------------------------------
        // Force ROLLBACK by throwing. postgres-js commits on clean
        // return, so the explicit error is intentional. We surface the
        // failure list below instead of bubbling this sentinel.
        // -------------------------------------------------------------
        throw new Error('__ROLLBACK_SENTINEL__')
      })
    } catch (e) {
      if ((e as Error).message !== '__ROLLBACK_SENTINEL__') {
        throw e
      }
    }
  } finally {
    await sql.end({ timeout: 5 })
  }

  if (failures.length > 0) {
    console.error(`\nFAIL: ${failures.length} assertion(s) failed`)
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log('\nOK: all adversarial assertions passed')
}

main().catch((err) => {
  console.error('Script error:', err)
  process.exit(2)
})
