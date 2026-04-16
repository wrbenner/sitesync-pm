import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  dbError,
  permissionError,
  notFoundError,
  validationError,
  conflictError,
  ok,
  fail,
  type ServiceError,
} from '../../services/errors'

// ---------------------------------------------------------------------------
// Supabase mock — shared chain builder
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIs = vi.fn()
const mockOrder = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-abc' } } },
      }),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

function buildChain(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: mockSelect,
    eq: mockEq,
    is: mockIs,
    order: mockOrder,
    update: mockUpdate,
    insert: mockInsert,
    single: mockSingle,
    ...overrides,
  }
  // Make each method return the chain (fluent builder)
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
  mockIs.mockReturnValue(chain)
  mockOrder.mockReturnValue(chain)
  mockUpdate.mockReturnValue(chain)
  mockInsert.mockReturnValue(chain)
  mockFrom.mockReturnValue(chain)
  return chain
}

// ---------------------------------------------------------------------------
// Error factory unit tests
// ---------------------------------------------------------------------------

describe('ServiceError factories', () => {
  describe('dbError', () => {
    it('returns DatabaseError category with generic userMessage', () => {
      const err = dbError('relation "foo" does not exist')
      expect(err.category).toBe('DatabaseError')
      expect(err.code).toBe('DB_ERROR')
      expect(err.message).toBe('relation "foo" does not exist')
      expect(err.userMessage).toBe('A database error occurred. Please try again.')
    })

    it('attaches context when provided', () => {
      const err = dbError('oops', { table: 'rfis' })
      expect(err.context).toEqual({ table: 'rfis' })
    })
  })

  describe('permissionError', () => {
    it('returns PermissionError category', () => {
      const err = permissionError('User is not a member of this project')
      expect(err.category).toBe('PermissionError')
      expect(err.code).toBe('PERMISSION_DENIED')
      expect(err.userMessage).toBe('You do not have permission to perform this action.')
    })
  })

  describe('notFoundError', () => {
    it('returns NotFoundError with entity name in userMessage', () => {
      const err = notFoundError('RFI', 'rfi-123')
      expect(err.category).toBe('NotFoundError')
      expect(err.code).toBe('NOT_FOUND')
      expect(err.userMessage).toContain('RFI')
      expect(err.context).toEqual({ id: 'rfi-123' })
    })

    it('omits context when no id provided', () => {
      const err = notFoundError('Change order')
      expect(err.context).toBeUndefined()
    })
  })

  describe('validationError', () => {
    it('returns ValidationError with message as userMessage', () => {
      const err = validationError('Invalid transition: draft → closed')
      expect(err.category).toBe('ValidationError')
      expect(err.userMessage).toBe('Invalid transition: draft → closed')
    })

    it('attaches context when provided', () => {
      const err = validationError('bad transition', { from: 'draft', to: 'closed' })
      expect(err.context).toEqual({ from: 'draft', to: 'closed' })
    })
  })

  describe('conflictError', () => {
    it('returns ConflictError category', () => {
      const err = conflictError('Only approved change orders can be promoted')
      expect(err.category).toBe('ConflictError')
      expect(err.code).toBe('CONFLICT')
      expect(err.userMessage).toBe('Only approved change orders can be promoted')
    })
  })

  describe('ok / fail helpers', () => {
    it('ok wraps data with null error', () => {
      const result = ok([1, 2, 3])
      expect(result.data).toEqual([1, 2, 3])
      expect(result.error).toBeNull()
    })

    it('fail wraps ServiceError with null data', () => {
      const svcErr: ServiceError = dbError('boom')
      const result = fail(svcErr)
      expect(result.data).toBeNull()
      expect(result.error).toBe(svcErr)
    })
  })
})

// ---------------------------------------------------------------------------
// rfiService error path tests
// ---------------------------------------------------------------------------

