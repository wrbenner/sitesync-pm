import { describe, it, expect } from 'vitest'
import {
  getValidTaskTransitions,
  getNextTaskStatus,
  getTaskStatusConfig,
} from './taskMachine'

describe('taskMachine — getValidTaskTransitions', () => {
  it.each([
    ['todo', ['Start Work', 'Mark Complete']],
    ['in_progress', ['Submit for Review', 'Mark Complete']],
    ['in_review', ['Approve', 'Send Back']],
    ['done', ['Reopen']],
  ] as const)('%s → %j', (state, actions) => {
    expect(getValidTaskTransitions(state)).toEqual(actions)
  })
})

describe('taskMachine — getNextTaskStatus', () => {
  it.each([
    ['todo', 'Start Work', 'in_progress'],
    ['todo', 'Mark Complete', 'done'],
    ['in_progress', 'Submit for Review', 'in_review'],
    ['in_progress', 'Mark Complete', 'done'],
    ['in_review', 'Approve', 'done'],
    ['in_review', 'Send Back', 'in_progress'],
    ['done', 'Reopen', 'todo'],
  ] as const)('%s + %s → %s', (from, action, to) => {
    expect(getNextTaskStatus(from, action)).toBe(to)
  })

  it('returns null on invalid action', () => {
    expect(getNextTaskStatus('todo', 'Approve')).toBeNull()
    expect(getNextTaskStatus('done', 'Start Work')).toBeNull()
    expect(getNextTaskStatus('in_review', 'Bogus')).toBeNull()
  })
})

describe('taskMachine — getTaskStatusConfig', () => {
  it.each([
    ['todo', 'To Do'],
    ['in_progress', 'In Progress'],
    ['in_review', 'In Review'],
    ['done', 'Done'],
  ] as const)('%s → "%s"', (state, label) => {
    expect(getTaskStatusConfig(state).label).toBe(label)
  })

  it('falls back to "todo" for unknown state', () => {
    // @ts-expect-error — exercising fallback
    expect(getTaskStatusConfig('mystery').label).toBe('To Do')
  })

  it('every config supplies color + bg', () => {
    const states = ['todo', 'in_progress', 'in_review', 'done'] as const
    for (const s of states) {
      const c = getTaskStatusConfig(s)
      expect(c.color).toBeTruthy()
      expect(c.bg).toBeTruthy()
    }
  })
})
