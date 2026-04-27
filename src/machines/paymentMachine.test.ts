import { describe, it, expect } from 'vitest'
import {
  getValidPaymentTransitions,
  getPaymentStatusConfig,
  calculateG702,
  calculateG703LineItem,
  getLienWaiverStatusConfig,
  LIEN_WAIVER_FORMS,
  type G703LineItem,
} from './paymentMachine'

describe('paymentMachine — getValidPaymentTransitions', () => {
  it.each([
    ['draft', ['Submit Application']],
    ['submitted', ['Approve (GC Review)', 'Reject']],
    ['gc_review', ['Forward to Owner', 'Reject']],
    ['owner_review', ['Approve Payment', 'Reject']],
    ['approved', ['Mark as Paid', 'Void']],
    ['rejected', ['Revise and Resubmit', 'Void']],
    ['paid', []],
    ['void', []],
  ] as const)('%s → %j', (state, actions) => {
    expect(getValidPaymentTransitions(state)).toEqual(actions)
  })
})

describe('paymentMachine — getPaymentStatusConfig', () => {
  it.each([
    ['draft', 'Draft'],
    ['submitted', 'Submitted'],
    ['gc_review', 'GC Review'],
    ['owner_review', 'Owner Review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['paid', 'Paid'],
    ['void', 'Void'],
  ] as const)('%s → "%s"', (state, label) => {
    expect(getPaymentStatusConfig(state).label).toBe(label)
  })

  it('falls back to draft for unknown state', () => {
    // @ts-expect-error — exercising fallback
    expect(getPaymentStatusConfig('mystery').label).toBe('Draft')
  })
})

describe('paymentMachine — calculateG702 (AIA continuation sheet math)', () => {
  // Build a typical pay app: $100k contract, 2 line items, 50% complete
  const baseLines: G703LineItem[] = [
    {
      itemNumber: '01', costCode: '03-30-00', description: 'Concrete',
      scheduledValue: 50_000, previousCompleted: 20_000, thisPeriod: 5_000,
      materialsStored: 0, totalCompletedAndStored: 25_000, percentComplete: 50,
      balanceToFinish: 25_000, retainage: 0,
    },
    {
      itemNumber: '02', costCode: '04-20-00', description: 'Masonry',
      scheduledValue: 50_000, previousCompleted: 15_000, thisPeriod: 10_000,
      materialsStored: 0, totalCompletedAndStored: 25_000, percentComplete: 50,
      balanceToFinish: 25_000, retainage: 0,
    },
  ]

  it('contract sum to date = original + approved COs', () => {
    const r = calculateG702(baseLines, 10, 30_000, 100_000, 5_000)
    expect(r.contractSumToDate).toBe(105_000)
  })

  it('totalCompletedAndStored sums every line item', () => {
    const r = calculateG702(baseLines, 10, 30_000, 100_000, 0)
    expect(r.totalCompletedAndStored).toBe(50_000) // 25k + 25k
  })

  it('retainage = totalCompletedAndStored × retainagePercent', () => {
    const r = calculateG702(baseLines, 10, 30_000, 100_000, 0)
    expect(r.retainageAmount).toBe(5_000) // 10% of 50k
  })

  it('totalEarnedLessRetainage = totalCompletedAndStored - retainage', () => {
    const r = calculateG702(baseLines, 10, 30_000, 100_000, 0)
    expect(r.totalEarnedLessRetainage).toBe(45_000) // 50k - 5k
  })

  it('currentPaymentDue = totalEarnedLessRetainage - previousCertificates', () => {
    const r = calculateG702(baseLines, 10, 30_000, 100_000, 0)
    expect(r.currentPaymentDue).toBe(15_000) // 45k - 30k
  })

  it('balanceToFinish = contractSumToDate - totalCompletedAndStored', () => {
    const r = calculateG702(baseLines, 10, 30_000, 100_000, 0)
    expect(r.balanceToFinish).toBe(50_000) // 100k - 50k
  })

  it('handles 0% retainage correctly', () => {
    const r = calculateG702(baseLines, 0, 30_000, 100_000, 0)
    expect(r.retainageAmount).toBe(0)
    expect(r.totalEarnedLessRetainage).toBe(50_000)
  })

  it('handles empty line items (zeroed totals)', () => {
    const r = calculateG702([], 10, 0, 100_000, 0)
    expect(r.totalCompletedAndStored).toBe(0)
    expect(r.retainageAmount).toBe(0)
    expect(r.balanceToFinish).toBe(100_000)
  })
})

describe('paymentMachine — calculateG703LineItem', () => {
  it('totalCompletedAndStored = previous + thisPeriod + materialsStored', () => {
    const r = calculateG703LineItem(50_000, 10_000, 5_000, 2_000, 10)
    expect(r.totalCompletedAndStored).toBe(17_000)
  })

  it('percentComplete is 0 when scheduled value is 0', () => {
    const r = calculateG703LineItem(0, 0, 0, 0, 10)
    expect(r.percentComplete).toBe(0)
  })

  it('percentComplete = total / scheduled, rounded to 2 decimals', () => {
    // 17_000 / 50_000 = 34.00%
    const r = calculateG703LineItem(50_000, 10_000, 5_000, 2_000, 10)
    expect(r.percentComplete).toBe(34)
  })

  it('balanceToFinish = scheduled - total', () => {
    const r = calculateG703LineItem(50_000, 10_000, 5_000, 2_000, 10)
    expect(r.balanceToFinish).toBe(33_000)
  })

  it('retainage = total × retainagePercent / 100', () => {
    const r = calculateG703LineItem(50_000, 10_000, 5_000, 2_000, 10)
    expect(r.retainage).toBe(1_700) // 10% of 17k
  })
})

describe('paymentMachine — getLienWaiverStatusConfig', () => {
  it.each([
    ['pending', 'Pending'],
    ['conditional', 'Conditional'],
    ['unconditional', 'Unconditional'],
    ['final', 'Final'],
    ['waived', 'Waived'],
  ] as const)('%s → "%s"', (status, label) => {
    expect(getLienWaiverStatusConfig(status).label).toBe(label)
  })
})

describe('paymentMachine — LIEN_WAIVER_FORMS', () => {
  it('every supported state has both conditional + unconditional form names', () => {
    const states = ['california', 'texas', 'florida', 'new_york', 'generic'] as const
    for (const s of states) {
      expect(LIEN_WAIVER_FORMS[s].conditional).toBeTruthy()
      expect(LIEN_WAIVER_FORMS[s].unconditional).toBeTruthy()
    }
  })

  it('California references the correct civil code section', () => {
    expect(LIEN_WAIVER_FORMS.california.conditional).toMatch(/§\s*8132/)
    expect(LIEN_WAIVER_FORMS.california.unconditional).toMatch(/§\s*8134/)
  })

  it('Texas references property code § 53.284', () => {
    expect(LIEN_WAIVER_FORMS.texas.conditional).toMatch(/§\s*53\.284/)
  })
})
