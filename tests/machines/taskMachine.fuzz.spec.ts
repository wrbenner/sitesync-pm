/**
 * FMEA Section A — taskMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.TASK.1:   REOPEN from `done` returns to `todo` (not `in_progress`).
 *                 The failure mode is reopening directly to in_progress,
 *                 bypassing the assignment / scoping step that `todo`
 *                 represents.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { taskMachine } from '../../src/machines/taskMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['todo', 'in_progress', 'in_review', 'done'] as const

const EVENTS = [
  'START',
  'SUBMIT_FOR_REVIEW',
  'APPROVE',
  'REJECT',
  'COMPLETE',
  'REOPEN',
  // adversarial
  'BOGUS',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    todo: [],
    in_progress: [{ type: 'START' }],
    in_review: [{ type: 'START' }, { type: 'SUBMIT_FOR_REVIEW' }],
    done: [{ type: 'START' }, { type: 'COMPLETE' }],
  },
}

const ACCEPTED: Record<string, Set<string>> = {
  todo: new Set(['START', 'COMPLETE']),
  in_progress: new Set(['SUBMIT_FOR_REVIEW', 'COMPLETE']),
  in_review: new Set(['APPROVE', 'REJECT']),
  done: new Set(['REOPEN']),
}

describe('taskMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(taskMachine, REACHABILITY, () => ({}))
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state', () => {
    const rows = fuzzMatrix(taskMachine, REACHABILITY, () => ({}))
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.TASK.1: REOPEN from done returns to todo (not in_progress)', () => {
    const actor = createActor(taskMachine)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'COMPLETE' })
    expect(actor.getSnapshot().value).toBe('done')
    actor.send({ type: 'REOPEN' })
    expect(actor.getSnapshot().value).toBe('todo')
    actor.stop()
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(taskMachine)
    actor.start()
    actor.send({ type: 'START' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(28)
  })
})
