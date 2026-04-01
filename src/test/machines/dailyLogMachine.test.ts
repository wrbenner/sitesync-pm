import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  dailyLogMachine,
  getValidDailyLogTransitions,
  getNextDailyLogStatus,
  getDailyLogStatusConfig,
  ENTRY_TYPES,
  QUICK_ADD_PRESETS,
  type DailyLogState,
} from '../../machines/dailyLogMachine'

describe('Daily Log State Machine', () => {
  describe('getValidDailyLogTransitions', () => {
    it('draft can Save or Submit', () => {
      const t = getValidDailyLogTransitions('draft')
      expect(t).toContain('Save Draft')
      expect(t).toContain('Submit for Approval')
    })

    it('submitted can Approve or Reject', () => {
      const t = getValidDailyLogTransitions('submitted')
      expect(t).toContain('Approve')
      expect(t).toContain('Reject')
    })

    it('approved is final', () => {
      expect(getValidDailyLogTransitions('approved')).toEqual([])
    })

    // BUG #2 FIX TEST: rejected offers Edit and Resubmit
    it('rejected can Edit Draft or Resubmit', () => {
      const t = getValidDailyLogTransitions('rejected')
      expect(t).toContain('Edit Draft')
      expect(t).toContain('Resubmit')
    })
  })

  describe('getNextDailyLogStatus', () => {
    it('Save Draft stays in draft', () => {
      expect(getNextDailyLogStatus('draft', 'Save Draft')).toBe('draft')
    })

    it('Submit goes to submitted', () => {
      expect(getNextDailyLogStatus('draft', 'Submit for Approval')).toBe('submitted')
    })

    it('Approve goes to approved', () => {
      expect(getNextDailyLogStatus('submitted', 'Approve')).toBe('approved')
    })

    it('Reject goes to rejected', () => {
      expect(getNextDailyLogStatus('submitted', 'Reject')).toBe('rejected')
    })

    // BUG #2 FIX TEST: Edit goes to draft, NOT directly to submitted
    it('Edit Draft from rejected goes to draft (not submitted)', () => {
      expect(getNextDailyLogStatus('rejected', 'Edit Draft')).toBe('draft')
    })

    it('Resubmit from rejected goes to draft (for editing)', () => {
      expect(getNextDailyLogStatus('rejected', 'Resubmit')).toBe('draft')
    })

    // Legacy compat
    it('Edit and Resubmit (legacy) goes to draft', () => {
      expect(getNextDailyLogStatus('rejected', 'Edit and Resubmit')).toBe('draft')
    })

    it('invalid returns null', () => {
      expect(getNextDailyLogStatus('approved', 'Reject')).toBeNull()
    })
  })

  describe('getDailyLogStatusConfig', () => {
    it('all statuses have config', () => {
      const statuses: DailyLogState[] = ['draft', 'submitted', 'approved', 'rejected']
      for (const s of statuses) {
        const c = getDailyLogStatusConfig(s)
        expect(c.label).toBeTruthy()
        expect(c.color).toMatch(/^var\(/)
      }
    })

    it('rejected shows as Returned', () => {
      expect(getDailyLogStatusConfig('rejected').label).toBe('Returned')
    })
  })

  describe('Constants', () => {
    it('ENTRY_TYPES has required types', () => {
      const values = ENTRY_TYPES.map((t) => t.value)
      expect(values).toContain('manpower')
      expect(values).toContain('work_performed')
    })

    it('QUICK_ADD_PRESETS have valid types', () => {
      const validTypes = ENTRY_TYPES.map((t) => t.value)
      for (const preset of QUICK_ADD_PRESETS) {
        expect(validTypes).toContain(preset.type)
      }
    })
  })

  describe('XState machine', () => {
    it('starts in draft', () => {
      const actor = createActor(dailyLogMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('draft')
      actor.stop()
    })

    it('happy path: draft → submit → approve', () => {
      const actor = createActor(dailyLogMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', userId: 'pm-1' })
      expect(actor.getSnapshot().value).toBe('approved')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    // BUG #2 FIX TEST: reject → edit → resubmit flow
    it('reject → SAVE_DRAFT goes to draft (not submitted)', () => {
      const actor = createActor(dailyLogMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'REJECT', comments: 'Missing data', userId: 'pm-1' })
      expect(actor.getSnapshot().value).toBe('rejected')

      // Go back to draft for editing
      actor.send({ type: 'SAVE_DRAFT' })
      expect(actor.getSnapshot().value).toBe('draft')

      // Then submit again
      actor.send({ type: 'SUBMIT' })
      expect(actor.getSnapshot().value).toBe('submitted')

      actor.send({ type: 'APPROVE', userId: 'pm-1' })
      expect(actor.getSnapshot().value).toBe('approved')
      actor.stop()
    })

    it('reject → SUBMIT goes directly to submitted', () => {
      const actor = createActor(dailyLogMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'REJECT', comments: 'Fix it', userId: 'pm-1' })
      actor.send({ type: 'SUBMIT' })
      expect(actor.getSnapshot().value).toBe('submitted')
      actor.stop()
    })
  })
})
