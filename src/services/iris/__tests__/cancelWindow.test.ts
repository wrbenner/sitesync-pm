// ────────────────────────────────────────────────────────────────────────────
// cancelWindow + cancelDispatch tests
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md
//
// Key invariant: a cancel at 59.999s MUST win; a cancel at 60.001s MUST lose
// (the executor commits). The deadline is exclusive on the cancel side.

import { describe, expect, it, vi } from 'vitest'

import { applyCancel, CANCEL_WINDOW_DURATION_MS, evaluateCancelWindow } from '../cancelWindow'
import {
  dispatchCancelWindow,
  listAllSurfaces,
  type CancelDispatchConfig,
  type CancelDispatchPayload,
} from '../cancelDispatch'

const DECIDED_AT_ISO = '2026-05-11T12:00:00.000Z'
const DECIDED_AT_MS = new Date(DECIDED_AT_ISO).getTime()

describe('evaluateCancelWindow — timer math', () => {
  it('returns pending with ms_remaining at 30s in', () => {
    const state = evaluateCancelWindow({ decided_at: DECIDED_AT_ISO, now: DECIDED_AT_MS + 30_000 })
    expect(state.status).toBe('pending')
    if (state.status === 'pending') {
      expect(state.ms_remaining).toBe(30_000)
    }
  })

  it('returns committed at exactly 60s with no cancel', () => {
    const state = evaluateCancelWindow({
      decided_at: DECIDED_AT_ISO,
      now: DECIDED_AT_MS + CANCEL_WINDOW_DURATION_MS,
    })
    expect(state.status).toBe('committed')
  })

  it('returns cancelled when cancel arrives at 59.999s', () => {
    const state = evaluateCancelWindow({
      decided_at: DECIDED_AT_ISO,
      cancelled_at: DECIDED_AT_MS + 59_999,
      now: DECIDED_AT_MS + 65_000,
    })
    expect(state.status).toBe('cancelled')
  })

  it('returns committed when cancel arrives at 60.001s (past deadline)', () => {
    const state = evaluateCancelWindow({
      decided_at: DECIDED_AT_ISO,
      cancelled_at: DECIDED_AT_MS + 60_001,
      now: DECIDED_AT_MS + 65_000,
    })
    expect(state.status).toBe('committed')
  })

  it('tie at exactly 60.000s — executor wins (deterministic tie-breaker)', () => {
    const state = evaluateCancelWindow({
      decided_at: DECIDED_AT_ISO,
      cancelled_at: DECIDED_AT_MS + CANCEL_WINDOW_DURATION_MS,
      now: DECIDED_AT_MS + 65_000,
    })
    expect(state.status).toBe('committed')
  })

  it('accepts numeric epoch ms as decided_at', () => {
    const state = evaluateCancelWindow({
      decided_at: DECIDED_AT_MS,
      now: DECIDED_AT_MS + 15_000,
    })
    expect(state.status).toBe('pending')
  })
})

describe('applyCancel — server-side handler', () => {
  it('accepts a cancel attempt strictly before the deadline', () => {
    const r = applyCancel({
      decided_at: DECIDED_AT_MS,
      cancel_attempt_at: DECIDED_AT_MS + 30_000,
    })
    expect(r.applied).toBe(true)
    if (r.applied) {
      expect(r.cancelled_at).toBe(DECIDED_AT_MS + 30_000)
    }
  })

  it('rejects a cancel attempt past the deadline', () => {
    const r = applyCancel({
      decided_at: DECIDED_AT_MS,
      cancel_attempt_at: DECIDED_AT_MS + 60_001,
    })
    expect(r.applied).toBe(false)
    if (!r.applied) {
      expect(r.reason).toBe('past_deadline')
    }
  })

  it('rejects a cancel attempt at exactly the deadline', () => {
    const r = applyCancel({
      decided_at: DECIDED_AT_MS,
      cancel_attempt_at: DECIDED_AT_MS + CANCEL_WINDOW_DURATION_MS,
    })
    expect(r.applied).toBe(false)
  })
})

describe('dispatchCancelWindow — fan-out across 5 surfaces', () => {
  const payload: CancelDispatchPayload = {
    executor_run_id: 'run-1',
    executor_name: 'rfi-routing',
    action_label: 'Routing RFI #42 to Casey',
    user_id: 'user-1',
    decided_at: DECIDED_AT_ISO,
    cancel_deadline_at: new Date(DECIDED_AT_MS + CANCEL_WINDOW_DURATION_MS).toISOString(),
  }

  it('delivers to every configured surface', async () => {
    const cfg: CancelDispatchConfig = {
      in_app_banner: vi.fn(async () => ({ surface: 'in_app_banner' as const, delivered: true })),
      push_notification: vi.fn(async () => ({ surface: 'push_notification' as const, delivered: true })),
      email: vi.fn(async () => ({ surface: 'email' as const, delivered: true })),
      sms: vi.fn(async () => ({ surface: 'sms' as const, delivered: true })),
      desktop_notification: vi.fn(async () => ({ surface: 'desktop_notification' as const, delivered: true })),
    }
    const outcome = await dispatchCancelWindow(payload, cfg)
    expect(outcome.delivered).toHaveLength(5)
    expect(outcome.failed).toHaveLength(0)
  })

  it('records failures without throwing', async () => {
    const cfg: CancelDispatchConfig = {
      in_app_banner: async () => ({ surface: 'in_app_banner', delivered: true }),
      email: async () => {
        throw new Error('SMTP down')
      },
    }
    const outcome = await dispatchCancelWindow(payload, cfg)
    expect(outcome.delivered).toContain('in_app_banner')
    expect(outcome.failed.some((f) => f.surface === 'email' && f.error.includes('SMTP'))).toBe(true)
  })

  it('skips unconfigured surfaces silently', async () => {
    const cfg: CancelDispatchConfig = {
      in_app_banner: async () => ({ surface: 'in_app_banner', delivered: true }),
    }
    const outcome = await dispatchCancelWindow(payload, cfg)
    expect(outcome.delivered).toEqual(['in_app_banner'])
    expect(outcome.failed).toHaveLength(0)
  })

  it('listAllSurfaces returns the canonical 5 surfaces', () => {
    expect(listAllSurfaces()).toHaveLength(5)
  })
})
