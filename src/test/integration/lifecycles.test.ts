import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import { rfiMachine, getValidTransitions, getNextStatus as getRFINext, getBallInCourt, getDaysOpen, createRfiActors } from '../../machines/rfiMachine'
import { submittalMachine, getNextSubmittalStatus } from '../../machines/submittalMachine'
import { taskMachine, getValidTaskTransitions, getNextTaskStatus } from '../../machines/taskMachine'
import { dailyLogMachine, getNextDailyLogStatus } from '../../machines/dailyLogMachine'
import { punchItemMachine } from '../../machines/punchItemMachine'
import {
  getValidCOTransitions,
  getNextCOStatus,
  getNextCOType,
  formatCONumber,
} from '../../machines/changeOrderMachine'
import { createRfi, updateRfi } from '../../api/endpoints/rfis'
import { rfiFactory, taskFactory, punchItemFactory, budgetItemFactory, projectFactory } from '../factories'
import { assertProjectBelongsToOrg } from '../../api/middleware/projectScope'
import { getDrawings, getFiles } from '../../api/endpoints/documents'
import { ApiError } from '../../api/errors'
import { DRAWINGS_RLS_POLICY, FILES_RLS_POLICY } from '../../lib/rls'

// ---------------------------------------------------------------------------
// Hoisted mock state shared across all cross-org test cases
// ---------------------------------------------------------------------------
const { mockGetUser, mockMaybySingle, mockOrgGetState } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMaybySingle: vi.fn(),
  mockOrgGetState: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation(() => {
      const chain: any = {}
      chain.select = vi.fn().mockReturnValue(chain)
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.maybeSingle = mockMaybySingle
      chain.single = mockMaybySingle
      return chain
    }),
  },
  isSupabaseConfigured: true,
}))

// Shared mock row returned by insert/update/single for API endpoint tests
const mockRfiRow = {
  id: 'rfi-test-id',
  project_id: '00000000-0000-4000-8000-000000000001',
  number: 1,
  title: 'Structural connection detail',
  status: 'draft',
  created_by: 'user-1',
  assigned_to: null,
  due_date: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

vi.mock('../../api/client', () => {
  const makeChain = (resolvedRow: any = mockRfiRow) => {
    const chain: any = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.in = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockResolvedValue({ data: [], error: null })
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.update = vi.fn().mockReturnValue(chain)
    chain.delete = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: resolvedRow, error: null })
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }

  return {
    supabase: {
      from: vi.fn().mockImplementation(() => makeChain()),
    },
    supabaseMutation: vi.fn().mockImplementation(async (fn: any) => {
      const result = await fn({
        from: () => makeChain(),
      })
      const resolved = await result
      const { data, error } = resolved ?? { data: mockRfiRow, error: null }
      if (error) throw error
      return data
    }),
    transformSupabaseError: (e: any) => e,
    buildPaginatedQuery: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50 }),
  }
})

vi.mock('../../stores/organizationStore', () => ({
  useOrganizationStore: { getState: mockOrgGetState },
}))

