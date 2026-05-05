/**
 * export-pilot-data.ts — Day 60 right-to-export workflow.
 *
 * The pilot agreement (template-v1 § "What [GC] gets") promises:
 *   "Full export of all pilot data in CSV at pilot end (or any time
 *    on request). Includes drafted actions, decisions, citations,
 *    audit chain."
 *
 * This script delivers on that promise. Pulls every row tied to the
 * pilot org and emits CSVs to a timestamped directory:
 *
 *   exports/pilot-<gc-slug>-<yyyy-mm-dd-HH-MM>/
 *     drafted_actions.csv
 *     citation_interactions.csv
 *     audit_log.csv
 *     iris_voice_diffs.csv
 *     scheduled_insights_log.csv
 *     audit_incidents.csv
 *     pilot_agreement.csv
 *     README.md  (manifest with row counts + integrity hashes)
 *
 * Reference:
 *   docs/audits/SOFT_PILOT_PLAYBOOK_2026-05-04.md § Phase 5 (right to walk)
 *   docs/audits/pilot-agreement-template-v1.md
 *   docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md
 *   docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md (retention overlap)
 *
 * Usage:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
 *     npx tsx scripts/export-pilot-data.ts \
 *       --org-slug=nexus-companies \
 *       --out-dir=exports/
 *
 * Idempotent: re-running with the same args writes to a new
 * timestamped subdirectory; previous exports are not overwritten.
 *
 * Privacy: this script uses the service-role key, which bypasses RLS.
 * Run only against an org you have explicit consent to export.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(2)
}

const args = new Map<string, string>()
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=')
    args.set(eq < 0 ? a.slice(2) : a.slice(2, eq), eq < 0 ? '' : a.slice(eq + 1))
  }
}

const orgSlug = args.get('org-slug')
const outRoot = args.get('out-dir') ?? 'exports'
if (!orgSlug || !/^[\w-]+$/.test(orgSlug)) {
  console.error('--org-slug=<slug> is required (alphanumerics, dashes, underscores)')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface ExportFile {
  filename: string
  rowCount: number
  sha256: string
}

async function main(): Promise<void> {
  // 1. Resolve the org by slug. Verify is_soft_pilot=TRUE.
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, is_soft_pilot, soft_pilot_started_at')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (orgErr) fatal(`org lookup: ${orgErr.message}`)
  if (!org) fatal(`organization with slug='${orgSlug}' not found`)
  if (!org.is_soft_pilot) {
    console.warn(`[export] WARNING: org ${org.name} has is_soft_pilot=FALSE — exporting anyway`)
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const outDir = join(outRoot, `pilot-${orgSlug}-${ts}`)
  mkdirSync(outDir, { recursive: true })
  console.log(`[export] writing to ${outDir}`)

  // 2. Gather project ids for this org. Drafts/audit/etc. key on project_id.
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name')
    .eq('organization_id', org.id)
  if (projErr) fatal(`projects query: ${projErr.message}`)
  const projectIds = (projects ?? []).map((p) => p.id)
  if (projectIds.length === 0) {
    console.warn(`[export] org has no projects; CSVs will be empty.`)
  }

  const manifest: ExportFile[] = []

  // 3. drafted_actions
  manifest.push(
    await exportTable('drafted_actions', outDir, async () => {
      if (projectIds.length === 0) return []
      const { data, error } = await supabase
        .from('drafted_actions')
        .select('*')
        .in('project_id', projectIds)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
  )

  // 4. citation_interactions — keyed via drafted_action_id ∈ projectIds
  manifest.push(
    await exportTable('citation_interactions', outDir, async () => {
      if (projectIds.length === 0) return []
      // First pull draft ids in scope, then interactions for those drafts.
      const { data: drafts } = await supabase
        .from('drafted_actions')
        .select('id')
        .in('project_id', projectIds)
      const draftIds = (drafts ?? []).map((d) => d.id)
      if (draftIds.length === 0) return []
      const { data, error } = await supabase
        .from('citation_interactions')
        .select('*')
        .in('drafted_action_id', draftIds)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
  )

  // 5. audit_log — every row scoped to a pilot project
  manifest.push(
    await exportTable('audit_log', outDir, async () => {
      if (projectIds.length === 0) return []
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .in('project_id', projectIds)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
  )

  // 6. iris_voice_diffs — joined via drafted_action_id
  manifest.push(
    await exportTable('iris_voice_diffs', outDir, async () => {
      if (projectIds.length === 0) return []
      const { data: drafts } = await supabase
        .from('drafted_actions')
        .select('id')
        .in('project_id', projectIds)
      const draftIds = (drafts ?? []).map((d) => d.id)
      if (draftIds.length === 0) return []
      const { data, error } = await supabase
        .from('iris_voice_diffs')
        .select('*')
        .in('drafted_action_id', draftIds)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
  )

  // 7. scheduled_insights_log
  manifest.push(
    await exportTable('scheduled_insights_log', outDir, async () => {
      if (projectIds.length === 0) return []
      const { data, error } = await supabase
        .from('scheduled_insights_log')
        .select('*')
        .in('project_id', projectIds)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
  )

  // 8. audit_incidents
  manifest.push(
    await exportTable('audit_incidents', outDir, async () => {
      if (projectIds.length === 0) return []
      const { data, error } = await supabase
        .from('audit_incidents')
        .select('*')
        .in('related_project_id', projectIds)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
  )

  // 9. pilot_agreement
  manifest.push(
    await exportTable('pilot_agreement', outDir, async () => {
      const { data, error } = await supabase
        .from('pilot_agreements')
        .select('*')
        .eq('organization_id', org.id)
      if (error) throw new Error(error.message)
      return data ?? []
    }),
  )

  // 10. Manifest README.
  const totalRows = manifest.reduce((s, m) => s + m.rowCount, 0)
  const readme = [
    `# Pilot Data Export — ${org.name}`,
    ``,
    `**Organization:** ${org.name} (slug: \`${orgSlug}\`, id: \`${org.id}\`)`,
    `**Exported at:** ${new Date().toISOString()}`,
    `**Pilot started:** ${org.soft_pilot_started_at ?? '(unknown — flag not set)'}`,
    `**Projects in scope:** ${projectIds.length}`,
    `**Total rows exported:** ${totalRows}`,
    ``,
    `## Files`,
    ``,
    `| Filename | Rows | SHA-256 |`,
    `|---|---|---|`,
    ...manifest.map((m) => `| \`${m.filename}\` | ${m.rowCount} | \`${m.sha256}\` |`),
    ``,
    `## Integrity`,
    ``,
    `Each SHA-256 above is the hash of the file contents at export time.`,
    `The audit_log.csv preserves the hash chain — verify chain integrity by`,
    `running \`verify_audit_chain(NULL)\` against a fresh import of the rows.`,
    ``,
    `## Provenance`,
    ``,
    `Generated by \`scripts/export-pilot-data.ts\`. Per the pilot agreement`,
    `(template v1, "What stays inside [GC]'s environment forever") this`,
    `export is the canonical record of what SiteSync held about this org`,
    `during the pilot. After delivery, retention behavior continues per`,
    `\`docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md\` (24 months for`,
    `pilot accounts, then anonymized).`,
    ``,
  ].join('\n')
  writeFileSync(join(outDir, 'README.md'), readme, 'utf8')

  console.log(`\n[export] DONE.`)
  console.log(`  ${manifest.length} CSVs + 1 README in ${outDir}`)
  console.log(`  ${totalRows} total rows`)
  console.log(`\n  Hand the directory to <<GC>> via secure link per playbook § Phase 5.`)
}

async function exportTable(
  tableName: string,
  outDir: string,
  fetch: () => Promise<Array<Record<string, unknown>>>,
): Promise<ExportFile> {
  let rows: Array<Record<string, unknown>> = []
  try {
    rows = await fetch()
  } catch (err) {
    console.error(`[export] ${tableName} failed:`, err instanceof Error ? err.message : err)
    rows = []
  }
  const csv = toCsv(rows)
  const filename = `${tableName}.csv`
  const filePath = join(outDir, filename)
  writeFileSync(filePath, csv, 'utf8')
  const sha256 = createHash('sha256').update(csv).digest('hex')
  console.log(`  ${filename.padEnd(32)} ${String(rows.length).padStart(6)} rows  ${sha256.slice(0, 12)}…`)
  return { filename, rowCount: rows.length, sha256 }
}

/**
 * Minimal RFC-4180 CSV serializer. Quotes fields that contain commas,
 * quotes, or newlines; doubles internal quotes. Adequate for tabular
 * Postgres rows; not adequate for arbitrary nested JSON payloads —
 * those are JSON-stringified before quoting.
 */
function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.map(csvField).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvField(row[h])).join(','))
  }
  return lines.join('\n') + '\n'
}

function csvField(v: unknown): string {
  if (v === null || v === undefined) return ''
  const str = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function fatal(msg: string): never {
  console.error(`export-pilot-data: ${msg}`)
  process.exit(2)
}

main().catch((err) => {
  console.error('export-pilot-data failed:', err.message ?? err)
  process.exit(2)
})
