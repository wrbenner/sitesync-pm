import { describe, it, expect, beforeEach, vi } from 'vitest'

// rateLimiter holds bucket state in a module-level Map. Each test resets
// the module so a fresh Map is built — otherwise provider buckets leak
// between cases and assertions become order-dependent.
let acquireToken: typeof import('./rateLimiter').acquireToken
let canRequest: typeof import('./rateLimiter').canRequest
let getRemainingTokens: typeof import('./rateLimiter').getRemainingTokens
let rateLimitedFetch: typeof import('./rateLimiter').rateLimitedFetch

beforeEach(async () => {
  vi.resetModules()
  vi.useRealTimers()
  const mod = await import('./rateLimiter')
  acquireToken = mod.acquireToken
  canRequest = mod.canRequest
  getRemainingTokens = mod.getRemainingTokens
  rateLimitedFetch = mod.rateLimitedFetch
})

describe('rateLimiter — token bucket', () => {
  it('canRequest is true for a fresh provider (full bucket)', () => {
    expect(canRequest('quickbooks')).toBe(true)
  })

  it('getRemainingTokens reports the configured maxTokens for a known provider', () => {
    // quickbooks is configured at 500/min in PROVIDER_LIMITS
    expect(getRemainingTokens('quickbooks')).toBe(500)
  })

  it('uses DEFAULT_LIMIT for an unknown provider', () => {
    // Default is 100 tokens
    expect(getRemainingTokens('unknown_xyz')).toBe(100)
  })

  it('acquireToken decrements the bucket', async () => {
    const before = getRemainingTokens('slack')
    await acquireToken('slack')
    const after = getRemainingTokens('slack')
    expect(after).toBe(before - 1)
  })

  it('canRequest goes false once the bucket is fully drained', async () => {
    // Use email_resend — only 10 tokens, fast to drain.
    for (let i = 0; i < 10; i++) {
      await acquireToken('email_resend')
    }
    expect(canRequest('email_resend')).toBe(false)
  })

  it('acquireToken throws when the wait would exceed the timeout', async () => {
    // Drain email_resend (10 tokens) then try to acquire with a 1ms timeout.
    // Refill is 10/60 per second ≈ 167ms per token, far above 1ms.
    for (let i = 0; i < 10; i++) await acquireToken('email_resend')

    await expect(acquireToken('email_resend', 1)).rejects.toThrow(/rate limit exceeded/i)
  })

  it('refills tokens over time (advancing real clock via small wait)', async () => {
    // Drain a small bucket; wait long enough for ≥1 token to refill.
    // email_resend refills at 10/60 ≈ 0.167 tokens/sec → 1 token ≈ 6s.
    // Instead use slack (50/min ≈ 0.83 tokens/sec → 1 token ≈ 1.2s)
    for (let i = 0; i < 50; i++) await acquireToken('slack')
    expect(canRequest('slack')).toBe(false)

    // Wait 1.5s for ≥1 refilled token.
    await new Promise((r) => setTimeout(r, 1500))
    expect(canRequest('slack')).toBe(true)
  }, 10_000)
})

describe('rateLimiter — rateLimitedFetch', () => {
  it('passes through a 200 response unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const r = await rateLimitedFetch('teams', 'https://example.com/x')
    expect(r.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/x', undefined)

    vi.unstubAllGlobals()
  })

  it('retries once after a 429 with Retry-After header', async () => {
    let calls = 0
    const fetchMock = vi.fn().mockImplementation(() => {
      calls += 1
      if (calls === 1) {
        return Promise.resolve(
          new Response('rate-limited', {
            status: 429,
            headers: { 'Retry-After': '0' }, // retry immediately so test stays fast
          }),
        )
      }
      return Promise.resolve(new Response('ok', { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const r = await rateLimitedFetch('procore_import', 'https://api.procore.com/x')
    expect(r.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })

  it('forwards request options (method, headers, body) to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const init: RequestInit = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ x: 1 }),
    }
    await rateLimitedFetch('quickbooks', 'https://api.example.com', init)

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com', init)

    vi.unstubAllGlobals()
  })
})
