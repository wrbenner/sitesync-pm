import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dedup, dedupTtl, queryKey, clearTtlCache } from '../../lib/requestDedup'

beforeEach(() => {
  clearTtlCache()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── dedup ──────────────────────────────────────────────────────────────────

describe('dedup', () => {
  it('should return the result of the function', async () => {
    const result = await dedup('key-1', () => Promise.resolve('hello'))
    expect(result).toBe('hello')
  })

  it('should share the same promise for concurrent calls with the same key', async () => {
    let callCount = 0
    const fn = () => {
      callCount++
      return new Promise<string>((resolve) =>
        setTimeout(() => resolve('result'), 10)
      )
    }

    const p1 = dedup('concurrent-key', fn)
    const p2 = dedup('concurrent-key', fn)

    vi.runAllTimers()

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('result')
    expect(r2).toBe('result')
    // fn should only be called once
    expect(callCount).toBe(1)
  })

  it('should allow a new call after the promise resolves', async () => {
    let callCount = 0
    const fn = () => {
      callCount++
      return Promise.resolve('value')
    }

    await dedup('sequential-key', fn)
    await dedup('sequential-key', fn)

    expect(callCount).toBe(2)
  })

  it('should allow a new call after the promise rejects', async () => {
    let callCount = 0

    const fn = () => {
      callCount++
      return Promise.reject(new Error('fail'))
    }

    await dedup('reject-key', fn).catch(() => {})
    await dedup('reject-key', fn).catch(() => {})

    expect(callCount).toBe(2)
  })

  it('should use separate in-flight maps for different keys', async () => {
    let countA = 0
    let countB = 0

    const fnA = () => { countA++; return Promise.resolve('a') }
    const fnB = () => { countB++; return Promise.resolve('b') }

    const [a, b] = await Promise.all([
      dedup('key-a', fnA),
      dedup('key-b', fnB),
    ])

    expect(a).toBe('a')
    expect(b).toBe('b')
    expect(countA).toBe(1)
    expect(countB).toBe(1)
  })

  it('should propagate errors from the underlying function', async () => {
    const fn = () => Promise.reject(new Error('network error'))
    await expect(dedup('error-key', fn)).rejects.toThrow('network error')
  })
})

// ── dedupTtl ───────────────────────────────────────────────────────────────

describe('dedupTtl', () => {
  it('should call the function and return its value on first call', async () => {
    let callCount = 0
    const fn = () => { callCount++; return Promise.resolve('first') }

    const result = await dedupTtl('ttl-key-1', 5000, fn)
    expect(result).toBe('first')
    expect(callCount).toBe(1)
  })

  it('should return cached value within TTL without calling the function again', async () => {
    let callCount = 0
    const fn = () => { callCount++; return Promise.resolve('cached') }

    await dedupTtl('ttl-key-2', 5000, fn)
    const second = await dedupTtl('ttl-key-2', 5000, fn)

    expect(second).toBe('cached')
    expect(callCount).toBe(1) // fn called only once
  })

  it('should call the function again after TTL expires', async () => {
    let callCount = 0
    const fn = () => { callCount++; return Promise.resolve(`call-${callCount}`) }

    await dedupTtl('ttl-key-3', 1000, fn)

    // Advance time past TTL
    vi.advanceTimersByTime(1001)

    const second = await dedupTtl('ttl-key-3', 1000, fn)
    expect(callCount).toBe(2)
    expect(second).toBe('call-2')
  })

  it('should use separate cache entries for different keys', async () => {
    let countA = 0
    let countB = 0

    await dedupTtl('key-alpha', 5000, () => { countA++; return Promise.resolve('alpha') })
    await dedupTtl('key-beta', 5000, () => { countB++; return Promise.resolve('beta') })

    // Second calls should still hit cache per key
    await dedupTtl('key-alpha', 5000, () => { countA++; return Promise.resolve('alpha') })
    await dedupTtl('key-beta', 5000, () => { countB++; return Promise.resolve('beta') })

    expect(countA).toBe(1)
    expect(countB).toBe(1)
  })

  it('clearTtlCache should force fresh fetch', async () => {
    let callCount = 0
    const fn = () => { callCount++; return Promise.resolve('value') }

    await dedupTtl('ttl-clear-key', 10000, fn)
    clearTtlCache()
    await dedupTtl('ttl-clear-key', 10000, fn)

    expect(callCount).toBe(2)
  })
})

// ── queryKey ───────────────────────────────────────────────────────────────

describe('queryKey', () => {
  it('should generate a key from table and filters', () => {
    const key = queryKey('rfis', { project_id: 'proj-1', status: 'open' })
    expect(key).toBe('rfis:{"project_id":"proj-1","status":"open"}')
  })

  it('should generate consistent keys for same inputs', () => {
    const k1 = queryKey('tasks', { project_id: 'p1' })
    const k2 = queryKey('tasks', { project_id: 'p1' })
    expect(k1).toBe(k2)
  })

  it('should generate different keys for different tables', () => {
    const k1 = queryKey('rfis', { project_id: 'p1' })
    const k2 = queryKey('submittals', { project_id: 'p1' })
    expect(k1).not.toBe(k2)
  })

  it('should generate different keys for different filters', () => {
    const k1 = queryKey('rfis', { project_id: 'p1' })
    const k2 = queryKey('rfis', { project_id: 'p2' })
    expect(k1).not.toBe(k2)
  })

  it('should handle empty filters', () => {
    const key = queryKey('projects', {})
    expect(key).toBe('projects:{}')
  })

  it('should handle nested objects in filters', () => {
    const key = queryKey('tasks', { filter: { status: 'open' }, page: 1 })
    expect(typeof key).toBe('string')
    expect(key.startsWith('tasks:')).toBe(true)
  })
})
