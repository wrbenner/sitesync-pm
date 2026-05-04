/**
 * audit-edge-functions.ts
 *
 * Cross-references repo edge function directories against deployed
 * functions on the Supabase project. Outputs a markdown report.
 *
 * Usage:
 *   SUPABASE_PROJECT_REF=hypxrm... SUPABASE_ACCESS_TOKEN=sbp_... \
 *     bun scripts/audit-edge-functions.ts > audit/edge-function-status.md
 *
 * Exits non-zero when there are unresolved drifts (missing or zombie
 * functions) so CI can fail loudly.
 */

import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? ''
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? ''

if (!PROJECT_REF || !ACCESS_TOKEN) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN env vars.')
  process.exit(2)
}

interface DeployedFn { slug: string; version: number; updated_at: number; ezbr_sha256: string }

async function listDeployed(): Promise<DeployedFn[]> {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`
  const r = await fetch(url, { headers: { authorization: `Bearer ${ACCESS_TOKEN}` } })
  if (!r.ok) {
    console.error(`Supabase API ${r.status}: ${await r.text()}`)
    process.exit(2)
  }
  return await r.json() as DeployedFn[]
}

async function listRepo(): Promise<string[]> {
  const dir = 'supabase/functions'
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter(e => e.isDirectory() && e.name !== 'shared' && !e.name.startsWith('_'))
    .map(e => e.name)
    .sort()
}

async function main() {
  const [deployed, repo] = await Promise.all([listDeployed(), listRepo()])
  const deployedSet = new Set(deployed.map(d => d.slug))
  const repoSet = new Set(repo)

  const missing = repo.filter(r => !deployedSet.has(r))
  const zombie  = [...deployedSet].filter(d => !repoSet.has(d))

  const lines: string[] = []
  lines.push('# Edge Function Status', '')
  lines.push(`> Generated ${new Date().toISOString()} against \`${PROJECT_REF}\`.`, '')
  lines.push('| Metric | Count |', '| --- | --- |')
  lines.push(`| Deployed (cloud) | ${deployed.length} |`)
  lines.push(`| In repo | ${repo.length} |`)
  lines.push(`| Missing (in repo, not deployed) | **${missing.length}** |`)
  lines.push(`| Zombie (deployed, not in repo) | ${zombie.length} |`, '')

  if (missing.length > 0) {
    lines.push('## Missing — needs deploy', '')
    for (const m of missing) lines.push(`- ${m}`)
    lines.push('', '```bash')
    lines.push('# Deploy all missing in batch:')
    for (const m of missing) lines.push(`supabase functions deploy ${m} --project-ref ${PROJECT_REF}`)
    lines.push('```', '')
  }

  if (zombie.length > 0) {
    lines.push('## Zombie — deployed but not in repo', '')
    for (const z of zombie) lines.push(`- ${z}`)
    lines.push('', 'Investigate before deleting — a zombie usually indicates a function whose source was removed without `supabase functions delete`.', '')
  }

  await writeFile('audit/edge-function-status.md', lines.join('\n'))
  console.log(`Wrote audit/edge-function-status.md (${missing.length} missing, ${zombie.length} zombie)`)
  if (missing.length > 0 || zombie.length > 0) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(2) })
