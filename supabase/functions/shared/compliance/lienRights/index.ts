// DO NOT EDIT IN PLACE — duplicated from src/lib/compliance/lienRights/index.ts

// =============================================================================
// State-aware lien rights — deadline calculator
// =============================================================================
// Reads from `state_lien_rules` (single table, not 50 files). The framework
// never branches per state — state-specific quirks live as data on the row.
//
// Two questions this answers:
//   1. "When is the preliminary notice deadline for sub X on project Y?"
//      → first_day_of_work + preliminary_notice_days
//   2. "When is the lien-record deadline for sub X?"
//      → last_day_of_work + lien_record_days
//
// The watcher edge function fires alerts at 7 / 3 / 1 days before each
// deadline. Calculation is pure — call site is responsible for fetching
// the rule row and the project's first/last day of work.
// =============================================================================

export interface StateLienRule {
  id: string
  state_code: string
  claimant_role: 'general_contractor' | 'first_tier_sub' | 'second_tier_sub' | 'supplier' | 'laborer'
  preliminary_notice_days: number | null
  lien_record_days: number
  foreclosure_suit_days: number | null
  owner_demand_days: number | null
  applies_to_residential: boolean
  applies_to_commercial: boolean
  statute_citation: string | null
  notes: string | null
  effective_from: string
  effective_to: string | null
}

export interface DeadlineQuery {
  stateCode: string
  claimantRole: StateLienRule['claimant_role']
  /** ISO date — when the claimant first worked on the project. Drives the
   *  preliminary notice calculation. */
  firstDayOfWork: string | null
  /** ISO date — when the claimant last worked. Drives the lien-record
   *  deadline. Null when work is still ongoing; deadlines come into play
   *  only after demobilization. */
  lastDayOfWork: string | null
  /** Project property type — picks the right rule when residential and
   *  commercial differ. Defaults to 'commercial'. */
  propertyType?: 'residential' | 'commercial'
  /** ISO date for effective-date scoping. Defaults to today (UTC). */
  asOf?: string
}

export interface DeadlineResult {
  rule: StateLienRule | null
  preliminaryNoticeDeadline: string | null
  lienRecordDeadline: string | null
  foreclosureSuitDeadline: string | null
  /** When the rule lookup or calculation needs human intervention. */
  warnings: string[]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Pick the active rule for (state, role) on a given date, scoped to property
 * type. Effective-dated; returns the latest effective_from row whose window
 * contains asOf.
 */
export function pickRule(
  query: DeadlineQuery,
  rules: StateLienRule[],
): StateLienRule | null {
  const asOf = query.asOf ?? new Date().toISOString().slice(0, 10)
  const propertyType = query.propertyType ?? 'commercial'
  const matches = rules.filter(r => {
    if (r.state_code !== query.stateCode) return false
    if (r.claimant_role !== query.claimantRole) return false
    if (r.effective_from > asOf) return false
    if (r.effective_to && r.effective_to <= asOf) return false
    if (propertyType === 'residential' && !r.applies_to_residential) return false
    if (propertyType === 'commercial' && !r.applies_to_commercial) return false
    return true
  })
  matches.sort((a, b) => b.effective_from.localeCompare(a.effective_from))
  return matches[0] ?? null
}

/** Compute preliminary notice + lien record + foreclosure deadlines. */
export function computeDeadlines(
  query: DeadlineQuery,
  rules: StateLienRule[],
): DeadlineResult {
  const rule = pickRule(query, rules)
  const warnings: string[] = []
  if (!rule) {
    return {
      rule: null,
      preliminaryNoticeDeadline: null,
      lienRecordDeadline: null,
      foreclosureSuitDeadline: null,
      warnings: [`No active lien rule for ${query.stateCode}/${query.claimantRole}`],
    }
  }

  let prelim: string | null = null
  if (rule.preliminary_notice_days != null) {
    if (!query.firstDayOfWork) {
      warnings.push('preliminary_notice_days requires firstDayOfWork')
    } else {
      prelim = addDays(query.firstDayOfWork, rule.preliminary_notice_days)
    }
  }

  let lien: string | null = null
  if (query.lastDayOfWork) {
    lien = addDays(query.lastDayOfWork, rule.lien_record_days)
  } else {
    warnings.push('lien_record_deadline computes off lastDayOfWork; still on the job')
  }

  let foreclosure: string | null = null
  if (rule.foreclosure_suit_days != null && lien) {
    foreclosure = addDays(lien, rule.foreclosure_suit_days)
  }

  return {
    rule,
    preliminaryNoticeDeadline: prelim,
    lienRecordDeadline: lien,
    foreclosureSuitDeadline: foreclosure,
    warnings,
  }
}

/** "Days until deadline" — negative when overdue. */
export function daysUntil(deadlineIso: string, asOfIso?: string): number {
  const asOf = asOfIso ?? new Date().toISOString().slice(0, 10)
  const a = new Date(asOf).getTime()
  const b = new Date(deadlineIso).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

/** Alert tier for surfacing — drives badge color in the UI. */
export type AlertTier = 'overdue' | 'today' | 'one_day' | 'three_days' | 'seven_days' | 'safe'

export function alertTier(deadlineIso: string, asOfIso?: string): AlertTier {
  const days = daysUntil(deadlineIso, asOfIso)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 1) return 'one_day'
  if (days <= 3) return 'three_days'
  if (days <= 7) return 'seven_days'
  return 'safe'
}
