import { describe, it, expect } from 'vitest'
import {
  computeCostCodeWaterfall,
  computeCostCodeWaterfallBatch,
  totalsForWaterfall,
  type WaterfallInput,
} from './waterfall'

const IN = (over: Partial<WaterfallInput> = {}): WaterfallInput => ({
  costCode: '03100',
  description: 'Concrete',
  originalBudget: 100_000,
  approvedChangeOrders: 0,
  committed: 80_000,
  invoiced: 50_000,
  paid: 40_000,
  ...over,
})

describe('computeCostCodeWaterfall', () => {
  it('produces 7 ordered steps', () => {
    const r = computeCostCodeWaterfall(IN())
    expect(r.steps.map((s) => s.kind)).toEqual([
      'budget_origin',
      'change_order',
      'budget_revised',
      'committed',
      'invoiced',
      'paid',
      'balance',
    ])
  })

  it('converts dollars to cents exactly', () => {
    const r = computeCostCodeWaterfall(IN({ originalBudget: 100 }))
    expect(r.steps[0].cents).toBe(10_000)
  })

  it('combines original + approvedCO into revised budget', () => {
    const r = computeCostCodeWaterfall(
      IN({ originalBudget: 100, approvedChangeOrders: 25 }),
    )
    const revised = r.steps.find((s) => s.kind === 'budget_revised')!
    expect(revised.cents).toBe(12_500) // (100 + 25) * 100
  })

  it('handles negative approved CO (deduct)', () => {
    const r = computeCostCodeWaterfall(
      IN({ originalBudget: 100, approvedChangeOrders: -10 }),
    )
    const revised = r.steps.find((s) => s.kind === 'budget_revised')!
    expect(revised.cents).toBe(9_000)
  })

  it('balanceToPay = committed − paid', () => {
    const r = computeCostCodeWaterfall(IN({ committed: 80, paid: 30 }))
    expect(r.balanceToPayCents).toBe(5_000)
    expect(r.steps[6].cents).toBe(5_000)
  })

  it('uncommitted = revised − committed', () => {
    const r = computeCostCodeWaterfall(
      IN({ originalBudget: 100, approvedChangeOrders: 0, committed: 70 }),
    )
    expect(r.uncommittedCents).toBe(3_000)
  })

  it('unbilled = committed − invoiced', () => {
    const r = computeCostCodeWaterfall(IN({ committed: 80, invoiced: 50 }))
    expect(r.unbilledCents).toBe(3_000)
  })

  it('receivable = invoiced − paid', () => {
    const r = computeCostCodeWaterfall(IN({ invoiced: 50, paid: 30 }))
    expect(r.receivableCents).toBe(2_000)
  })

  it('flags isOverCommitted when committed > revised', () => {
    expect(
      computeCostCodeWaterfall(IN({ originalBudget: 100, committed: 110 }))
        .isOverCommitted,
    ).toBe(true)
  })

  it('flags isOverBilled when invoiced > committed', () => {
    expect(
      computeCostCodeWaterfall(IN({ committed: 50, invoiced: 60 })).isOverBilled,
    ).toBe(true)
  })

  it('does not flag when at parity', () => {
    const r = computeCostCodeWaterfall(IN({ committed: 100, invoiced: 100 }))
    expect(r.isOverCommitted).toBe(false)
    expect(r.isOverBilled).toBe(false)
  })

  it('preserves costCode and description on output', () => {
    const r = computeCostCodeWaterfall(IN({ costCode: '99-999', description: 'custom' }))
    expect(r.costCode).toBe('99-999')
    expect(r.description).toBe('custom')
  })
})

describe('computeCostCodeWaterfallBatch', () => {
  it('preserves input order', () => {
    const inputs = [
      IN({ costCode: '01' }),
      IN({ costCode: '02' }),
      IN({ costCode: '03' }),
    ]
    const out = computeCostCodeWaterfallBatch(inputs)
    expect(out.map((r) => r.costCode)).toEqual(['01', '02', '03'])
  })

  it('returns an empty array on empty input', () => {
    expect(computeCostCodeWaterfallBatch([])).toEqual([])
  })
})

describe('totalsForWaterfall', () => {
  it('sums all stages across rows', () => {
    const rows = computeCostCodeWaterfallBatch([
      IN({ originalBudget: 100, approvedChangeOrders: 10, committed: 90, invoiced: 60, paid: 50 }),
      IN({ originalBudget: 200, approvedChangeOrders: 0, committed: 180, invoiced: 100, paid: 80 }),
    ])
    const t = totalsForWaterfall(rows)
    expect(t.originalBudgetCents).toBe(30_000)
    expect(t.approvedChangeOrdersCents).toBe(1_000)
    expect(t.revisedBudgetCents).toBe(31_000)
    expect(t.committedCents).toBe(27_000)
    expect(t.invoicedCents).toBe(16_000)
    expect(t.paidCents).toBe(13_000)
    expect(t.balanceToPayCents).toBe(14_000)
    expect(t.uncommittedCents).toBe(4_000)
    expect(t.unbilledCents).toBe(11_000)
    expect(t.receivableCents).toBe(3_000)
  })

  it('returns zeroes for an empty batch', () => {
    const t = totalsForWaterfall([])
    expect(t.originalBudgetCents).toBe(0)
    expect(t.balanceToPayCents).toBe(0)
  })
})
