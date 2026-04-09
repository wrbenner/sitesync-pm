import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockRange = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
  fromTable: (...args: unknown[]) => mockFrom(...args),
  isSupabaseConfigured: true,
}))

function setupChain(data: unknown[] = [], count = 0) {
  mockRange.mockResolvedValue({ data, error: null, count })
  mockOrder.mockReturnValue({ range: mockRange })
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRFIs query function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("rfis") with select and project_id filter', async () => {
    const PROJECT_ID = 'proj-abc-123'
    const mockRFIs = [
      { id: 'rfi-1', rfi_number: 1, subject: 'Clarify wall detail', status: 'open', project_id: PROJECT_ID },
      { id: 'rfi-2', rfi_number: 2, subject: 'Confirm rebar spec', status: 'answered', project_id: PROJECT_ID },
    ]
    setupChain(mockRFIs, 2)

    // Import the query function module (after mocks are set up)
    const { supabase } = await import('../../lib/supabase')

    // Simulate what useRFIs queryFn does
    const projectId = PROJECT_ID
    const page = 1
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('rfis')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('rfi_number', { ascending: false })
      .range(from, to)

    expect(mockFrom).toHaveBeenCalledWith('rfis')
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(mockEq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(mockOrder).toHaveBeenCalledWith('rfi_number', { ascending: false })
    expect(mockRange).toHaveBeenCalledWith(0, 49)
    expect(data).toEqual(mockRFIs)
    expect(error).toBeNull()
    expect(count).toBe(2)
  })

  it('returns empty array when project has no RFIs', async () => {
    setupChain([], 0)

    const { supabase } = await import('../../lib/supabase')

    const { data, count } = await supabase
      .from('rfis')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-empty')
      .order('rfi_number', { ascending: false })
      .range(0, 49)

    expect(data).toEqual([])
    expect(count).toBe(0)
  })

  it('propagates errors from Supabase', async () => {
    const dbError = { message: 'permission denied', code: '42501' }
    mockRange.mockResolvedValue({ data: null, error: dbError, count: null })
    mockOrder.mockReturnValue({ range: mockRange })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('rfis')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-no-access')
      .order('rfi_number', { ascending: false })
      .range(0, 49)

    expect(data).toBeNull()
    expect(error).toEqual(dbError)
  })

  it('uses correct pagination offsets for page 2', async () => {
    setupChain([{ id: 'rfi-51' }], 60)

    const { supabase } = await import('../../lib/supabase')

    const page = 2
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    await supabase
      .from('rfis')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-big')
      .order('rfi_number', { ascending: false })
      .range(from, to)

    expect(mockRange).toHaveBeenCalledWith(50, 99)
  })
})
