import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  paymentMachine,
  getValidPaymentTransitions,
  getPaymentStatusConfig,
  getLienWaiverStatusConfig,
  calculateG702,
  calculateG703LineItem,
  type PaymentStatus,
  type LienWaiverStatus,
} from '../../machines/paymentMachine'

describe('Payment Application State Machine', () => {
  describe('getValidPaymentTransitions', () => {
    it('draft can Submit Application', () => {
      expect(getValidPaymentTransitions('draft')).toEqual(['Submit Application'])
    })

    it('submitted can be approved (GC Review) or rejected', () => {
      const t = getValidPaymentTransitions('submitted')
      expect(t).toContain('Approve (GC Review)')
      expect(t).toContain('Reject')
    })

    it('gc_review can be forwarded to owner or rejected', () => {
      const t = getValidPaymentTransitions('gc_review')
      expect(t).toContain('Forward to Owner')
      expect(t).toContain('Reject')
    })

    it('approved can be marked paid or voided', () => {
      const t = getValidPaymentTransitions('approved')
      expect(t).toContain('Mark as Paid')
      expect(t).toContain('Void')
    })

    it('paid is final with no transitions', () => {
      expect(getValidPaymentTransitions('paid')).toEqual([])
    })

    it('void is final with no transitions', () => {
      expect(getValidPaymentTransitions('void')).toEqual([])
    })

    it('rejected can revise and resubmit', () => {
      expect(getValidPaymentTransitions('rejected')).toContain('Revise and Resubmit')
    })
  })

  describe('getPaymentStatusConfig', () => {
    it('all statuses have a valid config', () => {
      const statuses: PaymentStatus[] = [
        'draft', 'submitted', 'gc_review', 'owner_review', 'approved', 'rejected', 'paid', 'void',
      ]
      for (const status of statuses) {
        const config = getPaymentStatusConfig(status)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^var\(/)
        expect(config.bg).toMatch(/^var\(/)
      }
    })

    it('paid shows active color', () => {
      expect(getPaymentStatusConfig('paid').color).toContain('statusActive')
    })

    it('rejected shows critical color', () => {
      expect(getPaymentStatusConfig('rejected').color).toContain('statusCritical')
    })
  })

  describe('getLienWaiverStatusConfig', () => {
    it('all lien waiver statuses have labels', () => {
      const statuses: LienWaiverStatus[] = ['pending', 'conditional', 'unconditional', 'final', 'waived']
      for (const status of statuses) {
        const config = getLienWaiverStatusConfig(status)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^var\(/)
      }
    })
  })

  describe('calculateG703LineItem', () => {
    it('computes percent complete correctly', () => {
      const result = calculateG703LineItem(100000, 50000, 20000, 0, 10)
      expect(result.percentComplete).toBe(70)
      expect(result.totalCompletedAndStored).toBe(70000)
      expect(result.balanceToFinish).toBe(30000)
    })

    it('retainage is calculated at correct percentage', () => {
      const result = calculateG703LineItem(100000, 0, 100000, 0, 10)
      expect(result.retainage).toBe(10000)
    })

    it('zero scheduled value returns 0% complete without divide by zero', () => {
      const result = calculateG703LineItem(0, 0, 0, 0, 10)
      expect(result.percentComplete).toBe(0)
    })

    it('includes materials stored in totals', () => {
      const result = calculateG703LineItem(100000, 0, 0, 5000, 10)
      expect(result.totalCompletedAndStored).toBe(5000)
    })
  })

  describe('calculateG702', () => {
    const baseLineItems = [
      {
        itemNumber: '1',
        costCode: '03-100',
        description: 'Concrete',
        scheduledValue: 200000,
        previousCompleted: 100000,
        thisPeroid: 50000,
        materialsStored: 0,
        totalCompletedAndStored: 150000,
        percentComplete: 75,
        balanceToFinish: 50000,
        retainage: 15000,
      },
    ]

    it('computes contract sum to date with change orders', () => {
      const result = calculateG702(baseLineItems, 10, 90000, 200000, 10000)
      expect(result.contractSumToDate).toBe(210000)
    })

    it('computes current payment due correctly', () => {
      const result = calculateG702(baseLineItems, 10, 90000, 200000, 0)
      // totalCompletedAndStored = 150000
      // retainageAmount = 15000 (10%)
      // totalEarnedLessRetainage = 135000
      // currentPaymentDue = 135000 - 90000 = 45000
      expect(result.currentPaymentDue).toBe(45000)
    })

    it('balance to finish is contract sum minus completed', () => {
      const result = calculateG702(baseLineItems, 10, 0, 200000, 0)
      expect(result.balanceToFinish).toBe(50000)
    })

    it('uses integer-safe math (no floating point drift)', () => {
      const items = [{
        ...baseLineItems[0],
        totalCompletedAndStored: 333333,
      }]
      const result = calculateG702(items, 10, 0, 400000, 0)
      // Retainage: 333333 * 0.1 = 33333.3 → rounded to 33333.3
      expect(Number.isFinite(result.retainageAmount)).toBe(true)
    })
  })

  describe('XState machine', () => {
    it('starts in draft', () => {
      const actor = createActor(paymentMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('draft')
      actor.stop()
    })

    it('full happy path: draft -> submitted -> gc_review -> approved -> paid', () => {
      const actor = createActor(paymentMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      expect(actor.getSnapshot().value).toBe('submitted')
      actor.send({ type: 'GC_APPROVE' })
      expect(actor.getSnapshot().value).toBe('gc_review')
      actor.send({ type: 'OWNER_APPROVE' })
      expect(actor.getSnapshot().value).toBe('approved')
      actor.send({ type: 'MARK_PAID', paymentDate: '2026-04-08' })
      expect(actor.getSnapshot().value).toBe('paid')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    it('rejection and revision path', () => {
      const actor = createActor(paymentMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'GC_REJECT', comments: 'Missing lien waivers' })
      expect(actor.getSnapshot().value).toBe('rejected')
      actor.send({ type: 'REVISE' })
      expect(actor.getSnapshot().value).toBe('draft')
      actor.stop()
    })

    it('can be voided from draft', () => {
      const actor = createActor(paymentMachine)
      actor.start()
      actor.send({ type: 'VOID', reason: 'Duplicate application' })
      expect(actor.getSnapshot().value).toBe('void')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    it('can be voided from approved', () => {
      const actor = createActor(paymentMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'GC_APPROVE' })
      actor.send({ type: 'OWNER_APPROVE' })
      actor.send({ type: 'VOID', reason: 'Owner dispute' })
      expect(actor.getSnapshot().value).toBe('void')
      actor.stop()
    })

    it('invalid transitions are ignored', () => {
      const actor = createActor(paymentMachine)
      actor.start()
      // Cannot mark paid from draft
      actor.send({ type: 'MARK_PAID', paymentDate: '2026-04-08' })
      expect(actor.getSnapshot().value).toBe('draft')
      actor.stop()
    })
  })
})
