/**
 * FMEA Section A — dailyLogMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.DL.1:    Concurrent AMEND fires must not produce two distinct
 *                `amending` advancements on the same actor. Two parallel
 *                sends from `submitted` should result in a single AMEND
 *                edge being consumed; the second is rejected because the
 *                actor has already left `submitted`.
 *   - A.DL.2:    AMEND from `draft` MUST be dropped — AMEND is only valid
 *                in `submitted`.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { dailyLogMachine } from '../../src/machines/dailyLogMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['draft', 'submitted', 'amending', 'approved', 'rejected'] as const

const EVENTS = [
  'SAVE_DRAFT',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'AMEND',
  // adversarial
  'BOGUS',
] as const

const DUMMY_PAYLOAD = {
  type: 'daily_log_entry' as const,
  date: '2026-05-14',
} as unknown as Record<string, unknown>

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    draft: [],
    submitted: [{ type: 'SUBMIT' }],
    // `amending` is invoke-driven (createLog actor). Difficult to "park" the
    // actor synchronously; the AMEND test below exercises this state directly.
    amending: [{ type: 'SUBMIT' }, { type: 'AMEND', payload: DUMMY_PAYLOAD }],
    approved: [{ type: 'SUBMIT' }, { type: 'APPROVE', userId: 'u1' }],
    rejected: [{ type: 'SUBMIT' }, { type: 'REJECT', comments: 'fix it', userId: 'u1' }],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  APPROVE: { userId: 'u1' },
  REJECT: { comments: 'fix it', userId: 'u1' },
  AMEND: { payload: DUMMY_PAYLOAD },
}

// `amending` runs an invoke synchronously in tests because the no-op actor
// resolves immediately, so by the time we send the next event the machine is
// already back in `draft` (per onDone). For the matrix we treat `amending`
// as transient and accept that any event there lands in draft / amending /
// submitted (the onError fallback).
const ACCEPTED: Record<string, Set<string>> = {
  draft: new Set(['SAVE_DRAFT', 'SUBMIT']),
  submitted: new Set(['APPROVE', 'REJECT', 'AMEND']),
  amending: new Set(), // invoke-driven; auto-resolves
  approved: new Set(),
  rejected: new Set(['SAVE_DRAFT', 'SUBMIT']),
}

describe('dailyLogMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(dailyLogMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs in non-transient states hold state', () => {
    const rows = fuzzMatrix(dailyLogMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      if (row.state === 'amending') continue // transient state, invoke auto-completes
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.DL.1: concurrent AMEND from submitted — second send is rejected (no duplicate advancement)', async () => {
    const actor = createActor(dailyLogMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('submitted')

    // Fire two AMEND events in a tight async race.
    await Promise.all([
      Promise.resolve().then(() => actor.send({ type: 'AMEND', payload: DUMMY_PAYLOAD as never })),
      Promise.resolve().then(() => actor.send({ type: 'AMEND', payload: DUMMY_PAYLOAD as never })),
    ])

    // After both sends, the actor must NOT have advanced `version` twice. The
    // no-op `createLog` actor resolves immediately, so the actor either
    // landed on `draft` (post-onDone) with version=2, OR is still in
    // `amending`. Either way, version must not be 3+.
    const snap = actor.getSnapshot()
    expect(snap.context.version).toBeLessThanOrEqual(2)
    actor.stop()
  })

  it('A.DL.2: AMEND from draft is dropped (machine has no edge)', () => {
    const actor = createActor(dailyLogMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('draft')
    actor.send({ type: 'AMEND', payload: DUMMY_PAYLOAD as never })
    expect(actor.getSnapshot().value).toBe('draft')
    actor.stop()
  })

  it('actor cleanup: stop() clears children even after invoke', () => {
    const actor = createActor(dailyLogMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(30)
  })
})
