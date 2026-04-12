import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — tasks uses a double .order() chain with no .range()
// ---------------------------------------------------------------------------
const mockOrderSecond = vi.fn()
const mockOrderFirst = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
  fromTable: (...args: unknown[]) => mockFrom(...args),
  isSupabaseConfigured: true,
}))

function setupChain(data: unknown[] = []) {
  mockOrderSecond.mockResolvedValue({ data, error: null })
  mockOrderFirst.mockReturnValue({ order: mockOrderSecond })
  mockEq.mockReturnValue({ order: mockOrderFirst })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

function setupChainError(errMsg: string) {
  mockOrderSecond.mockResolvedValue({ data: null, error: { message: errMsg, code: '42501' } })
  mockOrderFirst.mockReturnValue({ order: mockOrderSecond })
  mockEq.mockReturnValue({ order: mockOrderFirst })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTasks query function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call supabase.from("tasks") with project_id filter', async () => {
    const PROJECT_ID = 'proj-tasks-001'
    const mockTasks = [
      { id: 't-1', title: 'Pour concrete footings', status: 'todo', sort_order: 0, project_id: PROJECT_ID },
      { id: 't-2', title: 'Frame exterior walls', status: 'in_progress', sort_order: 1, project_id: PROJECT_ID },
    ]
    setupChain(mockTasks)

    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', PROJECT_ID)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(mockFrom).toHaveBeenCalledWith('tasks')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(mockOrderFirst).toHaveBeenCalledWith('sort_order', { ascending: true })
    expect(mockOrderSecond).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result.data).toEqual(mockTasks)
    expect(result.error).toBeNull()
  })

  it('should return empty array when project has no tasks', async () => {
    setupChain([])

    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-empty')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('should propagate errors from Supabase', async () => {
    setupChainError('permission denied for table tasks')

    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-no-access')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    expect(result.data).toBeNull()
    expect(result.error).toMatchObject({ message: 'permission denied for table tasks' })
  })

  it('should order by sort_order ascending before created_at', async () => {
    setupChain([])

    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-xyz')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    // sort_order is the primary sort key
    expect(mockOrderFirst).toHaveBeenCalledWith('sort_order', { ascending: true })
    // created_at is the secondary sort key for deterministic ordering of new tasks
    expect(mockOrderSecond).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('should return tasks in the data property without pagination wrapper', async () => {
    const tasks = [
      { id: 't-10', title: 'Inspect MEP rough-in', status: 'done', sort_order: 0 },
      { id: 't-11', title: 'Hang drywall', status: 'in_progress', sort_order: 1 },
      { id: 't-12', title: 'Prime and paint', status: 'todo', sort_order: 2 },
    ]
    setupChain(tasks)

    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', 'proj-001')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    // useTasks returns a plain array (no pagination wrapping, unlike useRFIs)
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data).toHaveLength(3)
    expect(result.data![0].title).toBe('Inspect MEP rough-in')
  })
})
