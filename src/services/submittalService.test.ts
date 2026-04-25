import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockGetSession = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession() },
  },
}))

// Mock the submittalMachine to avoid xstate/theme dependencies in isolation
vi.mock('../machines/submittalMachine', () => ({
  getValidSubmittalStatusTransitions: vi.fn((status: string, role: string) => {
    if (status === 'draft' && role !== 'viewer') return ['submitted']
    if (status === 'submitted' && ['project_manager', 'superintendent', 'gc_member', 'admin', 'owner'].includes(role)) return ['gc_review', 'rejected']
    if (status === 'gc_review' && ['project_manager', 'superintendent', 'gc_member', 'admin', 'owner'].includes(role)) return ['architect_review', 'rejected', 'resubmit']
    if (status === 'architect_review' && ['architect', 'designer', 'admin', 'owner'].includes(role)) return ['approved', 'rejected', 'resubmit']
    return []
  }),
}))

import { submittalService } from './submittalService'

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
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const SUBMITTAL = {
  id: 'sub-1',
  project_id: 'proj-1',
  title: 'Concrete Mix Design',
  status: 'draft',
  spec_section: '03 00 00',
  assigned_to: 'user-2',
  subcontractor: 'Acme Concrete',
  due_date: '2026-05-01',
  submit_by_date: '2026-04-15',
  required_onsite_date: '2026-06-01',
  lead_time_weeks: 4,
  revision_number: 1,
  parent_submittal_id: null,
  created_by: 'user-1',
  deleted_at: null,
  number: 1,
}

describe('submittalService.loadSubmittals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns submittal list on success', async () => {
    mockFrom.mockReturnValue(makeChain([SUBMITTAL]))

    const result = await submittalService.loadSubmittals('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe('sub-1')
  })

  it('returns error when query fails', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'relation not found' }))

    const result = await submittalService.loadSubmittals('proj-1')

    expect(result.data).toBeNull()
    expect(result.error?.message).toBe('relation not found')
  })

  it('returns empty array when no submittals exist', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await submittalService.loadSubmittals('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })
})

describe('submittalService.createSubmittal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates submittal with all optional fields', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain([SUBMITTAL], null, SUBMITTAL)
    chain.insert = vi.fn().mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const result = await submittalService.createSubmittal({
      project_id: 'proj-1',
      title: 'Concrete Mix Design',
      spec_section: '03 00 00',
      assigned_to: 'user-2',
      subcontractor: 'Acme Concrete',
      due_date: '2026-05-01',
      submit_by_date: '2026-04-15',
    })

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    expect((chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0].status).toBe('draft')
  })

  it('creates submittal with only required fields', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const minimal = { ...SUBMITTAL, assigned_to: null, subcontractor: null, spec_section: null }
    const chain = makeChain([minimal], null, minimal)
    chain.insert = vi.fn().mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const result = await submittalService.createSubmittal({
      project_id: 'proj-1',
      title: 'Shop Drawings',
    })

    expect(result.error).toBeNull()
    expect((chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0].title).toBe('Shop Drawings')
  })

  it('returns error when insert fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain(null, { message: 'insert failed' })
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })
    mockFrom.mockReturnValue(chain)

    const result = await submittalService.createSubmittal({ project_id: 'proj-1', title: 'Bad Sub' })

    expect(result.error?.message).toBe('insert failed')
    expect(result.data).toBeNull()
  })
})

describe('submittalService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('transitions draft to submitted for gc_member role', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    // Fetch submittal
    const submittalChain = makeChain([SUBMITTAL], null, SUBMITTAL)
    // Fetch project member role
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })
    // Update
    const updateChain = makeChain(null, null)
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(submittalChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await submittalService.transitionStatus('sub-1', 'submitted')
    expect(result.error).toBeNull()
  })

  it('rejects invalid transition', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const submittalChain = makeChain([SUBMITTAL], null, SUBMITTAL)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })

    mockFrom
      .mockReturnValueOnce(submittalChain)
      .mockReturnValueOnce(roleChain)

    // draft → approved is not a valid transition for gc_member
    const result = await submittalService.transitionStatus('sub-1', 'approved')
    expect(result.error?.message).toContain('Invalid transition')
  })

  it('returns error when user is not a project member', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-stranger' } } } })

    const submittalChain = makeChain([SUBMITTAL], null, SUBMITTAL)
    const roleChain = makeChain([null], null, null)
    roleChain.single = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(submittalChain)
      .mockReturnValueOnce(roleChain)

    const result = await submittalService.transitionStatus('sub-1', 'submitted')
    expect(result.error?.message).toContain('not a member')
  })

  it('returns error when submittal not found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain(null, null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await submittalService.transitionStatus('sub-missing', 'submitted')
    expect(result.error).toBeTruthy()
  })

  it('writes submitted_date provenance when transitioning to submitted', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const submittalChain = makeChain([SUBMITTAL], null, SUBMITTAL)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(submittalChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    await submittalService.transitionStatus('sub-1', 'submitted')

    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall).toHaveProperty('submitted_date')
  })
})

