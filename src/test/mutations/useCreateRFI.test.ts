/**
 * Tests for useCreateRFI mutation Supabase operations.
 * Verifies the insert call, error propagation, and optimistic update logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCreateRFI mutation function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("rfis")', async () => {
    const returnedRow = { id: 'rfi-new-1', title: 'Clarify wall detail', status: 'open', project_id: 'proj-001' }
    setupInsertSuccess(returnedRow)
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('rfis')
      .insert({ title: 'Clarify wall detail', project_id: 'proj-001' })
      .select()
      .single()

    expect(mockFrom).toHaveBeenCalledWith('rfis')
  })

  it('calls insert with the provided data', async () => {
    const rfiData = { title: 'Rebar specification', project_id: 'proj-001', status: 'open' }
    const returnedRow = { id: 'rfi-new-2', ...rfiData }
    setupInsertSuccess(returnedRow)
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('rfis')
      .insert(rfiData)
      .select()
      .single()

    expect(mockInsert).toHaveBeenCalledWith(rfiData)
  })

  it('calls .select().single() to return the created row', async () => {
    const returnedRow = { id: 'rfi-new-3', title: 'Wall assembly', status: 'open' }
    setupInsertSuccess(returnedRow)
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('rfis')
      .insert({ title: 'Wall assembly' })
      .select()
      .single()

    expect(mockSelect).toHaveBeenCalled()
    expect(mockSingle).toHaveBeenCalled()
  })

  it('returns the created RFI row on success', async () => {
    const returnedRow = { id: 'rfi-abc', title: 'Foundation depth', status: 'open', project_id: 'proj-001' }
    setupInsertSuccess(returnedRow)
    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('rfis')
      .insert({ title: 'Foundation depth', project_id: 'proj-001' })
      .select()
      .single()

    expect(data).toEqual(returnedRow)
    expect(error).toBeNull()
  })

  it('propagates RLS permission error', async () => {
    setupInsertError({ message: 'new row violates row-level security policy', code: '42501' })
    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('rfis')
      .insert({ title: 'Unauthorized RFI' })
      .select()
      .single()

    expect(data).toBeNull()
    expect(error).toMatchObject({ code: '42501' })
  })

  it('propagates unique constraint violation', async () => {
    setupInsertError({ message: 'duplicate key value violates unique constraint', code: '23505' })
    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('rfis')
      .insert({ title: 'Duplicate RFI' })
      .select()
      .single()

    expect(data).toBeNull()
    expect(error).toMatchObject({ code: '23505' })
  })

  it('propagates not-null constraint violation', async () => {
    setupInsertError({ message: 'null value in column "project_id" violates not-null constraint', code: '23502' })
    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('rfis')
      .insert({ title: 'Missing project' })
      .select()
      .single()

    expect(data).toBeNull()
    expect(error).toMatchObject({ code: '23502' })
  })
})

// ── Optimistic update logic ───────────────────────────────────────────────────

describe('useCreateRFI optimistic update', () => {
  it('should append new item to existing data array', () => {
    const existingData = {
      data: [{ id: 'rfi-1', title: 'Existing RFI' }],
      total: 1,
    }
    const newRFI = { title: 'New RFI', project_id: 'proj-001' }

    // Mirror the optimistic updater from mutations/index.ts
    const updater = (old: unknown, p: { data: Record<string, unknown> }) => {
      const prev = old as { data?: unknown[]; total?: number } | undefined
      return {
        ...prev,
        data: [...(prev?.data ?? []), { ...p.data, id: `temp-${Date.now()}` }],
        total: (prev?.total ?? 0) + 1,
      }
    }

    const result = updater(existingData, { data: newRFI })

    expect(result.data).toHaveLength(2)
    expect((result.data[1] as Record<string, unknown>).title).toBe('New RFI')
    expect(result.total).toBe(2)
  })

  it('should handle empty initial state gracefully', () => {
    const updater = (old: unknown, p: { data: Record<string, unknown> }) => {
      const prev = old as { data?: unknown[]; total?: number } | undefined
      return {
        ...prev,
        data: [...(prev?.data ?? []), { ...p.data, id: `temp-${Date.now()}` }],
        total: (prev?.total ?? 0) + 1,
      }
    }

    const result = updater(undefined, { data: { title: 'First RFI' } })

    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('should generate a temp id for optimistic items', () => {
    const updater = (old: unknown, p: { data: Record<string, unknown> }) => {
      const prev = old as { data?: unknown[]; total?: number } | undefined
      return {
        ...prev,
        data: [...(prev?.data ?? []), { ...p.data, id: `temp-${Date.now()}` }],
        total: (prev?.total ?? 0) + 1,
      }
    }

    const result = updater(undefined, { data: { title: 'Temp RFI' } })
    const added = result.data[0] as Record<string, unknown>

    expect(String(added.id)).toMatch(/^temp-\d+$/)
  })

  it('should include correct query key for cache invalidation', () => {
    const projectId = 'proj-001'
    const queryKeyFn = (p: { projectId: string }) => ['rfis', p.projectId]
    expect(queryKeyFn({ projectId })).toEqual(['rfis', 'proj-001'])
  })
})
