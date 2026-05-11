// ────────────────────────────────────────────────────────────────────────────
// kb-retrieval golden harness — Phase 3e
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §11
// ADR-017, ADR-020.
//
// Runs the 20 starter goldens against a staging project's corpus. Computes:
//   - recall@5  per golden = (top-5 contains any expected_anchor_substring) ? 1 : 0
//   - precision@5 per golden = (top-1 source_type in expected_source_types) ? 1 : 0
//   - latency_ms per call
//   - cache_hit boolean
//
// Aggregates: macro-mean recall, macro-mean precision, p95 latency, cache hit rate.
// Acceptance gates (per PHASE_3_ACCEPTANCE):
//   - recall@5 mean >= 0.85
//   - precision@5 mean >= 0.70
//   - latency_p95 <= 800 ms
//   - cost <= $2/project/month (asserted from telemetry; not in this script)
//
// Run via `npm run iris-eval-kb-retrieval`. CI (.github/workflows/phase-3-acceptance.yml)
// runs this daily at 18:45 UTC against the soft-pilot org's corpus.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { retrieve } from '../../../src/services/iris/retrieve'
import { PHASE_3_ACCEPTANCE } from '../../../src/services/iris/types/retrieval'
import type { RetrieveQuery, RetrieveResult } from '../../../src/services/iris/types/retrieval'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GOLDENS_PATH = join(__dirname, 'fixtures/goldens.json')

interface Golden {
  id: string
  category: string
  question: string
  expected_source_types: readonly string[]
  expected_anchor_substrings: readonly string[]
  min_score: number
}

interface GoldenOutcome {
  id: string
  recall_at_5: 0 | 1
  precision_at_5: 0 | 1
  latency_ms: number
  cache_hit: boolean
  chunks_returned: number
}

interface HarnessReport {
  total: number
  recall_at_5_mean: number
  precision_at_5_mean: number
  latency_p50_ms: number
  latency_p95_ms: number
  cache_hit_rate: number
  gates: {
    recall: { passed: boolean; observed: number; target: number }
    precision: { passed: boolean; observed: number; target: number }
    latency_p95: { passed: boolean; observed: number; target: number }
  }
  outcomes: readonly GoldenOutcome[]
}

function loadGoldens(): Golden[] {
  const raw = readFileSync(GOLDENS_PATH, 'utf8')
  return JSON.parse(raw) as Golden[]
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx]
}

function judgeOutcome(golden: Golden, result: RetrieveResult): GoldenOutcome {
  const top5 = result.chunks.slice(0, 5)
  const top1 = top5[0]

  // recall@5 — at least one of the top-5 chunks anchors back to something
  // whose source_anchor or chunk_text mentions one of the expected substrings.
  let recall_at_5: 0 | 1 = 0
  for (const chunk of top5) {
    const anchor = JSON.stringify(chunk.source_anchor).toLowerCase()
    const text = chunk.chunk_text.toLowerCase()
    for (const needle of golden.expected_anchor_substrings) {
      const n = needle.toLowerCase()
      if (anchor.includes(n) || text.includes(n)) {
        recall_at_5 = 1
        break
      }
    }
    if (recall_at_5 === 1) break
  }

  // precision@5 — top-1 chunk's source_type is in the expected set.
  const precision_at_5: 0 | 1 =
    top1 && golden.expected_source_types.includes(top1.source_type) ? 1 : 0

  return {
    id: golden.id,
    recall_at_5,
    precision_at_5,
    latency_ms: result.latency_ms,
    cache_hit: result.cache_hit,
    chunks_returned: result.chunks.length,
  }
}

export async function runGoldens(opts: {
  project_id: string
  persona?: RetrieveQuery['persona']
}): Promise<HarnessReport> {
  const goldens = loadGoldens()
  const outcomes: GoldenOutcome[] = []

  for (const g of goldens) {
    const result = await retrieve(
      {
        text: g.question,
        project_id: opts.project_id,
        persona: opts.persona ?? 'pm',
      },
      {
        k: 5,
        min_score: g.min_score,
        caller_tag: `goldens-${g.id}`,
      },
    )
    outcomes.push(judgeOutcome(g, result))
  }

  const total = outcomes.length
  const recall_at_5_mean = outcomes.reduce((s, o) => s + o.recall_at_5, 0) / total
  const precision_at_5_mean = outcomes.reduce((s, o) => s + o.precision_at_5, 0) / total
  const latencies = outcomes.map((o) => o.latency_ms)
  const latency_p50_ms = percentile(latencies, 0.5)
  const latency_p95_ms = percentile(latencies, 0.95)
  const cache_hit_rate = outcomes.filter((o) => o.cache_hit).length / total

  return {
    total,
    recall_at_5_mean,
    precision_at_5_mean,
    latency_p50_ms,
    latency_p95_ms,
    cache_hit_rate,
    gates: {
      recall: {
        passed: recall_at_5_mean >= PHASE_3_ACCEPTANCE.recall_at_5_floor,
        observed: recall_at_5_mean,
        target: PHASE_3_ACCEPTANCE.recall_at_5_floor,
      },
      precision: {
        passed: precision_at_5_mean >= PHASE_3_ACCEPTANCE.precision_at_5_floor,
        observed: precision_at_5_mean,
        target: PHASE_3_ACCEPTANCE.precision_at_5_floor,
      },
      latency_p95: {
        passed: latency_p95_ms <= PHASE_3_ACCEPTANCE.latency_p95_ms_ceiling,
        observed: latency_p95_ms,
        target: PHASE_3_ACCEPTANCE.latency_p95_ms_ceiling,
      },
    },
    outcomes,
  }
}

export { loadGoldens, judgeOutcome, percentile }
export type { Golden, GoldenOutcome, HarnessReport }
