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

import { scheduleService } from '../../services/scheduleService'

// ---------------------------------------------------------------------------
// Chain builder — list results resolve via thenable, single via .single()
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
const PHASE = {
  id: 'ph-1',
  project_id: 'proj-1',
  name: 'Foundation Work',
  status: 'upcoming',
  start_date: '2026-05-01',
  end_date: '2026-06-15',
  baseline_start: '2026-05-01',
  baseline_end: '2026-06-15',
  percent_complete: 0,
  is_critical_path: true,
  is_milestone: false,
  depends_on: null,
  assigned_crew_id: null,
  float_days: null,
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
// loadPhases
// ---------------------------------------------------------------------------
describe('scheduleService.loadPhases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active phases for a project', async () => {
    mockFrom.mockReturnValue(makeChain([PHASE]))

    const result = await scheduleService.loadPhases('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
  })

  it('applies deleted_at null filter (active phases only)', async () => {
    const chain = makeChain([PHASE])
    mockFrom.mockReturnValue(chain)

    await scheduleService.loadPhases('proj-1')

    expect(mockFrom).toHaveBeenCalledWith('schedule_phases')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
  })

  it('returns empty array when project has no phases', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await scheduleService.loadPhases('proj-empty')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns error string on Supabase failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'connection timeout' }))

    const result = await scheduleService.loadPhases('proj-bad')

    expect(result.data).toBeNull()
    expect(result.error).toBe('connection timeout')
  })
})

