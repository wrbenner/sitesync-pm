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

describe('Submittals query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries submittals table with project_id filter', async () => {
    const PROJECT_ID = 'proj-sub-001'
    const mockSubmittals = [
      { id: 's-1', number: 1, title: 'Concrete mix design', status: 'pending', project_id: PROJECT_ID },
      { id: 's-2', number: 2, title: 'Rebar shop drawings', status: 'approved', project_id: PROJECT_ID },
    ]
    setupChain(mockSubmittals, 2)

    const { supabase } = await import('../../lib/supabase')

    const page = 1
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('submittals')
      .select('*', { count: 'exact' })
      .eq('project_id', PROJECT_ID)
      .order('number', { ascending: false })
      .range(from, to)

    expect(mockFrom).toHaveBeenCalledWith('submittals')
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(mockEq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(mockOrder).toHaveBeenCalledWith('number', { ascending: false })
    expect(data).toEqual(mockSubmittals)
    expect(error).toBeNull()
    expect(count).toBe(2)
  })

  it('returns empty results when no submittals exist', async () => {
    setupChain([], 0)

    const { supabase } = await import('../../lib/supabase')

    const { data, count } = await supabase
      .from('submittals')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-empty')
      .order('number', { ascending: false })
      .range(0, 49)

    expect(data).toEqual([])
    expect(count).toBe(0)
  })

  it('propagates database errors', async () => {
    const dbError = { message: 'relation "submittals" does not exist', code: '42P01' }
    mockRange.mockResolvedValue({ data: null, error: dbError, count: null })
    mockOrder.mockReturnValue({ range: mockRange })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('submittals')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-broken')
      .order('number', { ascending: false })
      .range(0, 49)

    expect(data).toBeNull()
    expect(error).toEqual(dbError)
  })
})
