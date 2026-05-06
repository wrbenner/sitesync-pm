#!/usr/bin/env tsx
/**
 * check-db-types.ts — Bugatti gate against schema/type drift.
 *
 * Compares src/types/database.ts against a fresh `supabase gen types` output.
 * If they differ, exits non-zero with a diff so CI fails the PR. The writer
 * mode (`--write`) regenerates the file so a developer can quickly land the
 * sync commit.
 *
 * Why this gate exists: prior to 2026-05-03, the live schema had 310 tables
 * but the typed file described 188. Every migration that added a table left
 * the codebase blind to it — `supabase.from('new_table')` returned an opaque
 * union, hiding bugs. This script makes "I forgot to regenerate types" a
 * compile-time failure instead of a silent drift.
 *
 * Usage:
 *   npm run db-types:check        # fails if local file differs from live
 *   npm run db-types:write        # regenerate the file (still preserves
 *                                  the hand-curated exports below the
 *                                  generated section)
 *
 * Implementation: shells out via execFileSync (NO shell, NO interpolation
 * of env into a command string) to `npx supabase gen types typescript
 * --project-id <id>`. Requires SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID
 * env vars (set in GitHub Actions secrets; locally source from .env.local).
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..')
const DB_TYPES_PATH = join(REPO_ROOT, 'src/types/database.ts')

// Marker that delimits the auto-generated section from hand-curated exports.
// Everything after this line is preserved verbatim during regeneration.
const CUSTOM_SECTION_MARKER = '// ── Custom exports (preserved across schema regeneration) ───────────────────'

function readCustomSection(): string {
  if (!existsSync(DB_TYPES_PATH)) {
    throw new Error(`database.ts not found at ${DB_TYPES_PATH}`)
  }
  const content = readFileSync(DB_TYPES_PATH, 'utf-8')
  const idx = content.indexOf(CUSTOM_SECTION_MARKER)
  if (idx === -1) {
    throw new Error(
      `database.ts is missing the "${CUSTOM_SECTION_MARKER.slice(0, 40)}..." marker. ` +
      'Refusing to regenerate without it — would lose hand-curated type aliases.',
    )
  }
  return content.slice(idx)
}

function generateFreshTypes(): string {
  const projectId = process.env.SUPABASE_PROJECT_ID
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  if (!projectId || !accessToken) {
    throw new Error(
      'SUPABASE_PROJECT_ID and SUPABASE_ACCESS_TOKEN must be set. ' +
      'In CI: GitHub Actions secrets. Locally: source from .env.local.',
    )
  }
  // execFileSync — args go as an array, NO shell interpolation, no injection.
  return execFileSync(
    'npx',
    ['supabase', 'gen', 'types', 'typescript', '--project-id', projectId],
    {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    },
  )
}

function main(): void {
  const isWrite = process.argv.includes('--write')

  let fresh: string
  try {
    fresh = generateFreshTypes()
  } catch (err) {
    console.error('[db-types:check] Failed to generate fresh types:', err instanceof Error ? err.message : String(err))
    process.exit(2)
  }

  const customSection = readCustomSection()
  const composed = fresh.trimEnd() + '\n\n' + customSection

  if (isWrite) {
    writeFileSync(DB_TYPES_PATH, composed, 'utf-8')
    console.log('[db-types:write] Regenerated src/types/database.ts. Commit the change.')
    return
  }

  const local = readFileSync(DB_TYPES_PATH, 'utf-8')
  if (local === composed) {
    console.log('[db-types:check] OK — database.ts matches live schema.')
    return
  }

  console.error('[db-types:check] FAIL — database.ts is out of sync with live Supabase schema.')
  console.error('Run `npm run db-types:write` to regenerate, then commit.')
  console.error('')
  console.error('Hint: this typically means a migration was applied without regenerating types.')
  process.exit(1)
}

main()
