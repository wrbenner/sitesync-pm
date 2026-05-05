/**
 * Lap 2 acceptance-gate thresholds — single source of truth.
 *
 * `.github/workflows/lap-2-acceptance.yml` reproduces the same logic in
 * bash (no npm install step in the gate job). When you change a constant
 * here, change it there too. Drift is the enemy.
 *
 * Spec: docs/audits/LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md
 */

export interface Lap2GateMetrics {
  approved_count: number
  acceptance_rate_pct: number | null
  avg_time_to_approve_sec: number | null
  ghost_approval_count: number
  open_incidents: number
  audit_chain_broken: number
}

export type GateVerdict = 'pass' | 'soft-fail' | 'hard-fail'

export interface GateResult {
  verdict: GateVerdict
  failures: string[]
  warnings: string[]
}

export const GATE_THRESHOLDS = {
  approvedMin: 100,
  rateMinPct: 70,
  latencyHardMaxSec: 120,
  latencySoftMaxSec: 90,
} as const

/**
 * Apply the four programmatic gates to a single metrics row. Pure
 * function — safe to unit-test offline. No I/O.
 *
 * Verdict semantics:
 *   - hard-fail: at least one critical gate failed; CI exits 1
 *   - soft-fail: latency in [90, 120] but everything else passed; CI exits 0 with a warning
 *   - pass: all gates green
 *
 * The qualitative Gate 5 ("I don't want to go back") is captured manually
 * by Walker and is NOT evaluated here.
 */
export function evaluateLap2Gate(m: Lap2GateMetrics): GateResult {
  const failures: string[] = []
  const warnings: string[] = []

  // Gate 1 — approved count
  if (m.approved_count < GATE_THRESHOLDS.approvedMin) {
    failures.push(
      `Gate 1 — approved_count=${m.approved_count} < ${GATE_THRESHOLDS.approvedMin}`,
    )
  }

  // Gate 2 — acceptance rate
  if (m.acceptance_rate_pct == null) {
    failures.push('Gate 2 — acceptance_rate is NULL (no decided drafts in window)')
  } else if (m.acceptance_rate_pct < GATE_THRESHOLDS.rateMinPct) {
    failures.push(
      `Gate 2 — acceptance_rate=${m.acceptance_rate_pct}% < ${GATE_THRESHOLDS.rateMinPct}%`,
    )
  }

  // Gate 3 — latency
  if (m.avg_time_to_approve_sec != null) {
    if (m.avg_time_to_approve_sec > GATE_THRESHOLDS.latencyHardMaxSec) {
      failures.push(
        `Gate 3 — avg_time_to_approve=${m.avg_time_to_approve_sec}s > ${GATE_THRESHOLDS.latencyHardMaxSec}s (hard fail)`,
      )
    } else if (m.avg_time_to_approve_sec > GATE_THRESHOLDS.latencySoftMaxSec) {
      warnings.push(
        `Gate 3 — avg_time_to_approve=${m.avg_time_to_approve_sec}s in soft-fail band [${GATE_THRESHOLDS.latencySoftMaxSec}, ${GATE_THRESHOLDS.latencyHardMaxSec}]; Walker sign-off required for Day 60 pass`,
      )
    }
  }

  // Gate 4 — security/audit
  if (m.ghost_approval_count > 0) {
    failures.push(
      `Gate 4 — ${m.ghost_approval_count} ghost approval(s) (status approved/executed without first_viewed_at)`,
    )
  }
  if (m.open_incidents > 0) {
    failures.push(`Gate 4 — ${m.open_incidents} unresolved high/critical incident(s)`)
  }
  if (m.audit_chain_broken > 0) {
    failures.push(`Gate 4 — audit chain broken at ${m.audit_chain_broken} row(s)`)
  }

  if (failures.length > 0) return { verdict: 'hard-fail', failures, warnings }
  if (warnings.length > 0) return { verdict: 'soft-fail', failures, warnings }
  return { verdict: 'pass', failures, warnings }
}
