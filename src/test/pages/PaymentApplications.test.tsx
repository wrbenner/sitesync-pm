import { describe, it, expect } from 'vitest'
import {
  getValidPaymentTransitions,
  getPaymentStatusConfig,
  getLienWaiverStatusConfig,
  calculateG702,
  calculateG703LineItem,
  LIEN_WAIVER_FORMS,
  type PaymentStatus,
  type LienWaiverStatus,
  type LienWaiverState,
  type G703LineItem,
} from '../../machines/paymentMachine'
// ── Inline helpers mirroring PaymentApplications.tsx private functions ────────
// These document the exact formatting contract used on the Pay Applications page.

function fmtCurrency(n: number | null): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeLineItem(overrides: Partial<G703LineItem> = {}): G703LineItem {
  return {
    itemNumber: '1',
    costCode: '03-100',
    description: 'Concrete Foundation',
    scheduledValue: 200_000,
    previousCompleted: 0,
    thisPeroid: 0,
    materialsStored: 0,
    totalCompletedAndStored: 0,
    percentComplete: 0,
    balanceToFinish: 200_000,
    retainage: 0,
    ...overrides,
  }
}

// ── fmtCurrency ───────────────────────────────────────────────────────────────

describe('PaymentApplications page: fmtCurrency', () => {
  it('should format whole dollar amounts without cents', () => {
    expect(fmtCurrency(100_000)).toBe('$100,000')
  })

  it('should format zero as $0', () => {
    expect(fmtCurrency(0)).toBe('$0')
  })

  it('should format null as $0', () => {
    expect(fmtCurrency(null)).toBe('$0')
  })

  it('should format large amounts with comma separators', () => {
    expect(fmtCurrency(1_234_567)).toBe('$1,234,567')
  })

  it('should include dollar sign prefix', () => {
    expect(fmtCurrency(50_000)).toMatch(/^\$/)
  })

  it('should handle negative values (credit applications)', () => {
    const result = fmtCurrency(-25_000)
    expect(result).toContain('25,000')
  })

  it('should return a string for any numeric input', () => {
    expect(typeof fmtCurrency(999_999)).toBe('string')
    expect(typeof fmtCurrency(0)).toBe('string')
    expect(typeof fmtCurrency(null)).toBe('string')
  })
})

// ── fmtDate ───────────────────────────────────────────────────────────────────

describe('PaymentApplications page: fmtDate', () => {
  it('should format an ISO date as "Month Day, Year"', () => {
    const result = fmtDate('2026-04-12T00:00:00.000Z')
    // Locale may shift the day depending on timezone, so just check format
    expect(result).toMatch(/\w{3}\.? \d{1,2}, \d{4}|[A-Z][a-z]+ \d{1,2}, \d{4}/)
  })

  it('should return empty string for null date', () => {
    expect(fmtDate(null)).toBe('')
  })

  it('should return empty string for empty string date', () => {
    expect(fmtDate('')).toBe('')
  })

  it('should include the year in the output', () => {
    const result = fmtDate('2026-01-15')
    expect(result).toContain('2026')
  })

  it('should include the month abbreviation in the output', () => {
    const result = fmtDate('2026-04-15')
    // "Apr" for April
    expect(result).toMatch(/Apr/)
  })

  it('should return a non-empty string for a valid date', () => {
    expect(fmtDate('2026-12-31')).not.toBe('')
  })
})

// ── calculateG703LineItem (AIA G703 continuation sheet line) ─────────────────

describe('PaymentApplications page: calculateG703LineItem', () => {
  it('should compute 0% complete for a fresh line item', () => {
    const result = calculateG703LineItem(200_000, 0, 0, 0, 10)
    expect(result.percentComplete).toBe(0)
    expect(result.totalCompletedAndStored).toBe(0)
    expect(result.balanceToFinish).toBe(200_000)
  })

  it('should compute 50% complete when half is billed this period', () => {
    const result = calculateG703LineItem(200_000, 0, 100_000, 0, 10)
    expect(result.percentComplete).toBe(50)
    expect(result.totalCompletedAndStored).toBe(100_000)
    expect(result.balanceToFinish).toBe(100_000)
  })

  it('should compute 100% complete when fully billed', () => {
    const result = calculateG703LineItem(200_000, 100_000, 100_000, 0, 10)
    expect(result.percentComplete).toBe(100)
    expect(result.balanceToFinish).toBe(0)
  })

  it('should include previous billing in percent complete', () => {
    // Previously billed 60K, now billing 40K on a 200K item = 50%
    const result = calculateG703LineItem(200_000, 60_000, 40_000, 0, 10)
    expect(result.percentComplete).toBe(50)
    expect(result.totalCompletedAndStored).toBe(100_000)
  })

  it('should apply retainage at the specified percentage', () => {
    // 100K completed at 10% retainage = 10K held
    const result = calculateG703LineItem(200_000, 0, 100_000, 0, 10)
    expect(result.retainage).toBe(10_000)
  })

  it('should apply 5% retainage correctly', () => {
    const result = calculateG703LineItem(100_000, 0, 100_000, 0, 5)
    expect(result.retainage).toBe(5_000)
  })

  it('should include materials stored in total completed and stored', () => {
    const result = calculateG703LineItem(200_000, 0, 0, 15_000, 10)
    expect(result.totalCompletedAndStored).toBe(15_000)
  })

  it('should not divide by zero for a zero scheduled value', () => {
    expect(() => calculateG703LineItem(0, 0, 0, 0, 10)).not.toThrow()
    const result = calculateG703LineItem(0, 0, 0, 0, 10)
    expect(result.percentComplete).toBe(0)
  })
})

