import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBudgetStore } from '../../stores/budgetStore'
import type { BudgetDivision, ChangeOrder } from '../../types/database'

// ── Supabase mock ──────────────────────────────────────────────────────────
// Must be at module scope for Vitest's hoisting to work correctly.

const mockEq = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
  fromTable: (...args: unknown[]) => mockFrom(...args),
}))

function setupDbSuccess() {
  mockEq.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ update: mockUpdate })
}

function setupDbError(message: string) {
  mockEq.mockResolvedValue({ error: { message } })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ update: mockUpdate })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDivision(overrides: Partial<BudgetDivision> = {}): BudgetDivision {
  return {
    id: 'div-1',
    project_id: 'proj-1',
    code: '03',
    name: 'Concrete',
    budgeted_amount: 500_000,
    spent: 200_000,
    committed: 150_000,
    created_at: new Date().toISOString(),
    ...overrides,
  } as BudgetDivision
}

function makeChangeOrder(overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  return {
    id: 'co-1',
    project_id: 'proj-1',
    co_number: 1,
    title: 'CO-001',
    description: 'Extra concrete work',
    amount: 50_000,
    status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as ChangeOrder
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  useBudgetStore.setState({
    divisions: [],
    lineItems: {},
    changeOrders: [],
    loading: false,
    error: null,
  })
  vi.clearAllMocks()
  setupDbSuccess()
})

// ── getSummary ─────────────────────────────────────────────────────────────

describe('getSummary', () => {
  it('should return zero totals when no divisions or change orders exist', () => {
    const summary = useBudgetStore.getState().getSummary()
    expect(summary.totalBudget).toBe(0)
    expect(summary.totalSpent).toBe(0)
    expect(summary.totalCommitted).toBe(0)
    expect(summary.remaining).toBe(0)
    expect(summary.contingencyUsed).toBe(0)
  })

  it('should sum budgeted_amount across all divisions', () => {
    useBudgetStore.setState({
      divisions: [
        makeDivision({ id: 'd1', budgeted_amount: 500_000, spent: 0, committed: 0 }),
        makeDivision({ id: 'd2', budgeted_amount: 300_000, spent: 0, committed: 0 }),
        makeDivision({ id: 'd3', budgeted_amount: 200_000, spent: 0, committed: 0 }),
      ],
      changeOrders: [],
    })

    const summary = useBudgetStore.getState().getSummary()
    expect(summary.totalBudget).toBe(1_000_000)
  })

  it('should sum spent amounts across all divisions', () => {
    useBudgetStore.setState({
      divisions: [
        makeDivision({ id: 'd1', spent: 120_000, budgeted_amount: 500_000, committed: 0 }),
        makeDivision({ id: 'd2', spent: 80_000, budgeted_amount: 300_000, committed: 0 }),
      ],
      changeOrders: [],
    })

    const summary = useBudgetStore.getState().getSummary()
    expect(summary.totalSpent).toBe(200_000)
  })

  it('should sum committed amounts across all divisions', () => {
    useBudgetStore.setState({
      divisions: [
        makeDivision({ id: 'd1', committed: 150_000, budgeted_amount: 500_000, spent: 0 }),
        makeDivision({ id: 'd2', committed: 100_000, budgeted_amount: 300_000, spent: 0 }),
      ],
      changeOrders: [],
    })

    const summary = useBudgetStore.getState().getSummary()
    expect(summary.totalCommitted).toBe(250_000)
  })

  it('should compute remaining as budget minus spent minus committed', () => {
    useBudgetStore.setState({
      divisions: [
        makeDivision({ budgeted_amount: 1_000_000, spent: 300_000, committed: 400_000 }),
      ],
      changeOrders: [],
    })

    const summary = useBudgetStore.getState().getSummary()
    expect(summary.remaining).toBe(300_000) // 1M - 300k - 400k
  })

  it('should report negative remaining when spent + committed exceeds budget', () => {
    useBudgetStore.setState({
      divisions: [
        makeDivision({ budgeted_amount: 500_000, spent: 400_000, committed: 200_000 }),
      ],
      changeOrders: [],
    })

    const summary = useBudgetStore.getState().getSummary()
    expect(summary.remaining).toBe(-100_000)
  })

  it('should only count approved change orders in contingencyUsed', () => {
    useBudgetStore.setState({
      divisions: [],
      changeOrders: [
        makeChangeOrder({ id: 'co-1', amount: 50_000, status: 'approved' }),
        makeChangeOrder({ id: 'co-2', amount: 30_000, status: 'draft' }),
        makeChangeOrder({ id: 'co-3', amount: 20_000, status: 'pending' }),
        makeChangeOrder({ id: 'co-4', amount: 15_000, status: 'rejected' }),
        makeChangeOrder({ id: 'co-5', amount: 10_000, status: 'approved' }),
      ],
    })

    const summary = useBudgetStore.getState().getSummary()
    // Only approved: 50k + 10k = 60k
    expect(summary.contingencyUsed).toBe(60_000)
  })

  it('should return contingencyUsed=0 when no approved change orders', () => {
    useBudgetStore.setState({
      divisions: [],
      changeOrders: [
        makeChangeOrder({ id: 'co-1', status: 'draft' }),
        makeChangeOrder({ id: 'co-2', status: 'pending' }),
      ],
    })

    const summary = useBudgetStore.getState().getSummary()
    expect(summary.contingencyUsed).toBe(0)
  })

  it('should include all required fields in the summary result', () => {
    const summary = useBudgetStore.getState().getSummary()
    expect(summary).toHaveProperty('totalBudget')
    expect(summary).toHaveProperty('totalSpent')
    expect(summary).toHaveProperty('totalCommitted')
    expect(summary).toHaveProperty('remaining')
    expect(summary).toHaveProperty('contingency')
    expect(summary).toHaveProperty('contingencyUsed')
  })

  it('should compute correct summary for a realistic project budget', () => {
    useBudgetStore.setState({
      divisions: [
        makeDivision({ id: 'd1', budgeted_amount: 2_000_000, spent: 800_000, committed: 600_000 }),
        makeDivision({ id: 'd2', budgeted_amount: 1_500_000, spent: 500_000, committed: 400_000 }),
        makeDivision({ id: 'd3', budgeted_amount: 500_000, spent: 100_000, committed: 200_000 }),
      ],
      changeOrders: [
        makeChangeOrder({ id: 'co-1', amount: 75_000, status: 'approved' }),
        makeChangeOrder({ id: 'co-2', amount: 25_000, status: 'approved' }),
        makeChangeOrder({ id: 'co-3', amount: 50_000, status: 'pending' }),
      ],
    })

    const summary = useBudgetStore.getState().getSummary()
    expect(summary.totalBudget).toBe(4_000_000)
    expect(summary.totalSpent).toBe(1_400_000)
    expect(summary.totalCommitted).toBe(1_200_000)
    expect(summary.remaining).toBe(1_400_000) // 4M - 1.4M - 1.2M
    expect(summary.contingencyUsed).toBe(100_000) // 75k + 25k approved
  })
})

