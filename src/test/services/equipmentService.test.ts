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

// equipmentMachine mock — getValidEquipmentTransitions returns allowed targets
vi.mock('../../machines/equipmentMachine', () => ({
  getValidEquipmentTransitions: vi.fn((status: string, role: string) => {
    const canManage = ['owner', 'admin', 'project_manager', 'superintendent', 'foreman'].includes(role)
    const canRetire = ['owner', 'admin', 'project_manager'].includes(role)
    if (!canManage) return []

    const base: Record<string, string[]> = {
      idle:        ['active', 'maintenance', 'transit', ...(canRetire ? ['retired'] : [])],
      active:      ['idle', 'maintenance', 'transit', 'off_site'],
      maintenance: ['idle', ...(canRetire ? ['retired'] : [])],
      transit:     ['active', 'idle'],
      off_site:    ['idle', 'active'],
      retired:     [],
    }
    return base[status] ?? []
  }),
  isValidEquipmentTransition: vi.fn(),
  getEquipmentStatusConfig: vi.fn(),
  getMaintenanceStatusConfig: vi.fn(),
  canCheckout: vi.fn(),
  canScheduleMaintenance: vi.fn(),
  canRetire: vi.fn(),
}))

import { equipmentService } from '../../services/equipmentService'

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
  chain.select  = vi.fn().mockReturnValue(chain)
  chain.eq      = vi.fn().mockReturnValue(chain)
  chain.is      = vi.fn().mockReturnValue(chain)
  chain.order   = vi.fn().mockReturnValue(chain)
  chain.insert  = vi.fn().mockReturnValue(chain)
  chain.update  = vi.fn().mockReturnValue(chain)
  chain.delete  = vi.fn().mockReturnValue(chain)
  chain.single  = vi.fn().mockResolvedValue(singleResult)
  chain.then    = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const EQUIPMENT = {
  id: 'eq-1',
  name: 'CAT 320 Excavator',
  type: 'excavator',
  make: 'Caterpillar',
  model: '320',
  status: 'idle',
  current_project_id: 'proj-1',
  project_id: 'proj-1',
  hours_meter: 1250,
  deleted_at: null,
}

function mockSession(userId = 'user-1') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

// ---------------------------------------------------------------------------
// loadEquipment
// ---------------------------------------------------------------------------
describe('equipmentService.loadEquipment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active equipment excluding soft-deleted rows', async () => {
    mockFrom.mockReturnValue(makeChain([EQUIPMENT]))

    const result = await equipmentService.loadEquipment('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe('eq-1')
  })

  it('applies soft-delete filter (is deleted_at null)', async () => {
    const chain = makeChain([EQUIPMENT])
    mockFrom.mockReturnValue(chain)

    await equipmentService.loadEquipment('proj-1')

    expect(mockFrom).toHaveBeenCalledWith('equipment')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns empty array when project has no equipment', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await equipmentService.loadEquipment('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'connection refused' }))

    const result = await equipmentService.loadEquipment('proj-1')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.message).toContain('connection refused')
  })
})

