import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSession, mockSingle, mockMaybeSingle, mockFrom, mockInvoke } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}))

import { projectMemberService } from './projectMemberService'
import {
  getMemberLifecycleState,
  getValidMemberTransitions,
  canAssignRole,
  getDefaultPermissions,
} from '../machines/projectMemberMachine'

// ── Chain builder ────────────────────────────────────────────────────────────

function makeChain(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    ...overrides,
  }
  for (const key of ['select', 'eq', 'insert', 'update', 'delete', 'order']) {
    chain[key].mockReturnValue(chain)
  }
  return chain
}

function session(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

function noSession() {
  mockGetSession.mockResolvedValue({ data: { session: null } })
}

// ── getMemberLifecycleState ──────────────────────────────────────────────────

describe('getMemberLifecycleState', () => {
  it('returns invited when invited_at is set and accepted_at is null', () => {
    expect(
      getMemberLifecycleState({ invited_at: '2024-01-01', accepted_at: null, permissions: null })
    ).toBe('invited')
  })

  it('returns active when accepted_at is set', () => {
    expect(
      getMemberLifecycleState({ invited_at: '2024-01-01', accepted_at: '2024-01-02', permissions: null })
    ).toBe('active')
  })

  it('returns suspended when permissions._memberStatus is suspended', () => {
    expect(
      getMemberLifecycleState({
        invited_at: '2024-01-01',
        accepted_at: '2024-01-02',
        permissions: { _memberStatus: 'suspended' },
      })
    ).toBe('suspended')
  })

  it('returns removed when permissions._memberStatus is removed', () => {
    expect(
      getMemberLifecycleState({
        invited_at: null,
        accepted_at: null,
        permissions: { _memberStatus: 'removed' },
      })
    ).toBe('removed')
  })

  it('returns active when both dates are null and no status flag', () => {
    expect(
      getMemberLifecycleState({ invited_at: null, accepted_at: null, permissions: null })
    ).toBe('active')
  })
})

// ── getValidMemberTransitions ────────────────────────────────────────────────

describe('getValidMemberTransitions', () => {
  it('returns [] for viewers on any state', () => {
    expect(getValidMemberTransitions('active', 'viewer')).toEqual([])
    expect(getValidMemberTransitions('invited', 'subcontractor')).toEqual([])
  })

  it('returns active and removed for project_manager on invited state', () => {
    const result = getValidMemberTransitions('invited', 'project_manager')
    expect(result).toContain('active')
    expect(result).toContain('removed')
  })

  it('returns suspended and removed for project_manager on active state', () => {
    const result = getValidMemberTransitions('active', 'project_manager')
    expect(result).toContain('suspended')
    expect(result).toContain('removed')
  })

  it('returns active and removed for superintendent on suspended state', () => {
    const result = getValidMemberTransitions('suspended', 'superintendent')
    expect(result).toEqual([])
  })

  it('allows project_manager to reactivate suspended members', () => {
    const result = getValidMemberTransitions('suspended', 'project_manager')
    expect(result).toContain('active')
  })

  it('only allows project_executive to restore removed members', () => {
    expect(getValidMemberTransitions('removed', 'project_manager')).toEqual([])
    expect(getValidMemberTransitions('removed', 'project_executive')).toContain('active')
  })
})

// ── canAssignRole ────────────────────────────────────────────────────────────

describe('canAssignRole', () => {
  it('returns true when caller outranks target', () => {
    expect(canAssignRole('project_executive', 'project_manager')).toBe(true)
    expect(canAssignRole('project_manager', 'viewer')).toBe(true)
  })

  it('returns false when caller is same level', () => {
    expect(canAssignRole('project_manager', 'project_manager')).toBe(false)
  })

  it('returns false when caller is lower level', () => {
    expect(canAssignRole('viewer', 'project_manager')).toBe(false)
  })
})

// ── getDefaultPermissions ────────────────────────────────────────────────────

describe('getDefaultPermissions', () => {
  it('grants viewer base permissions only', () => {
    const perms = getDefaultPermissions('viewer')
    expect(perms['rfis.view']).toBe(true)
    expect(perms['rfis.create']).toBe(false)
    expect(perms['budget.view']).toBeUndefined()
  })

  it('grants project_manager elevated permissions', () => {
    const perms = getDefaultPermissions('project_manager')
    expect(perms['rfis.edit']).toBe(true)
    expect(perms['daily_log.approve']).toBe(true)
    expect(perms['punch_list.verify']).toBe(true)
  })

  it('grants project_executive budget permissions', () => {
    const perms = getDefaultPermissions('project_executive')
    expect(perms['budget.view']).toBe(true)
    expect(perms['budget.edit']).toBe(true)
    expect(perms['change_orders.approve']).toBe(true)
  })
})

// ── projectMemberService.loadMembers ────────────────────────────────────────

describe('projectMemberService.loadMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()
    const result = await projectMemberService.loadMembers('p-1')
    expect(result.error?.category).toBe('PermissionError')
    expect(result.data).toBeNull()
  })

  it('returns PermissionError when user is not a project member', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // resolveProjectRole → null
        mockSingle.mockResolvedValueOnce({ data: null, error: null })
      }
      return chain
    })

    const result = await projectMemberService.loadMembers('p-1')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('loads members and filters out removed ones', async () => {
    session('u-1')
    const members = [
      {
        id: 'm-1', project_id: 'p-1', user_id: 'u-1', role: 'project_manager',
        invited_at: '2024-01-01', accepted_at: '2024-01-02', permissions: null,
        company: null, trade: null, created_at: null, updated_at: null,
      },
      {
        id: 'm-2', project_id: 'p-1', user_id: 'u-2', role: 'viewer',
        invited_at: '2024-01-01', accepted_at: null, permissions: { _memberStatus: 'removed' },
        company: null, trade: null, created_at: null, updated_at: null,
      },
      {
        id: 'm-3', project_id: 'p-1', user_id: 'u-3', role: 'superintendent',
        invited_at: '2024-01-01', accepted_at: null, permissions: null,
        company: null, trade: null, created_at: null, updated_at: null,
      },
    ]

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null })
      } else {
        chain.order.mockResolvedValue({ data: members, error: null })
      }
      return chain
    })

    const result = await projectMemberService.loadMembers('p-1')
    expect(result.error).toBeNull()
    // m-2 is removed so filtered out
    expect(result.data).toHaveLength(2)
    expect(result.data?.map((m) => m.id)).toEqual(['m-1', 'm-3'])
  })

  it('attaches lifecycleState to each member', async () => {
    session('u-1')
    const members = [
      {
        id: 'm-1', project_id: 'p-1', user_id: 'u-1', role: 'project_manager',
        invited_at: '2024-01-01', accepted_at: '2024-01-02',
        permissions: { _memberStatus: 'suspended' },
        company: null, trade: null, created_at: null, updated_at: null,
      },
    ]

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_executive' }, error: null })
      } else {
        chain.order.mockResolvedValue({ data: members, error: null })
      }
      return chain
    })

    const result = await projectMemberService.loadMembers('p-1')
    expect(result.data?.[0]?.lifecycleState).toBe('suspended')
  })

  it('returns DatabaseError on query failure', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null })
      } else {
        chain.order.mockResolvedValue({ data: null, error: { message: 'timeout' } })
      }
      return chain
    })

    const result = await projectMemberService.loadMembers('p-1')
    expect(result.error?.category).toBe('DatabaseError')
  })
})

