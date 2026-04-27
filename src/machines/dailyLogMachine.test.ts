import { describe, it, expect } from 'vitest'
import {
  getValidDailyLogTransitions,
  getNextDailyLogStatus,
  getDailyLogStatusConfig,
  ENTRY_TYPES,
  canEditLog,
  forkLogVersion,
  QUICK_ADD_PRESETS,
} from './dailyLogMachine'

describe('dailyLogMachine — getValidDailyLogTransitions', () => {
  it.each([
    ['draft', ['Save Draft', 'Submit for Approval']],
    ['submitted', ['Approve', 'Reject', 'Amend']],
    ['amending', []],
    ['approved', []],
    ['rejected', ['Edit Draft', 'Resubmit']],
  ] as const)('%s → %j', (state, actions) => {
    expect(getValidDailyLogTransitions(state)).toEqual(actions)
  })
})

describe('dailyLogMachine — getNextDailyLogStatus', () => {
  it.each([
    ['draft', 'Save Draft', 'draft'],
    ['draft', 'Submit for Approval', 'submitted'],
    ['submitted', 'Approve', 'approved'],
    ['submitted', 'Reject', 'rejected'],
    ['submitted', 'Amend', 'amending'],
    ['rejected', 'Edit Draft', 'draft'],
    ['rejected', 'Resubmit', 'draft'],
    ['rejected', 'Edit and Resubmit', 'draft'],   // legacy compat
  ] as const)('%s + %s → %s', (from, action, to) => {
    expect(getNextDailyLogStatus(from, action)).toBe(to)
  })

  it('returns null on invalid action', () => {
    expect(getNextDailyLogStatus('approved', 'Submit for Approval')).toBeNull()
    expect(getNextDailyLogStatus('draft', 'Approve')).toBeNull()
  })
})

describe('dailyLogMachine — getDailyLogStatusConfig', () => {
  it.each([
    ['draft', 'Draft'],
    ['submitted', 'Submitted'],
    ['amending', 'Creating Amendment'],
    ['approved', 'Approved'],
    ['rejected', 'Returned'],
  ] as const)('%s → "%s"', (state, label) => {
    expect(getDailyLogStatusConfig(state).label).toBe(label)
  })
})

describe('dailyLogMachine — ENTRY_TYPES', () => {
  it('contains the 9 documented entry types', () => {
    const values = ENTRY_TYPES.map((e) => e.value)
    expect(values).toEqual([
      'manpower', 'work_performed', 'material_received', 'equipment',
      'visitor', 'delay', 'inspection', 'incident', 'note',
    ])
  })

  it('every entry has a label and an icon', () => {
    for (const e of ENTRY_TYPES) {
      expect(e.label).toBeTruthy()
      expect(e.icon).toBeTruthy()
    }
  })
})

describe('dailyLogMachine — canEditLog', () => {
  it('draft is editable', () => {
    expect(canEditLog({ status: 'draft', is_submitted: false })).toBe(true)
  })

  it('rejected is editable (must edit before resubmit)', () => {
    expect(canEditLog({ status: 'rejected' })).toBe(true)
  })

  it('submitted / amending / approved are NOT editable', () => {
    expect(canEditLog({ status: 'submitted' })).toBe(false)
    expect(canEditLog({ status: 'amending' })).toBe(false)
    expect(canEditLog({ status: 'approved' })).toBe(false)
  })

  it('is_submitted = true short-circuits to false even if status says draft', () => {
    expect(canEditLog({ status: 'draft', is_submitted: true })).toBe(false)
  })

  it('defaults to draft when status is missing', () => {
    expect(canEditLog({})).toBe(true)
  })
})

describe('dailyLogMachine — forkLogVersion', () => {
  it('strips id, increments version, and resets approval fields', () => {
    const original = {
      id: 'log-1',
      version: 3,
      is_submitted: true,
      submitted_at: '2026-01-01',
      status: 'submitted',
      approved: true,
      approved_at: '2026-01-02',
      approved_by: 'user-1',
      manager_signature_url: 'sig-A',
      superintendent_signature_url: 'sig-B',
      summary: 'Day went well',
    }
    const forked = forkLogVersion(original)
    // id is removed
    expect((forked as Record<string, unknown>).id).toBeUndefined()
    // version bumps by 1
    expect(forked.version).toBe(4)
    // submission + approval are reset
    expect(forked.is_submitted).toBe(false)
    expect(forked.submitted_at).toBeNull()
    expect(forked.status).toBe('draft')
    expect((forked as Record<string, unknown>).approved).toBeNull()
    expect((forked as Record<string, unknown>).approved_by).toBeNull()
    expect((forked as Record<string, unknown>).manager_signature_url).toBeNull()
    // unrelated fields pass through
    expect((forked as Record<string, unknown>).summary).toBe('Day went well')
  })

  it('defaults version to 1 (→ 2) when original has none', () => {
    const forked = forkLogVersion({})
    expect(forked.version).toBe(2)
  })
})

describe('dailyLogMachine — QUICK_ADD_PRESETS', () => {
  it('every preset has a type that exists in ENTRY_TYPES', () => {
    const validTypes = new Set(ENTRY_TYPES.map((e) => e.value))
    for (const p of QUICK_ADD_PRESETS) {
      expect(validTypes.has(p.type)).toBe(true)
    }
  })
})
