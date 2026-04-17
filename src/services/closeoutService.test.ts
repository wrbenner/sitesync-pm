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

import { closeoutService, getValidCloseoutTransitions } from './closeoutService'

// ---------------------------------------------------------------------------
// Chain builder
// ---------------------------------------------------------------------------
function makeChain(
  listData: unknown[] | null = [],
  error: { message: string } | null = null,
  singleData?: unknown,
) {
  const singleResult = {
    data: singleData !== undefined ? singleData : (Array.isArray(listData) && listData.length > 0 ? listData[0] : null),
    error,
  }
  const listResult = { data: listData, error }
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq     = vi.fn().mockReturnValue(chain)
  chain.is     = vi.fn().mockReturnValue(chain)
  chain.order  = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.then   = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

function mockSession(userId = 'user-1') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

const ITEM = { id: 'item-1', status: 'required', project_id: 'proj-1' }

// ---------------------------------------------------------------------------
// getValidCloseoutTransitions unit tests
// ---------------------------------------------------------------------------
describe('getValidCloseoutTransitions', () => {
  it('required → requested for gc roles', () => {
    expect(getValidCloseoutTransitions('required', 'project_manager')).toContain('requested')
    expect(getValidCloseoutTransitions('required', 'superintendent')).toContain('requested')
  })

  it('required: viewer and non-gc get no transitions', () => {
    expect(getValidCloseoutTransitions('required', 'viewer')).toEqual([])
    expect(getValidCloseoutTransitions('required', 'subcontractor')).toEqual([])
  })

  it('requested → submitted for non-viewers', () => {
    expect(getValidCloseoutTransitions('requested', 'subcontractor')).toContain('submitted')
    expect(getValidCloseoutTransitions('requested', 'viewer')).toEqual([])
  })

  it('submitted → under_review and approved for reviewers', () => {
    const transitions = getValidCloseoutTransitions('submitted', 'architect')
    expect(transitions).toContain('under_review')
    expect(transitions).toContain('approved')
  })

  it('under_review → approved or rejected for reviewers', () => {
    const transitions = getValidCloseoutTransitions('under_review', 'admin')
    expect(transitions).toContain('approved')
    expect(transitions).toContain('rejected')
  })

  it('rejected → submitted for non-viewers (resubmit)', () => {
    expect(getValidCloseoutTransitions('rejected', 'subcontractor')).toContain('submitted')
    expect(getValidCloseoutTransitions('rejected', 'viewer')).toEqual([])
  })

  it('approved is terminal', () => {
    expect(getValidCloseoutTransitions('approved', 'owner')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------
describe('closeoutService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('successfully transitions required → requested', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, ITEM))
      .mockReturnValueOnce(makeChain(null, null, { role: 'project_manager' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await closeoutService.transitionStatus('item-1', 'requested')
    expect(result.error).toBeNull()
  })

  it('returns NotFoundError when closeout item missing', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }, null))
    mockSession()

    const result = await closeoutService.transitionStatus('item-1', 'requested')
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user has no project role', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, ITEM))
      .mockReturnValueOnce(makeChain(null, null, null))
    mockSession()

    const result = await closeoutService.transitionStatus('item-1', 'requested')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ValidationError for invalid transition', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, ITEM))
      .mockReturnValueOnce(makeChain(null, null, { role: 'subcontractor' }))
    mockSession()

    // subcontractor cannot move from required (only gc can)
    const result = await closeoutService.transitionStatus('item-1', 'requested')
    expect(result.error?.category).toBe('ValidationError')
  })

  it('returns DatabaseError when update fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, ITEM))
      .mockReturnValueOnce(makeChain(null, null, { role: 'project_manager' }))
      .mockReturnValueOnce(makeChain(null, { message: 'update failed' }))
    mockSession()

    const result = await closeoutService.transitionStatus('item-1', 'requested')
    expect(result.error?.category).toBe('DatabaseError')
  })

  it('sets completed_date when transitioning to approved', async () => {
    const updateChain = makeChain([], null)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...ITEM, status: 'under_review' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'admin' }))
      .mockReturnValueOnce(updateChain)
    mockSession()

    await closeoutService.transitionStatus('item-1', 'approved')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ completed_date: expect.any(String) }),
    )
  })

  it('does NOT set completed_date for non-approved transitions', async () => {
    const updateChain = makeChain([], null)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...ITEM, status: 'submitted' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'admin' }))
      .mockReturnValueOnce(updateChain)
    mockSession()

    await closeoutService.transitionStatus('item-1', 'under_review')
    expect(updateChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ completed_date: expect.anything() }),
    )
  })
})

// ---------------------------------------------------------------------------
// updateCloseoutItem
// ---------------------------------------------------------------------------
describe('closeoutService.updateCloseoutItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates non-status fields successfully', async () => {
    mockFrom.mockReturnValueOnce(makeChain([], null))

    const result = await closeoutService.updateCloseoutItem('item-1', { notes: 'Updated' })
    expect(result.error).toBeNull()
  })

  it('strips status field to prevent bypass', async () => {
    const chain = makeChain([], null)
    mockFrom.mockReturnValueOnce(chain)

    await closeoutService.updateCloseoutItem('item-1', { status: 'approved', notes: 'Test' })
    expect(chain.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: 'approved' }),
    )
  })

  it('returns DatabaseError on update failure', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'DB error' }))

    const result = await closeoutService.updateCloseoutItem('item-1', { notes: 'Test' })
    expect(result.error?.category).toBe('DatabaseError')
  })
})
