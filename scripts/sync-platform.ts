/**
 * sync-platform.ts
 *
 * Single command that:
 *   1. Computes the diff (calls audit-edge-functions + audit-migrations)
 *   2. Prints a planned-actions summary
 *   3. Asks for explicit confirmation (y/N)
 *   4. Deploys missing edge functions
 *   5. Applies missing migrations
 *   6. Reports a diff of what changed
 *
 * Refuses to act without an explicit `--apply` AND a TTY confirmation
 * prompt (or `--yes` to bypass the prompt in non-interactive runs).
 *
 * Usage:
 *   bun scripts/sync-platform.ts                       # dry-run only
 *   bun scripts/sync-platform.ts --apply               # interactive
 *   bun scripts/sync-platform.ts --apply --yes         # CI-friendly
 *   bun scripts/sync-platform.ts --apply --no-edge     # migrations only
 *   bun scripts/sync-platform.ts --apply --no-migrate  # functions only
 *
 * Environment:
 *   SUPABASE_PROJECT_REF  required
 *   SUPABASE_ACCESS_TOKEN required for function deploy
 *   DATABASE_URL          required for migration apply
 */

import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? ''
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? ''
const DB_URL = process.env.DATABASE_URL ?? ''

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const YES = args.has('--yes')
const SKIP_EDGE = args.has('--no-edge')
const SKIP_MIGRATE = args.has('--no-migrate')

function fail(msg: string): never { console.error(msg); process.exit(2) }

if (!PROJECT_REF) fail('SUPABASE_PROJECT_REF not set')

async function listMissingFunctions(): Promise<string[]> {
  if (!ACCESS_TOKEN) {
    console.warn('SUPABASE_ACCESS_TOKEN not set — skipping edge-function diff')
    return []
  }
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`
  const r = await fetch(url, { headers: { authorization: `Bearer ${ACCESS_TOKEN}` } })
  if (!r.ok) { console.error(`Supabase API ${r.status}`); return [] }
  const deployed = (await r.json() as Array<{ slug: string }>).map(d => d.slug)
  const repoEntries = await readdir('supabase/functions', { withFileTypes: true })
  const repo = repoEntries.filter(e => e.isDirectory() && e.name !== 'shared' && !e.name.startsWith('_')).map(e => e.name)
  return repo.filter(r => !deployed.includes(r)).sort()
}

async function listMissingMigrations(): Promise<{ filename: string; version: string }[]> {
  if (!DB_URL) {
    console.warn('DATABASE_URL not set — skipping migration diff')
    return []
  }
  // @ts-expect-error optional dep
  const { default: postgres } = await import('postgres')
  const sql = postgres(DB_URL, { max: 1 })
  try {
    const rows = await sql`SELECT version FROM supabase_migrations.schema_migrations` as Array<{ version: string }>
    const applied = new Set(rows.map(r => r.version))
    const files = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
    return files
      .map(filename => ({ filename, version: filename.match(/^(\d+)_/)?.[1] ?? '' }))
      .filter(m => m.version && !applied.has(m.version))
  } finally {
    await sql.end()
  }
}

async function confirm(label: string): Promise<boolean> {
  if (YES) return true
  if (!stdin.isTTY) {
    console.error(`Non-interactive run requires --yes (refusing ${label}).`)
    return false
  }
  const rl = createInterface({ input: stdin, output: stdout })
  const ans = (await rl.question(`${label}  Type "yes" to proceed: `)).trim().toLowerCase()
  rl.close()
  return ans === 'yes'
}

function deployFunction(slug: string): boolean {
  console.log(`  deploy ${slug}...`)
  const r = spawnSync('supabase', ['functions', 'deploy', slug, '--project-ref', PROJECT_REF], { stdio: 'inherit' })
  return r.status === 0
}

function applyMigrations(): boolean {
  console.log('  supabase db push --include-all')
  const r = spawnSync('supabase', ['db', 'push', '--include-all', '--project-ref', PROJECT_REF], { stdio: 'inherit' })
  return r.status === 0
}

async function main() {
  const [missingFns, missingMigs] = await Promise.all([
    SKIP_EDGE ? Promise.resolve([]) : listMissingFunctions(),
    SKIP_MIGRATE ? Promise.resolve([]) : listMissingMigrations(),
  ])

  console.log('=== sync-platform — planned actions ===')
  console.log(`Project: ${PROJECT_REF}`)
  console.log(`Mode:    ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  console.log()
  console.log(`Edge functions to deploy: ${missingFns.length}`)
  for (const f of missingFns) console.log(`  + ${f}`)
  console.log()
  console.log(`Migrations to apply: ${missingMigs.length}`)
  for (const m of missingMigs) console.log(`  + ${m.filename}`)
  console.log()

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to execute.')
    return
  }
  if (missingFns.length === 0 && missingMigs.length === 0) {
    console.log('Nothing to do. Platform is in sync.')
    return
  }

  const ok = await confirm(`Proceed with ${missingFns.length} deploy(s) and ${missingMigs.length} migration apply?`)
  if (!ok) { console.log('Aborted.'); process.exit(1) }

  // Apply migrations FIRST — many functions depend on the new schema.
  if (missingMigs.length > 0) {
    if (!applyMigrations()) fail('Migration apply failed — aborting before deploy')
  }

  let failed = 0
  for (const f of missingFns) {
    if (!deployFunction(f)) failed += 1
  }
  console.log()
  console.log(`Done. ${missingFns.length - failed}/${missingFns.length} deploys succeeded; ${missingMigs.length} migrations applied.`)
  if (failed > 0) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(2) })
