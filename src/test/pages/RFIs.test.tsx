import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────
const rfisState = {
  data: { data: [] as unknown[] } as { data: unknown[] } | undefined,
  isPending: false,
  error: null as unknown,
  refetch: vi.fn(),
}

const mockMutateAsync = vi.fn()

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isAtLeast: () => true,
    canAccessModule: () => true,
    loading: false,
    role: 'admin',
  }),
}))

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(actual.motion, {
      get: (target, prop: string) => {
        if (prop in target) return target[prop as keyof typeof target]
        const Tag = prop as keyof JSX.IntrinsicElements
        return React.forwardRef((props: React.HTMLAttributes<HTMLElement>, ref: React.Ref<HTMLElement>) =>
          React.createElement(Tag, { ...props, ref })
        )
      },
    }),
  }
})

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
  useCreateRFI: () => ({ mutateAsync: mockMutateAsync }),
  useUpdateRFI: () => ({ mutateAsync: mockMutateAsync }),
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
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-rfi-modal" /> : null,
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

const sampleRfis = [
  {
    id: 'rfi-1',
    number: 1,
    title: 'Foundation detail clarification',
    status: 'open',
    priority: 'high',
    due_date: '2026-05-01',
    assigned_to: 'GC',
    created_by: 'Architect',
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'rfi-2',
    number: 2,
    title: 'Structural beam conflict',
    status: 'closed',
    priority: 'medium',
    due_date: '2026-04-10',
    assigned_to: 'Architect',
    created_by: 'GC',
    created_at: '2026-03-15T00:00:00Z',
    closed_at: '2026-04-05T00:00:00Z',
  },
  {
    id: 'rfi-3',
    number: 3,
    title: 'Electrical conduit routing',
    status: 'in_review',
    priority: 'critical',
    due_date: '2025-03-01',
    assigned_to: 'Engineer',
    created_by: 'Sub',
    created_at: '2026-04-02T00:00:00Z',
  },
]