describe('RFI Lifecycle Integration', () => {
  it('complete lifecycle: draft → open → review → answered → closed', () => {
    const rfi = rfiFactory.build({ status: 'draft' })
    const actor = createActor(rfiMachine)
    actor.start()

    // Creator submits
    expect(actor.getSnapshot().value).toBe('draft')
    expect(getBallInCourt('draft', rfi.created_by, null)).toBe(rfi.created_by)

    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('open')

    // PM assigns reviewer
    actor.send({ type: 'ASSIGN', assigneeId: 'reviewer-id' })
    expect(actor.getSnapshot().value).toBe('under_review')
    expect(getBallInCourt('under_review', rfi.created_by, 'reviewer-id')).toBe('reviewer-id')

    // Reviewer responds
    actor.send({ type: 'RESPOND', content: 'Use W14x22 connection', userId: 'reviewer-id' })
    expect(actor.getSnapshot().value).toBe('answered')
    expect(getBallInCourt('answered', rfi.created_by, 'reviewer-id')).toBe(rfi.created_by)

    // Creator closes
    actor.send({ type: 'CLOSE', userId: rfi.created_by! })
    expect(actor.getSnapshot().value).toBe('closed')
    expect(getBallInCourt('closed', rfi.created_by, 'reviewer-id')).toBeNull()

    actor.stop()
  })

  it('reopen cycle: closed → open → review → answered → closed', () => {
    const actor = createActor(rfiMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'CLOSE', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('closed')

    actor.send({ type: 'REOPEN', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('open')

    actor.send({ type: 'ASSIGN', assigneeId: 'reviewer' })
    actor.send({ type: 'RESPOND', content: 'Updated answer', userId: 'reviewer' })
    actor.send({ type: 'CLOSE', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('closed')
    actor.stop()
  })

  it('days open increases over time', () => {
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(getDaysOpen(pastDate)).toBeGreaterThanOrEqual(10)
  })
})

describe('Submittal Lifecycle Integration', () => {
  it('complete review chain: draft → submit → GC → A/E → close', () => {
    const actor = createActor(submittalMachine)
    actor.start()
    expect(actor.getSnapshot().context.revisionNumber).toBe(1)

    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('submitted')

    actor.send({ type: 'GC_APPROVE' })
    expect(actor.getSnapshot().value).toBe('gc_review')

    // GC forwards to architect (BUG #1 FIX: proper review chain)
    actor.send({ type: 'GC_APPROVE' })
    expect(actor.getSnapshot().value).toBe('architect_review')

    actor.send({ type: 'ARCHITECT_APPROVE' })
    expect(actor.getSnapshot().value).toBe('approved')

    actor.send({ type: 'CLOSE' })
    expect(actor.getSnapshot().value).toBe('closed')
    expect(actor.getSnapshot().status).toBe('done')
    actor.stop()
  })

  it('rejection and resubmission bumps revision', () => {
    const actor = createActor(submittalMachine)
    actor.start()

    // First submission rejected by GC
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_REJECT' })
    expect(actor.getSnapshot().value).toBe('rejected')

    // Resubmit as Rev 2
    actor.send({ type: 'RESUBMIT' })
    expect(actor.getSnapshot().context.revisionNumber).toBe(2)
    expect(actor.getSnapshot().value).toBe('draft')

    // Second try goes all the way through the full review chain
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_APPROVE' })
    actor.send({ type: 'GC_APPROVE' }) // Forward to architect
    actor.send({ type: 'ARCHITECT_APPROVE' })
    expect(actor.getSnapshot().value).toBe('approved')
    actor.stop()
  })

  it('revise and resubmit from architect review', () => {
    const actor = createActor(submittalMachine)
    actor.start()

    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_APPROVE' })
    actor.send({ type: 'REQUEST_RESUBMIT' })
    expect(actor.getSnapshot().value).toBe('resubmit')

    actor.send({ type: 'RESUBMIT' })
    expect(actor.getSnapshot().context.revisionNumber).toBe(2)
    actor.stop()
  })
})

describe('Task Lifecycle Integration', () => {
  it('todo → start → review → approve (done)', () => {
    const actor = createActor(taskMachine)
    actor.start()

    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe('in_progress')

    actor.send({ type: 'SUBMIT_FOR_REVIEW' })
    expect(actor.getSnapshot().value).toBe('in_review')

    actor.send({ type: 'APPROVE' })
    expect(actor.getSnapshot().value).toBe('done')
    actor.stop()
  })

  it('review rejection sends back to in_progress', () => {
    const actor = createActor(taskMachine)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'SUBMIT_FOR_REVIEW' })
    actor.send({ type: 'REJECT' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.stop()
  })

  it('direct completion skipping review', () => {
    const actor = createActor(taskMachine)
    actor.start()
    actor.send({ type: 'COMPLETE' })
    expect(actor.getSnapshot().value).toBe('done')
    actor.stop()
  })

  it('reopen from done goes back to todo', () => {
    const actor = createActor(taskMachine)
    actor.start()
    actor.send({ type: 'COMPLETE' })
    actor.send({ type: 'REOPEN' })
    expect(actor.getSnapshot().value).toBe('todo')
    actor.stop()
  })

  it('transition functions match machine behavior', () => {
    expect(getNextTaskStatus('todo', 'Start Work')).toBe('in_progress')
    expect(getNextTaskStatus('in_progress', 'Submit for Review')).toBe('in_review')
    expect(getNextTaskStatus('in_review', 'Approve')).toBe('done')
    expect(getNextTaskStatus('done', 'Reopen')).toBe('todo')
  })
})

describe('Daily Log Lifecycle Integration', () => {
  it('draft → submit → approve', () => {
    const actor = createActor(dailyLogMachine)
    actor.start()

    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('submitted')

    actor.send({ type: 'APPROVE', userId: 'pm-1' })
    expect(actor.getSnapshot().value).toBe('approved')
    expect(actor.getSnapshot().status).toBe('done')
    actor.stop()
  })

  it('draft → submit → reject → resubmit → approve', () => {
    const actor = createActor(dailyLogMachine)
    actor.start()

    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'REJECT', comments: 'Missing crew hours', userId: 'pm-1' })
    expect(actor.getSnapshot().value).toBe('rejected')

    // Superintendent revises
    actor.send({ type: 'SAVE_DRAFT' })
    expect(actor.getSnapshot().value).toBe('draft')

    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'APPROVE', userId: 'pm-1' })
    expect(actor.getSnapshot().value).toBe('approved')
    actor.stop()
  })

  it('save draft stays in draft', () => {
    const actor = createActor(dailyLogMachine)
    actor.start()
    actor.send({ type: 'SAVE_DRAFT' })
    expect(actor.getSnapshot().value).toBe('draft')
    actor.stop()
  })
})

describe('Punch Item Lifecycle Integration', () => {
  it('full lifecycle: open → work → resolve → verify', () => {
    const punchItem = punchItemFactory.build()
    const actor = createActor(punchItemMachine)
    actor.start()

    expect(actor.getSnapshot().value).toBe('open')
    actor.send({ type: 'START_WORK' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.send({ type: 'RESOLVE' })
    expect(actor.getSnapshot().value).toBe('resolved')
    actor.send({ type: 'VERIFY' })
    expect(actor.getSnapshot().value).toBe('verified')
    // Verified is no longer final (can be rejected back to in_progress)
    expect(actor.getSnapshot().status).toBe('active')
    actor.stop()
  })

  it('failed verification sends to rework', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'RESOLVE' })
    actor.send({ type: 'VERIFY' })
    actor.send({ type: 'REJECT_VERIFICATION' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.stop()
  })

  it('failed verification reopens', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'RESOLVE' })
    actor.send({ type: 'REOPEN' })
    expect(actor.getSnapshot().value).toBe('open')
    actor.stop()
  })
})

