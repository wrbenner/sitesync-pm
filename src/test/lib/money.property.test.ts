// Property-based tests for src/types/money.ts.
//
// These tests run thousands of randomized cases per property to catch
// drift, off-by-one, and accumulation errors that example-based tests miss.
// They're the foundational verification that the canonical Cents helpers
// behave like an integer ring for the operations we use in pay-app math,
// billing, and dashboard rollups.
//
// Day 16 (Stripe verification + first property test):
//   • round-trip invariant on dollarsToCents
//   • addCents associativity + commutativity
//   • multiplyCents integer-quantity exactness
//   • applyRateCents identity, zero, and bound preservation
//
// Day 18 expands this with 100K-case round-half-to-even verification on
// the full pay-app calculator.

import { describe, it } from 'vitest'
import fc from 'fast-check'
import {
  addCents,
  applyRateCents,
  dollarsToCents,
  fromCents,
  multiplyCents,
  subtractCents,
  type Cents,
} from '../../types/money'

// fast-check default is 100 runs per property; we bump to 5,000 here for
// the foundational invariants. Day 18's pay-app suite goes to 100,000.
const RUNS = 5_000

// Integer cents within plausible business range — up to ~ten billion dollars.
const cents = (): fc.Arbitrary<Cents> =>
  fc.integer({ min: 0, max: 1_000_000_000_000 }).map((n) => n as Cents)

const signedCents = (): fc.Arbitrary<Cents> =>
  fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }).map((n) => n as Cents)

describe('Cents primitives — property tests', () => {
  describe('addCents', () => {
    it('is associative across arbitrary cent values', () => {
      fc.assert(
        fc.property(cents(), cents(), cents(), (a, b, c) => {
          const left = addCents(addCents(a, b), c)
          const right = addCents(a, addCents(b, c))
          return left === right
        }),
        { numRuns: RUNS },
      )
    })

    it('is commutative', () => {
      fc.assert(
        fc.property(cents(), cents(), (a, b) => addCents(a, b) === addCents(b, a)),
        { numRuns: RUNS },
      )
    })

    it('has 0 as identity', () => {
      fc.assert(
        fc.property(cents(), (a) => addCents(a, 0 as Cents) === a),
        { numRuns: RUNS },
      )
    })
  })

  describe('subtractCents', () => {
    it('is the inverse of addCents', () => {
      fc.assert(
        fc.property(cents(), cents(), (a, b) => {
          return subtractCents(addCents(a, b), b) === a
        }),
        { numRuns: RUNS },
      )
    })
  })

  describe('multiplyCents', () => {
    it('with integer quantity is exactly addCents repeated', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          cents(),
          (q, unit) => {
            // Reference: explicit q-fold sum.
            let manual: Cents = 0 as Cents
            for (let i = 0; i < q; i++) manual = addCents(manual, unit)
            return multiplyCents(unit, q) === manual
          },
        ),
        { numRuns: 1_000 }, // smaller because of the inner loop
      )
    })

    it('by 0 yields 0', () => {
      fc.assert(
        fc.property(cents(), (c) => multiplyCents(c, 0) === 0),
        { numRuns: RUNS },
      )
    })

    it('by 1 yields c', () => {
      fc.assert(
        fc.property(cents(), (c) => multiplyCents(c, 1) === c),
        { numRuns: RUNS },
      )
    })
  })

  describe('applyRateCents', () => {
    it('identity rate (1.0) yields c', () => {
      fc.assert(
        fc.property(cents(), (c) => applyRateCents(c, 1.0) === c),
        { numRuns: RUNS },
      )
    })

    it('zero rate yields 0', () => {
      fc.assert(
        fc.property(cents(), (c) => applyRateCents(c, 0) === 0),
        { numRuns: RUNS },
      )
    })

    it('result is always within [0, c] for rates in [0, 1]', () => {
      fc.assert(
        fc.property(
          cents(),
          fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
          (c, r) => {
            const out = applyRateCents(c, r)
            return out >= 0 && out <= c
          },
        ),
        { numRuns: RUNS },
      )
    })
  })

  describe('dollarsToCents — Stripe round-trip', () => {
    // Stripe's API takes amounts in `unit_amount` cents (integer). Our
    // boundary is dollarsToCents(d) → unit_amount; on the way back we
    // receive unit_amount as cents and divide by 100 for display only.
    //
    // Round-trip invariant: a value that originated as integer cents and
    // is converted to dollars then back must be bit-stable. This protects
    // against Stripe webhook drift.
    it('cents → dollars → cents is bit-stable for any integer cents', () => {
      fc.assert(
        fc.property(cents(), (originalCents) => {
          const asDollars = fromCents(originalCents) / 100
          const roundTripped = dollarsToCents(asDollars)
          return roundTripped === originalCents
        }),
        { numRuns: RUNS },
      )
    })

    it('signed cents round-trip is also stable (refunds, credits)', () => {
      fc.assert(
        fc.property(signedCents(), (originalCents) => {
          const asDollars = fromCents(originalCents) / 100
          const roundTripped = dollarsToCents(asDollars)
          return roundTripped === originalCents
        }),
        { numRuns: RUNS },
      )
    })
  })

  describe('Aggregation — N-line accumulator drift', () => {
    // Reproduces the dashboard rollup pattern: N pay-app rows, sum
    // current_payment_due. Float reduce was the bug; cents reduce is the
    // fix. This test asserts the cents accumulator equals the algebraic
    // sum of the input integer cents — i.e., zero drift across N items.
    it('sum of N cent values equals the simple integer sum', () => {
      fc.assert(
        fc.property(
          fc.array(cents(), { minLength: 0, maxLength: 1_000 }),
          (items) => {
            const acc: Cents = items.reduce<Cents>(
              (s, x) => addCents(s, x),
              0 as Cents,
            )
            const reference = items.reduce<number>((s, x) => s + (x as number), 0)
            return (acc as number) === reference
          },
        ),
        { numRuns: 1_000 },
      )
    })
  })
})
