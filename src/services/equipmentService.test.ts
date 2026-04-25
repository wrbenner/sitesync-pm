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

vi.mock('../machines/equipmentMachine', () => ({
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
}))

import { equipmentService } from './equipmentService'

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
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.then   = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

function mockSession(userId = 'user-1') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

const EQUIPMENT = {
  id: 'eq-1',
  name: 'CAT 320 Excavator',
  type: 'excavator',
  status: 'idle',
  current_project_id: 'proj-1',
  project_id: 'proj-1',
  hours_meter: 500,
  deleted_at: null,
}

// ---------------------------------------------------------------------------
// loadEquipment
// ---------------------------------------------------------------------------
describe('equipmentService.loadEquipment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active equipment for project', async () => {
    mockFrom.mockReturnValueOnce(makeChain([EQUIPMENT]))

    const result = await equipmentService.loadEquipment('proj-1')
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].name).toBe('CAT 320 Excavator')
  })

  it('returns empty array when no equipment exists', async () => {
    mockFrom.mockReturnValueOnce(makeChain([]))

    const result = await equipmentService.loadEquipment('proj-1')
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns DatabaseError on query failure', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Query failed' }))

    const result = await equipmentService.loadEquipment('proj-1')
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// createEquipment
// ---------------------------------------------------------------------------
describe('equipmentService.createEquipment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates equipment with idle status and provenance', async () => {
    mockSession('user-1')
    const insertChain = makeChain(null, null, EQUIPMENT)
    mockFrom.mockReturnValueOnce(insertChain)

    const result = await equipmentService.createEquipment({
      project_id: 'proj-1',
      name: 'CAT 320 Excavator',
      type: 'excavator',
    })

    expect(result.error).toBeNull()
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'idle',
        created_by: 'user-1',
        updated_by: 'user-1',
        ownership: 'owned',
      }),
    )
  })

  it('returns DatabaseError on insert failure', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Insert failed' }))

    const result = await equipmentService.createEquipment({
      project_id: 'proj-1',
      name: 'Forklift',
    })
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------
describe('equipmentService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('successfully transitions idle → active', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, EQUIPMENT))
      .mockReturnValueOnce(makeChain(null, null, { role: 'project_manager' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await equipmentService.transitionStatus('eq-1', 'active')
    expect(result.error).toBeNull()
  })

  it('returns NotFoundError when equipment missing', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }, null))
    mockSession()

    const result = await equipmentService.transitionStatus('eq-1', 'active')
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user has no project role', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, EQUIPMENT))
      .mockReturnValueOnce(makeChain(null, null, null))
    mockSession()

    const result = await equipmentService.transitionStatus('eq-1', 'active')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ValidationError for role without manage permission', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, EQUIPMENT))
      .mockReturnValueOnce(makeChain(null, null, { role: 'viewer' }))
    mockSession()

    const result = await equipmentService.transitionStatus('eq-1', 'active')
    expect(result.error?.category).toBe('ValidationError')
  })

  it('sets deleted_at and deleted_by when retiring equipment', async () => {
    const updateChain = makeChain([], null)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, EQUIPMENT))
      .mockReturnValueOnce(makeChain(null, null, { role: 'owner' }))
      .mockReturnValueOnce(updateChain)
    mockSession('user-owner')

    await equipmentService.transitionStatus('eq-1', 'retired')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        deleted_by: 'user-owner',
      }),
    )
  })

  it('returns DatabaseError when update fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, EQUIPMENT))
      .mockReturnValueOnce(makeChain(null, null, { role: 'project_manager' }))
      .mockReturnValueOnce(makeChain(null, { message: 'Update failed' }))
    mockSession()

    const result = await equipmentService.transitionStatus('eq-1', 'active')
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// updateEquipment
// ---------------------------------------------------------------------------
describe('equipmentService.updateEquipment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates fields successfully', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain([], null))

    const result = await equipmentService.updateEquipment('eq-1', { name: 'Updated Name' })
    expect(result.error).toBeNull()
  })

  it('strips status field to prevent bypass', async () => {
    mockSession('user-1')
    const chain = makeChain([], null)
    mockFrom.mockReturnValueOnce(chain)

    await equipmentService.updateEquipment('eq-1', { status: 'retired' as never, name: 'Test' })
    expect(chain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'retired' }),
    )
  })

  it('returns DatabaseError on failure', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'DB error' }))

    const result = await equipmentService.updateEquipment('eq-1', { name: 'Test' })
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// deleteEquipment
// ---------------------------------------------------------------------------
describe('equipmentService.deleteEquipment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by setting deleted_at and retired status', async () => {
    mockSession('user-1')
    const chain = makeChain([], null)
    mockFrom.mockReturnValueOnce(chain)

    const result = await equipmentService.deleteEquipment('eq-1')

    expect(result.error).toBeNull()
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        deleted_by: 'user-1',
        status: 'retired',
      }),
    )
  })

  it('returns DatabaseError on failure', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'DB error' }))

    const result = await equipmentService.deleteEquipment('eq-1')
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// checkout
// ---------------------------------------------------------------------------
describe('equipmentService.checkout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('checks out idle equipment to a project', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, EQUIPMENT))
      .mockReturnValueOnce(makeChain(null, null, { role: 'foreman' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await equipmentService.checkout('eq-1', {
      target_project_id: 'proj-2',
      assigned_to: 'user-2',
    })
    expect(result.error).toBeNull()
  })

  it('returns NotFoundError when equipment missing', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }, null))
    mockSession()

    const result = await equipmentService.checkout('eq-1', { target_project_id: 'proj-2' })
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user has no role', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, EQUIPMENT))
      .mockReturnValueOnce(makeChain(null, null, null))
    mockSession()

    const result = await equipmentService.checkout('eq-1', { target_project_id: 'proj-2' })
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ValidationError when equipment is not idle', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...EQUIPMENT, status: 'active' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'foreman' }))
    mockSession()

    const result = await equipmentService.checkout('eq-1', { target_project_id: 'proj-2' })
    expect(result.error?.category).toBe('ValidationError')
  })
})

