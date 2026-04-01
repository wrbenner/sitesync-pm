import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  punchItemMachine,
  getValidPunchTransitions,
  getNextPunchStatus,
  getPunchStatusConfig,
  type PunchItemState,
} from '../../machines/punchItemMachine'

describe('Punch Item State Machine', () => {
  // ── Helper function tests (BUG #3 FIX) ────────────────

  describe('getValidPunchTransitions', () => {
    it('open can Start Work or Verify Direct', () => {
      const t = getValidPunchTransitions('open')
      expect(t).toContain('Start Work')
      expect(t).toContain('Verify (Complete at Creation)')
    })

    it('in_progress can Mark Resolved or Reopen', () => {
      const t = getValidPunchTransitions('in_progress')
      expect(t).toContain('Mark Resolved')
      expect(t).toContain('Reopen')
    })

    it('resolved can Verify or Reopen', () => {
      const t = getValidPunchTransitions('resolved')
      expect(t).toContain('Verify')
      expect(t).toContain('Reopen')
    })

    it('verified can Reject Verification', () => {
      expect(getValidPunchTransitions('verified')).toContain('Reject Verification')
    })

    it('unknown status returns empty', () => {
      expect(getValidPunchTransitions('nonexistent' as PunchItemState)).toEqual([])
    })
  })

  describe('getNextPunchStatus', () => {
    it('Start Work from open goes to in_progress', () => {
      expect(getNextPunchStatus('open', 'Start Work')).toBe('in_progress')
    })

    it('Verify Direct from open goes to verified', () => {
      expect(getNextPunchStatus('open', 'Verify (Complete at Creation)')).toBe('verified')
    })

    it('Mark Resolved from in_progress goes to resolved', () => {
      expect(getNextPunchStatus('in_progress', 'Mark Resolved')).toBe('resolved')
    })

    it('Verify from resolved goes to verified', () => {
      expect(getNextPunchStatus('resolved', 'Verify')).toBe('verified')
    })

    it('Reject Verification from verified goes to in_progress', () => {
      expect(getNextPunchStatus('verified', 'Reject Verification')).toBe('in_progress')
    })

    it('invalid returns null', () => {
      expect(getNextPunchStatus('open', 'Approve')).toBeNull()
    })
  })

  describe('getPunchStatusConfig', () => {
    it('returns config for all statuses', () => {
      const statuses: PunchItemState[] = ['open', 'in_progress', 'resolved', 'verified']
      for (const s of statuses) {
        const config = getPunchStatusConfig(s)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^var\(/)
        expect(config.bg).toMatch(/^var\(/)
      }
    })

    it('open is red', () => {
      expect(getPunchStatusConfig('open').color).toBe('var(--color-statusCritical)')
    })

    it('verified is green', () => {
      expect(getPunchStatusConfig('verified').color).toBe('var(--color-statusActive)')
    })
  })

  // ── XState machine tests ───────────────────────────────

  describe('XState machine', () => {
    it('starts in open state', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('open')
      actor.stop()
    })

    it('standard flow: open → work → resolve → verify', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'START_WORK' })
      expect(actor.getSnapshot().value).toBe('in_progress')
      actor.send({ type: 'RESOLVE' })
      expect(actor.getSnapshot().value).toBe('resolved')
      actor.send({ type: 'VERIFY' })
      expect(actor.getSnapshot().value).toBe('verified')
      actor.stop()
    })

    // BUG #3 FIX TEST: Direct verification
    it('direct verify: open → verified (already complete at creation)', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'VERIFY_DIRECT' })
      expect(actor.getSnapshot().value).toBe('verified')
      actor.stop()
    })

    // BUG #3 FIX TEST: Failed verification
    it('failed verification: verified → in_progress (needs rework)', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'START_WORK' })
      actor.send({ type: 'RESOLVE' })
      actor.send({ type: 'VERIFY' })
      expect(actor.getSnapshot().value).toBe('verified')

      actor.send({ type: 'REJECT_VERIFICATION' })
      expect(actor.getSnapshot().value).toBe('in_progress')
      actor.stop()
    })

    it('reopen from resolved', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'START_WORK' })
      actor.send({ type: 'RESOLVE' })
      actor.send({ type: 'REOPEN' })
      expect(actor.getSnapshot().value).toBe('open')
      actor.stop()
    })

    it('reopen from in_progress', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'START_WORK' })
      actor.send({ type: 'REOPEN' })
      expect(actor.getSnapshot().value).toBe('open')
      actor.stop()
    })

    it('invalid event stays in current state', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'RESOLVE' }) // can't resolve from open
      expect(actor.getSnapshot().value).toBe('open')
      actor.stop()
    })
  })
})
