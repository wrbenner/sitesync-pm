import { describe, it, expect, vi, beforeEach } from 'vitest'
import { changeOrderService } from './changeOrderService'

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
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(result)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  return chain
}

const USER_ID = 'user-pm'
const PROJECT_ID = 'proj-001'

function authSession() {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } } })
}

// ── Tests ─────────────────────────────────────────────────

describe('loadChangeOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active (non-deleted) change orders', async () => {
    const rows = [
      { id: 'co1', title: 'Extra Concrete', status: 'draft', deleted_at: null },
      { id: 'co2', title: 'Owner Add', status: 'approved', deleted_at: null },
      { id: 'co3', title: 'Voided CO', status: 'void', deleted_at: '2026-03-01' },
    ]
    mockFrom.mockReturnValue(makeChain({ data: rows, error: null }))

    const result = await changeOrderService.loadChangeOrders(PROJECT_ID)

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(result.data!.find((co) => co.id === 'co3')).toBeUndefined()
  })

  it('returns error message on DB failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'access denied' } }))
    const result = await changeOrderService.loadChangeOrders(PROJECT_ID)
    expect(result.data).toBeNull()
    expect(result.error).toBe('access denied')
  })
})

describe('createChangeOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('creates a change order in draft status', async () => {
    const created = { id: 'new-co', description: 'Add outlet', status: 'draft', type: 'pco', project_id: PROJECT_ID }
    mockFrom.mockReturnValue(makeChain({ data: created, error: null }))

    const result = await changeOrderService.createChangeOrder({
      project_id: PROJECT_ID,
      description: 'Add outlet',
      type: 'pco',
    })

    expect(result.error).toBeNull()
    expect(result.data!.status).toBe('draft')
  })

  it('includes created_by from session in the insert payload', async () => {
    const insertChain = makeChain({ data: { id: 'co-new' }, error: null })
    mockFrom.mockReturnValue(insertChain)

    await changeOrderService.createChangeOrder({ project_id: PROJECT_ID, description: 'Test' })

    const insertArgs = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArgs.created_by).toBe(USER_ID)
    expect(insertArgs.status).toBe('draft')
  })

  it('returns error on insert failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'constraint violation' } }))
    const result = await changeOrderService.createChangeOrder({ project_id: PROJECT_ID, description: 'Bad' })
    expect(result.error).toBe('constraint violation')
  })
})

describe('transitionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('transitions draft to pending_review for a superintendent', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'draft', project_id: PROJECT_ID, type: 'pco' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { role: 'superintendent' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    const result = await changeOrderService.transitionStatus('co-1', 'pending_review')

    expect(result.error).toBeNull()
  })

  it('transitions pending_review to approved for a project_manager', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'pending_review', project_id: PROJECT_ID, type: 'pco' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { role: 'project_manager' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    const result = await changeOrderService.transitionStatus('co-1', 'approved')

    expect(result.error).toBeNull()
  })

  it('writes approved_by and approved_at provenance on approval', async () => {
    const updateChain = makeChain({ data: null, error: null })
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'pending_review', project_id: PROJECT_ID, type: 'pco' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { role: 'project_manager' }, error: null }))
      .mockReturnValueOnce(updateChain)

    await changeOrderService.transitionStatus('co-1', 'approved', 'Looks good')

    const updateArgs = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArgs.approved_by).toBe(USER_ID)
    expect(updateArgs.approved_at).toBeTruthy()
    expect(updateArgs.approval_comments).toBe('Looks good')
  })

  it('rejects invalid transition and returns descriptive error', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'approved', project_id: PROJECT_ID, type: 'co' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { role: 'superintendent' }, error: null }))

    const result = await changeOrderService.transitionStatus('co-1', 'pending_review')

    expect(result.error).toMatch(/Invalid transition/)
  })

  it('rejects when user is not a project member', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { status: 'draft', project_id: PROJECT_ID, type: 'pco' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    const result = await changeOrderService.transitionStatus('co-1', 'pending_review')

    expect(result.error).toMatch(/not a member/)
  })
})

describe('updateChangeOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('strips status from updates to prevent bypassing the state machine', async () => {
    const updateChain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(updateChain)

    await changeOrderService.updateChangeOrder('co-1', {
      title: 'Revised title',
      status: 'approved' as never,
    } as Parameters<typeof changeOrderService.updateChangeOrder>[1])

    const updateArgs = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArgs).not.toHaveProperty('status')
    expect(updateArgs.title).toBe('Revised title')
  })

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'row locked' } }))
    const result = await changeOrderService.updateChangeOrder('co-1', { title: 'New' })
    expect(result.error).toBe('row locked')
  })
})

describe('deleteChangeOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('soft-deletes by setting deleted_at and deleted_by', async () => {
    const updateChain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(updateChain)

    const result = await changeOrderService.deleteChangeOrder('co-1')

    expect(result.error).toBeNull()
    const updateArgs = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArgs).toHaveProperty('deleted_at')
    expect(updateArgs).toHaveProperty('deleted_by', USER_ID)
  })
})

describe('promoteType', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authSession()
  })

  it('promotes an approved PCO to COR', async () => {
    const co = {
      id: 'co-1',
      project_id: PROJECT_ID,
      description: 'Extra outlets',
      title: 'Electrical Add',
      amount: 5000,
      approved_amount: 5000,
      status: 'approved',
      type: 'pco',
      reason: 'owner_change',
      cost_code: '16-001',
      schedule_impact: null,
    }
    const promoted = { id: 'co-2', type: 'cor', status: 'draft' }

    mockFrom
      .mockReturnValueOnce(makeChain({ data: co, error: null }))          // fetch CO
      .mockReturnValueOnce(makeChain({ data: { role: 'project_manager' }, error: null })) // role
      .mockReturnValueOnce(makeChain({ data: promoted, error: null }))    // insert promoted
      .mockReturnValueOnce(makeChain({ data: null, error: null }))        // mark source promoted

    const result = await changeOrderService.promoteType('co-1')

    expect(result.error).toBeNull()
    expect(result.data!.type).toBe('cor')
  })

  it('rejects promotion of a non-approved change order', async () => {
    const co = { id: 'co-1', status: 'draft', type: 'pco', project_id: PROJECT_ID }
    mockFrom.mockReturnValueOnce(makeChain({ data: co, error: null }))

    const result = await changeOrderService.promoteType('co-1')

    expect(result.error).toMatch(/approved/)
  })

  it('rejects promotion of a final CO (cannot go further)', async () => {
    const co = { id: 'co-1', status: 'approved', type: 'co', project_id: PROJECT_ID }
    mockFrom.mockReturnValueOnce(makeChain({ data: co, error: null }))

    const result = await changeOrderService.promoteType('co-1')

    expect(result.error).toMatch(/cannot be promoted/)
  })

  it('returns error when change order is not found', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: { message: 'not found' } }))
    const result = await changeOrderService.promoteType('bad-id')
    expect(result.error).toBeTruthy()
  })
})
