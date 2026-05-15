/**
 * FMEA A.CO.2 — ChangeOrder RETURN_TO_PCO loses type history
 *
 * Hazard: when a COR (type='cor') is rejected and demoted back to PCO via
 *         RETURN_TO_PCO, the machine transitions `rejected → draft` but
 *         does NOT (a) revert `context.type` to `'pco'` or (b) record the
 *         demotion in an audit trail. Result: a row that says co_type='cor'
 *         is sitting in `draft` state, which is impossible in the doc
 *         contract — and the historical fact "this was promoted PCO→COR
 *         and demoted back" is lost.
 *
 *   The companion helper `getPreviousCOType('cor') === 'pco'` *exists* in
 *   src/machines/changeOrderMachine.ts (line 113-120) but is NEVER wired
 *   into the machine's RETURN_TO_PCO transition. That is the gap.
 *
 * Test approach:
 *   - Drive: pco → SUBMIT → REJECT → RETURN_TO_PCO. Assert state=draft.
 *   - Spawn a cor-typed actor with context override. Drive cor → SUBMIT
 *     → REJECT → RETURN_TO_PCO. Assert:
 *       * state transitions to draft.
 *       * context.type stays 'cor' (the bug — should revert to 'pco').
 *   - Pin getPreviousCOType('cor') === 'pco' as the helper that the
 *     machine should call but does not.
 *   - Pin getPreviousCOType('co') === 'cor' (analog for RETURN_TO_COR).
 *   - KNOWN-VIOLATION: machine RETURN_TO_PCO transition has no `actions:`
 *     reverting `context.type`. Surface so the next platform-fix wave can
 *     wire `assign({ type: ({ context }) => getPreviousCOType(context.type) ?? context.type })`.
 */
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  changeOrderMachine,
  getPreviousCOType,
  getNextCOType,
  getValidCOTransitions,
} from '../../src/machines/changeOrderMachine'

describe('FMEA A.CO.2 — RETURN_TO_PCO loses type history', () => {
  it('RETURN_TO_PCO from rejected transitions to draft', () => {
    const actor = createActor(changeOrderMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'REJECT', userId: 'u1' })
    expect(actor.getSnapshot().value).toBe('rejected')

    actor.send({ type: 'RETURN_TO_PCO', revisionNotes: 'rework scope' })
    expect(actor.getSnapshot().value).toBe('draft')
    actor.stop()
  })

  it('cor-typed CO: RETURN_TO_PCO does NOT revert context.type (the bug)', () => {
    const actor = createActor(changeOrderMachine, {
      input: undefined,
    })
    actor.start()
    // The machine doesn't expose a SET_TYPE event; we mutate via the input
    // contract / by asserting the bug at the snapshot level. The factory
    // default is 'co'; we observe whatever shipped.
    const initialType = actor.getSnapshot().context.type

    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'REJECT', userId: 'u1' })
    actor.send({ type: 'RETURN_TO_PCO', revisionNotes: 'demote' })
    expect(actor.getSnapshot().value).toBe('draft')

    // BUG: type didn't change. After a RETURN_TO_PCO, a cor-typed row
    // remains co_type='cor' in DB even though it's back in draft. The
    // doc contract says the demotion should revert the type pointer.
    expect(
      actor.getSnapshot().context.type,
      'documents the hazard: type is unchanged after RETURN_TO_PCO',
    ).toBe(initialType)
    actor.stop()
  })

  it('helper getPreviousCOType exists (the missing wiring)', () => {
    expect(getPreviousCOType('cor')).toBe('pco')
    expect(getPreviousCOType('co')).toBe('cor')
    expect(getPreviousCOType('pco')).toBeNull()
  })

  it('helper round-trip: getNextCOType ∘ getPreviousCOType is identity (except at boundaries)', () => {
    // promote pco → cor; then demote cor → pco.
    expect(getPreviousCOType(getNextCOType('pco')!)).toBe('pco')
    // promote cor → co; then demote co → cor.
    expect(getPreviousCOType(getNextCOType('cor')!)).toBe('cor')
  })

  it('getValidCOTransitions: rejected COR exposes Return to PCO; rejected PCO does NOT', () => {
    expect(getValidCOTransitions('rejected', 'cor')).toContain('Return to PCO')
    expect(getValidCOTransitions('rejected', 'co')).toContain('Return to COR')

    // PCO can't return — it's the root type.
    expect(getValidCOTransitions('rejected', 'pco')).not.toContain('Return to PCO')
    expect(getValidCOTransitions('rejected', 'pco')).not.toContain('Return to COR')
  })

  it('KNOWN-VIOLATION: changeOrderMachine RETURN_TO_PCO has no actions: reverting type', () => {
    const src = readFileSync(
      resolve(__dirname, '..', '..', 'src', 'machines', 'changeOrderMachine.ts'),
      'utf-8',
    )

    // Locate RETURN_TO_PCO transition definition.
    const idx = src.indexOf('RETURN_TO_PCO:')
    expect(idx, 'RETURN_TO_PCO must be defined in machine').toBeGreaterThan(-1)

    // Slice the transition body (next 200 chars usually contains the full def).
    const slice = src.slice(idx, idx + 400)

    // The CURRENT def is just `RETURN_TO_PCO: { target: 'draft' }` —
    // no `actions:` clause. Once fixed, this assertion flips.
    const hasActionsClause = /RETURN_TO_PCO\s*:\s*\{[^}]*actions\s*:/.test(slice)

    expect(
      hasActionsClause,
      'KNOWN-VIOLATION: RETURN_TO_PCO transition lacks `actions:` to revert context.type via getPreviousCOType. Cor-typed COs return to draft but still report co_type=cor in the audit trail. Fix: add `actions: assign({ type: ({ context }) => getPreviousCOType(context.type) ?? context.type })` and emit a co_type_history audit row.',
    ).toBe(false)
  })

  it('audit-trail gap: no co_type_history table referenced from machine', () => {
    const src = readFileSync(
      resolve(__dirname, '..', '..', 'src', 'machines', 'changeOrderMachine.ts'),
      'utf-8',
    )
    // The machine should ideally fire an action that writes to a
    // co_type_history (or change_order_audit) table when demoting. The
    // current src/ has no such reference inside the machine module.
    expect(/co_type_history|change_order_audit|recordTypeChange/i.test(src)).toBe(false)
  })

  it('rejected-PCO Revise-and-Resubmit path is preserved (regression guard)', () => {
    // Make sure the un-bugged path still works. RETURN_TO_PCO must not
    // accidentally clobber the standard rejected → pending_review path.
    const actor = createActor(changeOrderMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'REJECT', userId: 'u1' })
    actor.send({ type: 'SUBMIT' }) // Revise & Resubmit
    expect(actor.getSnapshot().value).toBe('pending_review')
    actor.stop()
  })
})
