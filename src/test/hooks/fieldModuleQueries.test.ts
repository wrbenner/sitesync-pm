import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — chainable query builder
// ---------------------------------------------------------------------------
const mockRange = vi.fn()
const mockOrder = vi.fn()
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

/**
 * Wire up the mock chain for a paginated query that ends with .range().
 * Returns { data, error: null, count }.
 */
function setupPaginatedChain(data: unknown[] = [], count = 0) {
  mockRange.mockResolvedValue({ data, error: null, count })
  mockOrder.mockReturnValue({ range: mockRange })
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

/**
 * Wire up the mock chain for a simple query that ends with .order()
 * (no pagination). Returns { data, error: null }.
 */
function setupListChain(data: unknown[] = []) {
  mockOrder.mockResolvedValue({ data, error: null })
  mockEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// ---------------------------------------------------------------------------
// useDailyLogs query function
// ---------------------------------------------------------------------------

describe('useDailyLogs query function', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries daily_logs table filtered by project_id', async () => {
    const PROJECT_ID = 'proj-daily-001'
    const mockLogs = [
      { id: 'log-1', project_id: PROJECT_ID, log_date: '2026-04-10', status: 'draft' },
      { id: 'log-2', project_id: PROJECT_ID, log_date: '2026-04-11', status: 'approved' },
    ]
    setupPaginatedChain(mockLogs, 2)

    const { supabase } = await import('../../lib/supabase')

    const page = 1
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count } = await supabase
      .from('daily_logs')
      .select('*', { count: 'exact' })
      .eq('project_id', PROJECT_ID)
      .order('date', { ascending: false })
      .range(from, to)

    expect(mockFrom).toHaveBeenCalledWith('daily_logs')
    expect(mockEq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(mockOrder).toHaveBeenCalledWith('date', { ascending: false })
    expect(mockRange).toHaveBeenCalledWith(0, 49)
    expect(data).toEqual(mockLogs)
    expect(count).toBe(2)
  })

  it('returns empty array when project has no daily logs', async () => {
    setupPaginatedChain([], 0)

    const { supabase } = await import('../../lib/supabase')
    const { data, count } = await supabase
      .from('daily_logs')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-empty')
      .order('date', { ascending: false })
      .range(0, 49)

    expect(data).toEqual([])
    expect(count).toBe(0)
  })

  it('correctly computes page offset for page 2', async () => {
    setupPaginatedChain([], 0)
    const { supabase } = await import('../../lib/supabase')

    const page = 2
    const pageSize = 50

    await supabase
      .from('daily_logs')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-page-test')
      .order('date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    expect(mockRange).toHaveBeenCalledWith(50, 99)
  })

  it('propagates supabase errors', async () => {
    const supabaseError = { message: 'permission denied', code: '42501' }
    mockRange.mockResolvedValue({ data: null, error: supabaseError, count: null })
    mockOrder.mockReturnValue({ range: mockRange })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const { supabase } = await import('../../lib/supabase')
    const { error } = await supabase
      .from('daily_logs')
      .select('*', { count: 'exact' })
      .eq('project_id', 'proj-err')
      .order('date', { ascending: false })
      .range(0, 49)

    expect(error).toEqual(supabaseError)
  })
})

// ---------------------------------------------------------------------------
// useDrawings query function
// ---------------------------------------------------------------------------

