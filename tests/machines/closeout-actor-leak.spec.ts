/**
 * FMEA A.CLOSE.1 (Wave 4) — Closeout machine actor leak after final state
 *
 * Hazard: a long-running closeout management UI mounts dozens (one per
 *         closeout item) of `closeoutItemMachine` actors. When an item
 *         hits the terminal `approved` state, the actor is *done* but
 *         the host React tree often holds a reference for status display.
 *         If the actor is never explicitly stopped, every approval
 *         leaks one xstate Actor — observable as
 *           - actor.getSnapshot().status === 'done' but children remain
 *           - the actor still receives events (even if it ignores them)
 *           - subscriptions linger
 *
 *         On a 50-line closeout, after a punch-out QA pass that
 *         touches every item, that's 50 leaked actors per project.
 *
 * Wave-3 (existing `closeoutMachine.fuzz.spec.ts`) already pins the
 * REJECT/RESUBMIT loop. This Wave-4 spec pins the *cleanup* contract:
 * a terminated actor must release its children, must report `done`
 * status, and stop() must be safe to call after natural termination.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { closeoutItemMachine } from '../../src/machines/closeoutMachine'

function drive(actor: ReturnType<typeof createActor<typeof closeoutItemMachine>>, evts: { type: string; [k: string]: unknown }[]): void {
  for (const e of evts) actor.send(e as never)
}

describe('FMEA A.CLOSE.1 — actor cleanup after terminal state', () => {
  it('reaching `approved` (final) reports status="done" and empty children', () => {
    const actor = createActor(closeoutItemMachine)
    actor.start()
    drive(actor, [
      { type: 'REQUEST', contactId: 'c1' },
      { type: 'SUBMIT', documentIds: ['d1'] },
      { type: 'START_REVIEW' },
      { type: 'APPROVE', reviewerId: 'r1' },
    ])
    const snap = actor.getSnapshot()
    expect(snap.value).toBe('approved')
    expect(snap.status).toBe('done')
    expect(snap.children).toEqual({})
    actor.stop()
  })

  it('stop() on an already-done actor is a no-op (no throw, idempotent)', () => {
    const actor = createActor(closeoutItemMachine)
    actor.start()
    drive(actor, [
      { type: 'REQUEST', contactId: 'c1' },
      { type: 'SUBMIT', documentIds: ['d1'] },
      { type: 'APPROVE', reviewerId: 'r1' },
    ])
    expect(actor.getSnapshot().status).toBe('done')
    // Second stop should not throw — the host React tree may unmount
    // after natural completion, so stop() is called on a done actor.
    expect(() => {
      actor.stop()
      actor.stop()
    }).not.toThrow()
  })

  it('events sent AFTER terminal state do not silently mutate the actor', () => {
    const actor = createActor(closeoutItemMachine)
    actor.start()
    drive(actor, [
      { type: 'REQUEST', contactId: 'c1' },
      { type: 'SUBMIT', documentIds: ['d1'] },
      { type: 'APPROVE', reviewerId: 'r1' },
    ])
    expect(actor.getSnapshot().value).toBe('approved')

    // Try every event from the type union. None should perturb the
    // terminal state — but the actor must not crash either. A silent
    // crash here would leak the listener subscription in the host.
    const adversarial = [
      { type: 'REQUEST', contactId: 'cX' },
      { type: 'SUBMIT', documentIds: ['dX'] },
      { type: 'START_REVIEW' },
      { type: 'APPROVE', reviewerId: 'rX' },
      { type: 'REJECT', comments: 'no', reviewerId: 'rX' },
      { type: 'RESUBMIT', documentIds: ['dX'] },
    ]
    for (const e of adversarial) {
      expect(() => actor.send(e as never)).not.toThrow()
      expect(actor.getSnapshot().value).toBe('approved')
    }
    actor.stop()
  })

  it('subscription cleanup: unsubscribe after done() does not crash and stops receiving updates', () => {
    const actor = createActor(closeoutItemMachine)
    let received = 0
    const sub = actor.subscribe(() => {
      received += 1
    })
    actor.start()
    drive(actor, [
      { type: 'REQUEST', contactId: 'c1' },
      { type: 'SUBMIT', documentIds: ['d1'] },
      { type: 'APPROVE', reviewerId: 'r1' },
    ])
    const countAfterDone = received
    // Unsubscribe + stop, then send another (no-op) event. Count must
    // not advance — this is the leak surface: stale subscribers firing
    // on a done actor.
    sub.unsubscribe()
    actor.stop()
    expect(() => actor.send({ type: 'RESUBMIT', documentIds: ['dY'] } as never)).not.toThrow()
    expect(received).toBe(countAfterDone)
  })

  it('100 sequential actors driven to `approved` all clean up — no shared state leak', () => {
    // The host UI mounts one actor per closeout item. Spin 100 in
    // sequence and confirm every one terminates clean. A leak would
    // manifest as accumulating children or status drifting off 'done'.
    for (let i = 0; i < 100; i++) {
      const actor = createActor(closeoutItemMachine)
      actor.start()
      drive(actor, [
        { type: 'REQUEST', contactId: `c${i}` },
        { type: 'SUBMIT', documentIds: [`d${i}`] },
        { type: 'START_REVIEW' },
        { type: 'APPROVE', reviewerId: `r${i}` },
      ])
      const snap = actor.getSnapshot()
      expect(snap.value).toBe('approved')
      expect(snap.status).toBe('done')
      expect(Object.keys(snap.children).length).toBe(0)
      actor.stop()
    }
  })
})