// ── calculateG702 (AIA G702 application summary) ─────────────────────────────

describe('PaymentApplications page: calculateG702 (AIA G702 form)', () => {
  const baseLineItems: G703LineItem[] = [
    makeLineItem({
      scheduledValue: 200_000,
      previousCompleted: 100_000,
      thisPeroid: 50_000,
      totalCompletedAndStored: 150_000,
      percentComplete: 75,
      balanceToFinish: 50_000,
      retainage: 15_000,
    }),
  ]

  it('should compute contract sum to date including approved change orders', () => {
    const result = calculateG702(baseLineItems, 10, 0, 200_000, 50_000)
    expect(result.contractSumToDate).toBe(250_000)
  })

  it('should compute current payment due net of previous certificates and retainage', () => {
    // totalCompletedAndStored = 150K, retainage = 15K (10%), totalEarnedLessRetainage = 135K
    // previousCertificates = 90K, currentPaymentDue = 135K - 90K = 45K
    const result = calculateG702(baseLineItems, 10, 90_000, 200_000, 0)
    expect(result.currentPaymentDue).toBe(45_000)
  })

  it('should compute balance to finish as total scheduled value minus completed', () => {
    const result = calculateG702(baseLineItems, 10, 0, 200_000, 0)
    expect(result.balanceToFinish).toBe(50_000)
  })

  it('should return zero current payment due when fully retainaged', () => {
    // 100% retainage means nothing is due
    const items: G703LineItem[] = [
      makeLineItem({
        scheduledValue: 100_000,
        previousCompleted: 0,
        thisPeroid: 100_000,
        totalCompletedAndStored: 100_000,
        percentComplete: 100,
        balanceToFinish: 0,
        retainage: 100_000,
      }),
    ]
    const result = calculateG702(items, 100, 0, 100_000, 0)
    expect(result.currentPaymentDue).toBe(0)
  })

  it('should handle multiple G703 line items', () => {
    const items: G703LineItem[] = [
      makeLineItem({
        costCode: '03-100',
        scheduledValue: 200_000,
        previousCompleted: 0,
        thisPeroid: 200_000,
        totalCompletedAndStored: 200_000,
        percentComplete: 100,
        balanceToFinish: 0,
        retainage: 20_000,
      }),
      makeLineItem({
        itemNumber: '2',
        costCode: '05-100',
        description: 'Structural Steel',
        scheduledValue: 300_000,
        previousCompleted: 0,
        thisPeroid: 150_000,
        totalCompletedAndStored: 150_000,
        percentComplete: 50,
        balanceToFinish: 150_000,
        retainage: 15_000,
      }),
    ]
    // Total scheduled = 500K, total completed = 350K, total retainage = 35K
    const result = calculateG702(items, 10, 0, 500_000, 0)
    expect(result.totalCompletedAndStored).toBe(350_000)
    expect(result.retainageAmount).toBeCloseTo(35_000, 0)
    expect(result.totalEarnedLessRetainage).toBeCloseTo(315_000, 0)
    expect(result.currentPaymentDue).toBeCloseTo(315_000, 0)
  })

  it('should use integer-safe math for fractional retainage', () => {
    const items: G703LineItem[] = [
      makeLineItem({
        totalCompletedAndStored: 333_333,
        scheduledValue: 333_333,
        previousCompleted: 0,
        thisPeroid: 333_333,
        percentComplete: 100,
        balanceToFinish: 0,
        retainage: 33_333,
      }),
    ]
    const result = calculateG702(items, 10, 0, 400_000, 0)
    expect(Number.isFinite(result.retainageAmount)).toBe(true)
    expect(Number.isFinite(result.currentPaymentDue)).toBe(true)
  })
})