// ---------------------------------------------------------------------------
// checkin
// ---------------------------------------------------------------------------
describe('equipmentService.checkin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('checks in active equipment back to idle', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...EQUIPMENT, status: 'active' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'foreman' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await equipmentService.checkin('eq-1')
    expect(result.error).toBeNull()
  })

  it('checks in transit equipment back to idle', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...EQUIPMENT, status: 'transit' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'superintendent' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await equipmentService.checkin('eq-1')
    expect(result.error).toBeNull()
  })

  it('returns ValidationError when equipment is already idle', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, EQUIPMENT)) // status: idle
      .mockReturnValueOnce(makeChain(null, null, { role: 'foreman' }))
    mockSession()

    const result = await equipmentService.checkin('eq-1')
    expect(result.error?.category).toBe('ValidationError')
  })
})

// ---------------------------------------------------------------------------
// scheduleMaintenance
// ---------------------------------------------------------------------------
describe('equipmentService.scheduleMaintenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('schedules maintenance and transitions equipment to maintenance status', async () => {
    const MAINT_RECORD = {
      id: 'maint-1',
      equipment_id: 'eq-1',
      type: 'preventive',
      description: 'Oil change',
      status: 'scheduled',
    }
    mockSession()
    // insert maintenance record
    mockFrom.mockReturnValueOnce(makeChain(null, null, MAINT_RECORD))
    // transitionStatus: fetch equipment
    mockFrom.mockReturnValueOnce(makeChain(null, null, EQUIPMENT))
    // transitionStatus: fetch role
    mockFrom.mockReturnValueOnce(makeChain(null, null, { role: 'project_manager' }))
    // transitionStatus: update equipment
    mockFrom.mockReturnValueOnce(makeChain([], null))

    const result = await equipmentService.scheduleMaintenance({
      equipment_id: 'eq-1',
      type: 'preventive',
      description: 'Oil change',
    })

    expect(result.error).toBeNull()
    expect(result.data?.description).toBe('Oil change')
  })

  it('returns DatabaseError on maintenance insert failure', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Insert failed' }))

    const result = await equipmentService.scheduleMaintenance({
      equipment_id: 'eq-1',
      type: 'preventive',
      description: 'Oil change',
    })
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// logUsage
// ---------------------------------------------------------------------------
describe('equipmentService.logUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('logs usage and updates hours_meter', async () => {
    mockSession('user-1')
    const LOG = { id: 'log-1', equipment_id: 'eq-1', hours_used: 8, date: '2026-04-17' }
    // insert log
    mockFrom.mockReturnValueOnce(makeChain(null, null, LOG))
    // fetch current hours_meter
    mockFrom.mockReturnValueOnce(makeChain(null, null, { hours_meter: 500 }))
    // update hours_meter
    mockFrom.mockReturnValueOnce(makeChain([], null))

    const result = await equipmentService.logUsage({
      equipment_id: 'eq-1',
      project_id: 'proj-1',
      date: '2026-04-17',
      hours_used: 8,
    })

    expect(result.error).toBeNull()
    expect(result.data?.hours_used).toBe(8)
  })

  it('returns DatabaseError on log insert failure', async () => {
    mockSession()
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Insert failed' }))

    const result = await equipmentService.logUsage({
      equipment_id: 'eq-1',
      project_id: 'proj-1',
      date: '2026-04-17',
    })
    expect(result.error?.category).toBe('DatabaseError')
  })

  it('skips hours_meter update when hours_used is not provided', async () => {
    mockSession()
    const LOG = { id: 'log-1', equipment_id: 'eq-1', date: '2026-04-17', hours_used: null }
    mockFrom.mockReturnValueOnce(makeChain(null, null, LOG))

    const result = await equipmentService.logUsage({
      equipment_id: 'eq-1',
      project_id: 'proj-1',
      date: '2026-04-17',
      fuel_gallons: 10,
    })

    expect(result.error).toBeNull()
    // only 1 DB call (insert), no hours_meter update
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})
