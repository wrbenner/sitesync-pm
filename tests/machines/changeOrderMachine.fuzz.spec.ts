/**
 * FMEA Section A — changeOrderMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.CO.1:    PROMOTE event is part of the machine event type but has NO
 *                handler in any state — assert it is rejected (state held) in
 *                every state. The PCO→COR→CO promotion logic lives in helpers
 *                (`getNextCOType`), NOT in the machine; this test surfaces the
 *                gap so reviewers can decide whether to add machine handlers
 *                or remove the event type.
 *   - A.CO.2:    RETURN_TO_PCO is only valid in `rejected`.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { changeOrderMachine, getNextCOType, getValidCOTransitions } from '../../src/machines/changeOrderMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['draft', 'pending_review', 'approved', 'rejected', 'void'] as const

const EVENTS = [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'VOID',
  'PROMOTE',
  'RETURN_TO_PCO',
  // adversarial
  'BOGUS',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    draft: [],
    pending_review: [{ type: 'SUBMIT' }],
    approved: [{ type: 'SUBMIT' }, { type: 'APPROVE', userId: 'u1' }],
    rejected: [{ type: 'SUBMIT' }, { type: 'REJECT', userId: 'u1' }],
    void: [{ type: 'SUBMIT' }, { type: 'VOID', userId: 'u1', reason: 'r' }],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  APPROVE: { userId: 'u1' },
  REJECT: { userId: 'u1' },
  VOID: { userId: 'u1', reason: 'r' },
  RETURN_TO_PCO: { revisionNotes: 'fix it' },
}

const ACCEPTED: Record<string, Set<string>> = {
  draft: new Set(['SUBMIT']),
  pending_review: new Set(['APPROVE', 'REJECT', 'VOID']),
  approved: new Set(['VOID']),
  rejected: new Set(['SUBMIT', 'RETURN_TO_PCO']),
  void: new Set(),
}

describe('changeOrderMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(changeOrderMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state', () => {
    const rows = fuzzMatrix(changeOrderMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.CO.1: PROMOTE event is defined in machine types but has NO transition handler — must be dropped everywhere', () => {
    for (const state of STATES) {
      const actor = createActor(changeOrderMachine)
      actor.start()
      // Drive to target state
      const path = REACHABILITY.path[state] ?? []
      for (const e of path) actor.send(e)
      const before = actor.getSnapshot().value
      actor.send({ type: 'PROMOTE' })
      const after = actor.getSnapshot().value
      expect(after, `PROMOTE from ${state} must not transition`).toBe(before)
      actor.stop()
    }
  })

  it('A.CO.1: helper-layer promotion chain (PCO→COR→CO) is the only legal promotion path', () => {
    expect(getNextCOType('pco')).toBe('cor')
    expect(getNextCOType('cor')).toBe('co')
    expect(getNextCOType('co')).toBeNull()
  })

  it('A.CO.1: helper getValidCOTransitions exposes Promote only on `approved` PCO/COR', () => {
    expect(getValidCOTransitions('approved', 'pco')).toContain('Promote to COR')
    expect(getValidCOTransitions('approved', 'cor')).toContain('Promote to CO')
    expect(getValidCOTransitions('approved', 'co')).not.toContain('Promote to COR')
    expect(getValidCOTransitions('approved', 'co')).not.toContain('Promote to CO')
    // Promote must not appear on non-approved states
    for (const s of ['draft', 'pending_review', 'rejected', 'void'] as const) {
      expect(getValidCOTransitions(s, 'pco')).not.toContain('Promote to COR')
    }
  })

  it('A.CO.2: RETURN_TO_PCO valid only from rejected', () => {
    const actor = createActor(changeOrderMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'REJECT', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('rejected')
    actor.send({ type: 'RETURN_TO_PCO', revisionNotes: 'fix' })
    expect(actor.getSnapshot().value).toBe('draft')
    actor.stop()
  })

  it('A.CO.2: RETURN_TO_PCO from non-rejected is dropped', () => {
    for (const state of ['draft', 'pending_review', 'approved'] as const) {
      const actor = createActor(changeOrderMachine)
      actor.start()
      for (const e of REACHABILITY.path[state] ?? []) actor.send(e)
      const before = actor.getSnapshot().value
      actor.send({ type: 'RETURN_TO_PCO', revisionNotes: 'r' })
      expect(actor.getSnapshot().value).toBe(before)
      actor.stop()
    }
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(changeOrderMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(35)
  })
})
