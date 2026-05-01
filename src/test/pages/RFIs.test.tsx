import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── Shared mutable state for query hooks ─────────────────
const rfisState = {
  data: { data: [] as unknown[] } as { data: unknown[] } | undefined,
  isPending: false,
  error: null as unknown,
  refetch: vi.fn(),
}

// ── Mocks ─────────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
  isSupabaseConfigured: true,
}))

vi.mock('../../hooks/queries', () => ({
  useRFIs: () => rfisState,
  useRFI: () => ({ data: null }),
  useProject: () => ({ data: { id: 'test-project', name: 'Test Project' } }),
}))

const mockMutateAsync = vi.fn().mockResolvedValue({})

vi.mock('../../hooks/mutations', () => ({
  useCreateRFI: () => ({ mutateAsync: mockMutateAsync }),
  useUpdateRFI: () => ({ mutateAsync: mockMutateAsync }),
  useDeleteRFI: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateRFIResponse: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
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

vi.mock('../../components/rfis/RFICreateWizard', () => ({
  default: ({ open, onSubmit }: { open: boolean; onSubmit: (d: unknown) => void | Promise<void> }) =>
    open ? (
      <div data-testid="create-rfi-modal">
        <button onClick={() => onSubmit({ title: 'Test RFI', priority: 'medium' })}>Submit</button>
        <button onClick={() => {}}>Cancel</button>
      </div>
    ) : null,
}))

vi.mock('../../components/forms/EditableField', () => ({
  EditableDetailField: () => null,
}))

vi.mock('../../components/field/QuickRFIButton', () => ({
  default: () => null,
}))

vi.mock('../../components/shared/VirtualDataTable', () => ({
  VirtualDataTable: () => <div data-testid="rfi-data-table" />,
}))

// Capture onMoveItem so tests can trigger kanban drag-and-drop
let capturedOnMoveItem: ((id: string | number, from: string, to: string) => void) | undefined

vi.mock('../../components/shared/KanbanBoard', () => ({
  KanbanBoard: (props: { onMoveItem?: (id: string | number, from: string, to: string) => void }) => {
    capturedOnMoveItem = props.onMoveItem
    return <div data-testid="rfi-kanban" />
  },
}))

vi.mock('../../components/shared/PresenceAvatars', () => ({
  PresenceAvatars: () => null,
}))

vi.mock('../../components/shared/BulkActionBar', () => ({
  BulkActionBar: () => null,
}))

vi.mock('../../components/shared/ExportButton', () => ({
  ExportButton: () => null,
}))

vi.mock('../../lib/exportXlsx', () => ({
  exportRFILogXlsx: vi.fn(),
}))

vi.mock('../../components/ai/AIAnnotation', () => ({
  AIAnnotationIndicator: () => null,
}))

vi.mock('../../components/ai/PredictiveAlert', () => ({
  PredictiveAlertBanner: () => null,
  PageInsightBanners: () => null,
}))

vi.mock('../../components/ui/EditingLockBanner', () => ({
  EditingLockBanner: () => null,
}))

// Render children unconditionally — auth is not relevant to these tests
vi.mock('../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { RFIs } from '../../pages/RFIs'

// ── Test helpers ───────────────────────────────────────────

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

// ── Test Suite ─────────────────────────────────────────────

describe('RFIs page', () => {
  beforeEach(() => {
    rfisState.data = { data: [] }
    rfisState.isPending = false
    rfisState.error = null
    rfisState.refetch = vi.fn()
    mockMutateAsync.mockResolvedValue({})
  })

  // ── Render states ────────────────────────────────────────

  it('renders without crashing', () => {
    const { container } = render(wrap(<RFIs />))
    expect(container).toBeTruthy()
  })

  it('shows loading skeleton when RFIs are pending', () => {
    rfisState.isPending = true
    rfisState.data = undefined
    const { container } = render(wrap(<RFIs />))
    // skeleton has no data-testid; verify it renders something in the container
    expect(container.firstChild).toBeTruthy()
    expect(screen.queryByTestId('rfi-data-table')).toBeNull()
  })

  it('shows error state with retry button on fetch failure', () => {
    rfisState.isPending = false
    rfisState.error = new Error('Network error')
    rfisState.data = undefined
    render(wrap(<RFIs />))
    expect(screen.getAllByText(/Unable to load RFIs|Network error/i).length).toBeGreaterThan(0)
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    expect(retryBtn).toBeTruthy()
    fireEvent.click(retryBtn)
    expect(rfisState.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows empty state with CTA when no RFIs exist', () => {
    rfisState.data = { data: [] }
    render(wrap(<RFIs />))
    // The empty-state copy ("No RFIs yet on this project") is rendered
    // *inside* VirtualDataTable's `emptyMessage` prop — this test mocks
    // VirtualDataTable to a bare div, so we don't see the copy here.
    // What we *can* verify is the user-facing affordances: the data-table
    // is mounted and the "+ New RFI" CTA in the header is reachable so
    // a user with zero RFIs can still create one.
    expect(screen.getByTestId('rfi-data-table')).toBeTruthy()
    expect(screen.getByTestId('create-rfi-button')).toBeTruthy()
  })

  it('shows data table when RFIs are loaded', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeTruthy()
  })

  // ── Metric cards ─────────────────────────────────────────

  it('renders metric cards when data is loaded', () => {
    rfisState.data = {
      data: [
        { ...sampleRfi, status: 'open' },
        { ...sampleRfi, id: 'rfi-2', number: 2, status: 'closed', due_date: '2026-03-01' },
      ],
    }
    render(wrap(<RFIs />))
    expect(screen.getByText('Total Open')).toBeTruthy()
    expect(screen.getByText('Avg Days to Close')).toBeTruthy()
    expect(screen.getByText('Closed This Week')).toBeTruthy()
  })

  // ── Status filter tabs ────────────────────────────────────

  it('renders status filter tabs', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    // Filter tabs have role="tab" not role="button"
    expect(screen.getByRole('tab', { name: /^All/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^Open/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^Closed/i })).toBeTruthy()
  })

  // The Kanban view was removed from the RFIs page — the dense sortable
  // table is the canonical view now. Three tests that exercised the
  // kanban toggle / drag-and-drop were retired with the feature.

  // ── Create RFI ────────────────────────────────────────────

  it('opens create modal when New RFI is clicked', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    // The "New RFI" button has aria-label="Create new RFI" and a stable
    // data-testid — prefer the test-id for resilience.
    const newBtn = screen.getByTestId('create-rfi-button')
    fireEvent.click(newBtn)
    expect(screen.getByTestId('create-rfi-modal')).toBeTruthy()
  })

  it('calls createRFI mutation when modal is submitted', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    fireEvent.click(screen.getByTestId('create-rfi-button'))
    fireEvent.click(screen.getByRole('button', { name: /^Submit$/i }))
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'test-project-id' }),
      )
    })
  })

  // ── Empty state CTA ───────────────────────────────────────

  it('opens create modal from empty state via the header New RFI button', () => {
    // The empty state shows guidance copy; the action affordance is
    // the persistent "+ New RFI" button in the header (data-testid:
    // create-rfi-button), not a separate "Create first RFI" button.
    rfisState.data = { data: [] }
    render(wrap(<RFIs />))
    fireEvent.click(screen.getByTestId('create-rfi-button'))
    expect(screen.getByTestId('create-rfi-modal')).toBeTruthy()
  })
})

