/**
 * FMEA Section A — closeoutItemMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.CLOSE.1:  REJECT from `under_review` lands in `rejected`, and
 *                 RESUBMIT from `rejected` returns to `submitted`. This
 *                 round-trip is the recovery path; the failure mode is a
 *                 missing RESUBMIT edge that traps the item.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { closeoutItemMachine } from '../../src/machines/closeoutMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['required', 'requested', 'submitted', 'under_review', 'approved', 'rejected'] as const

const EVENTS = [
  'REQUEST',
  'SUBMIT',
  'START_REVIEW',
  'APPROVE',
  'REJECT',
  'RESUBMIT',
  // adversarial
  'BOGUS',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    required: [],
    requested: [{ type: 'REQUEST', contactId: 'c1' }],
    submitted: [{ type: 'REQUEST', contactId: 'c1' }, { type: 'SUBMIT', documentIds: ['d1'] }],
    under_review: [
      { type: 'REQUEST', contactId: 'c1' },
      { type: 'SUBMIT', documentIds: ['d1'] },
      { type: 'START_REVIEW' },
    ],
    approved: [
      { type: 'REQUEST', contactId: 'c1' },
      { type: 'SUBMIT', documentIds: ['d1'] },
      { type: 'START_REVIEW' },
      { type: 'APPROVE', reviewerId: 'r1' },
    ],
    rejected: [
      { type: 'REQUEST', contactId: 'c1' },
      { type: 'SUBMIT', documentIds: ['d1'] },
      { type: 'START_REVIEW' },
      { type: 'REJECT', comments: 'fix', reviewerId: 'r1' },
    ],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  REQUEST: { contactId: 'c1' },
  SUBMIT: { documentIds: ['d1'] },
  APPROVE: { reviewerId: 'r1' },
  REJECT: { comments: 'fix', reviewerId: 'r1' },
  RESUBMIT: { documentIds: ['d2'] },
}

const ACCEPTED: Record<string, Set<string>> = {
  required: new Set(['REQUEST']),
  requested: new Set(['SUBMIT']),
  submitted: new Set(['START_REVIEW', 'APPROVE']),
  under_review: new Set(['APPROVE', 'REJECT']),
  approved: new Set(),
  rejected: new Set(['RESUBMIT']),
}

describe('closeoutItemMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(closeoutItemMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state', () => {
    const rows = fuzzMatrix(closeoutItemMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.CLOSE.1: REJECT from under_review lands in rejected; RESUBMIT lifts back to submitted', () => {
    const actor = createActor(closeoutItemMachine)
    actor.start()
    actor.send({ type: 'REQUEST', contactId: 'c1' })
    actor.send({ type: 'SUBMIT', documentIds: ['d1'] })
    actor.send({ type: 'START_REVIEW' })
    actor.send({ type: 'REJECT', comments: 'fix', reviewerId: 'r1' })
    expect(actor.getSnapshot().value).toBe('rejected')
    actor.send({ type: 'RESUBMIT', documentIds: ['d2'] })
    expect(actor.getSnapshot().value).toBe('submitted')
    actor.stop()
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(closeoutItemMachine)
    actor.start()
    actor.send({ type: 'REQUEST', contactId: 'c1' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(42)
  })
})
