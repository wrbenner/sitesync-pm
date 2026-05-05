/**
 * Pure-function unit tests for the Lap 2 gate evaluator. Runs offline,
 * proves the threshold logic before any DB-backed integration test.
 *
 * Mirrors the 7 spec scenarios (LAP_2_ACCEPTANCE_GATE_SPEC § Test plan).
 */
import { describe, it, expect } from 'vitest'
import { evaluateLap2Gate, GATE_THRESHOLDS } from '../lap-2-gate-thresholds'

const baseline = {
  approved_count: 100,
  acceptance_rate_pct: 78.9,
  avg_time_to_approve_sec: 60,
  ghost_approval_count: 0,
  open_incidents: 0,
  audit_chain_broken: 0,
} as const

describe('evaluateLap2Gate', () => {
  it('passes the baseline scenario (75/20/5 → 78.9% rate, 60s latency)', () => {
    const r = evaluateLap2Gate(baseline)
    expect(r.verdict).toBe('pass')
    expect(r.failures).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('soft-fails at 100s latency (in [90, 120])', () => {
    const r = evaluateLap2Gate({ ...baseline, avg_time_to_approve_sec: 100 })
    expect(r.verdict).toBe('soft-fail')
    expect(r.failures).toEqual([])
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toMatch(/100s in soft-fail band/)
  })

  it('hard-fails at 130s latency (> 120)', () => {
    const r = evaluateLap2Gate({ ...baseline, avg_time_to_approve_sec: 130 })
    expect(r.verdict).toBe('hard-fail')
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0]).toMatch(/130s > 120s/)
  })

  it('hard-fails on a single critical incident', () => {
    const r = evaluateLap2Gate({ ...baseline, open_incidents: 1 })
    expect(r.verdict).toBe('hard-fail')
    expect(r.failures.some((f) => /1 unresolved high\/critical/.test(f))).toBe(true)
  })

  it('hard-fails on insufficient volume (count = 99)', () => {
    const r = evaluateLap2Gate({ ...baseline, approved_count: 99 })
    expect(r.verdict).toBe('hard-fail')
    expect(r.failures[0]).toMatch(/approved_count=99 < 100/)
  })

  it('passes when count reaches 100 and incident is resolved', () => {
    const r = evaluateLap2Gate({ ...baseline, approved_count: 100, open_incidents: 0 })
    expect(r.verdict).toBe('pass')
  })

  it('hard-fails on a ghost approval (Gate 4)', () => {
    const r = evaluateLap2Gate({ ...baseline, ghost_approval_count: 1 })
    expect(r.verdict).toBe('hard-fail')
    expect(r.failures.some((f) => /1 ghost approval/.test(f))).toBe(true)
  })

  it('hard-fails on a broken audit chain (Gate 4)', () => {
    const r = evaluateLap2Gate({ ...baseline, audit_chain_broken: 3 })
    expect(r.verdict).toBe('hard-fail')
    expect(r.failures.some((f) => /audit chain broken at 3 row/.test(f))).toBe(true)
  })

  it('reports a NULL acceptance rate as a hard fail with a clear message', () => {
    const r = evaluateLap2Gate({ ...baseline, acceptance_rate_pct: null })
    expect(r.verdict).toBe('hard-fail')
    expect(r.failures.some((f) => /acceptance_rate is NULL/.test(f))).toBe(true)
  })

  it('hard-fails at exactly 69.99% rate (boundary)', () => {
    const r = evaluateLap2Gate({ ...baseline, acceptance_rate_pct: 69.99 })
    expect(r.verdict).toBe('hard-fail')
    expect(r.failures.some((f) => /69.99% < 70%/.test(f))).toBe(true)
  })

  it('passes at exactly the rate threshold (70.00%)', () => {
    const r = evaluateLap2Gate({ ...baseline, acceptance_rate_pct: 70.0 })
    expect(r.verdict).toBe('pass')
  })

  it('passes at exactly the latency soft threshold (90s)', () => {
    const r = evaluateLap2Gate({ ...baseline, avg_time_to_approve_sec: 90 })
    expect(r.verdict).toBe('pass')
  })

  it('soft-fails just above 90s (90.01s)', () => {
    const r = evaluateLap2Gate({ ...baseline, avg_time_to_approve_sec: 90.01 })
    expect(r.verdict).toBe('soft-fail')
  })

  it('aggregates multiple failures (count + rate + latency + incident)', () => {
    const r = evaluateLap2Gate({
      approved_count: 50,
      acceptance_rate_pct: 50,
      avg_time_to_approve_sec: 200,
      ghost_approval_count: 2,
      open_incidents: 1,
      audit_chain_broken: 1,
    })
    expect(r.verdict).toBe('hard-fail')
    // count + rate + latency + ghost + incident + chain = 6
    expect(r.failures.length).toBe(6)
  })

  it('exposes constants for cross-checking with the bash workflow', () => {
    // If you change these here, change `.github/workflows/lap-2-acceptance.yml`.
    expect(GATE_THRESHOLDS.approvedMin).toBe(100)
    expect(GATE_THRESHOLDS.rateMinPct).toBe(70)
    expect(GATE_THRESHOLDS.latencySoftMaxSec).toBe(90)
    expect(GATE_THRESHOLDS.latencyHardMaxSec).toBe(120)
  })
})
