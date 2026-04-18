import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — must be hoisted before imports
// ---------------------------------------------------------------------------
const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { validateTransition, logTransition } from './stateMachineUtils'

// ---------------------------------------------------------------------------
// validateTransition
// ---------------------------------------------------------------------------

describe('validateTransition', () => {
  it('returns null when newState is in validTargets', () => {
    const result = validateTransition('rfi', 'draft', 'open', ['open', 'void'])
    expect(result).toBeNull()
  })

  it('returns ServiceError when newState is not in validTargets', () => {
    const result = validateTransition('rfi', 'draft', 'closed', ['open', 'void'])
    expect(result).not.toBeNull()
    expect(result!.category).toBe('ValidationError')
    expect(result!.code).toBe('INVALID_TRANSITION')
  })

  it('error message contains entity type, current state, and new state', () => {
    const result = validateTransition('submittal', 'approved', 'draft', ['closed'])
    expect(result!.message).toContain('submittal')
    expect(result!.message).toContain('approved')
    expect(result!.message).toContain('draft')
  })

  it('error message contains "Invalid transition"', () => {
    const result = validateTransition('change_order', 'draft', 'approved', ['pending_review'])
    expect(result!.message).toContain('Invalid transition')
  })

  it('error context includes all relevant fields', () => {
    const result = validateTransition('punch_item', 'open', 'verified', ['in_progress'])
    expect(result!.context).toMatchObject({
      entityType: 'punch_item',
      currentState: 'open',
      newState: 'verified',
      validTargets: ['in_progress'],
    })
  })

  it('returns error when validTargets is empty (terminal state)', () => {
    const result = validateTransition('rfi', 'void', 'open', [])
    expect(result).not.toBeNull()
    expect(result!.message).toContain('none')
  })

  it('userMessage equals message for clear user-facing errors', () => {
    const result = validateTransition('rfi', 'closed', 'draft', ['open'])
    expect(result!.userMessage).toBe(result!.message)
  })
})

// ---------------------------------------------------------------------------
// logTransition
// ---------------------------------------------------------------------------

describe('logTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ insert: mockInsert.mockResolvedValue({ data: null, error: null }) })
  })

  it('calls supabase with action status_change and correct states', async () => {
    await logTransition({
      entityType: 'rfis',
      entityId: 'rfi-uuid-123',
      projectId: 'proj-uuid-456',
      userId: 'user-uuid-789',
      currentState: 'draft',
      newState: 'open',
      role: 'gc_member',
    })

    expect(mockFrom).toHaveBeenCalledWith('audit_log')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status_change',
        entity_type: 'rfis',
        before_state: { status: 'draft' },
        after_state: { status: 'open' },
      }),
    )
  })

  it('resolves without throwing when supabase.from throws synchronously', async () => {
    mockFrom.mockImplementation(() => { throw new Error('connection refused') })

    await expect(
      logTransition({
        entityType: 'rfis',
        entityId: 'rfi-uuid',
        projectId: 'proj-uuid',
        userId: null,
        currentState: 'draft',
        newState: 'open',
        role: 'admin',
      }),
    ).resolves.toBeUndefined()
  })

  it('resolves without throwing when insert rejects', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockRejectedValue(new Error('db error')),
    })

    await expect(
      logTransition({
        entityType: 'submittals',
        entityId: 'sub-uuid',
        projectId: 'proj-uuid',
        userId: 'user-uuid',
        currentState: 'submitted',
        newState: 'gc_review',
        role: 'project_manager',
      }),
    ).resolves.toBeUndefined()
  })

  it('includes role and transition string in metadata', async () => {
    await logTransition({
      entityType: 'change_orders',
      entityId: 'co-uuid',
      projectId: 'proj-uuid',
      userId: 'user-uuid',
      currentState: 'pending_review',
      newState: 'approved',
      role: 'owner',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          role: 'owner',
          transition: 'pending_review → approved',
        }),
      }),
    )
  })
})