describe('RFIs page', () => {
  beforeEach(() => {
    rfisState.data = { data: [] }
    rfisState.isPending = false
    rfisState.error = null
    mockMutateAsync.mockReset()
  })

  // ── Render states ────────────────────────────────────

  it('renders without crashing', () => {
    const { container } = render(wrap(<RFIs />))
    expect(container).toBeTruthy()
  })

  it('shows loading skeleton when RFIs are pending', () => {
    rfisState.isPending = true
    rfisState.data = undefined
    render(wrap(<RFIs />))
    // Skeleton: subtitle says Loading...
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('shows error state with retry button when fetch fails', () => {
    rfisState.isPending = false
    rfisState.data = undefined
    rfisState.error = new Error('Network error')
    render(wrap(<RFIs />))
    expect(screen.getByText(/Unable to load RFIs|Network error/)).toBeDefined()
    const retryBtn = screen.getByRole('button', { name: /Retry/i })
    expect(retryBtn).toBeDefined()
  })

  it('calls refetch when retry button is clicked', () => {
    rfisState.isPending = false
    rfisState.data = undefined
    rfisState.error = new Error('Network error')
    render(wrap(<RFIs />))
    const retryBtn = screen.getByRole('button', { name: /Retry/i })
    fireEvent.click(retryBtn)
    expect(rfisState.refetch).toHaveBeenCalled()
  })

  it('shows empty state with CTA when no RFIs exist', () => {
    rfisState.data = { data: [] }
    render(wrap(<RFIs />))
    expect(screen.getByText(/No RFIs have been created/)).toBeDefined()
    expect(screen.getByText(/Create First RFI/)).toBeDefined()
  })

  it('shows data table when RFIs are loaded', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  // ── Metrics ──────────────────────────────────────────

  it('displays correct metric: total open', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    // 2 non-closed RFIs: rfi-1 (open) and rfi-3 (in_review)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows overdue count in page subtitle', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    // rfi-3 has due_date in the past (2025-03-01) and status in_review
    // subtitle: "2 open · 1 overdue"
    const subtitle = screen.getAllByText(/overdue/i)
    expect(subtitle.length).toBeGreaterThan(0)
  })

  // ── Status filter tabs ───────────────────────────────

  it('renders status filter tabs', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    expect(screen.getByRole('tab', { name: /All/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /Open/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /Closed/i })).toBeDefined()
  })

  it('All tab is selected by default', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const allTab = screen.getByRole('tab', { name: /All/i })
    expect(allTab.getAttribute('aria-selected')).toBe('true')
  })

  it('clicking a status tab changes selection', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const openTab = screen.getByRole('tab', { name: /^Open/i })
    fireEvent.click(openTab)
    // Re-query after re-render to avoid stale DOM ref
    expect(screen.getByRole('tab', { name: /^Open/i }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: /All/i }).getAttribute('aria-selected')).toBe('false')
  })

  // ── View mode toggle ─────────────────────────────────

  it('switches to kanban view when Kanban button is pressed', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const kanbanBtn = screen.getByRole('button', { name: /Kanban/i })
    fireEvent.click(kanbanBtn)
    expect(screen.getByTestId('rfi-kanban')).toBeDefined()
  })

  it('table button has aria-pressed=true by default', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const tableBtn = screen.getByRole('button', { name: /Table/i })
    expect(tableBtn.getAttribute('aria-pressed')).toBe('true')
  })

  // ── Create RFI ───────────────────────────────────────

  it('opens create modal when New RFI button is clicked', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const newBtn = screen.getByRole('button', { name: /Create new Request for Information/i })
    fireEvent.click(newBtn)
    expect(screen.getByTestId('create-rfi-modal')).toBeDefined()
  })

  it('opens create modal from empty state CTA', () => {
    rfisState.data = { data: [] }
    render(wrap(<RFIs />))
    const cta = screen.getByText('Create First RFI')
    fireEvent.click(cta)
    expect(screen.getByTestId('create-rfi-modal')).toBeDefined()
  })

  // ── Date formatting edge cases ───────────────────────

  it('formatDate returns — for empty string (no Invalid Date shown)', () => {
    // Render with an RFI that has no due_date so formatDate('') would be called
    rfisState.data = {
      data: [{
        id: 'rfi-noduedate',
        number: 4,
        title: 'No due date RFI',
        status: 'open',
        priority: 'low',
        due_date: '',
        assigned_to: '',
        created_by: '',
        created_at: '2026-04-01T00:00:00Z',
      }],
    }
    render(wrap(<RFIs />))
    // "Invalid Date" must NOT appear anywhere in the page
    expect(screen.queryByText(/Invalid Date/i)).toBeNull()
  })

  // ── AI Draft modal ───────────────────────────────────

  it('opens AI Draft modal when AI Draft RFI button is clicked', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const aiBtn = screen.getByRole('button', { name: /Draft an RFI with AI assistance/i })
    fireEvent.click(aiBtn)
    expect(screen.getByRole('dialog', { name: /AI Draft RFI/i })).toBeDefined()
  })

  it('AI Draft modal Generate button is disabled when input is empty', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const aiBtn = screen.getByRole('button', { name: /Draft an RFI with AI assistance/i })
    fireEvent.click(aiBtn)
    const dialog = screen.getByRole('dialog', { name: /AI Draft RFI/i })
    const generateBtn = within(dialog).getByRole('button', { name: /Generate RFI/i })
    expect(generateBtn).toHaveProperty('disabled', true)
  })

  it('AI Draft modal Generate button enables when text is entered', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const aiBtn = screen.getByRole('button', { name: /Draft an RFI with AI assistance/i })
    fireEvent.click(aiBtn)
    const textarea = screen.getByLabelText(/Describe the issue in your own words/i)
    fireEvent.change(textarea, { target: { value: 'Beam depth conflict on grid C' } })
    // Re-query after state update to avoid stale ref
    const generateBtn = screen.getByRole('button', { name: /Generate RFI/i })
    expect(generateBtn).toHaveProperty('disabled', false)
  })

  it('AI Draft modal label is associated with textarea', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const aiBtn = screen.getByRole('button', { name: /Draft an RFI with AI assistance/i })
    fireEvent.click(aiBtn)
    const textarea = screen.getByLabelText(/Describe the issue in your own words/i)
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('AI Draft modal closes when Cancel is clicked', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const aiBtn = screen.getByRole('button', { name: /Draft an RFI with AI assistance/i })
    fireEvent.click(aiBtn)
    expect(screen.getByRole('dialog', { name: /AI Draft RFI/i })).toBeDefined()
    const dialog = screen.getByRole('dialog', { name: /AI Draft RFI/i })
    const cancelBtn = within(dialog).getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn)
    expect(screen.queryByRole('dialog', { name: /AI Draft RFI/i })).toBeNull()
  })

  it('AI Draft modal closes on Escape key', () => {
    rfisState.data = { data: sampleRfis }
    render(wrap(<RFIs />))
    const aiBtn = screen.getByRole('button', { name: /Draft an RFI with AI assistance/i })
    fireEvent.click(aiBtn)
    expect(screen.getByRole('dialog', { name: /AI Draft RFI/i })).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /AI Draft RFI/i })).toBeNull()
  })
})