// ── formatDate / isOverdue unit tests ─────────────────────

// Import the helpers by re-implementing them here (they're module-local in RFIs.tsx)
// We test the observable UI behavior instead of the private function directly.

describe('RFI utility behaviour (observable via rendering)', () => {
  beforeEach(() => {
    rfisState.isPending = false
    rfisState.error = null
    rfisState.refetch = vi.fn()
  })

  it('does not show "Invalid Date" for RFIs without a due_date', () => {
    rfisState.data = {
      data: [{ ...sampleRfi, due_date: null }],
    }
    const { container } = render(wrap(<RFIs />))
    expect(container.textContent).not.toContain('Invalid Date')
  })

  it('does not show "Invalid Date" for RFIs with empty due_date string', () => {
    rfisState.data = {
      data: [{ ...sampleRfi, due_date: '' }],
    }
    const { container } = render(wrap(<RFIs />))
    expect(container.textContent).not.toContain('Invalid Date')
  })
})

// ── rfiSchema validation unit tests ──────────────────────

import { rfiSchema } from '../../components/forms/schemas'

describe('rfiSchema validation', () => {
  it('accepts a valid RFI payload', () => {
    const result = rfiSchema.safeParse({
      title: 'Structural conflict on grid B3',
      description: 'The structural drawing conflicts with mechanical layout.',
      priority: 'high',
      assigned_to: 'Architect',
      spec_section: '05 12 00',
      drawing_reference: 'S-201',
      due_date: '2026-05-15',
      related_submittal_id: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects payload missing required title', () => {
    const result = rfiSchema.safeParse({
      title: '',
      priority: 'medium',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const titleError = result.error.issues.find((i) => i.path.includes('title'))
      expect(titleError).toBeTruthy()
    }
  })

  it('rejects title exceeding 200 characters', () => {
    const result = rfiSchema.safeParse({
      title: 'A'.repeat(201),
      priority: 'medium',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const titleError = result.error.issues.find((i) => i.path.includes('title'))
      expect(titleError?.message).toMatch(/200/i)
    }
  })

  it('rejects invalid priority value', () => {
    const result = rfiSchema.safeParse({ title: 'Test', priority: 'extreme' })
    expect(result.success).toBe(false)
  })

  it('applies defaults for optional fields', () => {
    const result = rfiSchema.safeParse({ title: 'Test RFI' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('medium')
      expect(result.data.description).toBe('')
    }
  })
})
