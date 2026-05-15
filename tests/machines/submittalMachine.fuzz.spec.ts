/**
 * FMEA Section A — submittalMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.SUB.1:    FORWARD_TO_REVIEWER from `submitted` MUST be dropped — the
 *                 only valid path to `architect_review` is via `gc_review`.
 *   - A.SUB.2:    RESUBMIT in `rejected` / `resubmit` increments revision and
 *                 invokes the `triggerRevisionCreation` action.
 *
 * Hand-rolled vitest matrix (no @xstate/test).
 */
import { describe, it, expect, vi } from 'vitest'
import { createActor } from 'xstate'
import { submittalMachine } from '../../src/machines/submittalMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = [
  'draft',
  'submitted',
  'gc_review',
  'architect_review',
  'approved',
  'rejected',
  'resubmit',
  'closed',
] as const

const EVENTS = [
  'SUBMIT',
  'GC_APPROVE',
  'GC_REJECT',
  'FORWARD_TO_REVIEWER',
  'ARCHITECT_APPROVE',
  'ARCHITECT_REJECT',
  'ARCHITECT_REVISE',
  'RESUBMIT',
  'CLOSE',
  // adversarial
  'BOGUS',
  'PROMOTE',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    draft: [],
    submitted: [{ type: 'SUBMIT' }],
    gc_review: [{ type: 'SUBMIT' }, { type: 'GC_APPROVE' }],
    architect_review: [{ type: 'SUBMIT' }, { type: 'GC_APPROVE' }, { type: 'FORWARD_TO_REVIEWER' }],
    approved: [
      { type: 'SUBMIT' },
      { type: 'GC_APPROVE' },
      { type: 'FORWARD_TO_REVIEWER' },
      { type: 'ARCHITECT_APPROVE' },
    ],
    rejected: [{ type: 'SUBMIT' }, { type: 'GC_REJECT' }],
    resubmit: [{ type: 'SUBMIT' }, { type: 'GC_APPROVE' }, { type: 'ARCHITECT_REVISE' }],
    closed: [
      { type: 'SUBMIT' },
      { type: 'GC_APPROVE' },
      { type: 'FORWARD_TO_REVIEWER' },
      { type: 'ARCHITECT_APPROVE' },
      { type: 'CLOSE' },
    ],
  },
}

const ACCEPTED: Record<string, Set<string>> = {
  draft: new Set(['SUBMIT']),
  submitted: new Set(['GC_APPROVE', 'GC_REJECT']),
  gc_review: new Set(['FORWARD_TO_REVIEWER', 'GC_REJECT', 'ARCHITECT_REVISE']),
  architect_review: new Set(['ARCHITECT_APPROVE', 'ARCHITECT_REJECT', 'ARCHITECT_REVISE']),
  approved: new Set(['CLOSE']),
  rejected: new Set(['RESUBMIT']),
  resubmit: new Set(['RESUBMIT']),
  closed: new Set(),
}

describe('submittalMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(submittalMachine, REACHABILITY, () => ({}))
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph (state × event) pairs hold state', () => {
    const rows = fuzzMatrix(submittalMachine, REACHABILITY, () => ({}))
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.SUB.1: FORWARD_TO_REVIEWER from submitted is dropped (cannot skip gc_review)', () => {
    const actor = createActor(submittalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('submitted')
    actor.send({ type: 'FORWARD_TO_REVIEWER' })
    expect(actor.getSnapshot().value).toBe('submitted')
    actor.stop()
  })

  it('A.SUB.1: FORWARD_TO_REVIEWER from gc_review IS the only path to architect_review', () => {
    const actor = createActor(submittalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_APPROVE' })
    expect(actor.getSnapshot().value).toBe('gc_review')
    actor.send({ type: 'FORWARD_TO_REVIEWER' })
    expect(actor.getSnapshot().value).toBe('architect_review')
    actor.stop()
  })

  it('A.SUB.2: RESUBMIT from rejected increments revisionNumber and fires triggerRevisionCreation', () => {
    const triggerSpy = vi.fn()
    const provided = submittalMachine.provide({
      actions: { triggerRevisionCreation: triggerSpy },
    })
    const actor = createActor(provided, {
      input: undefined,
    })
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_REJECT' })
    expect(actor.getSnapshot().value).toBe('rejected')
    actor.send({ type: 'RESUBMIT' })
    expect(actor.getSnapshot().value).toBe('draft')
    expect(actor.getSnapshot().context.revisionNumber).toBe(2)
    expect(triggerSpy).toHaveBeenCalledTimes(1)
    actor.stop()
  })

  it('A.SUB.2: RESUBMIT from resubmit increments revisionNumber', () => {
    const actor = createActor(submittalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_APPROVE' })
    actor.send({ type: 'ARCHITECT_REVISE' })
    expect(actor.getSnapshot().value).toBe('resubmit')
    actor.send({ type: 'RESUBMIT' })
    expect(actor.getSnapshot().context.revisionNumber).toBe(2)
    actor.stop()
  })

  it('actor cleanup: stopped actor has no spawned children', () => {
    const actor = createActor(submittalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(88)
  })
})
