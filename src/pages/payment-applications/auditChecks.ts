/**
 * Pre-Submission Audit Checks
 *
 * Pure functional audit ruleset for the AIA G702/G703 pay-app submission gate.
 * Every rule returns a typed `CheckResult` with a stable id, status, optional
 * detail, and (when applicable) a deep-link string the UI uses to jump the user
 * to the exact fix.
 *
 * The rules in this file are *pure* — they take immutable input and return
 * deterministic output. No I/O, no Supabase, no React. Tests live in
 * `__tests__/auditChecks.test.ts`.
 *
 * The story this prevents: GC submits Pay App #6 for $412k. Owner rejects 3
 * days later — two subs missing lien waivers, one's COI expired mid-period.
 * Run these checks before "Submit to Owner" enables. ✗ → grey button.
 */

// ── Input Shapes ──────────────────────────────────────────────────────

/** Subset of payment_applications row needed for audit. */
export interface AuditPayApp {
  id: string
  application_number: number
  period_to: string // ISO date
  period_from?: string | null
  original_contract_sum: number
  net_change_orders: number
  total_completed_and_stored: number
  retainage_percent: number
  retainage_amount: number
  less_previous_certificates: number
  current_payment_due: number
}

/** Subset of payment_line_items needed for audit. */
export interface AuditLineItem {
  id: string
  item_number: string
  description: string
  scheduled_value: number
  previous_completed: number
  this_period: number
  materials_stored: number
  percent_complete: number
}

/** Subset of lien_waivers row + the contractor we matched it to. */
export interface AuditLienWaiver {
  id: string
  contractor_name: string
  application_id: string | null
  amount: number
  status: 'pending' | 'conditional' | 'unconditional' | 'final' | 'waived'
  through_date: string // ISO date
}

/** Subset of insurance_certificates row. */
export interface AuditInsurance {
  id: string
  company: string
  policy_type: string | null
  expiration_date: string | null // ISO date
  effective_date: string | null // ISO date
  verified: boolean
}

/**
 * A subcontractor with billed work this period. Derived upstream from the
 * line-item cost-codes joined to a contracts table — we accept it pre-baked
 * to keep this module pure.
 */
export interface AuditPeriodContractor {
  /** Stable id for matching to lien waivers / insurance — usually a sub_id. */
  contractor_id: string | null
  contractor_name: string
  /** Total $ billed by this contractor on this pay app. */
  billed_amount_this_period: number
}

export interface AuditInput {
  payApp: AuditPayApp
  lineItems: AuditLineItem[]
  /** Lien waivers matched to this pay app (any status). */
  waivers: AuditLienWaiver[]
  /** All COI rows we should check for the period. */
  insurance: AuditInsurance[]
  /** Subs with billed work this period (post-aggregation). */
  contractorsThisPeriod: AuditPeriodContractor[]
}

// ── Output Shapes ─────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip'

/** Stable id for each rule. The UI maps these to fix-link routes. */
export type CheckId =
  | 'lien_waivers_present'
  | 'coi_active_for_period'
  | 'g702_g703_reconcile'
  | 'sov_percent_under_100'
  | 'retainage_math_correct'

export interface CheckResult {
  id: CheckId
  /** Human-readable label for the row. */
  label: string
  status: CheckStatus
  /** Short explanation of why it failed (or passed). Optional. */
  detail?: string
  /** Suggested URL/route the UI should deep-link to for the fix. */
  fix_link?: string
  /** Machine-readable evidence that drove the decision. */
  evidence?: Record<string, unknown>
}

export interface AuditSummary {
  status: 'pass' | 'warn' | 'fail'
  total: number
  passed: number
  warned: number
  failed: number
  results: CheckResult[]
  /** True iff every result is `pass` — i.e. submit is safe. */
  canSubmit: boolean
  /** Stable, comma-separated list of failed-check ids — used for override audit. */
  failedCheckIds: CheckId[]
}

// ── Tolerances ────────────────────────────────────────────────────────

