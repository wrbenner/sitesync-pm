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

// Mock the changeOrderMachine to avoid xstate/theme dependencies
vi.mock('../machines/changeOrderMachine', () => ({
  getValidCOTransitionsForRole: vi.fn((status: string, role: string) => {
    const isAdmin = ['admin', 'owner'].includes(role)
    const isApprover = ['project_manager', 'owner_rep', 'architect', 'owner'].includes(role)
    const isSubmitter = ['superintendent', 'foreman', 'project_manager', 'subcontractor'].includes(role)

    if (status === 'draft') {
      if (isAdmin || isSubmitter) return ['pending_review']
      return []
    }
    if (status === 'pending_review') {
      if (isAdmin) return ['approved', 'rejected', 'void']
      if (isApprover) return ['approved', 'rejected']
      return []
    }
    if (status === 'approved') {
      if (isAdmin) return ['void']
      return []
    }
    if (status === 'rejected') {
      if (isAdmin) return ['pending_review', 'void']
      if (isSubmitter) return ['pending_review']
      return []
    }
    return []
  }),
}))

import { changeOrderService } from './changeOrderService'

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
const CO = {
  id: 'co-1',
  project_id: 'proj-1',
  title: 'Additional Excavation',
  description: 'Unforeseen rock encountered during excavation',
  status: 'draft',
  type: 'pco',
  amount: 15000_00, // cents
  approved_amount: null,
  reason: 'field_condition',
  cost_code: '02 00 00',
  schedule_impact: '3 days',
  number: 1,
  created_by: 'user-1',
  updated_by: null,
  parent_co_id: null,
  submitted_by: null,
  submitted_at: null,
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejected_at: null,
  deleted_at: null,
}

describe('changeOrderService.loadChangeOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active change orders (no deleted_at)', async () => {
    const data = [CO, { ...CO, id: 'co-2', deleted_at: null }]
    mockFrom.mockReturnValue(makeChain(data))

    const result = await changeOrderService.loadChangeOrders('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
  })

  it('filters out soft-deleted records in memory', async () => {
    const deletedCO = { ...CO, id: 'co-deleted', deleted_at: '2026-04-01T00:00:00Z' }
    const data = [CO, deletedCO]
    mockFrom.mockReturnValue(makeChain(data))

    const result = await changeOrderService.loadChangeOrders('proj-1')

    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe('co-1')
  })

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'connection refused' }))

    const result = await changeOrderService.loadChangeOrders('proj-1')
    expect(result.error?.message).toBe('connection refused')
    expect(result.data).toBeNull()
  })
})

describe('changeOrderService.createChangeOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates CO in draft status with provenance', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain([CO], null, CO)
    chain.insert = vi.fn().mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const result = await changeOrderService.createChangeOrder({
      project_id: 'proj-1',
      description: 'Unforeseen rock encountered',
      title: 'Additional Excavation',
      amount: 15000_00,
      type: 'pco',
      reason: 'field_condition',
    })

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    const insertPayload = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.status).toBe('draft')
    expect(insertPayload.created_by).toBe('user-1')
  })

  it('defaults type to pco when not specified', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const chain = makeChain([CO], null, CO)
    chain.insert = vi.fn().mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    await changeOrderService.createChangeOrder({
      project_id: 'proj-1',
      description: 'Some change',
    })

    const insertPayload = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.type).toBe('pco')
  })
})