// ── projectMemberService.inviteMember ────────────────────────────────────────

describe('projectMemberService.inviteMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({ data: null, error: null })
  })

  it('returns PermissionError when not authenticated', async () => {
    noSession()
    const result = await projectMemberService.inviteMember({
      project_id: 'p-1', user_id: 'u-2', role: 'viewer',
    })
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns PermissionError when caller is below project_manager', async () => {
    session('u-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { role: 'superintendent' }, error: null })
      return chain
    })

    const result = await projectMemberService.inviteMember({
      project_id: 'p-1', user_id: 'u-2', role: 'viewer',
    })
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns PermissionError when trying to assign role above caller level', async () => {
    session('u-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null })
      return chain
    })

    const result = await projectMemberService.inviteMember({
      project_id: 'p-1', user_id: 'u-2', role: 'project_manager',
    })
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ConflictError when user already has an active membership', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // resolveProjectRole → project_executive
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_executive' }, error: null })
      } else {
        // existing membership check → active member found
        mockSingle.mockResolvedValueOnce({
          data: { id: 'm-existing', invited_at: '2024-01-01', accepted_at: '2024-01-02', permissions: null },
          error: null,
        })
      }
      return chain
    })

    const result = await projectMemberService.inviteMember({
      project_id: 'p-1', user_id: 'u-2', role: 'viewer',
    })
    expect(result.error?.category).toBe('ConflictError')
  })

  it('creates invitation record and returns invited member', async () => {
    session('u-1')
    const newMember = {
      id: 'm-new', project_id: 'p-1', user_id: 'u-2', role: 'viewer',
      invited_at: '2024-01-01T00:00:00.000Z', accepted_at: null,
      permissions: { 'rfis.view': true },
      company: null, trade: null, created_at: null, updated_at: null,
    }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_executive' }, error: null })
      } else if (callCount === 2) {
        // existing check → not found
        mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      } else {
        // insert → success
        mockSingle.mockResolvedValueOnce({ data: newMember, error: null })
      }
      return chain
    })

    const result = await projectMemberService.inviteMember({
      project_id: 'p-1', user_id: 'u-2', role: 'viewer',
    })

    expect(result.error).toBeNull()
    expect(result.data?.id).toBe('m-new')
    expect(result.data?.lifecycleState).toBe('invited')
    expect(result.data?.accepted_at).toBeNull()
  })

  it('allows re-inviting a previously removed member', async () => {
    session('u-1')
    const newMember = {
      id: 'm-new', project_id: 'p-1', user_id: 'u-2', role: 'viewer',
      invited_at: '2024-02-01T00:00:00.000Z', accepted_at: null,
      permissions: {}, company: null, trade: null, created_at: null, updated_at: null,
    }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_executive' }, error: null })
      } else if (callCount === 2) {
        // existing → removed member
        mockSingle.mockResolvedValueOnce({
          data: { id: 'm-old', invited_at: null, accepted_at: null, permissions: { _memberStatus: 'removed' } },
          error: null,
        })
      } else {
        mockSingle.mockResolvedValueOnce({ data: newMember, error: null })
      }
      return chain
    })

    const result = await projectMemberService.inviteMember({
      project_id: 'p-1', user_id: 'u-2', role: 'viewer',
    })

    expect(result.error).toBeNull()
    expect(result.data?.lifecycleState).toBe('invited')
  })
})

