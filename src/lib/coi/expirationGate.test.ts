import { describe, it, expect } from 'vitest'
import {
  REMINDER_THRESHOLDS,
  daysUntil,
  pickThreshold,
  decideReminders,
  decideBlocks,
  isSubBlocked,
  validateOverrideReason,
  type CoiCert,
  type CoiBlockRow,
} from './expirationGate'

const NOW = new Date('2026-05-01T12:00:00Z')

const cert = (over: Partial<CoiCert> = {}): CoiCert => ({
  id: 'c1',
  company: 'Acme Sub',
  policy_type: 'GL',
  expiration_date: '2026-05-15',
  effective_date: '2025-05-15',
  verified: true,
  reminder_thresholds_sent: [],
  ...over,
})

describe('REMINDER_THRESHOLDS', () => {
  it('is the expected descending tuple', () => {
    expect(REMINDER_THRESHOLDS).toEqual([14, 7, 3, 1])
  })
})

describe('daysUntil', () => {
  it('counts forward days', () => {
    expect(daysUntil('2026-05-15', NOW)).toBe(14)
  })

  it('returns 0 for the same UTC day', () => {
    expect(daysUntil('2026-05-01', NOW)).toBe(0)
  })

  it('returns negative values for past expirations', () => {
    expect(daysUntil('2026-04-25', NOW)).toBe(-6)
  })

  it('returns NaN for an unparseable date', () => {
    expect(daysUntil('garbage', NOW)).toBeNaN()
  })
})

describe('pickThreshold', () => {
  // Per source comment: returns the *highest* unsent threshold ≥ daysUntilExpiry,
  // so severity steps up as previous thresholds are recorded as sent.
  it('picks 14 when expiry is exactly 14 days out', () => {
    expect(pickThreshold(cert({ expiration_date: '2026-05-15' }), NOW)).toBe(14)
  })

  it('still picks 14 at 7 days out when 14 has not been sent', () => {
    expect(pickThreshold(cert({ expiration_date: '2026-05-08' }), NOW)).toBe(14)
  })

  it('steps down to 7 once 14 has been sent and ≤7 days remain', () => {
    expect(
      pickThreshold(
        cert({ expiration_date: '2026-05-08', reminder_thresholds_sent: [14] }),
        NOW,
      ),
    ).toBe(7)
  })

  it('steps down to 3 once 14+7 have been sent and ≤3 days remain', () => {
    expect(
      pickThreshold(
        cert({ expiration_date: '2026-05-04', reminder_thresholds_sent: [14, 7] }),
        NOW,
      ),
    ).toBe(3)
  })

  it('steps down to 1 once 14+7+3 have been sent and ≤1 day remains', () => {
    expect(
      pickThreshold(
        cert({ expiration_date: '2026-05-02', reminder_thresholds_sent: [14, 7, 3] }),
        NOW,
      ),
    ).toBe(1)
  })

  it('returns null past the day-of (expired)', () => {
    expect(pickThreshold(cert({ expiration_date: '2026-05-01' }), NOW)).toBeNull()
    expect(pickThreshold(cert({ expiration_date: '2026-04-30' }), NOW)).toBeNull()
  })

  it('returns null when more than 14 days remain', () => {
    expect(pickThreshold(cert({ expiration_date: '2026-05-20' }), NOW)).toBeNull()
  })

  it('returns null when no expiration_date is set', () => {
    expect(pickThreshold(cert({ expiration_date: null }), NOW)).toBeNull()
  })

  it('skips a threshold that has already been sent', () => {
    expect(
      pickThreshold(
        cert({ expiration_date: '2026-05-15', reminder_thresholds_sent: [14] }),
        NOW,
      ),
    ).toBeNull()
  })

  it('falls through to a smaller un-sent threshold', () => {
    // 14d out, 14 already sent — 7/3/1 still future, none should fire yet
    expect(
      pickThreshold(
        cert({ expiration_date: '2026-05-15', reminder_thresholds_sent: [14] }),
        NOW,
      ),
    ).toBeNull()
  })
})

