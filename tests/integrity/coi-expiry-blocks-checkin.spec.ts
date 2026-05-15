/**
 * FMEA B.COI.1 (Wave 4) — Expired COI doesn't block check-in
 *
 * Hazard: a subcontractor's insurance certificate expires on day 0.
 *         The expiration gate is expected to:
 *           (a) compute `daysUntil(expiration_date, now) ≤ 0` — block
 *               eligible.
 *           (b) insert a `coi_check_in_block` row (deduped on
 *               (project_id, subcontractor_id)).
 *           (c) `isSubBlocked(blocks, {subId}, now)` returns the block
 *               so check-in UI refuses.
 *
 *         Failure modes:
 *           - daysUntil uses local-time math → off-by-one across DST.
 *           - decideBlocks excludes day-0 (uses `< 0` instead of `≤ 0`).
 *           - isSubBlocked silently treats `block_until = null` as
 *             "no longer active" → expired COI lapses out of block.
 *           - Override-by-companyName collision (two subs with same
 *             trading-name).
 *
 *         All of these become "check-in goes through anyway" — a
 *         legal/regulatory hazard on jobsites that require active COI.
 */
import { describe, it, expect } from 'vitest'
import {
  daysUntil,
  decideBlocks,
  isSubBlocked,
  type CoiCert,
  type CoiBlockRow,
} from '../../src/lib/coi/expirationGate'

const fixedNow = new Date('2026-05-14T12:00:00.000Z')

function cert(over: Partial<CoiCert> = {}): CoiCert {
  return {
    id: 'cert-1',
    company: 'ACME Plumbing LLC',
    policy_type: 'general_liability',
    expiration_date: '2026-05-14',
    effective_date: '2025-05-14',
    verified: true,
    reminder_thresholds_sent: [14, 7, 3, 1],
    project_id: 'proj-1',
    subcontractor_id: 'sub-1',
    ...over,
  }
}

function block(over: Partial<CoiBlockRow> = {}): CoiBlockRow {
  return {
    id: 'block-1',
    project_id: 'proj-1',
    subcontractor_id: 'sub-1',
    insurance_certificate_id: 'cert-1',
    company_name: 'ACME Plumbing LLC',
    expired_on: '2026-05-14',
    overridden_at: null,
    override_reason: null,
    block_until: null,
    ...over,
  }
}

describe('FMEA B.COI.1 — expired COI blocks check-in', () => {
  it('daysUntil computes a day-0 expiration as ≤ 0 (not 1, not NaN)', () => {
    // The bug pattern: comparing fractional days with `Math.floor` on
    // a today-noon-vs-expiration-midnight delta returns 0 for
    // same-day, which then trips a `> 0` block. We need ≤ 0.
    const days = daysUntil('2026-05-14', fixedNow)
    expect(days).toBeLessThanOrEqual(0)
  })

  it('decideBlocks INCLUDES day-0 expirations (the headline boundary)', () => {
    const blocks = decideBlocks([cert({ expiration_date: '2026-05-14' })], fixedNow)
    expect(blocks.length).toBe(1)
    expect(blocks[0].cert.id).toBe('cert-1')
  })

  it('decideBlocks INCLUDES expired-yesterday certs', () => {
    const blocks = decideBlocks([cert({ expiration_date: '2026-05-13' })], fixedNow)
    expect(blocks.length).toBe(1)
  })

  it('decideBlocks EXCLUDES tomorrow expirations (not yet expired)', () => {
    const blocks = decideBlocks([cert({ expiration_date: '2026-05-15' })], fixedNow)
    expect(blocks.length).toBe(0)
  })

  it('isSubBlocked: active block by subcontractor_id refuses check-in', () => {
    const result = isSubBlocked([block()], { subcontractorId: 'sub-1' }, fixedNow)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('block-1')
  })

  it('isSubBlocked: block with overridden_at is treated as inactive (check-in allowed)', () => {
    const result = isSubBlocked(
      [block({ overridden_at: '2026-05-14T11:30:00.000Z', override_reason: 'PM verified COI via email; cert renewed 2026-05-15 — file pending' })],
      { subcontractorId: 'sub-1' },
      fixedNow,
    )
    expect(result).toBeNull()
  })

  it('isSubBlocked: block_until in the past is treated as inactive', () => {
    const result = isSubBlocked(
      [block({ block_until: '2026-05-13T00:00:00.000Z' })],
      { subcontractorId: 'sub-1' },
      fixedNow,
    )
    expect(result).toBeNull()
  })

  it('isSubBlocked: block_until in the future keeps the block active', () => {
    const result = isSubBlocked(
      [block({ block_until: '2026-05-20T00:00:00.000Z' })],
      { subcontractorId: 'sub-1' },
      fixedNow,
    )
    expect(result).not.toBeNull()
  })

  it('isSubBlocked: companyName fallback when subcontractor_id is null on the block', () => {
    // The hazard: subcontractor_id is nullable on coi_check_in_block
    // (legacy data). The function falls back to companyName match.
    const result = isSubBlocked(
      [block({ subcontractor_id: null })],
      { subcontractorId: null, companyName: 'ACME Plumbing LLC' },
      fixedNow,
    )
    expect(result).not.toBeNull()
  })

  it('isSubBlocked: companyName fallback is case-insensitive (trading-name variance)', () => {
    const result = isSubBlocked(
      [block({ subcontractor_id: null, company_name: 'ACME Plumbing LLC' })],
      { subcontractorId: null, companyName: 'acme plumbing llc' },
      fixedNow,
    )
    expect(result).not.toBeNull()
  })

  it('isSubBlocked: no match when neither subId nor companyName matches', () => {
    const result = isSubBlocked(
      [block()],
      { subcontractorId: 'sub-2', companyName: 'Other LLC' },
      fixedNow,
    )
    expect(result).toBeNull()
  })

  it('isSubBlocked: empty blocks list returns null (sanity)', () => {
    expect(isSubBlocked([], { subcontractorId: 'sub-1' }, fixedNow)).toBeNull()
  })

  it('end-to-end: cert expired → decideBlocks produces a row that, once persisted, isSubBlocked returns', () => {
    // The full path: a cron job calls decideBlocks → inserts a
    // coi_check_in_block row → the UI calls isSubBlocked at
    // check-in time and gets the block. This composes the two
    // pure functions to confirm the contract works end-to-end.
    const certs = [cert({ expiration_date: '2026-05-10', subcontractor_id: 'sub-7' })]
    const decisions = decideBlocks(certs, fixedNow)
    expect(decisions.length).toBe(1)

    // Persist the equivalent row.
    const persistedBlock: CoiBlockRow = {
      id: 'block-99',
      project_id: 'proj-1',
      subcontractor_id: decisions[0].cert.subcontractor_id ?? null,
      insurance_certificate_id: decisions[0].cert.id,
      company_name: decisions[0].cert.company,
      expired_on: decisions[0].cert.expiration_date!,
      overridden_at: null,
      override_reason: null,
      block_until: null,
    }

    const checkInResult = isSubBlocked([persistedBlock], { subcontractorId: 'sub-7' }, fixedNow)
    expect(checkInResult).not.toBeNull()
    expect(checkInResult?.id).toBe('block-99')
  })
})
