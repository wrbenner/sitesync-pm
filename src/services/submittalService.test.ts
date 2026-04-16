import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submittalService } from './submittalService'

// ── Supabase mock ─────────────────────────────────────────

const mockFrom = vi.fn()
const mockGetSession = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
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
  chain.single = vi.fn().mockResolvedValue(result)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  return chain
}

const USER_ID = 'user-abc'
const PROJECT_ID = 'proj-xyz'

function authSession() {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } } })
}

// ── Tests ─────────────────────────────────────────────────

describe('loadSubmittals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns submittals for the project', async () => {
    const rows = [
      { id: 's1', title: 'Rebar shop drawings', status: 'draft', project_id: PROJECT_ID },
      { id: 's2', title: 'Concrete mix design', status: 'submitted', project_id: PROJECT_ID },
    ]
    mockFrom.mockReturnValue(makeChain({ data: rows, error: null }))

    const result = await submittalService.loadSubmittals(PROJECT_ID)

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(result.data![0].id).toBe('s1')
  })

  it('returns error message on DB failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'permission denied' } }))

    const result = await submittalService.loadSubmittals(PROJECT_ID)

    expect(result.data).toBeNull()
    expect(result.error).toBe('permission denied')
  })

  it('returns empty array when no submittals exist', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }))
    const result = await submittalService.loadSubmittals(PROJECT_ID)
    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })
})

describe('createSubmittal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('creates a new submittal in draft status', async () => {
    const created = { id: 'new-sub', title: 'Steel connection details', status: 'draft', project_id: PROJECT_ID }
    mockFrom.mockReturnValue(makeChain({ data: created, error: null }))

    const result = await submittalService.createSubmittal({
      project_id: PROJECT_ID,
      title: 'Steel connection details',
    })

    expect(result.error).toBeNull()
    expect(result.data!.status).toBe('draft')
    expect(result.data!.title).toBe('Steel connection details')
  })

  it('returns error when insert fails', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'unique violation' } }))

    const result = await submittalService.createSubmittal({
      project_id: PROJECT_ID,
      title: 'Duplicate',
    })

    expect(result.data).toBeNull()
    expect(result.error).toBe('unique violation')
  })
})

describe('transitionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('transitions draft to submitted for a project_manager', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'draft', project_id: PROJECT_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { role: 'project_manager' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    const result = await submittalService.transitionStatus('sub-1', 'submitted')

    expect(result.error).toBeNull()
  })

  it('rejects an invalid transition and returns a descriptive error', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'draft', project_id: PROJECT_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { role: 'project_manager' }, error: null }))

    const result = await submittalService.transitionStatus('sub-1', 'approved')

    expect(result.error).toMatch(/Invalid transition/)
    expect(result.error).toMatch(/draft/)
    expect(result.error).toMatch(/approved/)
  })

  it('rejects transition when user is not a project member', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'draft', project_id: PROJECT_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    const result = await submittalService.transitionStatus('sub-1', 'submitted')

    expect(result.error).toMatch(/not a member/)
  })

  it('returns error when submittal is not found', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'not found' } }))

    const result = await submittalService.transitionStatus('bad-id', 'submitted')

    expect(result.data).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('writes submitted_date provenance when transitioning to submitted', async () => {
    const updateChain = makeChain({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'draft', project_id: PROJECT_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { role: 'project_manager' }, error: null }))
      .mockReturnValueOnce(updateChain)

    await submittalService.transitionStatus('sub-1', 'submitted')

    expect((updateChain.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ submitted_date: expect.any(String) }),
    )
  })

  it('writes approved_date provenance when transitioning to approved (architect role)', async () => {
    const updateChain = makeChain({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'architect_review', project_id: PROJECT_ID }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { role: 'architect' }, error: null }))
      .mockReturnValueOnce(updateChain)

    await submittalService.transitionStatus('sub-1', 'approved')

    expect((updateChain.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ approved_date: expect.any(String) }),
    )
  })
})

describe('updateSubmittal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('strips status from updates to prevent bypassing the state machine', async () => {
    const updateChain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(updateChain)

    await submittalService.updateSubmittal('sub-1', {
      title: 'Updated Title',
      status: 'approved' as never,
    } as Parameters<typeof submittalService.updateSubmittal>[1])

    const updateArgs = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArgs).not.toHaveProperty('status')
    expect(updateArgs.title).toBe('Updated Title')
  })

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'update failed' } }))
    const result = await submittalService.updateSubmittal('sub-1', { title: 'New Title' })
    expect(result.error).toBe('update failed')
  })
})

describe('deleteSubmittal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('soft-deletes by setting deleted_at and deleted_by', async () => {
    const updateChain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(updateChain)

    const result = await submittalService.deleteSubmittal('sub-1')

    expect(result.error).toBeNull()
    const updateArgs = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArgs).toHaveProperty('deleted_at')
    expect(updateArgs).toHaveProperty('deleted_by', USER_ID)
  })
})

describe('loadApprovals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns approval records for a submittal', async () => {
    const rows = [
      { id: 'ap1', submittal_id: 'sub-1', stamp: 'approved', reviewed_at: '2026-04-10T10:00:00Z' },
    ]
    mockFrom.mockReturnValue(makeChain({ data: rows, error: null }))

    const result = await submittalService.loadApprovals('sub-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].stamp).toBe('approved')
  })

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'table missing' } }))
    const result = await submittalService.loadApprovals('sub-1')
    expect(result.error).toBe('table missing')
  })
})

describe('createRevision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('creates a revision with incremented revision_number', async () => {
    const parent = {
      id: 'sub-1',
      project_id: PROJECT_ID,
      title: 'Steel Details',
      spec_section: '05 12 00',
      revision_number: 1,
      assigned_to: null,
      subcontractor: null,
      due_date: null,
      submit_by_date: null,
      required_onsite_date: null,
      lead_time_weeks: null,
    }
    const newRevision = { id: 'sub-2', title: 'Steel Details', status: 'draft', revision_number: 2 }

    mockFrom
      .mockReturnValueOnce(makeChain({ data: parent, error: null }))
      .mockReturnValueOnce(makeChain({ data: newRevision, error: null }))

    const result = await submittalService.createRevision('sub-1')

    expect(result.error).toBeNull()
    const insertArgs = (mockFrom.mock.results[1].value.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArgs.revision_number).toBe(2)
    expect(insertArgs.parent_submittal_id).toBe('sub-1')
    expect(insertArgs.status).toBe('draft')
  })

  it('returns error when parent submittal is not found', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'not found' } }))
    const result = await submittalService.createRevision('bad-id')
    expect(result.error).toBeTruthy()
  })
})
