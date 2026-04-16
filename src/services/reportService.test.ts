import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockFunctionsInvoke = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: vi.fn() },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

import {
  generateOwnerReport,
  generateNarrative,
  getProgressPhotos,
  exportPDF,
} from './reportService'

// ---------------------------------------------------------------------------
// Chain builder
// ---------------------------------------------------------------------------
function makeChain(
  listData: unknown[] | null = [],
  error: { message: string } | null = null,
  singleData?: unknown,
) {
  const singleResult = { data: singleData ?? (Array.isArray(listData) && listData.length > 0 ? listData[0] : null), error }
  const listResult = { data: listData, error }

  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.lte = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Test data fixtures
// ---------------------------------------------------------------------------
const PROJECT = {
  id: 'proj-1',
  name: 'City Hall Renovation',
  address: '123 Main St, Springfield',
  health_status: 'on_track',
  percent_complete: 45,
}

const PHASES = [
  {
    id: 'ph-1',
    name: 'Foundation',
    status: 'complete',
    percent_complete: 100,
    start_date: '2026-01-01',
    end_date: '2026-02-28',
  },
  {
    id: 'ph-2',
    name: 'Structural Steel',
    status: 'in_progress',
    percent_complete: 60,
    start_date: '2026-03-01',
    end_date: '2026-05-30',
  },
]

const BUDGET_ITEMS = [
  { original_amount: 500_000, committed_amount: 480_000, actual_amount: 300_000 },
  { original_amount: 200_000, committed_amount: 190_000, actual_amount: 120_000 },
]

const CHANGE_ORDERS = [
  { number: 1, title: 'Additional Excavation', description: '', amount: 25_000, status: 'approved' },
  { number: 2, title: 'Structural Change', description: '', amount: 15_000, status: 'draft' },
]

const RFIS = [
  { id: 'rfi-1', rfi_number: 1, status: 'open', due_date: '2026-04-01' }, // overdue
  { id: 'rfi-2', rfi_number: 2, status: 'open', due_date: '2026-06-01' }, // not overdue
]

const SUBMITTALS = [
  { id: 'sub-1', status: 'submitted', created_at: '2026-03-01T00:00:00Z' }, // stalled (>14 days old)
]

const PHOTOS = [
  { id: 'photo-1', photo_url: 'https://cdn.test/1.jpg', notes: 'Foundation pour', captured_at: '2026-02-15T00:00:00Z', location: 'Level 1' },
]

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------
function setupFromMock(overrides: Record<string, unknown[]> = {}) {
  const tables: Record<string, unknown[]> = {
    projects: [PROJECT],
    schedule_phases: PHASES,
    budget_items: BUDGET_ITEMS,
    change_orders: CHANGE_ORDERS,
    rfis: RFIS,
    submittals: SUBMITTALS,
    field_captures: PHOTOS,
    ...overrides,
  }

  mockFrom.mockImplementation((table: string) => {
    const data = tables[table] ?? []
    return makeChain(data, null, data[0] ?? null)
  })
}

describe('generateOwnerReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a complete report with all sections populated', async () => {
    setupFromMock()
    mockFunctionsInvoke.mockResolvedValue({ data: { narrative: 'AI generated narrative' }, error: null })

    const report = await generateOwnerReport('proj-1')

    expect(report.projectName).toBe('City Hall Renovation')
    expect(report.percentComplete).toBe(45)
    expect(report.overallStatus).toBe('on_track')
    expect(report.scheduleSummary.completedPhases).toBe(1)
    expect(report.scheduleSummary.inProgressPhases).toBe(1)
    expect(report.scheduleSummary.totalPhases).toBe(2)
    expect(report.budgetSummary.originalContract).toBe(700_000)
    expect(report.budgetSummary.approvedChanges).toBe(25_000) // only approved
    expect(report.budgetSummary.currentContract).toBe(725_000)
    expect(report.progressPhotos).toHaveLength(1)
    expect(report.narrative).toBe('AI generated narrative')
  })

  it('returns empty sections when project has no data', async () => {
    setupFromMock({
      schedule_phases: [],
      budget_items: [],
      change_orders: [],
      rfis: [],
      submittals: [],
      field_captures: [],
    })
    mockFunctionsInvoke.mockResolvedValue({ data: { narrative: 'Empty project narrative' }, error: null })

    const report = await generateOwnerReport('proj-1')

    expect(report.scheduleSummary.totalPhases).toBe(0)
    expect(report.budgetSummary.originalContract).toBe(0)
    expect(report.riskFlags).toHaveLength(0)
    expect(report.progressPhotos).toHaveLength(0)
    expect(report.lookahead).toHaveLength(0)
  })

  it('generates RFI risk flags: critical when 3+ overdue', async () => {
    const overdueRfis = [
      { id: 'r1', rfi_number: 1, status: 'open', due_date: '2026-01-01' },
      { id: 'r2', rfi_number: 2, status: 'open', due_date: '2026-01-02' },
      { id: 'r3', rfi_number: 3, status: 'open', due_date: '2026-01-03' },
    ]
    setupFromMock({ rfis: overdueRfis, submittals: [], field_captures: [] })
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'error' } })

    const report = await generateOwnerReport('proj-1')
    const rfiFlagEntry = report.riskFlags.find((f) => f.type === 'rfi')

    expect(rfiFlagEntry).toBeTruthy()
    expect(rfiFlagEntry!.severity).toBe('critical')
    expect(rfiFlagEntry!.title).toContain('3')
  })

  it('generates warning (not critical) for fewer than 3 overdue RFIs', async () => {
    const overdueRfis = [
      { id: 'r1', rfi_number: 1, status: 'open', due_date: '2026-01-01' },
    ]
    setupFromMock({ rfis: overdueRfis, submittals: [] })
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: {} })

    const report = await generateOwnerReport('proj-1')
    const rfiFlagEntry = report.riskFlags.find((f) => f.type === 'rfi')

    expect(rfiFlagEntry!.severity).toBe('warning')
  })

  it('generates submittal risk flag when submittals are stalled >14 days', async () => {
    const longAgo = new Date(Date.now() - 20 * 86400000).toISOString()
    const stalled = [{ id: 'sub-1', status: 'submitted', created_at: longAgo }]
    setupFromMock({ submittals: stalled, rfis: [] })
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: {} })

    const report = await generateOwnerReport('proj-1')
    const submittalFlag = report.riskFlags.find((f) => f.type === 'submittal')

    expect(submittalFlag).toBeTruthy()
    expect(submittalFlag!.title).toContain('Stalled')
  })

  it('generates budget risk flag when spend exceeds 90% of original contract', async () => {
    const highBudget = [
      { original_amount: 100_000, committed_amount: 95_000, actual_amount: 92_000 }, // 92% spent
    ]
    setupFromMock({ budget_items: highBudget, change_orders: [], rfis: [], submittals: [] })
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: {} })

    const report = await generateOwnerReport('proj-1')
    const budgetFlag = report.riskFlags.find((f) => f.type === 'budget')

    expect(budgetFlag).toBeTruthy()
    expect(budgetFlag!.title).toContain('Budget')
  })

  it('maps progress photos correctly', async () => {
    setupFromMock()
    mockFunctionsInvoke.mockResolvedValue({ data: { narrative: 'x' }, error: null })

    const report = await generateOwnerReport('proj-1')

    expect(report.progressPhotos[0].url).toBe('https://cdn.test/1.jpg')
    expect(report.progressPhotos[0].caption).toBe('Foundation pour')
    expect(report.progressPhotos[0].location).toBe('Level 1')
  })

  it('maps change orders into budget summary', async () => {
    setupFromMock()
    mockFunctionsInvoke.mockResolvedValue({ data: { narrative: 'x' }, error: null })

    const report = await generateOwnerReport('proj-1')

    expect(report.budgetSummary.changeOrders).toHaveLength(2)
    expect(report.budgetSummary.changeOrders[0].number).toMatch(/^CO-/)
    expect(report.budgetSummary.changeOrders[0].status).toBe('approved')
  })

  it('falls back to template narrative when AI function fails', async () => {
    setupFromMock({ rfis: [], submittals: [] })
    mockFunctionsInvoke.mockRejectedValue(new Error('edge function error'))

    const report = await generateOwnerReport('proj-1')

    expect(report.narrative).toContain('City Hall Renovation')
    expect(report.narrative).toContain('45%')
  })
})