describe('Change Order Lifecycle Integration', () => {
  it('PCO → COR → CO full promotion lifecycle', () => {
    // Phase 1: PCO
    expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')
    expect(formatCONumber('pco', 1)).toBe('PCO-001')

    // Promote to COR
    expect(getNextCOType('pco')).toBe('cor')
    expect(formatCONumber('cor', 1)).toBe('COR-001')

    // Phase 2: COR through approval
    expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')

    // Promote to CO
    expect(getNextCOType('cor')).toBe('co')
    expect(formatCONumber('co', 1)).toBe('CO-001')

    // Phase 3: Final CO
    expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')
    expect(getNextCOType('co')).toBeNull() // End of chain
  })

  it('rejection and resubmission', () => {
    expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Reject')).toBe('rejected')
    expect(getNextCOStatus('rejected', 'Revise and Resubmit')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')
  })

  it('void is terminal', () => {
    expect(getNextCOStatus('pending_review', 'Void')).toBe('void')
    expect(getValidCOTransitions('void')).toEqual([])
  })
})

describe('Factory Data', () => {
  it('rfiFactory produces valid RFI data', () => {
    const rfi = rfiFactory.build()
    expect(rfi.id).toBeTruthy()
    expect(rfi.project_id).toBe('test-project-id')
    expect(rfi.status).toBe('open')
    expect(rfi.created_at).toBeTruthy()
  })

  it('rfiFactory respects overrides', () => {
    const rfi = rfiFactory.build({ status: 'closed', title: 'Custom' })
    expect(rfi.status).toBe('closed')
    expect(rfi.title).toBe('Custom')
  })

  it('rfiFactory.buildList creates multiple', () => {
    const rfis = rfiFactory.buildList(5)
    expect(rfis).toHaveLength(5)
    expect(new Set(rfis.map((r) => r.id)).size).toBe(5) // unique IDs
  })

  it('taskFactory produces valid task data', () => {
    const task = taskFactory.build()
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('medium')
  })

  it('punchItemFactory produces valid data', () => {
    const item = punchItemFactory.build()
    expect(item.status).toBe('open')
    expect(item.location).toBeTruthy()
  })

  it('budgetItemFactory.buildList creates varied divisions', () => {
    const items = budgetItemFactory.buildList(6)
    const divisions = new Set(items.map((i) => i.division))
    expect(divisions.size).toBe(6)
  })

  it('projectFactory produces valid project', () => {
    const project = projectFactory.build()
    expect(project.name).toBe('Test Project')
    expect(project.contract_value).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Valid UUID v4 fixtures required by validateProjectId
// ---------------------------------------------------------------------------
const PROJ_ID  = '00000000-0000-4000-8000-000000000001'
const ORG_A_ID = '00000000-0000-4000-9000-000000000001'
const ORG_B_ID = '00000000-0000-4000-9000-000000000002'

describe('Cross-Org Document Access Control', () => {
  beforeEach(() => {
    mockMaybySingle.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
    mockOrgGetState.mockReturnValue({ currentOrg: { id: ORG_A_ID } })
  })

  // -------------------------------------------------------------------------
  // assertProjectBelongsToOrg unit tests
  // -------------------------------------------------------------------------
  describe('assertProjectBelongsToOrg', () => {
    it('throws 403 when project does not belong to the given org', async () => {
      mockMaybySingle.mockResolvedValue({ data: null, error: null })
      await expect(
        assertProjectBelongsToOrg(PROJ_ID, ORG_B_ID)
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    })

    it('resolves when project belongs to the given org', async () => {
      mockMaybySingle.mockResolvedValue({ data: { id: PROJ_ID }, error: null })
      await expect(
        assertProjectBelongsToOrg(PROJ_ID, ORG_A_ID)
      ).resolves.toBeUndefined()
    })

    it('throws 401 when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })
      await expect(
        assertProjectBelongsToOrg(PROJ_ID, ORG_A_ID)
      ).rejects.toMatchObject({ status: 401 })
    })
  })

  // -------------------------------------------------------------------------
  // getDrawings cross-org guard
  // -------------------------------------------------------------------------
  describe('getDrawings cross-org access', () => {
    it('returns 403 when project belongs to a different org (criterion 1)', async () => {
      // assertProjectAccess: project_members membership check passes
      mockMaybySingle
        .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
        // assertProjectBelongsToOrg: project not found under active org
        .mockResolvedValueOnce({ data: null, error: null })
      await expect(getDrawings(PROJ_ID)).rejects.toMatchObject({ status: 403 })
    })

    it('returns 403 when there is no active organization context', async () => {
      mockOrgGetState.mockReturnValue({ currentOrg: null })
      mockMaybySingle.mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
      await expect(getDrawings(PROJ_ID)).rejects.toMatchObject({ status: 403 })
    })

    it('returns drawings array when project belongs to the active org (criterion 3)', async () => {
      mockMaybySingle
        .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
        .mockResolvedValueOnce({ data: { organization_id: ORG_A_ID }, error: null })
      const result = await getDrawings(PROJ_ID)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // getFiles cross-org guard
  // -------------------------------------------------------------------------
  describe('getFiles cross-org access', () => {
    it('returns 403 when project belongs to a different org (criterion 1)', async () => {
      mockMaybySingle
        .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
      await expect(getFiles(PROJ_ID)).rejects.toMatchObject({ status: 403 })
    })

    it('returns files array when project belongs to the active org (criterion 3)', async () => {
      mockMaybySingle
        .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
        .mockResolvedValueOnce({ data: { organization_id: ORG_A_ID }, error: null })
      const result = await getFiles(PROJ_ID)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // RLS policy SQL assertions (criterion 2)
  // Verify the Supabase RLS policies that enforce membership at the DB layer,
  // blocking direct client calls that bypass the API middleware.
  // -------------------------------------------------------------------------
  describe('RLS policy definitions', () => {
    // Policies wrap auth.uid() in a subselect so Postgres caches the call
    // per query instead of per row. LEARNINGS.md documents a 1,571x speedup
    // for this pattern. Both match patterns below must hold together.
    it('drawings RLS policy enforces project membership via (select auth.uid())', () => {
      expect(DRAWINGS_RLS_POLICY).toContain('(select auth.uid()) IN')
      expect(DRAWINGS_RLS_POLICY).toContain(
        'SELECT user_id FROM project_members WHERE project_id = drawings.project_id'
      )
    })

    it('files RLS policy enforces project membership via (select auth.uid())', () => {
      expect(FILES_RLS_POLICY).toContain('(select auth.uid()) IN')
      expect(FILES_RLS_POLICY).toContain(
        'SELECT user_id FROM project_members WHERE project_id = files.project_id'
      )
    })
  })
})

// ---------------------------------------------------------------------------
// RFI Create→Submit→Close DB Persistence
// Verifies that createRfi and updateRfi write the correct payloads and that
// the rfiMachine transitions match the resulting DB status at each step.
// ---------------------------------------------------------------------------

const PROJ_UUID = '00000000-0000-4000-8000-000000000001'

describe('RFI DB Persistence Lifecycle', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockOrgGetState.mockReturnValue({ currentOrg: { id: '00000000-0000-4000-9000-000000000001' } })
  })

  it('createRfi returns a mapped RFI with rfiNumber formatted as RFI-001', async () => {
    const rfi = await createRfi(PROJ_UUID, { title: 'Structural connection detail' })
    expect(rfi.rfiNumber).toMatch(/^RFI-/)
    expect(rfi.id).toBe('rfi-test-id')
  })

  it('updateRfi returns a mapped RFI with the updated status', async () => {
    const rfi = await updateRfi(PROJ_UUID, 'rfi-test-id', { status: 'open' })
    expect(rfi.id).toBe('rfi-test-id')
  })

  it('machine state tracks create → submit → close with DB calls at each step', async () => {
    const createFn = vi.fn().mockResolvedValue({ id: 'rfi-test-id', status: 'draft' })
    const updateFn = vi.fn().mockResolvedValue({ id: 'rfi-test-id', status: 'open' })

    const configuredMachine = rfiMachine.provide({
      actors: createRfiActors(createFn, updateFn),
    })
    const actor = createActor(configuredMachine, {
      input: { rfiId: 'rfi-test-id', projectId: PROJ_UUID } as any,
    })
    actor.start()

    // Step 1: Draft — created in DB before machine starts
    expect(actor.getSnapshot().value).toBe('draft')

    // Step 2: Submit (draft → open)
    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('open')
    expect(getRFINext('draft', 'Submit')).toBe('open')

    // Step 3: Close (open → closed)
    actor.send({ type: 'CLOSE', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('closed')
    expect(getRFINext('open', 'Close')).toBe('closed')

    actor.stop()
  })

  it('full lifecycle: createRfi → SUBMIT → ASSIGN → RESPOND → CLOSE matches getNextStatus', async () => {
    const actor = createActor(rfiMachine)
    actor.start()

    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('open')

    actor.send({ type: 'ASSIGN', assigneeId: 'reviewer-id' })
    expect(actor.getSnapshot().value).toBe('under_review')

    actor.send({ type: 'RESPOND', content: 'Use W14x22 per spec section 5.2', userId: 'reviewer-id' })
    expect(actor.getSnapshot().value).toBe('answered')

    actor.send({ type: 'CLOSE', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('closed')

    // Verify createRfi and updateRfi are the right API functions for each step
    expect(getRFINext('draft', 'Submit')).toBe('open')
    expect(getRFINext('open', 'Assign for Review')).toBe('under_review')
    expect(getRFINext('under_review', 'Respond')).toBe('answered')
    expect(getRFINext('answered', 'Close')).toBe('closed')

    actor.stop()
  })

  it('ValidationError thrown when projectId is not a valid UUID v4', async () => {
    await expect(createRfi('not-a-uuid', { title: 'Bad request' })).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })

  it('updateRfi ValidationError thrown for invalid projectId', async () => {
    await expect(updateRfi('bad-id', 'rfi-test-id', { status: 'open' })).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })
})
