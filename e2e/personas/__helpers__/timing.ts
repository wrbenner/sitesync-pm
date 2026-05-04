/**
 * timing.ts — Capture P50/P95 timings for persona interactions.
 *
 * Each interaction is wrapped in measure() which records the elapsed wall
 * time and appends a row to audit/persona-perf.md. After all measurements
 * for a persona are recorded, finalize() emits a summary table.
 *
 * Note: P50/P95 are computed over the recorded samples within a single
 * persona-day run. We do not track frame drops or memory across runs.
 * Frame-drop and heap-growth samples are captured ad-hoc inside specific
 * specs via page.evaluate(...) and logged as plain rows.
 */
import * as fs from 'fs'
import * as path from 'path'

const PERF_PATH = path.resolve(process.cwd(), 'audit/persona-perf.md')

interface Sample {
  persona: string
  step: string
  ms: number
  notes?: string
}

const samplesByPersona: Map<string, Sample[]> = new Map()

const HEADER = `# Persona Performance

Per-persona timing for each user-visible interaction. Captured by
\`e2e/personas/__helpers__/timing.ts\` while persona-day specs run.

- **Budget**: each persona-day spec must complete in **<= 90s**.
- **Per-interaction budget**: **<= 5000 ms**. Anything > 5000 ms is logged
  as a \`> budget\` row in the per-persona section.
- **P50 / P95**: computed across all samples in a single run; small
  sample sizes will be noisy.

## Raw samples

| Persona | Step | ms | Notes |
| --- | --- | --- | --- |
`

function ensureHeader(): void {
  if (!fs.existsSync(PERF_PATH)) {
    fs.mkdirSync(path.dirname(PERF_PATH), { recursive: true })
    fs.writeFileSync(PERF_PATH, HEADER, 'utf8')
  }
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export async function measure<T>(
  persona: string,
  step: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now()
  let notes = ''
  let result: T
  try {
    result = await fn()
  } catch (err) {
    notes = `error: ${(err as Error).message}`
    throw err
  } finally {
    const ms = Date.now() - start
    ensureHeader()
    if (ms > 5000) notes = (notes ? notes + '; ' : '') + '> budget'
    fs.appendFileSync(
      PERF_PATH,
      `| ${escapeCell(persona)} | ${escapeCell(step)} | ${ms} | ${escapeCell(notes)} |\n`,
      'utf8',
    )
    if (!samplesByPersona.has(persona)) samplesByPersona.set(persona, [])
    samplesByPersona.get(persona)!.push({ persona, step, ms, notes })
  }
  return result!
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

export function finalize(persona: string): void {
  const samples = samplesByPersona.get(persona) ?? []
  if (samples.length === 0) return
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b)
  const p50 = percentile(sorted, 50)
  const p95 = percentile(sorted, 95)
  const overBudget = samples.filter((s) => s.ms > 5000).length
  ensureHeader()
  fs.appendFileSync(
    PERF_PATH,
    `\n## Summary — ${persona}\n\n` +
      `- samples: ${samples.length}\n` +
      `- P50: ${p50} ms\n` +
      `- P95: ${p95} ms\n` +
      `- over-budget (>5s): ${overBudget}\n\n`,
    'utf8',
  )
}
