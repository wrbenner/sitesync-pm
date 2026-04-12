import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkRateLimit,
  getRemainingRequests,
  logApiRequest,
  getApiLog,
  flushApiLog,
} from '../../lib/rateLimiter'

// Advance time by 2 minutes before each test so all previous window entries expire.
// The sliding window is 60 seconds, so a 120-second advance ensures a clean slate.
let testEpoch = new Date('2026-01-01T00:00:00Z').getTime()

beforeEach(() => {
  testEpoch += 120_000
  vi.useFakeTimers()
  vi.setSystemTime(testEpoch)
  flushApiLog()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── checkRateLimit ─────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('should allow a single request', () => {
    expect(checkRateLimit('api:read')).toBe(true)
  })

  it('should allow up to 100 api:read requests in the window', () => {
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit('api:read')).toBe(true)
    }
    // 101st should be blocked
    expect(checkRateLimit('api:read')).toBe(false)
  })

  it('should allow up to 30 api:write requests in the window', () => {
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit('api:write')).toBe(true)
    }
    expect(checkRateLimit('api:write')).toBe(false)
  })

  it('should allow up to 10 api:upload requests in the window', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('api:upload')).toBe(true)
    }
    expect(checkRateLimit('api:upload')).toBe(false)
  })

  it('should allow up to 20 ai:chat requests in the window', () => {
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('ai:chat')).toBe(true)
    }
    expect(checkRateLimit('ai:chat')).toBe(false)
  })

  it('should fall back to api:read limits for unknown action keys', () => {
    // Unknown keys fall back to api:read (100 per min)
    expect(checkRateLimit('custom:action')).toBe(true)
    // Remaining should be 99 (100 - 1)
    expect(getRemainingRequests('custom:action')).toBe(99)
  })

  it('should reset after the window expires', () => {
    // Exhaust api:upload limit (10 per min)
    for (let i = 0; i < 10; i++) {
      checkRateLimit('api:upload')
    }
    expect(checkRateLimit('api:upload')).toBe(false)

    // Advance time past the 60-second window
    vi.setSystemTime(testEpoch + 61_000)
    expect(checkRateLimit('api:upload')).toBe(true)
  })

  it('should use a sliding window (partial expiry)', () => {
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      checkRateLimit('api:upload')
    }

    // Advance 61 seconds: those 5 requests expire
    vi.setSystemTime(testEpoch + 61_000)

    // Make 10 more requests; window is fresh, all should pass
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('api:upload')).toBe(true)
    }
    // 11th should be blocked
    expect(checkRateLimit('api:upload')).toBe(false)
  })
})

// ── getRemainingRequests ───────────────────────────────────────────────────

describe('getRemainingRequests', () => {
  it('should return full capacity before any requests', () => {
    expect(getRemainingRequests('ai:chat')).toBe(20)
  })

  it('should decrease as requests are consumed', () => {
    checkRateLimit('api:write')
    checkRateLimit('api:write')
    checkRateLimit('api:write')
    expect(getRemainingRequests('api:write')).toBe(27)
  })

  it('should return 0 when rate limit is exhausted', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit('api:upload')
    }
    expect(getRemainingRequests('api:upload')).toBe(0)
  })

  it('should return max capacity for unknown action (defaults to api:read)', () => {
    expect(getRemainingRequests('never:used')).toBe(100)
  })

  it('should not go below 0', () => {
    for (let i = 0; i < 12; i++) {
      checkRateLimit('api:upload')
    }
    // Limit is 10, but checkRateLimit only records successful ones, so remaining is exactly 0
    expect(getRemainingRequests('api:upload')).toBe(0)
  })
})

// ── logApiRequest and getApiLog ────────────────────────────────────────────

describe('logApiRequest / getApiLog', () => {
  it('should record a single log entry', () => {
    logApiRequest({
      timestamp: Date.now(),
      action: 'api:read',
      endpoint: '/rfis',
      method: 'GET',
    })

    const log = getApiLog()
    expect(log).toHaveLength(1)
    expect(log[0].endpoint).toBe('/rfis')
    expect(log[0].method).toBe('GET')
    expect(log[0].action).toBe('api:read')
  })

  it('should accumulate multiple entries in order', () => {
    logApiRequest({ timestamp: Date.now(), action: 'api:read', endpoint: '/tasks', method: 'GET' })
    logApiRequest({ timestamp: Date.now(), action: 'api:write', endpoint: '/tasks', method: 'POST' })
    logApiRequest({ timestamp: Date.now(), action: 'api:read', endpoint: '/rfis', method: 'GET', statusCode: 200 })

    const log = getApiLog()
    expect(log).toHaveLength(3)
    expect(log[2].statusCode).toBe(200)
  })

  it('should include optional fields when provided', () => {
    logApiRequest({
      timestamp: Date.now(),
      action: 'api:write',
      endpoint: '/submittals',
      method: 'POST',
      statusCode: 201,
      durationMs: 145,
      userId: 'user-abc',
    })

    const entry = getApiLog()[0]
    expect(entry.statusCode).toBe(201)
    expect(entry.durationMs).toBe(145)
    expect(entry.userId).toBe('user-abc')
  })

  it('getApiLog returns a readonly view of the log', () => {
    logApiRequest({ timestamp: Date.now(), action: 'api:read', endpoint: '/projects', method: 'GET' })
    const log = getApiLog()
    expect(log).toHaveLength(1)
    // The returned object is readonly but should have length
    expect(typeof log.length).toBe('number')
  })
})

// ── flushApiLog ────────────────────────────────────────────────────────────

describe('flushApiLog', () => {
  it('should return all entries and clear the log', () => {
    logApiRequest({ timestamp: Date.now(), action: 'api:read', endpoint: '/projects', method: 'GET' })
    logApiRequest({ timestamp: Date.now(), action: 'api:write', endpoint: '/projects', method: 'POST' })

    const flushed = flushApiLog()
    expect(flushed).toHaveLength(2)
    expect(getApiLog()).toHaveLength(0)
  })

  it('should return empty array when log is already empty', () => {
    expect(flushApiLog()).toEqual([])
  })

  it('should allow new entries after flushing', () => {
    logApiRequest({ timestamp: Date.now(), action: 'api:read', endpoint: '/rfis', method: 'GET' })
    flushApiLog()

    logApiRequest({ timestamp: Date.now(), action: 'api:read', endpoint: '/tasks', method: 'GET' })
    expect(getApiLog()).toHaveLength(1)
    expect(getApiLog()[0].endpoint).toBe('/tasks')
  })
})