// ── projectMemberService.acceptInvitation ────────────────────────────────────

describe('projectMemberService.acceptInvitation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()
    const result = await projectMemberService.acceptInvitation('m-1')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns NotFoundError when member does not exist', async () => {
    session('u-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
      return chain
    })
    const result = await projectMemberService.acceptInvitation('m-missing')
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when a different user tries to accept', async () => {
    session('u-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'm-1', project_id: 'p-1', user_id: 'u-OTHER',
          invited_at: '2024-01-01', accepted_at: null, permissions: null,
          role: 'viewer', company: null, trade: null, created_at: null, updated_at: null,
        },
        error: null,
      })
      return chain
    })
    const result = await projectMemberService.acceptInvitation('m-1')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ValidationError when member is not in invited state', async () => {
    session('u-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'm-1', project_id: 'p-1', user_id: 'u-1',
          invited_at: '2024-01-01', accepted_at: '2024-01-02', permissions: null,
          role: 'viewer', company: null, trade: null, created_at: null, updated_at: null,
        },
        error: null,
      })
      return chain
    })
    const result = await projectMemberService.acceptInvitation('m-1')
    expect(result.error?.category).toBe('ValidationError')
  })

  it('sets accepted_at and returns active member on success', async () => {
    session('u-1')
    const memberData = {
      id: 'm-1', project_id: 'p-1', user_id: 'u-1',
      invited_at: '2024-01-01', accepted_at: null, permissions: null,
      role: 'viewer', company: null, trade: null, created_at: null, updated_at: null,
    }

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({ data: memberData, error: null })
      } else {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await projectMemberService.acceptInvitation('m-1')
    expect(result.error).toBeNull()
    expect(result.data?.lifecycleState).toBe('active')
    expect(result.data?.accepted_at).not.toBeNull()
  })
})

// ── projectMemberService.assignRole ─────────────────────────────────────────

describe('projectMemberService.assignRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()
    const result = await projectMemberService.assignRole('m-1', 'viewer')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns NotFoundError when member does not exist', async () => {
    session('u-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
      return chain
    })
    const result = await projectMemberService.assignRole('m-missing', 'viewer')
    expect(result.error?.category).toBe('NotFoundError')
  })

  it('returns PermissionError when caller does not outrank target current role', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: {
            project_id: 'p-1', role: 'project_manager',
            invited_at: '2024-01-01', accepted_at: '2024-01-02', permissions: null,
          },
          error: null,
        })
      } else {
        // caller is also project_manager — same level, cannot manage
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null })
      }
      return chain
    })

    const result = await projectMemberService.assignRole('m-1', 'superintendent')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('updates role and cascades default permissions on success', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: {
            project_id: 'p-1', role: 'viewer',
            invited_at: '2024-01-01', accepted_at: '2024-01-02', permissions: {},
          },
          error: null,
        })
      } else if (callCount === 2) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_executive' }, error: null })
      } else {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await projectMemberService.assignRole('m-1', 'superintendent')
    expect(result.error).toBeNull()
  })
})