// ---------------------------------------------------------------------------
// loadMilestones — filters is_milestone=true in memory
// ---------------------------------------------------------------------------
describe('scheduleService.loadMilestones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns only phases where is_milestone is true', async () => {
    const milestone = { ...PHASE, id: 'ph-m', is_milestone: true, name: 'Steel Topping' }
    const regular = { ...PHASE, id: 'ph-r', is_milestone: false, name: 'Foundation Work' }
    mockFrom.mockReturnValue(makeChain([milestone, regular]))

    const result = await scheduleService.loadMilestones('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect((result.data![0] as Record<string, unknown>)['id']).toBe('ph-m')
  })

  it('returns empty array when no milestones exist in the project', async () => {
    mockFrom.mockReturnValue(makeChain([PHASE]))

    const result = await scheduleService.loadMilestones('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns empty array when project has no phases at all', async () => {
    mockFrom.mockReturnValue(makeChain([]))

    const result = await scheduleService.loadMilestones('proj-empty')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  })

  it('returns error on Supabase failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'rls denied' }))

    const result = await scheduleService.loadMilestones('proj-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('rls denied')
  })
})

// ---------------------------------------------------------------------------
// createPhase
// ---------------------------------------------------------------------------
describe('scheduleService.createPhase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates phase with upcoming status and created_by from session', async () => {
    mockSession('user-1')
    const chain = makeChain([PHASE], null, PHASE)
    mockFrom.mockReturnValue(chain)

    const result = await scheduleService.createPhase({
      project_id: 'proj-1',
      name: 'Foundation Work',
      start_date: '2026-05-01',
      end_date: '2026-06-15',
    })

    expect(result.error).toBeNull()

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.status).toBe('upcoming')
    expect(payload.created_by).toBe('user-1')
    expect(payload.project_id).toBe('proj-1')
  })

  it('defaults percent_complete to 0 and is_critical_path to false', async () => {
    mockSession('user-1')
    const chain = makeChain([PHASE], null, PHASE)
    mockFrom.mockReturnValue(chain)

    await scheduleService.createPhase({ project_id: 'proj-1', name: 'Quick Phase' })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.percent_complete).toBe(0)
    expect(payload.is_critical_path).toBe(false)
  })

  it('marks phase as milestone when is_milestone is true', async () => {
    mockSession('user-1')
    const chain = makeChain([PHASE], null, PHASE)
    mockFrom.mockReturnValue(chain)

    await scheduleService.createPhase({
      project_id: 'proj-1',
      name: 'Steel Topping',
      is_milestone: true,
    })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    expect(insertCall.mock.calls[0][0].is_milestone).toBe(true)
  })

  it('sets is_milestone to false by default', async () => {
    mockSession('user-1')
    const chain = makeChain([PHASE], null, PHASE)
    mockFrom.mockReturnValue(chain)

    await scheduleService.createPhase({ project_id: 'proj-1', name: 'Normal Phase' })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    expect(insertCall.mock.calls[0][0].is_milestone).toBe(false)
  })

  it('passes through optional fields (baseline dates, crew, float)', async () => {
    mockSession('user-1')
    const chain = makeChain([PHASE], null, PHASE)
    mockFrom.mockReturnValue(chain)

    await scheduleService.createPhase({
      project_id: 'proj-1',
      name: 'Foundation',
      baseline_start: '2026-04-01',
      baseline_end: '2026-05-01',
      assigned_crew_id: 'crew-1',
      float_days: 5,
      is_critical_path: true,
    })

    const insertCall = chain.insert as ReturnType<typeof vi.fn>
    const payload = insertCall.mock.calls[0][0]
    expect(payload.baseline_start).toBe('2026-04-01')
    expect(payload.baseline_end).toBe('2026-05-01')
    expect(payload.assigned_crew_id).toBe('crew-1')
    expect(payload.float_days).toBe(5)
    expect(payload.is_critical_path).toBe(true)
  })

  it('returns error on Supabase insert failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'unique constraint' }))

    const result = await scheduleService.createPhase({ project_id: 'proj-1', name: 'Dupe' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('unique constraint')
  })
})

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------
describe('scheduleService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('superintendent can transition upcoming to active', async () => {
    mockSession('super-1')
    const fetchChain = makeChain([], null, { status: 'upcoming', project_id: 'proj-1' })
    const roleChain = makeChain([], null, { role: 'superintendent' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await scheduleService.transitionStatus('ph-1', 'active')

    expect(result.error).toBeNull()
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    )
  })

  it('completing a phase automatically sets percent_complete to 100', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, { status: 'active', project_id: 'proj-1' })
    const roleChain = makeChain([], null, { role: 'project_manager' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await scheduleService.transitionStatus('ph-1', 'completed')

    expect(result.error).toBeNull()
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', percent_complete: 100 }),
    )
  })

  it('active percent_complete is NOT set to 100 on non-completed transitions', async () => {
    mockSession('super-1')
    const fetchChain = makeChain([], null, { status: 'active', project_id: 'proj-1' })
    const roleChain = makeChain([], null, { role: 'superintendent' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    await scheduleService.transitionStatus('ph-1', 'delayed')

    const payload = updateFn.mock.calls[0][0] as Record<string, unknown>
    expect(payload['percent_complete']).toBeUndefined()
  })

  it('viewer role cannot transition phase status', async () => {
    mockSession('viewer-1')
    const fetchChain = makeChain([], null, { status: 'upcoming', project_id: 'proj-1' })
    const roleChain = makeChain([], null, { role: 'viewer' })

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await scheduleService.transitionStatus('ph-1', 'active')

    expect(result.error).toContain('Invalid transition')
  })

  it('subcontractor role cannot transition phase status', async () => {
    mockSession('sub-1')
    const fetchChain = makeChain([], null, { status: 'upcoming', project_id: 'proj-1' })
    const roleChain = makeChain([], null, { role: 'subcontractor' })

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await scheduleService.transitionStatus('ph-1', 'active')

    expect(result.error).toContain('Invalid transition')
  })

  it('returns error when phase does not exist', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'row not found' }))

    const result = await scheduleService.transitionStatus('ph-ghost', 'active')

    expect(result.data).toBeNull()
    expect(result.error).toBe('row not found')
  })

  it('returns error when user has no project membership', async () => {
    mockSession('outsider')
    const fetchChain = makeChain([], null, { status: 'upcoming', project_id: 'proj-1' })
    const roleChain = makeChain([], null, null)

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await scheduleService.transitionStatus('ph-1', 'active')

    expect(result.error).toBe('User is not a member of this project')
  })

  it('project_manager can reopen a completed phase', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, { status: 'completed', project_id: 'proj-1' })
    const roleChain = makeChain([], null, { role: 'project_manager' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    const result = await scheduleService.transitionStatus('ph-1', 'active')

    expect(result.error).toBeNull()
  })

  it('superintendent cannot reopen a completed phase', async () => {
    mockSession('super-1')
    const fetchChain = makeChain([], null, { status: 'completed', project_id: 'proj-1' })
    const roleChain = makeChain([], null, { role: 'superintendent' })

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(roleChain)

    const result = await scheduleService.transitionStatus('ph-1', 'active')

    expect(result.error).toContain('Invalid transition')
  })

  it('sets updated_by on every successful transition', async () => {
    mockSession('pm-1')
    const fetchChain = makeChain([], null, { status: 'upcoming', project_id: 'proj-1' })
    const roleChain = makeChain([], null, { role: 'project_manager' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(roleChain)
      .mockReturnValueOnce({ update: updateFn })

    await scheduleService.transitionStatus('ph-1', 'active')

    const payload = updateFn.mock.calls[0][0] as Record<string, unknown>
    expect(payload['updated_by']).toBe('pm-1')
  })
})