// ── updateChangeOrderStatus ────────────────────────────────────────────────

describe('updateChangeOrderStatus', () => {
  beforeEach(() => {
    useBudgetStore.setState({
      divisions: [],
      lineItems: {},
      changeOrders: [
        makeChangeOrder({ id: 'co-1', status: 'pending', amount: 50_000 }),
        makeChangeOrder({ id: 'co-2', status: 'draft', amount: 30_000 }),
      ],
      loading: false,
      error: null,
    })
  })

  it('should optimistically update the change order status before DB responds', async () => {
    // Create a promise that we can control when it resolves
    let resolveEq!: (value: { error: null }) => void
    const eqPromise = new Promise<{ error: null }>((resolve) => { resolveEq = resolve })
    mockEq.mockReturnValue(eqPromise)

    // Fire without awaiting
    const pending = useBudgetStore.getState().updateChangeOrderStatus('co-1', 'approved')

    // Optimistic update should be applied immediately
    const coBeforeResolve = useBudgetStore.getState().changeOrders.find((co) => co.id === 'co-1')
    expect(coBeforeResolve?.status).toBe('approved')

    // Resolve the DB call
    resolveEq({ error: null })
    await pending
  })

  it('should roll back optimistic update when DB returns an error', async () => {
    setupDbError('Permission denied')

    await useBudgetStore.getState().updateChangeOrderStatus('co-1', 'approved')

    // Status should roll back to the original value
    const co = useBudgetStore.getState().changeOrders.find((c) => c.id === 'co-1')
    expect(co?.status).toBe('pending')
  })

  it('should return the error message when DB write fails', async () => {
    setupDbError('Constraint violation')

    const result = await useBudgetStore.getState().updateChangeOrderStatus('co-1', 'approved')
    expect(result.error).toBe('Constraint violation')
  })

  it('should return null error on successful update', async () => {
    const result = await useBudgetStore.getState().updateChangeOrderStatus('co-1', 'approved')
    expect(result.error).toBeNull()
  })

  it('should include approved_by when provided', async () => {
    await useBudgetStore.getState().updateChangeOrderStatus('co-1', 'approved', 'user-abc')

    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.approved_by).toBe('user-abc')
  })

  it('should not include approved_by when omitted', async () => {
    await useBudgetStore.getState().updateChangeOrderStatus('co-1', 'pending')

    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.approved_by).toBeUndefined()
  })

  it('should not modify other change orders', async () => {
    await useBudgetStore.getState().updateChangeOrderStatus('co-1', 'approved')

    const co2 = useBudgetStore.getState().changeOrders.find((c) => c.id === 'co-2')
    expect(co2?.status).toBe('draft') // unchanged
  })

  it('should include updated_at in the update payload', async () => {
    await useBudgetStore.getState().updateChangeOrderStatus('co-1', 'approved')

    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.updated_at).toBeDefined()
    // Should be a valid ISO timestamp
    expect(() => new Date(updateArg.updated_at)).not.toThrow()
  })

  it('should call supabase.from("change_orders") with the correct arguments', async () => {
    await useBudgetStore.getState().updateChangeOrderStatus('co-1', 'approved')

    expect(mockFrom).toHaveBeenCalledWith('change_orders')
    expect(mockEq).toHaveBeenCalledWith('id', 'co-1')
  })
})
