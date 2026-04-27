import { describe, it, expect } from 'vitest'
import {
  getValidSubmittalStatusTransitions,
  getValidSubmittalTransitions,
  getNextSubmittalStatus,
  getSubmittalStatusConfig,
  getStampConfig,
  getLeadTimeUrgency,
  CSI_DIVISIONS,
} from './submittalMachine'

describe('submittalMachine — getValidSubmittalStatusTransitions (role-gated)', () => {
  it('any non-viewer can submit a draft for review', () => {
    expect(getValidSubmittalStatusTransitions('draft', 'project_manager')).toEqual(['submitted'])
    expect(getValidSubmittalStatusTransitions('draft', 'gc_member')).toEqual(['submitted'])
    expect(getValidSubmittalStatusTransitions('draft', 'architect')).toEqual(['submitted'])
    expect(getValidSubmittalStatusTransitions('draft', 'viewer')).toEqual([])
  })

  it('only GC roles can advance from submitted to gc_review or rejected', () => {
    expect(getValidSubmittalStatusTransitions('submitted', 'project_manager')).toEqual(
      expect.arrayContaining(['gc_review', 'rejected']),
    )
    expect(getValidSubmittalStatusTransitions('submitted', 'architect')).toEqual([])
  })

  it('only architect roles can act on architect_review', () => {
    expect(getValidSubmittalStatusTransitions('architect_review', 'architect')).toEqual(
      expect.arrayContaining(['approved', 'rejected', 'resubmit']),
    )
    expect(getValidSubmittalStatusTransitions('architect_review', 'project_manager')).toEqual([])
  })

  it('owner has GC + architect privileges everywhere', () => {
    expect(getValidSubmittalStatusTransitions('submitted', 'owner')).toContain('gc_review')
    expect(getValidSubmittalStatusTransitions('architect_review', 'owner')).toContain('approved')
    expect(getValidSubmittalStatusTransitions('approved', 'owner')).toContain('closed')
  })

  it('viewers cannot transition any state', () => {
    const states = ['draft', 'submitted', 'gc_review', 'architect_review', 'approved', 'rejected', 'resubmit', 'closed'] as const
    for (const s of states) {
      expect(getValidSubmittalStatusTransitions(s, 'viewer')).toEqual([])
    }
  })

  it('rejected/resubmit lets any non-viewer initiate a revision back to draft', () => {
    expect(getValidSubmittalStatusTransitions('rejected', 'gc_member')).toEqual(['draft'])
    expect(getValidSubmittalStatusTransitions('resubmit', 'architect')).toEqual(['draft'])
    expect(getValidSubmittalStatusTransitions('rejected', 'viewer')).toEqual([])
  })

  it('closed is terminal for everyone', () => {
    expect(getValidSubmittalStatusTransitions('closed', 'owner')).toEqual([])
  })
})

describe('submittalMachine — getValidSubmittalTransitions (UI labels)', () => {
  it('exposes the documented action labels per state', () => {
    expect(getValidSubmittalTransitions('draft')).toContain('Submit for Review')
    expect(getValidSubmittalTransitions('submitted')).toEqual(
      expect.arrayContaining(['GC Approve', 'GC Reject']),
    )
    expect(getValidSubmittalTransitions('gc_review')).toEqual(
      expect.arrayContaining(['Forward to Architect', 'GC Reject', 'Revise and Resubmit']),
    )
    expect(getValidSubmittalTransitions('architect_review')).toEqual(
      expect.arrayContaining(['Architect Approve', 'Architect Reject', 'Revise and Resubmit']),
    )
    expect(getValidSubmittalTransitions('approved')).toContain('Close Out')
    expect(getValidSubmittalTransitions('closed')).toEqual([])
  })
})

describe('submittalMachine — getNextSubmittalStatus', () => {
  it.each([
    ['draft', 'Submit for Review', 'submitted'],
    ['submitted', 'GC Approve', 'gc_review'],
    ['submitted', 'GC Reject', 'rejected'],
    ['gc_review', 'Forward to Architect', 'architect_review'],
    ['gc_review', 'GC Reject', 'rejected'],
    ['gc_review', 'Revise and Resubmit', 'resubmit'],
    ['architect_review', 'Architect Approve', 'approved'],
    ['architect_review', 'Architect Reject', 'rejected'],
    ['approved', 'Close Out', 'closed'],
    ['rejected', 'Revise and Resubmit', 'draft'],
    ['resubmit', 'Revise and Resubmit', 'draft'],
  ] as const)('%s + %s → %s', (from, action, to) => {
    expect(getNextSubmittalStatus(from, action)).toBe(to)
  })

  it('returns null on unknown action', () => {
    expect(getNextSubmittalStatus('draft', 'Bogus')).toBeNull()
    expect(getNextSubmittalStatus('closed', 'Submit for Review')).toBeNull()
  })
})

describe('submittalMachine — getSubmittalStatusConfig', () => {
  it.each([
    ['draft', 'Draft'],
    ['submitted', 'Submitted'],
    ['gc_review', 'GC Review'],
    ['architect_review', 'A/E Review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['resubmit', 'Revise and Resubmit'],
    ['closed', 'Closed'],
  ] as const)('%s → "%s"', (state, label) => {
    expect(getSubmittalStatusConfig(state).label).toBe(label)
  })

  it('falls back to draft for an unknown state', () => {
    // @ts-expect-error — exercising fallback
    expect(getSubmittalStatusConfig('mystery').label).toBe('Draft')
  })
})

describe('submittalMachine — getStampConfig', () => {
  it.each([
    ['approved', 'APPROVED'],
    ['approved_as_noted', 'APPROVED AS NOTED'],
    ['rejected', 'REJECTED'],
    ['revise_and_resubmit', 'REVISE AND RESUBMIT'],
  ] as const)('%s → "%s"', (stamp, label) => {
    expect(getStampConfig(stamp).label).toBe(label)
  })

  it('falls back to approved for unknown stamp', () => {
    // @ts-expect-error — exercising fallback
    expect(getStampConfig('mystery').label).toBe('APPROVED')
  })
})

describe('submittalMachine — getLeadTimeUrgency', () => {
  it('returns the no-submit-date variant when null', () => {
    const r = getLeadTimeUrgency(null)
    expect(r.urgent).toBe(false)
    expect(r.label).toBe('No submit date')
  })

  it('flags past-submit-date as urgent', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const r = getLeadTimeUrgency(past)
    expect(r.urgent).toBe(true)
    expect(r.label).toMatch(/past submit date/)
  })

  it('flags within 7 days as urgent', () => {
    const soon = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
    const r = getLeadTimeUrgency(soon)
    expect(r.urgent).toBe(true)
    expect(r.label).toMatch(/Submit within/)
  })

  it('not urgent when well in the future', () => {
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const r = getLeadTimeUrgency(far)
    expect(r.urgent).toBe(false)
  })
})

describe('submittalMachine — CSI_DIVISIONS', () => {
  it('contains all 16 standard MasterFormat divisions (01-16+)', () => {
    expect(CSI_DIVISIONS.length).toBeGreaterThanOrEqual(16)
  })

  it('every entry has a 2-character zero-padded code', () => {
    for (const d of CSI_DIVISIONS) {
      expect(d.code).toMatch(/^\d{2}$/)
      expect(d.name).toBeTruthy()
    }
  })
})
