import { describe, it, expect } from 'vitest'
import {
  pickWageDecision, computeWeekGross, detectRateViolation,
  type PrevailingWageDecisionRow,
} from '../index'

const TRAVIS_ELEC: PrevailingWageDecisionRow = {
  id: 'r1', state_code: 'TX', county: 'Travis', trade: 'Electrician',
  apprentice_level: null,
  base_rate: 38.50, fringe_rate: 9.20, overtime_multiplier: 1.5,
  wage_decision_number: 'TX20260001',
  effective_from: '2026-01-01', effective_to: null,
}
const TRAVIS_ELEC_PRIOR: PrevailingWageDecisionRow = {
  ...TRAVIS_ELEC, id: 'r0',
  base_rate: 36.00, fringe_rate: 8.50,
  effective_from: '2025-01-01', effective_to: '2026-01-01',
}
const STATE_WIDE: PrevailingWageDecisionRow = {
  ...TRAVIS_ELEC, id: 'r2', county: '*',
  base_rate: 35.00, fringe_rate: 8.00,
}
const APP1: PrevailingWageDecisionRow = {
  ...TRAVIS_ELEC, id: 'r3', apprentice_level: 1,
  base_rate: 23.10, fringe_rate: 6.20,
}

describe('pickWageDecision', () => {
  it('returns the active rate for a worked date', () => {
    const r = pickWageDecision(
      { stateCode: 'TX', county: 'Travis', trade: 'Electrician', workDate: '2026-04-01' },
      [TRAVIS_ELEC, TRAVIS_ELEC_PRIOR],
    )
    expect(r.decision?.id).toBe('r1')
  })

  it('returns the prior rate for a date before the cutover', () => {
    const r = pickWageDecision(
      { stateCode: 'TX', county: 'Travis', trade: 'Electrician', workDate: '2025-06-01' },
      [TRAVIS_ELEC, TRAVIS_ELEC_PRIOR],
    )
    expect(r.decision?.id).toBe('r0')
  })

  it('prefers county-specific over state-wide', () => {
    const r = pickWageDecision(
      { stateCode: 'TX', county: 'Travis', trade: 'Electrician', workDate: '2026-04-01' },
      [TRAVIS_ELEC, STATE_WIDE],
    )
    expect(r.decision?.county).toBe('Travis')
    expect(r.matchNote).toMatch(/county-specific/)
  })

  it('falls back to state-wide when the county misses', () => {
    const r = pickWageDecision(
      { stateCode: 'TX', county: 'Bastrop', trade: 'Electrician', workDate: '2026-04-01' },
      [TRAVIS_ELEC, STATE_WIDE],
    )
    expect(r.decision?.county).toBe('*')
    expect(r.matchNote).toMatch(/state-wide/)
  })

  it('returns null when no rate exists', () => {
    const r = pickWageDecision(
      { stateCode: 'CA', county: 'LA', trade: 'Plumber', workDate: '2026-04-01' },
      [TRAVIS_ELEC],
    )
    expect(r.decision).toBeNull()
  })

  it('matches apprentice level exactly', () => {
    const r = pickWageDecision(
      { stateCode: 'TX', county: 'Travis', trade: 'Electrician', workDate: '2026-04-01', apprenticeLevel: 1 },
      [TRAVIS_ELEC, APP1],
    )
    expect(r.decision?.id).toBe('r3')
    expect(r.decision?.base_rate).toBe(23.10)
  })

  it('does not return an apprentice rate when journeyman is requested', () => {
    const r = pickWageDecision(
      { stateCode: 'TX', county: 'Travis', trade: 'Electrician', workDate: '2026-04-01' },
      [APP1],  // only apprentice rate available
    )
    expect(r.decision).toBeNull()
  })
})

describe('computeWeekGross', () => {
  it('computes straight + OT + fringes correctly', () => {
    const r = computeWeekGross(40, 10, 0, TRAVIS_ELEC)
    expect(r.straight).toBe(1540)             // 40 × 38.50
    expect(r.overtime).toBe(577.50)           // 10 × 38.50 × 1.5
    expect(r.fringes).toBe(460)               // 50 × 9.20
    expect(r.gross).toBe(2577.50)
  })

  it('handles double-time hours at 2x base', () => {
    const r = computeWeekGross(40, 0, 8, TRAVIS_ELEC)
    expect(r.doubleTime).toBe(616)            // 8 × 38.50 × 2
  })
})

describe('detectRateViolation', () => {
  it('flags pay below base rate', () => {
    const r = detectRateViolation(35.00, TRAVIS_ELEC)
    expect(r.violated).toBe(true)
    expect(r.shortBy).toBe(3.50)
  })

  it('passes pay at or above base', () => {
    expect(detectRateViolation(38.50, TRAVIS_ELEC).violated).toBe(false)
    expect(detectRateViolation(40.00, TRAVIS_ELEC).violated).toBe(false)
  })

  it('treats sub-cent rounding as not violating', () => {
    expect(detectRateViolation(38.49, TRAVIS_ELEC).violated).toBe(false)
  })
})
