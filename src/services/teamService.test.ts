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

import { teamService } from './teamService'

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
    neq: vi.fn(),
  }
  for (const key of ['select', 'eq', 'in', 'insert', 'update', 'delete', 'order', 'neq']) {
    chain[key].mockReturnValue(chain)
  }
  // .in() is the terminator for the profiles batch query — default to empty.
  chain.in.mockResolvedValue({ data: [], error: null })
  return chain
}

function session(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

function noSession() {
  mockGetSession.mockResolvedValue({ data: { session: null } })
}

// ── loadTeamMembers ──────────────────────────────────────────────────────────

describe('teamService.loadTeamMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()

    const result = await teamService.loadTeamMembers('org-1')

    expect(result.error?.category).toBe('PermissionError')
    expect(result.data).toBeNull()
  })

  it('returns PermissionError when user is not an org member', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // resolveOrgRole → returns null (not a member)
        mockSingle.mockResolvedValueOnce({ data: null, error: null })
      }
      return chain
    })

    const result = await teamService.loadTeamMembers('org-1')

    expect(result.error?.category).toBe('PermissionError')
    expect(result.data).toBeNull()
  })

  it('returns members list when user is a valid org member', async () => {
    session('u-1')

    const members = [
      { id: 'm-1', organization_id: 'org-1', user_id: 'u-1', role: 'owner', created_at: null },
      { id: 'm-2', organization_id: 'org-1', user_id: 'u-2', role: 'member', created_at: null },
    ]

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // resolveOrgRole → returns 'owner'
        mockSingle.mockResolvedValueOnce({ data: { role: 'owner' }, error: null })
      } else {
        // loadTeamMembers → returns members
        chain.order.mockResolvedValue({ data: members, error: null })
      }
      return chain
    })

    const result = await teamService.loadTeamMembers('org-1')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
  })

  it('returns DatabaseError on query failure', async () => {
    session('u-1')

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      } else {
        chain.order.mockResolvedValue({ data: null, error: { message: 'connection timeout' } })
      }
      return chain
    })

    const result = await teamService.loadTeamMembers('org-1')

    expect(result.data).toBeNull()
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ── addTeamMember ────────────────────────────────────────────────────────────

describe('teamService.addTeamMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()

    const result = await teamService.addTeamMember('org-1', 'u-2', 'member')

    expect(result.error?.category).toBe('PermissionError')
    expect(result.data).toBeNull()
  })

  it('returns PermissionError when caller is a plain member', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { role: 'member' }, error: null })
      return chain
    })

    const result = await teamService.addTeamMember('org-1', 'u-2', 'member')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns PermissionError when trying to assign owner role', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      return chain
    })

    const result = await teamService.addTeamMember('org-1', 'u-2', 'owner')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ConflictError when user is already a member', async () => {
    session('u-1')

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // resolveOrgRole → admin
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      } else {
        // existing membership check → found
        mockSingle.mockResolvedValueOnce({ data: { id: 'm-existing' }, error: null })
      }
      return chain
    })

    const result = await teamService.addTeamMember('org-1', 'u-2', 'member')

    expect(result.error?.category).toBe('ConflictError')
  })

  it('inserts member and returns ok when admin adds a new member', async () => {
    session('u-1')

    const newMember = { id: 'm-new', organization_id: 'org-1', user_id: 'u-2', role: 'member', created_at: null }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // resolveOrgRole → admin
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      } else if (callCount === 2) {
        // existing check → not found
        mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      } else {
        // insert → success
        mockSingle.mockResolvedValueOnce({ data: newMember, error: null })
      }
      return chain
    })

    const result = await teamService.addTeamMember('org-1', 'u-2', 'member')

    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('m-new')
  })
})

// ── updateMemberRole ─────────────────────────────────────────────────────────

describe('teamService.updateMemberRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()

    const result = await teamService.updateMemberRole('org-1', 'm-1', 'admin')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns PermissionError when trying to set owner role', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      return chain
    })

    const result = await teamService.updateMemberRole('org-1', 'm-1', 'owner')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns NotFoundError when member does not exist in org', async () => {
    session('u-1')

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      } else {
        mockSingle.mockResolvedValueOnce({ data: null, error: null })
      }
      return chain
    })

    const result = await teamService.updateMemberRole('org-1', 'm-missing', 'member')

    expect(result.error?.category).toBe('NotFoundError')
  })

  it('updates role and returns ok', async () => {
    session('u-1')

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      } else if (callCount === 2) {
        mockSingle.mockResolvedValueOnce({ data: { id: 'm-1', role: 'member' }, error: null })
      } else {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await teamService.updateMemberRole('org-1', 'm-1', 'admin')

    expect(result.error).toBeNull()
  })
})

