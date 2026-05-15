/**
 * FMEA A.SCHED.1 (wave 3) — Machine state vs computed/derived status.
 *
 * Hazard: The schedule DB CHECK constraint allows 6 statuses
 *         (completed, active, upcoming, at_risk, delayed, on_track).
 *         The xstate machine only models 4 (upcoming, active,
 *         delayed, completed). `deriveStatusFromProgress` is the
 *         compute layer that maps progress percentage → display
 *         status. If those two layers drift, the UI says one thing
 *         and the machine says another (and audit logs disagree).
 *
 * Wave 1 spec covered the machine fuzz. This wave-3 spec sharpens
 * the boundary check between `deriveStatusFromProgress` and the
 * machine's reachable states:
 *
 *   - At boundary inputs (0%, 1%, 50%, 99%, 100%) the derived value
 *     MUST be a status the machine recognises (i.e. it should NEVER
 *     return on_track or at_risk).
 *   - deriveStatusFromProgress(percent, machineState) must be
 *     idempotent: deriving the result a second time returns the same
 *     value (no drift loop in re-renders).
 *   - Negative or > 100 progress must not flip to an undefined
 *     status (boundary fuzz).
 */
import { describe, it, expect } from 'vitest'
import { deriveStatusFromProgress, scheduleMachine } from '../../src/machines/scheduleMachine'
import { createActor } from 'xstate'

// The machine's reachable states.
const MACHINE_STATES = ['upcoming', 'active', 'delayed', 'completed'] as const
type MachineState = (typeof MACHINE_STATES)[number]

describe('FMEA A.SCHED.1 — deriveStatusFromProgress contracts at boundaries', () => {
  it('returns "completed" when percent ≥ 100, regardless of current state', () => {
    for (const state of MACHINE_STATES) {
      expect(deriveStatusFromProgress(100, state)).toBe('completed')
      expect(deriveStatusFromProgress(150, state)).toBe('completed')
    }
  })

  it('does not invent on_track or at_risk at any progress boundary', () => {
    const boundaries = [-1, 0, 0.001, 1, 25, 49.9, 50, 50.1, 75, 99, 99.999, 100, 100.01, 200]
    for (const p of boundaries) {
      for (const state of MACHINE_STATES) {
        const derived = deriveStatusFromProgress(p, state)
        expect(MACHINE_STATES).toContain(derived)
      }
    }
  })

  it('is idempotent: derive(derive(p, s)) == derive(p, s)', () => {
    for (const p of [0, 1, 50, 99, 100]) {
      for (const state of MACHINE_STATES) {
        const once = deriveStatusFromProgress(p, state)
        const twice = deriveStatusFromProgress(p, once as MachineState)
        expect(twice).toBe(once)
      }
    }
  })

  it('upcoming + 0% stays upcoming (no premature transition)', () => {
    expect(deriveStatusFromProgress(0, 'upcoming')).toBe('upcoming')
  })

  it('upcoming + any progress > 0 (but < 100) flips to active', () => {
    expect(deriveStatusFromProgress(0.1, 'upcoming')).toBe('active')
    expect(deriveStatusFromProgress(50, 'upcoming')).toBe('active')
    expect(deriveStatusFromProgress(99.9, 'upcoming')).toBe('active')
  })

  it('delayed state preserves itself at non-zero progress (does not silently resume)', () => {
    // Hazard: a "delayed" job at 50% progress should require an explicit
    // RESUME event, NOT silently flip to active via the derived helper.
    expect(deriveStatusFromProgress(50, 'delayed')).toBe('delayed')
  })

  it('the machine never reaches at_risk or on_track via any event', () => {
    // Sanity contract for the on_track/at_risk DB-only statuses: the
    // machine simply does not model them. If a future event is added
    // targeting these states, this test fails and forces a derive-helper
    // update in lockstep.
    const actor = createActor(scheduleMachine)
    actor.start()
    const reached = new Set<string>()
    function record() {
      const v = actor.getSnapshot().value
      reached.add(typeof v === 'string' ? v : JSON.stringify(v))
    }
    record()
    for (const ev of [
      { type: 'START' as const },
      { type: 'MARK_DELAYED' as const },
      { type: 'RESUME' as const },
      { type: 'COMPLETE' as const },
      { type: 'REOPEN' as const, userId: 'u1' },
      { type: 'COMPLETE' as const },
    ]) {
      actor.send(ev)
      record()
    }
    actor.stop()
    expect(reached.has('on_track')).toBe(false)
    expect(reached.has('at_risk')).toBe(false)
  })
})
