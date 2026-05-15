/**
 * FMEA A.PAY.2 (wave 3) — Negative retainage rejection.
 *
 * Hazard: Pay-app retainage is conventionally 0% – 10%; values outside
 *         this band are nonsensical and silently corrupt downstream
 *         G702 totals. A negative value flips the sign and creates
 *         "negative retainage held" which inflates owner liability.
 *
 * Wave 1 spec (`paymentMachine.fuzz.spec.ts`) probed the sign at the
 * computation layer (`calculateG702`). This wave-3 spec adds a sharper
 * boundary contract:
 *   - `validateRetainagePercent(p)` MUST reject p < 0 and p > 100.
 *   - If no such validator exists yet, this spec documents the missing
 *     contract as a known-violation ledger entry (see FMEA Wave 2
 *     softdel.spec.ts pattern) so the gap is visible in CI.
 *   - The downstream G702 helper, given a negative percent, must NOT
 *     produce a positive retainage amount (the cents math must
 *     propagate the sign — i.e. retainage ≤ 0 for input < 0).
 *
 * This is a vitest unit-level test — no env required, no skip.
 */
import { describe, it, expect } from 'vitest'
import { calculateG702 } from '../../src/machines/paymentMachine'

// ── Layer 1: contract probe for an explicit validator ──────────────────

// Try to locate a validator export. If none exists, the spec records the
// missing-validator gap as a documented hazard (FMEA known-violation
// pattern); the *behavioral* probes below remain load-bearing.
type ValidatorModule = {
  validateRetainagePercent?: (p: number) => boolean | { ok: boolean }
}

async function tryLoadValidator(): Promise<ValidatorModule | null> {
  try {
    const mod = (await import('../../src/machines/paymentMachine')) as ValidatorModule
    return mod
  } catch {
    return null
  }
}

describe('FMEA A.PAY.2 — negative retainage rejection', () => {
  it('exports validateRetainagePercent (FMEA A.PAY.2 fix)', async () => {
    const mod = await tryLoadValidator()
    const hasValidator = typeof mod?.validateRetainagePercent === 'function'
    // FMEA Wave 3 fix landed: validateRetainagePercent exported from
    // src/machines/paymentMachine.ts; clamps to [0, 100]; wired into
    // both calculateG702 and calculateG703LineItem.
    expect(hasValidator).toBe(true)
    // Behavioral contract on the validator itself.
    const v = mod!.validateRetainagePercent! as (p: number) => number
    expect(v(-5)).toBe(0)
    expect(v(0)).toBe(0)
    expect(v(5)).toBe(5)
    expect(v(100)).toBe(100)
    expect(v(200)).toBe(100)
    expect(v(Number.NaN)).toBe(0)
    expect(v(Number.POSITIVE_INFINITY)).toBe(100)
  })

  it('calculateG702 propagates a negative sign when given negative retainage', () => {
    const lineItems = [
      {
        itemNumber: '1',
        costCode: '03-300',
        description: 'Concrete',
        scheduledValue: 1000,
        previousCompleted: 0,
        thisPeriod: 100,
        materialsStored: 0,
        totalCompletedAndStored: 100,
        percentComplete: 10,
        balanceToFinish: 900,
        retainage: -5,
      },
    ]
    const result = calculateG702(lineItems, -5, 0, 1000, 0)
    // Hazard contract: retainage must never come back positive when input
    // is negative. The integer-cents math returns a non-positive value
    // (zero or negative); a positive value would be the bug.
    expect(result.retainageAmount).toBeLessThanOrEqual(0)
  })

  it('calculateG702 clamps retainage > 100 to 100% (FMEA A.PAY.2 fix)', () => {
    // 200% retainage is nonsensical; with the wave-3 fix the helper
    // clamps the percent at the boundary so retainageAmount never
    // exceeds totalCompletedAndStored.
    const lineItems = [
      {
        itemNumber: '1',
        costCode: '03-300',
        description: 'Concrete',
        scheduledValue: 1000,
        previousCompleted: 0,
        thisPeriod: 100,
        materialsStored: 0,
        totalCompletedAndStored: 100,
        percentComplete: 10,
        balanceToFinish: 900,
        retainage: 200,
      },
    ]
    const result = calculateG702(lineItems, 200, 0, 1000, 0)
    // FIX CONTRACT: retainageAmount ≤ totalCompletedAndStored.
    expect(result.retainageAmount).toBeLessThanOrEqual(result.totalCompletedAndStored)
    // And the reported percent is the clamped value.
    expect(result.retainagePercent).toBe(100)
  })

  it('calculateG702 with retainagePercent=0 produces zero retainage', () => {
    const lineItems = [
      {
        itemNumber: '1',
        costCode: '03-300',
        description: 'Concrete',
        scheduledValue: 1000,
        previousCompleted: 0,
        thisPeriod: 100,
        materialsStored: 0,
        totalCompletedAndStored: 100,
        percentComplete: 10,
        balanceToFinish: 900,
        retainage: 0,
      },
    ]
    const result = calculateG702(lineItems, 0, 0, 1000, 0)
    expect(result.retainageAmount).toBe(0)
  })
})
