import { describe, it, expect } from 'vitest'
import {
  computeProjectHealthScore,
  computeAiConfidenceLevel,
  HEALTH_WEIGHTS,
} from './healthScoring'
import type { ProjectMetrics } from '../types/api'

// Build a ProjectMetrics row with sane defaults so each test only sets the
// fields it cares about. Defaults are zeros / nulls — i.e. "no data".
function metrics(overrides: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    project_id: 'p1',
    project_name: 'Project',
    contract_value: null,
    overall_progress: 0,
    milestones_completed: 0,
    milestones_total: 0,
    schedule_variance_days: null,
    rfis_open: 0,
    rfis_overdue: null,
    rfis_total: 0,
    avg_rfi_response_days: 0,
    punch_open: null,
    punch_total: 0,
    budget_total: 0,
    budget_spent: 0,
    budget_committed: 0,
    crews_active: 0,
    workers_onsite: 0,
    safety_incidents_this_month: 0,
    submittals_pending: 0,
    submittals_approved: 0,
    submittals_total: 0,
    ...overrides,
  }
}

// ── HEALTH_WEIGHTS invariant ──────────────────────────────────────

describe('HEALTH_WEIGHTS', () => {
  it('sums to exactly 1.0 (no missing or duplicated dimension)', () => {
    const sum = Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('schedule + budget + rfi (the 3 primary indicators) carry 75% of the score', () => {
    const primary = HEALTH_WEIGHTS.schedule + HEALTH_WEIGHTS.budget + HEALTH_WEIGHTS.rfi
    expect(primary).toBe(0.75)
  })
})

// ── computeProjectHealthScore ─────────────────────────────────────

describe('computeProjectHealthScore — gating on primary data', () => {
  it('returns null when ALL three primary indicators (schedule, budget, RFI) are absent', () => {
    expect(computeProjectHealthScore(metrics())).toBeNull()
  })

  it('returns a score when only schedule_variance_days is present (one primary is enough)', () => {
    expect(computeProjectHealthScore(metrics({ schedule_variance_days: 0 }))).not.toBeNull()
  })

  it('returns a score when only budget_total > 0 is present', () => {
    expect(computeProjectHealthScore(metrics({ budget_total: 100_000 }))).not.toBeNull()
  })

  it('returns a score when only rfis_overdue is non-null', () => {
    expect(computeProjectHealthScore(metrics({ rfis_overdue: 0 }))).not.toBeNull()
  })
})

describe('computeProjectHealthScore — schedule component', () => {
  it('On-pace schedule (variance=0 days) yields 100 schedule health (full credit)', () => {
    const s = computeProjectHealthScore(metrics({ schedule_variance_days: 0, budget_total: 100_000 }))
    // schedule=100, budget=100, rfi=100, punch=100, safety=100 → overall=100
    expect(s).toBe(100)
  })

  it('At threshold (20 days behind) → schedule health drops to 0 (component fully penalised)', () => {
    // schedule=0 → overall = 0*0.25 + 100*0.30 + 100*0.20 + 100*0.15 + 100*0.10 = 75
    const s = computeProjectHealthScore(metrics({ schedule_variance_days: 20, budget_total: 100_000 }))
    expect(s).toBe(75)
  })

  it('Negative variance (ahead of schedule) is treated as on-pace (no double credit)', () => {
    const s = computeProjectHealthScore(metrics({ schedule_variance_days: -10, budget_total: 100_000 }))
    expect(s).toBe(100)
  })

  it('Beyond threshold (40 days behind) clamps schedule health at 0 (no negative scores)', () => {
    const s = computeProjectHealthScore(metrics({ schedule_variance_days: 40, budget_total: 100_000 }))
    expect(s).toBe(75) // schedule=0 still, just clamped
  })
})

describe('computeProjectHealthScore — budget component', () => {
  it('Under budget (spent < total) → budget health 100', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, budget_total: 100_000, budget_spent: 80_000,
    }))
    expect(s).toBe(100)
  })

  it('Spent exactly equal to budget → budget health still 100 (no overrun yet)', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, budget_total: 100_000, budget_spent: 100_000,
    }))
    expect(s).toBe(100)
  })

  it('10% overrun (threshold) → budget health drops to 0', () => {
    // spent=110% of budget → overrunFraction=0.10 → budget=0 → overall=70
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, budget_total: 100_000, budget_spent: 110_000,
    }))
    expect(s).toBe(70) // 100*0.25 + 0*0.30 + 100*0.20 + 100*0.15 + 100*0.10 = 70
  })

  it('5% overrun → budget health 50 (linear ramp)', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, budget_total: 100_000, budget_spent: 105_000,
    }))
    // overrunFraction=0.05/0.10=0.5 → budgetHealth=50 → overall=100*0.25+50*0.30+100*0.20+100*0.15+100*0.10=85
    expect(s).toBe(85)
  })
})

