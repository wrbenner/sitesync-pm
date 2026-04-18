import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock service
// ---------------------------------------------------------------------------
vi.mock('../services/submittalService', () => ({
  submittalService: {
    loadSubmittals: vi.fn(),
    createSubmittal: vi.fn(),
    updateSubmittal: vi.fn(),
    transitionStatus: vi.fn(),
    deleteSubmittal: vi.fn(),
    loadApprovals: vi.fn(),
    addApproval: vi.fn(),
    createRevision: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mock entityStore to isolate store tests from Supabase/entityStore internals
// vi.hoisted ensures these are available when vi.mock factories run (which are
// hoisted above const declarations by the Vitest transform).
// ---------------------------------------------------------------------------
const { mockInitSlice, mockSetSlice, mockEntitySetState } = vi.hoisted(() => ({
  mockInitSlice: vi.fn(),
  mockSetSlice: vi.fn(),
  mockEntitySetState: vi.fn(),
}))

vi.mock('./entityStore', () => ({
  useEntityStoreRoot: {
    getState: vi.fn(() => ({
      initSlice: mockInitSlice,
      _setSlice: mockSetSlice,
    })),
    setState: mockEntitySetState,
  },
  useEntityStore: vi.fn(() => ({
    items: [],
    loading: false,
    error: null,
    selectedId: null,
    filters: { search: '', status: undefined, extra: {} },
  })),
  useEntityActions: vi.fn(() => ({})),
}))

import { useSubmittalStore } from './submittalStore'
import { submittalService } from '../services/submittalService'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const SUBMITTAL = {
  id: 'sub-1',
  project_id: 'proj-1',
  title: 'Concrete Mix Design',
  status: 'draft',
  spec_section: '03 00 00',
  assigned_to: 'user-2',
  subcontractor: 'Acme Concrete',
  due_date: '2026-05-01',
  submit_by_date: '2026-04-15',
  required_onsite_date: '2026-06-01',
  lead_time_weeks: 4,
  revision_number: 1,
  parent_submittal_id: null,
  created_by: 'user-1',
  deleted_at: null,
  number: 1,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetStore() {
  useSubmittalStore.setState({
    submittals: [],
    approvals: {},
    loading: false,
    error: null,
    errorDetails: null,
  })
}

describe('useSubmittalStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  // ── loadSubmittals ────────────────────────────────────────────────────────

  describe('loadSubmittals', () => {
    it('populates submittals and mirrors into entityStore on success', async () => {
      ;(submittalService.loadSubmittals as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [SUBMITTAL],
        error: null,
      })

      await useSubmittalStore.getState().loadSubmittals('proj-1')

      const { submittals, loading, error } = useSubmittalStore.getState()
      expect(submittals).toHaveLength(1)
      expect(submittals[0].id).toBe('sub-1')
      expect(loading).toBe(false)
      expect(error).toBeNull()

      expect(mockInitSlice).toHaveBeenCalledWith('submittals')
      expect(mockSetSlice).toHaveBeenCalledWith(
        'submittals',
        expect.objectContaining({ items: [SUBMITTAL], loading: false, error: null }),
      )
    })

    it('sets error state and mirrors error into entityStore when service fails', async () => {
      ;(submittalService.loadSubmittals as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Failed to load submittals', message: 'DB error' },
      })

      await useSubmittalStore.getState().loadSubmittals('proj-1')

      const { error, loading } = useSubmittalStore.getState()
      expect(error).toBe('Failed to load submittals')
      expect(loading).toBe(false)

      expect(mockSetSlice).toHaveBeenCalledWith(
        'submittals',
        expect.objectContaining({ error: 'Failed to load submittals' }),
      )
    })

    it('returns empty list when no submittals exist', async () => {
      ;(submittalService.loadSubmittals as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
        error: null,
      })

      await useSubmittalStore.getState().loadSubmittals('proj-1')

      expect(useSubmittalStore.getState().submittals).toHaveLength(0)
      expect(useSubmittalStore.getState().error).toBeNull()
    })
  })

  // ── createSubmittal ───────────────────────────────────────────────────────

  describe('createSubmittal', () => {
    it('prepends new submittal to local state and entityStore', async () => {
      ;(submittalService.createSubmittal as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: SUBMITTAL,
        error: null,
      })

      const result = await useSubmittalStore.getState().createSubmittal({
        project_id: 'proj-1',
        title: 'Concrete Mix Design',
        spec_section: '03 00 00',
      })

      expect(result.error).toBeNull()
      expect(result.submittal?.id).toBe('sub-1')
      expect(useSubmittalStore.getState().submittals).toHaveLength(1)
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns error and leaves state unchanged when service fails', async () => {
      ;(submittalService.createSubmittal as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Insert failed', message: 'constraint violation' },
      })

      const result = await useSubmittalStore.getState().createSubmittal({
        project_id: 'proj-1',
        title: 'Bad Submittal',
      })

      expect(result.error).toBe('Insert failed')
      expect(result.submittal).toBeNull()
      expect(useSubmittalStore.getState().submittals).toHaveLength(0)
    })
  })

  // ── updateSubmittal ───────────────────────────────────────────────────────

  describe('updateSubmittal', () => {
    it('merges updates into local state and entityStore', async () => {
      useSubmittalStore.setState({ submittals: [SUBMITTAL as never] })
      ;(submittalService.updateSubmittal as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await useSubmittalStore.getState().updateSubmittal('sub-1', {
        title: 'Updated Mix Design',
        spec_section: '04 00 00',
      })

      expect(result.error).toBeNull()
      const updated = useSubmittalStore.getState().submittals.find((s) => s.id === 'sub-1')
      expect(updated?.title).toBe('Updated Mix Design')
      expect(updated?.spec_section).toBe('04 00 00')
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns service error without mutating state', async () => {
      useSubmittalStore.setState({ submittals: [SUBMITTAL as never] })
      ;(submittalService.updateSubmittal as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Update forbidden', message: 'RLS' },
      })

      const result = await useSubmittalStore.getState().updateSubmittal('sub-1', {
        title: 'Should not apply',
      })

      expect(result.error).toBe('Update forbidden')
      const unchanged = useSubmittalStore.getState().submittals.find((s) => s.id === 'sub-1')
      expect(unchanged?.title).toBe('Concrete Mix Design')
    })
  })

  // ── transitionStatus ──────────────────────────────────────────────────────

  describe('transitionStatus', () => {
    it('updates status in local state and entityStore on success', async () => {
      useSubmittalStore.setState({ submittals: [SUBMITTAL as never] })
      ;(submittalService.transitionStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await useSubmittalStore.getState().transitionStatus('sub-1', 'submitted')

      expect(result.error).toBeNull()
      const updated = useSubmittalStore.getState().submittals.find((s) => s.id === 'sub-1')
      expect(updated?.status).toBe('submitted')
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns error and leaves status unchanged when service rejects transition', async () => {
      useSubmittalStore.setState({ submittals: [SUBMITTAL as never] })
      ;(submittalService.transitionStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Invalid transition: draft → approved', message: 'state machine' },
      })

      const result = await useSubmittalStore.getState().transitionStatus('sub-1', 'approved')

      expect(result.error).toBe('Invalid transition: draft → approved')
      const sub = useSubmittalStore.getState().submittals.find((s) => s.id === 'sub-1')
      expect(sub?.status).toBe('draft')
    })
  })

  // ── deleteSubmittal ───────────────────────────────────────────────────────

  describe('deleteSubmittal', () => {
    it('removes submittal from local state and entityStore', async () => {
      useSubmittalStore.setState({ submittals: [SUBMITTAL as never] })
      ;(submittalService.deleteSubmittal as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await useSubmittalStore.getState().deleteSubmittal('sub-1')

      expect(result.error).toBeNull()
      expect(useSubmittalStore.getState().submittals).toHaveLength(0)
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns error and keeps submittal in state when service fails', async () => {
      useSubmittalStore.setState({ submittals: [SUBMITTAL as never] })
      ;(submittalService.deleteSubmittal as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Delete forbidden', message: 'RLS' },
      })

      const result = await useSubmittalStore.getState().deleteSubmittal('sub-1')

      expect(result.error).toBe('Delete forbidden')
      expect(useSubmittalStore.getState().submittals).toHaveLength(1)
    })
  })

  // ── loadApprovals ─────────────────────────────────────────────────────────

  describe('loadApprovals', () => {
    it('stores approvals keyed by submittal id', async () => {
      const approvals = [
        { id: 'appr-1', submittal_id: 'sub-1', stamp: 'approved', approver_id: 'user-2' },
      ]
      ;(submittalService.loadApprovals as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: approvals,
        error: null,
      })

      await useSubmittalStore.getState().loadApprovals('sub-1')

      expect(useSubmittalStore.getState().approvals['sub-1']).toHaveLength(1)
      expect(useSubmittalStore.getState().approvals['sub-1'][0].stamp).toBe('approved')
    })

    it('does not update approvals on service error', async () => {
      ;(submittalService.loadApprovals as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Query failed', message: 'no table' },
      })

      await useSubmittalStore.getState().loadApprovals('sub-1')

      expect(useSubmittalStore.getState().approvals['sub-1']).toBeUndefined()
    })
  })

  // ── createRevision ────────────────────────────────────────────────────────

  describe('createRevision', () => {
    it('prepends new revision to local state and entityStore', async () => {
      const revision = { ...SUBMITTAL, id: 'sub-2', revision_number: 2, parent_submittal_id: 'sub-1' }
      useSubmittalStore.setState({ submittals: [SUBMITTAL as never] })
      ;(submittalService.createRevision as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: revision,
        error: null,
      })

      const result = await useSubmittalStore.getState().createRevision('sub-1')

      expect(result.error).toBeNull()
      expect(result.submittal?.id).toBe('sub-2')
      expect(result.submittal?.revision_number).toBe(2)
      expect(useSubmittalStore.getState().submittals).toHaveLength(2)
      expect(useSubmittalStore.getState().submittals[0].id).toBe('sub-2')
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns error when parent submittal is not found', async () => {
      ;(submittalService.createRevision as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Submittal not found', message: 'not found' },
      })

      const result = await useSubmittalStore.getState().createRevision('sub-missing')

      expect(result.error).toBe('Submittal not found')
      expect(result.submittal).toBeNull()
    })
  })

  // ── clearError ────────────────────────────────────────────────────────────

  describe('clearError', () => {
    it('resets error and errorDetails to null', () => {
      useSubmittalStore.setState({
        error: 'some error',
        errorDetails: { message: 'x', userMessage: 'x', code: 'DB_ERROR', context: {} },
      })

      useSubmittalStore.getState().clearError()

      const { error, errorDetails } = useSubmittalStore.getState()
      expect(error).toBeNull()
      expect(errorDetails).toBeNull()
    })
  })
})
