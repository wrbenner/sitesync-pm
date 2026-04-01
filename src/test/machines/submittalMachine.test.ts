import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  submittalMachine,
  getValidSubmittalTransitions,
  getNextSubmittalStatus,
  getSubmittalStatusConfig,
  getStampConfig,
  getLeadTimeUrgency,
  CSI_DIVISIONS,
  type SubmittalState,
  type SubmittalStamp,
} from '../../machines/submittalMachine'

describe('Submittal State Machine', () => {
  // ── Transition function tests ──────────────────────────

  describe('getValidSubmittalTransitions', () => {
    it('draft can Submit for Review', () => {
      expect(getValidSubmittalTransitions('draft')).toEqual(['Submit for Review'])
    })

    it('submitted can GC Approve or GC Reject', () => {
      const t = getValidSubmittalTransitions('submitted')
      expect(t).toContain('GC Approve')
      expect(t).toContain('GC Reject')
    })

    it('gc_review can Forward to Architect, GC Reject, or Revise', () => {
      const t = getValidSubmittalTransitions('gc_review')
      expect(t).toContain('Forward to Architect')
      expect(t).toContain('GC Reject')
      expect(t).toContain('Revise and Resubmit')
    })

    it('architect_review can Architect Approve, Reject, or Revise', () => {
      const t = getValidSubmittalTransitions('architect_review')
      expect(t).toContain('Architect Approve')
      expect(t).toContain('Architect Reject')
      expect(t).toContain('Revise and Resubmit')
    })

    it('approved can Close Out', () => {
      expect(getValidSubmittalTransitions('approved')).toEqual(['Close Out'])
    })

    it('rejected can Revise and Resubmit', () => {
      expect(getValidSubmittalTransitions('rejected')).toEqual(['Revise and Resubmit'])
    })

    it('resubmit can Revise and Resubmit', () => {
      expect(getValidSubmittalTransitions('resubmit')).toEqual(['Revise and Resubmit'])
    })

    it('closed is final', () => {
      expect(getValidSubmittalTransitions('closed')).toEqual([])
    })

    it('unknown status returns empty', () => {
      expect(getValidSubmittalTransitions('fake' as SubmittalState)).toEqual([])
    })
  })

  describe('getNextSubmittalStatus', () => {
    it('Submit from draft goes to submitted', () => {
      expect(getNextSubmittalStatus('draft', 'Submit for Review')).toBe('submitted')
    })

    it('GC Approve from submitted goes to gc_review', () => {
      expect(getNextSubmittalStatus('submitted', 'GC Approve')).toBe('gc_review')
    })

    it('GC Reject from submitted goes to rejected', () => {
      expect(getNextSubmittalStatus('submitted', 'GC Reject')).toBe('rejected')
    })

    // BUG #1 FIX TEST: gc_review Forward to Architect goes to architect_review
    it('Forward to Architect from gc_review goes to architect_review', () => {
      expect(getNextSubmittalStatus('gc_review', 'Forward to Architect')).toBe('architect_review')
    })

    it('GC Reject from gc_review goes to rejected', () => {
      expect(getNextSubmittalStatus('gc_review', 'GC Reject')).toBe('rejected')
    })

    it('Architect Approve from architect_review goes to approved', () => {
      expect(getNextSubmittalStatus('architect_review', 'Architect Approve')).toBe('approved')
    })

    it('Architect Reject from architect_review goes to rejected', () => {
      expect(getNextSubmittalStatus('architect_review', 'Architect Reject')).toBe('rejected')
    })

    it('Revise from architect_review goes to resubmit', () => {
      expect(getNextSubmittalStatus('architect_review', 'Revise and Resubmit')).toBe('resubmit')
    })

    it('Revise from rejected goes back to draft', () => {
      expect(getNextSubmittalStatus('rejected', 'Revise and Resubmit')).toBe('draft')
    })

    it('Close Out from approved goes to closed', () => {
      expect(getNextSubmittalStatus('approved', 'Close Out')).toBe('closed')
    })

    it('invalid transition returns null', () => {
      expect(getNextSubmittalStatus('draft', 'Approve')).toBeNull()
    })
  })

  describe('getSubmittalStatusConfig', () => {
    it('returns config for all statuses', () => {
      const statuses: SubmittalState[] = ['draft', 'submitted', 'gc_review', 'architect_review', 'approved', 'rejected', 'resubmit', 'closed']
      for (const status of statuses) {
        const config = getSubmittalStatusConfig(status)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^var\(/)
        expect(config.bg).toMatch(/^var\(/)
      }
    })

    it('architect_review has its own label (A/E Review)', () => {
      expect(getSubmittalStatusConfig('architect_review').label).toBe('A/E Review')
    })
  })

  describe('getStampConfig', () => {
    it('returns config for all stamps', () => {
      const stamps: SubmittalStamp[] = ['approved', 'approved_as_noted', 'rejected', 'revise_and_resubmit']
      for (const stamp of stamps) {
        const config = getStampConfig(stamp)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^var\(/)
      }
    })

    it('stamp labels are uppercase', () => {
      expect(getStampConfig('approved').label).toBe('APPROVED')
      expect(getStampConfig('rejected').label).toBe('REJECTED')
    })
  })

  describe('getLeadTimeUrgency', () => {
    it('returns not urgent for no date', () => {
      expect(getLeadTimeUrgency(null).urgent).toBe(false)
    })

    it('returns urgent for past date', () => {
      const past = new Date(Date.now() - 2 * 86400000).toISOString()
      expect(getLeadTimeUrgency(past).urgent).toBe(true)
    })

    it('returns urgent for soon date', () => {
      const soon = new Date(Date.now() + 3 * 86400000).toISOString()
      expect(getLeadTimeUrgency(soon).urgent).toBe(true)
    })

    it('returns not urgent for distant date', () => {
      const future = new Date(Date.now() + 30 * 86400000).toISOString()
      expect(getLeadTimeUrgency(future).urgent).toBe(false)
    })
  })

  describe('CSI_DIVISIONS', () => {
    it('has at least 20 divisions', () => {
      expect(CSI_DIVISIONS.length).toBeGreaterThanOrEqual(20)
    })

    it('every division has code and name', () => {
      for (const div of CSI_DIVISIONS) {
        expect(div.code).toMatch(/^\d{2}$/)
        expect(div.name).toBeTruthy()
      }
    })
  })

  // ── XState machine tests ───────────────────────────────

  describe('XState machine', () => {
    it('starts in draft with revision 1', () => {
      const actor = createActor(submittalMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('draft')
      expect(actor.getSnapshot().context.revisionNumber).toBe(1)
      actor.stop()
    })

    // BUG #1 FIX TEST: Full industry-standard review chain
    it('full review chain: draft → submit → GC → architect → approve → close', () => {
      const actor = createActor(submittalMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      expect(actor.getSnapshot().value).toBe('submitted')

      actor.send({ type: 'GC_APPROVE' })
      expect(actor.getSnapshot().value).toBe('gc_review')

      // GC_APPROVE from gc_review now goes to architect_review (BUG #1 FIX)
      actor.send({ type: 'GC_APPROVE' })
      expect(actor.getSnapshot().value).toBe('architect_review')

      actor.send({ type: 'ARCHITECT_APPROVE' })
      expect(actor.getSnapshot().value).toBe('approved')

      actor.send({ type: 'CLOSE' })
      expect(actor.getSnapshot().value).toBe('closed')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    // BUG #1 FIX TEST: architect_review is now reachable
    it('architect_review is reachable from gc_review', () => {
      const actor = createActor(submittalMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'GC_APPROVE' })
      actor.send({ type: 'GC_APPROVE' }) // Forward to architect
      expect(actor.getSnapshot().value).toBe('architect_review')
      actor.stop()
    })

    it('architect can reject', () => {
      const actor = createActor(submittalMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'GC_APPROVE' })
      actor.send({ type: 'GC_APPROVE' })
      actor.send({ type: 'ARCHITECT_REJECT' })
      expect(actor.getSnapshot().value).toBe('rejected')
      actor.stop()
    })

    it('architect can request revision', () => {
      const actor = createActor(submittalMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'GC_APPROVE' })
      actor.send({ type: 'GC_APPROVE' })
      actor.send({ type: 'ARCHITECT_REVISE' })
      expect(actor.getSnapshot().value).toBe('resubmit')
      actor.stop()
    })

    it('rejection and resubmit increments revision', () => {
      const actor = createActor(submittalMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'GC_REJECT' })
      actor.send({ type: 'RESUBMIT' })
      expect(actor.getSnapshot().value).toBe('draft')
      expect(actor.getSnapshot().context.revisionNumber).toBe(2)
      actor.stop()
    })
  })
})
