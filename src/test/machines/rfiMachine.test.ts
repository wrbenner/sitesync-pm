import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  rfiMachine,
  getValidTransitions,
  getNextStatus,
  getBallInCourt,
  getDueDateUrgency,
  getDaysOpen,
  getRFIStatusConfig,
  type RFIState,
} from '../../machines/rfiMachine'

describe('RFI State Machine', () => {
  describe('getValidTransitions', () => {
    it('draft can only Submit', () => {
      expect(getValidTransitions('draft')).toEqual(['Submit'])
    })

    it('open can Assign or Close', () => {
      const t = getValidTransitions('open')
      expect(t).toContain('Assign for Review')
      expect(t).toContain('Close')
    })

    it('under_review can Respond or Close', () => {
      const t = getValidTransitions('under_review')
      expect(t).toContain('Respond')
      expect(t).toContain('Close')
    })

    it('answered can Close or Reopen', () => {
      const t = getValidTransitions('answered')
      expect(t).toContain('Close')
      expect(t).toContain('Reopen')
    })

    it('closed can only Reopen', () => {
      expect(getValidTransitions('closed')).toEqual(['Reopen'])
    })

    it('void is final', () => {
      expect(getValidTransitions('void')).toEqual([])
    })

    // BUG #4 FIX TESTS: Void only for admin/owner
    it('non-admin cannot see Void action', () => {
      expect(getValidTransitions('open', 'viewer')).not.toContain('Void')
      expect(getValidTransitions('open', 'subcontractor')).not.toContain('Void')
      expect(getValidTransitions('open', 'superintendent')).not.toContain('Void')
      expect(getValidTransitions('open', 'project_manager')).not.toContain('Void')
    })

    it('admin can see Void action on any non-void state', () => {
      const states: RFIState[] = ['draft', 'open', 'under_review', 'answered', 'closed']
      for (const state of states) {
        expect(getValidTransitions(state, 'admin')).toContain('Void')
      }
    })

    it('owner can see Void action', () => {
      expect(getValidTransitions('open', 'owner')).toContain('Void')
    })

    it('admin cannot Void from void state', () => {
      expect(getValidTransitions('void', 'admin')).not.toContain('Void')
    })

    it('default role (no role provided) cannot Void', () => {
      expect(getValidTransitions('open')).not.toContain('Void')
    })
  })

  describe('getNextStatus', () => {
    it('Submit from draft goes to open', () => {
      expect(getNextStatus('draft', 'Submit')).toBe('open')
    })

    it('Assign from open goes to under_review', () => {
      expect(getNextStatus('open', 'Assign for Review')).toBe('under_review')
    })

    it('Respond from under_review goes to answered', () => {
      expect(getNextStatus('under_review', 'Respond')).toBe('answered')
    })

    it('Close from answered goes to closed', () => {
      expect(getNextStatus('answered', 'Close')).toBe('closed')
    })

    it('Reopen from closed goes to open', () => {
      expect(getNextStatus('closed', 'Reopen')).toBe('open')
    })

    it('Void goes to void from any state', () => {
      expect(getNextStatus('draft', 'Void')).toBe('void')
      expect(getNextStatus('open', 'Void')).toBe('void')
      expect(getNextStatus('answered', 'Void')).toBe('void')
    })

    it('invalid transition returns null', () => {
      expect(getNextStatus('draft', 'Close')).toBeNull()
      expect(getNextStatus('closed', 'Respond')).toBeNull()
    })
  })

  describe('getBallInCourt', () => {
    it('draft: ball is with assignee or creator', () => {
      expect(getBallInCourt('draft', 'creator', 'assignee')).toBe('assignee')
      expect(getBallInCourt('draft', 'creator', null)).toBe('creator')
    })

    it('under_review: ball is with assignee', () => {
      expect(getBallInCourt('under_review', 'creator', 'reviewer')).toBe('reviewer')
    })

    it('answered: ball is with creator', () => {
      expect(getBallInCourt('answered', 'creator', 'reviewer')).toBe('creator')
    })

    it('closed/void: no one', () => {
      expect(getBallInCourt('closed', 'c', 'r')).toBeNull()
      expect(getBallInCourt('void', 'c', 'r')).toBeNull()
    })
  })

  describe('getDueDateUrgency', () => {
    it('no due date returns neutral', () => {
      expect(getDueDateUrgency(null).label).toBe('No due date')
    })

    it('overdue returns red', () => {
      const past = new Date(Date.now() - 3 * 86400000).toISOString()
      expect(getDueDateUrgency(past).color).toBe('#C93B3B')
    })

    it('within 3 days returns amber', () => {
      const soon = new Date(Date.now() + 2 * 86400000).toISOString()
      expect(getDueDateUrgency(soon).color).toBe('#C4850C')
    })

    it('future returns green', () => {
      const future = new Date(Date.now() + 10 * 86400000).toISOString()
      expect(getDueDateUrgency(future).color).toBe('#2D8A6E')
    })
  })

  describe('getDaysOpen', () => {
    it('null returns 0', () => {
      expect(getDaysOpen(null)).toBe(0)
    })

    it('past date returns positive', () => {
      const past = new Date(Date.now() - 5 * 86400000).toISOString()
      expect(getDaysOpen(past)).toBeGreaterThanOrEqual(5)
    })
  })

  describe('getRFIStatusConfig', () => {
    it('all statuses have config', () => {
      const statuses: RFIState[] = ['draft', 'open', 'under_review', 'answered', 'closed', 'void']
      for (const s of statuses) {
        const c = getRFIStatusConfig(s)
        expect(c.label).toBeTruthy()
        expect(c.color).toMatch(/^#/)
      }
    })
  })

  describe('XState machine', () => {
    it('starts in draft', () => {
      const actor = createActor(rfiMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('draft')
      actor.stop()
    })

    it('full happy path', () => {
      const actor = createActor(rfiMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'ASSIGN', assigneeId: 'u1' })
      actor.send({ type: 'RESPOND', content: 'Answer', userId: 'u1' })
      actor.send({ type: 'CLOSE', userId: 'u2' })
      expect(actor.getSnapshot().value).toBe('closed')
      actor.stop()
    })

    it('void is final', () => {
      const actor = createActor(rfiMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'VOID', userId: 'admin', reason: 'Duplicate' })
      expect(actor.getSnapshot().value).toBe('void')
      expect(actor.getSnapshot().status).toBe('done')
      actor.stop()
    })

    it('reopen from closed', () => {
      const actor = createActor(rfiMachine)
      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'CLOSE', userId: 'u1' })
      actor.send({ type: 'REOPEN', userId: 'u1' })
      expect(actor.getSnapshot().value).toBe('open')
      actor.stop()
    })
  })
})
