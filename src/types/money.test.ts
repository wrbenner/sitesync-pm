import { describe, it, expect } from 'vitest'
import {
  centsToDisplay,
  dollarsToCents,
  toCents,
  fromCents,
  addCents,
  subtractCents,
  multiplyCents,
  applyRateCents,
  type Cents,
} from './money'

// Cents are integer cents wrapped in a brand. The whole codebase trusts
// these helpers so each rounding rule is worth pinning down.

describe('money — centsToDisplay', () => {
  it('formats whole-dollar amounts with two decimals', () => {
    expect(centsToDisplay(1999 as Cents)).toBe('$19.99')
    expect(centsToDisplay(0 as Cents)).toBe('$0.00')
  })

  it('formats negative amounts with the leading minus', () => {
    // Intl puts the minus inside the currency symbol (e.g. "-$1.50") on en-US.
    expect(centsToDisplay(-150 as Cents)).toMatch(/-\$1\.50/)
  })

  it('respects the currency parameter', () => {
    const r = centsToDisplay(2500 as Cents, 'EUR')
    expect(r).toContain('25.00')
    expect(r).toMatch(/€/)
  })

  it('handles values larger than $1M without scientific notation', () => {
    expect(centsToDisplay(12_345_678 as Cents)).toBe('$123,456.78')
  })
})

describe('money — dollarsToCents', () => {
  it('rounds half-cents up to the nearest cent (banker\'s convention not used)', () => {
    expect(dollarsToCents(19.99)).toBe(1999)
    expect(dollarsToCents(0.005)).toBe(1)   // Math.round rounds .5 toward +∞
    expect(dollarsToCents(0.004)).toBe(0)
  })

  it('survives floating-point edge cases (0.1 + 0.2)', () => {
    expect(dollarsToCents(0.1 + 0.2)).toBe(30)
  })

  it('handles negative amounts symmetrically', () => {
    expect(dollarsToCents(-19.99)).toBe(-1999)
  })
})

describe('money — toCents (brand cast)', () => {
  it('rounds non-integer inputs (the function does NOT multiply by 100)', () => {
    // toCents takes input ALREADY in cents and brands it.
    expect(toCents(1999)).toBe(1999)
    expect(toCents(99.4)).toBe(99)
    expect(toCents(99.5)).toBe(100)
  })

  it('passes integer inputs through unchanged', () => {
    expect(toCents(0)).toBe(0)
    expect(toCents(-100)).toBe(-100)
  })
})

describe('money — fromCents', () => {
  it('is the identity unwrap', () => {
    expect(fromCents(1999 as Cents)).toBe(1999)
    expect(fromCents(0 as Cents)).toBe(0)
    expect(fromCents(-100 as Cents)).toBe(-100)
  })
})

describe('money — addCents / subtractCents', () => {
  it('addCents performs integer addition', () => {
    expect(addCents(100 as Cents, 250 as Cents)).toBe(350)
    expect(addCents(0 as Cents, 0 as Cents)).toBe(0)
  })

  it('subtractCents preserves sign', () => {
    expect(subtractCents(500 as Cents, 200 as Cents)).toBe(300)
    expect(subtractCents(100 as Cents, 250 as Cents)).toBe(-150)
  })

  it('a + b - b round-trips exactly (no float drift)', () => {
    const a = 19_999 as Cents
    const b = 12_345 as Cents
    expect(subtractCents(addCents(a, b), b)).toBe(a)
  })
})

describe('money — multiplyCents', () => {
  it('multiplies by an integer quantity', () => {
    expect(multiplyCents(199 as Cents, 5)).toBe(995)
  })

  it('rounds the result to integer cents', () => {
    // 199 * 1.5 = 298.5 → rounds to 299
    expect(multiplyCents(199 as Cents, 1.5)).toBe(299)
  })

  it('multiplying by 0 yields 0', () => {
    expect(multiplyCents(199 as Cents, 0)).toBe(0)
  })
})

describe('money — applyRateCents', () => {
  it('applies a fractional rate and rounds to integer cents', () => {
    expect(applyRateCents(1000 as Cents, 0.10)).toBe(100)
    expect(applyRateCents(1000 as Cents, 0.075)).toBe(75)
    expect(applyRateCents(199 as Cents, 0.50)).toBe(100) // 99.5 → 100
  })

  it('rate of 1.0 returns the original amount', () => {
    expect(applyRateCents(12345 as Cents, 1)).toBe(12345)
  })

  it('rate of 0 returns 0', () => {
    expect(applyRateCents(12345 as Cents, 0)).toBe(0)
  })

  it('handles negative amounts correctly', () => {
    expect(applyRateCents(-1000 as Cents, 0.10)).toBe(-100)
  })
})

describe('money — round-trip dollars ⇄ cents ⇄ display', () => {
  it('survives the full pipeline without precision loss', () => {
    const dollars = 1234.56
    const cents = dollarsToCents(dollars)
    const display = centsToDisplay(cents)
    expect(cents).toBe(123_456)
    expect(display).toBe('$1,234.56')
  })
})
