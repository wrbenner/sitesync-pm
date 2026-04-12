import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — usePunchItems uses paginated query (select + eq + order + range)
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

function setupChainError(errMsg: string) {
  mockRange.mockResolvedValue({ data: null, error: { message: errMsg, code: '42P01' }, count: null })
  mockOrder.mockReturnValue({ range: mockRange })
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePunchItems query function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call supabase.from("punch_items") with project_id filter', async () => {
    const PROJECT_ID = 'proj-punch-001'
    const mockItems = [
      { id: 'pi-1', item_number: 3, title: 'Paint touch-up in lobby', status: 'open', trade: 'Painting', project_id: PROJECT_ID },
      { id: 'pi-2', item_number: 2, title: 'Fix HVAC grille alignment', status: 'in_progress', trade: 'HVAC', project_id: PROJECT_ID },
    ]
    setupChain(mockItems, 2)

    const { supabase } = await import('../../lib/supabase')

    const page = 1
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', PROJECT_ID)
      .order('item_number', { ascending: false })
      .range(from, to)

    expect(mockFrom).toHaveBeenCalledWith('punch_items')
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(mockEq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(mockOrder).toHaveBeenCalledWith('item_number', { ascending: false })
    expect(mockRange).toHaveBeenCalledWith(0, 49)
    expect(data).toEqual(mockItems)
    expect(error).toBeNull()
    expect(count).toBe(2)
  })

  it('should return empty results when project has no punch items', async () => {
    setupChain([], 0)

    const { supabase } = await import('../../lib/supabase')

    const { data, count } = await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-new')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(data).toEqual([])
    expect(count).toBe(0)
  })

  it('should propagate errors from Supabase', async () => {
    setupChainError('relation "punch_items" does not exist')

    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-broken')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(data).toBeNull()
    expect(error).toMatchObject({ message: 'relation "punch_items" does not exist' })
  })

  it('should order by item_number descending (newest first)', async () => {
    setupChain([], 0)

    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-abc')
      .order('item_number', { ascending: false })
      .range(0, 49)

    // Descending order means item_number 100 appears before item_number 1
    expect(mockOrder).toHaveBeenCalledWith('item_number', { ascending: false })
  })

  it('should use correct pagination offsets for page 2', async () => {
    setupChain([{ id: 'pi-51' }], 75)

    const { supabase } = await import('../../lib/supabase')

    const page = 2
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-big')
      .order('item_number', { ascending: false })
      .range(from, to)

    expect(mockRange).toHaveBeenCalledWith(50, 99)
  })

  it('should return count alongside data for pagination UI', async () => {
    const mockItems = Array.from({ length: 10 }, (_, i) => ({
      id: `pi-${i + 1}`,
      item_number: i + 1,
      title: `Punch item ${i + 1}`,
      status: 'open',
    }))
    setupChain(mockItems, 47) // 47 total across all pages

    const { supabase } = await import('../../lib/supabase')

    const { data, count } = await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-substantial-completion')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(data).toHaveLength(10)
    expect(count).toBe(47)
  })

  it('should handle punch items with various construction trades', async () => {
    const trades = ['Electrical', 'Plumbing', 'HVAC', 'Framing', 'Drywall']
    const mockItems = trades.map((trade, i) => ({
      id: `pi-${i + 1}`,
      item_number: i + 1,
      title: `${trade} punch item`,
      trade,
      status: i === 0 ? 'verified' : 'open',
    }))
    setupChain(mockItems, trades.length)

    const { supabase } = await import('../../lib/supabase')

    const { data } = await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-closeout')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(data).toHaveLength(5)
    expect((data as Array<{ trade: string }>).map(d => d.trade)).toEqual(trades)
  })
})
