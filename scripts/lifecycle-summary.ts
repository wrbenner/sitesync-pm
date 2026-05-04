/**
 * lifecycle-summary — standalone CLI variant of lifecycleReporter.
 *
 * Use when:
 *   • Playwright was killed (sigkill, runaway loop) before its reporter ran.
 *   • You want to re-render SUMMARY.md after manually editing a step JSON.
 *   • CI uploads need a deterministic last-mile summary step that doesn't
 *     depend on Playwright internals.
 *
 * Run: npx tsx scripts/lifecycle-summary.ts
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PROOF_DIR = 'audit/lifecycle-proof'

interface StepRecord {
  step: string
  title: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  screenshot?: string
  notes?: string
}

function readSteps(): StepRecord[] {
  let files: string[] = []
  try {
    files = readdirSync(PROOF_DIR).filter((f) => /^step-\d+\.json$/.test(f))
  } catch {
    return []
  }
  return files
    .sort()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(PROOF_DIR, f), 'utf8')) as StepRecord
      } catch {
        return null
      }
    })
    .filter((x): x is StepRecord => x !== null)
}

function render(rows: StepRecord[]): string {
  const pass = rows.filter((r) => r.status === 'PASS').length
  const fail = rows.filter((r) => r.status === 'FAIL').length
  const skip = rows.filter((r) => r.status === 'SKIP').length
  const overall = fail > 0 ? 'FAIL' : skip === rows.length && rows.length > 0 ? 'SKIP' : 'PASS'

  const out: string[] = []
  out.push('# 90-Day Lifecycle Smoke — Proof Report')
  out.push('')
  out.push(`Generated: ${new Date().toISOString()} (scripts/lifecycle-summary.ts)`)
  out.push('')
  out.push(`**Overall: ${overall}**  ·  ${pass} pass · ${fail} fail · ${skip} skip · ${rows.length} total`)
  out.push('')
  out.push('| # | Step | Status | Evidence | Notes |')
  out.push('|---|------|--------|----------|-------|')
  for (const r of rows) {
    const ev: string[] = []
    if (r.screenshot) ev.push(`![](${r.screenshot})`)
    ev.push(`[json](step-${r.step}.json)`)
    const notes = (r.notes ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
    out.push(`| ${r.step} | ${r.title} | ${r.status} | ${ev.join(' · ')} | ${notes} |`)
  }
  out.push('')
  return out.join('\n')
}

const rows = readSteps()
if (rows.length === 0) {
  console.error('✖ no step-*.json files found in', PROOF_DIR)
  process.exit(1)
}
mkdirSync(PROOF_DIR, { recursive: true })
writeFileSync(join(PROOF_DIR, 'SUMMARY.md'), render(rows), 'utf8')
console.log(`✓ wrote ${PROOF_DIR}/SUMMARY.md from ${rows.length} step records`)
