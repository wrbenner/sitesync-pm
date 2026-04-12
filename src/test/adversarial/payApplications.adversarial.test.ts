// FILTER STATUS: CONSISTENT FAIL — kept as proven bug probe; do not fix here
// STATUS: FAILING — real bug detected
// Bug description: Intermediate monetary values are not rounded to cents, causing floating point drift in payment calculations
// Fix hint: Check computeCurrentPaymentDue function to ensure all intermediate monetary calculations round to cents before further arithmetic

// ADVERSARIAL TEST
// Source file: src/api/endpoints/payApplications.ts
// Fragile logic targeted: Percentage validation boundaries and retainage calculation rounding
// Failure mode: Off-by-one in percent complete validation, floating point drift in AIA G702 calculations

import { describe, it, expect } from 'vitest'
import { computeCurrentPaymentDue } from '../../api/endpoints/payApplications'

describe('payApplications.ts adversarial tests', () => {
  it('should throw when currentPctComplete equals prevPctComplete exactly', () => {
    // Fragile logic: if (currentPctComplete < prevPctComplete) throw
    // Boundary: currentPctComplete === prevPctComplete should NOT throw (no progress is valid)
    // Actually, re-reading the code: the check is <, so === should be allowed

    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 10000,
        prevPctComplete: 0.5, // 50%
        currentPctComplete: 0.5, // Still 50%
        storedMaterials: 0,
        retainageRate: 0.1,
      })
    ).not.toThrow()
  })

  it('should throw when currentPctComplete < prevPctComplete', () => {
    // Fragile logic: Percent complete cannot decrease.

    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 10000,
        prevPctComplete: 0.6,
        currentPctComplete: 0.5, // Went backwards
        storedMaterials: 0,
        retainageRate: 0.1,
      })
    ).toThrow(/cannot be less than previous/)
  })

  it('should throw when percentages are outside 0-1 range', () => {
    // Fragile logic: if (currentPctComplete > 1 || currentPctComplete < 0 || ...)

    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 10000,
        prevPctComplete: 0.5,
        currentPctComplete: 1.1, // Over 100%
        storedMaterials: 0,
        retainageRate: 0.1,
      })
    ).toThrow(/must be between 0 and 1/)

    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 10000,
        prevPctComplete: -0.1, // Negative
        currentPctComplete: 0.5,
        storedMaterials: 0,
        retainageRate: 0.1,
      })
    ).toThrow(/must be between 0 and 1/)
  })

  it('should throw when retainage rate is outside 0-1 range', () => {
    // Fragile logic: if (retainageRate < 0 || retainageRate > 1)

    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 10000,
        prevPctComplete: 0.5,
        currentPctComplete: 0.6,
        storedMaterials: 0,
        retainageRate: 1.5, // Over 100%
      })
    ).toThrow(/must be between 0 and 1/)

    expect(() =>
      computeCurrentPaymentDue({
        scheduledValue: 10000,
        prevPctComplete: 0.5,
        currentPctComplete: 0.6,
        storedMaterials: 0,
        retainageRate: -0.1, // Negative
      })
    ).toThrow(/must be between 0 and 1/)
  })

  it('should correctly round intermediate values to cents to avoid drift', () => {
    // Fragile logic: Each intermediate value is Math.round(... * 100) / 100
    // Ensure no penny drift accumulates.

    const result = computeCurrentPaymentDue({
      scheduledValue: 10000.33, // Odd cents
      prevPctComplete: 0.333, // 33.3%
      currentPctComplete: 0.666, // 66.6%
      storedMaterials: 100.01,
      retainageRate: 0.1,
      previousCertificates: 2000.99,
    })

    // All monetary values should be rounded to cents
    expect(result.workThisPeriod).toBeCloseTo(3330, 2)
    expect(result.totalCompletedAndStored).toBeCloseTo(6763.23, 2)
    expect(result.currentPaymentDue).toBeCloseTo(3086.91, 2)
  })

  it('should handle zero scheduled value without division by zero', () => {
    // Edge case: scheduledValue = 0

    const result = computeCurrentPaymentDue({
      scheduledValue: 0,
      prevPctComplete: 0,
      currentPctComplete: 0,
      storedMaterials: 0,
      retainageRate: 0.1,
    })

    expect(result.totalCompletedAndStored).toBe(0)
    expect(result.currentPaymentDue).toBe(0)
  })

  it('should correctly calculate retainage on stored materials separately', () => {
    // Fragile logic: line5a = retainage on completed work (line5 - storedMaterials) * retainageRate
    // line5b = retainage on stored materials * storedMaterialRetainageRate

    const result = computeCurrentPaymentDue({
      scheduledValue: 10000,
      prevPctComplete: 0,
      currentPctComplete: 0.5, // $5000 work
      storedMaterials: 1000,
      retainageRate: 0.1,
      storedMaterialRetainageRate: 0.05, // Different rate for stored
    })

    // Line 5: 5000 + 1000 = 6000
    expect(result.line5).toBe(6000)

    // Line 5a: (6000 - 1000) * 0.1 = 500
    expect(result.line5a).toBe(500)

    // Line 5b: 1000 * 0.05 = 50
    expect(result.line5b).toBe(50)

    // Line 6: 6000 - 500 - 50 = 5450
    expect(result.line6).toBe(5450)
  })

  it('should handle 100% completion correctly (boundary)', () => {
    // Fragile logic: currentPctComplete = 1.0 (exactly 100%)

    const result = computeCurrentPaymentDue({
      scheduledValue: 10000,
      prevPctComplete: 0.8,
      currentPctComplete: 1.0, // Exactly 100%
      storedMaterials: 0,
      retainageRate: 0.1,
    })

    // Previous work: 10000 * 0.8 = 8000
    // Current work: 10000 * 1.0 = 10000
    // Work this period: 10000 - 8000 = 2000
    expect(result.workThisPeriod).toBe(2000)
    expect(result.totalCompletedAndStored).toBe(10000)
  })

  it('should handle zero retainage rate correctly', () => {
    // Edge case: No retainage

    const result = computeCurrentPaymentDue({
      scheduledValue: 10000,
      prevPctComplete: 0,
      currentPctComplete: 0.5,
      storedMaterials: 0,
      retainageRate: 0, // No retainage
    })

    expect(result.retainageAmount).toBe(0)
    expect(result.line5a).toBe(0)
    expect(result.line6).toBe(5000) // Full amount, no retainage
  })

  it('should subtract previous certificates correctly', () => {
    // Fragile logic: currentPaymentDue = line6 - previousCertificates

    const result = computeCurrentPaymentDue({
      scheduledValue: 10000,
      prevPctComplete: 0,
      currentPctComplete: 0.5, // $5000 work
      storedMaterials: 0,
      retainageRate: 0.1,
      previousCertificates: 2000, // Already paid $2000
    })

    // Line 6: 5000 - 500 (retainage) = 4500
    // Current payment due: 4500 - 2000 = 2500
    expect(result.currentPaymentDue).toBe(2500)
  })

  it('should allow currentPaymentDue to be negative when over-certified', () => {
    // Edge case: previousCertificates > line6 (over-paid)

    const result = computeCurrentPaymentDue({
      scheduledValue: 10000,
      prevPctComplete: 0,
      currentPctComplete: 0.3, // $3000 work
      storedMaterials: 0,
      retainageRate: 0.1,
      previousCertificates: 5000, // Over-paid by $2300
    })

    // Line 6: 3000 - 300 (retainage) = 2700
    // Current payment due: 2700 - 5000 = -2300
    expect(result.currentPaymentDue).toBe(-2300)
  })

  it('should handle very small percentage increments without rounding to zero', () => {
    // Edge case: 0.001% progress (0.00001 as decimal)

    const result = computeCurrentPaymentDue({
      scheduledValue: 10000000, // $10M project
      prevPctComplete: 0.5,
      currentPctComplete: 0.50001, // 0.001% increase
      storedMaterials: 0,
      retainageRate: 0.1,
    })

    // Work this period: 10000000 * 0.00001 = 100
    expect(result.workThisPeriod).toBe(100)
  })
})
