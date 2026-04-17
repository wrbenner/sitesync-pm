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

import { paymentService, getValidPaymentTransitions } from './paymentService'

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

const PAY_APP = { id: 'app-1', status: 'draft', project_id: 'proj-1' }

// ---------------------------------------------------------------------------
// getValidPaymentTransitions unit tests
// ---------------------------------------------------------------------------
describe('getValidPaymentTransitions', () => {
  it('draft → submitted for non-viewers', () => {
    expect(getValidPaymentTransitions('draft', 'gc_member')).toContain('submitted')
  })

  it('draft → void for gc roles', () => {
    expect(getValidPaymentTransitions('draft', 'project_manager')).toContain('void')
  })

  it('viewer gets no transitions from draft', () => {
    expect(getValidPaymentTransitions('draft', 'viewer')).toEqual([])
  })

  it('approved → paid only for owner/admin', () => {
    expect(getValidPaymentTransitions('approved', 'owner')).toContain('paid')
    expect(getValidPaymentTransitions('approved', 'gc_member')).not.toContain('paid')
  })

  it('paid and void are terminal', () => {
    expect(getValidPaymentTransitions('paid', 'owner')).toEqual([])
    expect(getValidPaymentTransitions('void', 'admin')).toEqual([])
  })

  it('gc_review → owner_review for gc, → approved for owner', () => {
    expect(getValidPaymentTransitions('gc_review', 'project_manager')).toContain('owner_review')
    expect(getValidPaymentTransitions('gc_review', 'owner')).toContain('approved')
  })
})

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------
describe('paymentService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('successfully transitions draft → submitted', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, PAY_APP))
      .mockReturnValueOnce(makeChain(null, null, { role: 'gc_member' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await paymentService.transitionStatus('app-1', 'submitted')
    expect(result.error).toBeNull()
  })

  it('returns NotFoundError when pay application missing', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }, null))
    mockSession()

    const result = await paymentService.transitionStatus('app-1', 'submitted')
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user has no project role', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, PAY_APP))
      .mockReturnValueOnce(makeChain(null, null, null))
    mockSession()

    const result = await paymentService.transitionStatus('app-1', 'submitted')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ValidationError for invalid transition', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, PAY_APP))
      .mockReturnValueOnce(makeChain(null, null, { role: 'viewer' }))
    mockSession()

    const result = await paymentService.transitionStatus('app-1', 'approved')
    expect(result.error?.category).toBe('ValidationError')
  })

  it('returns DatabaseError when update fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, PAY_APP))
      .mockReturnValueOnce(makeChain(null, null, { role: 'gc_member' }))
      .mockReturnValueOnce(makeChain(null, { message: 'DB update failed' }))
    mockSession()

    const result = await paymentService.transitionStatus('app-1', 'submitted')
    expect(result.error?.category).toBe('DatabaseError')
  })

  it('sets submitted_date when transitioning to submitted', async () => {
    const updateChain = makeChain([], null)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, PAY_APP))
      .mockReturnValueOnce(makeChain(null, null, { role: 'gc_member' }))
      .mockReturnValueOnce(updateChain)
    mockSession()

    await paymentService.transitionStatus('app-1', 'submitted')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ submitted_date: expect.any(String) }),
    )
  })

  it('sets certified_date and certified_by when transitioning to approved', async () => {
    const updateChain = makeChain([], null)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...PAY_APP, status: 'owner_review' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'owner' }))
      .mockReturnValueOnce(updateChain)
    mockSession('user-owner')

    await paymentService.transitionStatus('app-1', 'approved')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ certified_date: expect.any(String), certified_by: 'user-owner' }),
    )
  })

  it('sets paid_date when transitioning to paid', async () => {
    const updateChain = makeChain([], null)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...PAY_APP, status: 'approved' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'owner' }))
      .mockReturnValueOnce(updateChain)
    mockSession()

    await paymentService.transitionStatus('app-1', 'paid')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ paid_date: expect.any(String) }),
    )
  })
})

// ---------------------------------------------------------------------------
// updatePayApplication
// ---------------------------------------------------------------------------
describe('paymentService.updatePayApplication', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates non-status fields successfully', async () => {
    mockFrom.mockReturnValueOnce(makeChain([], null))

    const result = await paymentService.updatePayApplication('app-1', { description: 'Updated' })
    expect(result.error).toBeNull()
  })

  it('strips status field to prevent bypass', async () => {
    const chain = makeChain([], null)
    mockFrom.mockReturnValueOnce(chain)

    await paymentService.updatePayApplication('app-1', { status: 'approved', description: 'Test' })
    expect(chain.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: 'approved' }),
    )
  })

  it('returns DatabaseError on update failure', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'DB error' }))

    const result = await paymentService.updatePayApplication('app-1', { description: 'Test' })
    expect(result.error?.category).toBe('DatabaseError')
  })
})
