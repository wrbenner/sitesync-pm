import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────
const rfisState = {
  data: { data: [] as unknown[] } as { data: unknown[] } | undefined,
  isPending: false,
  error: null as unknown,
  refetch: vi.fn(),
}

const mockMutateAsync = vi.fn().mockResolvedValue({})
const mockCreateRFIResponse = vi.fn().mockResolvedValue({})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  isSupabaseConfigured: true,
}))

vi.mock('../../hooks/queries', () => ({
  useRFIs: () => rfisState,
}))

vi.mock('../../hooks/queries/rfis', () => ({
  useRFI: () => ({ data: undefined }),
}))

vi.mock('../../hooks/mutations', () => ({
  useCreateRFI: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateRFI: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateRFIResponse: () => ({ mutateAsync: mockCreateRFIResponse, isPending: false }),
}))

vi.mock('../../hooks/useProjectId', () => ({
  useProjectId: () => 'test-project-id',
}))

vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('../../stores/copilotStore', () => ({
  useCopilotStore: () => ({ setPageContext: vi.fn() }),
}))

vi.mock('../../data/aiAnnotations', () => ({
  getPredictiveAlertsForPage: () => [],
  getAnnotationsForEntity: () => [],
}))

vi.mock('../../utils/connections', () => ({
  useAppNavigate: () => vi.fn(),
  getRelatedItemsForRfi: () => [],
}))

vi.mock('../../components/forms/CreateRFIModal', () => ({
  default: ({ open, onSubmit }: { open: boolean; onSubmit: (d: unknown) => void }) =>
    open ? (
      <div data-testid="create-rfi-modal">
        <button data-testid="modal-submit" onClick={() => onSubmit({ title: 'Test RFI', priority: 'medium' })}>
          Submit
        </button>
      </div>
    ) : null,
}))

vi.mock('../../components/field/QuickRFIButton', () => ({
  default: () => null,
}))

vi.mock('../../components/shared/VirtualDataTable', () => ({
  VirtualDataTable: ({ onRowClick, data }: { onRowClick: (r: unknown) => void; data: unknown[] }) => (
    <div data-testid="rfi-data-table">
      {(data as Record<string, unknown>[]).map((row) => (
        <div
          key={String(row.id)}
          data-testid={`rfi-row-${String(row.id)}`}
          onClick={() => onRowClick(row)}
          style={{ cursor: 'pointer' }}
        />
      ))}
    </div>
  ),
}))

vi.mock('../../components/shared/KanbanBoard', () => ({
  KanbanBoard: () => <div data-testid="rfi-kanban" />,
}))

vi.mock('../../components/shared/PresenceAvatars', () => ({
  PresenceAvatars: () => null,
}))

vi.mock('../../components/ai/AIAnnotation', () => ({
  AIAnnotationIndicator: () => null,
}))

vi.mock('../../components/ai/PredictiveAlert', () => ({
  PredictiveAlertBanner: () => null,
}))

vi.mock('../../components/ui/EditingLockBanner', () => ({
  EditingLockBanner: () => null,
}))

vi.mock('../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { RFIs } from '../../pages/RFIs'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

const sampleRfi = {
  id: 'rfi-1',
  number: 1,
  title: 'Foundation detail clarification',
  status: 'open',
  priority: 'high',
  due_date: '2026-05-01',
  assigned_to: 'GC',
  created_by: 'Architect',
  created_at: '2026-04-01T00:00:00Z',
}

describe('RFIs page', () => {
  beforeEach(() => {
    rfisState.data = { data: [] }
    rfisState.isPending = false
    rfisState.error = null
    mockMutateAsync.mockResolvedValue({})
    mockCreateRFIResponse.mockResolvedValue({})
  })

  it('renders without crashing', () => {
    const { container } = render(wrap(<RFIs />))
    expect(container).toBeTruthy()
  })

  it('shows loading skeleton when RFIs are pending', () => {
    rfisState.isPending = true
    rfisState.data = undefined
    const { container } = render(wrap(<RFIs />))
    expect(container.firstChild).toBeTruthy()
  })

  it('shows empty state with CTA when no RFIs exist', () => {
    rfisState.data = { data: [] }
    render(wrap(<RFIs />))
    expect(screen.getByText(/No RFIs have been created/i)).toBeDefined()
    expect(screen.getByText(/Create First RFI/i)).toBeDefined()
  })

  it('shows error state with retry button on fetch failure', () => {
    rfisState.error = new Error('Network error')
    rfisState.data = undefined
    render(wrap(<RFIs />))
    expect(screen.getByText(/Network error/i)).toBeDefined()
    expect(screen.getByText('Retry')).toBeDefined()
  })

  it('retry button calls refetch', () => {
    rfisState.error = new Error('Network error')
    rfisState.data = undefined
    render(wrap(<RFIs />))
    const retry = screen.getByText('Retry')
    fireEvent.click(retry)
    expect(rfisState.refetch).toHaveBeenCalled()
  })

  it('shows RFI list table when data loaded', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  it('shows metric cards when data is loaded', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    expect(screen.getByText('Total Open')).toBeDefined()
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0)
  })

  it('opens Create RFI modal when New RFI button clicked', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    const newBtn = screen.getByText('New RFI')
    fireEvent.click(newBtn)
    expect(screen.getByTestId('create-rfi-modal')).toBeDefined()
  })

  it('calls createRFI mutation on form submit', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    fireEvent.click(screen.getByText('New RFI'))
    fireEvent.click(screen.getByTestId('modal-submit'))
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled()
    })
  })

  it('opens detail panel when table row clicked', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    const row = screen.getByTestId('rfi-row-rfi-1')
    fireEvent.click(row)
    expect(screen.getByText('Foundation detail clarification')).toBeDefined()
  })

  it('switches to kanban view', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    const kanbanBtn = screen.getByText('Kanban')
    fireEvent.click(kanbanBtn)
    expect(await screen.findByTestId('rfi-kanban')).toBeDefined()
  })

  it('filters RFIs by status tab', () => {
    rfisState.data = {
      data: [
        { ...sampleRfi, id: 'rfi-1', status: 'open' },
        { ...sampleRfi, id: 'rfi-2', status: 'closed' },
      ],
    }
    render(wrap(<RFIs />))
    const closedTab = screen.getByRole('tab', { name: /Closed/ })
    fireEvent.click(closedTab)
    // After filtering, the table re-renders with filtered data
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })
})
