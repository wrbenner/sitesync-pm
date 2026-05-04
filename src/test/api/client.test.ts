import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must be hoisted before any imports that pull in supabase
vi.mock('../../lib/supabase', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  }
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      from: vi.fn(() => mockQueryBuilder),
      _mockQueryBuilder: mockQueryBuilder,
    },
  }
})

vi.mock('../../api/middleware/projectScope', () => ({
  assertProjectAccess: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/requestDedup', () => ({
  dedup: vi.fn((key: string, fn: () => unknown) => { void key; return fn() }),
  queryKey: vi.fn((a: string, b: unknown) => { void a; void b; return 'test-key' }),
}))

const PROJECT_A = '11111111-1111-4111-8111-111111111111'
const PROJECT_B = '22222222-2222-4222-8222-222222222222'

describe('createScopedClient', () => {
  function getMockBuilder() {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
  }

  it('automatically appends .eq(project_id) after a terminal operation', async () => {
    const { createScopedClient } = await import('../../api/client')
    const { supabase } = await import('../../lib/supabase')

    const builder = getMockBuilder()
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const scoped = createScopedClient(supabase as never, PROJECT_A)
    // .eq() is injected after the terminal call so the QueryBuilder chain is not broken
    scoped.from('rfis' as never).select('*' as never)

    expect(supabase.from).toHaveBeenCalledWith('rfis')
    expect(builder.eq).toHaveBeenCalledWith('project_id', PROJECT_A)
  })

  it('does not inject project_id for non-from accesses', async () => {
    const { createScopedClient } = await import('../../api/client')
    const { supabase } = await import('../../lib/supabase')

    const scoped = createScopedClient(supabase as never, PROJECT_A)
    // auth should pass through unchanged
    expect(scoped.auth).toBe(supabase.auth)
  })
})

describe('projectScopedQuery tenant isolation', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const dedup = await import('../../lib/requestDedup')
    vi.mocked(dedup.dedup).mockImplementation((_key, fn) => fn() as never)
  })

  it('enforces project_id filter even when the query callback omits it', async () => {
    const { projectScopedQuery } = await import('../../api/client')
    const { supabase } = await import('../../lib/supabase')

    // Simulate a query that returns data without filtering (i.e., a naive callback
    // that does not call .eq('project_id', ...) itself).
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: undefined as never,
    }
    // Make the builder thenable so await works
    const resolvedValue = { data: [{ id: 'row-1', project_id: PROJECT_A }], error: null }
    builder.then = ((resolve: (v: typeof resolvedValue) => void) => resolve(resolvedValue)) as never

    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await projectScopedQuery('rfis', PROJECT_A, (client) => {
      // Deliberately omit .eq('project_id', ...) to simulate a naive caller
      return client.from('rfis' as never).select('*') as never
    })

    // The scoped client must have injected the filter before the callback could chain further
    expect(builder.eq).toHaveBeenCalledWith('project_id', PROJECT_A)
  })

  it('does not apply project_id from project B when querying for project A', async () => {
    const { projectScopedQuery } = await import('../../api/client')
    const { supabase } = await import('../../lib/supabase')

    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await projectScopedQuery('rfis', PROJECT_A, (client) =>
      client.from('rfis' as never).select('*') as never
    )

    const eqCalls = vi.mocked(builder.eq).mock.calls
    // Must include a call that pins to PROJECT_A
    expect(eqCalls.some(([col, val]) => col === 'project_id' && val === PROJECT_A)).toBe(true)
    // Must NOT include a call that would inadvertently pin to PROJECT_B
    expect(eqCalls.some(([col, val]) => col === 'project_id' && val === PROJECT_B)).toBe(false)
  })
})
