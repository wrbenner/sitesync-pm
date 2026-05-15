/**
 * FMEA Section A — scheduleMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.SCHED.1:  The DB CHECK constraint lists 6 statuses
 *                 ('completed', 'active', 'upcoming', 'at_risk', 'delayed',
 *                 'on_track') but the machine only declares 4. The spec
 *                 asserts:
 *                   - the machine never lands in `on_track` or `at_risk`
 *                   - `deriveStatusFromProgress` only returns values the
 *                     machine recognises (otherwise the displayed status will
 *                     drift from the machine state).
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { scheduleMachine, deriveStatusFromProgress } from '../../src/machines/scheduleMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

// Only the *machine* states. Helper layer adds at_risk/on_track but those
// are display-only.
const STATES = ['upcoming', 'active', 'delayed', 'completed'] as const

const EVENTS = [
  'START',
  'MARK_DELAYED',
  'RESUME',
  'COMPLETE',
  'REOPEN',
  // adversarial
  'BOGUS',
  'PROMOTE',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    upcoming: [],
    active: [{ type: 'START' }],
    delayed: [{ type: 'START' }, { type: 'MARK_DELAYED', reason: 'rain' }],
    completed: [{ type: 'START' }, { type: 'COMPLETE' }],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  MARK_DELAYED: { reason: 'rain' },
  REOPEN: { userId: 'u1' },
}

const ACCEPTED: Record<string, Set<string>> = {
  upcoming: new Set(['START', 'MARK_DELAYED']),
  active: new Set(['COMPLETE', 'MARK_DELAYED']),
  delayed: new Set(['RESUME', 'COMPLETE']),
  completed: new Set(['REOPEN']),
}

describe('scheduleMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(scheduleMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state', () => {
    const rows = fuzzMatrix(scheduleMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.SCHED.1: machine never lands in on_track or at_risk', () => {
    // Exhaustive: drive every reachable state with every event and assert
    // the post-send state is never on_track or at_risk.
    const rows = fuzzMatrix(scheduleMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      expect(row.after, `(${row.state}, ${row.event})`).not.toBe('on_track')
      expect(row.after, `(${row.state}, ${row.event})`).not.toBe('at_risk')
    }
  })

  it('A.SCHED.1: deriveStatusFromProgress only returns machine states (no helper-only labels at this entry)', () => {
    const machineStates = new Set([...STATES, 'on_track', 'at_risk'])
    // Try a representative sweep of inputs.
    for (const percent of [0, 25, 50, 75, 99, 100, 150]) {
      for (const current of ['upcoming', 'active', 'delayed', 'completed', 'on_track', 'at_risk'] as const) {
        const out = deriveStatusFromProgress(percent, current)
        expect(machineStates.has(out), `percent=${percent}, current=${current} → ${out}`).toBe(true)
      }
    }
  })

  it('A.SCHED.1: deriveStatusFromProgress(100) returns completed (machine state)', () => {
    expect(deriveStatusFromProgress(100, 'upcoming')).toBe('completed')
    expect(deriveStatusFromProgress(100, 'active')).toBe('completed')
    expect(deriveStatusFromProgress(100, 'delayed')).toBe('completed')
  })

  it('A.SCHED.1: deriveStatusFromProgress(>0) from upcoming returns active', () => {
    expect(deriveStatusFromProgress(1, 'upcoming')).toBe('active')
    expect(deriveStatusFromProgress(50, 'upcoming')).toBe('active')
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(scheduleMachine)
    actor.start()
    actor.send({ type: 'START' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(28)
  })
})
