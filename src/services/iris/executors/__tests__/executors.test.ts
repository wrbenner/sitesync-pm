// ────────────────────────────────────────────────────────────────────────────
// Hardened-executor predicate tests — Phase 2e
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/HARDENED_EXECUTORS_SPEC_2026-05-04.md
//       docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md
//
// Every executor predicate has positive + negative cases per the spec
// "predicate is unit-tested (positive + negative + edge cases)" requirement.

import { describe, expect, it } from 'vitest'

import {
  DAILY_LOG_COMPILATION_DECL,
  dailyLogCompilationPredicate,
} from '../daily-log-compilation'
import { PUNCH_ASSIGNMENT_DECL, punchAssignmentPredicate } from '../punch-assignment'
import { RFI_ROUTING_DECL, rfiRoutingPredicate } from '../rfi-routing'

describe('rfi-routing executor', () => {
  it('declares confidence_floor 0.92 (cancel-window default)', () => {
    expect(RFI_ROUTING_DECL.confidence_floor).toBe(0.92)
  })

  it('declares additive blast_radius', () => {
    expect(RFI_ROUTING_DECL.blast_radius).toBe('additive')
  })

  it('predicate passes a healthy input', () => {
    expect(
      rfiRoutingPredicate({
        rfi_id: 'rfi-1',
        assignee_user_id: 'user-1',
        confidence: 0.95,
      }),
    ).toEqual({ ok: true, reasons: [] })
  })

  it('predicate blocks on missing rfi_id', () => {
    const r = rfiRoutingPredicate({
      rfi_id: '',
      assignee_user_id: 'user-1',
      confidence: 0.95,
    })
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x.includes('rfi_id'))).toBe(true)
  })

  it('predicate blocks on missing assignee', () => {
    const r = rfiRoutingPredicate({
      rfi_id: 'rfi-1',
      assignee_user_id: '',
      confidence: 0.95,
    })
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x.includes('assignee_user_id'))).toBe(true)
  })

  it('predicate blocks on out-of-range confidence', () => {
    expect(
      rfiRoutingPredicate({ rfi_id: 'r', assignee_user_id: 'u', confidence: 1.5 }).ok,
    ).toBe(false)
    expect(
      rfiRoutingPredicate({ rfi_id: 'r', assignee_user_id: 'u', confidence: -0.1 }).ok,
    ).toBe(false)
  })

  it('edge — accepts confidence = 0 and 1 (inclusive bounds)', () => {
    expect(
      rfiRoutingPredicate({ rfi_id: 'r', assignee_user_id: 'u', confidence: 0 }).ok,
    ).toBe(true)
    expect(
      rfiRoutingPredicate({ rfi_id: 'r', assignee_user_id: 'u', confidence: 1 }).ok,
    ).toBe(true)
  })
})

describe('daily-log-compilation executor', () => {
  it('declares confidence_floor 0.85 (super-persona threshold)', () => {
    expect(DAILY_LOG_COMPILATION_DECL.confidence_floor).toBe(0.85)
  })

  it('predicate passes a healthy input', () => {
    expect(
      dailyLogCompilationPredicate({
        project_id: 'p',
        date: '2026-05-10',
        source_event_count: 4,
        confidence: 0.9,
      }).ok,
    ).toBe(true)
  })

  it('blocks missing project_id', () => {
    expect(
      dailyLogCompilationPredicate({
        project_id: '',
        date: '2026-05-10',
        source_event_count: 4,
        confidence: 0.9,
      }).ok,
    ).toBe(false)
  })

  it('blocks bad date format', () => {
    const r = dailyLogCompilationPredicate({
      project_id: 'p',
      date: '5/10/2026',
      source_event_count: 4,
      confidence: 0.9,
    })
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x.includes('YYYY-MM-DD'))).toBe(true)
  })

  it('blocks zero source events', () => {
    const r = dailyLogCompilationPredicate({
      project_id: 'p',
      date: '2026-05-10',
      source_event_count: 0,
      confidence: 0.9,
    })
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x.includes('positive integer'))).toBe(true)
  })

  it('blocks non-integer source_event_count', () => {
    expect(
      dailyLogCompilationPredicate({
        project_id: 'p',
        date: '2026-05-10',
        source_event_count: 1.5,
        confidence: 0.9,
      }).ok,
    ).toBe(false)
  })
})

describe('punch-assignment executor', () => {
  it('declares confidence_floor 0.9', () => {
    expect(PUNCH_ASSIGNMENT_DECL.confidence_floor).toBe(0.9)
  })

  it('predicate passes a healthy input', () => {
    expect(
      punchAssignmentPredicate({
        punch_item_id: 'pl-1',
        assignee_user_id: 'u',
        trade: 'painter',
        confidence: 0.95,
      }).ok,
    ).toBe(true)
  })

  it('blocks missing trade', () => {
    expect(
      punchAssignmentPredicate({
        punch_item_id: 'pl-1',
        assignee_user_id: 'u',
        trade: '   ',
        confidence: 0.95,
      }).ok,
    ).toBe(false)
  })

  it('blocks missing punch_item_id', () => {
    expect(
      punchAssignmentPredicate({
        punch_item_id: '',
        assignee_user_id: 'u',
        trade: 'painter',
        confidence: 0.95,
      }).ok,
    ).toBe(false)
  })

  it('reports multiple reasons when multiple fields fail', () => {
    const r = punchAssignmentPredicate({
      punch_item_id: '',
      assignee_user_id: '',
      trade: '',
      confidence: 99,
    })
    expect(r.ok).toBe(false)
    expect(r.reasons.length).toBeGreaterThanOrEqual(3)
  })
})
