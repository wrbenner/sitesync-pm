/**
 * FMEA Section A — rfiMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: per-(state × event) matrix — no silent drops; every post-send
 *     state is a known machine state.
 *   - A.RFI.1:   VOID accepted from non-admin role (asserted at helper layer,
 *                since the machine itself does not gate by role — the surface
 *                is `getValidTransitions(status, userRole)`).
 *   - A.RFI.2:   REOPEN from `void` (terminal) is silently dropped — machine
 *                holds in `void`.
 *
 * Hand-rolled vitest matrix (no @xstate/test dep available).
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { rfiMachine, getValidTransitions } from '../../src/machines/rfiMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['draft', 'open', 'under_review', 'answered', 'closed', 'void'] as const
const EVENTS = [
  'SUBMIT',
  'ASSIGN',
  'START_REVIEW',
  'RESPOND',
  'CLOSE',
  'REOPEN',
  'VOID',
  // Adversarial: events the machine should never have heard of.
  'BOGUS',
  'PROMOTE',
] as const

// Source-of-truth event-graph: each (state, event) pair that the *machine*
// (rfiMachine.ts) recognises. Off-graph pairs must leave the actor in `state`.
const ACCEPTED: Record<string, Set<string>> = {
  draft: new Set(['SUBMIT', 'VOID']),
  open: new Set(['ASSIGN', 'CLOSE', 'VOID']),
  under_review: new Set(['RESPOND', 'CLOSE', 'VOID']),
  answered: new Set(['CLOSE', 'REOPEN', 'VOID']),
  closed: new Set(['REOPEN', 'VOID']),
  void: new Set(),
}

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    draft: [],
    open: [{ type: 'SUBMIT' }],
    under_review: [{ type: 'SUBMIT' }, { type: 'ASSIGN', assigneeId: 'u1' }],
    answered: [
      { type: 'SUBMIT' },
      { type: 'ASSIGN', assigneeId: 'u1' },
      { type: 'RESPOND', content: 'r', userId: 'u1' },
    ],
    closed: [{ type: 'SUBMIT' }, { type: 'CLOSE', userId: 'u1' }],
    void: [{ type: 'VOID', userId: 'u1', reason: 'r' }],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  ASSIGN: { assigneeId: 'u1' },
  RESPOND: { content: 'r', userId: 'u1' },
  CLOSE: { userId: 'u1' },
  REOPEN: { userId: 'u1' },
  VOID: { userId: 'u1', reason: 'r' },
}

describe('rfiMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) pair lands in a defined state', () => {
    const rows = fuzzMatrix(rfiMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: pairs not in the transition graph are rejected (state held)', () => {
    const rows = fuzzMatrix(rfiMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        // Off-graph events must not change the state.
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.RFI.1: getValidTransitions hides VOID from non-admin roles', () => {
    const nonAdminRoles = ['viewer', 'subcontractor', 'superintendent', 'project_manager']
    for (const role of nonAdminRoles) {
      for (const s of ['draft', 'open', 'under_review', 'answered', 'closed'] as const) {
        expect(getValidTransitions(s, role)).not.toContain('Void')
      }
    }
  })

  it('A.RFI.1: getValidTransitions exposes VOID for admin/owner', () => {
    for (const role of ['admin', 'owner']) {
      for (const s of ['draft', 'open', 'under_review', 'answered', 'closed'] as const) {
        expect(getValidTransitions(s, role)).toContain('Void')
      }
    }
  })

  it('A.RFI.2: REOPEN from void (terminal) holds in void', () => {
    const actor = createActor(rfiMachine)
    actor.start()
    actor.send({ type: 'VOID', userId: 'u1', reason: 'r' })
    expect(actor.getSnapshot().value).toBe('void')
    actor.send({ type: 'REOPEN', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('void')
    actor.stop()
  })

  it('actor cleanup: stop() leaves no spawned children', () => {
    const actor = createActor(rfiMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.stop()
    const snap = actor.getSnapshot()
    expect(snap.children).toEqual({})
  })

  it('reports the matrix size (signal for FMEA dashboard)', () => {
    const pairs = STATES.length * EVENTS.length
    expect(pairs).toBe(54)
  })
})
