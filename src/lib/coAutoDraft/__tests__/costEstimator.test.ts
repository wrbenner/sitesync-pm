// =============================================================================
// costEstimator — pure-function unit tests
// =============================================================================
// Money never comes from the model — it comes from these lookups. These tests
// pin the most-load-bearing rules:
//   • a missing match returns unitCost=null, never a guess
//   • the total is null only when *every* line is unmatched (a partial price
//     is still useful information for the PM)
//   • CSI code filtering excludes off-scope cost rows
// =============================================================================

import { describe, it, expect } from 'vitest'
import { estimateCostFromCandidates } from '../costEstimator'
import type { ScopeLineItem } from '../../../types/coAutoDraft'

const ROW_INSULATION_1IN = {
  id: 'r1',
  description: '1-inch rigid insulation board',
  unit: 'sf',
  unit_cost: 2.40,
  csi_code: '07 21 13',
  labor_rate: null,
  labor_hours_per_unit: null,
  material_cost_per_unit: null,
}
const ROW_GFCI = {
  id: 'r2',
  description: 'GFCI receptacle 15A',
  unit: 'ea',
  unit_cost: 28.0,
  csi_code: '26 27 26',
  labor_rate: null,
  labor_hours_per_unit: null,
  material_cost_per_unit: null,
}
const ROW_CONDUIT = {
  id: 'r3',
  description: 'Conduit EMT 1/2"',
  unit: 'lf',
  unit_cost: null,
  csi_code: '26 05 33',
  labor_rate: 75,
  labor_hours_per_unit: 0.05,
  material_cost_per_unit: 1.20,
}

describe('estimateCostFromCandidates', () => {
  it('prices a matched line by quantity × unit_cost', () => {
    const items: ScopeLineItem[] = [{
      description: 'rigid insulation 1 inch',
      quantity: 4200,
      unit: 'sf',
      csiCode: '07 21 13',
    }]
    const est = estimateCostFromCandidates(items, [ROW_INSULATION_1IN])
    expect(est.total).toBe(10080)
    expect(est.lines[0].costDatabaseId).toBe('r1')
    expect(est.lines[0].lineTotal).toBe(10080)
  })

  it('returns null lineTotal + null total when no row matches', () => {
    const items: ScopeLineItem[] = [{
      description: 'thermal break ceramic spacer',
      quantity: 200,
      unit: 'ea',
      csiCode: null,
    }]
    const est = estimateCostFromCandidates(items, [ROW_INSULATION_1IN])
    expect(est.total).toBeNull()
    expect(est.lines[0].lineTotal).toBeNull()
    expect(est.lines[0].costDatabaseId).toBeNull()
  })

  it('totals partial matches — empty cost_database leaves total null', () => {
    const items: ScopeLineItem[] = [{
      description: 'rigid insulation 1 inch',
      quantity: 4200,
      unit: 'sf',
      csiCode: '07 21 13',
    }]
    const est = estimateCostFromCandidates(items, [])
    expect(est.total).toBeNull()
    expect(est.lines[0].matchNote).toBe('no cost_database match')
  })

  it('partial-priced run still produces a total for matched lines', () => {
    const items: ScopeLineItem[] = [
      { description: 'GFCI receptacle', quantity: 12, unit: 'ea', csiCode: '26 27 26' },
      { description: 'unmatched widget', quantity: 5, unit: 'ea', csiCode: null },
    ]
    const est = estimateCostFromCandidates(items, [ROW_GFCI])
    expect(est.total).toBe(336)  // 12 × 28
    expect(est.lines[0].lineTotal).toBe(336)
    expect(est.lines[1].lineTotal).toBeNull()
    expect(est.provenance).toContain('1/2')
  })

  it('falls back to material+labor when unit_cost is null', () => {
    const items: ScopeLineItem[] = [
      { description: 'EMT conduit 1/2 inch', quantity: 100, unit: 'lf', csiCode: '26 05 33' },
    ]
    const est = estimateCostFromCandidates(items, [ROW_CONDUIT])
    // material 1.20 + labor (75 × 0.05 = 3.75) = 4.95 per LF × 100 = 495
    expect(est.total).toBe(495)
  })

  it('skips rows when csiCode mismatches', () => {
    const items: ScopeLineItem[] = [
      { description: 'GFCI receptacle', quantity: 1, unit: 'ea', csiCode: '07 21 13' },
    ]
    const est = estimateCostFromCandidates(items, [ROW_GFCI])
    expect(est.lines[0].costDatabaseId).toBeNull()
  })

  it('handles empty line items', () => {
    const est = estimateCostFromCandidates([], [ROW_INSULATION_1IN])
    expect(est.total).toBeNull()
    expect(est.lines).toHaveLength(0)
  })

  it('null quantity → null lineTotal even with a matched unit cost', () => {
    const items: ScopeLineItem[] = [
      { description: 'rigid insulation 1 inch', quantity: null, unit: 'sf', csiCode: '07 21 13' },
    ]
    const est = estimateCostFromCandidates(items, [ROW_INSULATION_1IN])
    expect(est.lines[0].unitCost).toBe(2.40)
    expect(est.lines[0].lineTotal).toBeNull()
    expect(est.total).toBeNull()
  })
})
