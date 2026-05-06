/**
 * audit-cron.ts
 *
 * Surfaces:
 *   • whether pg_cron + pg_net extensions are installed
 *   • currently scheduled jobs from cron.job
 *   • recent failures from cron.job_run_details (last 24h)
 *   • cron-shaped migrations in the repo for cross-reference
 *
 * Outputs audit/cron-status.md + non-zero exit when there are
 * unresolved issues (extensions missing, recent failures).
 */

import { readdir, writeFile } from 'node:fs/promises'

const DB_URL = process.env.DATABASE_URL ?? ''
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(2) }

interface CronJob {
  jobid: number
  jobname: string | null
  schedule: string
  command: string
  active: boolean
}

async function main() {
  // @ts-expect-error optional dep — installed in CI
  const { default: postgres } = await import('postgres')
  const sql = postgres(DB_URL, { max: 1 })
  try {
    const exts = await sql`
      SELECT extname FROM pg_extension
       WHERE extname IN ('pg_cron','pg_net','pg_stat_statements')
    ` as Array<{ extname: string }>
    const has = (n: string) => exts.some(e => e.extname === n)

    let jobs: CronJob[] = []
    let failures: Array<{ runid: number; jobid: number; status: string; return_message: string; end_time: string }> = []
    if (has('pg_cron')) {
      jobs = await sql`SELECT jobid, jobname, schedule, command, active FROM cron.job` as CronJob[]
      failures = await sql`
        SELECT runid, jobid, status, return_message, end_time
          FROM cron.job_run_details
         WHERE end_time > now() - interval '24 hours'
           AND status != 'succeeded'
         ORDER BY end_time DESC
      ` as typeof failures
    }

    const cronMigrations = (await readdir('supabase/migrations'))
      .filter(f => /cron/i.test(f))

    const lines: string[] = []
    lines.push('# Cron Job Status', '', `> Generated ${new Date().toISOString()}`, '')

    lines.push('## Extensions', '')
    lines.push('| Extension | Installed |', '| --- | --- |')
    lines.push(`| pg_cron | ${has('pg_cron') ? '✓' : '**NOT INSTALLED**'} |`)
    lines.push(`| pg_net | ${has('pg_net') ? '✓' : '**NOT INSTALLED**'} |`)
    lines.push(`| pg_stat_statements | ${has('pg_stat_statements') ? '✓' : '_missing_'} |`, '')

    if (!has('pg_cron') || !has('pg_net')) {
      lines.push('### CRITICAL', '')
      lines.push('Without pg_cron and pg_net, every nightly job in the codebase is silent. Enable on Pro+ tier:', '')
      lines.push('```sql', 'CREATE EXTENSION IF NOT EXISTS pg_cron;', 'CREATE EXTENSION IF NOT EXISTS pg_net;', '```', '')
    }

    lines.push('## Currently scheduled jobs', '')
    if (jobs.length === 0) {
      lines.push('_None_', '')
    } else {
      lines.push('| jobid | name | schedule | active |', '| --- | --- | --- | --- |')
      for (const j of jobs) {
        lines.push(`| ${j.jobid} | ${j.jobname ?? '—'} | \`${j.schedule}\` | ${j.active ? '✓' : '✗'} |`)
      }
      lines.push('')
    }

    lines.push('## Failures in the last 24 hours', '')
    if (failures.length === 0) {
      lines.push('_None_', '')
    } else {
      lines.push(`${failures.length} failed run${failures.length === 1 ? '' : 's'}:`, '')
      for (const f of failures) {
        lines.push(`- jobid ${f.jobid} @ ${f.end_time}: ${f.status} — \`${(f.return_message ?? '').slice(0, 80)}\``)
      }
      lines.push('')
    }

    lines.push('## Cron-shaped migrations in repo', '')
    if (cronMigrations.length === 0) {
      lines.push('_(no `*cron*.sql` files yet — schedules live in code comments + edge function docstrings)_', '')
    } else {
      for (const f of cronMigrations) lines.push(`- \`${f}\``)
      lines.push('')
    }

    await writeFile('audit/cron-status.md', lines.join('\n'))
    console.log(`Wrote audit/cron-status.md (${jobs.length} jobs, ${failures.length} recent failures)`)
    if (!has('pg_cron') || !has('pg_net') || failures.length > 0) process.exit(1)
  } finally {
    await sql.end()
  }
}

main().catch(err => { console.error(err); process.exit(2) })
