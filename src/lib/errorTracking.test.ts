import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initErrorTracking,
  captureException,
  addBreadcrumb,
  setUser,
  getErrorBuffer,
  withErrorTracking,
} from './errorTracking'

describe('captureException', () => {
  beforeEach(() => {
    // Drain the in-memory buffer so each test starts clean. There is no
    // exported reset; pushing 100 entries forces the older ones out.
    for (let i = 0; i < 200; i++) {
      captureException(new Error('drain'))
    }
    // Now buffer holds exactly 100 'drain' entries; rotate them away.
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appends to the buffer and is observable via getErrorBuffer', () => {
    const sentinel = new Error('marker-' + Math.random())
    captureException(sentinel, { userId: 'u1' })
    const buf = getErrorBuffer()
    const last = buf[buf.length - 1]
    expect(last.error).toBe(sentinel)
    expect(last.context.userId).toBe('u1')
    expect(typeof last.timestamp).toBe('number')
  })

  it('caps the buffer at MAX_BUFFER_SIZE (100)', () => {
    for (let i = 0; i < 50; i++) {
      captureException(new Error(`e${i}`))
    }
    expect(getErrorBuffer().length).toBeLessThanOrEqual(100)
  })

  it('returns a copy (mutation-safe)', () => {
    const a = getErrorBuffer()
    a.push({ error: new Error('hax'), context: {}, timestamp: 0 })
    const b = getErrorBuffer()
    expect(b.length).toBeLessThan(a.length)
  })
})

describe('addBreadcrumb', () => {
  it('does not throw on simple inputs', () => {
    expect(() => addBreadcrumb('clicked save', 'ui', { btn: 'save' })).not.toThrow()
  })

  it('handles missing data argument', () => {
    expect(() => addBreadcrumb('msg', 'cat')).not.toThrow()
  })
})

describe('setUser', () => {
  it('does not throw', () => {
    expect(() => setUser('user-123')).not.toThrow()
  })
})

describe('withErrorTracking', () => {
  it('returns the wrapped function result on success', async () => {
    const wrapped = withErrorTracking(async (n: number) => n * 2, {
      action: 'double',
    }) as (n: number) => Promise<number>
    expect(await wrapped(5)).toBe(10)
  })

  it('captures exceptions and re-throws', async () => {
    const boom = new Error('boom')
    const wrapped = withErrorTracking(async () => {
      throw boom
    }, { action: 'fail' })
    await expect((wrapped as () => Promise<unknown>)()).rejects.toBe(boom)
    const buf = getErrorBuffer()
    expect(buf.some((e) => e.error === boom)).toBe(true)
  })

  it('wraps non-Error throwables into Error objects', async () => {
    const wrapped = withErrorTracking(async () => {
      throw 'string-error'
    }, { action: 'string-throw' })
    await expect((wrapped as () => Promise<unknown>)()).rejects.toBeDefined()
    const buf = getErrorBuffer()
    const last = buf[buf.length - 1]
    expect(last.error).toBeInstanceOf(Error)
    expect(last.error.message).toBe('string-error')
  })
})

describe('initErrorTracking', () => {
  it('returns a teardown function', () => {
    const teardown = initErrorTracking()
    expect(typeof teardown).toBe('function')
    teardown()
  })

  it('multiple init/teardown cycles do not throw', () => {
    expect(() => {
      initErrorTracking()()
      initErrorTracking()()
      initErrorTracking()()
    }).not.toThrow()
  })
})
