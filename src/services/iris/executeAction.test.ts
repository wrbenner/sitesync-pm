/**
 * Tests for the Iris execute-action gate. The atomic claim ("set
 * status from 'pending' to 'approved' only if it was still pending")
 * is the safety property that prevents two reviewers from
 * double-executing the same draft. These tests pin that contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DraftedAction } from '../../types/draftedActions'

// ── Mock setup ────────────────────────────────────────────────────────

const { mockUpdate, mockEq, mockSelectSingle, mockDelete, mockInsert, mockFrom } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockSelectSingle: vi.fn(),
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// Each executor module is mocked so the test isolates the dispatcher.
const { mockExecuteRfi, mockExecuteDailyLog, mockExecutePayApp } = vi.hoisted(() => ({
  mockExecuteRfi: vi.fn(),
  mockExecuteDailyLog: vi.fn(),
  mockExecutePayApp: vi.fn(),
}))

vi.mock('./executors/rfi', () => ({ executeDraftedRfi: mockExecuteRfi }))
vi.mock('./executors/dailyLog', () => ({ executeDraftedDailyLog: mockExecuteDailyLog }))
vi.mock('./executors/payApp', () => ({ executeDraftedPayApp: mockExecutePayApp }))

import { approveAndExecute, rejectDraft } from './executeAction'

// ── Helpers ───────────────────────────────────────────────────────────

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    update: mockUpdate,
    eq: mockEq,
    select: vi.fn(),
    single: mockSelectSingle,
    delete: mockDelete,
    insert: mockInsert,
  }
  for (const key of ['update', 'eq', 'select', 'delete', 'insert']) {
    chain[key].mockReturnValue(chain)
  }
  return chain
}

const fakeDraft: DraftedAction = {
  id: 'draft-1',
  project_id: 'proj-1',
  action_type: 'rfi.draft',
  title: 'Test draft',
  summary: null,
  payload: { title: 'T', description: 'D' },
  citations: [],
  confidence: 0.7,
  status: 'pending',
  drafted_by: 'test-model',
  draft_reason: null,
  related_resource_type: null,
  related_resource_id: null,
  executed_resource_type: null,
  executed_resource_id: null,
  execution_result: null,
  decided_by: null,
  decided_at: null,
  decision_note: null,
  executed_at: null,
  created_at: '2026-04-27T00:00:00Z',
  updated_at: '2026-04-27T00:00:00Z',
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('approveAndExecute', () => {
  beforeEach(() => vi.clearAllMocks())

  it('claims a pending draft and runs the registered executor', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain)
    // Step 1: claim the draft (returns the row).
    mockSelectSingle.mockResolvedValueOnce({ data: fakeDraft, error: null })
    // Step 2: executor returns a resource id.
    mockExecuteRfi.mockResolvedValueOnce({
      resource_type: 'rfi',
      resource_id: 'rfi-99',
      result: { rfi_id: 'rfi-99' },
    })

    const result = await approveAndExecute({
      draftId: 'draft-1',
      decided_by: 'user-1',
    })

    expect(result.ok).toBe(true)
    expect(result.executed_resource_type).toBe('rfi')
    expect(result.executed_resource_id).toBe('rfi-99')
    expect(mockExecuteRfi).toHaveBeenCalledWith(fakeDraft)
    // Update was called twice: once to claim, once to mark executed.
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('refuses to execute when the draft was already decided (race)', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain)
    // The .eq('status', 'pending') guard makes this query return no rows,
    // which Supabase surfaces as an error from .single().
    mockSelectSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows', code: 'PGRST116' },
    })

    const result = await approveAndExecute({
      draftId: 'draft-1',
      decided_by: 'user-2',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/already decided|No rows/)
    expect(mockExecuteRfi).not.toHaveBeenCalled()
  })

  it('marks failed when the executor throws', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain)
    mockSelectSingle.mockResolvedValueOnce({ data: fakeDraft, error: null })
    mockExecuteRfi.mockRejectedValueOnce(new Error('RFI insert blew up'))

    const result = await approveAndExecute({
      draftId: 'draft-1',
      decided_by: 'user-1',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('RFI insert blew up')
    // Two update calls: claim, then mark-failed.
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('refuses unknown action_type instead of crashing', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain)
    const weirdDraft: DraftedAction = {
      ...fakeDraft,
      action_type: 'punch_item.draft',
      payload: { title: 'P', description: 'D' },
    }
    mockSelectSingle.mockResolvedValueOnce({ data: weirdDraft, error: null })

    const result = await approveAndExecute({
      draftId: 'draft-1',
      decided_by: 'user-1',
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No executor/)
  })
})

describe('rejectDraft', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks pending draft as rejected', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain)
    mockEq.mockReturnValueOnce(chain).mockReturnValueOnce({ error: null })

    const result = await rejectDraft({ draftId: 'draft-1', decided_by: 'user-1' })

    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected', decided_by: 'user-1' }),
    )
  })

  it('reports failure when the update errors', async () => {
    const chain = makeChain()
    mockFrom.mockReturnValue(chain)
    mockEq.mockReturnValueOnce(chain).mockReturnValueOnce({ error: { message: 'boom' } })

    const result = await rejectDraft({ draftId: 'draft-1', decided_by: 'user-1' })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('boom')
  })
})
