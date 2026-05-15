/**
 * FMEA Section A — inspectionMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.INSP.1:   `getScoreConfig(null)` returns "Not scored" while
 *                 `getScoreConfig(0)` returns the Fail bucket. The failure
 *                 mode is using `!score` instead of `score === null` — that
 *                 would bucket a true zero-score (catastrophic fail) into
 *                 "Not scored".
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { inspectionMachine, getScoreConfig } from '../../src/machines/inspectionMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['scheduled', 'in_progress', 'completed', 'approved', 'rejected', 'cancelled'] as const

const EVENTS = [
  'START',
  'COMPLETE',
  'APPROVE',
  'REJECT',
  'RESCHEDULE',
  'CANCEL',
  // adversarial
  'BOGUS',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    scheduled: [],
    in_progress: [{ type: 'START' }],
    completed: [{ type: 'START' }, { type: 'COMPLETE', score: 85 }],
    approved: [{ type: 'START' }, { type: 'COMPLETE', score: 95 }, { type: 'APPROVE', userId: 'u1' }],
    rejected: [
      { type: 'START' },
      { type: 'COMPLETE', score: 50 },
      { type: 'REJECT', userId: 'u1', reason: 'failed' },
    ],
    cancelled: [{ type: 'CANCEL', userId: 'u1', reason: 'storm' }],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  COMPLETE: { score: 85 },
  APPROVE: { userId: 'u1' },
  REJECT: { userId: 'u1', reason: 'failed' },
  RESCHEDULE: { userId: 'u1' },
  CANCEL: { userId: 'u1', reason: 'storm' },
}

const ACCEPTED: Record<string, Set<string>> = {
  scheduled: new Set(['START', 'CANCEL']),
  in_progress: new Set(['COMPLETE', 'CANCEL']),
  completed: new Set(['APPROVE', 'REJECT']),
  approved: new Set(),
  rejected: new Set(['RESCHEDULE', 'CANCEL']),
  cancelled: new Set(),
}

describe('inspectionMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(inspectionMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state', () => {
    const rows = fuzzMatrix(inspectionMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.INSP.1: getScoreConfig(null) returns "Not scored" — must not bucket zero into null', () => {
    const out = getScoreConfig(null)
    expect(out.label).toBe('Not scored')
  })

  it('A.INSP.1: getScoreConfig(0) returns the Fail bucket (0% Fail) — null vs zero disambiguation', () => {
    const out = getScoreConfig(0)
    expect(out.label).toBe('0% Fail')
  })

  it('A.INSP.1: getScoreConfig boundaries — 70 marginal, 90 pass', () => {
    expect(getScoreConfig(69).label).toBe('69% Fail')
    expect(getScoreConfig(70).label).toBe('70% Marginal')
    expect(getScoreConfig(89).label).toBe('89% Marginal')
    expect(getScoreConfig(90).label).toBe('90% Pass')
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(inspectionMachine)
    actor.start()
    actor.send({ type: 'START' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(42)
  })
})
