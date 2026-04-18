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
  fromTable: (...args: unknown[]) => mockFrom(...args),
}))

vi.mock('../machines/companyMachine', () => ({
  getValidCompanyTransitions: vi.fn((status: string, role: string) => {
    const isAdmin = ['admin', 'owner'].includes(role)
    const isManager = ['admin', 'owner', 'project_manager'].includes(role)

    if (isAdmin) {
      if (status === 'active')    return ['inactive', 'suspended']
      if (status === 'inactive')  return ['active', 'suspended']
      if (status === 'suspended') return ['active', 'inactive']
    }
    if (isManager) {
      if (status === 'active')    return ['inactive']
      if (status === 'inactive')  return ['active']
      if (status === 'suspended') return []
    }
    return []
  }),
  getCompanyStatusConfig: vi.fn(),
}))

import { directoryService } from './directoryService'

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
  chain.eq    = vi.fn().mockReturnValue(chain)
  chain.is    = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

const COMPANY = {
  id: 'co-1',
  project_id: 'proj-1',
  name: 'Acme Concrete',
  trade: 'Concrete',
  status: 'active',
  insurance_status: 'current',
  insurance_expiry: '2026-12-31',
  created_by: 'user-1',
  updated_by: null,
  deleted_at: null,
  created_at: '2026-04-18T10:00:00Z',
  updated_at: null,
}

const CONTACT = {
  id: 'ct-1',
  project_id: 'proj-1',
  contact_name: 'Jane Smith',
  company: 'Acme Concrete',
  role: 'Project Manager',
  trade: 'Concrete',
  phone: '555-1234',
  email: 'jane@acme.com',
  status: 'active',
  created_by: 'user-1',
  updated_by: null,
  deleted_at: null,
  created_at: '2026-04-18T10:00:00Z',
}

function mockSession(userId = 'user-1') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

// ---------------------------------------------------------------------------
// loadCompanies
// ---------------------------------------------------------------------------
describe('directoryService.loadCompanies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active companies excluding soft-deleted rows', async () => {
    mockFrom.mockReturnValue(makeChain([COMPANY]))

    const result = await directoryService.loadCompanies('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe('co-1')
  })

  it('applies soft-delete filter (is deleted_at null)', async () => {
    const chain = makeChain([COMPANY])
    mockFrom.mockReturnValue(chain)

    await directoryService.loadCompanies('proj-1')

    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns empty array when project has no companies', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await directoryService.loadCompanies('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'connection refused' }))

    const result = await directoryService.loadCompanies('proj-1')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.message).toContain('connection refused')
  })
})

