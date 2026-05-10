/**
 * evals/iris/run-iris-eval.ts — runs the Iris eval pipeline directly.
 *
 * We call the iris-call provider + the three asserts in-process rather
 * than shelling out to promptfoo. Reasons:
 *
 *   1. Promptfoo's CLI uses YAML config with stringly-typed assert
 *      hooks; our asserts are type-safe TypeScript. Calling them
 *      directly preserves type safety and gives us a richer per-row
 *      result object than `output.json` would.
 *
 *   2. CI cost: a single Node process for 30 rows with parallel fetches
 *      is ~6× faster than promptfoo's per-row spawn pattern.
 *
 *   3. Future-compat: if we want promptfoo's diff UI for prompt
 *      iteration, the provider in `evals/iris/providers/iris-call.ts`
 *      stays usable — it implements the promptfoo interface contract.
 *
 * Output: writes `evals/iris/results/<timestamp>.json` with per-row +
 * aggregate metrics, then prints a summary. Exit code is 0 always —
 * the regression gate lives in `scripts/check-iris-eval.ts`.
 *
 * Usage:
 *   npm run eval:iris            # full run, writes results
 *   npm run eval:iris -- --rows=5   # smoke run on first 5 rows
 *   npm run eval:iris -- --filter=rfi.draft  # only this action_type
 *
 * Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import IrisCallProvider from './providers/iris-call'
import { assertVoice } from './asserts/voice'
import { assertCitations } from './asserts/citations'
import { assertActionShape } from './asserts/action'
import type { EvalCorpusRow, IrisEvalSummary, IrisProviderOutput } from './types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CORPUS_SEED = resolve(__dirname, 'corpus', 'seed.jsonl')
const CORPUS_HAND_EDITS = resolve(__dirname, 'corpus', 'hand-edits.jsonl')
const RESULTS_DIR = resolve(__dirname, 'results')

interface CliArgs {
  filter: string | null
  rowsLimit: number | null
  outputPath: string | null
  resultsPath: string | null
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const filterArg = argv.find((a) => a.startsWith('--filter='))
  const rowsArg = argv.find((a) => a.startsWith('--rows='))
  const outArg = argv.find((a) => a.startsWith('--output='))
  return {
    filter: filterArg?.split('=')[1] ?? null,
    rowsLimit: rowsArg ? Number(rowsArg.split('=')[1]) : null,
    outputPath: outArg?.split('=')[1] ?? null,
    resultsPath: null,
  }
}

function loadCorpus(): EvalCorpusRow[] {
  const rows: EvalCorpusRow[] = []
  for (const path of [CORPUS_SEED, CORPUS_HAND_EDITS]) {
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue
      rows.push(JSON.parse(trimmed) as EvalCorpusRow)
    }
  }
  return rows
}

interface RowResult {
  id: string
  actionType: string
  passed: boolean
  voicePassed: boolean
  citationsPassed: boolean
  actionPassed: boolean
  failureReasons: string[]
  meta: IrisProviderOutput['meta'] | null
  error: string | null
}

async function evalRow(
  provider: IrisCallProvider,
  row: EvalCorpusRow,
): Promise<RowResult> {
  try {
    const resp = await provider.callApi(row.prompt, { vars: { row } })
    if (resp.error || !resp.irisOutput) {
      return {
        id: row.id,
        actionType: row.actionType,
        passed: false,
        voicePassed: false,
        citationsPassed: false,
        actionPassed: false,
        failureReasons: [`provider error: ${resp.error ?? 'no irisOutput'}`],
        meta: null,
        error: resp.error ?? 'no irisOutput',
      }
    }
    const out = resp.irisOutput
    const voice = assertVoice(row, out)
    const citations = await assertCitations(row, out)
    const action = assertActionShape(row, out)

    const failureReasons: string[] = []
    if (!voice.passed) failureReasons.push(`voice: ${voice.reason}`)
    if (!citations.passed) failureReasons.push(`citations: ${citations.reason}`)
    if (!action.passed) failureReasons.push(`action: ${action.reason}`)

    return {
      id: row.id,
      actionType: row.actionType,
      passed: voice.passed && citations.passed && action.passed,
      voicePassed: voice.passed,
      citationsPassed: citations.passed,
      actionPassed: action.passed,
      failureReasons,
      meta: out.meta,
      error: null,
    }
  } catch (err) {
    return {
      id: row.id,
      actionType: row.actionType,
      passed: false,
      voicePassed: false,
      citationsPassed: false,
      actionPassed: false,
      failureReasons: [`exception: ${(err as Error).message}`],
      meta: null,
      error: (err as Error).message,
    }
  }
}

function summarize(rows: RowResult[]): IrisEvalSummary {
  const total = rows.length
  const passed = rows.filter((r) => r.passed).length
  const voicePassed = rows.filter((r) => r.voicePassed).length
  const citationsPassed = rows.filter((r) => r.citationsPassed).length
  return {
    totalRows: total,
    passedRows: passed,
    irisEvalPassRate: total === 0 ? 0 : passed / total,
    irisVoiceLintPassRate: total === 0 ? 0 : voicePassed / total,
    irisCitationResolveRate: total === 0 ? 0 : citationsPassed / total,
    perRowResults: rows.map((r) => ({
      id: r.id,
      passed: r.passed,
      voicePassed: r.voicePassed,
      citationsPassed: r.citationsPassed,
      actionPassed: r.actionPassed,
      failureReasons: r.failureReasons,
    })),
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
  let corpus = loadCorpus()
  if (args.filter) {
    corpus = corpus.filter((r) => r.actionType === args.filter || r.id.startsWith(args.filter!))
  }
  if (args.rowsLimit != null) corpus = corpus.slice(0, args.rowsLimit)
  if (corpus.length === 0) {
    console.error('[run-iris-eval] no corpus rows matched filters; nothing to do')
    process.exit(2)
  }

  console.log(`[run-iris-eval] running ${corpus.length} rows`)
  const provider = new IrisCallProvider()

  // Cap concurrency at 5 — iris-call has a 30/min/user rate limit and
  // we don't want to head-of-line block on a single slow provider call.
  const CONCURRENCY = 5
  const results: RowResult[] = new Array(corpus.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const i = cursor++
        if (i >= corpus.length) break
        results[i] = await evalRow(provider, corpus[i])
        const r = results[i]
        process.stdout.write(`  ${r.passed ? '✓' : '✗'} ${r.id}${r.error ? ` (${r.error})` : ''}\n`)
      }
    }),
  )

  const summary = summarize(results)
  console.log(
    `\n[run-iris-eval] summary: ${summary.passedRows}/${summary.totalRows} passed ` +
      `(eval=${(summary.irisEvalPassRate * 100).toFixed(1)}%, ` +
      `voice=${(summary.irisVoiceLintPassRate * 100).toFixed(1)}%, ` +
      `citations=${(summary.irisCitationResolveRate * 100).toFixed(1)}%)`,
  )

  // Write results.
  mkdirSync(RESULTS_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = args.outputPath ?? resolve(RESULTS_DIR, `${stamp}.json`)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`[run-iris-eval] results: ${outPath}`)
}

main().catch((err) => {
  console.error('[run-iris-eval] fatal:', err)
  process.exit(2)
})
