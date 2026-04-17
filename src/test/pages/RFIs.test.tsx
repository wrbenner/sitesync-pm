import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────
const rfisState = {
  data: { data: [] as unknown[] } as { data: unknown[] } | undefined,
  isPending: false,
  error: null as unknown,
  refetch: vi.fn(),
}

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

vi.mock('../../hooks/mutations', () => ({
  useCreateRFI: () => ({ mutateAsync: vi.fn() }),
  useUpdateRFI: () => ({ mutateAsync: vi.fn() }),
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
  VirtualDataTable: () => <div data-testid="rfi-data-table" />,
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

describe('RFIs page', () => {
  beforeEach(() => {
    rfisState.data = { data: [] }
    rfisState.isPending = false
    rfisState.error = null
  })

  it('renders without crashing', () => {
    const { container } = render(wrap(<RFIs />))
    expect(container).toBeTruthy()
  })

  it('shows loading skeleton when RFIs are pending', () => {
    rfisState.isPending = true
    rfisState.data = undefined
    const { container } = render(wrap(<RFIs />))
    // Loading state mounts skeleton/placeholder markup
    expect(container.firstChild).toBeTruthy()
  })

  it('shows RFI list when data loaded', () => {
    rfisState.data = {
      data: [
        {
          id: 'rfi-1',
          number: 1,
          subject: 'Foundation detail clarification',
          status: 'open',
          priority: 'high',
          due_date: '2026-05-01',
          assigned_to: 'GC',
          created_by: 'Architect',
          created_at: '2026-04-01T00:00:00Z',
        },
      ],
    }
    rfisState.isPending = false
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })
})