// ---------------------------------------------------------------------------
// updatePhase
// ---------------------------------------------------------------------------
describe('scheduleService.updatePhase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates phase fields and sets updated_by from session', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await scheduleService.updatePhase('ph-1', {
      name: 'Revised Foundation',
      percent_complete: 50,
    })

    expect(result.error).toBeNull()
    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(payload.name).toBe('Revised Foundation')
    expect(payload.percent_complete).toBe(50)
    expect(payload.updated_by).toBe('user-1')
  })

  it('sets updated_by for different session users', async () => {
    mockSession('super-99')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await scheduleService.updatePhase('ph-1', { name: 'Updated Name' })

    const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload.updated_by).toBe('super-99')
  })

  it('returns error on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'timeout' }))

    const result = await scheduleService.updatePhase('ph-1', { name: 'X' })

    expect(result.error).toBe('timeout')
  })
})

// ---------------------------------------------------------------------------
// deletePhase — soft delete
// ---------------------------------------------------------------------------
describe('scheduleService.deletePhase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by setting deleted_at and deleted_by', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await scheduleService.deletePhase('ph-1')

    expect(result.error).toBeNull()
    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(typeof payload.deleted_at).toBe('string')
    expect(payload.deleted_by).toBe('user-1')
  })

  it('deleted_at is a valid ISO timestamp', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await scheduleService.deletePhase('ph-1')

    const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(() => new Date(payload.deleted_at as string).toISOString()).not.toThrow()
  })

  it('returns error on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'delete denied' }))

    const result = await scheduleService.deletePhase('ph-1')

    expect(result.error).toBe('delete denied')
  })
})

// ---------------------------------------------------------------------------
// updateDependencies
// ---------------------------------------------------------------------------
describe('scheduleService.updateDependencies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets depends_on to first predecessor and dependencies to full array', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    const result = await scheduleService.updateDependencies('ph-1', ['ph-A', 'ph-B', 'ph-C'])

    expect(result.error).toBeNull()
    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(payload.dependencies).toEqual(['ph-A', 'ph-B', 'ph-C'])
    expect(payload.depends_on).toBe('ph-A')
    expect(payload.updated_by).toBe('user-1')
  })

  it('clears depends_on when no predecessors are given', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await scheduleService.updateDependencies('ph-1', [])

    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(payload.dependencies).toEqual([])
    expect(payload.depends_on).toBeNull()
  })

  it('handles single predecessor correctly', async () => {
    mockSession('user-1')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await scheduleService.updateDependencies('ph-1', ['ph-A'])

    const updateCall = chain.update as ReturnType<typeof vi.fn>
    const payload = updateCall.mock.calls[0][0]
    expect(payload.dependencies).toEqual(['ph-A'])
    expect(payload.depends_on).toBe('ph-A')
  })

  it('sets updated_by from session', async () => {
    mockSession('pm-42')
    const chain = makeChain([], null, null)
    mockFrom.mockReturnValue(chain)

    await scheduleService.updateDependencies('ph-1', ['ph-X'])

    const payload = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload.updated_by).toBe('pm-42')
  })

  it('returns error on Supabase failure', async () => {
    mockSession()
    mockFrom.mockReturnValue(makeChain(null, { message: 'update failed' }))

    const result = await scheduleService.updateDependencies('ph-1', ['ph-A'])

    expect(result.error).toBe('update failed')
  })
})
