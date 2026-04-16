import { describe, it, expect } from 'vitest'
import {
  centsToDisplay,
  dollarsToCents,
  addCents,
  multiplyCents,
  type Cents,
} from '../../types/money'

// ---------------------------------------------------------------------------
// Cents type — centsToDisplay
// ---------------------------------------------------------------------------
describe('centsToDisplay', () => {
  it('formats 1999 as $19.99', () => {
    expect(centsToDisplay(1999 as Cents)).toBe('$19.99')
  })

  it('formats 0 as $0.00', () => {
    expect(centsToDisplay(0 as Cents)).toBe('$0.00')
  })

  it('formats 100 as $1.00', () => {
    expect(centsToDisplay(100 as Cents)).toBe('$1.00')
  })

  it('formats 99900 as $999.00', () => {
    expect(centsToDisplay(99900 as Cents)).toBe('$999.00')
  })

  it('formats 1 as $0.01', () => {
    expect(centsToDisplay(1 as Cents)).toBe('$0.01')
  })

  it('respects custom currency (EUR)', () => {
    const result = centsToDisplay(1000 as Cents, 'EUR')
    // Should contain the numeric value 10.00
    expect(result).toContain('10.00')
  })

  it('handles large amounts correctly', () => {
    // $1,000,000.00 = 100_000_000 cents
    const result = centsToDisplay(100_000_000 as Cents)
    expect(result).toBe('$1,000,000.00')
  })
})

// ---------------------------------------------------------------------------
// dollarsToCents
// ---------------------------------------------------------------------------
describe('dollarsToCents', () => {
  it('converts 19.99 → 1999', () => {
    expect(dollarsToCents(19.99)).toBe(1999)
  })

  it('converts 0 → 0', () => {
    expect(dollarsToCents(0)).toBe(0)
  })

  it('converts 1.00 → 100', () => {
    expect(dollarsToCents(1.0)).toBe(100)
  })

  it('rounds floating-point imprecision correctly (0.1 + 0.2 = 0.30)', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754 — Math.round handles it
    expect(dollarsToCents(0.1 + 0.2)).toBe(30)
  })

  it('converts negative dollars (credit/refund)', () => {
    expect(dollarsToCents(-5.0)).toBe(-500)
  })

  it('converts large amounts', () => {
    expect(dollarsToCents(9999.99)).toBe(999999)
  })
})

// ---------------------------------------------------------------------------
// addCents
// ---------------------------------------------------------------------------
describe('addCents', () => {
  it('adds two cent values', () => {
    expect(addCents(100 as Cents, 200 as Cents)).toBe(300)
  })

  it('adding zero returns original value', () => {
    expect(addCents(500 as Cents, 0 as Cents)).toBe(500)
  })

  it('adds two zeros', () => {
    expect(addCents(0 as Cents, 0 as Cents)).toBe(0)
  })

  it('handles large cent values without precision loss', () => {
    expect(addCents(100_000_000 as Cents, 50_000_000 as Cents)).toBe(150_000_000)
  })

  it('addCents is commutative', () => {
    expect(addCents(300 as Cents, 700 as Cents)).toBe(addCents(700 as Cents, 300 as Cents))
  })
})

// ---------------------------------------------------------------------------
// multiplyCents
// ---------------------------------------------------------------------------
describe('multiplyCents', () => {
  it('multiplies unit price by quantity', () => {
    expect(multiplyCents(100 as Cents, 5)).toBe(500)
  })

  it('multiplies by zero returns 0', () => {
    expect(multiplyCents(999 as Cents, 0)).toBe(0)
  })

  it('multiplies by 1 returns same value', () => {
    expect(multiplyCents(1999 as Cents, 1)).toBe(1999)
  })

  it('rounds fractional cent results', () => {
    // 3 cents * 0.333... = 0.999... → should round to 1
    expect(multiplyCents(3 as Cents, 1 / 3)).toBe(1)
  })

  it('handles null-equivalent unit price (0) with any quantity', () => {
    expect(multiplyCents(0 as Cents, 100)).toBe(0)
  })

  it('handles decimal quantities (e.g. rates)', () => {
    // 1000 cents * 0.029 rate = 29 cents
    expect(multiplyCents(1000 as Cents, 0.029)).toBe(29)
  })
})

// ---------------------------------------------------------------------------
// Combined: simulate getUsageSummary-style aggregation
// ---------------------------------------------------------------------------
describe('Cents arithmetic — aggregation simulation', () => {
  it('aggregates multiple usage events correctly', () => {
    // 3 events: qty=2 @ 10¢, qty=3 @ 10¢, qty=1 @ 0¢
    const events = [
      { quantity: 2, unit_price: 10 as Cents },
      { quantity: 3, unit_price: 10 as Cents },
      { quantity: 1, unit_price: 0 as Cents },
    ]
    let totalAmount = 0 as Cents
    for (const e of events) {
      totalAmount = addCents(totalAmount, multiplyCents(e.unit_price, e.quantity))
    }
    // 2*10 + 3*10 + 1*0 = 50 cents
    expect(totalAmount).toBe(50)
  })

  it('handles all-zero unit prices (free events)', () => {
    let totalAmount = 0 as Cents
    for (let i = 0; i < 100; i++) {
      totalAmount = addCents(totalAmount, multiplyCents(0 as Cents, 10))
    }
    expect(totalAmount).toBe(0)
  })
})
