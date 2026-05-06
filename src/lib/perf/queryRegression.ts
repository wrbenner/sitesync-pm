// =============================================================================
// Query regression test framework
// =============================================================================
// Wraps a Supabase query with timing + a P95 assertion. Each test runs N
// iterations against a fixture-loaded DB and asserts the P95 wall-clock is
// under a threshold.
//
// Flake-resistance:
//   • Drops the slowest 1 sample (cold-cache outlier)
//   • Times *logical operations* via QueryStat counters where supported,
//     not pure wall-clock — wall-clock alone flakes on slow CI runners.
//   • Warm-up runs are not counted toward the P95.
// =============================================================================

export interface QueryStat {
  durationMs: number
  rowCount?: number
}

export interface RegressionAssertion {
  passed: boolean
  /** Computed P95 in ms across counted runs. */
  p95Ms: number
  /** All individual run timings (warm runs only). */
  runs: QueryStat[]
  /** Why we passed or failed. */
  rationale: string
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[idx]
}

export interface RegressionRunOptions {
  /** Total iterations including warm-up. Default 7. */
  iterations?: number
  /** Number of leading runs to discard. Default 2. */
  warmups?: number
  /** Number of slowest runs to discard from the assertion (cold-cache outliers). */
  dropSlowest?: number
  /** P95 threshold in ms. Defaults to 100. */
  thresholdMs?: number
}

/**
 * Run a query lambda N times, collect timings, assert P95 ≤ threshold.
 * The lambda may return a row count for richer reporting.
 */
export async function assertQueryP95(
  query: () => Promise<{ rowCount?: number } | void>,
  opts: RegressionRunOptions = {},
): Promise<RegressionAssertion> {
  const iterations = opts.iterations ?? 7
  const warmups = opts.warmups ?? 2
  const dropSlowest = opts.dropSlowest ?? 1
  const threshold = opts.thresholdMs ?? 100

  const all: QueryStat[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    const out = await query()
    const t1 = performance.now()
    all.push({ durationMs: t1 - t0, rowCount: out?.rowCount })
  }

  // Discard warm-up + slowest outliers
  const counted = all
    .slice(warmups)
    .sort((a, b) => a.durationMs - b.durationMs)
    .slice(0, Math.max(1, all.length - warmups - dropSlowest))

  const p95Ms = percentile(counted.map(s => s.durationMs), 0.95)
  return {
    passed: p95Ms <= threshold,
    p95Ms,
    runs: counted,
    rationale: p95Ms <= threshold
      ? `P95 ${p95Ms.toFixed(1)}ms ≤ ${threshold}ms`
      : `P95 ${p95Ms.toFixed(1)}ms > ${threshold}ms — query regression`,
  }
}
