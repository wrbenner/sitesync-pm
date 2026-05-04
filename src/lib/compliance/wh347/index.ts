// =============================================================================
// WH-347 generator — pure logic (no DB, no PDF)
// =============================================================================
// Takes a header + a roster of worker-weeks + a statement of compliance,
// resolves the prevailing wage decision per worker, computes gross / fringe
// / deduction / net, flags gaps + rate violations, and returns a fully
// populated Wh347Generated. The renderer (wh347/render.ts) takes that
// object and produces text + PDF.
// =============================================================================

import { pickWageDecision, computeWeekGross, detectRateViolation,
         type PrevailingWageDecisionRow, type WageLookupQuery } from '../prevailingWage'
import type {
  Wh347Header, Wh347Statement, Wh347WorkerWeek, Wh347Generated,
} from './types'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

async function sha256Hex(input: string): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle
  if (!subtle) throw new Error('crypto.subtle unavailable')
  const buf = new TextEncoder().encode(input)
  const hash = await subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface GenerateInputs {
  header: Wh347Header
  workers: Wh347WorkerWeek[]
  statement: Wh347Statement
  /** All wage decisions in scope for the project — typically pre-filtered to
   *  the state. The pickWageDecision lookup further filters by county/trade/
   *  effective date. */
  decisions: PrevailingWageDecisionRow[]
}

/**
 * The headline function. Input: structured roster. Output: a fully populated
 * WH-347 ready to render.
 *
 * Gap detection runs against the Statement compliance checks the DOL form
 * requires:
 *   1. Every worker row's hours sum across the 7 days must equal
 *      straight+OT+DT (otherwise the day breakdown doesn't match the totals).
 *   2. Every classification must resolve to a prevailing wage decision —
 *      otherwise we can't certify compliance.
 *   3. The hourly rate actually paid must meet or exceed the determination's
 *      base rate. A short-pay flags a violation; the form refuses to
 *      certify and the compliance officer must correct upstream.
 *   4. Fringe allocation per worker must internally agree with the
 *      Statement-level fringe declaration ('paid_to_plans' / 'paid_in_cash'
 *      / 'partial' / 'none'). 'none' is only valid when all per-worker
 *      fringes are zero.
 */
