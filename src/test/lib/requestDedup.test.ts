import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dedup, dedupTtl, queryKey, clearTtlCache } from '../../lib/requestDedup'

beforeEach(() => {
  clearTtlCache()
})

// ---------------------------------------------------------------------------
// dedup — in-flight request deduplication
// ---------------------------------------------------------------------------
describe('dedup', () => {
  it('returns the result of the factory function', async () => {
    const result = await dedup('key-1', () => Promise.resolve(42))
    expect(result).toBe(42)
  })

  it('deduplicates concurrent requests with the same key', async () => {
    let callCount = 0
    const factory = () => {
      callCount++
      return new Promise<string>((resolve) => setTimeout(() => resolve('done'), 20))
    }

    const [r1, r2] = await Promise.all([
      dedup('concurrent-key', factory),
      dedup('concurrent-key', factory),
    ])

    // factory called only once despite two dedup calls
    expect(callCount).toBe(1)
    expect(r1).toBe('done')
    expect(r2).toBe('done')
  })

  it('allows new request after previous one resolves', async () => {
    let callCount = 0
    const factory = () => {
      callCount++
      return Promise.resolve('value')
    }

    await dedup('serial-key', factory)
    await dedup('serial-key', factory)

    // Two sequential calls: both should fire since first resolved before second
    expect(callCount).toBe(2)
  })

  it('different keys do not deduplicate', async () => {
    let callCount = 0
    const factory = () => {
      callCount++
      return new Promise<number>((resolve) => setTimeout(() => resolve(callCount), 10))
    }

    await Promise.all([
      dedup('key-a', factory),
      dedup('key-b', factory),
    ])

    expect(callCount).toBe(2)
  })

  it('propagates rejection from the factory function', async () => {
    const factory = () => Promise.reject(new Error('network failure'))
    await expect(dedup('error-key', factory)).rejects.toThrow('network failure')
  })

  it('clears in-flight entry even on rejection', async () => {
    let callCount = 0
    const factory = () => {
      callCount++
      return Promise.reject(new Error('fail'))
    }

    // First call fails
    await dedup('clear-key', factory).catch(() => {})
    // Second call should invoke factory again (entry cleared)
    await dedup('clear-key', factory).catch(() => {})
    expect(callCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// dedupTtl — TTL-aware cache
// ---------------------------------------------------------------------------
describe('dedupTtl', () => {
  it('returns cached value within TTL', async () => {
    let callCount = 0
    const factory = () => {
      callCount++
      return Promise.resolve('cached-value')
    }

    const r1 = await dedupTtl('ttl-key', 5000, factory)
    const r2 = await dedupTtl('ttl-key', 5000, factory)

    expect(r1).toBe('cached-value')
    expect(r2).toBe('cached-value')
    // Second call should hit cache — factory only called once
    expect(callCount).toBe(1)
  })

  it('re-fetches after TTL expires', async () => {
    vi.useFakeTimers()
    let callCount = 0
    const factory = () => {
      callCount++
      return Promise.resolve(callCount)
    }

    const r1 = await dedupTtl('expire-key', 100, factory)
    expect(r1).toBe(1)

    // Advance past TTL
    vi.advanceTimersByTime(200)

    const r2 = await dedupTtl('expire-key', 100, factory)
    expect(r2).toBe(2)
    expect(callCount).toBe(2)

    vi.useRealTimers()
  })

  it('different keys get different cache entries', async () => {
    let callCount = 0
    const factory = (val: string) => () => {
      callCount++
      return Promise.resolve(val)
    }

    const r1 = await dedupTtl('key-x', 5000, factory('x'))
    const r2 = await dedupTtl('key-y', 5000, factory('y'))

    expect(r1).toBe('x')
    expect(r2).toBe('y')
    expect(callCount).toBe(2)
  })

  it('clearTtlCache invalidates all entries', async () => {
    let callCount = 0
    const factory = () => {
      callCount++
      return Promise.resolve('val')
    }

    await dedupTtl('clear-ttl', 10000, factory)
    clearTtlCache()
    await dedupTtl('clear-ttl', 10000, factory)

    // Should have been called twice because cache was cleared
    expect(callCount).toBe(2)
  })

  it('returns immediately on cache hit (no await on factory)', async () => {
    const factory = () => new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 1000))
    
    // Seed the cache
    await dedupTtl('instant-key', 5000, factory)

    // Second call: should resolve without waiting on factory again
    const start = Date.now()
    const r2 = await dedupTtl('instant-key', 5000, factory)
    const elapsed = Date.now() - start

    expect(r2).toBe('slow')
    expect(elapsed).toBeLessThan(50)
  })
})

// ---------------------------------------------------------------------------
// queryKey — cache key generator
// ---------------------------------------------------------------------------
describe('queryKey', () => {
  it('generates a key containing the table name', () => {
    const key = queryKey('rfis', { project_id: 'proj-1' })
    expect(key).toContain('rfis')
  })

  it('generates a key containing serialized filters', () => {
    const key = queryKey('rfis', { project_id: 'proj-1', status: 'open' })
    expect(key).toContain('proj-1')
    expect(key).toContain('open')
  })

  it('produces same key for same inputs', () => {
    const k1 = queryKey('submittals', { project_id: 'p1' })
    const k2 = queryKey('submittals', { project_id: 'p1' })
    expect(k1).toBe(k2)
  })

  it('produces different keys for different tables', () => {
    const k1 = queryKey('rfis', { project_id: 'p1' })
    const k2 = queryKey('submittals', { project_id: 'p1' })
    expect(k1).not.toBe(k2)
  })

  it('produces different keys for different filters', () => {
    const k1 = queryKey('rfis', { project_id: 'p1' })
    const k2 = queryKey('rfis', { project_id: 'p2' })
    expect(k1).not.toBe(k2)
  })

  it('handles empty filter object', () => {
    const key = queryKey('plans', {})
    expect(key).toBeTruthy()
    expect(key).toContain('plans')
  })
})
