/**
 * FMEA A.INSP.1 (Wave 4) — Inspection RESCHEDULE reuses same inspection_id
 *
 * Hazard: when an inspection is rejected and then RESCHEDULEd, the row
 *         persists under the same inspection_id. Any FK that points to
 *         `safety_inspections.id` (e.g. `inspection_items.inspection_id`)
 *         either:
 *           (a) keeps the OLD child items attached to a row whose history
 *               was reset back to 'scheduled' — a silent data carry-over
 *               that masks the prior failed inspection, OR
 *           (b) the migration uses ON DELETE CASCADE and the child rows
 *               are wiped on a recycle the user did not intend.
 *
 *         The state-machine layer is supposed to either MINT a new
 *         inspection_id on RESCHEDULE or block the transition until the
 *         child items have been explicitly resolved.
 *
 * Wave-1 already covers the inspection score config + the (state, event)
 * matrix in tests/machines/inspectionMachine.fuzz.spec.ts. Wave-4 (this
 * file) probes the reschedule lifecycle specifically — the identity of
 * the actor + the FK shape — and pins the contract.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { inspectionMachine } from '../../src/machines/inspectionMachine'

describe('FMEA A.INSP.1 — RESCHEDULE inspection_id contract', () => {
  it('RESCHEDULE from rejected returns to scheduled (machine lifecycle)', () => {
    const actor = createActor(inspectionMachine, {
      input: { inspectionId: 'insp-1', projectId: 'proj-1', error: null },
    })
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'COMPLETE', score: 40 })
    actor.send({ type: 'REJECT', userId: 'u1', reason: 'fail' })
    expect(actor.getSnapshot().value).toBe('rejected')

    const beforeId = actor.getSnapshot().context.inspectionId
    actor.send({ type: 'RESCHEDULE', userId: 'u1' })

    // Lifecycle contract: returns to scheduled.
    expect(actor.getSnapshot().value).toBe('scheduled')

    // ID contract: machine does NOT silently mint a new inspection_id —
    // it carries the same id forward. This is the hazard surface: the
    // service layer is responsible for either
    //   (a) explicitly opening a fresh row with a new uuid, OR
    //   (b) cascade-cleaning child rows.
    // We pin the machine's behavior so the service layer is forced to
    // handle FK identity, not the actor.
    const afterId = actor.getSnapshot().context.inspectionId
    expect(afterId).toBe(beforeId)

    actor.stop()
  })

  it('RESCHEDULE is only legal from rejected (not from scheduled/in_progress/completed/approved)', () => {
    // KNOWN-VIOLATION ledger entry: if RESCHEDULE accidentally became
    // legal from approved or completed, the FK-collision hazard is
    // amplified — a *signed-off* inspection would silently be reopened
    // under the same id, invalidating the signed signature chain.
    const start = (events: { type: string; [k: string]: unknown }[]) => {
      const a = createActor(inspectionMachine)
      a.start()
      for (const e of events) a.send(e as never)
      return a
    }
    const cases: Array<{ name: string; events: { type: string; [k: string]: unknown }[]; expectAcceptReschedule: boolean }> = [
      { name: 'scheduled', events: [], expectAcceptReschedule: false },
      { name: 'in_progress', events: [{ type: 'START' }], expectAcceptReschedule: false },
      { name: 'completed', events: [{ type: 'START' }, { type: 'COMPLETE', score: 85 }], expectAcceptReschedule: false },
      {
        name: 'approved',
        events: [
          { type: 'START' },
          { type: 'COMPLETE', score: 95 },
          { type: 'APPROVE', userId: 'u1' },
        ],
        expectAcceptReschedule: false,
      },
      {
        name: 'rejected',
        events: [
          { type: 'START' },
          { type: 'COMPLETE', score: 50 },
          { type: 'REJECT', userId: 'u1', reason: 'failed' },
        ],
        expectAcceptReschedule: true,
      },
    ]
    for (const c of cases) {
      const actor = start(c.events)
      const before = actor.getSnapshot().value
      actor.send({ type: 'RESCHEDULE', userId: 'u1' })
      const after = actor.getSnapshot().value
      if (c.expectAcceptReschedule) {
        expect(after, `RESCHEDULE from ${c.name}`).toBe('scheduled')
      } else {
        expect(after, `RESCHEDULE from ${c.name} should be a no-op`).toBe(before)
      }
      actor.stop()
    }
  })

  it('actor lifecycle: stop() after RESCHEDULE clears children (no zombie actor)', () => {
    const actor = createActor(inspectionMachine)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'COMPLETE', score: 30 })
    actor.send({ type: 'REJECT', userId: 'u1', reason: 'fail' })
    actor.send({ type: 'RESCHEDULE', userId: 'u1' })
    actor.stop()
    expect(actor.getSnapshot().children).toEqual({})
  })

  it('fuzz: repeated REJECT/RESCHEDULE cycles never wander off the (rejected, scheduled) loop', () => {
    // A subtle hazard would be a path where RESCHEDULE→START→COMPLETE
    // → REJECT → RESCHEDULE silently lands in a different state. Run
    // 25 cycles to exhaust any one-off race.
    const actor = createActor(inspectionMachine)
    actor.start()
    for (let i = 0; i < 25; i++) {
      actor.send({ type: 'START' })
      actor.send({ type: 'COMPLETE', score: 10 })
      actor.send({ type: 'REJECT', userId: 'u1', reason: `iter-${i}` })
      expect(actor.getSnapshot().value).toBe('rejected')
      actor.send({ type: 'RESCHEDULE', userId: 'u1' })
      expect(actor.getSnapshot().value).toBe('scheduled')
    }
    actor.stop()
  })
})
