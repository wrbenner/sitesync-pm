import { describe, it, expect } from 'vitest'
import {
  getValidTransitions,
  getNextStatus,
  getBallInCourt,
  getDueDateUrgency,
  getDaysOpen,
  getRFIStatusConfig,
} from './rfiMachine'

// rfiMachine helpers drive every action button and state-config render on
// the RFI list + detail surfaces. Pinning these prevents silent UX
// regressions from XState refactors.

describe('rfiMachine — getValidTransitions', () => {
  it('returns the base transitions for each non-void state', () => {
    expect(getValidTransitions('draft')).toContain('Submit')
    expect(getValidTransitions('open')).toEqual(expect.arrayContaining(['Assign for Review', 'Close']))
    expect(getValidTransitions('under_review')).toEqual(expect.arrayContaining(['Respond', 'Close']))
    expect(getValidTransitions('answered')).toEqual(expect.arrayContaining(['Close', 'Reopen']))
    expect(getValidTransitions('closed')).toContain('Reopen')
  })

  it('void state has no transitions', () => {
    expect(getValidTransitions('void')).toEqual([])
  })

  it('only admin / owner roles get the Void action', () => {
    expect(getValidTransitions('open', 'viewer')).not.toContain('Void')
    expect(getValidTransitions('open', 'project_manager')).not.toContain('Void')
    expect(getValidTransitions('open', 'admin')).toContain('Void')
    expect(getValidTransitions('open', 'owner')).toContain('Void')
  })

  it('admin cannot void an already-void RFI', () => {
    expect(getValidTransitions('void', 'admin')).toEqual([])
  })

  it('default role (no argument) is treated as viewer (no Void)', () => {
    expect(getValidTransitions('open')).not.toContain('Void')
  })
})

describe('rfiMachine — getNextStatus', () => {
  it.each([
    ['draft', 'Submit', 'open'],
    ['draft', 'Void', 'void'],
    ['open', 'Assign for Review', 'under_review'],
    ['open', 'Close', 'closed'],
    ['under_review', 'Respond', 'answered'],
    ['under_review', 'Close', 'closed'],
    ['answered', 'Close', 'closed'],
    ['answered', 'Reopen', 'open'],
    ['closed', 'Reopen', 'open'],
    ['closed', 'Void', 'void'],
  ] as const)('%s + %s → %s', (from, action, to) => {
    expect(getNextStatus(from, action)).toBe(to)
  })

  it('returns null for invalid action on the current state', () => {
    expect(getNextStatus('draft', 'Respond')).toBeNull()
    expect(getNextStatus('void', 'Submit')).toBeNull()
    expect(getNextStatus('open', 'Bogus')).toBeNull()
  })
})

describe('rfiMachine — getBallInCourt', () => {
  it('draft + open: assigned-to wins, falls back to creator', () => {
    expect(getBallInCourt('open', 'creator', 'assignee')).toBe('assignee')
    expect(getBallInCourt('draft', 'creator', null)).toBe('creator')
  })

  it('under_review: always assignee', () => {
    expect(getBallInCourt('under_review', 'creator', 'assignee')).toBe('assignee')
    expect(getBallInCourt('under_review', 'creator', null)).toBeNull()
  })

  it('answered: ball back in creator\'s court for review', () => {
    expect(getBallInCourt('answered', 'creator', 'assignee')).toBe('creator')
  })

  it('closed and void: nobody owns it', () => {
    expect(getBallInCourt('closed', 'creator', 'assignee')).toBeNull()
    expect(getBallInCourt('void', 'creator', 'assignee')).toBeNull()
  })
})

describe('rfiMachine — getDueDateUrgency', () => {
  it('returns "No due date" when null', () => {
    const r = getDueDateUrgency(null)
    expect(r.label).toBe('No due date')
  })

  it('flags overdue with absolute days count', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const r = getDueDateUrgency(past)
    expect(r.label).toMatch(/days overdue/)
  })

  it('flags 0–3 days as pending', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const r = getDueDateUrgency(soon)
    expect(r.label).toMatch(/Due in/)
  })

  it('flags >3 days as active', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const r = getDueDateUrgency(future)
    expect(r.label).toMatch(/Due in/)
  })
})

describe('rfiMachine — getDaysOpen', () => {
  it('returns 0 when no createdAt', () => {
    expect(getDaysOpen(null)).toBe(0)
  })

  it('counts days from creation', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(getDaysOpen(tenDaysAgo)).toBeGreaterThanOrEqual(10)
  })

  it('clamps at 0 for future creation timestamps', () => {
    const future = new Date(Date.now() + 1000).toISOString()
    expect(getDaysOpen(future)).toBe(0)
  })
})

describe('rfiMachine — getRFIStatusConfig', () => {
  it('returns the right label for each state', () => {
    expect(getRFIStatusConfig('draft').label).toBe('Draft')
    expect(getRFIStatusConfig('open').label).toBe('Open')
    expect(getRFIStatusConfig('under_review').label).toBe('Under Review')
    expect(getRFIStatusConfig('answered').label).toBe('Answered')
    expect(getRFIStatusConfig('closed').label).toBe('Closed')
    expect(getRFIStatusConfig('void').label).toBe('Void')
  })

  it('returns the draft config for an unknown state', () => {
    // @ts-expect-error — exercising the fallback
    expect(getRFIStatusConfig('mystery_state').label).toBe('Draft')
  })

  it('every config has color + bg properties', () => {
    const states = ['draft', 'open', 'under_review', 'answered', 'closed', 'void'] as const
    for (const s of states) {
      const c = getRFIStatusConfig(s)
      expect(c).toHaveProperty('color')
      expect(c).toHaveProperty('bg')
    }
  })
})
