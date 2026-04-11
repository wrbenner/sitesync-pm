/**
 * Unit tests for computeCurrentPaymentDue (AIA G702 calculation engine).
 * This function is a pure calculation with no Supabase dependency and can be
 * tested in full isolation.
 */
import { describe, it, expect } from 'vitest'
import { computeCurrentPaymentDue } from '../../api/endpoints/payApplications'

describe('computeCurrentPaymentDue (AIA G702 line items)', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  it('should compute a basic draw correctly', () => {
    // Scheduled value $100k, was 0%, now 50%, no stored materials, 10% retainage
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.0,
      currentPctComplete: 0.5,
      storedMaterials: 0,
      retainageRate: 0.10,
    })
    expect(result.workThisPeriod).toBe(50_000)
    expect(result.totalCompletedAndStored).toBe(50_000)
    expect(result.line5).toBe(50_000)
    expect(result.line5a).toBe(5_000)   // 10% of completed work
    expect(result.line5b).toBe(0)        // no stored materials retainage
    expect(result.line6).toBe(45_000)   // 50_000 - 5_000
    expect(result.currentPaymentDue).toBe(45_000) // line6 - 0 previous certs
  })

  it('should subtract previous certificates from current payment due', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.0,
      currentPctComplete: 0.50,
      storedMaterials: 0,
      retainageRate: 0.10,
      previousCertificates: 30_000,
    })
    // line6 = 45_000; currentPaymentDue = 45_000 - 30_000 = 15_000
    expect(result.currentPaymentDue).toBe(15_000)
  })

  it('should handle incremental draws across multiple periods', () => {
    // Period 1: 0% to 40%
    const period1 = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.0,
      currentPctComplete: 0.4,
      storedMaterials: 0,
      retainageRate: 0.10,
    })
    expect(period1.workThisPeriod).toBe(40_000)
    expect(period1.currentPaymentDue).toBe(36_000) // 40_000 * 0.9

    // Period 2: 40% to 70%
    const period2 = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.4,
      currentPctComplete: 0.7,
      storedMaterials: 0,
      retainageRate: 0.10,
      previousCertificates: period1.currentPaymentDue,
    })
    expect(period2.workThisPeriod).toBe(30_000)
    // totalCompleted = 70_000, retainage = 7_000, line6 = 63_000
    // currentPaymentDue = 63_000 - 36_000 = 27_000
    expect(period2.currentPaymentDue).toBe(27_000)
  })

  it('should include stored materials in total completed and stored', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.0,
      currentPctComplete: 0.5,
      storedMaterials: 10_000,
      retainageRate: 0.10,
    })
    // totalCompletedAndStored = 50_000 + 10_000 = 60_000
    expect(result.totalCompletedAndStored).toBe(60_000)
    expect(result.line5).toBe(60_000)
  })

  it('should apply different retainage rates to stored materials when specified', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.0,
      currentPctComplete: 0.50,
      storedMaterials: 10_000,
      retainageRate: 0.10,
      storedMaterialRetainageRate: 0.05,
    })
    // line5a = (60_000 - 10_000) * 0.10 = 5_000 (completed work only)
    // line5b = 10_000 * 0.05 = 500 (stored materials at lower rate)
    expect(result.line5a).toBe(5_000)
    expect(result.line5b).toBe(500)
    expect(result.line6).toBe(60_000 - 5_000 - 500) // 54_500
  })

  it('should handle 100% completion with no remaining balance', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.9,
      currentPctComplete: 1.0,
      storedMaterials: 0,
      retainageRate: 0.10,
      previousCertificates: 81_000, // previous earned less retainage (90k * 0.9)
    })
    // workThisPeriod = 10_000, total = 100_000
    // retainage = 10_000, line6 = 90_000
    // currentPaymentDue = 90_000 - 81_000 = 9_000
    expect(result.workThisPeriod).toBe(10_000)
    expect(result.currentPaymentDue).toBe(9_000)
  })

  it('should handle zero retainage rate (retainage release)', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.0,
      currentPctComplete: 0.5,
      storedMaterials: 0,
      retainageRate: 0.0,
    })
    expect(result.line5a).toBe(0)
    expect(result.line6).toBe(result.line5)
    expect(result.currentPaymentDue).toBe(50_000)
  })

  it('should handle zero scheduled value (not yet awarded)', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 0,
      prevPctComplete: 0.0,
      currentPctComplete: 0.0,
      storedMaterials: 0,
      retainageRate: 0.10,
    })
    expect(result.workThisPeriod).toBe(0)
    expect(result.currentPaymentDue).toBe(0)
  })

  it('should produce integer-safe results without floating-point drift', () => {
    // 1/3 percent values are notorious for floating-point errors
    const result = computeCurrentPaymentDue({
      scheduledValue: 300_000,
      prevPctComplete: 0.0,
      currentPctComplete: 1 / 3,
      storedMaterials: 0,
      retainageRate: 0.10,
    })
    // All intermediate values must be finite with no NaN
    expect(Number.isFinite(result.workThisPeriod)).toBe(true)
    expect(Number.isFinite(result.retainageAmount)).toBe(true)
    expect(Number.isFinite(result.currentPaymentDue)).toBe(true)
    // Should be rounded to cents: re-rounding an already-rounded value is a no-op
    expect(Math.round(result.workThisPeriod * 100) / 100).toBe(result.workThisPeriod)
    expect(Math.round(result.retainageAmount * 100) / 100).toBe(result.retainageAmount)
  })

  // ── Error cases ────────────────────────────────────────────────────────────

  it('should throw when currentPctComplete > 1', () => {
    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 100_000,
        prevPctComplete: 0.0,
        currentPctComplete: 1.5,
        storedMaterials: 0,
        retainageRate: 0.10,
      })
    ).toThrow()
  })

  it('should throw when prevPctComplete < 0', () => {
    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 100_000,
        prevPctComplete: -0.1,
        currentPctComplete: 0.5,
        storedMaterials: 0,
        retainageRate: 0.10,
      })
    ).toThrow()
  })

  it('should throw when currentPctComplete < prevPctComplete (regression)', () => {
    // Cannot go backward in completion within a pay period
    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 100_000,
        prevPctComplete: 0.6,
        currentPctComplete: 0.4,
        storedMaterials: 0,
        retainageRate: 0.10,
      })
    ).toThrow(/cannot be less than previous/)
  })

  it('should throw when retainageRate > 1', () => {
    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 100_000,
        prevPctComplete: 0.0,
        currentPctComplete: 0.5,
        storedMaterials: 0,
        retainageRate: 1.5,
      })
    ).toThrow()
  })

  it('should throw when retainageRate < 0', () => {
    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 100_000,
        prevPctComplete: 0.0,
        currentPctComplete: 0.5,
        storedMaterials: 0,
        retainageRate: -0.1,
      })
    ).toThrow()
  })

  // ── Edge: equal prevPct and currentPct ────────────────────────────────────

  it('should produce zero workThisPeriod when percentages are equal', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.5,
      currentPctComplete: 0.5,
      storedMaterials: 0,
      retainageRate: 0.10,
    })
    expect(result.workThisPeriod).toBe(0)
  })

  // ── Line number aliases ────────────────────────────────────────────────────

  it('should expose retainageAmount as an alias for line5a', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.0,
      currentPctComplete: 0.5,
      storedMaterials: 0,
      retainageRate: 0.10,
    })
    expect(result.retainageAmount).toBe(result.line5a)
  })

  it('should expose retainageOnStored as an alias for line5b', () => {
    const result = computeCurrentPaymentDue({
      scheduledValue: 100_000,
      prevPctComplete: 0.0,
      currentPctComplete: 0.5,
      storedMaterials: 5_000,
      retainageRate: 0.10,
      storedMaterialRetainageRate: 0.05,
    })
    expect(result.retainageOnStored).toBe(result.line5b)
  })
})
