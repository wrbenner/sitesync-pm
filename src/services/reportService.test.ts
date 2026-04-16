import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateOwnerReport,
  generateNarrative,
  getProgressPhotos,
  exportPDF,
  type NarrativeInput,
} from './reportService'

// ── Supabase mock ─────────────────────────────────────────

const mockFrom = vi.fn()
const mockFunctionsInvoke = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: vi.fn() },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

// ── Chain factory ─────────────────────────────────────────

function makeChain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof result) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (r: unknown) => unknown) => Promise.resolve(result).catch(reject),
  }
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.lte = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(result)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  return chain
}

// Sets up mockFrom for the 7 parallel queries in generateOwnerReport
function setupReportMocks(overrides: {
  project?: unknown
  phases?: unknown[]
  budget?: unknown[]
  changeOrders?: unknown[]
  rfis?: unknown[]
  submittals?: unknown[]
  photos?: unknown[]
} = {}) {
  mockFrom
    .mockReturnValueOnce(makeChain({ data: overrides.project ?? null, error: null }))
    .mockReturnValueOnce(makeChain({ data: overrides.phases ?? [], error: null }))
    .mockReturnValueOnce(makeChain({ data: overrides.budget ?? [], error: null }))
    .mockReturnValueOnce(makeChain({ data: overrides.changeOrders ?? [], error: null }))
    .mockReturnValueOnce(makeChain({ data: overrides.rfis ?? [], error: null }))
    .mockReturnValueOnce(makeChain({ data: overrides.submittals ?? [], error: null }))
    .mockReturnValueOnce(makeChain({ data: overrides.photos ?? [], error: null }))
}

const baseProject = {
  id: 'p1',
  name: 'Riverside Tower',
  address: '100 River St',
  percent_complete: 62,
  health_status: 'on_track',
}

describe('generateOwnerReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFunctionsInvoke.mockResolvedValue({ data: { narrative: 'AI narrative text' }, error: null })
  })

  it('maps project fields into the report', async () => {
    setupReportMocks({ project: baseProject })

    const report = await generateOwnerReport('p1')

    expect(report.projectName).toBe('Riverside Tower')
    expect(report.projectAddress).toBe('100 River St')
    expect(report.percentComplete).toBe(62)
    expect(report.overallStatus).toBe('on_track')
    expect(report.narrative).toBe('AI narrative text')
  })

  it('computes schedule summary from phases', async () => {
    const phases = [
      { id: 'ph1', name: 'Foundation', status: 'complete', percent_complete: 100, start_date: '2026-01-01', end_date: '2026-02-01' },
      { id: 'ph2', name: 'Structure', status: 'in_progress', percent_complete: 60, start_date: '2026-02-01', end_date: '2026-04-01' },
    ]
    setupReportMocks({ project: baseProject, phases })

    const report = await generateOwnerReport('p1')

    expect(report.scheduleSummary.totalPhases).toBe(2)
    expect(report.scheduleSummary.completedPhases).toBe(1)
    expect(report.scheduleSummary.inProgressPhases).toBe(1)
  })

  it('computes budget summary from budget items and approved change orders', async () => {
    const budget = [
      { original_amount: 1_000_000, committed_amount: 900_000, actual_amount: 700_000 },
      { original_amount: 500_000, committed_amount: 480_000, actual_amount: 350_000 },
    ]
    const changeOrders = [
      { number: 1, title: 'Owner Add', amount: 75_000, status: 'approved' },
      { number: 2, title: 'Pending CO', amount: 20_000, status: 'pending' },
    ]
    setupReportMocks({ project: baseProject, budget, changeOrders })

    const report = await generateOwnerReport('p1')

    expect(report.budgetSummary.originalContract).toBe(1_500_000)
    expect(report.budgetSummary.approvedChanges).toBe(75_000)
    expect(report.budgetSummary.currentContract).toBe(1_575_000)
    expect(report.budgetSummary.spent).toBe(1_050_000)
    expect(report.budgetSummary.changeOrders).toHaveLength(2)
    expect(report.budgetSummary.changeOrders[0].number).toBe('CO-001')
  })

  it('generates rfi risk flag for overdue RFIs', async () => {
    const rfis = [
      { id: 'r1', rfi_number: 1, status: 'open', due_date: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: 'r2', rfi_number: 2, status: 'open', due_date: new Date(Date.now() - 3 * 86400000).toISOString() },
    ]
    setupReportMocks({ project: baseProject, rfis })

    const report = await generateOwnerReport('p1')
    const rfiFlag = report.riskFlags.find((f) => f.type === 'rfi')

    expect(rfiFlag).toBeTruthy()
    expect(rfiFlag!.severity).toBe('warning')
    expect(rfiFlag!.title).toMatch(/Overdue RFI/)
  })

  it('escalates rfi risk to critical when 3 or more overdue', async () => {
    const rfis = Array.from({ length: 4 }, (_, i) => ({
      id: `r${i}`,
      rfi_number: i + 1,
      status: 'open',
      due_date: new Date(Date.now() - 5 * 86400000).toISOString(),
    }))
    setupReportMocks({ project: baseProject, rfis })

    const report = await generateOwnerReport('p1')
    const rfiFlag = report.riskFlags.find((f) => f.type === 'rfi')

    expect(rfiFlag!.severity).toBe('critical')
  })

  it('generates schedule risk flag for behind phases', async () => {
    const phases = [
      {
        id: 'ph1',
        name: 'Framing',
        status: 'in_progress',
        percent_complete: 30,
        start_date: '2026-01-01',
        end_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
      },
    ]
    setupReportMocks({ project: baseProject, phases })

    const report = await generateOwnerReport('p1')
    const schedFlag = report.riskFlags.find((f) => f.type === 'schedule')

    expect(schedFlag).toBeTruthy()
    expect(schedFlag!.detail).toContain('Framing')
  })

  it('generates budget risk flag when near limit', async () => {
    const budget = [
      { original_amount: 1_000_000, committed_amount: 950_000, actual_amount: 950_000 },
    ]
    setupReportMocks({ project: baseProject, budget })

    const report = await generateOwnerReport('p1')
    const budgetFlag = report.riskFlags.find((f) => f.type === 'budget')

    expect(budgetFlag).toBeTruthy()
  })

  it('maps progress photos with correct fields', async () => {
    const photos = [
      {
        id: 'img1',
        photo_url: 'https://cdn.example.com/photo1.jpg',
        notes: 'Level 3 complete',
        captured_at: '2026-04-10T12:00:00Z',
        location: 'Level 3',
      },
    ]
    setupReportMocks({ project: baseProject, photos })

    const report = await generateOwnerReport('p1')

    expect(report.progressPhotos).toHaveLength(1)
    expect(report.progressPhotos[0].url).toBe('https://cdn.example.com/photo1.jpg')
    expect(report.progressPhotos[0].caption).toBe('Level 3 complete')
    expect(report.progressPhotos[0].location).toBe('Level 3')
  })

  it('returns safe defaults when project data is null', async () => {
    setupReportMocks({ project: null })

    const report = await generateOwnerReport('p1')

    expect(report.projectName).toBe('Project')
    expect(report.percentComplete).toBe(0)
    expect(report.riskFlags).toEqual([])
  })
})

