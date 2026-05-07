import { describe, it, expect } from 'vitest'
import { estimateCostFromCandidates } from './costEstimator'
import type { ScopeLineItem } from '../../types/coAutoDraft'

interface CostRow {
  id: string
  description: string
  unit: string | null
  unit_cost: number | null
  csi_code: string | null
  labor_rate: number | null
  labor_hours_per_unit: number | null
  material_cost_per_unit: number | null
}

const row = (over: Partial<CostRow> = {}): CostRow => ({
  id: 'cost-1',
  description: 'rigid insulation 1 inch',
  unit: 'sf',
  unit_cost: 4.5,
  csi_code: '07 21 00',
  labor_rate: null,
  labor_hours_per_unit: null,
  material_cost_per_unit: null,
  ...over,
})

const line = (over: Partial<ScopeLineItem> = {}): ScopeLineItem => ({
  description: 'install 1-inch rigid insulation',
  quantity: 100,
  unit: 'sf',
  csiCode: '07 21 00',
  ...over,
})

describe('estimateCostFromCandidates', () => {
  it('returns "no line items" provenance for empty input', () => {
    const out = estimateCostFromCandidates([], [row()])
    expect(out.lines).toEqual([])
    expect(out.total).toBeNull()
    expect(out.provenance).toBe('no line items')
  })

  it('matches by token overlap and prices line × unitCost', () => {
    const out = estimateCostFromCandidates([line()], [row()])
    expect(out.lines[0].unitCost).toBe(4.5)
    expect(out.lines[0].lineTotal).toBe(450)
    expect(out.total).toBe(450)
    expect(out.lines[0].costDatabaseId).toBe('cost-1')
    expect(out.lines[0].matchNote).toMatch(/rigid insulation 1 inch/)
  })

  it('rejects candidates with mismatched csi_code when line has csiCode', () => {
    const out = estimateCostFromCandidates(
      [line({ csiCode: '07 21 00' })],
      [row({ csi_code: '03 30 00' })],
    )
    expect(out.lines[0].unitCost).toBeNull()
    expect(out.lines[0].lineTotal).toBeNull()
    expect(out.lines[0].matchNote).toBe('no cost_database match')
  })

  it('rejects candidates with mismatched unit', () => {
    const out = estimateCostFromCandidates(
      [line({ unit: 'sf' })],
      [row({ unit: 'lf' })],
    )
    expect(out.lines[0].unitCost).toBeNull()
  })

  it('is case-insensitive on unit comparison', () => {
    const out = estimateCostFromCandidates(
      [line({ unit: 'SF' })],
      [row({ unit: 'sf' })],
    )
    expect(out.lines[0].unitCost).toBe(4.5)
  })

  it('falls back to material + labor when unit_cost is null', () => {
    const out = estimateCostFromCandidates(
      [line()],
      [
        row({
          unit_cost: null,
          material_cost_per_unit: 3.0,
          labor_rate: 50,
          labor_hours_per_unit: 0.05, // 0.05 × 50 = 2.50
        }),
      ],
    )
    expect(out.lines[0].unitCost).toBe(5.5)
    expect(out.lines[0].lineTotal).toBe(550)
  })

  it('returns unitCost null when both unit_cost and components are zero', () => {
    const out = estimateCostFromCandidates(
      [line()],
      [
        row({
          unit_cost: 0,
          material_cost_per_unit: 0,
          labor_rate: 0,
          labor_hours_per_unit: 0,
        }),
      ],
    )
    expect(out.lines[0].unitCost).toBeNull()
  })

  it('returns lineTotal null when quantity is null', () => {
    const out = estimateCostFromCandidates(
      [line({ quantity: null })],
      [row()],
    )
    expect(out.lines[0].lineTotal).toBeNull()
  })

  it('picks highest token-overlap candidate when several pass filters', () => {
    const a = row({ id: 'a', description: 'rigid foam' })
    const b = row({ id: 'b', description: 'rigid insulation 1 inch' })
    const out = estimateCostFromCandidates([line()], [a, b])
    expect(out.lines[0].costDatabaseId).toBe('b')
  })

  it('emits provenance summary with priced/total counts', () => {
    const out = estimateCostFromCandidates(
      [line(), line({ csiCode: '99 99 99' })],
      [row()],
    )
    expect(out.provenance).toMatch(/cost_database matches 1\/2/)
    expect(out.provenance).toMatch(/1 unmatched/)
  })

  it('total is null when no line was priceable', () => {
    const out = estimateCostFromCandidates(
      [line({ csiCode: 'mismatch' })],
      [row()],
    )
    expect(out.total).toBeNull()
  })

  it('rounds line total to 2 decimal places', () => {
    const out = estimateCostFromCandidates(
      [line({ quantity: 7 })],
      [row({ unit_cost: 1.234 })],
    )
    // 7 × 1.234 = 8.638 → 8.64 after toFixed(2)
    expect(out.lines[0].lineTotal).toBe(8.64)
  })

  it('rounds aggregate total to 2 decimal places', () => {
    const out = estimateCostFromCandidates(
      [line({ quantity: 1 }), line({ quantity: 1 })],
      [row({ unit_cost: 0.333 })],
    )
    // sum 0.33 + 0.33 = 0.66 (each rounded to 2 dec, then summed)
    expect(out.total).toBeCloseTo(0.66, 2)
  })

  it('fills matchNote with empty cost when no match', () => {
    const out = estimateCostFromCandidates(
      [line({ csiCode: 'unmatched' })],
      [row()],
    )
    expect(out.lines[0].matchNote).toBe('no cost_database match')
  })

  it('preserves the input description on output', () => {
    const out = estimateCostFromCandidates(
      [line({ description: 'A specific install line' })],
      [row()],
    )
    expect(out.lines[0].description).toBe('A specific install line')
  })
})
