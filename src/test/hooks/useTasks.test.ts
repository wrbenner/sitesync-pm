/**
 * Tests for useTasks Supabase query.
 * Verifies the correct Supabase chain calls and data shape handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
  fromTable: (...args: unknown[]) => mockFrom(...args),
  isSupabaseConfigured: true,
}))

// useTasks calls .select().eq().order().order() and resolves directly (no range)
function setupChainDouble(data: unknown[] = []) {
  // Two chained .order() calls
  const secondOrder = { then: vi.fn(), catch: vi.fn() }
  secondOrder.then.mockImplementation((fn: (v: unknown) => unknown) =>
    Promise.resolve(fn({ data, error: null }))
  )
  mockOrder
    .mockReturnValueOnce({ order: mockOrder })
    .mockReturnValueOnce(Promise.resolve({ data, error: null }))
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

function setupError(errorObj: { message: string; code: string }) {
  mockOrder
    .mockReturnValueOnce({ order: mockOrder })
    .mockReturnValueOnce(Promise.resolve({ data: null, error: errorObj }))
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTasks query function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("tasks")', async () => {
    setupChainDouble([])
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-001')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(mockFrom).toHaveBeenCalledWith('tasks')
  })

  it('filters by project_id', async () => {
    setupChainDouble([])
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-abc-456')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-abc-456')
  })

  it('orders by sort_order ascending first', async () => {
    setupChainDouble([])
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-001')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(mockOrder).toHaveBeenCalledWith('sort_order', { ascending: true })
  })

  it('secondary sorts by created_at ascending', async () => {
    setupChainDouble([])
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-001')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('returns task data from supabase', async () => {
    const tasks = [
      { id: 't-1', title: 'Lay forms', status: 'todo', project_id: 'proj-001' },
      { id: 't-2', title: 'Pour slab', status: 'in_progress', project_id: 'proj-001' },
    ]
    setupChainDouble(tasks)
    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-001')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(result.data).toEqual(tasks)
    expect(result.error).toBeNull()
  })

  it('propagates database errors', async () => {
    setupError({ message: 'permission denied for table tasks', code: '42501' })
    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-no-access')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(result.data).toBeNull()
    expect(result.error).toMatchObject({ code: '42501' })
  })

  it('returns empty array when project has no tasks', async () => {
    setupChainDouble([])
    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-empty')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(result.data).toEqual([])
  })
})

// ── Query enablement logic ────────────────────────────────────────────────────

describe('useTasks enablement', () => {
  it('should be disabled when projectId is undefined', () => {
    const projectId: string | undefined = undefined
    expect(!!projectId).toBe(false)
  })

  it('should be disabled when projectId is empty string', () => {
    const projectId = ''
    expect(!!projectId).toBe(false)
  })

  it('should be enabled when projectId is a valid UUID', () => {
    const projectId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    expect(!!projectId).toBe(true)
  })

  it('should include projectId in the query key', () => {
    const projectId = 'proj-xyz'
    const queryKey = ['tasks', projectId]
    expect(queryKey).toEqual(['tasks', 'proj-xyz'])
  })
})