describe('generateNarrative', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns AI narrative when edge function succeeds', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { narrative: 'AI says: project is on track' }, error: null })

    const result = await generateNarrative({
      projectName: 'Test Project',
      percentComplete: 50,
      daysAheadBehind: 2,
      openRfis: 0,
      overdueRfis: 0,
      originalContract: 1_000_000,
      spent: 500_000,
      changeOrderCount: 1,
      behindPhaseCount: 0,
      riskFlags: [],
    })

    expect(result).toBe('AI says: project is on track')
  })

  it('falls back to template when AI function returns error', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'function not deployed' } })

    const result = await generateNarrative({
      projectName: 'Template Project',
      percentComplete: 30,
      daysAheadBehind: -3,
      openRfis: 2,
      overdueRfis: 1,
      originalContract: 2_000_000,
      spent: 600_000,
      changeOrderCount: 3,
      behindPhaseCount: 1,
      riskFlags: [],
    })

    expect(result).toContain('Template Project')
    expect(result).toContain('30%')
    expect(result).toContain('3 days behind')
  })

  it('template includes overdue RFI count when present', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: {} })

    const result = await generateNarrative({
      projectName: 'RFI Project',
      percentComplete: 60,
      daysAheadBehind: 0,
      openRfis: 5,
      overdueRfis: 2,
      originalContract: 1_000_000,
      spent: 400_000,
      changeOrderCount: 0,
      behindPhaseCount: 0,
      riskFlags: [],
    })

    expect(result).toContain('5 open RFIs')
    expect(result).toContain('2 of which are overdue')
  })

  it('template mentions critical risks when present', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: {} })

    const result = await generateNarrative({
      projectName: 'Risky Project',
      percentComplete: 10,
      daysAheadBehind: -10,
      openRfis: 0,
      overdueRfis: 0,
      originalContract: 500_000,
      spent: 50_000,
      changeOrderCount: 0,
      behindPhaseCount: 0,
      riskFlags: [{ type: 'budget', severity: 'critical', title: 'Budget Near Limit', detail: '' }],
    })

    expect(result).toContain('Critical items')
    expect(result).toContain('budget near limit')
  })
})