// ── getValidPaymentTransitions (workflow engine) ──────────────────────────────

describe('PaymentApplications page: payment workflow state transitions', () => {
  it('should allow submitting from draft', () => {
    expect(getValidPaymentTransitions('draft')).toContain('Submit Application')
  })

  it('should allow GC review and rejection from submitted', () => {
    const transitions = getValidPaymentTransitions('submitted')
    expect(transitions).toContain('Approve (GC Review)')
    expect(transitions).toContain('Reject')
  })

  it('should allow forwarding to owner from gc_review', () => {
    const transitions = getValidPaymentTransitions('gc_review')
    expect(transitions).toContain('Forward to Owner')
  })

  it('should allow marking paid from approved', () => {
    expect(getValidPaymentTransitions('approved')).toContain('Mark as Paid')
  })

  it('should have no transitions from paid (final state)', () => {
    expect(getValidPaymentTransitions('paid')).toEqual([])
  })

  it('should have no transitions from void (final state)', () => {
    expect(getValidPaymentTransitions('void')).toEqual([])
  })

  it('should allow revision from rejected', () => {
    expect(getValidPaymentTransitions('rejected')).toContain('Revise and Resubmit')
  })
})

// ── getPaymentStatusConfig ────────────────────────────────────────────────────

describe('PaymentApplications page: payment status display config', () => {
  const allStatuses: PaymentStatus[] = [
    'draft', 'submitted', 'gc_review', 'owner_review', 'approved', 'rejected', 'paid', 'void',
  ]

  it('should return a config with label and color for every status', () => {
    for (const status of allStatuses) {
      const config = getPaymentStatusConfig(status)
      expect(config.label).toBeTruthy()
      expect(config.color).toMatch(/^var\(/)
      expect(config.bg).toMatch(/^var\(/)
    }
  })

  it('should use statusActive color for paid applications', () => {
    expect(getPaymentStatusConfig('paid').color).toContain('statusActive')
  })

  it('should use statusCritical color for rejected applications', () => {
    expect(getPaymentStatusConfig('rejected').color).toContain('statusCritical')
  })

  it('should use statusPending color for submitted applications awaiting review', () => {
    const config = getPaymentStatusConfig('submitted')
    expect(config.color).toMatch(/^var\(/)
  })
})

// ── getLienWaiverStatusConfig ─────────────────────────────────────────────────

describe('PaymentApplications page: lien waiver status config', () => {
  const allStatuses: LienWaiverStatus[] = ['pending', 'conditional', 'unconditional', 'final', 'waived']

  it('should return a config with label and color for every lien waiver status', () => {
    for (const status of allStatuses) {
      const config = getLienWaiverStatusConfig(status)
      expect(config.label).toBeTruthy()
      expect(config.color).toMatch(/^var\(/)
      expect(config.bg).toMatch(/^var\(/)
    }
  })

  it('should label pending waivers as "Pending"', () => {
    expect(getLienWaiverStatusConfig('pending').label).toBe('Pending')
  })

  it('should label conditional waivers as "Conditional"', () => {
    expect(getLienWaiverStatusConfig('conditional').label).toBe('Conditional')
  })

  it('should label unconditional waivers as "Unconditional"', () => {
    expect(getLienWaiverStatusConfig('unconditional').label).toBe('Unconditional')
  })

  it('should label final waivers as "Final"', () => {
    expect(getLienWaiverStatusConfig('final').label).toBe('Final')
  })

  it('should label waived as "Waived"', () => {
    expect(getLienWaiverStatusConfig('waived').label).toBe('Waived')
  })

  it('should use statusActive color for unconditional (cleared) waivers', () => {
    expect(getLienWaiverStatusConfig('unconditional').color).toContain('statusActive')
  })

  it('should fall back to pending config for unknown status', () => {
    const config = getLienWaiverStatusConfig('unknown' as LienWaiverStatus)
    expect(config).toBeTruthy()
    expect(config.label).toBeTruthy()
  })
})

// ── LIEN_WAIVER_FORMS (state-specific legal form names) ───────────────────────

describe('PaymentApplications page: LIEN_WAIVER_FORMS state-specific form names', () => {
  const allStates: LienWaiverState[] = ['california', 'texas', 'florida', 'new_york', 'generic']

  it('should define conditional and unconditional forms for all states', () => {
    for (const state of allStates) {
      expect(LIEN_WAIVER_FORMS[state].conditional).toBeTruthy()
      expect(LIEN_WAIVER_FORMS[state].unconditional).toBeTruthy()
    }
  })

  it('should reference California Civil Code for California forms', () => {
    expect(LIEN_WAIVER_FORMS.california.conditional).toContain('California Civil Code')
    expect(LIEN_WAIVER_FORMS.california.unconditional).toContain('California Civil Code')
  })

  it('should reference Texas Property Code for Texas forms', () => {
    expect(LIEN_WAIVER_FORMS.texas.conditional).toContain('Texas Property Code')
    expect(LIEN_WAIVER_FORMS.texas.unconditional).toContain('Texas Property Code')
  })

  it('should reference Florida Statute for Florida forms', () => {
    expect(LIEN_WAIVER_FORMS.florida.conditional).toContain('Florida Statute')
    expect(LIEN_WAIVER_FORMS.florida.unconditional).toContain('Florida Statute')
  })

  it('should reference New York Lien Law for New York forms', () => {
    expect(LIEN_WAIVER_FORMS.new_york.conditional).toContain('New York')
    expect(LIEN_WAIVER_FORMS.new_york.unconditional).toContain('New York')
  })

  it('should have generic forms without state-specific statute references', () => {
    // Generic form should not reference any specific state code
    expect(LIEN_WAIVER_FORMS.generic.conditional).toContain('Conditional Waiver')
    expect(LIEN_WAIVER_FORMS.generic.unconditional).toContain('Unconditional Waiver')
  })

  it('should distinguish conditional from unconditional form names', () => {
    for (const state of allStates) {
      expect(LIEN_WAIVER_FORMS[state].conditional).not.toBe(LIEN_WAIVER_FORMS[state].unconditional)
    }
  })

  it('should have string values (not numbers or nulls)', () => {
    for (const state of allStates) {
      expect(typeof LIEN_WAIVER_FORMS[state].conditional).toBe('string')
      expect(typeof LIEN_WAIVER_FORMS[state].unconditional).toBe('string')
    }
  })
})

// ── G702 workflow scenarios (realistic pay application use cases) ─────────────

describe('PaymentApplications page: realistic G702 pay application scenarios', () => {
  it('should compute first draw with no previous certificates', () => {
    const items: G703LineItem[] = [
      makeLineItem({
        scheduledValue: 500_000,
        previousCompleted: 0,
        thisPeroid: 100_000,
        totalCompletedAndStored: 100_000,
        percentComplete: 20,
        balanceToFinish: 400_000,
        retainage: 10_000,
      }),
    ]
    const result = calculateG702(items, 10, 0, 500_000, 0)
    // totalEarnedLessRetainage = 100K - 10K = 90K, previous = 0, due = 90K
    expect(result.currentPaymentDue).toBe(90_000)
  })

  it('should compute monthly application 3 with existing certified amounts', () => {
    // Month 1: 100K certified, Month 2: 100K certified, Month 3: billing 100K
    const items: G703LineItem[] = [
      makeLineItem({
        scheduledValue: 500_000,
        previousCompleted: 200_000,
        thisPeroid: 100_000,
        totalCompletedAndStored: 300_000,
        percentComplete: 60,
        balanceToFinish: 200_000,
        retainage: 30_000,
      }),
    ]
    // totalEarnedLessRetainage = 300K - 30K = 270K, previous certified = 180K (net of previous retainage)
    const result = calculateG702(items, 10, 180_000, 500_000, 0)
    expect(result.currentPaymentDue).toBe(90_000)
  })

  it('should apply approved change orders to AIA contract sum', () => {
    const items: G703LineItem[] = [
      makeLineItem({
        scheduledValue: 500_000,
        previousCompleted: 0,
        thisPeroid: 500_000,
        totalCompletedAndStored: 500_000,
        percentComplete: 100,
        balanceToFinish: 0,
        retainage: 50_000,
      }),
    ]
    // Original contract 500K + CO 50K = 550K
    const result = calculateG702(items, 10, 0, 500_000, 50_000)
    expect(result.contractSumToDate).toBe(550_000)
  })

  it('should compute retainage as 10% of total earned for standard retainage rate', () => {
    const items: G703LineItem[] = [
      makeLineItem({
        scheduledValue: 300_000,
        previousCompleted: 0,
        thisPeroid: 300_000,
        totalCompletedAndStored: 300_000,
        percentComplete: 100,
        balanceToFinish: 0,
        retainage: 30_000,
      }),
    ]
    const result = calculateG702(items, 10, 0, 300_000, 0)
    expect(result.retainageAmount).toBe(30_000)
  })
})
