import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ──────────────────────────────────────────────────────────

const mockInsert = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}))

function setupSupabaseMock({
  userId = 'user-abc',
  email = 'super@construction.com',
  fullName = 'John Super',
  insertError = null as null | { message: string },
} = {}) {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email,
        user_metadata: { full_name: fullName },
      },
    },
    error: null,
  })

  const chain = {
    insert: mockInsert,
  }
  mockInsert.mockResolvedValue({ data: null, error: insertError })
  mockFrom.mockReturnValue(chain)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('logAuditEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSupabaseMock()
  })

  it('should call supabase.from("audit_log").insert with correct fields', async () => {
    const { logAuditEntry } = await import('../../lib/auditLogger')

    await logAuditEntry({
      projectId: 'proj-1',
      entityType: 'RFI',
      entityId: 'rfi-1',
      action: 'create',
    })

    expect(mockFrom).toHaveBeenCalledWith('audit_log')
    expect(mockInsert).toHaveBeenCalledOnce()

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.project_id).toBe('proj-1')
    expect(insertArg.entity_type).toBe('RFI')
    expect(insertArg.entity_id).toBe('rfi-1')
    expect(insertArg.action).toBe('create')
  })

  it('should populate user fields from auth.getUser', async () => {
    setupSupabaseMock({ userId: 'user-xyz', email: 'pm@company.com', fullName: 'Jane PM' })
    const { logAuditEntry } = await import('../../lib/auditLogger')

    await logAuditEntry({
      projectId: 'proj-1',
      entityType: 'Task',
      entityId: 'task-1',
      action: 'update',
    })

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.user_id).toBe('user-xyz')
    expect(insertArg.user_email).toBe('pm@company.com')
    expect(insertArg.user_name).toBe('Jane PM')
  })

  it('should include beforeState and afterState when provided', async () => {
    const { logAuditEntry } = await import('../../lib/auditLogger')

    await logAuditEntry({
      projectId: 'proj-1',
      entityType: 'RFI',
      entityId: 'rfi-1',
      action: 'status_change',
      beforeState: { status: 'open' },
      afterState: { status: 'answered' },
    })

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.before_state).toEqual({ status: 'open' })
    expect(insertArg.after_state).toEqual({ status: 'answered' })
  })

  it('should compute changed_fields from before and after state', async () => {
    const { logAuditEntry } = await import('../../lib/auditLogger')

    await logAuditEntry({
      projectId: 'proj-1',
      entityType: 'Task',
      entityId: 'task-1',
      action: 'update',
      beforeState: { title: 'Old Title', status: 'todo', priority: 'low' },
      afterState: { title: 'New Title', status: 'in_progress', priority: 'low' },
    })

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.changed_fields).toContain('title')
    expect(insertArg.changed_fields).toContain('status')
    expect(insertArg.changed_fields).not.toContain('priority') // unchanged
  })

  it('should return empty changed_fields when before/after are not provided', async () => {
    const { logAuditEntry } = await import('../../lib/auditLogger')

    await logAuditEntry({
      projectId: 'proj-1',
      entityType: 'PunchItem',
      entityId: 'pi-1',
      action: 'create',
    })

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.changed_fields).toEqual([])
    expect(insertArg.before_state).toBeNull()
    expect(insertArg.after_state).toBeNull()
  })

  it('should include metadata with timestamp, url, and userAgent', async () => {
    const { logAuditEntry } = await import('../../lib/auditLogger')

    await logAuditEntry({
      projectId: 'proj-1',
      entityType: 'ChangeOrder',
      entityId: 'co-1',
      action: 'approve',
    })

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.metadata).toHaveProperty('timestamp')
    expect(insertArg.metadata).toHaveProperty('url')
    expect(insertArg.metadata).toHaveProperty('userAgent')
    // timestamp should be a valid ISO string
    expect(() => new Date(insertArg.metadata.timestamp)).not.toThrow()
  })

  it('should merge caller metadata with system metadata', async () => {
    const { logAuditEntry } = await import('../../lib/auditLogger')

    await logAuditEntry({
      projectId: 'proj-1',
      entityType: 'Submittal',
      entityId: 'sub-1',
      action: 'submit',
      metadata: { reason: 'Final revision', version: 3 },
    })

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.metadata.reason).toBe('Final revision')
    expect(insertArg.metadata.version).toBe(3)
    expect(insertArg.metadata.timestamp).toBeDefined()
  })

  it('should not throw when the DB insert fails (fire and forget)', async () => {
    setupSupabaseMock({ insertError: { message: 'DB error' } })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { logAuditEntry } = await import('../../lib/auditLogger')

    // Should not throw
    await expect(
      logAuditEntry({
        projectId: 'proj-1',
        entityType: 'RFI',
        entityId: 'rfi-1',
        action: 'close',
      })
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to write audit log:',
      expect.objectContaining({ message: 'DB error' })
    )

    consoleSpy.mockRestore()
  })

  it('should handle unauthenticated user gracefully', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })
    const { logAuditEntry } = await import('../../lib/auditLogger')

    await logAuditEntry({
      projectId: 'proj-1',
      entityType: 'DailyLog',
      entityId: 'dl-1',
      action: 'create',
    })

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.user_id).toBeNull()
    expect(insertArg.user_email).toBeNull()
  })
})