describe('changeOrderService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('transitions draft to pending_review for superintendent', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const coChain = makeChain([CO], null, CO)
    const roleChain = makeChain([{ role: 'superintendent' }], null, { role: 'superintendent' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(coChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await changeOrderService.transitionStatus('co-1', 'pending_review')
    expect(result.error).toBeNull()
  })

  it('transitions pending_review to approved for project_manager (approver)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'pm-1' } } } })

    const pendingCO = { ...CO, status: 'pending_review' }
    const coChain = makeChain([pendingCO], null, pendingCO)
    const roleChain = makeChain([{ role: 'project_manager' }], null, { role: 'project_manager' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(coChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await changeOrderService.transitionStatus('co-1', 'approved', 'Approved per scope review')
    expect(result.error).toBeNull()

    const updatePayload = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload.approved_by).toBe('pm-1')
    expect(updatePayload.approval_comments).toBe('Approved per scope review')
  })

  it('rejects invalid transition (draft → approved)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    const coChain = makeChain([CO], null, CO)
    const roleChain = makeChain([{ role: 'superintendent' }], null, { role: 'superintendent' })

    mockFrom
      .mockReturnValueOnce(coChain)
      .mockReturnValueOnce(roleChain)

    const result = await changeOrderService.transitionStatus('co-1', 'approved')
    expect(result.error?.message).toContain('Invalid transition')
  })

  it('returns error when user is not a project member', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'stranger' } } } })

    const coChain = makeChain([CO], null, CO)
    const roleChain = makeChain([null], null, null)
    roleChain.single = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(coChain)
      .mockReturnValueOnce(roleChain)

    const result = await changeOrderService.transitionStatus('co-1', 'pending_review')
    expect(result.error?.message).toContain('not a member')
  })

  it('returns error when change order not found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain(null, null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await changeOrderService.transitionStatus('co-missing', 'pending_review')
    expect(result.error).toBeTruthy()
  })

  it('writes rejected_at provenance when transitioning to rejected', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'admin-1' } } } })

    const pendingCO = { ...CO, status: 'pending_review' }
    const coChain = makeChain([pendingCO], null, pendingCO)
    const roleChain = makeChain([{ role: 'admin' }], null, { role: 'admin' })
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(coChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    await changeOrderService.transitionStatus('co-1', 'rejected', 'Scope not justified')

    const updatePayload = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toHaveProperty('rejected_at')
    expect(updatePayload.rejection_comments).toBe('Scope not justified')
  })
})

describe('changeOrderService.updateChangeOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status from updates to prevent state machine bypass', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await changeOrderService.updateChangeOrder('co-1', {
      title: 'Updated Title',
      amount: 20000_00,
      status: 'approved',
    } as never)

    const updatePayload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).not.toHaveProperty('status')
    expect(updatePayload.title).toBe('Updated Title')
    expect(updatePayload.updated_by).toBe('user-1')
  })
})

describe('changeOrderService.deleteChangeOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by setting deleted_at', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await changeOrderService.deleteChangeOrder('co-1')

    expect(result.error).toBeNull()
    const updatePayload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toHaveProperty('deleted_at')
    expect(updatePayload).toHaveProperty('deleted_by', 'user-1')
  })

  it('returns error when update fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    mockFrom.mockReturnValue(chain)

    const result = await changeOrderService.deleteChangeOrder('co-1')
    expect(result.error?.message).toBe('forbidden')
  })
})

describe('changeOrderService.promoteType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('promotes an approved PCO to COR', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'pm-1' } } } })

    const approvedPCO = { ...CO, status: 'approved', type: 'pco' }
    const newCOR = { ...CO, id: 'co-2', type: 'cor', status: 'draft' }

    const fetchChain = makeChain([approvedPCO], null, approvedPCO)
    const roleChain = makeChain([{ role: 'project_manager' }], null, { role: 'project_manager' })
    const insertChain = makeChain([newCOR], null, newCOR)
    insertChain.insert = vi.fn().mockReturnValue(insertChain)
    const updateChain: Record<string, unknown> = {}
    updateChain.update = vi.fn().mockReturnValue(updateChain)
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(updateChain)

    const result = await changeOrderService.promoteType('co-1')

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    const insertPayload = (insertChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.type).toBe('cor')
    expect(insertPayload.status).toBe('draft')
    expect(insertPayload.promoted_from_id).toBe('co-1')
  })

  it('prevents promotion when CO is not approved', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const draftPCO = { ...CO, status: 'draft', type: 'pco' }
    const chain = makeChain([draftPCO], null, draftPCO)
    mockFrom.mockReturnValueOnce(chain)

    const result = await changeOrderService.promoteType('co-1')
    expect(result.error?.message).toContain('approved')
  })

  it('prevents promotion when type is already CO (end of chain)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const approvedCO = { ...CO, status: 'approved', type: 'co' }
    const chain = makeChain([approvedCO], null, approvedCO)
    mockFrom.mockReturnValueOnce(chain)

    const result = await changeOrderService.promoteType('co-1')
    expect(result.error?.message).toContain('cannot be promoted further')
  })

  it('returns error when user is not a project member', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'stranger' } } } })
    const approvedPCO = { ...CO, status: 'approved', type: 'pco' }
    const fetchChain = makeChain([approvedPCO], null, approvedPCO)
    const roleChain = makeChain([null], null, null)
    roleChain.single = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    const result = await changeOrderService.promoteType('co-1')
    expect(result.error?.message).toContain('not a member')
  })

  it('returns error when source CO not found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    const chain = makeChain(null, null)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await changeOrderService.promoteType('co-missing')
    expect(result.error).toBeTruthy()
  })
})
