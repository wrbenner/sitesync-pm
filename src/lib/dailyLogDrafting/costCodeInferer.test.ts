import { describe, it, expect } from 'vitest'
import { inferCostCode } from './costCodeInferer'

describe('inferCostCode', () => {
  it('returns null cost_code for too-short input', () => {
    const r = inferCostCode('a')
    expect(r.cost_code).toBeNull()
    expect(r.confidence).toBe(0)
    expect(r.matched_terms).toEqual([])
  })

  it('returns null when no rule matches', () => {
    expect(inferCostCode('miscellaneous activities').cost_code).toBeNull()
  })

  it('infers concrete (03 30 00) on a single keyword (low confidence)', () => {
    const r = inferCostCode('Pour activity ongoing')
    expect(r.cost_code).toBe('03 30 00')
    expect(r.confidence).toBe(0.45)
  })

  it('boosts to 0.7 with two distinct keyword hits', () => {
    const r = inferCostCode('Slab pour at grid C/4 — formwork stripped')
    expect(r.cost_code).toBe('03 30 00')
    expect(r.confidence).toBe(0.85) // slab + pour + formwork = 3 matches
    expect(r.matched_terms.length).toBeGreaterThanOrEqual(3)
  })

  it('caps base confidence at 0.85 for 3+ matches', () => {
    const r = inferCostCode('concrete pour over rebar at the slab footing')
    expect(r.cost_code).toBe('03 30 00')
    expect(r.confidence).toBeCloseTo(0.85, 2)
  })

  it('matches drywall as 09 21 16', () => {
    const r = inferCostCode('Drywall hung and taping started')
    expect(r.cost_code).toBe('09 21 16')
    expect(r.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('matches steel framing via regex-flexible trigger', () => {
    const r = inferCostCode('I-beam erection in progress')
    expect(r.cost_code).toBe('05 12 00')
  })

  it('matches electrical via the EMT/RMC regex', () => {
    const r = inferCostCode('Pulled new EMT through chase')
    expect(r.cost_code).toBe('26 05 00')
  })

  it('does not match electrical for unrelated abbreviations', () => {
    expect(inferCostCode('plumbing trim only')).toMatchObject({
      cost_code: '22 10 00',
    })
  })

  it('matches HVAC ductwork', () => {
    const r = inferCostCode('Ductwork hung in mechanical room — VAV terminals set')
    expect(r.cost_code).toBe('23 31 00')
  })

  it('matches excavation', () => {
    const r = inferCostCode('Excavation continued and backfill at the south footing')
    expect(r.cost_code).toBe('31 23 00')
  })

  it('selects the highest-confidence rule when multiple rules trigger', () => {
    // "concrete" triggers 03 30 00 once; "drywall taping" triggers 09 21 16 twice
    const r = inferCostCode('concrete sample drywall hung taping in progress')
    expect(r.cost_code).toBe('09 21 16')
  })

  it('returns lowercase-collapsed matched_terms', () => {
    const r = inferCostCode('CONCRETE pour today')
    expect(r.matched_terms).toContain('concrete')
  })

  it('is whitespace-tolerant', () => {
    const r = inferCostCode('   slab    pour    at    grid     ')
    expect(r.cost_code).toBe('03 30 00')
  })

  it('handles empty / whitespace-only input gracefully', () => {
    expect(inferCostCode('').cost_code).toBeNull()
    expect(inferCostCode('   ').cost_code).toBeNull()
  })
})
