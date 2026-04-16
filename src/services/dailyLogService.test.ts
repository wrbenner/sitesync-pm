import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSession, mockSingle, mockMaybeSingle, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
}))

vi.mock('../lib/weather', () => ({
  fetchWeatherForProject: vi.fn(),
}))

import { fetchWeatherForProject } from '../lib/weather'
const mockFetchWeather = fetchWeatherForProject as ReturnType<typeof vi.fn>

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = mockSingle
  chain.maybeSingle = mockMaybeSingle
  Object.assign(chain, overrides)
  return chain
}

describe('dailyLogService.loadTodayLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns existing log when one exists for today', async () => {
    const existingLog = { id: 'log-1', project_id: 'proj-1', status: 'draft' }
    mockMaybeSingle.mockResolvedValue({ data: existingLog, error: null })
    mockFrom.mockReturnValue(makeChain())
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.loadTodayLog('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(existingLog)
  })

  it('creates a new log with weather when none exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    mockFetchWeather.mockResolvedValue({
      conditions: 'Partly Cloudy',
      temperature_high: 75,
      temperature_low: 58,
      wind_speed: 12,
      precipitation_probability: 20,
      weather_source: 'NWS',
    })

    const newLog = { id: 'log-new', project_id: 'proj-1', status: 'draft' }
    mockSingle.mockResolvedValue({ data: newLog, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // maybeSingle query for existing
        return chain
      }
      // insert new log
      ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
      ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
      return chain
    })

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.loadTodayLog('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(newLog)
  })

  it('creates log without weather when weather fetch fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    mockFetchWeather.mockRejectedValue(new Error('network error'))

    const newLog = { id: 'log-no-weather', status: 'draft' }
    mockSingle.mockResolvedValue({ data: newLog, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount > 1) {
        ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
      }
      return chain
    })

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.loadTodayLog('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(newLog)
  })

  it('returns error when existing log fetch fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'db error' } })
    mockFrom.mockReturnValue(makeChain())

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.loadTodayLog('proj-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('db error')
  })
})

describe('dailyLogService.addCapture', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a crew capture entry', async () => {
    const entry = { id: 'entry-1', type: 'crew', daily_log_id: 'log-1' }
    mockSingle.mockResolvedValue({ data: entry, error: null })
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.addCapture('log-1', 'crew', {
      trade: 'Concrete',
      company: 'ABC Concrete',
      headcount: 8,
      hours: 8,
    })

    expect(result.error).toBeNull()
    expect(result.data).toEqual(entry)
    expect(mockFrom).toHaveBeenCalledWith('daily_log_entries')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'crew', daily_log_id: 'log-1', headcount: 8 }),
    )
  })

  it('maps photoUrl to photos array', async () => {
    const entry = { id: 'entry-2', type: 'photo' }
    mockSingle.mockResolvedValue({ data: entry, error: null })
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const { dailyLogService } = await import('./dailyLogService')
    await dailyLogService.addCapture('log-1', 'photo', { photoUrl: 'https://example.com/photo.jpg' })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ photos: ['https://example.com/photo.jpg'] }),
    )
  })

  it('returns error on insert failure', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'insert blocked' } })
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.addCapture('log-1', 'safety', { description: 'Near miss' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('insert blocked')
  })
})

describe('dailyLogService.compileLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('compiles log with weather, crew, and visitor entries', async () => {
    const log = {
      id: 'log-1',
      log_date: '2026-04-16',
      weather: 'Clear',
      temperature_high: 80,
      temperature_low: 60,
      wind_speed: '10 mph',
      precipitation: '5%',
    }
    const entries = [
      { id: 'e-1', type: 'crew', company: 'Steel Co', headcount: 5, hours: 8, trade: null, description: null },
      { id: 'e-2', type: 'visitor', inspector_name: 'John Smith', time_in: '2026-04-16T09:00:00', time_out: null, company: null, description: 'Inspection' },
      { id: 'e-3', type: 'note', description: 'Poured slab on Level 3', company: null, trade: null, headcount: null, hours: null },
    ]

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        mockSingle.mockResolvedValueOnce({ data: log, error: null })
        return chain
      }
      const chain = makeChain()
      ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: entries, error: null })
      return chain
    })

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.compileLog('log-1')

    expect(result.error).toBeNull()
    expect(result.data!.weather).toContain('Clear')
    expect(result.data!.workforce).toContain('5 workers')
    expect(result.data!.visitors).toContain('John Smith')
    expect(result.data!.activities).toContain('Poured slab')
    expect(result.data!.narrative).toContain('Daily Construction Log')
  })

  it('returns default messages when no entries exist', async () => {
    const log = { id: 'log-2', log_date: '2026-04-16', weather: null, temperature_high: null, temperature_low: null, wind_speed: null, precipitation: null }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        mockSingle.mockResolvedValueOnce({ data: log, error: null })
        return chain
      }
      const chain = makeChain()
      ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null })
      return chain
    })

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.compileLog('log-2')

    expect(result.data!.weather).toBe('Weather data not available.')
    expect(result.data!.workforce).toBe('No workforce entries recorded.')
    expect(result.data!.activities).toBe('No activity entries recorded.')
    expect(result.data!.safety).toContain('No safety incidents')
    expect(result.data!.photos).toBe('No photos captured.')
  })
})

describe('dailyLogService.approveLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets approved, approved_by, and approved_at', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'super-1' } } } })
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.approveLog('log-1')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', approved: true, approved_by: 'super-1', approved_at: expect.any(String) }),
    )
  })
})

describe('dailyLogService.listLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns logs ordered by date descending', async () => {
    const logs = [{ id: 'log-2', log_date: '2026-04-16' }, { id: 'log-1', log_date: '2026-04-15' }]
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: logs, error: null })
    mockFrom.mockReturnValue(chain)

    const { dailyLogService } = await import('./dailyLogService')
    const result = await dailyLogService.listLogs('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(logs)
    expect(chain.order).toHaveBeenCalledWith('log_date', { ascending: false })
  })
})
