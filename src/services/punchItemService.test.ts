import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSession, mockSingle, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
}))

import { punchItemService } from './punchItemService'

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
  }
  for (const key of ['select', 'eq', 'insert', 'update', 'delete', 'order']) {
    chain[key].mockReturnValue(chain)
  }
  return chain
}

function sessionFor(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

function noSession() {
  mockGetSession.mockResolvedValue({ data: { session: null } })
}

describe('punchItemService.createPunchItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets reported_by to null when unauthenticated', async () => {
    noSession()
    const created = { id: 'pi-1', title: 'Cracked tile', status: 'open', reported_by: null }
    mockSingle.mockResolvedValue({ data: created, error: null })
    mockFrom.mockReturnValue(makeChain())

    const result = await punchItemService.createPunchItem({ project_id: 'proj-1', title: 'Cracked tile' })

    expect(result.error).toBeNull()
    const insertCall = mockFrom.mock.results[0]
    expect(insertCall).toBeDefined()
  })

  it('includes all optional fields when provided', async () => {
    sessionFor('u-1')
    const created = { id: 'pi-2', status: 'open' }
    mockSingle.mockResolvedValue({ data: created, error: null })
    const chain = makeChain()
    mockFrom.mockReturnValue(chain)

    await punchItemService.createPunchItem({
      project_id: 'proj-1',
      title: 'Paint',
      description: 'Touch-up required',
      priority: 'high',
      area: 'Unit 204',
      floor: '2',
      location: 'North wall',
      trade: 'Painter',
      assigned_to: 'u-assignee',
      due_date: '2026-05-01',
      photos: ['https://example.com/photo.jpg'],
    })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Touch-up required',
        priority: 'high',
        area: 'Unit 204',
        trade: 'Painter',
        assigned_to: 'u-assignee',
      })
    )
  })
})

describe('punchItemService.transitionStatus — lifecycle timestamps', () => {
  beforeEach(() => vi.clearAllMocks())

  function setupTransition(currentStatus: string, role: string) {
    sessionFor('u-1')
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: { status: currentStatus, reported_by: 'u-1', assigned_to: null, project_id: 'proj-1' },
          error: null,
        })
        return chain
      }
      if (callCount === 2) {
        mockSingle.mockResolvedValueOnce({ data: { role }, error: null })
        return chain
      }
      return { update: mockUpdate }
    })
    return mockUpdate
  }

  it('sets verified_date when transitioning sub_complete → verified', async () => {
    const mockUpdate = setupTransition('sub_complete', 'superintendent')

    const result = await punchItemService.transitionStatus('pi-1', 'Verify')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'verified', verified_date: expect.any(String) })
    )
  })

  it('transitions open → verified via Verify (direct verify at creation)', async () => {
    const mockUpdate = setupTransition('open', 'superintendent')

    const result = await punchItemService.transitionStatus('pi-1', 'Verify')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'verified', verified_date: expect.any(String) })
    )
  })

  it('transitions verified → in_progress via Reject', async () => {
    const mockUpdate = setupTransition('verified', 'superintendent')

    const result = await punchItemService.transitionStatus('pi-1', 'Reject')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress' })
    )
  })

  it('transitions in_progress → open via Reopen', async () => {
    const mockUpdate = setupTransition('in_progress', 'foreman')

    const result = await punchItemService.transitionStatus('pi-1', 'Reopen')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open' })
    )
  })

  it('returns error when update fails', async () => {
    sessionFor('u-1')
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: { status: 'open', reported_by: 'u-1', assigned_to: null, project_id: 'proj-1' },
          error: null,
        })
        return chain
      }
      if (callCount === 2) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'superintendent' }, error: null })
        return chain
      }
      return { update: mockUpdate }
    })

    const result = await punchItemService.transitionStatus('pi-1', 'Start Work')

    expect(result.error).toBe('db error')
  })
})

describe('punchItemService.updatePunchItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status and adds updated_at', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    await punchItemService.updatePunchItem('pi-1', {
      title: 'Updated',
      status: 'verified',
    } as Parameters<typeof punchItemService.updatePunchItem>[1])

    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg).toHaveProperty('title', 'Updated')
    expect(updateArg).not.toHaveProperty('status')
    expect(updateArg).toHaveProperty('updated_at')
  })

  it('returns error when update fails', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'forbidden' } })
    mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockEq }) })

    const result = await punchItemService.updatePunchItem('pi-1', { title: 'X' })

    expect(result.error).toBe('forbidden')
    expect(result.data).toBeNull()
  })
})

describe('punchItemService.loadPunchItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('treats null data as empty array', async () => {
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await punchItemService.loadPunchItems('proj-1')

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })
})
