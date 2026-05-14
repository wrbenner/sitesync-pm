#!/usr/bin/env tsx
/**
 * parse-gate-failures.ts — categorize CI gate failures for the self-heal loop.
 *
 * Reads `gh run view <id> --log` output, extracts the test name + first
 * meaningful error line per failure, and emits a JSON document the loop's
 * dispatcher can act on.
 *
 * Categories (matching the playbook in .agent/loop-prompt.md):
 *   - selector-aligner — Playwright locator timeout, getByLabel/getByRole misses
 *   - platform-bug    — Postgres error codes (42703, 23503, etc.), RPC HTTP 5xx
 *   - infra-bug       — gh runner OOM, browser install fail, secret missing
 *   - test-spec       — ESM __dirname errors, vitest config issues, syntax errors
 *   - unfixable       — same failure repeated 5+ times across iterations
 *
 * Usage:
 *   npx tsx scripts/loop/parse-gate-failures.ts <run-id> [<run-id>...]
 *   echo $log_text | npx tsx scripts/loop/parse-gate-failures.ts --stdin
 *
 * Uses execFileSync (no shell) and validates runId is purely numeric to
 * avoid command-injection.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

type FailureClass =
  | 'selector-aligner'
  | 'platform-bug'
  | 'infra-bug'
  | 'test-spec'
  | 'unfixable'

interface Failure {
  workflow: string
  job: string
  test: string | null
  errorLine: string
  category: FailureClass
  retryCount: number
}

const SELECTOR_PATTERNS = [
  /locator\.\w+.*Test timeout/i,
  /waiting for getBy(Label|Role|TestId|Placeholder|Text)/i,
  /strict mode violation/i,
  /Element is not visible/i,
  /No element matches selector/i,
]

const PLATFORM_PATTERNS = [
  /\b(42703|23503|23505|42P01|42P02|42883|22001|22023|23502|42501)\b/, // pg sqlstate
  /HTTP\s+50[0-9]/i,
  /Internal Server Error/i,
  /RPC.*failed/i,
  /violates row-level security/i,
  /trigger.*failed/i,
  /could not (find|locate).*column/i,
  /relation.*does not exist/i,
]

const INFRA_PATTERNS = [
  /Out of memory/i,
  /\bOOM\b/,
  /Killed.*signal 9/,
  /Failed to fetch.*chrome/i,
  /Process completed with exit code 100/,
  /Process completed with exit code 137/,
  /secret.*not set/i,
  /workflow_dispatch.*failed/i,
  /workflow file.*invalid/i,
]

const TEST_SPEC_PATTERNS = [
  /__dirname is not defined/,
  /Cannot find module/,
  /SyntaxError/,
  /Cannot import statement/,
  /ReferenceError.*is not defined/,
  /TypeError.*not a function/,
  /import\.meta/,
]

function categorize(errorLine: string): FailureClass {
  if (SELECTOR_PATTERNS.some((rx) => rx.test(errorLine))) return 'selector-aligner'
  if (PLATFORM_PATTERNS.some((rx) => rx.test(errorLine))) return 'platform-bug'
  if (INFRA_PATTERNS.some((rx) => rx.test(errorLine))) return 'infra-bug'
  if (TEST_SPEC_PATTERNS.some((rx) => rx.test(errorLine))) return 'test-spec'
  return 'unfixable'
}

function parseLog(logText: string, workflowGuess = '<unknown>'): Failure[] {
  const out: Failure[] = []
  const playwrightRx = /^\s*[✘×]\s+\d+\s+\[\w+\][^›]*›\s+(\S+\.spec\.ts:\d+:\d+)\s+›\s+(.+?)\s*\(.*\)\s*$/gm
  const errorRx = /^.*Error:.+$/gm

  const tests = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = playwrightRx.exec(logText)) !== null) {
    tests.add(`${m[1]} :: ${m[2]}`)
  }

  const errors: string[] = []
  while ((m = errorRx.exec(logText)) !== null) {
    errors.push(
      m[0]
        .replace(/^\s*\S+\s+\S+\s+Run \S+\s+\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, '')
        .trim(),
    )
  }

  for (const t of tests) {
    const idx = t.indexOf(' :: ')
    const file = t.slice(0, idx)
    const name = t.slice(idx + 4)
    const error = errors.find((e) => e.length > 10) ?? 'no_error_extracted'
    out.push({
      workflow: workflowGuess,
      job: '<unknown>',
      test: `${file} :: ${name}`,
      errorLine: error,
      category: categorize(error),
      retryCount: 0,
    })
  }

  return out
}

function fetchRunLog(runId: string): string {
  if (!/^\d{8,12}$/.test(runId)) {
    throw new Error(`invalid run id: ${runId}`)
  }
  return execFileSync('gh', ['run', 'view', runId, '--log'], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('usage: parse-gate-failures.ts <run-id>... | --stdin')
    process.exit(2)
  }

  const failures: Failure[] = []

  if (args[0] === '--stdin') {
    const stdin = readFileSync(0, 'utf-8')
    failures.push(...parseLog(stdin))
  } else {
    for (const runId of args) {
      try {
        const log = fetchRunLog(runId)
        failures.push(...parseLog(log, `run-${runId}`))
      } catch (e) {
        console.error(`run ${runId} log fetch failed:`, (e as Error).message)
      }
    }
  }

  const byCategory: Record<FailureClass, Failure[]> = {
    'selector-aligner': [],
    'platform-bug': [],
    'infra-bug': [],
    'test-spec': [],
    'unfixable': [],
  }
  for (const f of failures) byCategory[f.category].push(f)

  const summary = {
    total: failures.length,
    by_category: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, v.length]),
    ),
    failures: byCategory,
  }
  console.log(JSON.stringify(summary, null, 2))
}

main()
