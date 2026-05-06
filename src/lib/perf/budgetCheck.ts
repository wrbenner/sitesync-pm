// =============================================================================
// Performance budget checker — pure logic invoked by CI workflow
// =============================================================================
// Reads a Lighthouse CI report (the `manifest.json` produced by `lhci collect`)
// and returns whether the run fits inside the budgets defined in lighthouserc.
//
// The CI workflow short-circuits if commit message contains
// `RATCHET_OVERRIDE=1` — for the rare case where a deliberate regression
// is justified (e.g. shipping a new module that adds 80KB of bundle).
// =============================================================================

export interface PerfBudget {
  /** Throttled-3G first contentful paint in ms. */
  fcpMs: number
  /** Time to interactive in ms (also throttled). */
  ttiMs: number
  /** Gzipped bundle bytes excluding lazy chunks. */
  bundleBytesGzipped: number
}

export const DEFAULT_BUDGETS: PerfBudget = {
  fcpMs: 1500,
  ttiMs: 3000,
  bundleBytesGzipped: 600 * 1024,
}

export interface BudgetReport {
  passed: boolean
  results: Array<{
    metric: keyof PerfBudget
    actual: number
    budget: number
    delta: number
    overBudget: boolean
  }>
  /** Human-readable summary for the PR comment / CI log. */
  summary: string
}

interface LhciManifestEntry {
  audits?: {
    'first-contentful-paint'?: { numericValue?: number }
    'interactive'?: { numericValue?: number }
    'total-byte-weight'?: { numericValue?: number }
  }
}

export function readMetricsFromLhci(entry: LhciManifestEntry): {
  fcpMs: number; ttiMs: number; bundleBytesGzipped: number
} {
  const audits = entry.audits ?? {}
  return {
    fcpMs: Math.round(audits['first-contentful-paint']?.numericValue ?? 0),
    ttiMs: Math.round(audits['interactive']?.numericValue ?? 0),
    // Lighthouse reports total bytes (uncompressed). Approximate gzipped at
    // 35% of total — close enough for a budget signal; CI can override with
    // an explicit `bundle.size.gzipped` from the build step when wired.
    bundleBytesGzipped: Math.round((audits['total-byte-weight']?.numericValue ?? 0) * 0.35),
  }
}

export function checkBudget(actual: { fcpMs: number; ttiMs: number; bundleBytesGzipped: number }, budget: PerfBudget = DEFAULT_BUDGETS): BudgetReport {
  const results: BudgetReport['results'] = (['fcpMs', 'ttiMs', 'bundleBytesGzipped'] as const).map(metric => {
    const actualValue = actual[metric]
    const budgetValue = budget[metric]
    return {
      metric,
      actual: actualValue,
      budget: budgetValue,
      delta: actualValue - budgetValue,
      overBudget: actualValue > budgetValue,
    }
  })
  const passed = results.every(r => !r.overBudget)
  const overs = results.filter(r => r.overBudget)
  const summary = passed
    ? `✓ All performance budgets met (FCP ${actual.fcpMs}ms / TTI ${actual.ttiMs}ms / bundle ${(actual.bundleBytesGzipped / 1024).toFixed(0)}KB).`
    : `✗ ${overs.length} budget${overs.length === 1 ? '' : 's'} exceeded: ` +
      overs.map(o => `${o.metric}=${o.actual} (over by ${o.delta})`).join(', ')
  return { passed, results, summary }
}

/** Detect ratchet override in a commit message. CI workflow consumes this. */
export function hasRatchetOverride(commitMessage: string | null | undefined): boolean {
  if (!commitMessage) return false
  return /\bRATCHET_OVERRIDE=1\b/.test(commitMessage)
}
