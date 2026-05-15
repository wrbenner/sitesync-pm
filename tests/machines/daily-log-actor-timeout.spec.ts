/**
 * FMEA A.DL.2 — dailyLogMachine `createLog` actor has no timeout
 *
 * Hazard: the `amending` state invokes the `createLog` actor (a fromPromise).
 *         There is NO timeout / bounded-wait wrapper. If the actor never
 *         resolves (network hang, lost-update on the createDailyLog mutation,
 *         worker stuck), the machine sits in `amending` forever and the user
 *         sees a spinner with no escape — and no audit-log entry records the
 *         failure.
 *
 * Test approach:
 *   1. Provide a `createLog` actor that returns a promise which NEVER
 *      resolves. Drive the machine to `amending`. Advance the test clock
 *      and assert the machine is STILL in `amending` (no auto-recovery).
 *      → This pins the current behaviour AND surfaces it as a hazard.
 *   2. Provide a `createLog` actor that rejects. Confirm the documented
 *      error-handling path fires (onError → submitted).
 *   3. KNOWN-VIOLATION: assert the machine source contains no `after:`
 *      timeout configuration on the `amending` state. If a future patch
 *      adds e.g. `after: { 30000: { target: 'submitted' } }`, this test
 *      flips and the entry can move to VALIDATED.
 */
import { describe, it, expect, vi } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dailyLogMachine } from '../../src/machines/dailyLogMachine'

describe('FMEA A.DL.2 — createLog actor timeout missing', () => {
  it('never-resolving createLog leaves machine stuck in amending (hazard pinned)', async () => {
    vi.useFakeTimers()
    const neverResolves = fromPromise(() => new Promise(() => {}))
    const provided = dailyLogMachine.provide({
      actors: {
        createLog: neverResolves,
        // submitLog isn't invoked in this path, but xstate's typing wants a
        // value if we override actors. Re-use the same hang promise; it
        // won't be called.
        submitLog: neverResolves,
      },
    })

    const actor = createActor(provided, {
      input: undefined,
    })
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({
      type: 'AMEND',
      payload: { log_date: '2026-05-15', summary: 'hang test' },
    })

    // Should be in amending (invoke fired).
    expect(actor.getSnapshot().value).toBe('amending')

    // Fast-forward 5 minutes. Machine has no `after:` → still stuck.
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(
      actor.getSnapshot().value,
      'no timeout configured → machine sits in amending forever',
    ).toBe('amending')

    // Fast-forward another hour. Still stuck. This IS the bug.
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(actor.getSnapshot().value).toBe('amending')

    actor.stop()
    vi.useRealTimers()
  })

  it('createLog reject path: machine recovers to submitted via onError', async () => {
    const failing = fromPromise(() =>
      Promise.reject(new Error('staging-network-error')),
    )
    const provided = dailyLogMachine.provide({
      actors: {
        createLog: failing,
        submitLog: failing,
      },
    })
    const actor = createActor(provided)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({
      type: 'AMEND',
      payload: { log_date: '2026-05-15' },
    })

    // Wait a tick for the rejected promise to be drained by the actor.
    await new Promise((r) => setTimeout(r, 25))

    expect(actor.getSnapshot().value).toBe('submitted')
    // error context is populated.
    expect(actor.getSnapshot().context.error).toMatch(/network/i)
    actor.stop()
  })

  it('createLog resolve path: machine moves amending → draft + version++', async () => {
    const ok = fromPromise(() => Promise.resolve({ id: 'new-row-id' }))
    const provided = dailyLogMachine.provide({
      actors: { createLog: ok, submitLog: ok },
    })
    const actor = createActor(provided)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    const beforeVersion = actor.getSnapshot().context.version
    actor.send({
      type: 'AMEND',
      payload: { log_date: '2026-05-15' },
    })

    // Drain microtask queue.
    await new Promise((r) => setTimeout(r, 25))

    expect(actor.getSnapshot().value).toBe('draft')
    expect(actor.getSnapshot().context.version).toBe(beforeVersion + 1)
    actor.stop()
  })

  it('KNOWN-VIOLATION: dailyLogMachine.ts has no `after:` timeout on amending', () => {
    const src = readFileSync(
      resolve(__dirname, '..', '..', 'src', 'machines', 'dailyLogMachine.ts'),
      'utf-8',
    )

    // Extract the amending state block.
    const start = src.indexOf('amending: {')
    expect(start, 'expected amending state in source').toBeGreaterThan(-1)
    const slice = src.slice(start, start + 800)

    // The current implementation has only invoke { src, input, onDone, onError }.
    // A bounded-wait would surface as `after: { N: ... }` or `after: \n N:`.
    const hasAfter = /\bafter\s*:/.test(slice)

    expect(
      hasAfter,
      'KNOWN-VIOLATION: src/machines/dailyLogMachine.ts `amending` state has no `after:` timeout. A hung createLog actor leaves the user stuck in a spinner with no recovery. Fix: add `after: { 30000: { target: "submitted", actions: assign({ error: () => "amend_timeout" }) } }`.',
    ).toBe(false)
  })

  it('amending → onDone resets is_submitted + submitted_at (no stale signature)', async () => {
    const ok = fromPromise(() => Promise.resolve({ id: 'new' }))
    const provided = dailyLogMachine.provide({
      actors: { createLog: ok, submitLog: ok },
    })
    const actor = createActor(provided)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().context.is_submitted).toBe(true)
    actor.send({
      type: 'AMEND',
      payload: { log_date: '2026-05-15' },
    })
    await new Promise((r) => setTimeout(r, 25))
    // After fork, the new row is a fresh draft — submitted state must clear.
    expect(actor.getSnapshot().context.is_submitted).toBe(false)
    expect(actor.getSnapshot().context.submitted_at).toBeNull()
    actor.stop()
  })
})
