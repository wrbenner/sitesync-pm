/**
 * Decimal arithmetic tests — pin the round-half-to-even contract.
 *
 * SPEC: AIA-published worked examples use banker's rounding on .5 cases.
 * JavaScript's Math.round rounds half AWAY from zero, which produces
 * .5-case mismatches. The helper `roundHalfEvenCents` exists to align
 * with the AIA contract.
 */

import { describe, it, expect } from 'vitest';
import {
  roundHalfEvenCents,
  roundHalfEvenToCentsInt,
  bankRoundCents,
  dollarsToCents,
  centsToDollars,
  sumCents,
  formatCents,
} from '../g702Audited';

describe('roundHalfEvenCents — banker\'s rounding on dollar amounts', () => {
  it('rounds 0.005 → 0.00 (half rounds DOWN to even)', () => {
    expect(roundHalfEvenCents(0.005)).toBe(0);
  });

  it('rounds 0.015 → 0.02 (half rounds UP to even)', () => {
    expect(roundHalfEvenCents(0.015)).toBe(0.02);
  });

  it('rounds 0.025 → 0.02 (half rounds DOWN to even)', () => {
    expect(roundHalfEvenCents(0.025)).toBe(0.02);
  });

  it('rounds 0.035 → 0.04 (half rounds UP to even)', () => {
    expect(roundHalfEvenCents(0.035)).toBe(0.04);
  });

  it('rounds non-half cases the standard way (0.001 → 0.00)', () => {
    expect(roundHalfEvenCents(0.001)).toBe(0);
  });

  it('rounds non-half cases the standard way (0.006 → 0.01)', () => {
    expect(roundHalfEvenCents(0.006)).toBe(0.01);
  });

  it('rounds 0.014 → 0.01 (under half)', () => {
    expect(roundHalfEvenCents(0.014)).toBe(0.01);
  });

  it('rounds 0.016 → 0.02 (over half)', () => {
    expect(roundHalfEvenCents(0.016)).toBe(0.02);
  });

  it('handles negative .5 cases consistently', () => {
    // -0.005 → 0¢ (round to even); -0.015 → -2¢ (round to even).
    // Use === 0 to permit either +0 or -0 (IEEE-754 signed zero).
    expect(roundHalfEvenCents(-0.005) === 0).toBe(true);
    expect(roundHalfEvenCents(-0.015)).toBe(-0.02);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(roundHalfEvenCents(Number.NaN)).toBe(0);
    expect(roundHalfEvenCents(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('roundHalfEvenToCentsInt — integer cents version', () => {
  it('returns 0 for 0.005', () => {
    expect(roundHalfEvenToCentsInt(0.005)).toBe(0);
  });
  it('returns 2 for 0.015', () => {
    expect(roundHalfEvenToCentsInt(0.015)).toBe(2);
  });
  it('returns 100 for 1.00', () => {
    expect(roundHalfEvenToCentsInt(1)).toBe(100);
  });
});

describe('bankRoundCents — round a fractional-cent value', () => {
  it('bank-rounds 1.5 cents → 2 (round to even)', () => {
    expect(bankRoundCents(1.5)).toBe(2);
  });

  it('bank-rounds 2.5 cents → 2 (round to even)', () => {
    expect(bankRoundCents(2.5)).toBe(2);
  });

  it('bank-rounds 3.5 cents → 4', () => {
    expect(bankRoundCents(3.5)).toBe(4);
  });

  it('returns 0 for NaN', () => {
    expect(bankRoundCents(Number.NaN)).toBe(0);
  });
});

describe('dollarsToCents / centsToDollars round-trip', () => {
  it('preserves 19.99', () => {
    expect(centsToDollars(dollarsToCents(19.99))).toBe(19.99);
  });

  it('preserves 1234567.89', () => {
    expect(centsToDollars(dollarsToCents(1234567.89))).toBe(1234567.89);
  });
});

describe('sumCents — exact summation', () => {
  it('sums an empty array to 0', () => {
    expect(sumCents([])).toBe(0);
  });

  it('sums integer cents exactly with no float drift', () => {
    // Three lines that as floats would drift: 0.1 + 0.2 ≠ 0.3 in IEEE-754.
    // In integer cents: 10 + 20 = 30.
    expect(sumCents([10, 20])).toBe(30);
  });
});

describe('formatCents — display formatter', () => {
  it('formats 199900 as "$1,999.00"', () => {
    expect(formatCents(199900)).toBe('$1,999.00');
  });

  it('formats 0 as "$0.00"', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats negatives with a leading minus', () => {
    expect(formatCents(-12345)).toBe('-$123.45');
  });
});
