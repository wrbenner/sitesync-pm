/**
 * FMEA A.SUB.2 — submittalMachine `triggerRevisionCreation` actor missing
 *
 * Hazard: the submittalMachine declares an action named
 *         `triggerRevisionCreation` with a NO-OP default body. Production
 *         is supposed to override it via:
 *
 *           submittalMachine.provide({
 *             actions: { triggerRevisionCreation: realImpl }
 *           })
 *
 *         If a caller forgets to provide the action, the machine still
 *         transitions (rejected → draft, revisionNumber++) but the
 *         side-effect — creating the submittal_revisions row + bumping the
 *         storage prefix — never fires. Silent prod fail: the UI shows
 *         "Revision 2 created" but the database has no v2.
 *
 * Test approach:
 *   - Spawn the bare machine (no .provide()). Drive to rejected.
 *   - Send RESUBMIT. Assert:
 *       a) state transitions to draft (no-op default is a callable),
 *       b) revisionNumber STILL increments (this is the silent-fail surface
 *          — the bookkeeping looks healthy without the side-effect),
 *       c) when a real spy IS provided, it fires exactly once per RESUBMIT.
 *   - Surface the no-op default as a KNOWN-VIOLATION ledger entry:
 *     production must guarantee every submittalMachine actor is provisioned
 *     via .provide({ actions: { triggerRevisionCreation } }) — there is no
 *     wrapper in src/ enforcing this. Recommend: a `createSubmittalActor()`
 *     factory in src/machines/submittalMachine.ts that fails fast.
 */
import { describe, it, expect, vi } from 'vitest'
import { createActor } from 'xstate'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { submittalMachine } from '../../src/machines/submittalMachine'

describe('FMEA A.SUB.2 — triggerRevisionCreation actor missing', () => {
  it('bare machine: RESUBMIT transitions + bumps revisionNumber (silent fail surface)', () => {
    const actor = createActor(submittalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_REJECT' })
    expect(actor.getSnapshot().value).toBe('rejected')

    const revBefore = actor.getSnapshot().context.revisionNumber
    actor.send({ type: 'RESUBMIT' })
    const revAfter = actor.getSnapshot().context.revisionNumber

    // The bookkeeping looks healthy — and that's the hazard. The action
    // was a no-op, so nothing actually got written.
    expect(actor.getSnapshot().value).toBe('draft')
    expect(revAfter).toBe(revBefore + 1)
    actor.stop()
  })

  it('provided machine: triggerRevisionCreation fires exactly once per RESUBMIT', () => {
    const spy = vi.fn()
    const provided = submittalMachine.provide({
      actions: { triggerRevisionCreation: spy },
    })
    const actor = createActor(provided)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_REJECT' })
    expect(spy).not.toHaveBeenCalled()

    actor.send({ type: 'RESUBMIT' })
    expect(spy).toHaveBeenCalledTimes(1)

    // Second cycle — make sure the action fires again, not just once.
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_REJECT' })
    actor.send({ type: 'RESUBMIT' })
    expect(spy).toHaveBeenCalledTimes(2)
    actor.stop()
  })

  it('multi-path: ARCHITECT_REVISE → resubmit → RESUBMIT also fires the action', () => {
    const spy = vi.fn()
    const provided = submittalMachine.provide({
      actions: { triggerRevisionCreation: spy },
    })
    const actor = createActor(provided)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_APPROVE' })
    actor.send({ type: 'ARCHITECT_REVISE' })
    expect(actor.getSnapshot().value).toBe('resubmit')

    actor.send({ type: 'RESUBMIT' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(actor.getSnapshot().value).toBe('draft')
    expect(actor.getSnapshot().context.revisionNumber).toBe(2)
    actor.stop()
  })

  it('KNOWN-VIOLATION: src/machines/submittalMachine.ts has NO-OP default for triggerRevisionCreation', () => {
    // Static probe: pin the no-op default and the absence of a fail-fast
    // factory. If a future patch adds `createSubmittalActor()` that
    // requires the action, flip this assertion in a follow-up wave.
    const src = readFileSync(
      resolve(__dirname, '..', '..', 'src', 'machines', 'submittalMachine.ts'),
      'utf-8',
    )

    // The no-op default exists.
    expect(
      /triggerRevisionCreation\s*:\s*\(\s*\)\s*=>\s*\{\s*\}/.test(src),
      'expected no-op default `triggerRevisionCreation: () => {}` to be present (it is the hazard)',
    ).toBe(true)

    // No `createSubmittalActor`-style factory is exported — meaning every
    // call site must manually .provide() the action. This is the gap.
    expect(
      /export function createSubmittalActor\b/.test(src),
      'KNOWN-VIOLATION: src/machines/submittalMachine.ts exports no fail-fast factory enforcing triggerRevisionCreation. Every call site must remember to .provide() — silent prod fail risk.',
    ).toBe(false)
  })

  it('contract: action receives the correct event payload on RESUBMIT', () => {
    // Pin the action signature — xstate v5 invokes with ({ context, event }).
    // If a future patch refactors the call, this fires.
    const sigs: Array<{ revisionBefore: number; eventType: string }> = []
    const spy = vi.fn((args: { context: { revisionNumber: number }; event: { type: string } }) => {
      sigs.push({
        revisionBefore: args.context.revisionNumber,
        eventType: args.event.type,
      })
    })
    const provided = submittalMachine.provide({
      actions: { triggerRevisionCreation: spy },
    })
    const actor = createActor(provided)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_REJECT' })
    actor.send({ type: 'RESUBMIT' })

    expect(sigs).toHaveLength(1)
    expect(sigs[0].eventType).toBe('RESUBMIT')
    expect(sigs[0].revisionBefore).toBeGreaterThanOrEqual(1)
    actor.stop()
  })
})
