import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockGetSession = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession() },
  },
}))

// ---------------------------------------------------------------------------
// rfiMachine mock — return status strings so transitionStatus comparisons work
// ---------------------------------------------------------------------------
const mockGetValidTransitions = vi.fn()
const mockGetBallInCourt = vi.fn()

vi.mock('../machines/rfiMachine', () => ({
  getValidTransitions: (...args: unknown[]) => mockGetValidTransitions(...args),
  getBallInCourt: (...args: unknown[]) => mockGetBallInCourt(...args),
}))

import { rfiService } from './rfiService'

// ---------------------------------------------------------------------------
// Chain builder
// ---------------------------------------------------------------------------
function makeChain(
  listData: unknown[] | null = null,
  error: { message: string } | null = null,
  singleData?: unknown,
) {
  const singleResult = { data: singleData !== undefined ? singleData : (Array.isArray(listData) && listData.length > 0 ? listData[0] : null), error }
  const listResult = { data: listData, error }

  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.upsert = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
    Promise.resolve(listResult).then(resolve, reject)
  return chain
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('rfiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
  })

  // ── loadRfis ──────────────────────────────────────────────────────────────
  describe('loadRfis', () => {
    it('returns RFIs for a project', async () => {
      const rfis = [{ id: 'rfi-1', title: 'Test RFI', project_id: 'proj-1' }]
      mockFrom.mockReturnValue(makeChain(rfis))

      const result = await rfiService.loadRfis('proj-1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(rfis)
      expect(mockFrom).toHaveBeenCalledWith('rfis')
    })

    it('returns empty array when no RFIs exist', async () => {
      mockFrom.mockReturnValue(makeChain(null))

      const result = await rfiService.loadRfis('proj-1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })

    it('returns DatabaseError on db failure', async () => {
      mockFrom.mockReturnValue(makeChain(null, { message: 'connection timeout' }))

      const result = await rfiService.loadRfis('proj-1')

      expect(result.data).toBeNull()
      expect(result.error?.category).toBe('DatabaseError')
      expect(result.error?.message).toContain('connection timeout')
    })
  })

  // ── createRfi ─────────────────────────────────────────────────────────────
  describe('createRfi', () => {
    it('creates an RFI with draft status', async () => {
      const newRfi = { id: 'rfi-new', title: 'My RFI', status: 'draft', project_id: 'proj-1' }
      mockFrom.mockReturnValue(makeChain(null, null, newRfi))

      const result = await rfiService.createRfi({
        project_id: 'proj-1',
        title: 'My RFI',
        priority: 'normal',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(newRfi)
    })

    it('includes optional fields when provided', async () => {
      const newRfi = { id: 'rfi-2', title: 'RFI with opts', status: 'draft' }
      mockFrom.mockReturnValue(makeChain(null, null, newRfi))

      const result = await rfiService.createRfi({
        project_id: 'proj-1',
        title: 'RFI with opts',
        priority: 'high',
        assigned_to: 'user-2',
        due_date: '2025-12-31',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(newRfi)
    })

    it('returns DatabaseError when insert fails', async () => {
      mockFrom.mockReturnValue(makeChain(null, { message: 'unique constraint' }))

      const result = await rfiService.createRfi({
        project_id: 'proj-1',
        title: 'My RFI',
        priority: 'normal',
      })

      expect(result.error?.category).toBe('DatabaseError')
    })
  })

  // ── transitionStatus ──────────────────────────────────────────────────────
  describe('transitionStatus', () => {
    it('transitions RFI status when transition is valid', async () => {
      const rfiData = { status: 'draft', created_by: 'user-1', assigned_to: 'user-2', project_id: 'proj-1' }
      const memberData = { role: 'admin' }

      mockGetValidTransitions.mockReturnValue(['open', 'void'])
      mockGetBallInCourt.mockReturnValue('user-2')

      mockFrom
        .mockReturnValueOnce(makeChain(null, null, rfiData))    // fetch RFI
        .mockReturnValueOnce(makeChain(null, null, memberData)) // fetch role
        .mockReturnValueOnce(makeChain(null, null, null))       // update

      const result = await rfiService.transitionStatus('rfi-1', 'open')

      expect(result.error).toBeNull()
    })

    it('sets closed_date when transitioning to closed', async () => {
      const rfiData = { status: 'answered', created_by: 'user-1', assigned_to: 'user-2', project_id: 'proj-1' }
      const memberData = { role: 'admin' }

      mockGetValidTransitions.mockReturnValue(['closed', 'void'])
      mockGetBallInCourt.mockReturnValue(null)

      const updateChain = makeChain(null, null, null)
      mockFrom
        .mockReturnValueOnce(makeChain(null, null, rfiData))
        .mockReturnValueOnce(makeChain(null, null, memberData))
        .mockReturnValueOnce(updateChain)

      await rfiService.transitionStatus('rfi-1', 'closed')

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ closed_date: expect.any(String) }),
      )
    })

    it('returns NotFoundError when RFI does not exist', async () => {
      mockFrom.mockReturnValueOnce(makeChain(null, { message: 'row not found' }, null))

      const result = await rfiService.transitionStatus('rfi-missing', 'open')

      expect(result.error?.category).toBe('NotFoundError')
    })

    it('returns PermissionError when user is not a project member', async () => {
      const rfiData = { status: 'draft', created_by: 'user-1', assigned_to: null, project_id: 'proj-1' }

      mockFrom
        .mockReturnValueOnce(makeChain(null, null, rfiData))  // fetch RFI
        .mockReturnValueOnce(makeChain(null, null, null))     // no role found

      const result = await rfiService.transitionStatus('rfi-1', 'open')

      expect(result.error?.category).toBe('PermissionError')
    })

    it('returns ValidationError for disallowed transition', async () => {
      const rfiData = { status: 'closed', created_by: 'user-1', assigned_to: null, project_id: 'proj-1' }
      const memberData = { role: 'member' }

      mockGetValidTransitions.mockReturnValue([]) // no valid transitions

      mockFrom
        .mockReturnValueOnce(makeChain(null, null, rfiData))
        .mockReturnValueOnce(makeChain(null, null, memberData))

      const result = await rfiService.transitionStatus('rfi-1', 'open')

      expect(result.error?.category).toBe('ValidationError')
    })

    it('returns DatabaseError when update query fails', async () => {
      const rfiData = { status: 'draft', created_by: 'user-1', assigned_to: null, project_id: 'proj-1' }
      const memberData = { role: 'admin' }

      mockGetValidTransitions.mockReturnValue(['open'])
      mockGetBallInCourt.mockReturnValue('user-1')

      mockFrom
        .mockReturnValueOnce(makeChain(null, null, rfiData))
        .mockReturnValueOnce(makeChain(null, null, memberData))
        .mockReturnValueOnce(makeChain(null, { message: 'update failed' }))

      const result = await rfiService.transitionStatus('rfi-1', 'open')

      expect(result.error?.category).toBe('DatabaseError')
    })
  })

  // ── updateRfi ─────────────────────────────────────────────────────────────
  describe('updateRfi', () => {
    it('updates RFI fields', async () => {
      mockFrom.mockReturnValue(makeChain(null))

      const result = await rfiService.updateRfi('rfi-1', { title: 'Updated title' })

      expect(result.error).toBeNull()
    })

    it('strips status from updates to prevent direct mutation', async () => {
      const chain = makeChain(null)
      mockFrom.mockReturnValue(chain)

      await rfiService.updateRfi('rfi-1', { title: 'New', status: 'closed' as never })

      // The update call should NOT include 'status'
      const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(updateArg).not.toHaveProperty('status')
    })

    it('returns DatabaseError on failure', async () => {
      mockFrom.mockReturnValue(makeChain(null, { message: 'update error' }))

      const result = await rfiService.updateRfi('rfi-1', { title: 'x' })

      expect(result.error?.category).toBe('DatabaseError')
    })
  })

  // ── deleteRfi ─────────────────────────────────────────────────────────────
  describe('deleteRfi', () => {
    it('soft-deletes RFI by setting deleted_at', async () => {
      const chain = makeChain(null)
      mockFrom.mockReturnValue(chain)

      const result = await rfiService.deleteRfi('rfi-1')

      expect(result.error).toBeNull()
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String), deleted_by: 'user-1' }),
      )
    })

    it('returns DatabaseError on failure', async () => {
      mockFrom.mockReturnValue(makeChain(null, { message: 'delete failed' }))

      const result = await rfiService.deleteRfi('rfi-1')

      expect(result.error?.category).toBe('DatabaseError')
    })
  })

  // ── loadResponses ─────────────────────────────────────────────────────────
  describe('loadResponses', () => {
    it('returns responses for an RFI', async () => {
      const responses = [
        { id: 'resp-1', rfi_id: 'rfi-1', response_text: 'See drawing A-101' },
      ]
      mockFrom.mockReturnValue(makeChain(responses))

      const result = await rfiService.loadResponses('rfi-1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(responses)
    })

    it('returns empty array when no responses exist', async () => {
      mockFrom.mockReturnValue(makeChain(null))

      const result = await rfiService.loadResponses('rfi-1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })

    it('returns DatabaseError on failure', async () => {
      mockFrom.mockReturnValue(makeChain(null, { message: 'query failed' }))

      const result = await rfiService.loadResponses('rfi-1')

      expect(result.error?.category).toBe('DatabaseError')
    })
  })

  // ── addResponse ───────────────────────────────────────────────────────────
  describe('addResponse', () => {
    it('inserts response and transitions RFI to answered', async () => {
      const rfiData = { status: 'open', created_by: 'user-1', assigned_to: null, project_id: 'proj-1' }
      const memberData = { role: 'admin' }

      mockGetValidTransitions.mockReturnValue(['answered'])
      mockGetBallInCourt.mockReturnValue('user-1')

      mockFrom
        .mockReturnValueOnce(makeChain(null))                    // insert response
        .mockReturnValueOnce(makeChain(null, null, rfiData))     // fetch RFI (transitionStatus)
        .mockReturnValueOnce(makeChain(null, null, memberData))  // fetch role
        .mockReturnValueOnce(makeChain(null))                    // update status

      const result = await rfiService.addResponse('rfi-1', 'Response text')

      expect(result.error).toBeNull()
    })

    it('returns DatabaseError when response insert fails', async () => {
      mockFrom.mockReturnValueOnce(makeChain(null, { message: 'insert failed' }))

      const result = await rfiService.addResponse('rfi-1', 'Response text')

      expect(result.error?.category).toBe('DatabaseError')
    })

    it('returns wrapped error when status transition fails after insert', async () => {
      const rfiData = { status: 'open', created_by: 'user-1', assigned_to: null, project_id: 'proj-1' }
      const memberData = { role: 'admin' }

      mockGetValidTransitions.mockReturnValue(['answered'])
      mockGetBallInCourt.mockReturnValue('user-1')

      mockFrom
        .mockReturnValueOnce(makeChain(null))                    // insert succeeds
        .mockReturnValueOnce(makeChain(null, null, rfiData))
        .mockReturnValueOnce(makeChain(null, null, memberData))
        .mockReturnValueOnce(makeChain(null, { message: 'update failed' })) // update fails

      const result = await rfiService.addResponse('rfi-1', 'Response text')

      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Response saved but status transition failed')
    })
  })
})
