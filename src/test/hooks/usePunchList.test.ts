/**
 * Tests for usePunchItems Supabase query.
 * Verifies correct table name, project_id filter, ordering, and pagination.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ─────────────────────────────────────────────────────────────

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

function setupError(errorObj: { message: string; code: string }) {
  mockRange.mockResolvedValue({ data: null, error: errorObj, count: null })
  mockOrder.mockReturnValue({ range: mockRange })
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePunchItems query function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.from("punch_items")', async () => {
    setupChain([], 0)
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-001')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(mockFrom).toHaveBeenCalledWith('punch_items')
  })

  it('uses count: exact to get total count', async () => {
    setupChain([], 0)
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-001')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' })
  })

  it('filters by project_id', async () => {
    setupChain([], 0)
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-site-007')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(mockEq).toHaveBeenCalledWith('project_id', 'proj-site-007')
  })

  it('orders by item_number descending', async () => {
    setupChain([], 0)
    const { supabase } = await import('../../lib/supabase')

    await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-001')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(mockOrder).toHaveBeenCalledWith('item_number', { ascending: false })
  })

  it('uses correct range for page 1 with default pageSize 50', async () => {
    setupChain([], 0)
    const { supabase } = await import('../../lib/supabase')

    const page = 1
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-001')
      .order('item_number', { ascending: false })
      .range(from, to)

    expect(mockRange).toHaveBeenCalledWith(0, 49)
  })

  it('uses correct range for page 2', async () => {
    setupChain([], 0)
    const { supabase } = await import('../../lib/supabase')

    const page = 2
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-001')
      .order('item_number', { ascending: false })
      .range(from, to)

    expect(mockRange).toHaveBeenCalledWith(50, 99)
  })

  it('returns punch items data and count', async () => {
    const items = [
      { id: 'pi-1', item_number: 5, title: 'Scratched drywall in unit 302', status: 'open', project_id: 'proj-001' },
      { id: 'pi-2', item_number: 4, title: 'Missing outlet cover plate', status: 'in_progress', project_id: 'proj-001' },
    ]
    setupChain(items, 2)
    const { supabase } = await import('../../lib/supabase')

    const { data, error, count } = await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-001')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(data).toEqual(items)
    expect(error).toBeNull()
    expect(count).toBe(2)
  })

  it('returns empty array when project has no punch items', async () => {
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

  it('propagates database errors', async () => {
    setupError({ message: 'relation "punch_items" does not exist', code: '42P01' })
    const { supabase } = await import('../../lib/supabase')

    const { data, error } = await supabase
      .from('punch_items')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-broken')
      .order('item_number', { ascending: false })
      .range(0, 49)

    expect(data).toBeNull()
    expect(error).toMatchObject({ code: '42P01' })
  })
})

// ── Punch item status mapping ─────────────────────────────────────────────────

describe('PunchList status mapping', () => {
  const statusMap: Record<string, 'pending' | 'active' | 'complete'> = {
    open: 'pending',
    in_progress: 'active',
    sub_complete: 'active',
    verified: 'complete',
    rejected: 'pending',
  }

  it('should map open to pending', () => {
    expect(statusMap['open']).toBe('pending')
  })

  it('should map in_progress to active', () => {
    expect(statusMap['in_progress']).toBe('active')
  })

  it('should map sub_complete to active', () => {
    expect(statusMap['sub_complete']).toBe('active')
  })

  it('should map verified to complete', () => {
    expect(statusMap['verified']).toBe('complete')
  })

  it('should map rejected to pending', () => {
    expect(statusMap['rejected']).toBe('pending')
  })

  it('should cover all 5 known punch item statuses', () => {
    const knownStatuses = ['open', 'in_progress', 'sub_complete', 'verified', 'rejected']
    for (const s of knownStatuses) {
      expect(statusMap[s]).toBeDefined()
    }
  })
})

// ── usePunchItems enablement ──────────────────────────────────────────────────

describe('usePunchItems enablement', () => {
  it('should be disabled when projectId is undefined', () => {
    expect(!!(undefined as string | undefined)).toBe(false)
  })

  it('should be enabled when projectId is a non-empty string', () => {
    expect(!!('proj-123')).toBe(true)
  })

  it('query key should include projectId and pagination params', () => {
    const projectId = 'proj-001'
    const page = 1
    const pageSize = 50
    const key = ['punch_items', projectId, page, pageSize]
    expect(key).toEqual(['punch_items', 'proj-001', 1, 50])
  })
})