/** $1 reconciliation tolerance — penny-rounding of generated columns. */
const RECONCILE_TOLERANCE = 1

/** % rounding tolerance for SOV percent_complete. */
const PERCENT_TOLERANCE = 0.5

/** Retainage tolerance — generated columns sometimes drift by < $1. */
const RETAINAGE_TOLERANCE = 1

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Match a contractor record to a waiver record by name (case-insensitive,
 * trimmed). We accept either an exact match OR a substring match in either
 * direction — sub data entry is messy.
 */
export function namesMatch(a: string, b: string): boolean {
  const an = a.trim().toLowerCase()
  const bn = b.trim().toLowerCase()
  if (!an || !bn) return false
  if (an === bn) return true
  return an.includes(bn) || bn.includes(an)
}

/** ISO date → time, or NaN if invalid. */
function parseDate(d: string | null | undefined): number {
  if (!d) return Number.NaN
  const t = new Date(d).getTime()
  return Number.isFinite(t) ? t : Number.NaN
}

// ── Individual Rules ──────────────────────────────────────────────────

export function checkLienWaivers(input: AuditInput): CheckResult {
  const missing: string[] = []
  for (const c of input.contractorsThisPeriod) {
    if (c.billed_amount_this_period <= 0) continue
    const hasWaiver = input.waivers.some(
      (w) =>
        namesMatch(w.contractor_name, c.contractor_name) &&
        w.status !== 'pending', // pending = sent but not signed = doesn't count
    )
    if (!hasWaiver) missing.push(c.contractor_name)
  }
  if (missing.length === 0) {
    return {
      id: 'lien_waivers_present',
      label: 'Lien waiver from every sub with billed work',
      status: 'pass',
    }
  }
  return {
    id: 'lien_waivers_present',
    label: 'Lien waiver from every sub with billed work',
    status: 'fail',
    detail: `${missing.length} sub${missing.length === 1 ? '' : 's'} missing waiver: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
    fix_link: `/payment-applications?tab=lien_waivers&app=${input.payApp.id}`,
    evidence: { missing_contractors: missing },
  }
}

export function checkCoiCoverage(input: AuditInput): CheckResult {
  const periodEnd = parseDate(input.payApp.period_to)
  const periodStart = input.payApp.period_from
    ? parseDate(input.payApp.period_from)
    : Number.NEGATIVE_INFINITY

  const expiredOrUnverified: string[] = []
  for (const c of input.contractorsThisPeriod) {
    if (c.billed_amount_this_period <= 0) continue
    const certs = input.insurance.filter((i) =>
      namesMatch(i.company, c.contractor_name),
    )
    if (certs.length === 0) {
      expiredOrUnverified.push(`${c.contractor_name} (no COI)`)
      continue
    }
    // Need at least one verified cert active for the entire period.
    const covered = certs.some((cert) => {
      if (!cert.verified) return false
      const exp = parseDate(cert.expiration_date)
      const eff = parseDate(cert.effective_date)
      if (Number.isNaN(exp) || Number.isNaN(periodEnd)) return false
      const effOk = Number.isNaN(eff) || eff <= periodStart
      return effOk && exp >= periodEnd
    })
    if (!covered) expiredOrUnverified.push(c.contractor_name)
  }

  if (expiredOrUnverified.length === 0) {
    return {
      id: 'coi_active_for_period',
      label: 'COI active for every sub for the entire period',
      status: 'pass',
    }
  }
  return {
    id: 'coi_active_for_period',
    label: 'COI active for every sub for the entire period',
    status: 'fail',
    detail: `${expiredOrUnverified.length} sub${expiredOrUnverified.length === 1 ? '' : 's'} with COI gap: ${expiredOrUnverified.slice(0, 3).join(', ')}${expiredOrUnverified.length > 3 ? '…' : ''}`,
    fix_link: `/insurance?app=${input.payApp.id}`,
    evidence: { uncovered_contractors: expiredOrUnverified },
  }
}

export function checkG702G703Reconcile(input: AuditInput): CheckResult {
  const lineSum = input.lineItems.reduce(
    (s, li) =>
      s + (li.previous_completed + li.this_period + li.materials_stored),
    0,
  )
  const headerTotal = input.payApp.total_completed_and_stored
  const drift = Math.abs(lineSum - headerTotal)
  if (drift <= RECONCILE_TOLERANCE) {
    return {
      id: 'g702_g703_reconcile',
      label: 'G702 / G703 totals reconcile',
      status: 'pass',
    }
  }
  return {
    id: 'g702_g703_reconcile',
    label: 'G702 / G703 totals reconcile',
    status: 'fail',
    detail: `Line-item sum ($${lineSum.toFixed(2)}) ≠ header total ($${headerTotal.toFixed(2)}). Difference $${drift.toFixed(2)}.`,
    fix_link: `/payment-applications?app=${input.payApp.id}&edit=g703`,
    evidence: { lineSum, headerTotal, drift },
  }
}

export function checkSovPercents(input: AuditInput): CheckResult {
  const overruns: string[] = []
  for (const li of input.lineItems) {
    if (li.scheduled_value <= 0) continue
    const billed = li.previous_completed + li.this_period + li.materials_stored
    const pct = (billed / li.scheduled_value) * 100
    if (pct > 100 + PERCENT_TOLERANCE) {
      overruns.push(`#${li.item_number} ${li.description} (${pct.toFixed(1)}%)`)
    }
  }
  if (overruns.length === 0) {
    return {
      id: 'sov_percent_under_100',
      label: 'No SOV line bills over 100%',
      status: 'pass',
    }
  }
  return {
    id: 'sov_percent_under_100',
    label: 'No SOV line bills over 100%',
    status: 'fail',
    detail: `${overruns.length} line${overruns.length === 1 ? '' : 's'} over 100%: ${overruns.slice(0, 2).join(', ')}${overruns.length > 2 ? '…' : ''}`,
    fix_link: `/payment-applications?app=${input.payApp.id}&edit=g703`,
    evidence: { overrun_lines: overruns },
  }
}

