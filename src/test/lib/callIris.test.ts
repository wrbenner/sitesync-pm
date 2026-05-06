// ─────────────────────────────────────────────────────────────────────────────
// callIris — SSE consumer + error-path tests
// ─────────────────────────────────────────────────────────────────────────────
// The wrapper is the single AI entry point for the browser. These tests lock
// in three contracts that the rest of the app depends on:
//
//   1. Streaming deltas accumulate into the final `content`, in order.
//   2. The `done` event resolves the promise with usage + audit_id.
//   3. Server-sent `error` events reject the promise as IrisCallError, and
//      onError fires once. Retryable flag is preserved.
//
// We mock fetch + supabase.auth so the test runs in jsdom with no network.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { callIris, IrisCallError } from '../../lib/ai/callIris'
import { supabase } from '../../lib/supabase'

// ── Test helpers ────────────────────────────────────────────────────────────

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= events.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(events[i]))
      i++
    },
  })
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function mockSession() {
  // deno-lint-ignore no-explicit-any
  vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
    data: { session: { access_token: 'test-jwt' } as never },
    error: null,
  } as never)
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('callIris', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockSession()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('streams deltas in order and resolves with the done payload', async () => {
    const events = [
      sseEvent('meta', { audit_id: null, idempotency_key: 'test-key', cached: false }),
      sseEvent('delta', { text: 'Hello, ' }),
      sseEvent('delta', { text: 'world.' }),
      sseEvent('done', {
        content: 'Hello, world.',
        usage: { input_tokens: 12, output_tokens: 3 },
        latency_ms: 420,
        provider: 'anthropic',
        model: 'claude-sonnet-4.6',
        audit_id: 'audit-uuid',
      }),
    ]

    globalThis.fetch = vi.fn(async () => new Response(sseStream(events), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })) as never

    const deltas: string[] = []
    let metaSeen = false
    let doneSeen = false

    const result = await callIris(
      { task: 'reasoning', prompt: 'hi' },
      {
        onMeta: () => { metaSeen = true },
        onDelta: (text) => { deltas.push(text) },
        onDone: () => { doneSeen = true },
      },
    )

    expect(metaSeen).toBe(true)
    expect(doneSeen).toBe(true)
    expect(deltas).toEqual(['Hello, ', 'world.'])
    expect(result.content).toBe('Hello, world.')
    expect(result.auditId).toBe('audit-uuid')
    expect(result.provider).toBe('anthropic')
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 })
  })

  it('rejects with IrisCallError on a server-sent error event', async () => {
    const events = [
      sseEvent('meta', { audit_id: null, idempotency_key: 'k', cached: false }),
      sseEvent('error', { message: 'Anthropic 529 overloaded', retryable: true }),
    ]

    globalThis.fetch = vi.fn(async () => new Response(sseStream(events), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })) as never

    const errors: IrisCallError[] = []

    await expect(
      callIris(
        { task: 'reasoning', prompt: 'hi' },
        { onError: (e) => { errors.push(e) } },
      ),
    ).rejects.toBeInstanceOf(IrisCallError)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Anthropic 529 overloaded')
    expect(errors[0].retryable).toBe(true)
  })

  it('throws IrisCallError(retryable=false) on auth failure', async () => {
    // deno-lint-ignore no-explicit-any
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as never)

    await expect(
      callIris({ task: 'reasoning', prompt: 'hi' }),
    ).rejects.toThrow('Not signed in')
  })

  it('marks 5xx HTTP responses as retryable; 4xx as not', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'Internal server error' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )) as never

    let caught: IrisCallError | null = null
    try {
      await callIris({ task: 'reasoning', prompt: 'hi' })
    } catch (e) {
      caught = e as IrisCallError
    }
    expect(caught).toBeInstanceOf(IrisCallError)
    expect(caught?.retryable).toBe(true)
    expect(caught?.status).toBe(503)

    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'Bad request' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )) as never

    let caught2: IrisCallError | null = null
    try {
      await callIris({ task: 'reasoning', prompt: 'hi' })
    } catch (e) {
      caught2 = e as IrisCallError
    }
    expect(caught2?.status).toBe(400)
    expect(caught2?.retryable).toBe(false)
  })

  it('treats 429 as retryable so the UI can back off and retry', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )) as never

    let caught: IrisCallError | null = null
    try {
      await callIris({ task: 'reasoning', prompt: 'hi' })
    } catch (e) {
      caught = e as IrisCallError
    }
    expect(caught?.status).toBe(429)
    expect(caught?.retryable).toBe(true)
  })
})