describe('computeProjectHealthScore — RFI component', () => {
  it('Zero overdue RFIs → rfi health 100', () => {
    const s = computeProjectHealthScore(metrics({ rfis_overdue: 0, schedule_variance_days: 0 }))
    expect(s).toBe(100)
  })

  it('At threshold (10 overdue) → rfi health 0', () => {
    // rfi=0 → overall = 100*0.25 + 100*0.30 + 0*0.20 + 100*0.15 + 100*0.10 = 80
    const s = computeProjectHealthScore(metrics({ rfis_overdue: 10, schedule_variance_days: 0 }))
    expect(s).toBe(80)
  })

  it('5 overdue → rfi health 50 (linear ramp)', () => {
    const s = computeProjectHealthScore(metrics({ rfis_overdue: 5, schedule_variance_days: 0 }))
    // rfi=50 → 100*0.25+100*0.30+50*0.20+100*0.15+100*0.10 = 90
    expect(s).toBe(90)
  })
})

describe('computeProjectHealthScore — punch list component', () => {
  it('No punch items at all → punch health 100 (clean slate)', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, punch_total: 0, punch_open: null,
    }))
    expect(s).toBe(100)
  })

  it('All open (5 open of 5 total) → punch health 0', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, punch_total: 5, punch_open: 5,
    }))
    // punch=0 → 100*0.25+100*0.30+100*0.20+0*0.15+100*0.10 = 85
    expect(s).toBe(85)
  })

  it('Half closed (5 open of 10 total) → punch health 50', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, punch_total: 10, punch_open: 5,
    }))
    // punch=50 → 100*0.25+100*0.30+100*0.20+50*0.15+100*0.10 = 92.5 → 93
    expect(s).toBe(93)
  })
})

describe('computeProjectHealthScore — safety component', () => {
  it('Zero incidents → safety health 100', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, safety_incidents_this_month: 0,
    }))
    expect(s).toBe(100)
  })

  it('At threshold (3 incidents this month) → safety health 0', () => {
    // safety=0 → 100*0.25+100*0.30+100*0.20+100*0.15+0*0.10=90
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 0, safety_incidents_this_month: 3,
    }))
    expect(s).toBe(90)
  })
})

describe('computeProjectHealthScore — composite weighting', () => {
  it('Returns an integer (no floats leak into UI)', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 7, budget_total: 100_000, budget_spent: 95_000,
      rfis_overdue: 3, punch_total: 10, punch_open: 4, safety_incidents_this_month: 1,
    }))!
    expect(Number.isInteger(s)).toBe(true)
  })

  it('Score is bounded 0..100 even with all-bad indicators', () => {
    const s = computeProjectHealthScore(metrics({
      schedule_variance_days: 1000,
      budget_total: 100, budget_spent: 1_000_000,
      rfis_overdue: 100,
      punch_total: 10, punch_open: 10,
      safety_incidents_this_month: 100,
    }))!
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(100)
  })
})

// ── computeAiConfidenceLevel ──────────────────────────────────────

describe('computeAiConfidenceLevel — data-source counting', () => {
  // Note: safety_incidents_this_month is typed `number` (non-nullable), so the
  // default value of 0 still counts as a populated source via `!= null`.
  // The baseline metrics() row therefore has 1 populated source (safety).

  it('Returns null with only the implicit safety baseline source (1 < 3)', () => {
    expect(computeAiConfidenceLevel(metrics())).toBeNull()
  })

  it('Returns null with safety + schedule (2 < 3)', () => {
    expect(computeAiConfidenceLevel(metrics({ schedule_variance_days: 0 }))).toBeNull()
  })

  it('Returns 60% with safety + schedule + budget (3 of 5)', () => {
    const c = computeAiConfidenceLevel(metrics({ schedule_variance_days: 0, budget_total: 100 }))
    expect(c).toBe(60)
  })

  it('Returns 80% with safety + schedule + budget + rfis (4 of 5)', () => {
    const c = computeAiConfidenceLevel(metrics({
      schedule_variance_days: 0, budget_total: 100, rfis_total: 5,
    }))
    expect(c).toBe(80)
  })

  it('Returns 100% when all 5 sources are populated', () => {
    const c = computeAiConfidenceLevel(metrics({
      schedule_variance_days: 0, budget_total: 100, rfis_total: 5,
      punch_total: 1,
    }))
    expect(c).toBe(100)
  })

  it('budget_total = 0 does NOT count as populated (avoids inflating empty projects)', () => {
    // Without budget set: safety + schedule + rfis + punch = 4 sources → 80%
    const c = computeAiConfidenceLevel(metrics({
      schedule_variance_days: 0, budget_total: 0, rfis_total: 5, punch_total: 1,
    }))
    expect(c).toBe(80)
  })

  it('rfis_total = 0 does NOT count as populated (zero RFIs ≠ data populated)', () => {
    // safety + schedule + budget + punch = 4 sources → 80%
    const c = computeAiConfidenceLevel(metrics({
      schedule_variance_days: 0, budget_total: 100, rfis_total: 0, punch_total: 1,
    }))
    expect(c).toBe(80)
  })

  it('schedule_variance_days = 0 DOES count (zero is valid data, not absence)', () => {
    // safety + schedule + budget = 3 sources → 60%
    const c = computeAiConfidenceLevel(metrics({ schedule_variance_days: 0, budget_total: 100 }))
    expect(c).toBe(60)
  })
})
