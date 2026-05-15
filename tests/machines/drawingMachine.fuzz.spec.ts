/**
 * FMEA Section A — drawingMachine fuzz spec.
 *
 * Covers:
 *   - A.XSTATE.1: (state × event) matrix; no silent drops.
 *   - A.DRAW.1:   SUPERSEDE from `published` returns to `draft` (correct).
 *                 The failure mode is that the helper layer reuses the
 *                 same revision_number for the new drawing — caught by
 *                 the integration layer, but here we surface the machine
 *                 contract: SUPERSEDE is only legal from `published` and
 *                 always lands in `draft`.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { drawingMachine, getNextStatus } from '../../src/machines/drawingMachine'
import { fuzzMatrix, assertNoSilentDrops, type FuzzReachability } from './_fuzzHelpers'

const STATES = ['draft', 'under_review', 'approved', 'rejected', 'published', 'archived'] as const

const EVENTS = [
  'SUBMIT_FOR_REVIEW',
  'APPROVE',
  'REJECT',
  'PUBLISH',
  'REVISE',
  'SUPERSEDE',
  'ARCHIVE',
  // adversarial
  'BOGUS',
] as const

const REACHABILITY: FuzzReachability = {
  states: [...STATES],
  eventNames: [...EVENTS],
  path: {
    draft: [],
    under_review: [{ type: 'SUBMIT_FOR_REVIEW' }],
    approved: [{ type: 'SUBMIT_FOR_REVIEW' }, { type: 'APPROVE', userId: 'u1' }],
    rejected: [{ type: 'SUBMIT_FOR_REVIEW' }, { type: 'REJECT', userId: 'u1', reason: 'r' }],
    published: [
      { type: 'SUBMIT_FOR_REVIEW' },
      { type: 'APPROVE', userId: 'u1' },
      { type: 'PUBLISH', userId: 'u1' },
    ],
    archived: [{ type: 'ARCHIVE', userId: 'u1', reason: 'r' }],
  },
}

const PAYLOADS: Record<string, Record<string, unknown>> = {
  APPROVE: { userId: 'u1' },
  REJECT: { userId: 'u1', reason: 'r' },
  PUBLISH: { userId: 'u1' },
  REVISE: { userId: 'u1' },
  SUPERSEDE: { userId: 'u1' },
  ARCHIVE: { userId: 'u1', reason: 'r' },
}

const ACCEPTED: Record<string, Set<string>> = {
  draft: new Set(['SUBMIT_FOR_REVIEW', 'ARCHIVE']),
  under_review: new Set(['APPROVE', 'REJECT', 'ARCHIVE']),
  approved: new Set(['PUBLISH', 'REVISE', 'ARCHIVE']),
  rejected: new Set(['REVISE', 'ARCHIVE']),
  published: new Set(['SUPERSEDE', 'ARCHIVE']),
  archived: new Set(),
}

describe('drawingMachine — FMEA fuzz', () => {
  it('A.XSTATE.1: every (state × event) lands in a defined state', () => {
    const rows = fuzzMatrix(drawingMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    assertNoSilentDrops(rows, [...STATES])
  })

  it('A.XSTATE.1: off-graph pairs hold state', () => {
    const rows = fuzzMatrix(drawingMachine, REACHABILITY, (e) => PAYLOADS[e] ?? {})
    for (const row of rows) {
      if (!row.reached) continue
      const isInGraph = ACCEPTED[row.state]?.has(row.event)
      if (!isInGraph) {
        expect(row.after, `event ${row.event} from ${row.state}`).toBe(row.before)
      }
    }
  })

  it('A.DRAW.1: SUPERSEDE from published returns to draft (revision lifecycle reboot)', () => {
    const actor = createActor(drawingMachine)
    actor.start()
    actor.send({ type: 'SUBMIT_FOR_REVIEW' })
    actor.send({ type: 'APPROVE', userId: 'u1' })
    actor.send({ type: 'PUBLISH', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('published')
    actor.send({ type: 'SUPERSEDE', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('draft')
    actor.stop()
  })

  it('A.DRAW.1: SUPERSEDE from non-published is dropped (no shortcut to draft)', () => {
    for (const state of ['draft', 'under_review', 'approved', 'rejected'] as const) {
      const actor = createActor(drawingMachine)
      actor.start()
      for (const e of REACHABILITY.path[state] ?? []) actor.send(e)
      const before = actor.getSnapshot().value
      actor.send({ type: 'SUPERSEDE', userId: 'u1' })
      expect(actor.getSnapshot().value, `SUPERSEDE from ${state}`).toBe(before)
      actor.stop()
    }
  })

  it('A.DRAW.1: helper getNextStatus mirrors machine for published+Supersede', () => {
    expect(getNextStatus('published', 'Supersede')).toBe('draft')
    // Helper exposes Supersede only from published — never from other states
    for (const s of ['draft', 'under_review', 'approved', 'rejected'] as const) {
      expect(getNextStatus(s, 'Supersede')).toBeNull()
    }
  })

  it('actor cleanup: stop() clears children', () => {
    const actor = createActor(drawingMachine)
    actor.start()
    actor.send({ type: 'SUBMIT_FOR_REVIEW' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('matrix size signal', () => {
    expect(STATES.length * EVENTS.length).toBe(48)
  })
})
