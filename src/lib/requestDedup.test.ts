import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { dedup, dedupTtl, queryKey, clearTtlCache } from './requestDedup'

beforeEach(() => {
  clearTtlCache()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('requestDedup — dedup', () => {
  it('first call executes the underlying function', async () => {
    const fn = vi.fn().mockResolvedValue('value-1')
    const r = await dedup('key', fn)
    expect(r).toBe('value-1')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('parallel callers with the same key share one execution', async () => {
    let resolveOuter: (v: string) => void = () => {}
    const fn = vi.fn().mockImplementation(
      () => new Promise<string>((resolve) => { resolveOuter = resolve }),
    )

    const p1 = dedup('shared', fn)
    const p2 = dedup('shared', fn)
    const p3 = dedup('shared', fn)

    expect(fn).toHaveBeenCalledTimes(1)
    resolveOuter('shared-result')
    expect(await p1).toBe('shared-result')
    expect(await p2).toBe('shared-result')
    expect(await p3).toBe('shared-result')
  })

  it('different keys execute independently', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await Promise.all([dedup('a', fn), dedup('b', fn)])
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('after a call resolves, the next call with the same key re-executes', async () => {
    const fn = vi.fn().mockResolvedValue('done')
    await dedup('once', fn)
    await dedup('once', fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('rejection propagates and clears the in-flight slot', async () => {
    const fn1 = vi.fn().mockRejectedValueOnce(new Error('first fail'))
    const fn2 = vi.fn().mockResolvedValue('recovered')

    await expect(dedup('retry-key', fn1)).rejects.toThrow('first fail')
    // After rejection, the dedup slot must be cleared so the next caller can succeed.
    const r = await dedup('retry-key', fn2)
    expect(r).toBe('recovered')
    expect(fn2).toHaveBeenCalledTimes(1)
  })
})

describe('requestDedup — dedupTtl', () => {
  it('first call executes and caches; second within TTL is served from cache', async () => {
    const fn = vi.fn().mockResolvedValue('cached')
    const a = await dedupTtl('k', 1000, fn)
    const b = await dedupTtl('k', 1000, fn)
    expect(a).toBe('cached')
    expect(b).toBe('cached')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('after TTL expiration, the underlying function runs again', async () => {
    vi.useFakeTimers()
    const fn = vi.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second')

    const a = await dedupTtl('k', 1000, fn)
    expect(a).toBe('first')
    expect(fn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1500)

    const b = await dedupTtl('k', 1000, fn)
    expect(b).toBe('second')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('different keys are cached independently', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce('A-value')
      .mockResolvedValueOnce('B-value')
    const a = await dedupTtl('a', 1000, fn)
    const b = await dedupTtl('b', 1000, fn)
    expect(a).toBe('A-value')
    expect(b).toBe('B-value')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('clearTtlCache invalidates cached values immediately', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce('original')
      .mockResolvedValueOnce('refreshed')

    const a = await dedupTtl('k', 60_000, fn)
    expect(a).toBe('original')
    clearTtlCache()
    const b = await dedupTtl('k', 60_000, fn)
    expect(b).toBe('refreshed')
  })
})

describe('requestDedup — queryKey', () => {
  it('builds a deterministic key from table + filters', () => {
    expect(queryKey('rfis', { project_id: 'p1' })).toBe('rfis:{"project_id":"p1"}')
  })

  it('different filter values produce different keys', () => {
    expect(queryKey('rfis', { project_id: 'p1' }))
      .not.toBe(queryKey('rfis', { project_id: 'p2' }))
  })

  it('different tables produce different keys', () => {
    expect(queryKey('rfis', { id: '1' }))
      .not.toBe(queryKey('submittals', { id: '1' }))
  })

  it('handles empty filters', () => {
    expect(queryKey('orgs', {})).toBe('orgs:{}')
  })

  it('handles nested filter objects', () => {
    const k = queryKey('audit', { entity: 'rfi', filters: { status: 'open' } })
    expect(k).toContain('audit')
    expect(k).toContain('open')
  })
})
