import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockGetSession = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession() },
  },
}))

// ---------------------------------------------------------------------------
// rfiMachine mock — getValidTransitions returns target STATUS names so the
// service can directly compare newStatus against the result set.
// ---------------------------------------------------------------------------
vi.mock('../../machines/rfiMachine', () => ({
  getValidTransitions: vi.fn((status: string, role: string) => {
    const isAdmin = ['owner', 'admin'].includes(role)
    const canEdit = ['owner', 'admin', 'project_manager', 'superintendent', 'foreman'].includes(role)

    if (!canEdit) return []

    const base: Record<string, string[]> = {
      draft: ['open'],
      open: ['under_review', 'closed'],
      under_review: ['answered', 'closed'],
      answered: ['closed', 'open'],
      closed: ['open'],
      void: [],
    }

    const result = [...(base[status] ?? [])]
    if (isAdmin && status !== 'void') result.push('void')
    return result
  }),
  getBallInCourt: vi.fn(
    (_status: string, createdBy: string | null, assignedTo: string | null) =>
      assignedTo ?? createdBy ?? null,
  ),
}))

import { rfiService } from '../../services/rfiService'

// ---------------------------------------------------------------------------
// Chain builder — list results resolve via thenable, single via .single()
// ---------------------------------------------------------------------------
function makeChain(
  listData: unknown[] | null = [],
  error: { message: string } | null = null,
  singleData?: unknown,
) {
  const singleResult = {
    data: singleData ?? (Array.isArray(listData) && listData.length > 0 ? listData[0] : null),
    error,
  }
  const listResult = { data: listData, error }

  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const RFI = {
  id: 'rfi-1',
  project_id: 'proj-1',
  rfi_number: 42,
  title: 'Beam size clarification at grid A3',
  description: 'What is the correct beam size at grid A3?',
  status: 'draft',
  priority: 'high',
  created_by: 'user-1',
  assigned_to: null,
  due_date: null,
  ball_in_court_id: 'user-1',
  linked_drawing_id: null,
  closed_date: null,
  deleted_at: null,
  deleted_by: null,
  created_at: '2026-04-16T10:00:00Z',
  updated_at: '2026-04-16T10:00:00Z',
}

function mockSession(userId = 'user-1') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

// ---------------------------------------------------------------------------
// loadRfis
// ---------------------------------------------------------------------------
describe('rfiService.loadRfis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active RFIs excluding soft-deleted rows', async () => {
    mockFrom.mockReturnValue(makeChain([RFI]))

    const result = await rfiService.loadRfis('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe('rfi-1')
  })

  it('returns empty array when project has no RFIs', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await rfiService.loadRfis('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'connection refused' }))

    const result = await rfiService.loadRfis('proj-1')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.message).toContain('connection refused')
  })

  it('applies soft-delete filter (is deleted_at null)', async () => {
    const chain = makeChain([RFI])
    mockFrom.mockReturnValue(chain)

    await rfiService.loadRfis('proj-1')

    expect(mockFrom).toHaveBeenCalledWith('rfis')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })
})

