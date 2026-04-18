// Shared Supabase mock for unit tests.
//
// Usage (in a test file):
//
//   import { createMockSupabase } from '../../mocks/supabase'
//   const { supabase, chain, setResult } = createMockSupabase()
//   vi.mock('../../../lib/supabase', () => ({ supabase, fromTable: supabase.from }))
//
//   // per test:
//   setResult({ data: { id: 'r1', title: 'ok' }, error: null })
//
// The chain returned by supabase.from(...) supports the common Supabase
// fluent API: insert / update / delete / select / eq / neq / order / limit /
// range / in / is / single / maybeSingle. Every method returns the chain;
// awaiting the chain or calling .single() / .maybeSingle() resolves to the
// configured result.

import { vi } from 'vitest'

export interface MockResult<T = unknown> {
  data: T | null
  error: { message: string; code?: string } | null
  count?: number | null
}

export interface MockChain {
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  gt: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (onResolve: (r: MockResult) => unknown, onReject?: (e: unknown) => unknown) => Promise<unknown>
}

export interface MockSupabase {
  supabase: {
    from: ReturnType<typeof vi.fn>
    auth: {
      getSession: ReturnType<typeof vi.fn>
      getUser: ReturnType<typeof vi.fn>
      onAuthStateChange: ReturnType<typeof vi.fn>
    }
    channel: ReturnType<typeof vi.fn>
    removeChannel: ReturnType<typeof vi.fn>
  }
  chain: MockChain
  /** Change what terminal calls (.single(), awaited chain) resolve to. */
  setResult: (result: MockResult) => void
  /** Convenience: force next terminal call to return an error. */
  setError: (message: string) => void
}

export function createMockSupabase(initial?: Partial<MockResult>): MockSupabase {
  let pending: MockResult = { data: { id: 'mock-id' }, error: null, count: null, ...initial }

  const setResult = (r: MockResult) => {
    pending = r
  }
  const setError = (message: string) => {
    pending = { data: null, error: { message }, count: null }
  }

  const chain: MockChain = {} as MockChain
  const makeSpy = () => vi.fn(() => chain)

  chain.insert = makeSpy()
  chain.update = makeSpy()
  chain.delete = makeSpy()
  chain.upsert = makeSpy()
  chain.select = makeSpy()
  chain.eq = makeSpy()
  chain.neq = makeSpy()
  chain.in = makeSpy()
  chain.is = makeSpy()
  chain.gt = makeSpy()
  chain.gte = makeSpy()
  chain.lt = makeSpy()
  chain.lte = makeSpy()
  chain.order = makeSpy()
  chain.limit = makeSpy()
  chain.range = makeSpy()
  chain.single = vi.fn(() => Promise.resolve(pending))
  chain.maybeSingle = vi.fn(() => Promise.resolve(pending))
  chain.then = (onResolve, onReject) => Promise.resolve(pending).then(onResolve, onReject)

  const supabase = {
    from: vi.fn(() => chain),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  }

  return { supabase, chain, setResult, setError }
}
