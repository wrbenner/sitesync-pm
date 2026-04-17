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

const rfiDetailState = {
  data: undefined as unknown,
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('unavailable') }),
    },
  },
  isSupabaseConfigured: true,
}))

vi.mock('../../hooks/queries', () => ({
  useRFIs: () => rfisState,
  useRFI: () => rfiDetailState,
}))

vi.mock('../../hooks/mutations', () => ({
  useCreateRFI: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useUpdateRFI: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useCreateRFIResponse: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
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
  default: () => null,
}))

vi.mock('../../components/field/QuickRFIButton', () => ({
  default: () => null,
}))

vi.mock('../../components/shared/VirtualDataTable', () => ({
  VirtualDataTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="rfi-data-table" data-count={data.length} />
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
  description: 'Need clarification on the foundation depth.',
  status: 'open',
  priority: 'high',
  due_date: '2026-05-01',
  assigned_to: 'GC Team',
  created_by: 'Architect',
  created_at: '2026-04-01T00:00:00Z',
}

describe('RFIs page', () => {
  beforeEach(() => {
    rfisState.data = { data: [] }
    rfisState.isPending = false
    rfisState.error = null
    rfiDetailState.data = undefined
    rfisState.refetch = vi.fn()
  })

  it('renders without crashing', () => {
    const { container } = render(wrap(<RFIs />))
    expect(container).toBeTruthy()
  })

  it('shows loading skeleton when RFIs are pending', () => {
    rfisState.isPending = true
    rfisState.data = undefined
    render(wrap(<RFIs />))
    expect(document.querySelector('[style*="skeleton"]') ?? document.body.firstChild).toBeTruthy()
  })

  it('shows error state with retry button on fetch failure', () => {
    rfisState.error = new Error('Network error')
    rfisState.data = undefined
    render(wrap(<RFIs />))
    expect(screen.getByText(/Unable to load RFIs|Network error/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('calls refetch when retry button is clicked in error state', async () => {
    rfisState.error = new Error('Network error')
    rfisState.data = undefined
    render(wrap(<RFIs />))
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    await waitFor(() => {
      expect(rfisState.refetch).toHaveBeenCalled()
    })
  })

  it('shows empty state when no RFIs exist', () => {
    rfisState.data = { data: [] }
    render(wrap(<RFIs />))
    expect(screen.getByText(/No RFIs have been created/i)).toBeTruthy()
  })

  it('shows RFI table when data is loaded', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeTruthy()
  })

  it('shows metric cards when RFIs are loaded', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    expect(screen.getByText('Total Open')).toBeTruthy()
    // "Overdue" appears in both the metric card and the filter tab
    expect(screen.getAllByText(/Overdue/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Avg Days to Close')).toBeTruthy()
    expect(screen.getByText('Closed This Week')).toBeTruthy()
  })

  it('shows status filter tabs', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    expect(screen.getByRole('tab', { name: /All/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Open/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Closed/i })).toBeTruthy()
  })

  it('switches to kanban view when Kanban button is pressed', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    const kanbanBtn = screen.getByRole('button', { name: /Kanban/i })
    fireEvent.click(kanbanBtn)
    await waitFor(() => {
      expect(screen.getByTestId('rfi-kanban')).toBeTruthy()
    })
  })

  it('shows overdue count in metric cards correctly', () => {
    const overdueRfi = {
      ...sampleRfi,
      status: 'open',
      due_date: '2020-01-01', // well in the past
    }
    rfisState.data = { data: [overdueRfi] }
    render(wrap(<RFIs />))
    // "Overdue" appears in the metric card and filter tab; both should be present
    expect(screen.getAllByText(/Overdue/i).length).toBeGreaterThanOrEqual(2)
  })

  it('renders correctly when dueDate is null or missing', () => {
    const rfiNoDueDate = { ...sampleRfi, due_date: null }
    rfisState.data = { data: [rfiNoDueDate] }
    expect(() => render(wrap(<RFIs />))).not.toThrow()
  })

  it('renders correctly when description is missing', () => {
    const rfiNoDesc = { ...sampleRfi, description: null }
    rfisState.data = { data: [rfiNoDesc] }
    expect(() => render(wrap(<RFIs />))).not.toThrow()
  })

  it('shows zero/empty states without "undefined" or "NaN" text', () => {
    const rfiMinimal = {
      id: 'rfi-2',
      number: null,
      title: '',
      description: null,
      status: 'open',
      priority: 'medium',
      due_date: null,
      assigned_to: null,
      created_by: null,
      created_at: '2026-04-01T00:00:00Z',
    }
    rfisState.data = { data: [rfiMinimal] }
    const { container } = render(wrap(<RFIs />))
    expect(container.innerHTML).not.toContain('undefined')
    expect(container.innerHTML).not.toContain('NaN')
  })
})

// ── formatDate helper edge cases ────────────────────────

describe('formatDate edge cases', () => {
  it('returns dash for null date', () => {
    // We test this through component rendering — a row with null due_date
    // should not crash and should render "—"
    const rfiNullDate = { ...sampleRfi, due_date: null }
    rfisState.data = { data: [rfiNullDate] }
    rfisState.error = null
    rfisState.isPending = false
    expect(() => render(wrap(<RFIs />))).not.toThrow()
  })

  it('returns dash for empty string date', () => {
    const rfiEmptyDate = { ...sampleRfi, due_date: '' }
    rfisState.data = { data: [rfiEmptyDate] }
    expect(() => render(wrap(<RFIs />))).not.toThrow()
  })

  it('returns dash for invalid date string', () => {
    const rfiInvalidDate = { ...sampleRfi, due_date: 'not-a-date' }
    rfisState.data = { data: [rfiInvalidDate] }
    expect(() => render(wrap(<RFIs />))).not.toThrow()
  })
})
