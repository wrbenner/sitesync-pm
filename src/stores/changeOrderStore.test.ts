import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock service
// ---------------------------------------------------------------------------
vi.mock('../services/changeOrderService', () => ({
  changeOrderService: {
    loadChangeOrders: vi.fn(),
    createChangeOrder: vi.fn(),
    updateChangeOrder: vi.fn(),
    transitionStatus: vi.fn(),
    deleteChangeOrder: vi.fn(),
    promoteType: vi.fn(),
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

import { useChangeOrderStore } from './changeOrderStore'
import { changeOrderService } from '../services/changeOrderService'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const CO = {
  id: 'co-1',
  project_id: 'proj-1',
  title: 'Additional Excavation',
  description: 'Unforeseen rock encountered',
  status: 'draft',
  type: 'pco',
  amount: 1500000,
  approved_amount: null,
  number: 1,
  created_by: 'user-1',
  updated_by: null,
  parent_co_id: null,
  submitted_by: null,
  submitted_at: null,
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejected_at: null,
  deleted_at: null,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetStore() {
  useChangeOrderStore.setState({
    changeOrders: [],
    loading: false,
    error: null,
    errorDetails: null,
  })
}

describe('useChangeOrderStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  // ── loadChangeOrders ─────────────────────────────────────────────────────

  describe('loadChangeOrders', () => {
    it('populates changeOrders and mirrors into entityStore on success', async () => {
      ;(changeOrderService.loadChangeOrders as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [CO],
        error: null,
      })

      await useChangeOrderStore.getState().loadChangeOrders('proj-1')

      const { changeOrders, loading, error } = useChangeOrderStore.getState()
      expect(changeOrders).toHaveLength(1)
      expect(changeOrders[0].id).toBe('co-1')
      expect(loading).toBe(false)
      expect(error).toBeNull()

      // entityStore must be initialised and populated
      expect(mockInitSlice).toHaveBeenCalledWith('change_orders')
      expect(mockSetSlice).toHaveBeenCalledWith(
        'change_orders',
        expect.objectContaining({ items: [CO], loading: false, error: null }),
      )
    })

    it('sets error state and mirrors error into entityStore when service fails', async () => {
      ;(changeOrderService.loadChangeOrders as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Failed to load change orders', message: 'DB error' },
      })

      await useChangeOrderStore.getState().loadChangeOrders('proj-1')

      const { error, loading } = useChangeOrderStore.getState()
      expect(error).toBe('Failed to load change orders')
      expect(loading).toBe(false)

      expect(mockSetSlice).toHaveBeenCalledWith(
        'change_orders',
        expect.objectContaining({ error: 'Failed to load change orders' }),
      )
    })

    it('preserves existing changeOrders on transient error', async () => {
      useChangeOrderStore.setState({ changeOrders: [CO as never] })
      ;(changeOrderService.loadChangeOrders as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Network error', message: 'timeout' },
      })

      await useChangeOrderStore.getState().loadChangeOrders('proj-1')

      // Local store retains previous items while entityStore reflects the error
      expect(useChangeOrderStore.getState().changeOrders).toHaveLength(1)
    })
  })

  // ── createChangeOrder ────────────────────────────────────────────────────

  describe('createChangeOrder', () => {
    it('prepends new change order to local state and entityStore', async () => {
      ;(changeOrderService.createChangeOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: CO,
        error: null,
      })

      const result = await useChangeOrderStore.getState().createChangeOrder({
        project_id: 'proj-1',
        description: 'Unforeseen rock encountered',
        title: 'Additional Excavation',
        type: 'pco',
      })

      expect(result.error).toBeNull()
      expect(result.changeOrder?.id).toBe('co-1')
      expect(useChangeOrderStore.getState().changeOrders).toHaveLength(1)
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns error and leaves state unchanged when service fails', async () => {
      ;(changeOrderService.createChangeOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Insert failed', message: 'DB constraint' },
      })

      const result = await useChangeOrderStore.getState().createChangeOrder({
        project_id: 'proj-1',
        description: 'Test',
      })

      expect(result.error).toBe('Insert failed')
      expect(result.changeOrder).toBeNull()
      expect(useChangeOrderStore.getState().changeOrders).toHaveLength(0)
    })
  })

  // ── updateChangeOrder ────────────────────────────────────────────────────

  describe('updateChangeOrder', () => {
    it('merges updates into local state and entityStore', async () => {
      useChangeOrderStore.setState({ changeOrders: [CO as never] })
      ;(changeOrderService.updateChangeOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await useChangeOrderStore.getState().updateChangeOrder('co-1', {
        title: 'Updated Title',
        amount: 2000000,
      })

      expect(result.error).toBeNull()
      const updated = useChangeOrderStore.getState().changeOrders.find((c) => c.id === 'co-1')
      expect(updated?.title).toBe('Updated Title')
      expect(updated?.amount).toBe(2000000)
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns service error without mutating state', async () => {
      useChangeOrderStore.setState({ changeOrders: [CO as never] })
      ;(changeOrderService.updateChangeOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Update failed', message: 'forbidden' },
      })

      const result = await useChangeOrderStore.getState().updateChangeOrder('co-1', {
        title: 'Should not apply',
      })

      expect(result.error).toBe('Update failed')
      const unchanged = useChangeOrderStore.getState().changeOrders.find((c) => c.id === 'co-1')
      expect(unchanged?.title).toBe('Additional Excavation')
    })
  })

  // ── transitionStatus ─────────────────────────────────────────────────────

  describe('transitionStatus', () => {
    it('updates status in local state and entityStore on success', async () => {
      useChangeOrderStore.setState({ changeOrders: [CO as never] })
      ;(changeOrderService.transitionStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await useChangeOrderStore.getState().transitionStatus('co-1', 'pending_review')

      expect(result.error).toBeNull()
      const updated = useChangeOrderStore.getState().changeOrders.find((c) => c.id === 'co-1')
      expect(updated?.status).toBe('pending_review')
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns error and leaves status unchanged when service rejects transition', async () => {
      useChangeOrderStore.setState({ changeOrders: [CO as never] })
      ;(changeOrderService.transitionStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Invalid transition: draft → approved', message: 'state machine' },
      })

      const result = await useChangeOrderStore.getState().transitionStatus('co-1', 'approved')

      expect(result.error).toBe('Invalid transition: draft → approved')
      const co = useChangeOrderStore.getState().changeOrders.find((c) => c.id === 'co-1')
      expect(co?.status).toBe('draft')
    })

    it('passes optional comments to service layer', async () => {
      useChangeOrderStore.setState({ changeOrders: [{ ...CO, status: 'pending_review' } as never] })
      ;(changeOrderService.transitionStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      })

      await useChangeOrderStore.getState().transitionStatus('co-1', 'rejected', 'Scope not justified')

      expect(changeOrderService.transitionStatus).toHaveBeenCalledWith(
        'co-1',
        'rejected',
        'Scope not justified',
      )
    })
  })

  // ── deleteChangeOrder ────────────────────────────────────────────────────

  describe('deleteChangeOrder', () => {
    it('removes CO from local state and entityStore', async () => {
      useChangeOrderStore.setState({ changeOrders: [CO as never] })
      ;(changeOrderService.deleteChangeOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await useChangeOrderStore.getState().deleteChangeOrder('co-1')

      expect(result.error).toBeNull()
      expect(useChangeOrderStore.getState().changeOrders).toHaveLength(0)
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns error and keeps CO in state when service fails', async () => {
      useChangeOrderStore.setState({ changeOrders: [CO as never] })
      ;(changeOrderService.deleteChangeOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Delete forbidden', message: 'RLS' },
      })

      const result = await useChangeOrderStore.getState().deleteChangeOrder('co-1')

      expect(result.error).toBe('Delete forbidden')
      expect(useChangeOrderStore.getState().changeOrders).toHaveLength(1)
    })
  })

  // ── promoteType ──────────────────────────────────────────────────────────

  describe('promoteType', () => {
    it('prepends promoted CO to local state and entityStore', async () => {
      const promotedCOR = { ...CO, id: 'co-2', type: 'cor', status: 'draft' }
      useChangeOrderStore.setState({ changeOrders: [CO as never] })
      ;(changeOrderService.promoteType as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: promotedCOR,
        error: null,
      })

      const result = await useChangeOrderStore.getState().promoteType('co-1')

      expect(result.error).toBeNull()
      expect(result.changeOrder?.type).toBe('cor')
      expect(result.changeOrder?.id).toBe('co-2')
      expect(useChangeOrderStore.getState().changeOrders).toHaveLength(2)
      expect(useChangeOrderStore.getState().changeOrders[0].id).toBe('co-2')
      expect(mockEntitySetState).toHaveBeenCalled()
    })

    it('returns error when promotion is invalid', async () => {
      ;(changeOrderService.promoteType as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { userMessage: 'Cannot promote CO further', message: 'end of chain' },
      })

      const result = await useChangeOrderStore.getState().promoteType('co-1')

      expect(result.error).toBe('Cannot promote CO further')
      expect(result.changeOrder).toBeNull()
    })
  })

  // ── clearError ───────────────────────────────────────────────────────────

  describe('clearError', () => {
    it('resets error and errorDetails to null', () => {
      useChangeOrderStore.setState({
        error: 'some error',
        errorDetails: { message: 'x', userMessage: 'x', code: 'DB_ERROR', context: {} },
      })

      useChangeOrderStore.getState().clearError()

      const { error, errorDetails } = useChangeOrderStore.getState()
      expect(error).toBeNull()
      expect(errorDetails).toBeNull()
    })
  })
})
