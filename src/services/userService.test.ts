import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSingle, mockFrom } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: mockFrom,
  },
}))

import { userService } from './userService'

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
    maybeSingle: vi.fn(),
  }
  for (const key of ['select', 'eq', 'insert', 'update', 'delete', 'order']) {
    chain[key].mockReturnValue(chain)
  }
  return chain
}

describe('userService.createProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts profile with all fields and returns ok', async () => {
    const chain = makeChain()
    chain.insert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await userService.createProfile('u-1', 'Jane Doe', 'Jane', 'Doe')

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-1', full_name: 'Jane Doe', first_name: 'Jane', last_name: 'Doe' })
    )
    expect(result.error).toBeNull()
  })

  it('uses null for missing lastName', async () => {
    const chain = makeChain()
    chain.insert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    await userService.createProfile('u-1', 'Jane', 'Jane')

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ last_name: null })
    )
  })

  it('returns DatabaseError on insert failure', async () => {
    const chain = makeChain()
    chain.insert.mockResolvedValue({ error: { message: 'duplicate key' } })
    mockFrom.mockReturnValue(chain)

    const result = await userService.createProfile('u-1', 'Jane', 'Jane')

    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.message).toBe('duplicate key')
    expect(result.data).toBeNull()
  })
})

describe('userService.loadProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns profile on success', async () => {
    const profile = { user_id: 'u-1', full_name: 'Jane Doe', first_name: 'Jane' }
    mockSingle.mockResolvedValue({ data: profile, error: null })
    mockFrom.mockReturnValue(makeChain())

    const result = await userService.loadProfile('u-1')

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ user_id: 'u-1' })
  })

  it('returns DatabaseError when profile not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'no rows returned' } })
    mockFrom.mockReturnValue(makeChain())

    const result = await userService.loadProfile('u-missing')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.context).toMatchObject({ userId: 'u-missing' })
  })
})

describe('userService.updateProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns ok', async () => {
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await userService.updateProfile('u-1', { full_name: 'John' })

    expect(result.error).toBeNull()
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'John' }))
  })

  it('returns DatabaseError on update failure', async () => {
    const chain = makeChain()
    chain.eq.mockResolvedValue({ error: { message: 'update failed' } })
    mockFrom.mockReturnValue(chain)

    const result = await userService.updateProfile('u-1', {})

    expect(result.error?.category).toBe('DatabaseError')
  })
})

describe('userService.loadOrganization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns organization on success', async () => {
    const org = { id: 'org-1', name: 'ACME', slug: 'acme' }
    mockSingle.mockResolvedValue({ data: org, error: null })
    mockFrom.mockReturnValue(makeChain())

    const result = await userService.loadOrganization('org-1')

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ id: 'org-1' })
  })

  it('returns DatabaseError when organization not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    mockFrom.mockReturnValue(makeChain())

    const result = await userService.loadOrganization('org-missing')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

describe('userService.createOrganization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when userId is empty string', async () => {
    const result = await userService.createOrganization('ACME', '')

    expect(result.error?.category).toBe('PermissionError')
    expect(result.data).toBeNull()
  })

  it('creates org, adds owner as member, and updates profile', async () => {
    const org = { id: 'org-1', name: 'ACME Corp', slug: 'acme-corp' }
    mockSingle.mockResolvedValue({ data: org, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 2) {
        chain.insert.mockResolvedValue({ error: null })
      } else if (callCount === 3) {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await userService.createOrganization('ACME Corp', 'u-1')

    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('org-1')
  })

  it('generates a url-safe slug from org name', async () => {
    const org = { id: 'org-2', name: 'Build & Design LLC', slug: 'build-design-llc' }
    mockSingle.mockResolvedValue({ data: org, error: null })

    let callCount = 0
    let insertArg: Record<string, unknown> | null = null
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        chain.insert.mockImplementation((v: Record<string, unknown>) => {
          insertArg = v
          return chain
        })
      } else if (callCount === 2) {
        chain.insert.mockResolvedValue({ error: null })
      } else {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    await userService.createOrganization('Build & Design LLC', 'u-1')

    expect(insertArg?.slug).toMatch(/^[a-z0-9-]+$/)
    expect(String(insertArg?.slug)).not.toMatch(/^-|-$/)
  })

  it('returns DatabaseError when org insert fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'unique constraint' } })
    mockFrom.mockReturnValue(makeChain())

    const result = await userService.createOrganization('ACME', 'u-1')

    expect(result.error?.category).toBe('DatabaseError')
  })
})