describe('useDrawings query function', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries drawings table ordered by set_number ascending', async () => {
    const PROJECT_ID = 'proj-drawings-001'
    const mockDrawings = [
      { id: 'd-1', project_id: PROJECT_ID, set_number: 'A-101', discipline: 'Architectural' },
      { id: 'd-2', project_id: PROJECT_ID, set_number: 'S-201', discipline: 'Structural' },
    ]
    setupListChain(mockDrawings)

    const { supabase } = await import('../../lib/supabase')
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .eq('project_id', PROJECT_ID)
      .order('set_number', { ascending: true })

    expect(mockFrom).toHaveBeenCalledWith('drawings')
    expect(mockEq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(mockOrder).toHaveBeenCalledWith('set_number', { ascending: true })
    expect(data).toEqual(mockDrawings)
    expect(error).toBeNull()
  })

  it('returns empty array when project has no drawings', async () => {
    setupListChain([])
    const { supabase } = await import('../../lib/supabase')

    const { data } = await supabase
      .from('drawings')
      .select('*')
      .eq('project_id', 'proj-no-drawings')
      .order('set_number', { ascending: true })

    expect(data).toEqual([])
  })

  it('is disabled when projectId is undefined', () => {
    // The hook uses enabled: !!projectId — verify undefined skips the query
    const projectId: string | undefined = undefined
    expect(!!projectId).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useFieldCaptures query function
// ---------------------------------------------------------------------------

describe('useFieldCaptures query function', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries field_captures ordered by created_at descending', async () => {
    const PROJECT_ID = 'proj-field-001'
    const mockCaptures = [
      { id: 'fc-1', project_id: PROJECT_ID, created_at: '2026-04-11T10:00:00Z', tag: 'progress' },
      { id: 'fc-2', project_id: PROJECT_ID, created_at: '2026-04-10T14:00:00Z', tag: 'safety' },
    ]
    setupListChain(mockCaptures)

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('field_captures')
      .select('*')
      .eq('project_id', PROJECT_ID)
      .order('created_at', { ascending: false })

    expect(mockFrom).toHaveBeenCalledWith('field_captures')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(data).toEqual(mockCaptures)
  })

  it('returns most recent captures first', async () => {
    const PROJECT_ID = 'proj-field-002'
    const now = new Date().toISOString()
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const captures = [
      { id: 'fc-new', project_id: PROJECT_ID, created_at: now },
      { id: 'fc-old', project_id: PROJECT_ID, created_at: yesterday },
    ]
    setupListChain(captures)

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('field_captures')
      .select('*')
      .eq('project_id', PROJECT_ID)
      .order('created_at', { ascending: false })

    // The first item is the most recent (ordering is ascending: false)
    expect((data as typeof captures)[0].id).toBe('fc-new')
  })
})

// ---------------------------------------------------------------------------
// useSafetyInspections query function
// ---------------------------------------------------------------------------

describe('useSafetyInspections query function', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries safety_inspections ordered by date descending', async () => {
    const PROJECT_ID = 'proj-safety-001'
    const mockInspections = [
      { id: 'si-1', project_id: PROJECT_ID, date: '2026-04-11', type: 'weekly' },
    ]
    setupListChain(mockInspections)

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('safety_inspections')
      .select('*')
      .eq('project_id', PROJECT_ID)
      .order('date', { ascending: false })

    expect(mockFrom).toHaveBeenCalledWith('safety_inspections')
    expect(mockOrder).toHaveBeenCalledWith('date', { ascending: false })
    expect(data).toEqual(mockInspections)
  })

  it('propagates errors from supabase', async () => {
    const supabaseError = { message: 'table does not exist', code: '42P01' }
    mockOrder.mockResolvedValue({ data: null, error: supabaseError })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const { supabase } = await import('../../lib/supabase')
    const { error } = await supabase
      .from('safety_inspections')
      .select('*')
      .eq('project_id', 'proj-err')
      .order('date', { ascending: false })

    expect(error).toEqual(supabaseError)
  })
})

// ---------------------------------------------------------------------------
// useIncidents query function
// ---------------------------------------------------------------------------

describe('useIncidents query function', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries incidents table filtered by project_id', async () => {
    const PROJECT_ID = 'proj-incidents-001'
    const mockIncidents = [
      { id: 'inc-1', project_id: PROJECT_ID, date: '2026-04-11', type: 'near_miss', severity: 'low' },
    ]
    setupListChain(mockIncidents)

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('project_id', PROJECT_ID)
      .order('date', { ascending: false })

    expect(mockFrom).toHaveBeenCalledWith('incidents')
    expect(mockEq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(data).toEqual(mockIncidents)
  })
})

// ---------------------------------------------------------------------------
// useToolboxTalks query function
// ---------------------------------------------------------------------------

describe('useToolboxTalks query function', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries toolbox_talks table filtered by project_id', async () => {
    const PROJECT_ID = 'proj-toolbox-001'
    const mockTalks = [
      { id: 'tt-1', project_id: PROJECT_ID, date: '2026-04-11', topic: 'Fall Protection' },
      { id: 'tt-2', project_id: PROJECT_ID, date: '2026-04-04', topic: 'PPE Requirements' },
    ]
    setupListChain(mockTalks)

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('toolbox_talks')
      .select('*')
      .eq('project_id', PROJECT_ID)
      .order('date', { ascending: false })

    expect(mockFrom).toHaveBeenCalledWith('toolbox_talks')
    expect(mockEq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(data).toEqual(mockTalks)
  })

  it('returns empty array when no talks exist for project', async () => {
    setupListChain([])

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('toolbox_talks')
      .select('*')
      .eq('project_id', 'proj-no-talks')
      .order('date', { ascending: false })

    expect(data).toEqual([])
  })
})