export function checkRetainageMath(input: AuditInput): CheckResult {
  const expected =
    input.payApp.total_completed_and_stored *
    (input.payApp.retainage_percent / 100)
  const drift = Math.abs(expected - input.payApp.retainage_amount)
  if (drift <= RETAINAGE_TOLERANCE) {
    return {
      id: 'retainage_math_correct',
      label: 'Retainage math reconciles',
      status: 'pass',
    }
  }
  return {
    id: 'retainage_math_correct',
    label: 'Retainage math reconciles',
    status: 'fail',
    detail: `Expected retainage $${expected.toFixed(2)} but row says $${input.payApp.retainage_amount.toFixed(2)} (off by $${drift.toFixed(2)}).`,
    fix_link: `/payment-applications?app=${input.payApp.id}&edit=g702`,
    evidence: {
      expected,
      actual: input.payApp.retainage_amount,
      retainage_percent: input.payApp.retainage_percent,
    },
  }
}

// ── Aggregate ─────────────────────────────────────────────────────────

export function runAudit(input: AuditInput): AuditSummary {
  const results: CheckResult[] = [
    checkLienWaivers(input),
    checkCoiCoverage(input),
    checkG702G703Reconcile(input),
    checkSovPercents(input),
    checkRetainageMath(input),
  ]

  const failed = results.filter((r) => r.status === 'fail')
  const warned = results.filter((r) => r.status === 'warn')
  const passed = results.filter((r) => r.status === 'pass')

  const status: AuditSummary['status'] =
    failed.length > 0 ? 'fail' : warned.length > 0 ? 'warn' : 'pass'

  return {
    status,
    total: results.length,
    passed: passed.length,
    warned: warned.length,
    failed: failed.length,
    results,
    canSubmit: failed.length === 0,
    failedCheckIds: failed.map((f) => f.id),
  }
}
