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

// Mock rfiMachine to avoid xstate / theme dependencies
vi.mock('../machines/rfiMachine', () => ({
  getValidRfiTargetStates: vi.fn((status: string, role: string) => {
    const isAdminOrOwner = role === 'admin' || role === 'owner'
    const base: Record<string, string[]> = {
      draft: ['open'],
      open: ['under_review', 'closed'],
      under_review: ['answered', 'closed'],
      answered: ['closed', 'open'],
      closed: ['open'],
      void: [],
    }
    const result = [...(base[status] || [])]
    if (isAdminOrOwner && status !== 'void') result.push('void')
    return result
  }),
  getBallInCourt: vi.fn(() => null),
}))

// Mock stateMachineUtils so logTransition is a no-op in tests
vi.mock('./stateMachineUtils', () => ({
  validateTransition: vi.fn((entityType: string, currentState: string, newState: string, validTargets: string[]) => {
    if (!validTargets.includes(newState)) {
      return {
        category: 'ValidationError',
        code: 'INVALID_TRANSITION',
        message: `Invalid transition: "${currentState}" → "${newState}" is not allowed for ${entityType}. Valid targets: [${validTargets.join(', ')}]`,
        userMessage: `Invalid transition: "${currentState}" → "${newState}" is not allowed for ${entityType}. Valid targets: [${validTargets.join(', ')}]`,
        context: { entityType, currentState, newState, validTargets },
      }
    }
    return null
  }),
  logTransition: vi.fn().mockResolvedValue(undefined),
}))

import { rfiService } from './rfiService'

// ---------------------------------------------------------------------------
// Chain builder
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
  title: 'Clarification on footing depth',
  status: 'draft',
  created_by: 'user-1',
  assigned_to: null,
  rfi_number: 1,
  deleted_at: null,
}

// ---------------------------------------------------------------------------
// transitionStatus — core tests for the fixed state-to-state validation
// ---------------------------------------------------------------------------

describe('rfiService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows valid transition draft → open for gc_member', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const rfiChain = makeChain([RFI], null, RFI)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(rfiChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await rfiService.transitionStatus('rfi-1', 'open')
    expect(result.error).toBeNull()
  })

  it('rejects invalid transition draft → closed (skipping states)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const rfiChain = makeChain([RFI], null, RFI)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })

    mockFrom
      .mockReturnValueOnce(rfiChain)
      .mockReturnValueOnce(roleChain)

    const result = await rfiService.transitionStatus('rfi-1', 'closed')
    expect(result.error).not.toBeNull()
    expect(result.error!.message).toContain('Invalid transition')
    expect(result.error!.message).toContain('draft')
    expect(result.error!.message).toContain('closed')
  })

  it('rejects transition when user is not a project member', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'stranger' } } } })

    const rfiChain = makeChain([RFI], null, RFI)
    const roleChain = makeChain([null], null, null)
    roleChain.single = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(rfiChain)
      .mockReturnValueOnce(roleChain)

    const result = await rfiService.transitionStatus('rfi-1', 'open')
    expect(result.error).not.toBeNull()
    expect(result.error!.message).toContain('not a member')
  })

  it('returns error when RFI is not found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain(null, null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await rfiService.transitionStatus('rfi-missing', 'open')
    expect(result.error).not.toBeNull()
  })

  it('allows void transition for admin (role-based)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'admin-1' } } } })

    const openRfi = { ...RFI, status: 'open' }
    const rfiChain = makeChain([openRfi], null, openRfi)
    const roleChain = makeChain([{ role: 'admin' }], null, { role: 'admin' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(rfiChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await rfiService.transitionStatus('rfi-1', 'void')
    expect(result.error).toBeNull()
  })

  it('rejects void transition for non-admin', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const openRfi = { ...RFI, status: 'open' }
    const rfiChain = makeChain([openRfi], null, openRfi)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })

    mockFrom
      .mockReturnValueOnce(rfiChain)
      .mockReturnValueOnce(roleChain)

    const result = await rfiService.transitionStatus('rfi-1', 'void')
    expect(result.error).not.toBeNull()
    expect(result.error!.message).toContain('Invalid transition')
  })

  it('sets closed_date when transitioning to closed', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const openRfi = { ...RFI, status: 'open' }
    const rfiChain = makeChain([openRfi], null, openRfi)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(rfiChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    await rfiService.transitionStatus('rfi-1', 'closed')

    const updatePayload = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toHaveProperty('closed_date')
    expect(updatePayload.status).toBe('closed')
  })

  it('returns db error when update fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const rfiChain = makeChain([RFI], null, RFI)
    const roleChain = makeChain([{ role: 'gc_member' }], null, { role: 'gc_member' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: { message: 'constraint violation' } })

    mockFrom
      .mockReturnValueOnce(rfiChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await rfiService.transitionStatus('rfi-1', 'open')
    expect(result.error!.message).toBe('constraint violation')
  })
})

// ---------------------------------------------------------------------------
// createRfi
// ---------------------------------------------------------------------------

describe('rfiService.createRfi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates RFI in draft status with created_by provenance', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain([RFI], null, RFI)
    chain.insert = vi.fn().mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const result = await rfiService.createRfi({
      project_id: 'proj-1',
      title: 'Clarification on footing depth',
      priority: 'high',
    })

    expect(result.error).toBeNull()
    const insertPayload = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.status).toBe('draft')
    expect(insertPayload.created_by).toBe('user-1')
  })

  it('returns error when insert fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const chain = makeChain(null, null)
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })
    mockFrom.mockReturnValue(chain)

    const result = await rfiService.createRfi({ project_id: 'proj-1', title: 'X', priority: 'low' })
    expect(result.error?.message).toBe('insert failed')
    expect(result.data).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// updateRfi
// ---------------------------------------------------------------------------

describe('rfiService.updateRfi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status from updates to prevent state machine bypass', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await rfiService.updateRfi('rfi-1', { title: 'Updated Title', status: 'closed' } as never)

    const updatePayload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).not.toHaveProperty('status')
    expect(updatePayload.title).toBe('Updated Title')
    expect(updatePayload.updated_by).toBe('user-1')
  })
})
