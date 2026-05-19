/**
 * IrisApprovalGate render tests — guard the visible parts of the
 * approval gate that the rest of the UI depends on:
 *   • the action label resolves from the static map
 *   • Approve fires the onApprove callback with the draft
 *   • Reject fires onReject
 *   • busy=true disables both buttons (no double-execute on click spam)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// usePermissions in test environment without seeded role data returns
// hasPermission: () => false for everything (the safe default). The gate
// then disables Approve, which makes click-fires-onApprove tests fail.
// Mock the hook to grant permission so the tests focus on the gate's
// callback behavior, not the permission resolver itself (which has its
// own focused tests in src/hooks).
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: 'project_manager',
    loading: false,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isAtLeast: () => true,
    canAccessModule: () => true,
  }),
}))

import { IrisApprovalGate } from '../IrisApprovalGate'
import type { DraftedAction } from '../../../types/draftedActions'

// useOpenCitationPanel + useRecordDraftView need a Router + Supabase context.
// usePermissions (added in the Bugatti closure pass to gate Approve & Send)
// also needs a QueryClient. Wrap renders in both providers so the gate's
// hooks resolve. The hooks themselves are exercised in focused unit tests.
function renderInRouter(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function makeDraft(overrides: Partial<DraftedAction> = {}): DraftedAction {
  return {
    id: 'draft-1',
    project_id: 'proj-1',
    action_type: 'rfi.draft',
    title: 'Draft RFI: clarify foundation detail',
    summary: 'Iris noticed an unresolved coordination issue.',
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

describe('IrisApprovalGate', () => {
  it('renders the action label, title, and confidence', () => {
    renderInRouter(
      <IrisApprovalGate draft={makeDraft()} onApprove={vi.fn()} onReject={vi.fn()} />,
    )
    expect(screen.getByText(/Iris drafted · RFI/)).toBeTruthy()
    expect(screen.getByText('Draft RFI: clarify foundation detail')).toBeTruthy()
    expect(screen.getByText('82%')).toBeTruthy()
  })

  it('fires onApprove with the full draft on approve click', () => {
    const onApprove = vi.fn()
    const draft = makeDraft()
    renderInRouter(<IrisApprovalGate draft={draft} onApprove={onApprove} onReject={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onApprove).toHaveBeenCalledWith(draft)
  })

  it('fires onReject on reject click', () => {
    const onReject = vi.fn()
    const draft = makeDraft()
    renderInRouter(<IrisApprovalGate draft={draft} onApprove={vi.fn()} onReject={onReject} />)

    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(onReject).toHaveBeenCalledWith(draft)
  })

  it('disables both buttons when busy is true', () => {
    renderInRouter(
      <IrisApprovalGate
        draft={makeDraft()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        busy
      />,
    )
    const approveBtn = screen.getByRole('button', { name: /approve/i }) as HTMLButtonElement
    const rejectBtn = screen.getByRole('button', { name: /reject/i }) as HTMLButtonElement
    expect(approveBtn.disabled).toBe(true)
    expect(rejectBtn.disabled).toBe(true)
  })
})
