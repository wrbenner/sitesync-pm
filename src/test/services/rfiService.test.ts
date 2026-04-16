import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — hoisted so vi.mock factory can reference them
// ---------------------------------------------------------------------------
const { mockGetSession, mockSingle, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSingle: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
  isSupabaseConfigured: true,
}))

// ---------------------------------------------------------------------------
// Chain builder
// ---------------------------------------------------------------------------

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.single = mockSingle
  Object.assign(chain, overrides)
  return chain
}

function sessionFor(userId: string) {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } })
}

// ---------------------------------------------------------------------------
// loadRfis
// ---------------------------------------------------------------------------

describe('rfiService.loadRfis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters soft-deleted records with deleted_at IS NULL', async () => {
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const { rfiService } = await import('../../services/rfiService')
    await rfiService.loadRfis('proj-1')

    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns RFIs for the given project', async () => {
    const mockRfis = [
      { id: 'rfi-1', title: 'Clarify beam depth', status: 'open', project_id: 'proj-1' },
    ]
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockRfis, error: null })
    mockFrom.mockReturnValue(chain)

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.loadRfis('proj-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual(mockRfis)
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
  })

  it('returns error when Supabase query fails', async () => {
    const chain = makeChain()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    })
    mockFrom.mockReturnValue(chain)

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.loadRfis('proj-1')

    expect(result.error).not.toBeNull()
    expect(result.data).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createRfi
// ---------------------------------------------------------------------------

describe('rfiService.createRfi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates RFI with draft status', async () => {
    sessionFor('user-1')
    const newRfi = { id: 'rfi-new', title: 'New RFI', status: 'draft' }
    mockSingle.mockResolvedValue({ data: newRfi, error: null })

    const insertChain = makeChain()
    ;(insertChain.insert as ReturnType<typeof vi.fn>).mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) })
    mockFrom.mockReturnValue(insertChain)

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.createRfi({
      project_id: 'proj-1',
      title: 'New RFI',
      priority: 'medium',
    })

    expect(result.error).toBeNull()
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', title: 'New RFI' })
    )
  })

  it('records created_by from the authenticated session', async () => {
    sessionFor('user-abc')
    const newRfi = { id: 'rfi-new', title: 'Test', status: 'draft', created_by: 'user-abc' }
    mockSingle.mockResolvedValue({ data: newRfi, error: null })

    const insertChain = makeChain()
    ;(insertChain.insert as ReturnType<typeof vi.fn>).mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) })
    mockFrom.mockReturnValue(insertChain)

    const { rfiService } = await import('../../services/rfiService')
    await rfiService.createRfi({ project_id: 'proj-1', title: 'Test', priority: 'low' })

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: 'user-abc' })
    )
  })
})

// ---------------------------------------------------------------------------
// addResponse — the critical column-name fix test
// ---------------------------------------------------------------------------

describe('rfiService.addResponse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts with "content" field, not "response_text"', async () => {
    sessionFor('user-1')

    // First from() call: insert into rfi_responses
    const responseChain = makeChain()
    ;(responseChain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })

    // Second from() call: fetch RFI for status transition
    const rfiChain = makeChain()
    ;(rfiChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'open', created_by: 'user-1', assigned_to: null, project_id: 'proj-1' },
      error: null,
    })

    // Third from() call: fetch project role
    const memberChain = makeChain()
    ;(memberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { role: 'admin' }, error: null })

    // Fourth from() call: update RFI status
    const updateChain = makeChain()
    ;(updateChain.update as ReturnType<typeof vi.fn>).mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return responseChain
      if (callCount === 2) return rfiChain
      if (callCount === 3) return memberChain
      return updateChain
    })

    const { rfiService } = await import('../../services/rfiService')
    await rfiService.addResponse('rfi-1', 'The architect confirmed 12" beam depth.')

    expect(responseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'The architect confirmed 12" beam depth.' })
    )
    expect(responseChain.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ response_text: expect.anything() })
    )
  })

  it('inserts with "author_id" field, not "user_id"', async () => {
    sessionFor('user-xyz')

    const responseChain = makeChain()
    ;(responseChain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })

    const rfiChain = makeChain()
    ;(rfiChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { status: 'open', created_by: 'user-xyz', assigned_to: null, project_id: 'proj-1' },
      error: null,
    })

    const memberChain = makeChain()
    ;(memberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { role: 'admin' }, error: null })

    const updateChain = makeChain()
    ;(updateChain.update as ReturnType<typeof vi.fn>).mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return responseChain
      if (callCount === 2) return rfiChain
      if (callCount === 3) return memberChain
      return updateChain
    })

    const { rfiService } = await import('../../services/rfiService')
    await rfiService.addResponse('rfi-1', 'Response text here.')

    expect(responseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ author_id: 'user-xyz' })
    )
    expect(responseChain.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ user_id: expect.anything() })
    )
  })

  it('returns error if Supabase insert fails', async () => {
    sessionFor('user-1')

    const responseChain = makeChain()
    ;(responseChain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { message: 'constraint violation' },
    })
    mockFrom.mockReturnValue(responseChain)

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.addResponse('rfi-1', 'Some text')

    expect(result.error).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// deleteRfi — soft delete only
// ---------------------------------------------------------------------------

describe('rfiService.deleteRfi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets deleted_at and deleted_by instead of hard deleting', async () => {
    sessionFor('user-1')

    const updateChain = makeChain()
    ;(updateChain.update as ReturnType<typeof vi.fn>).mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockFrom.mockReturnValue(updateChain)

    const { rfiService } = await import('../../services/rfiService')
    const result = await rfiService.deleteRfi('rfi-1')

    expect(result.error).toBeNull()
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        deleted_by: 'user-1',
      })
    )
  })
})