describe('rfiService error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadRfis returns DatabaseError when Supabase errors', async () => {
    buildChain()
    mockOrder.mockResolvedValue({ data: null, error: { message: 'connection refused' } })

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.loadRfis('proj-1')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.userMessage).toBe('A database error occurred. Please try again.')
  })

  it('loadRfis returns data array on success', async () => {
    const rfis = [{ id: 'rfi-1', title: 'Wall detail' }]
    buildChain()
    mockOrder.mockResolvedValue({ data: rfis, error: null })

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.loadRfis('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(rfis)
  })

  it('transitionStatus returns PermissionError when user not in project', async () => {
    buildChain()
    // First call: fetch RFI (returns valid rfi)
    mockSingle
      .mockResolvedValueOnce({
        data: { status: 'draft', created_by: 'u1', assigned_to: null, project_id: 'proj-1' },
        error: null,
      })
      // Second call: resolveProjectRole (returns no membership)
      .mockResolvedValueOnce({ data: null, error: null })

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.transitionStatus('rfi-1', 'open' as import('../../types/database').RfiStatus)

    expect(result.error?.category).toBe('PermissionError')
    expect(result.error?.userMessage).toBe('You do not have permission to perform this action.')
  })

  it('transitionStatus returns NotFoundError when RFI does not exist', async () => {
    buildChain()
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'no rows returned' } })

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.transitionStatus('rfi-missing', 'open' as import('../../types/database').RfiStatus)

    expect(result.error?.category).toBe('NotFoundError')
  })
})

// ---------------------------------------------------------------------------
// changeOrderService error path tests
// ---------------------------------------------------------------------------

describe('changeOrderService error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createChangeOrder returns DatabaseError on insert failure', async () => {
    buildChain()
    mockSingle.mockResolvedValue({ data: null, error: { message: 'duplicate key value' } })

    const { changeOrderService } = await import('../../services/changeOrderService')
    const result = await changeOrderService.createChangeOrder({
      project_id: 'proj-1',
      description: 'Extra foundation work',
    })

    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.userMessage).toBe('A database error occurred. Please try again.')
  })

  it('promoteType returns ConflictError when CO type is already co', async () => {
    buildChain()
    mockSingle.mockResolvedValueOnce({
      data: { id: 'co-1', type: 'co', status: 'approved', project_id: 'proj-1' },
      error: null,
    })

    const { changeOrderService } = await import('../../services/changeOrderService')
    const result = await changeOrderService.promoteType('co-1')

    expect(result.error?.category).toBe('ConflictError')
    expect(result.error?.message).toContain('cannot be promoted further')
  })

  it('promoteType returns ConflictError when CO is not approved', async () => {
    buildChain()
    mockSingle.mockResolvedValueOnce({
      data: { id: 'pco-1', type: 'pco', status: 'draft', project_id: 'proj-1' },
      error: null,
    })

    const { changeOrderService } = await import('../../services/changeOrderService')
    const result = await changeOrderService.promoteType('pco-1')

    expect(result.error?.category).toBe('ConflictError')
    expect(result.error?.message).toContain('Only approved')
  })

  it('promoteType returns PermissionError when user is not a project member', async () => {
    buildChain()
    // Fetch CO — approved pco
    mockSingle
      .mockResolvedValueOnce({
        data: { id: 'pco-1', type: 'pco', status: 'approved', project_id: 'proj-1' },
        error: null,
      })
      // resolveProjectRole — not a member
      .mockResolvedValueOnce({ data: null, error: null })

    const { changeOrderService } = await import('../../services/changeOrderService')
    const result = await changeOrderService.promoteType('pco-1')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('transitionStatus returns ValidationError for invalid state machine transition', async () => {
    buildChain()
    // Fetch CO
    mockSingle
      .mockResolvedValueOnce({
        data: { status: 'draft', project_id: 'proj-1', type: 'pco' },
        error: null,
      })
      // resolveProjectRole — valid member with role
      .mockResolvedValueOnce({ data: { role: 'owner' }, error: null })

    const { changeOrderService } = await import('../../services/changeOrderService')
    // 'approved' is not reachable directly from 'draft'
    const result = await changeOrderService.transitionStatus('co-1', 'approved' as import('../../machines/changeOrderMachine').ChangeOrderState)

    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('Invalid transition')
  })

  it('loadChangeOrders returns empty array on success', async () => {
    buildChain()
    mockOrder.mockResolvedValue({ data: [], error: null })

    const { changeOrderService } = await import('../../services/changeOrderService')
    const result = await changeOrderService.loadChangeOrders('proj-empty')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })
})