describe('getProgressPhotos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped photos without date range', async () => {
    mockFrom.mockReturnValue(makeChain(PHOTOS))

    const photos = await getProgressPhotos('proj-1')

    expect(photos).toHaveLength(1)
    expect(photos[0].url).toBe('https://cdn.test/1.jpg')
    expect(photos[0].id).toBe('photo-1')
    expect(photos[0].location).toBe('Level 1')
  })

  it('applies date range filters when provided', async () => {
    const chain = makeChain(PHOTOS)
    chain.gte = vi.fn().mockReturnValue(chain)
    chain.lte = vi.fn().mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const start = new Date('2026-02-01')
    const end = new Date('2026-02-28')
    const photos = await getProgressPhotos('proj-1', { start, end })

    expect(chain.gte).toHaveBeenCalledWith('created_at', start.toISOString())
    expect(chain.lte).toHaveBeenCalledWith('created_at', end.toISOString())
    expect(photos).toHaveLength(1)
  })

  it('returns empty array when no photos exist', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const photos = await getProgressPhotos('proj-1')
    expect(photos).toEqual([])
  })

  it('uses file_url fallback when photo_url is absent', async () => {
    const photoWithFallback = [{ ...PHOTOS[0], photo_url: null, file_url: 'https://cdn.test/fallback.jpg' }]
    mockFrom.mockReturnValue(makeChain(photoWithFallback))

    const photos = await getProgressPhotos('proj-1')
    expect(photos[0].url).toBe('https://cdn.test/fallback.jpg')
  })
})

describe('exportPDF', () => {
  it('returns a Blob of type application/pdf', async () => {
    const { projectName, projectAddress, reportDate, overallStatus, percentComplete, scheduleSummary, budgetSummary, riskFlags, progressPhotos, lookahead, milestones, narrative } = {
      projectName: 'Test',
      projectAddress: '123 Main',
      reportDate: 'Apr 16, 2026',
      overallStatus: 'on_track',
      percentComplete: 50,
      scheduleSummary: { daysAheadBehind: 0, totalPhases: 0, completedPhases: 0, inProgressPhases: 0, criticalPathItems: [] },
      budgetSummary: { originalContract: 0, approvedChanges: 0, currentContract: 0, committed: 0, spent: 0, forecast: 0, changeOrders: [] },
      riskFlags: [],
      progressPhotos: [],
      lookahead: [],
      milestones: [],
      narrative: 'Test narrative',
    }

    const blob = await exportPDF({ projectName, projectAddress, reportDate, overallStatus, percentComplete, scheduleSummary, budgetSummary, riskFlags, progressPhotos, lookahead, milestones, narrative })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
  })
})
