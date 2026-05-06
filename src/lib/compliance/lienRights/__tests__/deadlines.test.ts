import { describe, it, expect } from 'vitest'
import {
  computeDeadlines, pickRule, daysUntil, alertTier,
  type StateLienRule,
} from '../index'

const CA_FIRST_TIER: StateLienRule = {
  id: 'r1', state_code: 'CA', claimant_role: 'first_tier_sub',
  preliminary_notice_days: 20, lien_record_days: 90, foreclosure_suit_days: 90,
  owner_demand_days: null,
  applies_to_residential: true, applies_to_commercial: true,
  statute_citation: 'CCP §8200', notes: null,
  effective_from: '2026-01-01', effective_to: null,
}
const TX_FIRST_TIER: StateLienRule = {
  ...CA_FIRST_TIER, id: 'r2', state_code: 'TX',
  preliminary_notice_days: 45, lien_record_days: 120, foreclosure_suit_days: 730,
}
const TX_GC: StateLienRule = {
  ...TX_FIRST_TIER, id: 'r3', claimant_role: 'general_contractor',
  preliminary_notice_days: null,  // GCs in TX don't need prelim notice
}

describe('pickRule', () => {
  it('picks state + role match', () => {
    const r = pickRule(
      { stateCode: 'CA', claimantRole: 'first_tier_sub', firstDayOfWork: null, lastDayOfWork: null },
      [CA_FIRST_TIER, TX_FIRST_TIER],
    )
    expect(r?.id).toBe('r1')
  })

  it('returns null when no match', () => {
    const r = pickRule(
      { stateCode: 'CA', claimantRole: 'general_contractor', firstDayOfWork: null, lastDayOfWork: null },
      [CA_FIRST_TIER],
    )
    expect(r).toBeNull()
  })

  it('respects effective_to expiry', () => {
    const expired: StateLienRule = { ...CA_FIRST_TIER, id: 'r0', effective_from: '2024-01-01', effective_to: '2026-01-01', preliminary_notice_days: 30 }
    const r = pickRule(
      { stateCode: 'CA', claimantRole: 'first_tier_sub', firstDayOfWork: null, lastDayOfWork: null, asOf: '2026-04-01' },
      [expired, CA_FIRST_TIER],
    )
    expect(r?.id).toBe('r1')  // current rule, not expired
  })
})

describe('computeDeadlines', () => {
  it('CA first-tier sub: 20-day prelim + 90-day lien', () => {
    const r = computeDeadlines(
      { stateCode: 'CA', claimantRole: 'first_tier_sub', firstDayOfWork: '2026-04-01', lastDayOfWork: '2026-06-15' },
      [CA_FIRST_TIER],
    )
    expect(r.preliminaryNoticeDeadline).toBe('2026-04-21')  // +20 days
    expect(r.lienRecordDeadline).toBe('2026-09-13')         // +90 days
    expect(r.foreclosureSuitDeadline).toBe('2026-12-12')    // +90 from lien
  })

  it('TX GC: no preliminary notice required', () => {
    const r = computeDeadlines(
      { stateCode: 'TX', claimantRole: 'general_contractor', firstDayOfWork: '2026-04-01', lastDayOfWork: '2026-06-15' },
      [TX_GC],
    )
    expect(r.preliminaryNoticeDeadline).toBeNull()
    expect(r.lienRecordDeadline).toBe('2026-10-13')
  })

  it('warns when firstDayOfWork is missing for a state that needs prelim', () => {
    const r = computeDeadlines(
      { stateCode: 'CA', claimantRole: 'first_tier_sub', firstDayOfWork: null, lastDayOfWork: '2026-06-15' },
      [CA_FIRST_TIER],
    )
    expect(r.warnings.some(w => w.includes('firstDayOfWork'))).toBe(true)
    expect(r.preliminaryNoticeDeadline).toBeNull()
  })

  it('warns when still on the job (no lastDayOfWork)', () => {
    const r = computeDeadlines(
      { stateCode: 'CA', claimantRole: 'first_tier_sub', firstDayOfWork: '2026-04-01', lastDayOfWork: null },
      [CA_FIRST_TIER],
    )
    expect(r.lienRecordDeadline).toBeNull()
    expect(r.warnings.some(w => w.includes('lastDayOfWork'))).toBe(true)
  })

  it('returns null rule when state/role missing', () => {
    const r = computeDeadlines(
      { stateCode: 'WY', claimantRole: 'first_tier_sub', firstDayOfWork: '2026-04-01', lastDayOfWork: null },
      [CA_FIRST_TIER],
    )
    expect(r.rule).toBeNull()
    expect(r.warnings[0]).toMatch(/No active lien rule/)
  })
})

describe('alertTier', () => {
  it('classifies overdue correctly', () => {
    expect(alertTier('2026-04-01', '2026-04-15')).toBe('overdue')
  })
  it('today / one / three / seven', () => {
    expect(alertTier('2026-04-15', '2026-04-15')).toBe('today')
    expect(alertTier('2026-04-16', '2026-04-15')).toBe('one_day')
    expect(alertTier('2026-04-18', '2026-04-15')).toBe('three_days')
    expect(alertTier('2026-04-22', '2026-04-15')).toBe('seven_days')
    expect(alertTier('2026-05-15', '2026-04-15')).toBe('safe')
  })
})

describe('daysUntil', () => {
  it('positive in the future', () => {
    expect(daysUntil('2026-04-30', '2026-04-15')).toBe(15)
  })
  it('negative in the past', () => {
    expect(daysUntil('2026-04-01', '2026-04-15')).toBe(-14)
  })
})
