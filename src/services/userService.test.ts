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
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = mockSingle
  Object.assign(chain, overrides)
  return chain
}

describe('userService.createProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts profile and returns null data on success', async () => {
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const { userService } = await import('./userService')
    const result = await userService.createProfile('user-1', 'Jane Doe', 'Jane', 'Doe')

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', full_name: 'Jane Doe', first_name: 'Jane', last_name: 'Doe' }),
    )
    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
  })

  it('defaults last_name to null when omitted', async () => {
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const { userService } = await import('./userService')
    await userService.createProfile('user-2', 'Bob', 'Bob')

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ last_name: null }),
    )
  })

  it('returns DatabaseError when insert fails', async () => {
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: { message: 'duplicate key' } })
    mockFrom.mockReturnValue(chain)

    const { userService } = await import('./userService')
    const result = await userService.createProfile('user-1', 'Jane', 'Jane')

    expect(result.error).not.toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
    expect(result.error!.message).toBe('duplicate key')
  })
})

describe('userService.loadProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns profile on success', async () => {
    const profile = { user_id: 'user-1', full_name: 'Jane Doe', first_name: 'Jane' }
    mockSingle.mockResolvedValue({ data: profile, error: null })
    mockFrom.mockReturnValue(makeChain())

    const { userService } = await import('./userService')
    const result = await userService.loadProfile('user-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(profile)
  })

  it('returns DatabaseError when profile not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'no rows returned' } })
    mockFrom.mockReturnValue(makeChain())

    const { userService } = await import('./userService')
    const result = await userService.loadProfile('user-missing')

    expect(result.data).toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
  })
})

describe('userService.updateProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns null data on success', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { userService } = await import('./userService')
    const result = await userService.updateProfile('user-1', { full_name: 'Updated Name' })

    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ full_name: 'Updated Name' })
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('returns DatabaseError on failure', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const { userService } = await import('./userService')
    const result = await userService.updateProfile('user-1', { full_name: 'Bad' })

    expect(result.error!.category).toBe('DatabaseError')
  })
})

describe('userService.createOrganization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when userId is empty', async () => {
    const { userService } = await import('./userService')
    const result = await userService.createOrganization('Acme Corp', '')

    expect(result.data).toBeNull()
    expect(result.error!.category).toBe('PermissionError')
  })

  it('creates org, adds owner membership, and updates profile', async () => {
    const org = { id: 'org-1', name: 'Acme Corp', slug: 'acme-corp' }
    mockSingle.mockResolvedValue({ data: org, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        return chain
      }
      // organization_members insert + profiles update
      return { insert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })

    const { userService } = await import('./userService')
    const result = await userService.createOrganization('Acme Corp', 'user-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(org)
  })

  it('slugifies org name correctly', async () => {
    const org = { id: 'org-2', name: 'Big Build Co.', slug: 'big-build-co' }
    mockSingle.mockResolvedValue({ data: org, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        const chain = makeChain()
        ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
        return chain
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })

    const { userService } = await import('./userService')
    const result = await userService.createOrganization('Big Build Co.', 'user-2')

    expect(result.error).toBeNull()
    const insertCall = (mockFrom.mock.results[0].value.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertCall.slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('returns DatabaseError when org insert fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'unique violation' } })
    const chain = makeChain()
    ;(chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const { userService } = await import('./userService')
    const result = await userService.createOrganization('Duplicate Org', 'user-1')

    expect(result.data).toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
  })
})

describe('userService.loadOrganization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns org on success', async () => {
    const org = { id: 'org-1', name: 'Acme' }
    mockSingle.mockResolvedValue({ data: org, error: null })
    mockFrom.mockReturnValue(makeChain())

    const { userService } = await import('./userService')
    const result = await userService.loadOrganization('org-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(org)
  })

  it('returns DatabaseError when org not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(makeChain())

    const { userService } = await import('./userService')
    const result = await userService.loadOrganization('org-missing')

    expect(result.data).toBeNull()
    expect(result.error!.category).toBe('DatabaseError')
  })
})
