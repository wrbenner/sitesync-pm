/**
 * FMEA Section A — punchItemMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.PUNCH.1:  VERIFY_DIRECT from `open` is an *intentional* shortcut for
 *                 items already complete at creation. The spec ensures the
 *                 transition target is `verified` and asserts there's no
 *                 alternate path that lets VERIFY_DIRECT land in `verified`
 *                 from any other state. This catches the failure mode where
 *                 someone adds VERIFY_DIRECT to more states without a guard.
 *   - A.PUNCH.2:  REJECT from `verified` returns to `in_progress` (NOT `open`)
 *                 and REJECT from `sub_complete` returns to `in_progress`.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { punchItemMachine } from '../../src/machines/punchItemMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['open', 'in_progress', 'sub_complete', 'verified', 'rejected'] as const

const EVENTS = [
  'START_WORK',
  'VERIFY_DIRECT',
  'MARK_SUB_COMPLETE',
  'VERIFY',
  'REJECT',
  'REOPEN',
  // adversarial
  'BOGUS',
  'PROMOTE',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    open: [],
    in_progress: [{ type: 'START_WORK' }],
    sub_complete: [{ type: 'START_WORK' }, { type: 'MARK_SUB_COMPLETE' }],
    verified: [{ type: 'VERIFY_DIRECT' }],
    // No path to `rejected` exists from the initial state — the machine
    // declares `rejected` as a state but no inbound edge in the current
    // definition. We still include it in the state list for completeness;
    // fuzzMatrix's `reached` flag distinguishes reachable from unreachable.
    rejected: [],
  },
}

const ACCEPTED: Record<string, Set<string>> = {
  open: new Set(['START_WORK', 'VERIFY_DIRECT']),
  in_progress: new Set(['MARK_SUB_COMPLETE', 'REOPEN']),
  sub_complete: new Set(['VERIFY', 'REJECT', 'REOPEN']),
  verified: new Set(['REJECT', 'REOPEN']),
  rejected: new Set(['START_WORK', 'REOPEN']),
}

describe('punchItemMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(punchItemMachine, REACHABILITY, () => ({}))
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state', () => {
    const rows = fuzzMatrix(punchItemMachine, REACHABILITY, () => ({}))
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.PUNCH.1: VERIFY_DIRECT from open lands in verified', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('open')
    actor.send({ type: 'VERIFY_DIRECT' })
    expect(actor.getSnapshot().value).toBe('verified')
    actor.stop()
  })

  it('A.PUNCH.1: VERIFY_DIRECT from non-open states is dropped (no skip-shortcut)', () => {
    for (const state of ['in_progress', 'sub_complete', 'verified'] as const) {
      const actor = createActor(punchItemMachine)
      actor.start()
      for (const e of REACHABILITY.path[state] ?? []) actor.send(e)
      const before = actor.getSnapshot().value
      actor.send({ type: 'VERIFY_DIRECT' })
      expect(actor.getSnapshot().value, `VERIFY_DIRECT from ${state}`).toBe(before)
      actor.stop()
    }
  })

  it('A.PUNCH.2: REJECT from verified returns to in_progress (not open)', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    actor.send({ type: 'VERIFY_DIRECT' })
    expect(actor.getSnapshot().value).toBe('verified')
    actor.send({ type: 'REJECT' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.stop()
  })

  it('A.PUNCH.2: REJECT from sub_complete returns to in_progress', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'MARK_SUB_COMPLETE' })
    actor.send({ type: 'REJECT' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.stop()
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    actor.send({ type: 'START_WORK' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(40)
  })
})
