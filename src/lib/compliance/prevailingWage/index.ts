// =============================================================================
// Prevailing Wage Lookup
// =============================================================================
// Effective-dated lookup against `prevailing_wage_decisions`. The WH-347
// generator passes (state, county, trade, work_date) and gets back the
// active decision. State-wide determinations are stored with county='*';
// the lookup falls through to that when the specific county misses.
//
// Pure logic against pre-fetched rows — the actual Supabase query lives in
// the edge function. This split lets us unit test rate-effective-date logic
// without a database.
// =============================================================================

export interface PrevailingWageDecisionRow {
  id: string
  state_code: string
  county: string
  trade: string
  apprentice_level: number | null
  base_rate: number
  fringe_rate: number
  overtime_multiplier: number
  wage_decision_number: string | null
  effective_from: string  // ISO date
  effective_to: string | null
}

export interface WageLookupQuery {
  stateCode: string
  county: string
  trade: string
  /** ISO date for effective-date scoping. Required so a future rate change
   *  doesn't pull mid-week WH-347 numbers off-rate. */
  workDate: string
  apprenticeLevel?: number | null
}

export interface WageLookupResult {
  decision: PrevailingWageDecisionRow | null
  /** Why this decision (or null) was returned. Surfaces in the WH-347
   *  generator's gap report. */
  matchNote: string
}

/**
 * Pick the rate active for (state, county, trade, level) on a given date.
 *
 * Resolution rules:
 *   1. Prefer county-specific over state-wide ('*').
 *   2. Among active rows (effective_from <= workDate < effective_to OR null),
 *      prefer the latest effective_from.
 *   3. Apprentice level matched exactly (null = journeyman).
 */
export function pickWageDecision(
  query: WageLookupQuery,
  rows: PrevailingWageDecisionRow[],
): WageLookupResult {
  const date = query.workDate
  const tradeNorm = query.trade.trim().toLowerCase()
  const stateNorm = query.stateCode.trim().toUpperCase()
  const countyNorm = query.county.trim().toLowerCase()
  const level = query.apprenticeLevel ?? null

  const candidates = rows.filter(r => {
    if (r.state_code.toUpperCase() !== stateNorm) return false
    if (r.trade.trim().toLowerCase() !== tradeNorm) return false
    if ((r.apprentice_level ?? null) !== level) return false
    if (r.effective_from > date) return false
    if (r.effective_to && r.effective_to <= date) return false
    return true
  })

  if (candidates.length === 0) {
    return {
      decision: null,
      matchNote: `No active decision for ${stateNorm}/${query.county}/${query.trade} on ${date}` +
                 (level ? ` (apprentice L${level})` : ''),
    }
  }

  // Prefer county-specific over state-wide '*' wildcard.
  const specificCounty = candidates.filter(c => c.county.trim().toLowerCase() === countyNorm)
  const pool = specificCounty.length > 0 ? specificCounty : candidates.filter(c => c.county === '*')
  if (pool.length === 0) {
    return {
      decision: null,
      matchNote: `Trade rate exists in state but not for county "${query.county}" or state-wide`,
    }
  }

  // Latest effective_from wins.
  pool.sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  const picked = pool[0]
  return {
    decision: picked,
    matchNote: `${picked.wage_decision_number ?? '(no decision number)'} ` +
               `effective ${picked.effective_from}` +
               (specificCounty.length > 0 ? ` [county-specific]` : ` [state-wide]`),
  }
}

/**
 * Compute the gross pay for a worker-week given hours + rate decision.
 * Apprentice ratio enforcement is in wh347/index.ts; this only does math.
 */
export function computeWeekGross(
  hoursStraight: number,
  hoursOvertime: number,
  hoursDouble: number,
  decision: PrevailingWageDecisionRow,
): { straight: number; overtime: number; doubleTime: number; fringes: number; gross: number } {
  const straight = +(hoursStraight * decision.base_rate).toFixed(2)
  const ot       = +(hoursOvertime * decision.base_rate * decision.overtime_multiplier).toFixed(2)
  const dt       = +(hoursDouble * decision.base_rate * 2).toFixed(2)
  const fringes  = +((hoursStraight + hoursOvertime + hoursDouble) * decision.fringe_rate).toFixed(2)
  return {
    straight, overtime: ot, doubleTime: dt, fringes,
    gross: +(straight + ot + dt + fringes).toFixed(2),
  }
}

/** Detect rate-violation: actual paid rate below the decision's base rate. */
export function detectRateViolation(
  hourlyRatePaid: number,
  decision: PrevailingWageDecisionRow,
): { violated: boolean; shortBy: number } {
  const short = +(decision.base_rate - hourlyRatePaid).toFixed(2)
  return { violated: short > 0.01, shortBy: short > 0 ? short : 0 }
}
