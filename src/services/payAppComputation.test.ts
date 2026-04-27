import { describe, it, expect } from 'vitest'
import {
  computePayApp,
  lineItemPercentComplete,
  validatePayAppLineItems,
  type PayAppLineItem,
} from './payAppComputation'

function line(o: Partial<PayAppLineItem> = {}): PayAppLineItem {
  return {
    id: 'l-' + Math.random().toString(36).slice(2, 7),
    description: 'Item',
    scheduled_value: 10_000,
    previous_completed: 0,
    this_period: 0,
    materials_stored: 0,
    ...o,
  }
}

describe('payAppComputation — computePayApp (7-step AIA pipeline)', () => {
  it('Step 1 — contract_sum sums scheduled values across line items', () => {
    const r = computePayApp(
      [line({ scheduled_value: 50_000 }), line({ scheduled_value: 50_000 })],
      0, 0, 0,
    )
    expect(r.contract_sum).toBe(100_000)
  })

  it('Step 2 — total_completed_to_date sums previous + this_period', () => {
    const r = computePayApp(
      [
        line({ previous_completed: 10_000, this_period: 5_000 }),
        line({ previous_completed: 7_000, this_period: 3_000 }),
      ],
      0, 0, 0,
    )
    expect(r.total_completed_to_date).toBe(25_000)
  })

  it('Step 2 — total_materials_stored sums per-line storage', () => {
    const r = computePayApp(
      [
        line({ materials_stored: 2_000 }),
        line({ materials_stored: 3_000 }),
      ],
      0, 0, 0,
    )
    expect(r.total_materials_stored).toBe(5_000)
  })

  it('Step 3 — retainage = gross_completed × retainagePercent / 100', () => {
    // gross = 30k completed + 5k materials = 35k; 10% retainage = 3.5k
    const r = computePayApp(
      [line({ previous_completed: 20_000, this_period: 10_000, materials_stored: 5_000 })],
      10, 0, 0,
    )
    expect(r.retainage_amount).toBe(3_500)
    expect(r.retainage_rate).toBe(10)
  })

  it('Step 4 — total_previous_payments passes through input value', () => {
    const r = computePayApp([line()], 0, 12_345, 0)
    expect(r.total_previous_payments).toBe(12_345)
  })

  it('Step 5 — approved_change_orders passes through CO total', () => {
    const r = computePayApp([line()], 0, 0, 25_000)
    expect(r.approved_change_orders).toBe(25_000)
  })

  it('Step 6 — current_payment_due = net_completed - previous_payments', () => {
    // gross = 50k, 10% retainage = 5k, net = 45k, prev = 20k → due = 25k
    const r = computePayApp(
      [line({ scheduled_value: 100_000, previous_completed: 30_000, this_period: 20_000 })],
      10, 20_000, 0,
    )
    expect(r.current_payment_due).toBe(25_000)
  })

  it('Step 7 — balance_to_finish = (contract + COs) - gross_completed', () => {
    // contract 100k + CO 10k = 110k; gross completed 40k → balance 70k
    const r = computePayApp(
      [line({ scheduled_value: 100_000, previous_completed: 30_000, this_period: 10_000 })],
      0, 0, 10_000,
    )
    expect(r.balance_to_finish).toBe(70_000)
  })

  it('Step 7 — percent_complete = gross / adjusted_contract × 100', () => {
    // adjusted = 100k + 10k = 110k; gross = 55k → 50%
    const r = computePayApp(
      [line({ scheduled_value: 100_000, previous_completed: 30_000, this_period: 25_000 })],
      0, 0, 10_000,
    )
    expect(r.percent_complete).toBeCloseTo(50, 1)
  })

  it('percent_complete is 0 when adjusted_contract is 0', () => {
    const r = computePayApp([], 0, 0, 0)
    expect(r.percent_complete).toBe(0)
  })

  it('handles 0% retainage correctly', () => {
    const r = computePayApp([line({ previous_completed: 50_000 })], 0, 0, 0)
    expect(r.retainage_amount).toBe(0)
    expect(r.current_payment_due).toBe(50_000)
  })

  it('full pipeline: contract 100k, 50% complete, 10% retainage, no prior payments', () => {
    // 50k completed; 10% retainage = 5k; net 45k; no prev payments → due 45k
    const r = computePayApp(
      [line({ scheduled_value: 100_000, this_period: 50_000 })],
      10, 0, 0,
    )
    expect(r.contract_sum).toBe(100_000)
    expect(r.total_completed_to_date).toBe(50_000)
    expect(r.retainage_amount).toBe(5_000)
    expect(r.current_payment_due).toBe(45_000)
    expect(r.balance_to_finish).toBe(50_000)
    expect(r.percent_complete).toBe(50)
  })
})

describe('payAppComputation — lineItemPercentComplete', () => {
  it('percent = (prev + this + materials) / scheduled × 100', () => {
    expect(
      lineItemPercentComplete(line({
        scheduled_value: 100,
        previous_completed: 30,
        this_period: 20,
        materials_stored: 0,
      })),
    ).toBe(50)
  })

  it('caps at 100% when over-completed', () => {
    expect(
      lineItemPercentComplete(line({
        scheduled_value: 100,
        previous_completed: 80,
        this_period: 30,
        materials_stored: 0,
      })),
    ).toBe(100)
  })

  it('returns 0 when scheduled_value ≤ 0', () => {
    expect(lineItemPercentComplete(line({ scheduled_value: 0 }))).toBe(0)
    expect(lineItemPercentComplete(line({ scheduled_value: -10 }))).toBe(0)
  })

  it('counts materials_stored toward completion', () => {
    expect(
      lineItemPercentComplete(line({
        scheduled_value: 100,
        materials_stored: 25,
      })),
    ).toBe(25)
  })
})

describe('payAppComputation — validatePayAppLineItems', () => {
  it('returns valid=true with no errors for compliant inputs', () => {
    const r = validatePayAppLineItems([
      line({ scheduled_value: 100, previous_completed: 30, this_period: 20 }),
      line({ scheduled_value: 50, previous_completed: 0, this_period: 25 }),
    ])
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('flags lines where total exceeds scheduled value', () => {
    const r = validatePayAppLineItems([
      line({
        description: 'Concrete', scheduled_value: 100,
        previous_completed: 60, this_period: 50, materials_stored: 0,
      }),
    ])
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/Concrete/)
    expect(r.errors[0]).toMatch(/exceeds scheduled value/)
  })

  it('flags negative this_period values', () => {
    const r = validatePayAppLineItems([
      line({ description: 'Bad line', this_period: -100 }),
    ])
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/cannot be negative/)
  })

  it('multiple errors accumulate', () => {
    const r = validatePayAppLineItems([
      line({ description: 'Over', scheduled_value: 100, this_period: 200 }),
      line({ description: 'Negative', this_period: -50 }),
    ])
    expect(r.errors).toHaveLength(2)
  })

  it('exactly-at-scheduled-value is valid (boundary)', () => {
    const r = validatePayAppLineItems([
      line({ scheduled_value: 100, previous_completed: 100, this_period: 0 }),
    ])
    expect(r.valid).toBe(true)
  })
})
