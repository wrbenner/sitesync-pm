/**
 * COI Expiration Gate — pure helpers for the check-in block.
 *
 * Given a list of insurance certificates and the "today" cursor, decide:
 *   - which certs need a reminder email (14 / 7 / 3 / 1 day before expiration)
 *   - which certs have crossed day 0 and should trigger a check-in block
 *   - whether a particular sub is currently blocked from check-in
 *
 * No I/O. No Supabase. The edge function and React components import these
 * helpers and bring their own data layer. Service-style functions return the
 * project's standard `Result<T>` from `services/errors.ts`.
 */

import { ok, fail, validationError, type Result } from '../../services/errors'

export const REMINDER_THRESHOLDS = [14, 7, 3, 1] as const
export type ReminderThreshold = (typeof REMINDER_THRESHOLDS)[number]

export interface CoiCert {
  id: string
  company: string
  policy_type: string | null
  expiration_date: string | null
  effective_date: string | null
  verified: boolean
  reminder_thresholds_sent?: number[] | null
  project_id?: string | null
  subcontractor_id?: string | null
}

export interface CoiBlockRow {
  id: string
  project_id: string
  subcontractor_id: string | null
  insurance_certificate_id: string | null
  company_name: string
  expired_on: string
  overridden_at: string | null
  override_reason: string | null
  block_until: string | null
}

export interface ReminderDecision {
  cert: CoiCert
  threshold: ReminderThreshold
  daysUntilExpiry: number
}

export interface BlockDecision {
  cert: CoiCert
  daysUntilExpiry: number
}

// ── Date helpers ─────────────────────────────────────────────────────

/** Whole-day diff: cert expiry − today (UTC midnight). */
export function daysUntil(expirationDate: string, now: Date): number {
  const t = new Date(expirationDate).getTime()
  if (!Number.isFinite(t)) return Number.NaN
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).getTime()
  return Math.ceil((t - today) / (1000 * 60 * 60 * 24))
}

/** Lowest threshold that should fire for this cert today. */
export function pickThreshold(
  cert: CoiCert,
  now: Date,
): ReminderThreshold | null {
  if (!cert.expiration_date) return null
  const days = daysUntil(cert.expiration_date, now)
  if (!Number.isFinite(days) || days <= 0 || days > REMINDER_THRESHOLDS[0]) {
    return null
  }
  const sent = cert.reminder_thresholds_sent ?? []
  // Choose the largest threshold ≥ daysUntilExpiry that we haven't sent yet.
  // 14 fires when days ≤ 14, 7 when ≤ 7, etc. We send the *highest* threshold
  // we still owe so the email severity steps up over time.
  for (const t of REMINDER_THRESHOLDS) {
    if (days <= t && !sent.includes(t)) return t
  }
  return null
}

// ── Decision functions ──────────────────────────────────────────────

/**
 * Walk a batch of certs and return the reminders to send right now.
 * Caller is responsible for actually sending the email + recording the
 * threshold in `reminder_thresholds_sent`.
 */
export function decideReminders(
  certs: CoiCert[],
  now: Date,
): ReminderDecision[] {
  const out: ReminderDecision[] = []
  for (const cert of certs) {
    if (!cert.verified) continue
    if (!cert.expiration_date) continue
    const threshold = pickThreshold(cert, now)
    if (!threshold) continue
    out.push({
      cert,
      threshold,
      daysUntilExpiry: daysUntil(cert.expiration_date, now),
    })
  }
  return out
}

/**
 * Certs whose expiration_date is on or before today — these need a
 * coi_check_in_block row (if one doesn't exist already, deduped upstream).
 */
export function decideBlocks(certs: CoiCert[], now: Date): BlockDecision[] {
  const out: BlockDecision[] = []
  for (const cert of certs) {
    if (!cert.expiration_date) continue
    const days = daysUntil(cert.expiration_date, now)
    if (!Number.isFinite(days)) continue
    if (days <= 0) out.push({ cert, daysUntilExpiry: days })
  }
  return out
}

// ── Block evaluation (UI side) ──────────────────────────────────────

/**
 * Is this sub currently blocked from checking crew in?
 * A block is "active" when it has no override AND no `block_until` in the past.
 */
export function isSubBlocked(
  blocks: CoiBlockRow[],
  opts: { subcontractorId?: string | null; companyName?: string | null },
  now: Date,
): CoiBlockRow | null {
  const subId = opts.subcontractorId ?? null
  const company = (opts.companyName ?? '').trim().toLowerCase()
  const nowMs = now.getTime()

  for (const b of blocks) {
    if (b.overridden_at) continue
    if (b.block_until && new Date(b.block_until).getTime() < nowMs) continue
    const subMatch = subId !== null && b.subcontractor_id === subId
    const nameMatch =
      !subMatch && company.length > 0 &&
      b.company_name.trim().toLowerCase() === company
    if (subMatch || nameMatch) return b
  }
  return null
}

// ── Validation helpers (Result<T>) ──────────────────────────────────

/**
 * Server-side guard before stamping an override. Reasons must be a real
 * sentence — discourages "ok" / "asdf" overrides. Mirrors the migration's
 * CHECK constraint so we fail at the service layer with a friendly message.
 */
export function validateOverrideReason(reason: string): Result<string> {
  const trimmed = reason.trim()
  if (trimmed.length < 12) {
    return fail(
      validationError(
        'Override reason must be at least 12 characters — explain why you are letting this crew check in.',
        { length: trimmed.length },
      ),
    )
  }
  return ok(trimmed)
}