// ---------------------------------------------------------------------------
// createEquipment
// ---------------------------------------------------------------------------
describe('equipmentService.createEquipment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates equipment with status idle and created_by from session', async () => {
    mockSession('user-1')
    const chain = makeChain([EQUIPMENT], null, EQUIPMENT)
    mockFrom.mockReturnValue(chain)

    const result = await equipmentService.createEquipment({
      project_id: 'proj-1',
      name: 'CAT 320 Excavator',
      type: 'excavator',
    })

    expect(result.error).toBeNull()

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(payload.status).toBe('idle')
    expect(payload.created_by).toBe('user-1')
    expect(payload.project_id).toBe('proj-1')
    expect(payload.current_project_id).toBe('proj-1')
  })

  it('always initializes status to idle regardless of input', async () => {
    mockSession('user-1')
    const chain = makeChain([EQUIPMENT], null, EQUIPMENT)
    mockFrom.mockReturnValue(chain)

    await equipmentService.createEquipment({ project_id: 'proj-1', name: 'Crane A' })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    expect(insertCall.mock.calls[0][0].status).toBe('idle')
  })

  it('returns DatabaseError when insert fails', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'unique constraint violated' }))

    const result = await equipmentService.createEquipment({
      project_id: 'proj-1',
      name: 'Duplicate',
    })

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// transitionStatus — state machine enforcement
// ---------------------------------------------------------------------------
describe('equipmentService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows valid transition with correct role', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'project_manager' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await equipmentService.transitionStatus('eq-1', 'active')

    expect(result.error).toBeNull()
  })

  it('rejects invalid transition for current status', async () => {
    mockSession('user-1')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'foreman' })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    // idle → off_site is not valid (foreman cannot do this directly)
    const result = await equipmentService.transitionStatus('eq-1', 'off_site')

    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('Invalid transition')
  })

  it('returns NotFoundError when equipment does not exist', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'no rows' }))

    const result = await equipmentService.transitionStatus('missing-id', 'active')

    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user is not a project member', async () => {
    mockSession('outsider-1')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, null)

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    const result = await equipmentService.transitionStatus('eq-1', 'active')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('viewer cannot transition equipment status', async () => {
    mockSession('viewer-1')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'viewer' })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    const result = await equipmentService.transitionStatus('eq-1', 'active')

    expect(result.error?.category).toBe('ValidationError')
  })

  it('only admin/owner/pm can retire equipment', async () => {
    mockSession('foreman-1')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'foreman' })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    // foreman cannot retire (not in RETIRE_ROLES)
    const result = await equipmentService.transitionStatus('eq-1', 'retired')

    expect(result.error?.category).toBe('ValidationError')
  })

  it('sets deleted_at when retiring equipment', async () => {
    mockSession('admin-1')
    const fetchChain = makeChain([], null, {
      status: 'maintenance',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'admin' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await equipmentService.transitionStatus('eq-1', 'retired')

    expect(result.error).toBeNull()
    const payload = updateFn.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(typeof payload['deleted_at']).toBe('string')
    expect(payload['deleted_by']).toBe('admin-1')
    expect(payload['status']).toBe('retired')
  })

  it('sets updated_by on every transition', async () => {
    mockSession('pm-99')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'project_manager' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    await equipmentService.transitionStatus('eq-1', 'active')

    const payload = updateFn.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(payload['updated_by']).toBe('pm-99')
  })

  it('returns DatabaseError when DB update fails after validation passes', async () => {
    mockSession('admin-1')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'admin' })
    const updateEq = vi.fn().mockResolvedValue({ error: { message: 'write conflict' } })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await equipmentService.transitionStatus('eq-1', 'active')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// deleteEquipment — soft delete
// ---------------------------------------------------------------------------
describe('equipmentService.deleteEquipment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets deleted_at, deleted_by, and status=retired (soft delete)', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await equipmentService.deleteEquipment('eq-1')

    expect(result.error).toBeNull()
    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(typeof payload.deleted_at).toBe('string')
    expect(payload.deleted_by).toBe('user-1')
    expect(payload.status).toBe('retired')
  })

  it('never calls hard delete — uses update', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    const deleteFn = vi.fn()
    Object.assign(chain, { delete: deleteFn })
    mockFrom.mockReturnValue(chain)

    await equipmentService.deleteEquipment('eq-1')

    expect(deleteFn).not.toHaveBeenCalled()
    expect(chain.update).toHaveBeenCalled()
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'rls violation' }))

    const result = await equipmentService.deleteEquipment('eq-1')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// checkout
// ---------------------------------------------------------------------------
describe('equipmentService.checkout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('transitions idle equipment to active with assignment fields', async () => {
    mockSession('foreman-1')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
      assigned_to: null,
    })
    const roleChain = makeChain([], null, { role: 'foreman' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await equipmentService.checkout('eq-1', {
      target_project_id: 'proj-2',
      assigned_to: 'operator-1',
      current_location: 'Zone A',
    })

    expect(result.error).toBeNull()
    const payload = updateFn.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(payload.status).toBe('active')
    expect(payload.current_project_id).toBe('proj-2')
    expect(payload.assigned_to).toBe('operator-1')
    expect(typeof payload.checkout_date).toBe('string')
    expect(payload.checkin_date).toBeNull()
    expect(payload.current_location).toBe('Zone A')
  })

  it('rejects checkout when equipment is not idle', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, {
      status: 'active', // already checked out
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'project_manager' })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    const result = await equipmentService.checkout('eq-1', { target_project_id: 'proj-2' })

    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('idle')
  })

  it('returns NotFoundError for missing equipment', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'not found' }))

    const result = await equipmentService.checkout('missing', { target_project_id: 'proj-1' })

    expect(result.error?.category).toBe('NotFoundError')
  })
})

