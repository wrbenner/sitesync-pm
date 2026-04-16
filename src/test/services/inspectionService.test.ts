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

vi.mock('../../machines/inspectionMachine', () => ({
  getValidInspectionTransitions: vi.fn((status: string, role: string) => {
    const canField = ['owner', 'admin', 'project_manager', 'superintendent', 'foreman'].includes(role)
    const canReview = ['owner', 'admin', 'project_manager'].includes(role)

    if (!canField) return []

    const base: Record<string, string[]> = {
      scheduled: ['in_progress'],
      in_progress: ['completed'],
      completed: [],
      approved: [],
      rejected: ['scheduled'],
      cancelled: [],
    }

    const result = [...(base[status] ?? [])]
    if (canReview) {
      if (status === 'completed') result.push('approved', 'rejected')
      if (['scheduled', 'in_progress', 'rejected'].includes(status)) result.push('cancelled')
    }
    return result
  }),
}))

import { inspectionService } from '../../services/inspectionService'

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
const INSPECTION = {
  id: 'insp-1',
  project_id: 'proj-1',
  title: 'Level 3 Safety Walk',
  description: 'Weekly safety inspection for Level 3',
  type: 'safety',
  status: 'scheduled',
  priority: 'high',
  scheduled_date: '2026-04-20',
  completed_date: null,
  inspector_id: 'user-super',
  location: 'Level 3',
  score: null,
  findings: null,
  checklist_items: null,
  created_by: 'user-1',
  updated_by: null,
  deleted_at: null,
  deleted_by: null,
  created_at: '2026-04-16T10:00:00Z',
  updated_at: '2026-04-16T10:00:00Z',
}

function mockSession(userId = 'user-1') {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

// ---------------------------------------------------------------------------
// loadInspections
// ---------------------------------------------------------------------------
describe('inspectionService.loadInspections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active inspections (soft-delete filter applied)', async () => {
    mockFrom.mockReturnValue(makeChain([INSPECTION]))

    const result = await inspectionService.loadInspections('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe('insp-1')
  })

  it('returns empty array when no inspections exist', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await inspectionService.loadInspections('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns DatabaseError on Supabase failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'connection refused' }))

    const result = await inspectionService.loadInspections('proj-1')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.message).toContain('connection refused')
  })
})

// ---------------------------------------------------------------------------
// createInspection
// ---------------------------------------------------------------------------
describe('inspectionService.createInspection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates inspection with status scheduled and provenance columns', async () => {
    mockSession('user-1')
    const chain = makeChain([INSPECTION], null, INSPECTION)
    mockFrom.mockReturnValue(chain)

    const result = await inspectionService.createInspection({
      project_id: 'proj-1',
      title: 'Level 3 Safety Walk',
      type: 'safety',
      priority: 'high',
      scheduled_date: '2026-04-20',
      inspector_id: 'user-super',
    })

    expect(result.error).toBeNull()
    expect(result.data?.status).toBe('scheduled')
    expect(result.data?.id).toBe('insp-1')

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.status).toBe('scheduled')
    expect(payload.created_by).toBe('user-1')
  })

  it('returns DatabaseError when insert fails', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'unique constraint violated' }))

    const result = await inspectionService.createInspection({
      project_id: 'proj-1',
      title: 'Duplicate',
      type: 'general',
      priority: 'low',
    })

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------
describe('inspectionService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows valid transition with correct role', async () => {
    mockSession('super-1')
    const fetchChain = makeChain(
      [],
      null,
      { status: 'scheduled', created_by: 'user-1', inspector_id: 'super-1', project_id: 'proj-1' },
    )
    const roleChain = makeChain([], null, { role: 'superintendent' })
    const updateChain = makeChain([], null, null)

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce(updateChain)

    const result = await inspectionService.transitionStatus('insp-1', 'in_progress')

    expect(result.error).toBeNull()
  })

  it('rejects transition when role lacks permission', async () => {
    mockSession('viewer-1')
    const fetchChain = makeChain(
      [],
      null,
      { status: 'scheduled', created_by: 'user-1', inspector_id: null, project_id: 'proj-1' },
    )
    const roleChain = makeChain([], null, { role: 'viewer' })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    const result = await inspectionService.transitionStatus('insp-1', 'in_progress')

    expect(result.error?.category).toBe('ValidationError')
    expect(result.error?.message).toContain('Invalid transition')
  })

  it('returns NotFoundError when inspection does not exist', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'no rows' }))

    const result = await inspectionService.transitionStatus('missing-id', 'in_progress')

    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user is not a project member', async () => {
    mockSession('outsider-1')
    const fetchChain = makeChain(
      [],
      null,
      { status: 'scheduled', created_by: 'user-1', inspector_id: null, project_id: 'proj-1' },
    )
    const roleChain = makeChain([], null, null)

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)

    const result = await inspectionService.transitionStatus('insp-1', 'in_progress')

    expect(result.error?.category).toBe('PermissionError')
  })
})

// ---------------------------------------------------------------------------
// updateInspection
// ---------------------------------------------------------------------------
describe('inspectionService.updateInspection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status field from updates to prevent bypass', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await inspectionService.updateInspection('insp-1', {
      title: 'Updated Title',
      status: 'approved' as const,
    } as Parameters<typeof inspectionService.updateInspection>[1])

    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(payload.title).toBe('Updated Title')
    expect(payload.status).toBeUndefined()
    expect(payload.updated_by).toBe('user-1')
  })

  it('returns DatabaseError on failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'timeout' }))

    const result = await inspectionService.updateInspection('insp-1', { title: 'X' })

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// deleteInspection (soft delete)
// ---------------------------------------------------------------------------
describe('inspectionService.deleteInspection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets deleted_at and deleted_by (soft delete)', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await inspectionService.deleteInspection('insp-1')

    expect(result.error).toBeNull()
    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(payload.deleted_at).toBeTruthy()
    expect(payload.deleted_by).toBe('user-1')
  })
})

// ---------------------------------------------------------------------------
// loadFindings
// ---------------------------------------------------------------------------
describe('inspectionService.loadFindings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns findings ordered by created_at', async () => {
    const findings = [
      { id: 'f-1', inspection_id: 'insp-1', description: 'Missing guard rail', severity: 'critical' },
      { id: 'f-2', inspection_id: 'insp-1', description: 'Debris on walkway', severity: 'minor' },
    ]
    mockFrom.mockReturnValue(makeChain(findings))

    const result = await inspectionService.loadFindings('insp-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
  })

  it('returns DatabaseError on failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'permission denied' }))

    const result = await inspectionService.loadFindings('insp-1')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ---------------------------------------------------------------------------
// addFinding
// ---------------------------------------------------------------------------
describe('inspectionService.addFinding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts finding with provenance user_id', async () => {
    mockSession('super-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await inspectionService.addFinding(
      'insp-1',
      'Guard rail missing at stair 4',
      'critical',
    )

    expect(result.error).toBeNull()
    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.inspection_id).toBe('insp-1')
    expect(payload.user_id).toBe('super-1')
    expect(payload.severity).toBe('critical')
  })

  it('returns DatabaseError when insert fails', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'fk violation' }))

    const result = await inspectionService.addFinding('insp-1', 'test', 'minor')

    expect(result.error?.category).toBe('DatabaseError')
  })
})
