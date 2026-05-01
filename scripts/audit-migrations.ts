/**
 * audit-migrations.ts
 *
 * Cross-references migration files in `supabase/migrations/*.sql` against
 * what's been applied on the cloud project. Outputs a markdown report
 * + non-zero exit when drift is detected.
 *
 * Usage:
 *   DATABASE_URL=postgres://... bun scripts/audit-migrations.ts
 *
 * Note: queries `supabase_migrations.schema_migrations` directly, which
 * requires service-role-equivalent grants. CI provides this.
 */

import { readdir, writeFile } from 'node:fs/promises'

const DB_URL = process.env.DATABASE_URL ?? ''
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(2) }

async function listApplied(): Promise<string[]> {
  // @ts-expect-error optional dep — installed in CI
  const { default: postgres } = await import('postgres')
  const sql = postgres(DB_URL, { max: 1 })
  try {
    const rows = await sql`
      SELECT version FROM supabase_migrations.schema_migrations ORDER BY version
    ` as Array<{ version: string }>
    return rows.map(r => r.version).sort()
  } finally {
    await sql.end()
  }
}

async function listRepo(): Promise<{ version: string; filename: string }[]> {
  const files = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql'))
  return files.map(filename => {
    const m = filename.match(/^(\d+)_/)
    return { version: m?.[1] ?? filename.replace(/\.sql$/, ''), filename }
  }).sort((a, b) => a.version.localeCompare(b.version))
}

async function main() {
  const [applied, repo] = await Promise.all([listApplied(), listRepo()])
  const appliedSet = new Set(applied)
  const repoVersions = new Set(repo.map(r => r.version))

  const missing = repo.filter(r => !appliedSet.has(r.version))
  const manualSql = [...appliedSet].filter(v => !repoVersions.has(v))

  // Out-of-order: a missing migration whose version is < latest applied
  const latestApplied = applied[applied.length - 1] ?? '00000'
  const outOfOrder = missing.filter(r => r.version < latestApplied)

  const lines: string[] = []
  lines.push('# Migration Status', '')
  lines.push(`> Generated ${new Date().toISOString()}.`, '')
  lines.push('| Metric | Count |', '| --- | --- |')
  lines.push(`| Applied (cloud) | ${applied.length} |`)
  lines.push(`| In repo | ${repo.length} |`)
  lines.push(`| Missing (in repo, not applied) | **${missing.length}** |`)
  lines.push(`| Manual SQL (applied, not in repo) | ${manualSql.length} |`)
  lines.push(`| Out-of-order timestamps | ${outOfOrder.length} |`, '')

  if (missing.length > 0) {
    lines.push('## Missing — needs apply', '')
    for (const m of missing) lines.push(`- \`${m.filename}\``)
    lines.push('', '```bash', `supabase db push --project-ref \${SUPABASE_PROJECT_REF}`, '```', '')
  }

  if (manualSql.length > 0) {
    lines.push('## Manual SQL — applied without a migration file', '')
    for (const v of manualSql) lines.push(`- ${v}`)
    lines.push('', 'Investigate before reconciling. A manual SQL change without a tracked migration is a drift hazard.', '')
  }

  if (outOfOrder.length > 0) {
    lines.push('## Out-of-order timestamps', '')
    lines.push(`Latest applied: \`${latestApplied}\`. The following are in-repo with versions ≤ that mark, which usually indicates a back-dated migration that needs to be either re-timestamped or applied with explicit override:`, '')
    for (const m of outOfOrder) lines.push(`- \`${m.filename}\``)
    lines.push('')
  }

  await writeFile('audit/migration-status.md', lines.join('\n'))
  console.log(`Wrote audit/migration-status.md (${missing.length} missing, ${manualSql.length} manual, ${outOfOrder.length} out-of-order)`)
  if (missing.length > 0 || manualSql.length > 0 || outOfOrder.length > 0) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(2) })
