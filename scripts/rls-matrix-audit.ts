#!/usr/bin/env tsx
/**
 * scripts/rls-matrix-audit.ts — BRT sub-1 §4.2.
 *
 * Snapshots v_rls_policy_matrix + v_rls_table_coverage + find_unprotected_tables()
 * to a markdown report at docs/audits/RLS_POLICY_MATRIX_<DATE>.md.
 *
 * Two modes:
 *   default       — write a NEW dated report, do not touch baseline
 *   --baseline    — overwrite docs/audits/RLS_POLICY_MATRIX_BASELINE.md
 *                   (use only when a policy change is intentional and
 *                   reviewed; this is the diff target for the drift detector)
 *   --check       — exit non-zero if the live matrix differs from baseline
 *                   (CI-friendly; no write side effects)
 *
 * Required env (load via .env.local for local dev; CI gets via secrets):
 *   SUPABASE_DB_URL              (postgresql://...) — direct DB connection
 *
 * The script uses postgres-js (already a project dep) so we don't need
 * supabase-cli to do raw SQL.
 */

import postgres from 'postgres'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..')
const BASELINE_PATH = join(REPO_ROOT, 'docs/audits/RLS_POLICY_MATRIX_BASELINE.md')

interface PolicyRow {
  table_name: string
  rls_enabled: boolean
  rls_forced: boolean
  policy_name: string | null
  policy_cmd: string | null
  permissive: boolean | null
  applied_roles: string | null
  using_expr: string | null
  with_check_expr: string | null
}

interface CoverageRow {
  table_name: string
  rls_enabled: boolean
  rls_forced: boolean
  has_org_id_column: boolean
  policy_count: number
  select_policies: number
  insert_policies: number
  update_policies: number
  delete_policies: number
}

interface UnprotectedRow {
  table_name: string
  rls_enabled: boolean
  policy_count: number
  missing_cmds: string | null
}

async function snapshot(): Promise<string> {
  const url = process.env.SUPABASE_DB_URL
  if (!url) {
    throw new Error('SUPABASE_DB_URL is required (postgresql://...)')
  }

  const sql = postgres(url, { max: 1, idle_timeout: 5 })

  try {
    const [policies, coverage, unprotected] = await Promise.all([
      sql<PolicyRow[]>`SELECT * FROM v_rls_policy_matrix`,
      sql<CoverageRow[]>`SELECT * FROM v_rls_table_coverage`,
      sql<UnprotectedRow[]>`SELECT * FROM find_unprotected_tables()`,
    ])

    return renderMarkdown(policies, coverage, unprotected)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function renderMarkdown(
  policies: PolicyRow[],
  coverage: CoverageRow[],
  unprotected: UnprotectedRow[],
): string {
  const out: string[] = []
  out.push('# RLS Policy Matrix\n')
  out.push(`Generated: ${new Date().toISOString()}\n`)
  out.push(`Total tables: ${coverage.length}\n`)
  out.push(`Tables with RLS enabled: ${coverage.filter((c) => c.rls_enabled).length}\n`)
  out.push(`Tables with organization_id: ${coverage.filter((c) => c.has_org_id_column).length}\n`)
  out.push(`Total policies: ${policies.filter((p) => p.policy_name).length}\n`)
  out.push('')
  out.push('## Unprotected tables (CI gate)\n')
  if (unprotected.length === 0) {
    out.push('_None — all org_id-bearing tables have full SELECT/INSERT/UPDATE/DELETE policies._\n')
  } else {
    out.push('| Table | RLS | Policies | Missing |')
    out.push('|---|:---:|---:|---|')
    for (const u of unprotected) {
      out.push(`| ${u.table_name} | ${u.rls_enabled ? '✓' : '✗'} | ${u.policy_count} | ${u.missing_cmds ?? '_unknown_'} |`)
    }
    out.push('')
  }
  out.push('## Coverage by table\n')
  out.push('| Table | RLS | org_id | SEL | INS | UPD | DEL |')
  out.push('|---|:---:|:---:|---:|---:|---:|---:|')
  for (const c of coverage) {
    out.push(
      `| ${c.table_name} | ${c.rls_enabled ? '✓' : '✗'} | ${c.has_org_id_column ? '✓' : '·'} | ` +
      `${c.select_policies} | ${c.insert_policies} | ${c.update_policies} | ${c.delete_policies} |`,
    )
  }
  out.push('')
  out.push('## All policies\n')
  out.push('| Table | Policy | Cmd | Roles | USING | WITH CHECK |')
  out.push('|---|---|---|---|---|---|')
  for (const p of policies) {
    if (!p.policy_name) continue
    out.push(
      `| ${p.table_name} | ${p.policy_name} | ${p.policy_cmd ?? ''} | ` +
      `${p.applied_roles ?? 'PUBLIC'} | ${truncate(p.using_expr)} | ${truncate(p.with_check_expr)} |`,
    )
  }
  out.push('')
  return out.join('\n')
}

function truncate(s: string | null, max = 80): string {
  if (!s) return '_(none)_'
  const oneLine = s.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return '`' + oneLine.replace(/\|/g, '\\|') + '`'
  return '`' + oneLine.slice(0, max - 1).replace(/\|/g, '\\|') + '…`'
}

async function main() {
  const args = process.argv.slice(2)
  const isCheck = args.includes('--check')
  const isBaseline = args.includes('--baseline')

  const md = await snapshot()

  if (isCheck) {
    if (!existsSync(BASELINE_PATH)) {
      console.error(`✗ baseline not found at ${BASELINE_PATH} — run with --baseline once to seed`)
      process.exit(2)
    }
    const baseline = readFileSync(BASELINE_PATH, 'utf-8')
    // Skip the "Generated:" line on both for the diff
    const stripGen = (s: string) => s.replace(/^Generated:.*$/m, '').trim()
    if (stripGen(md) !== stripGen(baseline)) {
      console.error('✗ RLS matrix has drifted from baseline. Run with --baseline to regenerate after review.')
      // Print a small unified diff hint
      const liveLines = stripGen(md).split('\n')
      const baseLines = stripGen(baseline).split('\n')
      const limit = Math.min(liveLines.length, baseLines.length)
      let printed = 0
      for (let i = 0; i < limit && printed < 20; i++) {
        if (liveLines[i] !== baseLines[i]) {
          console.error(`  L${i + 1}:`)
          console.error(`    - ${baseLines[i]}`)
          console.error(`    + ${liveLines[i]}`)
          printed++
        }
      }
      process.exit(1)
    }
    console.log('✓ RLS matrix matches baseline')
    return
  }

  if (isBaseline) {
    writeFileSync(BASELINE_PATH, md)
    console.log(`✓ wrote baseline to ${BASELINE_PATH}`)
    return
  }

  // Default: timestamped snapshot
  const date = new Date().toISOString().slice(0, 10)
  const out = join(REPO_ROOT, `docs/audits/RLS_POLICY_MATRIX_${date}.md`)
  writeFileSync(out, md)
  console.log(`✓ wrote ${out}`)
}

main().catch((e: Error) => {
  console.error('rls-matrix-audit failed:', e.message)
  process.exit(1)
})
