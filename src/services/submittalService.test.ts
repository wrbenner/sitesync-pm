import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockGetSession = vi.fn()
// D38 added supabase.rpc(...) calls for transitionStatus / createRevision /
// recordDisposition / distribute / close / replaceUser. Default RPC mock
// resolves success; individual tests can re-mock per assertion.
const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession() },
    rpc: (...args: unknown[]) => mockRpc(...args),
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
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default rpc behavior (vi.clearAllMocks resets implementations
    // on .mockResolvedValue declared in module scope).
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('transitions draft to submitted for gc_member role', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    // Fetch submittal
    const submittalChain = makeChain([SUBMITTAL], null, SUBMITTAL)
    // Fetch project member role
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })

    mockFrom
      .mockReturnValueOnce(submittalChain)
      .mockReturnValueOnce(roleChain)

    // D38: state transition routes through supabase.rpc('submittal_advance_status')
    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    const result = await submittalService.transitionStatus('sub-1', 'submitted')
    expect(result.error).toBeNull()
    expect(mockRpc).toHaveBeenCalledWith(
      'submittal_advance_status',
      expect.objectContaining({
        p_id: 'sub-1',
        p_to: 'submitted',
        p_actor: 'user-1',
        p_reason: null,
      }),
    )
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

  // D38: lifecycle timestamp setting (submitted_date / approved_date) moved
  // server-side into the submittal_advance_status RPC. The client just calls
  // the RPC; the server writes the timestamp atomically inside the same tx.
  it('forwards target status into the submittal_advance_status RPC', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const submittalChain = makeChain([SUBMITTAL], null, SUBMITTAL)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })

    mockFrom.mockReturnValueOnce(submittalChain).mockReturnValueOnce(roleChain)
    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    await submittalService.transitionStatus('sub-1', 'submitted')

    expect(mockRpc).toHaveBeenCalledWith(
      'submittal_advance_status',
      expect.objectContaining({ p_to: 'submitted' }),
    )
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('approved stamp inserts approval and transitions to approved', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-2' } } } })

    // addApproval:
    //   1. fetch project_id from submittals
    //   2. resolveProjectRole → project_members
    //   3. insert into submittal_approvals
    // transitionStatus (D38):
    //   4. fetch submittal status
    //   5. resolveProjectRole again
    //   6. supabase.rpc('submittal_advance_status', ...)
    const fetchChain = makeChain([{ project_id: 'proj-1' }], null, { project_id: 'proj-1' })
    const roleChain = makeChain([{ role: 'architect' }], null, { role: 'architect' })
    const insertChain: Record<string, unknown> = {}
    insertChain.insert = vi.fn().mockResolvedValue({ data: null, error: null })
    const archReviewSubmittal = { ...SUBMITTAL, status: 'architect_review' }
    const tsSubmittalChain = makeChain([archReviewSubmittal], null, archReviewSubmittal)
    const tsRoleChain = makeChain([{ role: 'architect' }], null, { role: 'architect' })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(tsSubmittalChain)
      .mockReturnValueOnce(tsRoleChain)

    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    const result = await submittalService.addApproval('sub-1', 'approved', 'Looks good')

    expect(result.error).toBeNull()
    expect(mockRpc).toHaveBeenCalledWith(
      'submittal_advance_status',
      expect.objectContaining({ p_to: 'approved' }),
    )
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

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(tsSubmittalChain)
      .mockReturnValueOnce(tsRoleChain)

    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    const result = await submittalService.addApproval('sub-1', 'revise_and_resubmit')
    expect(result.error).toBeNull()
    expect(mockRpc).toHaveBeenCalledWith(
      'submittal_advance_status',
      expect.objectContaining({ p_to: 'resubmit' }),
    )
  })
})

describe('submittalService.createRevision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('creates revision with incremented revision_number', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const newRevision = { ...SUBMITTAL, id: 'sub-2', revision_number: 2, parent_submittal_id: 'sub-1' }

    // D38: createRevision routes through supabase.rpc('submittal_create_revision').
    // The RPC handles parent fetch + insert + hash chain server-side.
    mockRpc.mockResolvedValueOnce({ data: newRevision, error: null })

    const result = await submittalService.createRevision('sub-1')

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    expect(mockRpc).toHaveBeenCalledWith(
      'submittal_create_revision',
      expect.objectContaining({ p_parent_id: 'sub-1' }),
    )
  })

  it('returns error when parent submittal not found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Parent submittal sub-missing not found' } })

    const result = await submittalService.createRevision('sub-missing')
    expect(result.error).toBeTruthy()
    expect(result.error?.category).toBe('DatabaseError')
  })
})
