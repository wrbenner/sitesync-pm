// ────────────────────────────────────────────────────────────────────────────
// autoExecute eligibility tests
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md

import { describe, expect, it } from 'vitest'

import { decideAutoExecute } from '../autoExecute'
import { RFI_ROUTING_DECL } from '../executors/rfi-routing'
import { PUNCH_ASSIGNMENT_DECL } from '../executors/punch-assignment'

describe('decideAutoExecute — ADR-019 + executor floor interaction', () => {
  it('returns live mode when org opt-in TRUE + confidence clears both floors', () => {
    const decision = decideAutoExecute({
      org_auto_execute_opt_in: true,
      persona: 'pm',
      executor: RFI_ROUTING_DECL,
      confidence: 0.95,
    })
    expect(decision.mode).toBe('live')
    if (decision.mode === 'live') {
      expect(decision.cancel_window_ms).toBe(60_000)
    }
  })

  it('returns shadow when org opt-in is FALSE', () => {
    const decision = decideAutoExecute({
      org_auto_execute_opt_in: false,
      persona: 'pm',
      executor: RFI_ROUTING_DECL,
      confidence: 0.95,
    })
    expect(decision.mode).toBe('shadow')
    if (decision.mode === 'shadow') {
      expect(decision.reasons.some((r) => r.includes('opt_in is FALSE'))).toBe(true)
    }
  })

  it('returns shadow for owner_rep (never-auto)', () => {
    const decision = decideAutoExecute({
      org_auto_execute_opt_in: true,
      persona: 'owner_rep',
      executor: RFI_ROUTING_DECL,
      confidence: 1.0,
    })
    expect(decision.mode).toBe('shadow')
    if (decision.mode === 'shadow') {
      expect(decision.reasons.some((r) => r.includes('never-auto'))).toBe(true)
    }
  })

  it('returns shadow when confidence is below persona threshold', () => {
    const decision = decideAutoExecute({
      org_auto_execute_opt_in: true,
      persona: 'pm', // threshold 0.85
      executor: RFI_ROUTING_DECL, // floor 0.92
      confidence: 0.8,
    })
    expect(decision.mode).toBe('shadow')
  })

  it('returns shadow when confidence is below executor floor (even if persona ok)', () => {
    const decision = decideAutoExecute({
      org_auto_execute_opt_in: true,
      persona: 'pm', // threshold 0.85
      executor: RFI_ROUTING_DECL, // floor 0.92
      confidence: 0.88,
    })
    expect(decision.mode).toBe('shadow')
    if (decision.mode === 'shadow') {
      expect(decision.reasons.some((r) => r.includes('executor floor'))).toBe(true)
    }
  })

  it('foreman threshold (0.9) gates correctly', () => {
    const live = decideAutoExecute({
      org_auto_execute_opt_in: true,
      persona: 'foreman',
      executor: PUNCH_ASSIGNMENT_DECL, // floor 0.9
      confidence: 0.95,
    })
    expect(live.mode).toBe('live')

    const shadow = decideAutoExecute({
      org_auto_execute_opt_in: true,
      persona: 'foreman',
      executor: PUNCH_ASSIGNMENT_DECL,
      confidence: 0.88,
    })
    expect(shadow.mode).toBe('shadow')
  })

  it('reports multiple reasons when multiple gates fail', () => {
    const decision = decideAutoExecute({
      org_auto_execute_opt_in: false,
      persona: 'owner_rep',
      executor: RFI_ROUTING_DECL,
      confidence: 0.1,
    })
    expect(decision.mode).toBe('shadow')
    if (decision.mode === 'shadow') {
      expect(decision.reasons.length).toBeGreaterThanOrEqual(3)
    }
  })
})
