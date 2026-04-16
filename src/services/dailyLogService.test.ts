import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSession, mockSingle, mockMaybeSingle, mockFrom, mockFetchWeather } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockFrom: vi.fn(),
  mockFetchWeather: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
}))

vi.mock('../lib/weather', () => ({
  fetchWeatherForProject: mockFetchWeather,
}))

import { dailyLogService } from './dailyLogService'

const TODAY = new Date().toISOString().split('T')[0]

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  }
  for (const key of ['select', 'eq', 'insert', 'update', 'order']) {
    chain[key].mockReturnValue(chain)
  }
  return chain
}

function session(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

describe('dailyLogService.loadTodayLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns existing log when one exists for today', async () => {
    const existingLog = { id: 'log-1', project_id: 'proj-1', log_date: TODAY, status: 'draft' }
    mockMaybeSingle.mockResolvedValue({ data: existingLog, error: null })
    mockFrom.mockReturnValue(makeChain())

    const result = await dailyLogService.loadTodayLog('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ id: 'log-1', log_date: TODAY })
  })

  it('creates new log with weather when no log exists for today', async () => {
    session('u-1')
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockFetchWeather.mockResolvedValue({
      conditions: 'Partly Cloudy',
      temperature_high: 78,
      temperature_low: 62,
      wind_speed: 10,
      precipitation_probability: 20,
      weather_source: 'api',
      weather_fetched_at: new Date().toISOString(),
    })

    const newLog = { id: 'log-new', project_id: 'proj-1', log_date: TODAY, status: 'draft' }
    mockSingle.mockResolvedValue({ data: newLog, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) return chain
      return chain
    })

    const result = await dailyLogService.loadTodayLog('proj-1')

    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('log-new')
    expect(mockFetchWeather).toHaveBeenCalledWith('proj-1')
  })

  it('creates log without weather when weather fetch fails', async () => {
    session('u-1')
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockFetchWeather.mockRejectedValue(new Error('Weather API unavailable'))
    const newLog = { id: 'log-new', project_id: 'proj-1', log_date: TODAY, status: 'draft' }
    mockSingle.mockResolvedValue({ data: newLog, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      return makeChain()
    })

    const result = await dailyLogService.loadTodayLog('proj-1')

    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('log-new')
  })

  it('returns error on db failure', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'connection timeout' } })
    mockFrom.mockReturnValue(makeChain())

    const result = await dailyLogService.loadTodayLog('proj-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('connection timeout')
  })
})

describe('dailyLogService.addCapture', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a crew entry and returns it', async () => {
    const entry = { id: 'e-1', type: 'crew', headcount: 5 }
    mockSingle.mockResolvedValue({ data: entry, error: null })
    mockFrom.mockReturnValue(makeChain())

    const result = await dailyLogService.addCapture('log-1', 'crew', {
      trade: 'Electrician',
      company: 'Sparks LLC',
      headcount: 5,
      hours: 8,
    })

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ id: 'e-1', type: 'crew' })
  })

  it('returns error on insert failure', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'insert error' } })
    mockFrom.mockReturnValue(makeChain())

    const result = await dailyLogService.addCapture('log-1', 'safety', { description: 'Near miss' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('insert error')
  })

  it('uses photoUrl as photos array', async () => {
    const entry = { id: 'e-2', type: 'photo' }
    mockSingle.mockResolvedValue({ data: entry, error: null })
    const chain = makeChain()
    mockFrom.mockReturnValue(chain)

    await dailyLogService.addCapture('log-1', 'photo', { photoUrl: 'https://cdn.example.com/img.jpg' })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ photos: ['https://cdn.example.com/img.jpg'] })
    )
  })
})

