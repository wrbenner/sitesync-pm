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

describe('projectService.loadProjects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns projects ordered by created_at desc', async () => {
    const projects = [{ id: 'p-2', name: 'New Build' }, { id: 'p-1', name: 'Old Build' }]
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: projects, error: null })
    mockFrom.mockReturnValue(chain)

    const { projectService } = await import('./projectService')
    const result = await projectService.loadProjects('co-1')

    expect(mockFrom).toHaveBeenCalledWith('projects')
    expect(chain.eq).toHaveBeenCalledWith('company_id', 'co-1')
    expect(result.error).toBeNull()
    expect(result.data).toEqual(projects)
  })

  it('returns empty array when company has no projects', async () => {
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const { projectService } = await import('./projectService')
    const result = await projectService.loadProjects('co-empty')

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns DatabaseError on failure', async () => {
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { message: 'access denied' } })
    mockFrom.mockReturnValue(chain)

    const { projectService } = await import('./projectService')
    const result = await projectService.loadProjects('co-1')

    expect(result.data).toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
  })
})

describe('projectService.createProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates project with active status and auto-adds creator as project_manager', async () => {
    const project = { id: 'proj-new', name: 'Tower A', status: 'active' }
    mockSingle.mockResolvedValue({ data: project, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        return chain
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const { projectService } = await import('./projectService')
    const result = await projectService.createProject({
      name: 'Tower A',
      company_id: 'co-1',
      created_by: 'user-1',
    })

    expect(result.error).toBeNull()
    expect(result.data).toEqual(project)

    const membersInsert = mockFrom.mock.results[1].value.insert as ReturnType<typeof vi.fn>
    expect(membersInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', role: 'project_manager' }),
    )
  })

  it('creates project with completion_percentage 0', async () => {
    const project = { id: 'proj-2', name: 'School', completion_percentage: 0 }
    mockSingle.mockResolvedValue({ data: project, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        return chain
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const { projectService } = await import('./projectService')
    await projectService.createProject({ name: 'School', company_id: 'co-1', created_by: 'user-1' })

    const firstChain = mockFrom.mock.results[0].value
    expect(firstChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', completion_percentage: 0 }),
    )
  })

  it('returns DatabaseError when insert fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'constraint violation' } })
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const { projectService } = await import('./projectService')
    const result = await projectService.createProject({ name: 'Bad', company_id: 'co-1', created_by: 'user-1' })

    expect(result.data).toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
  })
})

describe('projectService.updateProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns null data on success', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { projectService } = await import('./projectService')
    const result = await projectService.updateProject('proj-1', { name: 'Renamed' })

    expect(result.error).toBeNull()
    expect(mockEq).toHaveBeenCalledWith('id', 'proj-1')
  })

  it('returns DatabaseError on update failure', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'rls block' } })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { projectService } = await import('./projectService')
    const result = await projectService.updateProject('proj-1', { name: 'X' })

    expect(result.error!.category).toBe('DatabaseError')
  })
})

describe('projectService.loadMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns members with profiles', async () => {
    const members = [{ id: 'pm-1', user_id: 'user-1', role: 'superintendent', profile: { full_name: 'Jane' } }]
    const chain = makeChain()
    ;(chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: members, error: null })
    mockFrom.mockReturnValue(chain)

    const { projectService } = await import('./projectService')
    const result = await projectService.loadMembers('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(members)
    expect(chain.select).toHaveBeenCalledWith('*, profile:profiles(*)')
  })
})

describe('projectService.addMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    sessionFor('')
    mockGetSession.mockResolvedValue({ data: { session: null } })

    const { projectService } = await import('./projectService')
    const result = await projectService.addMember('proj-1', 'user-2', 'foreman')

    expect(result.error!.category).toBe('PermissionError')
  })

  it('inserts member with accepted_at on success', async () => {
    sessionFor('user-1')
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })

    const { projectService } = await import('./projectService')
    const result = await projectService.addMember('proj-1', 'user-2', 'superintendent')

    expect(result.error).toBeNull()
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'proj-1', user_id: 'user-2', role: 'superintendent', accepted_at: expect.any(String) }),
    )
  })
})

describe('projectService.removeMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the member by id', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete })

    const { projectService } = await import('./projectService')
    const result = await projectService.removeMember('pm-1')

    expect(result.error).toBeNull()
    expect(mockEq).toHaveBeenCalledWith('id', 'pm-1')
  })

  it('returns DatabaseError on delete failure', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'cannot delete' } })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ delete: mockDelete })

    const { projectService } = await import('./projectService')
    const result = await projectService.removeMember('pm-locked')

    expect(result.error!.category).toBe('DatabaseError')
  })
})