describe('generateNarrative', () => {
  beforeEach(() => vi.clearAllMocks())

  const baseInput: NarrativeInput = {
    projectName: 'Test Tower',
    percentComplete: 55,
    daysAheadBehind: 3,
    openRfis: 4,
    overdueRfis: 0,
    originalContract: 5_000_000,
    spent: 2_750_000,
    changeOrderCount: 3,
    behindPhaseCount: 0,
    riskFlags: [],
  }

  it('returns AI narrative when edge function succeeds', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { narrative: 'Project on track.' }, error: null })

    const result = await generateNarrative(baseInput)
    expect(result).toBe('Project on track.')
  })

  it('falls back to template when edge function throws', async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error('function unavailable'))

    const result = await generateNarrative(baseInput)
    expect(result).toContain('Test Tower')
    expect(result).toContain('55% complete')
  })

  it('falls back to template when edge function returns error in data', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'timeout' } })

    const result = await generateNarrative(baseInput)
    expect(result).toContain('Test Tower')
  })

  it('template narrative mentions behind schedule when daysAheadBehind is negative', async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error('fail'))

    const result = await generateNarrative({ ...baseInput, daysAheadBehind: -5 })
    expect(result).toContain('behind schedule')
  })

  it('template narrative mentions overdue RFIs', async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error('fail'))

    const result = await generateNarrative({ ...baseInput, overdueRfis: 2, openRfis: 5 })
    expect(result).toContain('overdue')
  })
})

describe('getProgressPhotos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps raw DB rows into ProgressPhoto shape', async () => {
    const rawPhotos = [
      {
        id: 'ph1',
        photo_url: 'https://example.com/img.jpg',
        notes: 'Concrete pour',
        captured_at: '2026-04-01T08:00:00Z',
        location: 'Basement',
      },
    ]
    mockFrom.mockReturnValue(makeChain({ data: rawPhotos, error: null }))

    const result = await getProgressPhotos('proj-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ph1')
    expect(result[0].url).toBe('https://example.com/img.jpg')
    expect(result[0].caption).toBe('Concrete pour')
    expect(result[0].location).toBe('Basement')
  })

  it('uses file_url fallback when photo_url is absent', async () => {
    const rawPhotos = [{ id: 'ph2', file_url: 'https://cdn.example.com/file.jpg', notes: '', location: '' }]
    mockFrom.mockReturnValue(makeChain({ data: rawPhotos, error: null }))

    const result = await getProgressPhotos('proj-1')
    expect(result[0].url).toBe('https://cdn.example.com/file.jpg')
  })

  it('applies gte and lte filters when date range is provided', async () => {
    const chain = makeChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await getProgressPhotos('proj-1', {
      start: new Date('2026-03-01'),
      end: new Date('2026-03-31'),
    })

    expect((chain.gte as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('created_at', expect.any(String))
    expect((chain.lte as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('created_at', expect.any(String))
  })

  it('returns empty array when no photos exist', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }))
    const result = await getProgressPhotos('proj-empty')
    expect(result).toEqual([])
  })
})

describe('exportPDF', () => {
  it('returns a Blob with pdf mime type', async () => {
    const blob = await exportPDF({} as Parameters<typeof exportPDF>[0])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
  })
})
