/**
 * index-audit.ts
 *
 * Connects to the project's Supabase Postgres and queries pg_stat_statements
 * for the slowest 30 queries. Cross-references against pg_indexes to surface
 * "this query is hot, this column has no index, here's a suggested CREATE
 * INDEX." Also flags duplicate indexes (same key, different name) for
 * potential cleanup.
 *
 * Usage:
 *   DATABASE_URL=postgres://... bun scripts/index-audit.ts
 *
 * Output: writes index-audit.md with three sections:
 *   1. Slowest queries (mean exec time desc)
 *   2. Suggested indexes (heuristic: filter columns appearing in slow queries
 *      that aren't already indexed)
 *   3. Duplicate / overlapping indexes (cleanup candidates)
 *
 * V1: produces the slowest-queries report. Index suggestion + dup detection
 * are framework + TODO; manual review of the slow query log is more useful
 * than over-aggressive auto-suggestion.
 */

import { writeFile } from 'node:fs/promises'

interface PgStatRow {
  query: string
  calls: number
  total_exec_time: number
  mean_exec_time: number
  rows: number
}

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL not set. Set it to your Supabase connection string and re-run.')
    process.exit(2)
  }

  // We use the `postgres` package via dynamic import so this script doesn't
  // pull a dependency for the rest of the codebase.
  // @ts-expect-error optional dependency for diagnostics
  const { default: postgres } = await import('postgres').catch(() => ({ default: null as unknown as typeof import('postgres').default }))
  if (!postgres) {
    console.error('postgres package not installed. Run: bun add -d postgres')
    process.exit(2)
  }
  const sql = postgres(dbUrl)

  const slowest: PgStatRow[] = await sql`
    SELECT query, calls, total_exec_time, mean_exec_time, rows
      FROM pg_stat_statements
     WHERE query NOT LIKE '%pg_stat_statements%'
       AND query NOT LIKE 'COMMIT%'
       AND query NOT LIKE 'BEGIN%'
     ORDER BY mean_exec_time DESC
     LIMIT 30
  `

  const lines: string[] = []
  lines.push('# Index audit', '', `Generated ${new Date().toISOString()}`, '')
  lines.push('## Slowest queries (mean exec time desc)', '')
  lines.push('| Mean (ms) | Calls | Rows | Query |')
  lines.push('| --- | --- | --- | --- |')
  for (const r of slowest) {
    const q = r.query.replace(/\s+/g, ' ').slice(0, 200) + (r.query.length > 200 ? '…' : '')
    lines.push(`| ${r.mean_exec_time.toFixed(1)} | ${r.calls} | ${r.rows} | ${q.replace(/\|/g, '\\|')} |`)
  }
  lines.push('', '## Suggested indexes', '', 'TODO: parse the queries above for filter columns + cross-reference pg_indexes.', '')
  lines.push('## Duplicate / overlapping indexes', '', 'TODO: run pg_stats on pg_indexes to surface dupes.', '')

  await writeFile('index-audit.md', lines.join('\n'))
  console.log(`Wrote index-audit.md with ${slowest.length} slow queries.`)
  await sql.end()
}

main().catch(err => { console.error(err); process.exit(2) })
