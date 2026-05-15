/**
 * FMEA Section A — agentStreamMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.AGENT.1:  APPROVE / REJECT in `awaiting_approval` clears
 *                 `activeApprovalId` AND returns to `streaming`. The failure
 *                 mode is keeping the id pinned, which would cause the next
 *                 approval to short-circuit.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { agentStreamMachine } from '../../src/machines/agentStreamMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['idle', 'streaming', 'awaiting_approval', 'completed', 'error'] as const

const EVENTS = [
  'START',
  'EVENT_RECEIVED',
  'APPROVAL_REQUIRED',
  'APPROVE',
  'REJECT',
  'COMPLETE',
  'ERROR',
  'RETRY',
  'RESET',
  // adversarial
  'BOGUS',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    idle: [],
    streaming: [{ type: 'START', sessionId: 's1', projectId: 'p1' }],
    awaiting_approval: [
      { type: 'START', sessionId: 's1', projectId: 'p1' },
      { type: 'APPROVAL_REQUIRED', actionId: 'a1' },
    ],
    completed: [{ type: 'START', sessionId: 's1', projectId: 'p1' }, { type: 'COMPLETE' }],
    error: [{ type: 'START', sessionId: 's1', projectId: 'p1' }, { type: 'ERROR', message: 'oops' }],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  START: { sessionId: 's1', projectId: 'p1' },
  EVENT_RECEIVED: { event: { type: 'state_snapshot', data: { state: 'planning' } } },
  APPROVAL_REQUIRED: { actionId: 'a1' },
  APPROVE: { actionId: 'a1' },
  REJECT: { actionId: 'a1', reason: 'no' },
  ERROR: { message: 'oops' },
}

const ACCEPTED: Record<string, Set<string>> = {
  // EVENT_RECEIVED is accepted but doesn't change state — flagged separately.
  idle: new Set(['START']),
  streaming: new Set(['APPROVAL_REQUIRED', 'COMPLETE', 'ERROR']),
  awaiting_approval: new Set(['APPROVE', 'REJECT']),
  completed: new Set(['RESET']),
  error: new Set(['RETRY', 'RESET']),
}

describe('agentStreamMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(agentStreamMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state (EVENT_RECEIVED in streaming is an exception — internal-only)', () => {
    const rows = fuzzMatrix(agentStreamMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      // EVENT_RECEIVED in streaming is accepted but doesn't transition.
      if (row.state === 'streaming' && row.event === 'EVENT_RECEIVED') continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.AGENT.1: APPROVE in awaiting_approval clears activeApprovalId and returns to streaming', () => {
    const actor = createActor(agentStreamMachine)
    actor.start()
    actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
    actor.send({ type: 'APPROVAL_REQUIRED', actionId: 'a1' })
    expect(actor.getSnapshot().value).toBe('awaiting_approval')
    expect(actor.getSnapshot().context.activeApprovalId).toBe('a1')
    actor.send({ type: 'APPROVE', actionId: 'a1' })
    expect(actor.getSnapshot().value).toBe('streaming')
    expect(actor.getSnapshot().context.activeApprovalId).toBeNull()
    actor.stop()
  })

  it('A.AGENT.1: REJECT in awaiting_approval clears activeApprovalId and returns to streaming', () => {
    const actor = createActor(agentStreamMachine)
    actor.start()
    actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
    actor.send({ type: 'APPROVAL_REQUIRED', actionId: 'a1' })
    actor.send({ type: 'REJECT', actionId: 'a1', reason: 'no' })
    expect(actor.getSnapshot().value).toBe('streaming')
    expect(actor.getSnapshot().context.activeApprovalId).toBeNull()
    actor.stop()
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(agentStreamMachine)
    actor.start()
    actor.send({ type: 'START', sessionId: 's1', projectId: 'p1' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(50)
  })
})