export async function generateWh347(inputs: GenerateInputs): Promise<Wh347Generated> {
  const gaps: Wh347Generated['gaps'] = []
  const out: Wh347Generated['workers'] = []

  for (const w of inputs.workers) {
    if (w.hoursPerDay.length !== 7) {
      gaps.push({ kind: 'hours_shape', detail: `${w.workerName}: hoursPerDay must have 7 entries` })
    }
    const dayTotal = w.hoursPerDay.reduce((s, h) => s + (Number.isFinite(h) ? h : 0), 0)
    const classifiedTotal = w.straightHours + w.overtimeHours + w.doubleTimeHours
    if (Math.abs(dayTotal - classifiedTotal) > 0.01) {
      gaps.push({
        kind: 'day_total_mismatch',
        detail: `${w.workerName}: day-total ${dayTotal.toFixed(2)} ≠ classified ${classifiedTotal.toFixed(2)}`,
      })
    }
    // Missing-day flag: only when a zero-hour day sits BETWEEN two worked days.
    // A normal Mon–Fri 5-day week shouldn't flag Sat/Sun. A worker who took
    // Wednesday off in the middle of the week is the real signal — the
    // compliance officer needs to confirm "yes, they were genuinely off, not
    // a payroll omission."
    const firstWorked = w.hoursPerDay.findIndex(h => h > 0)
    const lastWorked = w.hoursPerDay.length - 1 - [...w.hoursPerDay].reverse().findIndex(h => h > 0)
    if (firstWorked >= 0 && lastWorked > firstWorked) {
      const interiorMissing = w.hoursPerDay
        .map((h, i) => (i > firstWorked && i < lastWorked && h === 0) ? DAY_LABELS[i] : null)
        .filter((d): d is string => !!d)
      if (interiorMissing.length > 0) {
        gaps.push({
          kind: 'missing_day',
          detail: `${w.workerName}: zero hours on ${interiorMissing.join(', ')} (between worked days)`,
        })
      }
    }

    const lookup: WageLookupQuery = {
      stateCode: inputs.header.stateCode,
      county: inputs.header.county,
      trade: w.classification,
      workDate: inputs.header.weekEnding,
      apprenticeLevel: w.apprenticeLevel,
    }
    const found = pickWageDecision(lookup, inputs.decisions)
    if (!found.decision) {
      gaps.push({
        kind: 'no_wage_decision',
        detail: `${w.workerName} (${w.classification}${w.apprenticeLevel ? ` L${w.apprenticeLevel}` : ''}): ${found.matchNote}`,
      })
    }

    let grossPay = 0
    let fringePay = 0
    let rateViolation: typeof out[number]['rateViolation'] = null
    if (found.decision) {
      const totals = computeWeekGross(w.straightHours, w.overtimeHours, w.doubleTimeHours, found.decision)
      grossPay = totals.straight + totals.overtime + totals.doubleTime
      fringePay = totals.fringes
      const v = detectRateViolation(w.hourlyRatePaid, found.decision)
      if (v.violated) {
        rateViolation = { shortBy: v.shortBy, basis: `paid $${w.hourlyRatePaid.toFixed(2)} vs base $${found.decision.base_rate.toFixed(2)}` }
        gaps.push({ kind: 'rate_violation', detail: `${w.workerName}: short by $${v.shortBy.toFixed(2)}/hr` })
      }
    }

    const deductionsTotal = +(w.deductions.reduce((s, d) => s + d.amount, 0)).toFixed(2)
    const netPay = +(grossPay + fringePay - deductionsTotal).toFixed(2)

    // Fringe allocation cross-check
    const totalCashFringe = w.fringePerHourCash * (w.straightHours + w.overtimeHours + w.doubleTimeHours)
    const totalPlanFringe = w.fringePerHourPlan * (w.straightHours + w.overtimeHours + w.doubleTimeHours)
    if (w.fringeAllocation === 'cash' && totalPlanFringe > 0.01) {
      gaps.push({ kind: 'fringe_mismatch', detail: `${w.workerName}: fringeAllocation='cash' but plan fringe is non-zero` })
    }
    if (w.fringeAllocation === 'plan' && totalCashFringe > 0.01) {
      gaps.push({ kind: 'fringe_mismatch', detail: `${w.workerName}: fringeAllocation='plan' but cash fringe is non-zero` })
    }

    out.push({
      ...w,
      decision: found.decision,
      decisionMatchNote: found.matchNote,
      totalHours: +(classifiedTotal).toFixed(2),
      grossPay: +(grossPay).toFixed(2),
      fringePay: +(fringePay).toFixed(2),
      deductionsTotal,
      netPay,
      rateViolation,
    })
  }

  // Statement-level fringe sanity
  const someFringe = out.some(w => w.fringePay > 0)
  if (inputs.statement.fringeBenefits === 'none' && someFringe) {
    gaps.push({ kind: 'fringe_statement', detail: `Statement says 'none' but fringes are non-zero on at least one worker` })
  }

  // Deterministic content hash
  const canonical = JSON.stringify({
    header: inputs.header,
    workers: out.map(w => ({
      workerName: w.workerName, ssnLast4: w.ssnLast4,
      classification: w.classification, apprenticeLevel: w.apprenticeLevel,
      hoursPerDay: w.hoursPerDay,
      straightHours: w.straightHours, overtimeHours: w.overtimeHours, doubleTimeHours: w.doubleTimeHours,
      grossPay: w.grossPay, fringePay: w.fringePay, deductionsTotal: w.deductionsTotal, netPay: w.netPay,
    })),
    statement: inputs.statement,
  })
  const contentHash = await sha256Hex(canonical)

  return {
    header: inputs.header,
    workers: out,
    statement: inputs.statement,
    gaps,
    contentHash,
  }
}
