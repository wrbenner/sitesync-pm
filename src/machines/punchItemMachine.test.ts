import { describe, it, expect } from 'vitest'
import {
  getValidPunchTransitions,
  getNextPunchStatus,
  getPunchStatusConfig,
} from './punchItemMachine'

describe('punchItemMachine — getValidPunchTransitions', () => {
  it('open: can start work or verify directly', () => {
    expect(getValidPunchTransitions('open')).toEqual(['Start Work', 'Verify'])
  })

  it('in_progress: sub completes or reopens', () => {
    expect(getValidPunchTransitions('in_progress')).toEqual(['Sub Complete', 'Reopen'])
  })

  it('sub_complete: GC verifies, rejects back to in_progress, or reopens', () => {
    expect(getValidPunchTransitions('sub_complete')).toEqual(['Verify', 'Reject', 'Reopen'])
  })

  it('verified: can be re-rejected or reopened', () => {
    expect(getValidPunchTransitions('verified')).toEqual(['Reject', 'Reopen'])
  })

  it('rejected: sub can re-start work or item reopened', () => {
    expect(getValidPunchTransitions('rejected')).toEqual(['Start Work', 'Reopen'])
  })
})

describe('punchItemMachine — getNextPunchStatus', () => {
  it.each([
    ['open', 'Start Work', 'in_progress'],
    ['open', 'Verify', 'verified'],
    ['in_progress', 'Sub Complete', 'sub_complete'],
    ['in_progress', 'Reopen', 'open'],
    ['sub_complete', 'Verify', 'verified'],
    ['sub_complete', 'Reject', 'in_progress'],
    ['sub_complete', 'Reopen', 'open'],
    ['verified', 'Reject', 'in_progress'],
    ['verified', 'Reopen', 'open'],
    ['rejected', 'Start Work', 'in_progress'],
    ['rejected', 'Reopen', 'open'],
  ] as const)('%s + %s → %s', (from, action, to) => {
    expect(getNextPunchStatus(from, action)).toBe(to)
  })

  it('returns null for invalid actions', () => {
    expect(getNextPunchStatus('open', 'Bogus')).toBeNull()
    expect(getNextPunchStatus('verified', 'Sub Complete')).toBeNull()
  })
})

describe('punchItemMachine — getPunchStatusConfig', () => {
  it.each([
    ['open', 'Open'],
    ['in_progress', 'In Progress'],
    ['sub_complete', 'Sub Complete'],
    ['verified', 'Verified'],
    ['rejected', 'Rejected'],
  ] as const)('%s → "%s"', (state, label) => {
    expect(getPunchStatusConfig(state).label).toBe(label)
  })

  it('falls back to "open" config for unknown state', () => {
    // @ts-expect-error — exercising fallback
    expect(getPunchStatusConfig('mystery').label).toBe('Open')
  })

  it('every config supplies color + bg', () => {
    const states = ['open', 'in_progress', 'sub_complete', 'verified', 'rejected'] as const
    for (const s of states) {
      const c = getPunchStatusConfig(s)
      expect(c.color).toBeTruthy()
      expect(c.bg).toBeTruthy()
    }
  })
})
