import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  checkRateLimit,
  getRemainingRequests,
  logApiRequest,
  getApiLog,
  flushApiLog,
} from './rateLimiter'

// The module keeps state in module-scoped Records. We can't reset that state,
// but we CAN advance the clock far enough between tests so the sliding-window
// counter naturally evicts every prior entry. Advancing by 10 minutes is
// safely past every configured 60-second window.
//
// For the audit-log buffer we drain via the public flushApiLog().

let clockNow = Date.parse('2026-04-25T12:00:00Z')

beforeEach(() => {
  // Advance well past any rate-limit window so prior tests' entries expire
  clockNow += 10 * 60_000
  vi.useFakeTimers()
  vi.setSystemTime(new Date(clockNow))
  flushApiLog()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── checkRateLimit ───────────────────────────────────────────────

describe('checkRateLimit — sliding window enforcement', () => {
  it('First call to a fresh action returns true', () => {
    expect(checkRateLimit('api:read')).toBe(true)
  })

  it('Allows up to maxRequests calls within the window', () => {
    // api:read allows 100 in 60s. Already has 0 in the slot.
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit('api:read')).toBe(true)
    }
    // The 101st should be blocked.
    expect(checkRateLimit('api:read')).toBe(false)
  })

  it('api:write enforces a tighter 30/min limit', () => {
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit('api:write')).toBe(true)
    }
    expect(checkRateLimit('api:write')).toBe(false)
  })

  it('api:upload enforces an even tighter 10/min limit', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('api:upload')).toBe(true)
    }
    expect(checkRateLimit('api:upload')).toBe(false)
  })

  it('ai:chat enforces 20/min limit', () => {
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('ai:chat')).toBe(true)
    }
    expect(checkRateLimit('ai:chat')).toBe(false)
  })

  it('Unknown action types fall back to the api:read limit (default)', () => {
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit('unknown:action')).toBe(true)
    }
    expect(checkRateLimit('unknown:action')).toBe(false)
  })

  it('Entries older than windowMs expire — limit re-opens', () => {
    for (let i = 0; i < 30; i++) checkRateLimit('api:write')
    expect(checkRateLimit('api:write')).toBe(false)
    // Roll time 61 seconds forward — all entries fall outside the 60s window
    vi.setSystemTime(new Date(clockNow + 61_000))
    expect(checkRateLimit('api:write')).toBe(true)
  })

  it('Per-action buckets are independent (api:write does not consume api:upload)', () => {
    for (let i = 0; i < 30; i++) checkRateLimit('api:write')
    expect(checkRateLimit('api:write')).toBe(false)
    // api:upload should still be untouched
    expect(checkRateLimit('api:upload')).toBe(true)
  })
})

// ── getRemainingRequests ─────────────────────────────────────────

describe('getRemainingRequests — quota visibility', () => {
  it('Returns the full quota for an action that has never been called', () => {
    expect(getRemainingRequests('api:write')).toBe(30)
  })

  it('Decrements as calls are consumed', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('api:write')
    expect(getRemainingRequests('api:write')).toBe(25)
  })

  it('Returns 0 when the bucket is fully consumed (cannot go negative)', () => {
    for (let i = 0; i < 100; i++) checkRateLimit('api:upload') // overshoot intentionally
    expect(getRemainingRequests('api:upload')).toBe(0)
  })

  it('Unknown action returns the default api:read quota of 100', () => {
    expect(getRemainingRequests('unknown:other')).toBe(100)
  })
})

// ── logApiRequest / getApiLog / flushApiLog ──────────────────────

describe('audit log buffer — bounded ring + flush', () => {
  it('logApiRequest adds an entry that getApiLog reflects', () => {
    logApiRequest({ timestamp: Date.now(), action: 'api:read', endpoint: '/rfis', method: 'GET' })
    expect(getApiLog()).toHaveLength(1)
    expect(getApiLog()[0].endpoint).toBe('/rfis')
  })

  it('Caps log at MAX_LOG_SIZE (500) entries by dropping the oldest first', () => {
    for (let i = 0; i < 600; i++) {
      logApiRequest({ timestamp: i, action: 'a', endpoint: '/x', method: 'GET' })
    }
    const log = getApiLog()
    expect(log).toHaveLength(500)
    // The oldest entries (timestamps 0..99) were dropped — first should be 100
    expect(log[0].timestamp).toBe(100)
    expect(log[log.length - 1].timestamp).toBe(599)
  })

  it('flushApiLog returns and drains in one shot (matches a transactional flush pattern)', () => {
    logApiRequest({ timestamp: 1, action: 'a', endpoint: '/x', method: 'GET' })
    logApiRequest({ timestamp: 2, action: 'a', endpoint: '/y', method: 'POST' })
    const flushed = flushApiLog()
    expect(flushed).toHaveLength(2)
    expect(getApiLog()).toHaveLength(0)
  })

  it('getApiLog returns a readonly view of the live log', () => {
    logApiRequest({ timestamp: 1, action: 'a', endpoint: '/x', method: 'GET' })
    const a = getApiLog()
    logApiRequest({ timestamp: 2, action: 'a', endpoint: '/y', method: 'GET' })
    // The view reflects the latest state (the same array reference)
    expect(getApiLog()).toHaveLength(2)
    expect(a).toHaveLength(2)
  })
})