// ---------------------------------------------------------------------------
// checkin
// ---------------------------------------------------------------------------
describe('equipmentService.checkin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('transitions active equipment to idle and clears assignment', async () => {
    mockSession('user-1')
    const fetchChain = makeChain([], null, {
      status: 'active',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
      assigned_to: 'operator-1',
    })
    const roleChain = makeChain([], null, { role: 'foreman' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await equipmentService.checkin('eq-1')

    expect(result.error).toBeNull()
    const payload = updateFn.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(payload.status).toBe('idle')
    expect(payload.assigned_to).toBeNull()
    expect(typeof payload.checkin_date).toBe('string')
  })

  it('rejects checkin when equipment is not active or transit', async () => {
    mockSession('user-1')
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'foreman' })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    const result = await equipmentService.checkin('eq-1')

    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('active or in transit')
  })

  it('returns PermissionError for non-members', async () => {
    mockSession('outsider')
    const fetchChain = makeChain([], null, {
      status: 'active',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, null)

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    const result = await equipmentService.checkin('eq-1')

    expect(result.error?.category).toBe('PermissionError')
  })
})

// ---------------------------------------------------------------------------
// scheduleMaintenance
// ---------------------------------------------------------------------------
describe('equipmentService.scheduleMaintenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates maintenance record with status=scheduled and provenance', async () => {
    mockSession('super-1')

    // insert chain for maintenance record
    const insertChain = makeChain([], null, {
      id: 'maint-1',
      equipment_id: 'eq-1',
      type: 'preventive',
      description: 'Oil change',
      status: 'scheduled',
    })

    // fetch chain for transitionStatus (equipment row)
    const fetchChain = makeChain([], null, {
      status: 'idle',
      current_project_id: 'proj-1',
      project_id: 'proj-1',
    })
    const roleChain = makeChain([], null, { role: 'superintendent' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(insertChain)       // equipment_maintenance insert
      .mockReturnValueOnce(fetchChain)         // equipment fetch in transitionStatus
      .mockReturnValueOnce(roleChain)          // project_members role lookup
      .mockReturnValueOnce({ update: updateFn }) // equipment update in transitionStatus

    const result = await equipmentService.scheduleMaintenance({
      equipment_id: 'eq-1',
      type: 'preventive',
      description: 'Oil change',
      scheduled_date: '2026-05-01',
    })

    expect(result.error).toBeNull()
    expect(result.data?.status).toBe('scheduled')

    const insertCall = insertChain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(payload.type).toBe('preventive')
    expect(payload.description).toBe('Oil change')
    expect(payload.created_by).toBe('super-1')
    expect(payload.status).toBe('scheduled')
  })

  it('returns DatabaseError when maintenance insert fails', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'fk violation' }))

    const result = await equipmentService.scheduleMaintenance({
      equipment_id: 'eq-1',
      type: 'corrective',
      description: 'Fix hydraulics',
    })

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// updateEquipment — status field must be stripped
// ---------------------------------------------------------------------------
describe('equipmentService.updateEquipment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status field from updates to prevent lifecycle bypass', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await equipmentService.updateEquipment('eq-1', {
      name: 'Updated Crane',
      status: 'retired' as Parameters<typeof equipmentService.updateEquipment>[1]['status'],
    })

    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(payload.name).toBe('Updated Crane')
    expect(payload.status).toBeUndefined()
    expect(payload.updated_by).toBe('user-1')
  })

  it('sets updated_by from session on every update', async () => {
    mockSession('user-99')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await equipmentService.updateEquipment('eq-1', { name: 'Another Name' })

    const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as unknown as Record<string, unknown>
    expect(payload.updated_by).toBe('user-99')
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'timeout' }))

    const result = await equipmentService.updateEquipment('eq-1', { name: 'X' })

    expect(result.error?.category).toBe('DatabaseError')
  })
})
