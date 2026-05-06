/**
 * draftedActions hook tests — covers the three behaviors that protect the
 * Iris approval loop:
 *   1. Missing-table tolerance: if the schema isn't deployed, the query
 *      surfaces an empty array instead of crashing the page.
 *   2. Approve idempotency: clicking approve on an already-decided draft
 *      (race with realtime) is a no-op, not a double-execute.
 *   3. Reject audits: every rejection writes a `reject` audit_log entry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DraftedAction } from '../../../types/draftedActions'

// ── Hoisted mock surface ──────────────────────────────────────────────

const {
  mockFrom,
  mockGetUser,
  mockChannel,
  mockRemoveChannel,
  mockApproveAndExecute,
  mockRejectDraft,
  mockLogAuditEntry,
  mockUseProjectId,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockApproveAndExecute: vi.fn(),
  mockRejectDraft: vi.fn(),
  mockLogAuditEntry: vi.fn(),
  mockUseProjectId: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
  isSupabaseConfigured: true,
}))

vi.mock('../../useProjectId', () => ({
  useProjectId: () => mockUseProjectId(),
}))

vi.mock('../../../services/iris/executeAction', () => ({
  approveAndExecute: (...args: unknown[]) => mockApproveAndExecute(...args),
  rejectDraft: (...args: unknown[]) => mockRejectDraft(...args),
}))

vi.mock('../../../lib/auditLogger', () => ({
  logAuditEntry: (...args: unknown[]) => mockLogAuditEntry(...args),
}))

// Import AFTER mocks so the hook picks up the test doubles.
import {
  useDraftedActions,
  useApproveDraftedAction,
  useRejectDraftedAction,
} from '../draftedActions'

// ── Helpers ───────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

/**
 * The drafted_actions per-entity query chains:
 *   from('drafted_actions').select('*').eq.eq.eq.eq.order(...)
 * Each .eq returns the chain; the awaited terminal is .order. The mutation
 * status read uses .select('id, status').eq.maybeSingle(). We expose both
 * terminals on a shared chain object so the test controls the resolved value.
 */
function makeQueryChain(opts: {
  /** Resolved value for the .order(...) terminal (per-entity list query). */
  orderResolves?: { data: unknown; error: unknown }
  /** Resolved value for the .maybeSingle() terminal (mutation status read). */
  maybeSingleResolves?: { data: unknown; error: unknown }
}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(
      opts.maybeSingleResolves ?? { data: null, error: null },
    ),
  }
  for (const k of ['select', 'eq', 'in']) chain[k].mockReturnValue(chain)
  // .order is awaited as the terminal in the per-entity query path.
  chain['order'].mockResolvedValue(
    opts.orderResolves ?? { data: [], error: null },
  )
  // .limit is awaited in the project-wide query path (not exercised here, but
  // safe to provide a default).
  chain['limit'].mockResolvedValue(
    opts.orderResolves ?? { data: [], error: null },
  )
  return chain
}

function makeDraft(overrides: Partial<DraftedAction> = {}): DraftedAction {
  return {
    id: 'draft-1',
    project_id: 'proj-1',
    action_type: 'rfi.draft',
    title: 'Draft RFI: clarify foundation detail',
    summary: null,
    payload: {
      title: 'Clarify foundation detail',
      description: 'Iris noticed an unresolved coordination issue.',
    },
    citations: [],
    confidence: 0.82,
    status: 'pending',
    drafted_by: 'iris',
    draft_reason: null,
    related_resource_type: 'rfi',
    related_resource_id: 'rfi-1',
    executed_resource_type: null,
    executed_resource_id: null,
    execution_result: null,
    decided_by: null,
    decided_at: null,
    decision_note: null,
    executed_at: null,
    created_at: '2026-04-29T00:00:00Z',
    updated_at: '2026-04-29T00:00:00Z',
    ...overrides,
  } as DraftedAction
}

// ── Setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseProjectId.mockReturnValue('proj-1')
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  // Channel + removeChannel never need to do anything observable in these
  // tests; just return enough surface to satisfy the realtime hook.
  mockChannel.mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })
  mockLogAuditEntry.mockResolvedValue(undefined)
})

// ── Tests ─────────────────────────────────────────────────────────────

describe('useDraftedActions', () => {
  it('returns empty array when the drafted_actions table is missing (PGRST205)', async () => {
    const chain = makeQueryChain({
      orderResolves: {
        data: null,
        error: { code: 'PGRST205', message: 'relation public.drafted_actions does not exist' },
      },
    })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useDraftedActions('rfi', 'rfi-1'), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // The hook swallows missing-schema errors and resolves with [].
    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()
    expect(mockFrom).toHaveBeenCalledWith('drafted_actions')
  })
})

describe('useApproveDraftedAction', () => {
  it('is idempotent: short-circuits without re-executing when the draft is already approved', async () => {
    // Status read says the row is already 'approved'. The mutation should
    // resolve successfully without ever calling the executor.
    const chain = makeQueryChain({
      maybeSingleResolves: {
        data: { id: 'draft-1', status: 'approved' },
        error: null,
      },
    })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useApproveDraftedAction(), {
      wrapper: makeWrapper(),
    })

    const draft = makeDraft()
    await act(async () => {
      await result.current.mutateAsync(draft)
    })

    // Hard guarantee: no executor call, no audit entry — pure no-op.
    expect(mockApproveAndExecute).not.toHaveBeenCalled()
    expect(mockLogAuditEntry).not.toHaveBeenCalled()
    // And it didn't throw.
    expect(result.current.isError).toBe(false)
  })

  it('calls the executor and audits when the draft is still pending', async () => {
    const chain = makeQueryChain({
      maybeSingleResolves: {
        data: { id: 'draft-1', status: 'pending' },
        error: null,
      },
    })
    mockFrom.mockReturnValue(chain)
    mockApproveAndExecute.mockResolvedValue({
      ok: true,
      executed_resource_type: 'rfi',
      executed_resource_id: 'rfi-99',
    })

    const { result } = renderHook(() => useApproveDraftedAction(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync(makeDraft())
    })

    expect(mockApproveAndExecute).toHaveBeenCalledWith({
      draftId: 'draft-1',
      decided_by: 'user-1',
    })
    expect(mockLogAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approve', entityType: 'rfi', entityId: 'rfi-1' }),
    )
  })
})

describe('useRejectDraftedAction', () => {
  it('writes a `reject` audit entry with the drafted-action metadata', async () => {
    mockRejectDraft.mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useRejectDraftedAction(), {
      wrapper: makeWrapper(),
    })

    const draft = makeDraft()
    await act(async () => {
      await result.current.mutateAsync({ draft, reason: 'Not relevant' })
    })

    expect(mockRejectDraft).toHaveBeenCalledWith({
      draftId: 'draft-1',
      decided_by: 'user-1',
      decision_note: 'Not relevant',
    })
    expect(mockLogAuditEntry).toHaveBeenCalledTimes(1)
    expect(mockLogAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reject',
        entityType: 'rfi',
        entityId: 'rfi-1',
        projectId: 'proj-1',
        metadata: expect.objectContaining({
          action_type: 'rfi.draft',
          drafted_action_id: 'draft-1',
          reason: 'Not relevant',
        }),
      }),
    )
  })
})
