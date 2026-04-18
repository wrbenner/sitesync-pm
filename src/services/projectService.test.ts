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

import { projectService } from './projectService'

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
  }
  for (const key of ['select', 'eq', 'neq', 'is', 'insert', 'update', 'delete', 'order', 'limit']) {
    chain[key].mockReturnValue(chain)
  }
  // maybeSingle resolves to the same shape mockSingle does — used by
  // ensureOrganizationMembership which probes for an existing org.
  chain.maybeSingle.mockResolvedValue({ data: null, error: null })
  return chain
}

function session(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

function noSession() {
  mockGetSession.mockResolvedValue({ data: { session: null } })
}

describe('projectService.loadProjects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns projects ordered by created_at descending', async () => {
    const projects = [
      { id: 'p-2', name: 'Project B', company_id: 'co-1' },
      { id: 'p-1', name: 'Project A', company_id: 'co-1' },
    ]
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: projects, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.loadProjects('co-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns empty array when company has no projects', async () => {
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.loadProjects('co-empty')

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns DatabaseError on failure', async () => {
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.loadProjects('co-1')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

describe('projectService.createProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates project and auto-adds creator as project_manager', async () => {
    session('u-1')
    const project = { id: 'p-new', name: 'Tower A', organization_id: 'co-1', status: 'active' }
    mockSingle.mockResolvedValue({ data: project, error: null })

    // createProject also calls ensureOrganizationMembership, which probes
    // organization_members + may touch organizations. Every chain returns
    // the chain (awaitable no-op) and maybeSingle/single resolve benignly.
    mockFrom.mockImplementation(() => makeChain())

    const result = await projectService.createProject({
      name: 'Tower A',
      company_id: 'co-1',
    })

    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('p-new')
    const fromArgs = mockFrom.mock.calls.map((c) => c[0])
    expect(fromArgs).toContain('projects')
    expect(fromArgs).toContain('project_members')
  })

  it('sets status to active on creation', async () => {
    session('u-1')
    const project = { id: 'p-1', status: 'active' }
    mockSingle.mockResolvedValue({ data: project, error: null })

    let projectsInsertArg: Record<string, unknown> | null = null
    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain()
      chain.insert.mockImplementation((v: Record<string, unknown>) => {
        if (table === 'projects' && !projectsInsertArg) {
          projectsInsertArg = v
        }
        return chain
      })
      return chain
    })

    await projectService.createProject({ name: 'Test', organization_id: 'co-1' })

    expect(projectsInsertArg?.status).toBe('active')
    expect(projectsInsertArg?.name).toBe('Test')
  })

  it('returns DatabaseError on insert failure', async () => {
    session('u-1')
    mockSingle.mockResolvedValue({ data: null, error: { message: 'duplicate project name' } })
    mockFrom.mockImplementation(() => makeChain())

    const result = await projectService.createProject({
      name: 'Dupe',
      company_id: 'co-1',
    })

    expect(result.error?.category).toBe('DatabaseError')
    expect(result.data).toBeNull()
  })
})

describe('projectService.updateProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates project fields and returns ok', async () => {
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.updateProject('p-1', { name: 'Renamed Project' })

    expect(result.error).toBeNull()
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed Project' }))
  })

  it('returns DatabaseError on update failure', async () => {
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: { message: 'update denied' } })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.updateProject('p-1', {})

    expect(result.error?.category).toBe('DatabaseError')
  })
})

describe('projectService.loadMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns members with profiles', async () => {
    const members = [
      { id: 'm-1', user_id: 'u-1', role: 'superintendent', profile: { full_name: 'Alice' } },
      { id: 'm-2', user_id: 'u-2', role: 'foreman', profile: { full_name: 'Bob' } },
    ]
    const chain = makeChain()
    chain.eq.mockResolvedValue({ data: members, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.loadMembers('p-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(mockFrom).toHaveBeenCalledWith('project_members')
  })

  it('returns DatabaseError on failure', async () => {
    const chain = makeChain()
    chain.eq.mockResolvedValue({ data: null, error: { message: 'rls violation' } })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.loadMembers('p-1')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

describe('projectService.addMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()

    const result = await projectService.addMember('p-1', 'u-2', 'foreman')

    expect(result.error?.category).toBe('PermissionError')
    expect(result.data).toBeNull()
  })

  it('inserts member and returns ok when authenticated', async () => {
    session('u-1')
    const chain = makeChain()
    chain.insert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.addMember('p-1', 'u-2', 'superintendent')

    expect(result.error).toBeNull()
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'p-1', user_id: 'u-2', role: 'superintendent' })
    )
  })

  it('returns DatabaseError when insert fails', async () => {
    session('u-1')
    const chain = makeChain()
    chain.insert.mockResolvedValue({ error: { message: 'unique violation' } })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.addMember('p-1', 'u-2', 'foreman')

    expect(result.error?.category).toBe('DatabaseError')
  })
})

describe('projectService.removeMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the member row and returns ok', async () => {
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.removeMember('m-1')

    expect(result.error).toBeNull()
    expect(mockFrom).toHaveBeenCalledWith('project_members')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'm-1')
  })

  it('returns DatabaseError when delete fails', async () => {
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: { message: 'not found' } })
    mockFrom.mockReturnValue(chain)

    const result = await projectService.removeMember('m-missing')

    expect(result.error?.category).toBe('DatabaseError')
  })
})