describe('decideReminders', () => {
  it('skips unverified certs', () => {
    expect(
      decideReminders(
        [cert({ id: 'a', verified: false, expiration_date: '2026-05-08' })],
        NOW,
      ),
    ).toEqual([])
  })

  it('skips certs without expiration', () => {
    expect(
      decideReminders([cert({ expiration_date: null })], NOW),
    ).toEqual([])
  })

  it('returns a decision per actionable cert', () => {
    const decisions = decideReminders(
      [
        cert({ id: 'a', expiration_date: '2026-05-08' }),
        cert({ id: 'b', expiration_date: '2026-05-15' }),
        cert({ id: 'c', expiration_date: '2026-04-20' }),
        cert({ id: 'd', expiration_date: '2026-06-30' }),
      ],
      NOW,
    )
    expect(decisions.map((d) => d.cert.id).sort()).toEqual(['a', 'b'])
    // Both fire at the highest unsent threshold (14), regardless of exact days.
    expect(decisions.find((d) => d.cert.id === 'a')!.threshold).toBe(14)
    expect(decisions.find((d) => d.cert.id === 'b')!.threshold).toBe(14)
  })
})

describe('decideBlocks', () => {
  it('returns certs whose expiry is on or before today', () => {
    const blocks = decideBlocks(
      [
        cert({ id: 'past', expiration_date: '2026-04-29' }),
        cert({ id: 'today', expiration_date: '2026-05-01' }),
        cert({ id: 'future', expiration_date: '2026-05-10' }),
      ],
      NOW,
    )
    expect(blocks.map((b) => b.cert.id).sort()).toEqual(['past', 'today'])
  })

  it('skips certs with no expiration', () => {
    expect(decideBlocks([cert({ expiration_date: null })], NOW)).toEqual([])
  })

  it('skips certs with unparseable expiration', () => {
    expect(decideBlocks([cert({ expiration_date: 'invalid' })], NOW)).toEqual([])
  })
})

describe('isSubBlocked', () => {
  const block = (over: Partial<CoiBlockRow> = {}): CoiBlockRow => ({
    id: 'b1',
    project_id: 'p1',
    subcontractor_id: 'sub-1',
    insurance_certificate_id: 'cert-1',
    company_name: 'Acme Sub',
    expired_on: '2026-05-01',
    overridden_at: null,
    override_reason: null,
    block_until: null,
    ...over,
  })

  it('returns the matching block by subcontractor id', () => {
    const b = block()
    const result = isSubBlocked([b], { subcontractorId: 'sub-1' }, NOW)
    expect(result).toBe(b)
  })

  it('returns null when no blocks exist', () => {
    expect(isSubBlocked([], { subcontractorId: 'sub-1' }, NOW)).toBeNull()
  })

  it('matches on company name when subcontractor id does not match', () => {
    const b = block({ subcontractor_id: 'sub-other', company_name: 'Acme Sub' })
    expect(
      isSubBlocked([b], { subcontractorId: 'sub-1', companyName: 'Acme Sub' }, NOW),
    ).toBe(b)
  })

  it('is case-insensitive on company name match', () => {
    const b = block({ subcontractor_id: null, company_name: 'Acme Sub' })
    expect(
      isSubBlocked([b], { companyName: 'ACME sub' }, NOW),
    ).toBe(b)
  })

  it('respects an override (returns null)', () => {
    const b = block({ overridden_at: '2026-05-01T10:00:00Z' })
    expect(isSubBlocked([b], { subcontractorId: 'sub-1' }, NOW)).toBeNull()
  })

  it('respects expired block_until (returns null)', () => {
    const b = block({ block_until: '2026-04-30T00:00:00Z' })
    expect(isSubBlocked([b], { subcontractorId: 'sub-1' }, NOW)).toBeNull()
  })

  it('keeps active block_until in the future', () => {
    const b = block({ block_until: '2026-05-30T00:00:00Z' })
    expect(isSubBlocked([b], { subcontractorId: 'sub-1' }, NOW)).toBe(b)
  })
})

describe('validateOverrideReason', () => {
  it('rejects reasons under 12 characters', () => {
    const result = validateOverrideReason('ok')
    expect(result.error).not.toBeNull()
    expect(result.data).toBeNull()
  })

  it('accepts a properly justified override and returns trimmed value', () => {
    const result = validateOverrideReason('Verified copy on file with PM')
    expect(result.error).toBeNull()
    expect(result.data).toBe('Verified copy on file with PM')
  })

  it('trims surrounding whitespace before length check', () => {
    expect(validateOverrideReason('     ').error).not.toBeNull()
    const ok = validateOverrideReason('   substantive reason here   ')
    expect(ok.error).toBeNull()
    expect(ok.data).toBe('substantive reason here')
  })

  it('reports the trimmed length in error context for short reasons', () => {
    const result = validateOverrideReason('  short  ')
    expect(result.error?.context).toMatchObject({ length: 5 })
  })
})