// ---------------------------------------------------------------------------
// createCompany
// ---------------------------------------------------------------------------
describe('directoryService.createCompany', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates company with status active and created_by from session', async () => {
    mockSession('user-1')
    const chain = makeChain([COMPANY], null, COMPANY)
    mockFrom.mockReturnValue(chain)

    const result = await directoryService.createCompany({
      project_id: 'proj-1',
      name: 'Acme Concrete',
      trade: 'Concrete',
    })

    expect(result.error).toBeNull()

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.status).toBe('active')
    expect(payload.created_by).toBe('user-1')
    expect(payload.project_id).toBe('proj-1')
  })

  it('always forces status to active on create', async () => {
    mockSession('user-1')
    const chain = makeChain([COMPANY], null, COMPANY)
    mockFrom.mockReturnValue(chain)

    await directoryService.createCompany({ project_id: 'proj-1', name: 'Test Corp' })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    expect(insertCall.mock.calls[0][0].status).toBe('active')
  })

  it('defaults insurance_status to missing when not provided', async () => {
    mockSession('user-1')
    const chain = makeChain([COMPANY], null, COMPANY)
    mockFrom.mockReturnValue(chain)

    await directoryService.createCompany({ project_id: 'proj-1', name: 'Test Corp' })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    expect(insertCall.mock.calls[0][0].insurance_status).toBe('missing')
  })

  it('returns DatabaseError when insert fails', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'unique violation' }))

    const result = await directoryService.createCompany({
      project_id: 'proj-1',
      name: 'Duplicate Corp',
    })

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// transitionCompanyStatus
// ---------------------------------------------------------------------------
describe('directoryService.transitionCompanyStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows valid transition with correct role', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, { status: 'active', project_id: 'proj-1' })
    const roleChain  = makeChain([], null, { role: 'project_manager' })
    const updateEq   = vi.fn().mockResolvedValue({ error: null })
    const updateFn   = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await directoryService.transitionCompanyStatus('co-1', 'inactive')

    expect(result.error).toBeNull()
    expect(updateFn.mock.calls[0][0]).toMatchObject({ status: 'inactive' })
  })

  it('rejects invalid transition for current status', async () => {
    mockSession('viewer-1')
    const fetchChain = makeChain([], null, { status: 'active', project_id: 'proj-1' })
    const roleChain  = makeChain([], null, { role: 'viewer' })

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await directoryService.transitionCompanyStatus('co-1', 'suspended')

    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('Invalid transition')
  })

  it('returns NotFoundError when company does not exist', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'no rows' }))

    const result = await directoryService.transitionCompanyStatus('missing-id', 'inactive')

    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user is not a project member', async () => {
    mockSession('outsider-1')
    const fetchChain = makeChain([], null, { status: 'active', project_id: 'proj-1' })
    const roleChain  = makeChain([], null, null)

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await directoryService.transitionCompanyStatus('co-1', 'inactive')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('admin can suspend a company', async () => {
    mockSession('admin-1')
    const fetchChain = makeChain([], null, { status: 'active', project_id: 'proj-1' })
    const roleChain  = makeChain([], null, { role: 'admin' })
    const updateEq   = vi.fn().mockResolvedValue({ error: null })
    const updateFn   = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await directoryService.transitionCompanyStatus('co-1', 'suspended')

    expect(result.error).toBeNull()
    expect(updateFn.mock.calls[0][0]).toMatchObject({ status: 'suspended' })
  })

  it('pm cannot unsuspend a company (admin only)', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, { status: 'suspended', project_id: 'proj-1' })
    const roleChain  = makeChain([], null, { role: 'project_manager' })

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await directoryService.transitionCompanyStatus('co-1', 'active')

    expect(result.error?.category).toBe('ValidationError')
  })

  it('sets updated_by from session on status change', async () => {
    mockSession('admin-1')
    const fetchChain = makeChain([], null, { status: 'active', project_id: 'proj-1' })
    const roleChain  = makeChain([], null, { role: 'admin' })
    const updateEq   = vi.fn().mockResolvedValue({ error: null })
    const updateFn   = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    await directoryService.transitionCompanyStatus('co-1', 'inactive')

    expect(updateFn.mock.calls[0][0].updated_by).toBe('admin-1')
  })

  it('returns DatabaseError when update fails after validation passes', async () => {
    mockSession('admin-1')
    const fetchChain = makeChain([], null, { status: 'active', project_id: 'proj-1' })
    const roleChain  = makeChain([], null, { role: 'admin' })
    const updateEq   = vi.fn().mockResolvedValue({ error: { message: 'write conflict' } })
    const updateFn   = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await directoryService.transitionCompanyStatus('co-1', 'inactive')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// updateCompany — status field must be stripped
// ---------------------------------------------------------------------------
describe('directoryService.updateCompany', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status field from updates to prevent lifecycle bypass', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await directoryService.updateCompany('co-1', {
      name: 'Updated Corp',
      status: 'suspended',
    } as Parameters<typeof directoryService.updateCompany>[1])

    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(payload.name).toBe('Updated Corp')
    expect(payload.status).toBeUndefined()
    expect(payload.updated_by).toBe('user-1')
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'timeout' }))

    const result = await directoryService.updateCompany('co-1', { name: 'X' })

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// deleteCompany — soft delete only
// ---------------------------------------------------------------------------
describe('directoryService.deleteCompany', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets deleted_at and deleted_by (soft delete)', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await directoryService.deleteCompany('co-1')

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

    await directoryService.deleteCompany('co-1')

    expect(deleteFn).not.toHaveBeenCalled()
    expect(chain.update).toHaveBeenCalled()
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'rls violation' }))

    const result = await directoryService.deleteCompany('co-1')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// loadContacts
// ---------------------------------------------------------------------------
describe('directoryService.loadContacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns contacts excluding soft-deleted rows', async () => {
    mockFrom.mockReturnValue(makeChain([CONTACT]))

    const result = await directoryService.loadContacts('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].contact_name).toBe('Jane Smith')
  })

  it('applies soft-delete filter', async () => {
    const chain = makeChain([CONTACT])
    mockFrom.mockReturnValue(chain)

    await directoryService.loadContacts('proj-1')

    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns DatabaseError on failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'permission denied' }))

    const result = await directoryService.loadContacts('proj-1')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// createContact
// ---------------------------------------------------------------------------
describe('directoryService.createContact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates contact with status active and created_by from session', async () => {
    mockSession('user-1')
    const chain = makeChain([CONTACT], null, CONTACT)
    mockFrom.mockReturnValue(chain)

    const result = await directoryService.createContact({
      project_id: 'proj-1',
      contact_name: 'Jane Smith',
      company: 'Acme Concrete',
    })

    expect(result.error).toBeNull()

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.contact_name).toBe('Jane Smith')
    expect(payload.status).toBe('active')
    expect(payload.created_by).toBe('user-1')
  })

  it('returns DatabaseError when insert fails', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'fk violation' }))

    const result = await directoryService.createContact({
      project_id: 'proj-1',
      contact_name: 'Test Person',
    })

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// deleteContact — soft delete
// ---------------------------------------------------------------------------
describe('directoryService.deleteContact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets deleted_at and deleted_by (soft delete)', async () => {
    mockSession('user-2')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await directoryService.deleteContact('ct-1')

    expect(result.error).toBeNull()
    const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(typeof payload.deleted_at).toBe('string')
    expect(payload.deleted_by).toBe('user-2')
  })

  it('never calls hard delete', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    const deleteFn = vi.fn()
    Object.assign(chain, { delete: deleteFn })
    mockFrom.mockReturnValue(chain)

    await directoryService.deleteContact('ct-1')

    expect(deleteFn).not.toHaveBeenCalled()
  })
})
