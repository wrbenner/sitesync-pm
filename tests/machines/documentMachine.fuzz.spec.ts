/**
 * FMEA Section A — documentMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.DOC.1:    RESTORE from `archived` returns to `approved`. The failure
 *                 mode is restoring an archived doc directly to `published`
 *                 or `draft`, skipping the approval re-check.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { documentMachine } from '../../src/machines/documentMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['draft', 'submitted', 'approved', 'rejected', 'archived', 'void'] as const

const EVENTS = [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'ARCHIVE',
  'RESTORE',
  'RESUBMIT',
  'VOID',
  // adversarial
  'BOGUS',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    draft: [],
    submitted: [{ type: 'SUBMIT', userId: 'u1' }],
    approved: [{ type: 'SUBMIT', userId: 'u1' }, { type: 'APPROVE', userId: 'u1' }],
    rejected: [{ type: 'SUBMIT', userId: 'u1' }, { type: 'REJECT', userId: 'u1' }],
    archived: [
      { type: 'SUBMIT', userId: 'u1' },
      { type: 'APPROVE', userId: 'u1' },
      { type: 'ARCHIVE', userId: 'u1' },
    ],
    void: [{ type: 'VOID', userId: 'u1', reason: 'r' }],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  SUBMIT: { userId: 'u1' },
  APPROVE: { userId: 'u1' },
  REJECT: { userId: 'u1', reason: 'r' },
  ARCHIVE: { userId: 'u1' },
  RESTORE: { userId: 'u1' },
  RESUBMIT: { userId: 'u1' },
  VOID: { userId: 'u1', reason: 'r' },
}

const ACCEPTED: Record<string, Set<string>> = {
  draft: new Set(['SUBMIT', 'VOID']),
  submitted: new Set(['APPROVE', 'REJECT', 'VOID']),
  approved: new Set(['ARCHIVE', 'VOID']),
  rejected: new Set(['RESUBMIT', 'VOID']),
  archived: new Set(['RESTORE']),
  void: new Set(),
}

describe('documentMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(documentMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state', () => {
    const rows = fuzzMatrix(documentMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.DOC.1: RESTORE from archived returns to approved (not published, not draft)', () => {
    const actor = createActor(documentMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', userId: 'u1' })
    actor.send({ type: 'APPROVE', userId: 'u1' })
    actor.send({ type: 'ARCHIVE', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('archived')
    actor.send({ type: 'RESTORE', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('approved')
    actor.stop()
  })

  it('A.DOC.1: RESTORE from non-archived states is dropped', () => {
    for (const state of ['draft', 'submitted', 'approved', 'rejected'] as const) {
      const actor = createActor(documentMachine)
      actor.start()
      for (const e of REACHABILITY.path[state] ?? []) actor.send(e)
      const before = actor.getSnapshot().value
      actor.send({ type: 'RESTORE', userId: 'u1' })
      expect(actor.getSnapshot().value, `RESTORE from ${state}`).toBe(before)
      actor.stop()
    }
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(documentMachine)
    actor.start()
    actor.send({ type: 'SUBMIT', userId: 'u1' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(48)
  })
})
