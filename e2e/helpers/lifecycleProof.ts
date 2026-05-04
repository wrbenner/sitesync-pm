/**
 * lifecycleProof — evidence collector for the 90-day-smoke spec.
 *
 * Each step in the spec calls `record({ step, status, ... })`. The helper
 * writes per-step JSON to audit/lifecycle-proof/step-NN.json, accepts an
 * optional screenshot path it should already have written, and at the end
 * of the run renders SUMMARY.md from the accumulated rows.
 *
 * Why a helper and not inline:
 *   • The spec's try/finally must always emit SUMMARY.md, even when a
 *     step throws. Centralizing the writer keeps that contract simple.
 *   • Failure messages in JSON files become the diagnostic surface — when
 *     the spec goes red, you grep audit/lifecycle-proof/*.json instead of
 *     re-running with --headed.
 *   • The reporter (Deliverable 3) consumes the same JSON contract, so
 *     a CI run can post results without re-implementing parsing.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type StepStatus = 'PASS' | 'FAIL' | 'SKIP'

export interface StepRecord {
  /** Two-digit step id, e.g. "01". */
  step: string
  /** Human title for the SUMMARY row. */
  title: string
  status: StepStatus
  /** Screenshot file name (relative to audit/lifecycle-proof), if any. */
  screenshot?: string
  /** Free-form notes — failure reasons, deferred-feature flags, counts. */
  notes?: string
  /** Optional structured metrics — written verbatim into the JSON. */
  data?: Record<string, unknown>
  /** ISO timestamp the step finished. */
  finishedAt?: string
}

const PROOF_DIR = 'audit/lifecycle-proof'

function ensureDir(): void {
  mkdirSync(PROOF_DIR, { recursive: true })
}

const records: StepRecord[] = []

/** Append a record + flush its per-step JSON to disk. */
export function record(rec: StepRecord): StepRecord {
  ensureDir()
  const filled: StepRecord = { ...rec, finishedAt: new Date().toISOString() }
  records.push(filled)
  writeFileSync(
    join(PROOF_DIR, `step-${rec.step}.json`),
    JSON.stringify(filled, null, 2),
    'utf8',
  )
  return filled
}

/** Reset between runs (reporter doesn't need this, but unit tests might). */
export function _reset(): void {
  records.length = 0
}

/** Read accumulated records (for the reporter or for in-test assertions). */
export function getRecords(): ReadonlyArray<StepRecord> {
  return records
}

/** Render SUMMARY.md from current records. Always safe to call. */
export function writeSummary(): string {
  ensureDir()
  const rows = records.length
    ? records.slice().sort((a, b) => a.step.localeCompare(b.step))
    : []

  const passCount = rows.filter((r) => r.status === 'PASS').length
  const failCount = rows.filter((r) => r.status === 'FAIL').length
  const skipCount = rows.filter((r) => r.status === 'SKIP').length

  const overall: StepStatus =
    failCount > 0 ? 'FAIL' : skipCount === rows.length && rows.length > 0 ? 'SKIP' : 'PASS'

  const lines: string[] = []
  lines.push('# 90-Day Lifecycle Smoke — Proof Report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push(`**Overall: ${overall}**  ·  ${passCount} pass · ${failCount} fail · ${skipCount} skip · ${rows.length} total`)
  lines.push('')
  lines.push('| # | Step | Status | Evidence | Notes |')
  lines.push('|---|------|--------|----------|-------|')
  for (const r of rows) {
    const evidence: string[] = []
    if (r.screenshot) evidence.push(`![](${r.screenshot})`)
    evidence.push(`[json](step-${r.step}.json)`)
    const notes = (r.notes ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
    lines.push(`| ${r.step} | ${r.title} | ${r.status} | ${evidence.join(' · ')} | ${notes} |`)
  }
  lines.push('')
  lines.push('## How to read this')
  lines.push('')
  lines.push('- **PASS** — DB invariants held + UI rendered without throwing.')
  lines.push('- **FAIL** — a load-bearing seam broke. Read the linked JSON for the assertion that failed.')
  lines.push('- **SKIP** — feature is documented as deferred or its dependency was unavailable. The note explains which.')
  lines.push('')
  lines.push('Per-step JSON files in this directory carry the raw measurements.')
  lines.push('Screenshots are visual evidence — a green run is one where the screenshots show real data, not empty states.')
  lines.push('')

  const out = lines.join('\n')
  writeFileSync(join(PROOF_DIR, 'SUMMARY.md'), out, 'utf8')
  return out
}

/** Compute a relative path inside PROOF_DIR for a screenshot file. */
export function screenshotPath(step: string): string {
  ensureDir()
  return join(PROOF_DIR, `step-${step}.png`)
}
