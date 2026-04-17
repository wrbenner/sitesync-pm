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

import { taskService, getValidTaskTransitions } from './taskService'

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

const TASK = { id: 'task-1', status: 'todo', project_id: 'proj-1' }

// ---------------------------------------------------------------------------
// getValidTaskTransitions unit tests
// ---------------------------------------------------------------------------
describe('getValidTaskTransitions', () => {
  it('todo → in_progress and done for non-viewers', () => {
    const transitions = getValidTaskTransitions('todo', 'gc_member')
    expect(transitions).toContain('in_progress')
    expect(transitions).toContain('done')
  })

  it('viewer gets no transitions', () => {
    expect(getValidTaskTransitions('todo', 'viewer')).toEqual([])
    expect(getValidTaskTransitions('in_progress', 'viewer')).toEqual([])
  })

  it('in_review → done and in_progress for reviewers', () => {
    const transitions = getValidTaskTransitions('in_review', 'project_manager')
    expect(transitions).toContain('done')
    expect(transitions).toContain('in_progress')
  })

  it('in_review: non-reviewer gets no transitions', () => {
    expect(getValidTaskTransitions('in_review', 'subcontractor')).toEqual([])
  })

  it('done → todo only for reviewers (reopen)', () => {
    expect(getValidTaskTransitions('done', 'admin')).toContain('todo')
    expect(getValidTaskTransitions('done', 'gc_member')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// transitionStatus
// ---------------------------------------------------------------------------
describe('taskService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('successfully transitions todo → in_progress', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, TASK))
      .mockReturnValueOnce(makeChain(null, null, { role: 'gc_member' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await taskService.transitionStatus('task-1', 'in_progress')
    expect(result.error).toBeNull()
  })

  it('returns NotFoundError when task missing', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'Not found' }, null))
    mockSession()

    const result = await taskService.transitionStatus('task-1', 'in_progress')
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when user has no project role', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, TASK))
      .mockReturnValueOnce(makeChain(null, null, null))
    mockSession()

    const result = await taskService.transitionStatus('task-1', 'in_progress')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ValidationError for invalid transition', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, TASK))
      .mockReturnValueOnce(makeChain(null, null, { role: 'viewer' }))
    mockSession()

    const result = await taskService.transitionStatus('task-1', 'done')
    expect(result.error?.category).toBe('ValidationError')
  })

  it('returns DatabaseError when update fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, TASK))
      .mockReturnValueOnce(makeChain(null, null, { role: 'gc_member' }))
      .mockReturnValueOnce(makeChain(null, { message: 'update failed' }))
    mockSession()

    const result = await taskService.transitionStatus('task-1', 'in_progress')
    expect(result.error?.category).toBe('DatabaseError')
  })

  it('sets percent_complete = 100 when transitioning to done', async () => {
    const updateChain = makeChain([], null)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...TASK, status: 'in_progress' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'gc_member' }))
      .mockReturnValueOnce(updateChain)
    mockSession()

    await taskService.transitionStatus('task-1', 'done')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ percent_complete: 100 }),
    )
  })

  it('does NOT set percent_complete for non-done transitions', async () => {
    const updateChain = makeChain([], null)
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, TASK))
      .mockReturnValueOnce(makeChain(null, null, { role: 'gc_member' }))
      .mockReturnValueOnce(updateChain)
    mockSession()

    await taskService.transitionStatus('task-1', 'in_progress')
    expect(updateChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ percent_complete: expect.anything() }),
    )
  })

  it('reviewer can reopen done → todo', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain(null, null, { ...TASK, status: 'done' }))
      .mockReturnValueOnce(makeChain(null, null, { role: 'admin' }))
      .mockReturnValueOnce(makeChain([], null))
    mockSession()

    const result = await taskService.transitionStatus('task-1', 'todo')
    expect(result.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------
describe('taskService.updateTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates non-status fields successfully', async () => {
    mockFrom.mockReturnValueOnce(makeChain([], null))

    const result = await taskService.updateTask('task-1', { title: 'New title' })
    expect(result.error).toBeNull()
  })

  it('strips status field to prevent bypass', async () => {
    const chain = makeChain([], null)
    mockFrom.mockReturnValueOnce(chain)

    await taskService.updateTask('task-1', { status: 'done', title: 'Test' })
    expect(chain.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: 'done' }),
    )
  })

  it('returns DatabaseError on update failure', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'DB error' }))

    const result = await taskService.updateTask('task-1', { title: 'Test' })
    expect(result.error?.category).toBe('DatabaseError')
  })
})