describe('dailyLogService.compileLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('compiles log with all entry types', async () => {
    const log = {
      id: 'log-1',
      log_date: '2026-04-16',
      weather: 'Sunny',
      temperature_high: 80,
      temperature_low: 65,
      wind_speed: '8 mph',
      precipitation: '10%',
    }
    const entries = [
      { id: 'e-1', type: 'crew', company: 'Steel Co', headcount: 10, hours: 8, description: null, trade: null, inspector_name: null, time_in: null, time_out: null, inspection_result: null },
      { id: 'e-2', type: 'safety', description: 'Safety briefing conducted', company: null, headcount: null, hours: null, inspector_name: null, time_in: null, time_out: null, inspection_result: null },
      { id: 'e-3', type: 'visitor', company: 'Owner LLC', inspector_name: 'John Smith', time_in: '2026-04-16T09:00:00', time_out: '2026-04-16T10:00:00', description: null, headcount: null, hours: null, inspection_result: null },
      { id: 'e-4', type: 'photo', description: null, company: null, headcount: null, hours: null, inspector_name: null, time_in: null, time_out: null, inspection_result: null },
      { id: 'e-5', type: 'note', description: 'Concrete pour on Level 3', company: null, headcount: null, hours: null, inspector_name: null, time_in: null, time_out: null, inspection_result: null },
    ]

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain()
      if (table === 'daily_logs') {
        mockSingle.mockResolvedValueOnce({ data: log, error: null })
        return chain
      }
      chain.order.mockResolvedValue({ data: entries, error: null })
      return chain
    })

    const result = await dailyLogService.compileLog('log-1')

    expect(result.error).toBeNull()
    expect(result.data?.weather).toContain('Sunny')
    expect(result.data?.workforce).toContain('10 workers')
    expect(result.data?.safety).toContain('Safety briefing')
    expect(result.data?.visitors).toContain('John Smith')
    expect(result.data?.photos).toContain('1 photo')
    expect(result.data?.activities).toContain('Concrete pour')
    expect(result.data?.narrative).toContain('Daily Construction Log')
  })

  it('uses default text when entries are empty', async () => {
    const log = { id: 'log-1', log_date: '2026-04-16', weather: null, temperature_high: null, temperature_low: null, wind_speed: null, precipitation: null }

    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain()
      if (table === 'daily_logs') {
        mockSingle.mockResolvedValueOnce({ data: log, error: null })
        return chain
      }
      chain.order.mockResolvedValue({ data: [], error: null })
      return chain
    })

    const result = await dailyLogService.compileLog('log-1')

    expect(result.error).toBeNull()
    expect(result.data?.weather).toBe('Weather data not available.')
    expect(result.data?.workforce).toBe('No workforce entries recorded.')
    expect(result.data?.visitors).toBe('No visitors recorded.')
    expect(result.data?.photos).toBe('No photos captured.')
    expect(result.data?.safety).toContain('No safety incidents')
  })

  it('returns error when log fetch fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain()
      if (table === 'daily_logs') {
        mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
        return chain
      }
      chain.order.mockResolvedValue({ data: [], error: null })
      return chain
    })

    const result = await dailyLogService.compileLog('log-missing')

    expect(result.data).toBeNull()
    expect(result.error).toBe('not found')
  })
})

describe('dailyLogService.approveLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks log as approved with user and timestamp', async () => {
    session('u-approver')
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await dailyLogService.approveLog('log-1')

    expect(result.error).toBeNull()
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', approved: true, approved_by: 'u-approver' })
    )
  })

  it('returns error on failure', async () => {
    session('u-1')
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: { message: 'permission denied' } })
    mockFrom.mockReturnValue(chain)

    const result = await dailyLogService.approveLog('log-1')

    expect(result.error).toBe('permission denied')
  })
})

describe('dailyLogService.listLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns logs ordered by date descending', async () => {
    const logs = [
      { id: 'log-2', log_date: '2026-04-16' },
      { id: 'log-1', log_date: '2026-04-15' },
    ]
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: logs, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await dailyLogService.listLogs('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(chain.order).toHaveBeenCalledWith('log_date', { ascending: false })
  })

  it('returns error on failure', async () => {
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: null, error: { message: 'db error' } })
    mockFrom.mockReturnValue(chain)

    const result = await dailyLogService.listLogs('proj-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('db error')
  })
})

describe('dailyLogService.updateStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates status field', async () => {
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await dailyLogService.updateStatus('log-1', 'submitted')

    expect(result.error).toBeNull()
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted' })
    )
  })
})

describe('dailyLogService.loadEntries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all entries for a log', async () => {
    const entries = [{ id: 'e-1', type: 'crew' }, { id: 'e-2', type: 'note' }]
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: entries, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await dailyLogService.loadEntries('log-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(mockFrom).toHaveBeenCalledWith('daily_log_entries')
  })

  it('returns empty array when no entries exist', async () => {
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await dailyLogService.loadEntries('log-empty')

    expect(result.data).toEqual([])
  })
})
