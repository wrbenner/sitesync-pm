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

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = mockSingle
  Object.assign(chain, overrides)
  return chain
}

function sessionFor(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

describe('punchItemService.loadPunchItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns items ordered by number descending', async () => {
    const items = [
      { id: 'pi-2', number: 2, title: 'Patch drywall', status: 'open', project_id: 'proj-1' },
      { id: 'pi-1', number: 1, title: 'Paint touch-up', status: 'resolved', project_id: 'proj-1' },
    ]
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: items, error: null })
    mockFrom.mockReturnValue(chain)

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.loadPunchItems('proj-1')

    expect(mockFrom).toHaveBeenCalledWith('punch_items')
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
    expect(chain.order).toHaveBeenCalledWith('number', { ascending: false })
    expect(result.error).toBeNull()
    expect(result.data).toEqual(items)
  })

  it('returns empty array when project has no items', async () => {
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.loadPunchItems('proj-empty')

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('propagates Supabase errors', async () => {
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    mockFrom.mockReturnValue(chain)

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.loadPunchItems('proj-403')

    expect(result.data).toBeNull()
    expect(result.error).toBe('permission denied')
  })
})

describe('punchItemService.createPunchItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates item with reported_by set to current user and status open', async () => {
    sessionFor('user-42')
    const created = { id: 'pi-new', title: 'Cracked tile', status: 'open', reported_by: 'user-42', project_id: 'proj-1' }
    mockSingle.mockResolvedValue({ data: created, error: null })
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.createPunchItem({ project_id: 'proj-1', title: 'Cracked tile', location: 'Unit 204' })

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ reported_by: 'user-42', status: 'open' })
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reported_by: 'user-42', status: 'open' }),
    )
  })

  it('sets optional fields to null when not provided', async () => {
    sessionFor('user-1')
    mockSingle.mockResolvedValue({ data: { id: 'pi-x', status: 'open' }, error: null })
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const { punchItemService } = await import('./punchItemService')
    await punchItemService.createPunchItem({ project_id: 'proj-1', title: 'Minimal' })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: null, priority: null, area: null }),
    )
  })

  it('returns error when insert fails', async () => {
    sessionFor('user-1')
    mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } })
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.createPunchItem({ project_id: 'proj-1', title: 'Bad' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('insert failed')
  })
})

describe('punchItemService.transitionStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid action for current status', async () => {
    sessionFor('user-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: { status: 'open', reported_by: 'user-1', assigned_to: null, project_id: 'proj-1' },
          error: null,
        })
      } else {
        mockSingle.mockResolvedValueOnce({ data: { role: 'foreman' }, error: null })
      }
      return chain
    })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.transitionStatus('pi-1', 'Verify')

    expect(result.error).toMatch(/Invalid action/)
  })

  it('rejects when user is not a project member', async () => {
    sessionFor('user-outsider')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: { status: 'open', reported_by: 'owner', assigned_to: null, project_id: 'proj-1' },
          error: null,
        })
      } else {
        mockSingle.mockResolvedValueOnce({ data: null, error: null })
      }
      return chain
    })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.transitionStatus('pi-1', 'Start Work')

    expect(result.error).toBe('User is not a member of this project')
  })

  it('transitions open to in_progress via Start Work', async () => {
    sessionFor('user-1')
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        mockSingle.mockResolvedValueOnce({
          data: { status: 'open', reported_by: 'user-1', assigned_to: null, project_id: 'proj-1' },
          error: null,
        })
        return chain
      }
      if (callCount === 2) {
        const chain = makeChain()
        mockSingle.mockResolvedValueOnce({ data: { role: 'superintendent' }, error: null })
        return chain
      }
      return { update: mockUpdate }
    })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.transitionStatus('pi-1', 'Start Work')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress', updated_at: expect.any(String) }),
    )
  })

  it('sets resolved_date when transitioning to resolved', async () => {
    sessionFor('user-1')
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        mockSingle.mockResolvedValueOnce({
          data: { status: 'in_progress', reported_by: 'user-1', assigned_to: null, project_id: 'proj-1' },
          error: null,
        })
        return chain
      }
      if (callCount === 2) {
        const chain = makeChain()
        mockSingle.mockResolvedValueOnce({ data: { role: 'foreman' }, error: null })
        return chain
      }
      return { update: mockUpdate }
    })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.transitionStatus('pi-1', 'Mark Resolved')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved', resolved_date: expect.any(String) }),
    )
  })

  it('sets verified_date when transitioning to verified', async () => {
    sessionFor('user-1')
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        mockSingle.mockResolvedValueOnce({
          data: { status: 'resolved', reported_by: 'user-1', assigned_to: null, project_id: 'proj-1' },
          error: null,
        })
        return chain
      }
      if (callCount === 2) {
        const chain = makeChain()
        mockSingle.mockResolvedValueOnce({ data: { role: 'superintendent' }, error: null })
        return chain
      }
      return { update: mockUpdate }
    })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.transitionStatus('pi-1', 'Verify')

    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'verified', verified_date: expect.any(String) }),
    )
  })

  it('returns error when punch item is not found', async () => {
    sessionFor('user-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'row not found' } })
      return chain
    })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.transitionStatus('pi-missing', 'Start Work')

    expect(result.error).toBe('row not found')
  })
})

describe('punchItemService.updatePunchItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('strips status field from updates to protect lifecycle machine', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { punchItemService } = await import('./punchItemService')
    await punchItemService.updatePunchItem('pi-1', {
      title: 'Updated title',
      status: 'verified',
    } as Parameters<typeof punchItemService.updatePunchItem>[1])

    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg).toHaveProperty('title', 'Updated title')
    expect(updateArg).not.toHaveProperty('status')
    expect(updateArg).toHaveProperty('updated_at')
  })

  it('returns error on update failure', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.updatePunchItem('pi-1', { title: 'Bad' })

    expect(result.error).toBe('update failed')
  })
})

describe('punchItemService.deletePunchItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls delete on the correct row', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.deletePunchItem('pi-to-delete')

    expect(mockFrom).toHaveBeenCalledWith('punch_items')
    expect(mockEq).toHaveBeenCalledWith('id', 'pi-to-delete')
    expect(result.error).toBeNull()
  })

  it('returns error on delete failure', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'delete denied' } })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete })

    const { punchItemService } = await import('./punchItemService')
    const result = await punchItemService.deletePunchItem('pi-protected')

    expect(result.error).toBe('delete denied')
  })
})