// ---------------------------------------------------------------------------
// createRfi
// ---------------------------------------------------------------------------
describe('rfiService.createRfi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates RFI with status draft and created_by from session', async () => {
    mockSession('user-1')
    const chain = makeChain([RFI], null, RFI)
    mockFrom.mockReturnValue(chain)

    const result = await rfiService.createRfi({
      project_id: 'proj-1',
      title: 'Beam size clarification at grid A3',
      priority: 'high',
    })

    expect(result.error).toBeNull()
    expect(result.data?.status).toBe('draft')

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.status).toBe('draft')
    expect(payload.created_by).toBe('user-1')
    expect(payload.project_id).toBe('proj-1')
  })

  it('always forces status to draft', async () => {
    mockSession('user-1')
    const chain = makeChain([RFI], null, RFI)
    mockFrom.mockReturnValue(chain)

    await rfiService.createRfi({ project_id: 'proj-1', title: 'Test RFI', priority: 'low' })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    expect(insertCall.mock.calls[0][0].status).toBe('draft')
  })

  it('sets optional fields and populates ball_in_court_id from assigned_to', async () => {
    mockSession('user-1')
    const chain = makeChain([RFI], null, RFI)
    mockFrom.mockReturnValue(chain)

    await rfiService.createRfi({
      project_id: 'proj-1',
      title: 'Conduit routing question',
      priority: 'medium',
      assigned_to: 'user-2',
      due_date: '2026-05-01',
      linked_drawing_id: 'drawing-1',
    })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.assigned_to).toBe('user-2')
    expect(payload.due_date).toBe('2026-05-01')
    expect(payload.linked_drawing_id).toBe('drawing-1')
    expect(payload.ball_in_court_id).toBe('user-2')
  })

  it('returns DatabaseError when insert fails', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'unique constraint violated' }))

    const result = await rfiService.createRfi({
      project_id: 'proj-1',
      title: 'Duplicate',
      priority: 'low',
    })

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------
describe('rfiService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows valid transition with correct role', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, {
      status: 'draft',
      created_by: 'user-1',
      assigned_to: null,
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'project_manager' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await rfiService.transitionStatus('rfi-1', 'open')

    expect(result.error).toBeNull()
  })

  it('rejects invalid transition for current status', async () => {
    mockSession('user-1')
    const fetchChain = makeChain([], null, {
      status: 'draft',
      created_by: 'user-1',
      assigned_to: null,
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'superintendent' })

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await rfiService.transitionStatus('rfi-1', 'answered')

    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('Invalid transition')
  })

  it('returns NotFoundError when RFI does not exist', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'no rows' }))

    const result = await rfiService.transitionStatus('missing-id', 'open')

    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user is not a project member', async () => {
    mockSession('outsider-1')
    const fetchChain = makeChain([], null, {
      status: 'draft',
      created_by: 'user-1',
      assigned_to: null,
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, null)

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await rfiService.transitionStatus('rfi-1', 'open')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('viewer cannot transition RFI status', async () => {
    mockSession('viewer-1')
    const fetchChain = makeChain([], null, {
      status: 'draft',
      created_by: 'user-1',
      assigned_to: null,
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'viewer' })

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await rfiService.transitionStatus('rfi-1', 'open')

    expect(result.error?.category).toBe('ValidationError')
  })

  it('sets closed_date when transitioning to closed', async () => {
    mockSession('admin-1')
    const fetchChain = makeChain([], null, {
      status: 'answered',
      created_by: 'user-1',
      assigned_to: null,
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'admin' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await rfiService.transitionStatus('rfi-1', 'closed')

    expect(result.error).toBeNull()
    const payload = updateFn.mock.calls[0][0] as Record<string, unknown>
    expect(typeof payload['closed_date']).toBe('string')
  })

  it('updates ball_in_court_id on every transition', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, {
      status: 'draft',
      created_by: 'user-1',
      assigned_to: 'user-2',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'project_manager' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    await rfiService.transitionStatus('rfi-1', 'open')

    const payload = updateFn.mock.calls[0][0] as Record<string, unknown>
    expect(payload['ball_in_court_id']).toBeDefined()
    expect(payload['updated_by']).toBe('pm-1')
  })

  it('admin can void an RFI', async () => {
    mockSession('admin-1')
    const fetchChain = makeChain([], null, {
      status: 'open',
      created_by: 'user-1',
      assigned_to: null,
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'admin' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await rfiService.transitionStatus('rfi-1', 'void')

    expect(result.error).toBeNull()
    expect(updateFn.mock.calls[0][0]).toMatchObject({ status: 'void' })
  })

  it('returns DatabaseError when update fails after validation passes', async () => {
    mockSession('admin-1')
    const fetchChain = makeChain([], null, {
      status: 'draft',
      created_by: 'user-1',
      assigned_to: null,
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'admin' })
    const updateEq = vi.fn().mockResolvedValue({ error: { message: 'write conflict' } })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await rfiService.transitionStatus('rfi-1', 'open')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// updateRfi — status field must be stripped
// ---------------------------------------------------------------------------
describe('rfiService.updateRfi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status field from updates to prevent lifecycle bypass', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await rfiService.updateRfi('rfi-1', {
      title: 'Updated Title',
      status: 'closed',
    } as Parameters<typeof rfiService.updateRfi>[1])

    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(payload.title).toBe('Updated Title')
    expect(payload.status).toBeUndefined()
    expect(payload.updated_by).toBe('user-1')
  })

  it('sets updated_by from session on every update', async () => {
    mockSession('user-99')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await rfiService.updateRfi('rfi-1', { title: 'Another Title' })

    const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload.updated_by).toBe('user-99')
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'timeout' }))

    const result = await rfiService.updateRfi('rfi-1', { title: 'X' })

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// deleteRfi — soft delete
// ---------------------------------------------------------------------------
describe('rfiService.deleteRfi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets deleted_at and deleted_by (soft delete)', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await rfiService.deleteRfi('rfi-1')

    expect(result.error).toBeNull()
    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(typeof payload.deleted_at).toBe('string')
    expect(payload.deleted_by).toBe('user-1')
  })

  it('never calls hard delete — uses update', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    const deleteFn = vi.fn()
    Object.assign(chain, { delete: deleteFn })
    mockFrom.mockReturnValue(chain)

    await rfiService.deleteRfi('rfi-1')

    expect(deleteFn).not.toHaveBeenCalled()
    expect(chain.update).toHaveBeenCalled()
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'rls violation' }))

    const result = await rfiService.deleteRfi('rfi-1')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// loadResponses
// ---------------------------------------------------------------------------
describe('rfiService.loadResponses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns responses for an RFI ordered by created_at', async () => {
    const responses = [
      { id: 'r-1', rfi_id: 'rfi-1', response_text: 'Use W12x26', created_at: '2026-04-16' },
      { id: 'r-2', rfi_id: 'rfi-1', response_text: 'Confirmed per SE', created_at: '2026-04-17' },
    ]
    mockFrom.mockReturnValue(makeChain(responses))

    const result = await rfiService.loadResponses('rfi-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(mockFrom).toHaveBeenCalledWith('rfi_responses')
  })

  it('returns empty array when no responses exist', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await rfiService.loadResponses('rfi-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'permission denied' }))

    const result = await rfiService.loadResponses('rfi-1')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// addResponse — inserts response then transitions status to answered
// ---------------------------------------------------------------------------
describe('rfiService.addResponse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts response with user_id and triggers status transition', async () => {
    mockSession('arch-1')
    const insertChain = makeChain([], null, null)
    const fetchChain = makeChain([], null, {
      status: 'under_review',
      created_by: 'user-1',
      assigned_to: 'arch-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'project_manager' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await rfiService.addResponse('rfi-1', 'Use W12x26 as specified per SE')

    expect(result.error).toBeNull()
    const insertCall = insertChain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.rfi_id).toBe('rfi-1')
    expect(payload.user_id).toBe('arch-1')
    expect(payload.response_text).toBe('Use W12x26 as specified per SE')
  })

  it('includes attachments in the insert payload when provided', async () => {
    mockSession('user-1')
    const insertChain = makeChain([], null, null)
    const fetchChain = makeChain([], null, {
      status: 'under_review',
      created_by: 'user-1',
      assigned_to: null,
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'admin' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    await rfiService.addResponse('rfi-1', 'See attached sketch', ['sketch.pdf', 'detail.jpg'])

    const insertCall = insertChain.insert as ReturnType<typeof vi.fn>
    expect(insertCall.mock.calls[0][0].attachments).toEqual(['sketch.pdf', 'detail.jpg'])
  })

  it('returns DatabaseError when response insert fails', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'fk violation' }))

    const result = await rfiService.addResponse('rfi-1', 'test response')

    expect(result.error?.category).toBe('DatabaseError')
  })

  it('returns partial-failure error when insert succeeds but transition fails', async () => {
    mockSession('user-1')
    const insertChain = makeChain([], null, null)
    const fetchChain = makeChain(null, { message: 'rfi not found' })

    mockFrom.mockReturnValueOnce(insertChain).mockReturnValueOnce(fetchChain)

    const result = await rfiService.addResponse('rfi-1', 'Response text')

    expect(result.error).toBeTruthy()
    expect(result.error?.message).toContain('Response saved but status transition failed')
  })
})
