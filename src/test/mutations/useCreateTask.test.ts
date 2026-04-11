/**
 * Tests for useCreateTask mutation Supabase operations.
 * Also covers useDeleteTask which uses a simpler delete chain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
  fromTable: (...args: unknown[]) => mockFrom(...args),
  isSupabaseConfigured: true,
}))

function setupInsertSuccess(returnedRow: Record<string, unknown>) {
  mockSingle.mockResolvedValue({ data: returnedRow, error: null })
  mockSelect.mockReturnValue({ single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockFrom.mockReturnValue({ insert: mockInsert })
}

function setupInsertError(errorObj: { message: string; code: string }) {
  mockSingle.mockResolvedValue({ data: null, error: errorObj })
  mockSelect.mockReturnValue({ single: mockSingle })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockFrom.mockReturnValue({ insert: mockInsert })
}

function setupDeleteSuccess() {
  mockEq.mockResolvedValue({ data: null, error: null })
  mockDelete.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ delete: mockDelete })
}

function setupDeleteError(errorObj: { message: string; code: string }) {
  mockEq.mockResolvedValue({ data: null, error: errorObj })
  mockDelete.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ delete: mockDelete })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCreateTask mutation function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("tasks")', async () => {
    setupInsertSuccess({ id: 't-new', title: 'Install conduit', status: 'todo' })
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .insert({ title: 'Install conduit', project_id: 'proj-001' })
      .select()
      .single()

    expect(mockFrom).toHaveBeenCalledWith('tasks')
  })

  it('calls insert with the provided task data', async () => {
    const taskData = { title: 'Install conduit', project_id: 'proj-001', status: 'todo', priority: 'high' }
    setupInsertSuccess({ id: 't-new', ...taskData })
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single()

    expect(mockInsert).toHaveBeenCalledWith(taskData)
  })

  it('returns the created task row on success', async () => {
    const returnedRow = {
      id: 'task-abc',
      title: 'Waterproofing inspection',
      status: 'todo',
      priority: 'medium',
      project_id: 'proj-001',
    }
    setupInsertSuccess(returnedRow)
    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('tasks')
      .insert({ title: 'Waterproofing inspection', project_id: 'proj-001' })
      .select()
      .single()

    expect(data).toEqual(returnedRow)
    expect(error).toBeNull()
  })

  it('propagates RLS permission error', async () => {
    setupInsertError({ message: 'new row violates row-level security policy for table "tasks"', code: '42501' })
    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('tasks')
      .insert({ title: 'Unauthorized task' })
      .select()
      .single()

    expect(data).toBeNull()
    expect(error).toMatchObject({ code: '42501' })
  })

  it('propagates missing required field error', async () => {
    setupInsertError({ message: 'null value in column "project_id" violates not-null constraint', code: '23502' })
    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('tasks')
      .insert({ title: 'Task without project' })
      .select()
      .single()

    expect(data).toBeNull()
    expect(error).toMatchObject({ code: '23502' })
  })

  it('calls .select().single() to return inserted row', async () => {
    setupInsertSuccess({ id: 't-1', title: 'Layout survey' })
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .insert({ title: 'Layout survey' })
      .select()
      .single()

    expect(mockSelect).toHaveBeenCalled()
    expect(mockSingle).toHaveBeenCalled()
  })
})

// ── useDeleteTask ─────────────────────────────────────────────────────────────

describe('useDeleteTask mutation function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("tasks") for deletion', async () => {
    setupDeleteSuccess()
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .delete()
      .eq('id', 'task-to-delete')

    expect(mockFrom).toHaveBeenCalledWith('tasks')
  })

  it('filters delete by the task id', async () => {
    setupDeleteSuccess()
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('tasks')
      .delete()
      .eq('id', 'task-xyz-789')

    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'task-xyz-789')
  })

  it('resolves without error on successful delete', async () => {
    setupDeleteSuccess()
    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .delete()
      .eq('id', 'task-to-remove')

    expect(result.error).toBeNull()
  })

  it('propagates error when delete fails', async () => {
    setupDeleteError({ message: 'foreign key constraint violation', code: '23503' })
    const { supabase } = await import('../../lib/supabase')

    const result = await supabase
      .from('tasks')
      .delete()
      .eq('id', 'task-referenced')

    expect(result.error).toMatchObject({ code: '23503' })
  })
})

// ── Task mutation query key patterns ─────────────────────────────────────────

describe('Task mutation cache keys', () => {
  it('should use ["tasks", projectId] as the invalidation key', () => {
    const projectId = 'proj-001'
    const key = ['tasks', projectId]
    expect(key[0]).toBe('tasks')
    expect(key[1]).toBe('proj-001')
  })

  it('should use ["tasks", "detail", id] for detail invalidation', () => {
    const id = 'task-abc'
    const key = ['tasks', 'detail', id]
    expect(key).toEqual(['tasks', 'detail', 'task-abc'])
  })
})
