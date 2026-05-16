// B19 — Cross-feature invariants (Crystalline Standard Tier 1).
//
// Pure-function property tests for the invariants declared in
// ops/coverage/invariants.json. Each invariant has BOTH a positive
// case (random valid input — assertion passes) and a negative case
// (deliberately-constructed violation — assertion throws).
//
// The cost_code_total_consistency invariant requires DB integration
// and is covered by an integration test (TODO: wire to test branch
// via mcp__plugin_supabase_supabase__create_branch).

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

import { type Cents } from '../../types/money'
import {
  assertBudgetRollup,
  BudgetRollupViolation,
  computeRevisedBudgetCents,
} from '../../lib/invariants/budgetRollup'
import {
  assertRetainageReleaseValid,
  RetainageReleaseViolation,
} from '../../lib/invariants/retainageCap'
import {
  assertNoOverlap,
  ScheduleMonotonicViolation,
} from '../../lib/invariants/scheduleMonotonic'
import {
  assertCrewHoursValid,
  CrewHoursCapViolation,
  MAX_CREW_HOURS_PER_DAY,
} from '../../lib/invariants/crewHoursCap'
import {
  assertPunchZoneCompletionValid,
  PunchZoneCompletionViolation,
} from '../../lib/invariants/punchZone'

const NUM_RUNS = 500

const cents = (n: number) => n as Cents
const moneyArb = fc.integer({ min: 0, max: 1_000_000_000 }).map(cents)

describe('B19 invariant: budget_rollup_sum', () => {
  it('positive: random valid rollup always passes', () => {
    fc.assert(
      fc.property(
        moneyArb,
        fc.array(moneyArb, { minLength: 0, maxLength: 20 }),
        (original, changes) => {
          const revised = computeRevisedBudgetCents(original, changes)
          assertBudgetRollup({
            divisionId: 'div-1',
            originalBudgetCents: original,
            approvedChangeOrderAmountsCents: changes,
            revisedBudgetCents: revised,
          })
          return true
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('negative: off-by-one revised_budget is rejected', () => {
    expect(() =>
      assertBudgetRollup({
        divisionId: 'div-1',
        originalBudgetCents: cents(100_00),
        approvedChangeOrderAmountsCents: [cents(50_00), cents(25_00)],
        revisedBudgetCents: cents(176_00), // off by 1 cent
      }),
    ).toThrow(BudgetRollupViolation)
  })

  it('negative: revised below original (negative change orders applied to a positive rollup) is rejected', () => {
    expect(() =>
      assertBudgetRollup({
        divisionId: 'div-1',
        originalBudgetCents: cents(100_00),
        approvedChangeOrderAmountsCents: [cents(50_00)],
        revisedBudgetCents: cents(100_00), // dropped the change order
      }),
    ).toThrow(BudgetRollupViolation)
  })
})

describe('B19 invariant: retainage_release_cap', () => {
  it('positive: any released <= withheld passes', () => {
    fc.assert(
      fc.property(moneyArb, moneyArb, (withheld, releaseDelta) => {
        const released = cents(Math.min(withheld, releaseDelta))
        assertRetainageReleaseValid({
          payAppId: 'pa-1',
          cumulativeWithheldCents: withheld,
          cumulativeReleasedCents: released,
        })
        return true
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('negative: released > withheld is rejected', () => {
    expect(() =>
      assertRetainageReleaseValid({
        payAppId: 'pa-1',
        cumulativeWithheldCents: cents(1000_00),
        cumulativeReleasedCents: cents(1000_01),
      }),
    ).toThrow(RetainageReleaseViolation)
  })
})

describe('B19 invariant: schedule_critical_path_monotonic', () => {
  // Use integer timestamps to dodge fast-check's Date edge cases (Invalid Date generation).
  const epoch2026 = new Date('2026-01-01').getTime()
  const epoch2028 = new Date('2028-01-01').getTime()
  const dayMs = 86_400_000
  const dateArb = fc.integer({ min: epoch2026, max: epoch2028 })
    .map((ts) => new Date(ts - (ts % dayMs)).toISOString().slice(0, 10))

  it('positive: predecessor.end <= activity.start passes', () => {
    fc.assert(
      fc.property(dateArb, dateArb, (a, b) => {
        const [earlier, later] = [a, b].sort()
        assertNoOverlap({
          predecessor: { id: 'p', startDateIso: '2025-01-01', endDateIso: earlier },
          activity: { id: 'a', startDateIso: later, endDateIso: '2030-01-01' },
        })
        return true
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('negative: predecessor ends after activity starts is rejected', () => {
    expect(() =>
      assertNoOverlap({
        predecessor: { id: 'p1', startDateIso: '2026-05-01', endDateIso: '2026-06-15' },
        activity: { id: 'a1', startDateIso: '2026-06-01', endDateIso: '2026-07-01' },
      }),
    ).toThrow(ScheduleMonotonicViolation)
  })
})

describe('B19 invariant: daily_log_crew_hours_cap', () => {
  it(`positive: any combination of entries summing <= ${MAX_CREW_HOURS_PER_DAY}h passes`, () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 0, max: 8, noNaN: true }), { minLength: 1, maxLength: 4 }),
        (hours) => {
          assertCrewHoursValid({
            crewId: 'crew-1',
            workDateIso: '2026-05-15',
            entries: hours.map((h) => ({
              crewId: 'crew-1',
              workDateIso: '2026-05-15',
              hoursWorked: h,
            })),
          })
          return true
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('negative: entries summing > 24h is rejected', () => {
    expect(() =>
      assertCrewHoursValid({
        crewId: 'crew-1',
        workDateIso: '2026-05-15',
        entries: [
          { crewId: 'crew-1', workDateIso: '2026-05-15', hoursWorked: 12 },
          { crewId: 'crew-1', workDateIso: '2026-05-15', hoursWorked: 13 },
        ],
      }),
    ).toThrow(CrewHoursCapViolation)
  })
})

describe('B19 invariant: punch_zone_completion', () => {
  it('positive: completed_at = null always passes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('open', 'in_progress', 'verified', 'rejected'),
          { minLength: 0, maxLength: 10 },
        ),
        (statuses) => {
          assertPunchZoneCompletionValid({
            zoneId: 'z',
            items: statuses.map((s, i) => ({ id: `i${i}`, status: s as never })),
            completedAt: null,
          })
          return true
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('positive: completed_at set with all items verified passes', () => {
    assertPunchZoneCompletionValid({
      zoneId: 'z1',
      items: [
        { id: 'i1', status: 'verified' },
        { id: 'i2', status: 'verified' },
      ],
      completedAt: '2026-05-15T12:00:00Z',
    })
  })

  it('negative: completed_at set with any open item is rejected', () => {
    expect(() =>
      assertPunchZoneCompletionValid({
        zoneId: 'z1',
        items: [
          { id: 'i1', status: 'verified' },
          { id: 'i2', status: 'open' },
        ],
        completedAt: '2026-05-15T12:00:00Z',
      }),
    ).toThrow(PunchZoneCompletionViolation)
  })
})

describe('B19 invariant: cost_code_total_consistency', () => {
  it.skip('integration: budget_items_total = sum(daily_log_costs + change_order_costs) tagged with that code', () => {
    // Requires test DB. See ops/coverage/invariants.json#cost_code_total_consistency.
    // TODO: wire to Supabase test branch via MCP create_branch + execute_sql.
  })
})