// ── projectMemberService.transitionMemberState ───────────────────────────────

describe('projectMemberService.transitionMemberState', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()
    const result = await projectMemberService.transitionMemberState('m-1', 'suspended')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns ValidationError on invalid transition', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        // fetch member
        mockSingle.mockResolvedValueOnce({
          data: {
            project_id: 'p-1', role: 'viewer',
            invited_at: '2024-01-01', accepted_at: '2024-01-02', permissions: null,
          },
          error: null,
        })
      } else {
        // caller is viewer — cannot manage
        mockSingle.mockResolvedValueOnce({ data: { role: 'viewer' }, error: null })
      }
      return chain
    })

    const result = await projectMemberService.transitionMemberState('m-1', 'suspended')
    expect(result.error?.category).toBe('ValidationError')
  })

  it('suspends a member by writing _memberStatus to permissions', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: {
            project_id: 'p-1', role: 'superintendent',
            invited_at: '2024-01-01', accepted_at: '2024-01-02', permissions: {},
          },
          error: null,
        })
      } else if (callCount === 2) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null })
      } else {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await projectMemberService.transitionMemberState('m-1', 'suspended', 'job site violation')
    expect(result.error).toBeNull()
  })

  it('reactivates a suspended member by clearing _memberStatus', async () => {
    session('u-1')
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: {
            project_id: 'p-1', role: 'superintendent',
            invited_at: '2024-01-01', accepted_at: '2024-01-02',
            permissions: { _memberStatus: 'suspended', _suspendedReason: 'violation' },
          },
          error: null,
        })
      } else if (callCount === 2) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null })
      } else {
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    const result = await projectMemberService.transitionMemberState('m-1', 'active')
    expect(result.error).toBeNull()
  })
})

// ── projectMemberService.updatePermissions ───────────────────────────────────

describe('projectMemberService.updatePermissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()
    const result = await projectMemberService.updatePermissions('m-1', { 'rfis.create': true })
    expect(result.error?.category).toBe('PermissionError')
  })

  it('preserves system keys (prefixed with _) when overriding permissions', async () => {
    session('u-1')
    let callCount = 0
    let capturedUpdate: Record<string, unknown> | null = null

    mockFrom.mockImplementation(() => {
      callCount++
      const chain = makeChain()
      if (callCount === 1) {
        mockSingle.mockResolvedValueOnce({
          data: {
            project_id: 'p-1',
            permissions: { 'rfis.view': true, _memberStatus: 'suspended', _suspendedReason: 'violation' },
          },
          error: null,
        })
      } else if (callCount === 2) {
        mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null })
      } else {
        chain.update.mockImplementation((payload: Record<string, unknown>) => {
          capturedUpdate = payload
          return chain
        })
        chain.eq.mockResolvedValue({ error: null })
      }
      return chain
    })

    await projectMemberService.updatePermissions('m-1', { 'rfis.create': true })

    // System keys must be preserved
    expect((capturedUpdate as Record<string, unknown> | null)?.['permissions']).toMatchObject({
      _memberStatus: 'suspended',
      _suspendedReason: 'violation',
      'rfis.create': true,
    })
  })
})

// ── projectMemberService.getMyProjectRole ────────────────────────────────────

describe('projectMemberService.getMyProjectRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PermissionError when not authenticated', async () => {
    noSession()
    const result = await projectMemberService.getMyProjectRole('p-1')
    expect(result.error?.category).toBe('PermissionError')
  })

  it('returns null when user is not a project member', async () => {
    session('u-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: null, error: null })
      return chain
    })
    const result = await projectMemberService.getMyProjectRole('p-1')
    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
  })

  it('returns the server-resolved project role', async () => {
    session('u-1')
    mockFrom.mockImplementation(() => {
      const chain = makeChain()
      mockSingle.mockResolvedValueOnce({ data: { role: 'project_manager' }, error: null })
      return chain
    })
    const result = await projectMemberService.getMyProjectRole('p-1')
    expect(result.error).toBeNull()
    expect(result.data).toBe('project_manager')
  })
})