describe('submittalService.updateSubmittal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status field from updates', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await submittalService.updateSubmittal('sub-1', { title: 'Updated Title', status: 'approved' } as never)

    const updatePayload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).not.toHaveProperty('status')
    expect(updatePayload.title).toBe('Updated Title')
  })

  it('returns error when update fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: { message: 'update failed' } })
    mockFrom.mockReturnValue(chain)

    const result = await submittalService.updateSubmittal('sub-1', { title: 'X' })
    expect(result.error?.message).toBe('update failed')
  })
})

describe('submittalService.deleteSubmittal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by setting deleted_at', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await submittalService.deleteSubmittal('sub-1')

    expect(result.error).toBeNull()
    const updatePayload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toHaveProperty('deleted_at')
    expect(updatePayload).toHaveProperty('deleted_by')
  })
})

describe('submittalService.loadApprovals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns approval records for a submittal', async () => {
    const approvals = [
      { id: 'appr-1', submittal_id: 'sub-1', stamp: 'approved', approver_id: 'user-2', role: 'architect' },
    ]
    mockFrom.mockReturnValue(makeChain(approvals))

    const result = await submittalService.loadApprovals('sub-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].stamp).toBe('approved')
  })

  it('returns error when query fails', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'no table' }))

    const result = await submittalService.loadApprovals('sub-1')
    expect(result.error?.message).toBe('no table')
  })
})

describe('submittalService.addApproval', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approved stamp inserts approval and transitions to approved', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-2' } } } })

    // Fetch submittal project_id
    const fetchChain = makeChain([{ project_id: 'proj-1' }], null, { project_id: 'proj-1' })
    // Resolve role
    const roleChain = makeChain([{ role: 'architect' }], null, { role: 'architect' })
    // Insert approval
    const insertChain: Record<string, unknown> = {}
    insertChain.insert = vi.fn().mockResolvedValue({ data: null, error: null })
    // transitionStatus calls: fetchSubmittal, fetchRole, update
    const archReviewSubmittal = { ...SUBMITTAL, status: 'architect_review' }
    const tsSubmittalChain = makeChain([archReviewSubmittal], null, archReviewSubmittal)
    const tsRoleChain = makeChain([{ role: 'architect' }], null, { role: 'architect' })
    const tsUpdateChain: Record<string, unknown> = {}
    tsUpdateChain.update = vi.fn().mockReturnValue(tsUpdateChain)
    tsUpdateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(fetchChain)     // addApproval: fetch project_id
      .mockReturnValueOnce(roleChain)      // addApproval: resolve role
      .mockReturnValueOnce(insertChain)    // addApproval: insert approval
      .mockReturnValueOnce(tsSubmittalChain) // transitionStatus: fetch submittal
      .mockReturnValueOnce(tsRoleChain)    // transitionStatus: resolve role
      .mockReturnValueOnce(tsUpdateChain)  // transitionStatus: update

    const result = await submittalService.addApproval('sub-1', 'approved', 'Looks good')

    expect(result.error).toBeNull()
  })

  it('revise_and_resubmit stamp targets resubmit status', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-2' } } } })

    const fetchChain = makeChain([{ project_id: 'proj-1' }], null, { project_id: 'proj-1' })
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })
    const insertChain: Record<string, unknown> = {}
    insertChain.insert = vi.fn().mockResolvedValue({ data: null, error: null })
    const gcReviewSubmittal = { ...SUBMITTAL, status: 'gc_review' }
    const tsSubmittalChain = makeChain([gcReviewSubmittal], null, gcReviewSubmittal)
    const tsRoleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })
    const tsUpdateChain: Record<string, unknown> = {}
    tsUpdateChain.update = vi.fn().mockReturnValue(tsUpdateChain)
    tsUpdateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(tsSubmittalChain)
      .mockReturnValueOnce(tsRoleChain)
      .mockReturnValueOnce(tsUpdateChain)

    const result = await submittalService.addApproval('sub-1', 'revise_and_resubmit')
    expect(result.error).toBeNull()
  })
})

describe('submittalService.createRevision', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates revision with incremented revision_number', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const parent = { ...SUBMITTAL, revision_number: 1 }
    const newRevision = { ...SUBMITTAL, id: 'sub-2', revision_number: 2, parent_submittal_id: 'sub-1' }

    const parentChain = makeChain([parent], null, parent)
    const insertChain = makeChain([newRevision], null, newRevision)
    insertChain.insert = vi.fn().mockReturnValue(insertChain)

    mockFrom
      .mockReturnValueOnce(parentChain)
      .mockReturnValueOnce(insertChain)

    const result = await submittalService.createRevision('sub-1')

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
  })

  it('returns error when parent submittal not found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain(null, null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await submittalService.createRevision('sub-missing')
    expect(result.error).toBeTruthy()
  })
})
