// =============================================================================
// WH-347 — DOL Statement of Compliance / Certified Payroll types
// =============================================================================
// Form spec: https://www.dol.gov/agencies/whd/government-contracts/construction/forms
// One row per worker per week per project, plus a Statement of Compliance
// signed by the contractor's authorized signatory.
//
// The DOL accepts the WH-347 in any format that contains all required
// information, but their reviewers are trained on the printed form layout.
// We render to that layout 1:1 — see wh347/render.ts.
// =============================================================================

import type { PrevailingWageDecisionRow } from '../prevailingWage'

export interface Wh347Header {
  contractorName: string
  contractorAddress: string
  /** GC's payroll number for the week — sequential, 1-indexed. */
  payrollNumber: number
  weekEnding: string             // ISO date, end of week (typically Saturday)
  projectName: string
  projectLocation: string
  projectNumber: string | null   // contract or project number assigned by federal agency
  /** State + county determine which prevailing wage decisions apply. */
  stateCode: string
  county: string
}

export interface Wh347WorkerWeek {
  /** Print name. SSN last 4 only — full SSN is no longer required on WH-347. */
  workerName: string
  ssnLast4: string | null
  /** Trade / classification matched against prevailing_wage_decisions.trade.
   *  Apprentice classification level (1-N) goes in apprenticeLevel; null
   *  means journeyman. */
  classification: string
  apprenticeLevel: number | null

  /** Hours worked per day. The DOL form has 7 columns S-S; we order
   *  Mon..Sun so most US payroll matches naturally. */
  hoursPerDay: number[]          // length 7
  /** Hours classified as straight, OT, double-time. The classifier is
   *  upstream — by the time a row reaches the renderer these are fixed. */
  straightHours: number
  overtimeHours: number
  doubleTimeHours: number

  /** Hourly rate actually paid (gross), used for rate-violation detection. */
  hourlyRatePaid: number

  /** Fringe allocation: 'cash' (paid directly to worker) or 'plan'
   *  (contributions to bona fide plan). The form has separate columns. */
  fringeAllocation: 'cash' | 'plan' | 'mixed'
  fringePerHourCash: number      // when 'cash' or 'mixed'
  fringePerHourPlan: number      // when 'plan' or 'mixed'

  /** Pre-tax deductions reported on the form (FICA, federal/state withholding,
   *  health insurance, garnishment, ...). Each labeled. */
  deductions: Array<{ label: string; amount: number }>

  /** Net pay = gross - sum(deductions). Computed; not user-entered. */
  // (computed in render)
}

export interface Wh347Statement {
  /** Statement of Compliance — Page 2 of the DOL form. */
  signerName: string
  signerTitle: string
  /** Whether the certifying official is signing on behalf of the firm itself
   *  or as a payroll service. */
  payerType: 'contractor' | 'subcontractor'
  /** Period covered by this Statement of Compliance — typically matches
   *  the header's week ending. */
  periodFrom: string
  periodTo: string
  /** Boxed-checks on Page 2 of the form. The renderer enforces that
   *  exactly one of (cashFringes / planFringes) is checked at the
   *  Statement level when fringes are paid; both can be unchecked when
   *  fringes are entirely zero. */
  fringeBenefits: 'paid_to_plans' | 'paid_in_cash' | 'partial' | 'none'
  /** Itemized exception explanations referenced in Section 4 of the form. */
  exceptions: Array<{ classification: string; explanation: string }>
}

export interface Wh347Generated {
  header: Wh347Header
  /** All workers for this week. */
  workers: Array<Wh347WorkerWeek & {
    /** Joined-in by the generator from prevailing_wage_decisions. */
    decision: PrevailingWageDecisionRow | null
    /** Lookup match note (from prevailingWage.pickWageDecision). */
    decisionMatchNote: string
    /** Computed totals. */
    totalHours: number
    grossPay: number
    fringePay: number
    deductionsTotal: number
    netPay: number
    /** Filled in only when the generator detects a violation. The form
     *  rejects-with-reason rather than silently filing rate-low rows. */
    rateViolation: { shortBy: number; basis: string } | null
  }>
  statement: Wh347Statement
  /** Gaps detected before generation (missed days, missing classifications,
   *  rate violations). The compliance officer must explicitly accept these
   *  before the form is final. */
  gaps: Array<{ kind: string; detail: string }>
  /** Deterministic hash of all form bytes so the same week always renders
   *  to the same hash — useful for "this is the same form I generated last
   *  Tuesday" checks. */
  contentHash: string
}