// ── removeTeamMember ─────────────────────────────────────────────────────────

describe('teamService.removeTeamMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()

    const result = await teamService.removeTeamMember('org-1', 'm-1')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns PermissionError when caller is a plain member', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { role: 'member' }, error: null })
      return chain
    })

    const result = await teamService.removeTeamMember('org-1', 'm-1')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns PermissionError when trying to remove an owner', async () => {
    session('u-1')

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      } else {
        mockSingle.mockResolvedValueOnce({ data: { id: 'm-1', role: 'owner', user_id: 'u-2' }, error: null })
      }
      return chain
    })

    const result = await teamService.removeTeamMember('org-1', 'm-1')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('removes member and returns ok', async () => {
    session('u-1')

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      } else if (callCount === 2) {
        mockSingle.mockResolvedValueOnce({ data: { id: 'm-2', role: 'member', user_id: 'u-2' }, error: null })
      } else {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await teamService.removeTeamMember('org-1', 'm-2')

    expect(result.error).toBeNull()
  })
})

// ── createInvitation ─────────────────────────────────────────────────────────

describe('teamService.createInvitation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()

    const result = await teamService.createInvitation({
      project_id: 'p-1',
      email: 'test@example.com',
      portal_type: 'subcontractor',
    })

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ConflictError when active invitation already exists', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { id: 'inv-existing', accepted: false }, error: null })
      return chain
    })

    const result = await teamService.createInvitation({
      project_id: 'p-1',
      email: 'existing@example.com',
      portal_type: 'subcontractor',
    })

    expect(result.error?.category).toBe('ConflictError')
  })

  it('creates invitation and returns it on success', async () => {
    session('u-1')

    const invitation = {
      id: 'inv-new',
      project_id: 'p-1',
      email: 'new@example.com',
      portal_type: 'subcontractor',
      invited_by: 'u-1',
      accepted: false,
    }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // existing check → not found
        mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      } else {
        // insert → success
        mockSingle.mockResolvedValueOnce({ data: invitation, error: null })
      }
      return chain
    })

    const result = await teamService.createInvitation({
      project_id: 'p-1',
      email: 'new@example.com',
      portal_type: 'subcontractor',
    })

    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('inv-new')
    expect(result.data?.email).toBe('new@example.com')
  })
})

// ── revokeInvitation ─────────────────────────────────────────────────────────

describe('teamService.revokeInvitation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()

    const result = await teamService.revokeInvitation('inv-1')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns NotFoundError when invitation does not exist', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: null, error: null })
      return chain
    })

    const result = await teamService.revokeInvitation('inv-missing')

    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns ConflictError when invitation is already accepted', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { id: 'inv-1', invited_by: 'u-1', accepted: true }, error: null })
      return chain
    })

    const result = await teamService.revokeInvitation('inv-1')

    expect(result.error?.category).toBe('ConflictError')
  })

  it('returns PermissionError when a different user tries to revoke', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { id: 'inv-1', invited_by: 'u-other', accepted: false }, error: null })
      return chain
    })

    const result = await teamService.revokeInvitation('inv-1')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('deletes the invitation and returns ok', async () => {
    session('u-1')

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { id: 'inv-1', invited_by: 'u-1', accepted: false }, error: null })
      } else {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await teamService.revokeInvitation('inv-1')

    expect(result.error).toBeNull()
  })
})

// ── getMyOrgRole ─────────────────────────────────────────────────────────────

describe('teamService.getMyOrgRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()

    const result = await teamService.getMyOrgRole('org-1')

    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns null when user is not an org member', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: null, error: null })
      return chain
    })

    const result = await teamService.getMyOrgRole('org-1')

    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
  })

  it('returns the server-resolved role', async () => {
    session('u-1')

    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      return chain
    })

    const result = await teamService.getMyOrgRole('org-1')

    expect(result.error).toBeNull()
    expect(result.data).toBe('admin')
  })
})
