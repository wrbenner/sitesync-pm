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
  describe('getValidPunchTransitions', () => {
    it('open can Start Work or Verify (direct verify at creation)', () => {
      const t = getValidPunchTransitions('open')
      expect(t).toContain('Start Work')
      expect(t).toContain('Verify')
    })

    it('in_progress can Sub Complete or Reopen', () => {
      const t = getValidPunchTransitions('in_progress')
      expect(t).toContain('Sub Complete')
      expect(t).toContain('Reopen')
    })

    it('sub_complete can Verify, Reject, or Reopen', () => {
      const t = getValidPunchTransitions('sub_complete')
      expect(t).toContain('Verify')
      expect(t).toContain('Reject')
      expect(t).toContain('Reopen')
    })

    it('verified can Reject or Reopen', () => {
      const t = getValidPunchTransitions('verified')
      expect(t).toContain('Reject')
      expect(t).toContain('Reopen')
    })

    it('unknown status returns empty', () => {
      expect(getValidPunchTransitions('nonexistent' as PunchItemState)).toEqual([])
    })
  })

  describe('getNextPunchStatus', () => {
    it('Start Work from open goes to in_progress', () => {
      expect(getNextPunchStatus('open', 'Start Work')).toBe('in_progress')
    })

    it('Verify from open goes to verified (direct verify at creation)', () => {
      expect(getNextPunchStatus('open', 'Verify')).toBe('verified')
    })

    it('Sub Complete from in_progress goes to sub_complete', () => {
      expect(getNextPunchStatus('in_progress', 'Sub Complete')).toBe('sub_complete')
    })

    it('Verify from sub_complete goes to verified', () => {
      expect(getNextPunchStatus('sub_complete', 'Verify')).toBe('verified')
    })

    it('Reject from verified goes to in_progress', () => {
      expect(getNextPunchStatus('verified', 'Reject')).toBe('in_progress')
    })

    it('invalid returns null', () => {
      expect(getNextPunchStatus('open', 'Approve')).toBeNull()
    })
  })

  describe('getPunchStatusConfig', () => {
    it('returns config for all statuses', () => {
      const statuses: PunchItemState[] = ['open', 'in_progress', 'sub_complete', 'verified', 'rejected']
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

  describe('XState machine', () => {
    it('starts in open state', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('open')
      actor.stop()
    })

    it('standard flow: open → in_progress → sub_complete → verified', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'START_WORK' })
      expect(actor.getSnapshot().value).toBe('in_progress')
      actor.send({ type: 'MARK_SUB_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('sub_complete')
      actor.send({ type: 'VERIFY' })
      expect(actor.getSnapshot().value).toBe('verified')
      actor.stop()
    })

    it('direct verify: open → verified (already complete at creation)', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'VERIFY_DIRECT' })
      expect(actor.getSnapshot().value).toBe('verified')
      actor.stop()
    })

    it('failed verification: verified → in_progress (needs rework)', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'START_WORK' })
      actor.send({ type: 'MARK_SUB_COMPLETE' })
      actor.send({ type: 'VERIFY' })
      expect(actor.getSnapshot().value).toBe('verified')

      actor.send({ type: 'REJECT' })
      expect(actor.getSnapshot().value).toBe('in_progress')
      actor.stop()
    })

    it('reopen from sub_complete', () => {
      const actor = createActor(punchItemMachine)
      actor.start()
      actor.send({ type: 'START_WORK' })
      actor.send({ type: 'MARK_SUB_COMPLETE' })
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
      actor.send({ type: 'MARK_SUB_COMPLETE' }) // can't sub-complete from open
      expect(actor.getSnapshot().value).toBe('open')
      actor.stop()
    })
  })
})
