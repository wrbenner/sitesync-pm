/**
 * FMEA A.RFI.2 — RFI REOPEN from terminal state (closed AND void)
 *
 * Hazard: an RFI in a "terminal-feeling" state (closed or void) receives a
 *         REOPEN event. The doc-level contract from `getValidTransitions`
 *         exposes "Reopen" for closed only — void is a true final state and
 *         the machine must NOT accept REOPEN there.
 *
 * Wave-1 fuzz already pinned REOPEN-from-void as a no-op. Wave-5 broadens
 * the probe:
 *   - REOPEN from `closed` MUST transition back to `open` (per machine def
 *     line 92-95: `closed: { on: { REOPEN: { target: 'open' } } }`).
 *   - REOPEN from `void` MUST hold (void is `type: 'final'` → no events).
 *   - REOPEN from `void` MUST NOT raise a runtime error (silent drop is
 *     the *correct* behaviour for a final state per XState v5).
 *   - The doc layer (`getValidTransitions`) must NOT advertise "Reopen"
 *     for void — only for closed/answered.
 *
 * If `getValidTransitions('void', role)` ever returns "Reopen", a UI button
 * would appear but clicking it would silently drop the event — the canonical
 * "advertised-but-broken" footgun.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { rfiMachine, getValidTransitions } from '../../src/machines/rfiMachine'

describe('FMEA A.RFI.2 — RFI REOPEN from terminal states', () => {
  it('REOPEN from closed transitions to open (valid path)', () => {
    const actor = createActor(rfiMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'CLOSE', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('closed')

    actor.send({ type: 'REOPEN', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('open')
    actor.stop()
  })

  it('REOPEN from void holds in void (final state, silent drop is correct)', () => {
    const actor = createActor(rfiMachine)
    actor.start()
    actor.send({ type: 'VOID', userId: 'u1', reason: 'duplicate' })
    expect(actor.getSnapshot().value).toBe('void')
    expect(actor.getSnapshot().status).toBe('done') // final = done

    // Sending REOPEN to a final actor is a no-op (xstate v5 swallows it).
    let threw = false
    try {
      actor.send({ type: 'REOPEN', userId: 'u1' })
    } catch {
      threw = true
    }
    expect(threw, 'REOPEN on void must not throw').toBe(false)
    expect(actor.getSnapshot().value).toBe('void')
    actor.stop()
  })

  it('REOPEN from closed re-allows the full open lifecycle (no state-fork)', () => {
    const actor = createActor(rfiMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'CLOSE', userId: 'u1' })
    actor.send({ type: 'REOPEN', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('open')

    // After REOPEN, the actor must accept the canonical "from-open"
    // transition (ASSIGN → under_review). A bug where REOPEN moved to
    // some bespoke fork state would fail here.
    actor.send({ type: 'ASSIGN', assigneeId: 'u2' })
    expect(actor.getSnapshot().value).toBe('under_review')
    actor.stop()
  })

  it('getValidTransitions advertises Reopen for closed but NOT for void', () => {
    // closed should expose "Reopen" for at least admin role
    expect(getValidTransitions('closed', 'admin')).toContain('Reopen')
    expect(getValidTransitions('closed', 'owner')).toContain('Reopen')

    // void is final — Reopen must NEVER appear, for any role.
    for (const role of ['admin', 'owner', 'project_manager', 'viewer']) {
      expect(
        getValidTransitions('void', role),
        `void must not advertise Reopen for role=${role}`,
      ).not.toContain('Reopen')
    }
  })

  it('void is the only true terminal state (closed is reopenable)', () => {
    // Round-trip stress: open → close → reopen → close → reopen.
    const actor = createActor(rfiMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    for (let i = 0; i < 3; i++) {
      actor.send({ type: 'CLOSE', userId: 'u1' })
      expect(actor.getSnapshot().value).toBe('closed')
      actor.send({ type: 'REOPEN', userId: 'u1' })
      expect(actor.getSnapshot().value).toBe('open')
    }
    actor.stop()
  })

  it('REOPEN from non-terminal/non-closed states is silently dropped (not closed)', () => {
    // From draft, REOPEN is off-graph; the actor must hold in draft.
    const actor = createActor(rfiMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('draft')
    actor.send({ type: 'REOPEN', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('draft')
    actor.stop()
  })
})
