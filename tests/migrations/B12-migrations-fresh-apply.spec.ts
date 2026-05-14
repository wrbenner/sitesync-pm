/**
 * Phase B.12 — Migration apply contract.
 *
 * Asserts:
 *   1. Every migration file under supabase/migrations/ has a 14-digit
 *      timestamp prefix + a snake_case description (Supabase convention)
 *   2. No two migrations share the same 14-digit version (deterministic
 *      apply order)
 *   3. Every migration is SQL-parseable at the line level (no truncation /
 *      mid-statement EOF)
 *
 * The actual "apply to a fresh DB" check is run by Gate 18 in CI via
 * docker supabase. This baseline is the fast local pre-check.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const MIG_DIR = resolve(__dirname, '../../supabase/migrations')

describe('B.12 — Migration apply baseline', () => {
  const files = readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  it('every file has a valid numeric prefix + snake_case name', () => {
    // Legacy migrations use a 5-digit prefix (00001_..._.sql); the
    // Supabase-CLI convention since the project switched is 14-digit
    // timestamps. Both are valid prefixes.
    const bad = files.filter((f) => !/^\d{5,14}_[a-z0-9_]+\.sql$/.test(f))
    expect(bad, `bad filenames:\n${bad.map((b) => '  ' + b).join('\n')}`).toHaveLength(0)
  })

  it('no two migrations share the same version prefix', () => {
    const versions = files.map((f) => f.split('_')[0])
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const v of versions) {
      if (seen.has(v)) dupes.push(v)
      seen.add(v)
    }
    expect(dupes, `duplicate versions:\n${dupes.join('\n')}`).toHaveLength(0)
  })

  it('every migration ends with a complete statement (no mid-stmt truncation)', () => {
    const truncated: Array<{ file: string; tail: string }> = []
    for (const f of files) {
      const path = resolve(MIG_DIR, f)
      const content = readFileSync(path, 'utf-8').trim()
      // Walk back from the end, skipping comment-only and blank lines.
      // The first non-comment line we hit must end with a statement
      // terminator (`;`, end of dollar-quoted body, etc.). Documentation
      // banners after the last statement are not truncation.
      const lines = content.split('\n').map((l) => l.trimEnd())
      let lastCode = ''
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim()
        if (line === '' || line.startsWith('--')) continue
        lastCode = line
        break
      }
      const endsClean =
        /[;}]$|END\s*$|\$\$\s*;?\s*$|\$function\$\s*;?\s*$|\$fn\$\s*;?\s*$/i.test(
          lastCode,
        ) || lastCode === ''
      if (!endsClean) {
        truncated.push({ file: f, tail: lastCode.slice(-80) })
      }
    }
    expect(
      truncated,
      `migrations with suspicious endings:\n${truncated.map((t) => `  ${t.file}: ${t.tail}`).join('\n')}`,
    ).toHaveLength(0)
  })

  it('every migration file is non-empty', () => {
    const empty = files.filter((f) => readFileSync(resolve(MIG_DIR, f), 'utf-8').trim().length === 0)
    expect(empty, `empty migration files:\n${empty.join('\n')}`).toHaveLength(0)
  })
})
