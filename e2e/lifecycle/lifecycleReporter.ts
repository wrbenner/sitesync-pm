/**
 * lifecycleReporter — Playwright reporter that materializes
 * audit/lifecycle-proof/SUMMARY.md from per-step JSON evidence.
 *
 * The spec writes SUMMARY.md itself in its `finally` block — so under normal
 * runs this reporter is redundant. Its job is the failure mode:
 *
 *   1. Spec crashes outside the try/finally (rare but possible: import-time
 *      throws, OOM, sigkill).
 *   2. A future run breaks up the single test() into multiple test()s and
 *      forgets to re-emit SUMMARY.md.
 *
 * Either way, this reporter reads every `audit/lifecycle-proof/step-*.json`
 * file present at the end of the run and renders SUMMARY.md from those.
 *
 * Opt in:
 *   bunx playwright test e2e/lifecycle/90-day-smoke.spec.ts \
 *     --reporter=list,e2e/lifecycle/lifecycleReporter.ts
 *
 * Or programmatically by adding to `reporter` in playwright.config.ts.
 */

import type { Reporter } from '@playwright/test/reporter'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PROOF_DIR = 'audit/lifecycle-proof'

interface StepRecord {
  step: string
  title: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  screenshot?: string
  notes?: string
  data?: unknown
  finishedAt?: string
}

function readSteps(): StepRecord[] {
  let files: string[] = []
  try {
    files = readdirSync(PROOF_DIR).filter((f) => /^step-\d+\.json$/.test(f))
  } catch {
    return []
  }
  const out: StepRecord[] = []
  for (const f of files.sort()) {
    try {
      const raw = readFileSync(join(PROOF_DIR, f), 'utf8')
      out.push(JSON.parse(raw) as StepRecord)
    } catch {
      // Skip unreadable / partial files — better to render an incomplete
      // table than to throw inside a reporter.
    }
  }
  return out
}

function renderSummary(rows: StepRecord[]): string {
  const passCount = rows.filter((r) => r.status === 'PASS').length
  const failCount = rows.filter((r) => r.status === 'FAIL').length
  const skipCount = rows.filter((r) => r.status === 'SKIP').length
  const overall: 'PASS' | 'FAIL' | 'SKIP' =
    failCount > 0 ? 'FAIL' : skipCount === rows.length && rows.length > 0 ? 'SKIP' : 'PASS'

  const lines: string[] = []
  lines.push('# 90-Day Lifecycle Smoke — Proof Report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()} (lifecycleReporter)`)
  lines.push('')
  lines.push(`**Overall: ${overall}**  ·  ${passCount} pass · ${failCount} fail · ${skipCount} skip · ${rows.length} total`)
  lines.push('')
  lines.push('| # | Step | Status | Evidence | Notes |')
  lines.push('|---|------|--------|----------|-------|')
  for (const r of rows) {
    const ev: string[] = []
    if (r.screenshot) ev.push(`![](${r.screenshot})`)
    ev.push(`[json](step-${r.step}.json)`)
    const notes = (r.notes ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
    lines.push(`| ${r.step} | ${r.title} | ${r.status} | ${ev.join(' · ')} | ${notes} |`)
  }
  lines.push('')
  return lines.join('\n')
}

class LifecycleReporter implements Reporter {
  async onEnd(): Promise<void> {
    const rows = readSteps()
    if (rows.length === 0) return
    mkdirSync(PROOF_DIR, { recursive: true })
    writeFileSync(join(PROOF_DIR, 'SUMMARY.md'), renderSummary(rows), 'utf8')
  }
}

export default LifecycleReporter
