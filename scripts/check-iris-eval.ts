/**
 * scripts/check-iris-eval.ts — CI gate for the Iris eval pipeline.
 *
 * Reads the latest results JSON written by `evals/iris/run-iris-eval.ts`
 * and compares against the floor values in `.quality-floor.json`.
 * Exits non-zero on regression.
 *
 * Mirrors the shape of `scripts/check-lap-2-gate.ts` so the CI step
 * looks familiar to anyone reading the workflow.
 *
 * Floors (in `.quality-floor.json`):
 *   irisEvalPassRate              0..1   overall pass rate floor
 *   irisVoiceLintPassRate         0..1   voice-only pass rate floor
 *   irisCitationResolveRate       0..1   citation pass rate floor
 *
 * Usage:
 *   npx tsx scripts/check-iris-eval.ts                    # auto-find latest result
 *   npx tsx scripts/check-iris-eval.ts --input=path.json  # specific result
 *   npx tsx scripts/check-iris-eval.ts --json             # machine-readable output
 *
 * Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md § CI gate
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IrisEvalSummary } from '../evals/iris/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const RESULTS_DIR = resolve(__dirname, '..', 'evals', 'iris', 'results')
const QUALITY_FLOOR_PATH = resolve(__dirname, '..', '.quality-floor.json')

interface QualityFloor {
  irisEvalPassRate?: number
  irisVoiceLintPassRate?: number
  irisCitationResolveRate?: number
}

interface CliArgs {
  inputPath: string | null
  json: boolean
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const inArg = argv.find((a) => a.startsWith('--input='))
  return {
    inputPath: inArg?.split('=')[1] ?? null,
    json: argv.includes('--json'),
  }
}

function findLatestResult(): string | null {
  if (!existsSync(RESULTS_DIR)) return null
  const files = readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
  return files.length === 0 ? null : join(RESULTS_DIR, files[files.length - 1])
}

function loadFloor(): QualityFloor {
  const raw = JSON.parse(readFileSync(QUALITY_FLOOR_PATH, 'utf8')) as QualityFloor
  return raw
}

function loadSummary(path: string): IrisEvalSummary {
  return JSON.parse(readFileSync(path, 'utf8')) as IrisEvalSummary
}

interface CheckResult {
  metric: string
  observed: number
  floor: number
  passed: boolean
}

function check(summary: IrisEvalSummary, floor: QualityFloor): CheckResult[] {
  const results: CheckResult[] = []
  const checks: Array<[string, number, number | undefined]> = [
    ['irisEvalPassRate', summary.irisEvalPassRate, floor.irisEvalPassRate],
    ['irisVoiceLintPassRate', summary.irisVoiceLintPassRate, floor.irisVoiceLintPassRate],
    ['irisCitationResolveRate', summary.irisCitationResolveRate, floor.irisCitationResolveRate],
  ]
  for (const [metric, observed, floorValue] of checks) {
    if (floorValue == null) continue
    results.push({
      metric,
      observed,
      floor: floorValue,
      passed: observed >= floorValue,
    })
  }
  return results
}

function main(): void {
  const args = parseArgs()
  const path = args.inputPath ?? findLatestResult()
  if (!path) {
    console.error('[check-iris-eval] no result file found in', RESULTS_DIR)
    process.exit(2)
  }

  const summary = loadSummary(path)
  const floor = loadFloor()
  const results = check(summary, floor)

  if (args.json) {
    console.log(JSON.stringify({ inputPath: path, summary, results }, null, 2))
  } else {
    console.log(`[check-iris-eval] reading ${path}`)
    console.log(`  totalRows: ${summary.totalRows}, passed: ${summary.passedRows}\n`)
    for (const r of results) {
      const mark = r.passed ? '✓' : '✗'
      const obs = (r.observed * 100).toFixed(1)
      const fl = (r.floor * 100).toFixed(1)
      console.log(`  ${mark} ${r.metric}: ${obs}% (floor ${fl}%)`)
    }
    if (summary.perRowResults.some((r) => !r.passed)) {
      console.log('\n  Failing rows:')
      for (const r of summary.perRowResults.filter((r) => !r.passed)) {
        console.log(`    ✗ ${r.id}: ${r.failureReasons.join('; ')}`)
      }
    }
  }

  const anyFailed = results.some((r) => !r.passed)
  if (anyFailed) {
    console.error('\n[check-iris-eval] HARD FAIL: one or more floors regressed')
    process.exit(1)
  }
  if (results.length === 0) {
    console.warn(
      '[check-iris-eval] no Iris floors set in .quality-floor.json; nothing to gate',
    )
    process.exit(0)
  }
  console.log('\n[check-iris-eval] PASS')
}

main()
