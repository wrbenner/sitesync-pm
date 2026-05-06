/**
 * check-lap-2-gate.ts — Day 60 gate dry-run, scriptable.
 *
 * Reads `lap_2_gate_metrics_daily` + `verify_audit_chain(NULL)` +
 * `lap_2_open_incident_count()`, applies the same thresholds as
 * `.github/workflows/lap-2-acceptance.yml`, and exits with the gate
 * verdict (0 = pass, 0 = soft-fail with warning, 1 = hard fail).
 *
 * Use cases:
 *   - Local dev: run against a local Supabase to validate seed data
 *   - Pilot: Walker runs this on demand to see where the gate stands
 *   - CI parity: after seed-lap-2-gate-dry-run.ts seeds a scenario,
 *     this script asserts the expected verdict
 *
 * Usage:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  npx tsx scripts/check-lap-2-gate.ts
 *   ENV=...                                          npx tsx scripts/check-lap-2-gate.ts --refresh
 *
 * Flags:
 *   --refresh       REFRESH MATERIALIZED VIEW CONCURRENTLY before reading
 *   --json          emit machine-readable JSON instead of human output
 *   --expect=<v>    assert verdict matches one of pass|soft-fail|hard-fail
 */

import { createClient } from '@supabase/supabase-js'
import { evaluateLap2Gate, type Lap2GateMetrics } from './lap-2-gate-thresholds'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(2)
}

const args = new Set(process.argv.slice(2))
const refresh = args.has('--refresh')
const json = args.has('--json')
const expectArg = process.argv.find((a) => a.startsWith('--expect='))
const expectedVerdict = expectArg?.split('=')[1] ?? null

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main(): Promise<void> {
  if (refresh) {
    // Refresh the materialized view via a tiny RPC the migration ships.
    // (Direct REFRESH MATERIALIZED VIEW isn't reachable from supabase-js
    // — we'd need a helper RPC; for the dry-run the seed script wakes
    // the view itself, so this flag is a forward-compat noop today.)
    console.error('[check-lap-2-gate] --refresh requested but not yet wired; relying on cron-driven refresh')
  }

  const { data: row, error: rowError } = await supabase
    .from('lap_2_gate_metrics_daily')
    .select(
      'approved_count, acceptance_rate_pct, avg_time_to_approve_sec, ghost_approval_count',
    )
    .order('metric_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (rowError) {
    console.error('Failed to read lap_2_gate_metrics_daily:', rowError.message)
    process.exit(2)
  }
  if (!row) {
    console.error('lap_2_gate_metrics_daily has no rows; refresh the view')
    process.exit(2)
  }

  const { data: openIncidents, error: incError } = await supabase.rpc(
    'lap_2_open_incident_count',
  )
  if (incError) {
    console.error('Failed to read lap_2_open_incident_count:', incError.message)
    process.exit(2)
  }

  // verify_audit_chain returns rows ONLY when the chain is broken.
  const { data: brokenRows, error: chainError } = await supabase.rpc(
    'verify_audit_chain',
    { start_after: null },
  )
  if (chainError) {
    console.error('Failed to read verify_audit_chain:', chainError.message)
    process.exit(2)
  }

  const metrics: Lap2GateMetrics = {
    approved_count: Number(row.approved_count ?? 0),
    acceptance_rate_pct:
      row.acceptance_rate_pct == null ? null : Number(row.acceptance_rate_pct),
    avg_time_to_approve_sec:
      row.avg_time_to_approve_sec == null ? null : Number(row.avg_time_to_approve_sec),
    ghost_approval_count: Number(row.ghost_approval_count ?? 0),
    open_incidents: Number(openIncidents ?? 0),
    audit_chain_broken: Array.isArray(brokenRows) ? brokenRows.length : 0,
  }

  const result = evaluateLap2Gate(metrics)

  if (json) {
    console.log(JSON.stringify({ metrics, ...result }, null, 2))
  } else {
    console.log(`[Lap 2 Gate] verdict: ${result.verdict.toUpperCase()}`)
    console.log(`  approved_count          = ${metrics.approved_count}`)
    console.log(`  acceptance_rate_pct     = ${metrics.acceptance_rate_pct}`)
    console.log(`  avg_time_to_approve_sec = ${metrics.avg_time_to_approve_sec}`)
    console.log(`  ghost_approval_count    = ${metrics.ghost_approval_count}`)
    console.log(`  open_incidents          = ${metrics.open_incidents}`)
    console.log(`  audit_chain_broken      = ${metrics.audit_chain_broken}`)
    if (result.warnings.length > 0) {
      console.log('Warnings:')
      for (const w of result.warnings) console.log('  - ' + w)
    }
    if (result.failures.length > 0) {
      console.log('Failures:')
      for (const f of result.failures) console.log('  - ' + f)
    }
  }

  if (expectedVerdict && expectedVerdict !== result.verdict) {
    console.error(
      `Expected verdict "${expectedVerdict}", got "${result.verdict}"`,
    )
    process.exit(3)
  }

  process.exit(result.verdict === 'hard-fail' ? 1 : 0)
}

main().catch((err) => {
  console.error('Unhandled error in check-lap-2-gate:', err)
  process.exit(2)
})
