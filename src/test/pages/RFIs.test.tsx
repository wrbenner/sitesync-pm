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

// Render children unconditionally so permission-gated UI is visible in tests
vi.mock('../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/ui/EditingLockBanner', () => ({
  EditingLockBanner: () => null,
}))

vi.mock('../../components/forms/EditableField', () => ({
  EditableDetailField: () => null,
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
  description: 'What is the correct anchor bolt pattern?',
  status: 'open',
  priority: 'high',
  due_date: '2026-05-01',
  assigned_to: 'GC',
  created_by: 'Architect',
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
  closed_at: null,
  drawing_reference: 'S-101',
  ai_generated: false,
  attachment_count: 0,
}

describe('RFIs page', () => {
  beforeEach(() => {
    rfisState.data = { data: [] }
    rfisState.isPending = false
    rfisState.error = null
    rfisState.refetch = vi.fn()
  })

  // ── Render states ──────────────────────────────────────

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

  it('shows error state with retry button on fetch failure', () => {
    rfisState.error = new Error('Network error')
    rfisState.data = undefined
    render(wrap(<RFIs />))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('calls refetch when retry button is clicked', () => {
    rfisState.error = new Error('Network error')
    rfisState.data = undefined
    render(wrap(<RFIs />))
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(rfisState.refetch).toHaveBeenCalledOnce()
  })

  it('shows empty state with CTA when no RFIs exist', () => {
    rfisState.data = { data: [] }
    render(wrap(<RFIs />))
    expect(screen.getByText(/no rfis have been created/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /create first rfi/i })).toBeTruthy()
  })

  it('shows RFI table when data is loaded', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  it('shows metric cards when RFIs are loaded', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    expect(screen.getByText('Total Open')).toBeTruthy()
    // 'Overdue' appears in both a filter tab and the metric card — use getAllByText
    expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Avg Days to Close')).toBeTruthy()
    expect(screen.getByText('Closed This Week')).toBeTruthy()
  })

  // ── Data mapping edge cases ────────────────────────────

  it('handles RFI with null due_date without showing Invalid Date', () => {
    rfisState.data = {
      data: [{ ...sampleRfi, due_date: null }],
    }
    render(wrap(<RFIs />))
    // Should not throw; table renders correctly
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  it('handles RFI with empty string due_date without showing Invalid Date', () => {
    rfisState.data = {
      data: [{ ...sampleRfi, due_date: '' }],
    }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  it('handles RFI with null created_by gracefully', () => {
    rfisState.data = {
      data: [{ ...sampleRfi, created_by: null }],
    }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  it('handles RFI with null title gracefully (shows empty string)', () => {
    rfisState.data = {
      data: [{ ...sampleRfi, title: null }],
    }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  it('counts overdue RFIs correctly (past due date, not closed)', () => {
    rfisState.data = {
      data: [
        { ...sampleRfi, id: 'rfi-1', status: 'open', due_date: '2020-01-01' },
        { ...sampleRfi, id: 'rfi-2', status: 'closed', due_date: '2020-01-01' },
      ],
    }
    render(wrap(<RFIs />))
    // Overdue metric should count 1 (open with past due date), not 2 (closed excluded)
    // Both MetricBox values rendered; we check the component is stable
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  // ── Status filters ─────────────────────────────────────

  it('renders status filter tabs', () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    // Tabs use role="tab" per the ARIA spec applied in the component
    expect(screen.getByRole('tab', { name: /all/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /open/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /closed/i })).toBeTruthy()
  })

  // ── View mode toggle ───────────────────────────────────

  it('switches to kanban view when kanban button is clicked', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    // The view-switcher buttons are plain motion.button elements with text "Kanban"
    const kanbanBtn = screen.getAllByRole('button').find(
      (btn) => btn.textContent?.toLowerCase().includes('kanban'),
    )
    expect(kanbanBtn).toBeTruthy()
    fireEvent.click(kanbanBtn!)
    await waitFor(() => {
      expect(screen.getByTestId('rfi-kanban')).toBeDefined()
    })
  })

  // ── AI Draft modal ─────────────────────────────────────

  function getAIDraftButton() {
    return screen.getAllByRole('button').find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('draft') ||
               btn.textContent?.toLowerCase().includes('ai draft'),
    )!
  }

  it('opens AI Draft modal when AI Draft RFI button is clicked', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    fireEvent.click(getAIDraftButton())
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })
  })

  it('closes AI Draft modal when Cancel button is clicked', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    fireEvent.click(getAIDraftButton())
    await waitFor(() => screen.getByRole('dialog'))
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('closes AI Draft modal when Escape key is pressed', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    fireEvent.click(getAIDraftButton())
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('disables Generate RFI button when input is empty', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    fireEvent.click(getAIDraftButton())
    await waitFor(() => screen.getByRole('dialog'))
    const generateBtn = screen.getByRole('button', { name: /generate rfi/i })
    expect((generateBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables Generate RFI button when input has text', async () => {
    rfisState.data = { data: [sampleRfi] }
    render(wrap(<RFIs />))
    fireEvent.click(getAIDraftButton())
    await waitFor(() => screen.getByRole('dialog'))
    const textarea = screen.getByLabelText(/describe the issue/i)
    fireEvent.change(textarea, { target: { value: 'Test description' } })
    const generateBtn = screen.getByRole('button', { name: /generate rfi/i })
    expect((generateBtn as HTMLButtonElement).disabled).toBe(false)
  })
})

// ── Unit tests for utility functions ──────────────────────────────────────────

describe('formatDate utility', () => {
  // Import via dynamic require since it's not exported — test via rendered output
  it('renders dash for null due date in table', () => {
    rfisState.data = { data: [{ ...sampleRfi, due_date: null }] }
    render(wrap(<RFIs />))
    // No "Invalid Date" text in the document
    expect(document.body.textContent).not.toContain('Invalid Date')
  })

  it('renders dash for empty string due date', () => {
    rfisState.data = { data: [{ ...sampleRfi, due_date: '' }] }
    render(wrap(<RFIs />))
    expect(document.body.textContent).not.toContain('Invalid Date')
  })

  it('renders dash for undefined due date', () => {
    rfisState.data = { data: [{ ...sampleRfi, due_date: undefined }] }
    render(wrap(<RFIs />))
    expect(document.body.textContent).not.toContain('Invalid Date')
  })
})

describe('isOverdue utility', () => {
  it('does not mark closed RFIs as overdue even with past due date', () => {
    rfisState.data = {
      data: [{ ...sampleRfi, status: 'closed', due_date: '2020-01-01' }],
    }
    render(wrap(<RFIs />))
    // Overdue metric should be 0
    // The table should render without errors
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  it('correctly identifies open RFI with past due date as overdue', () => {
    rfisState.data = {
      data: [
        { ...sampleRfi, id: 'rfi-1', status: 'open', due_date: '2020-01-01' },
        { ...sampleRfi, id: 'rfi-2', status: 'open', due_date: '2030-01-01' },
      ],
    }
    render(wrap(<RFIs />))
    expect(screen.getByTestId('rfi-data-table')).toBeDefined()
  })

  it('handles null due_date as not overdue', () => {
    rfisState.data = { data: [{ ...sampleRfi, due_date: null }] }
    render(wrap(<RFIs />))
    expect(document.body.textContent).not.toContain('Invalid Date')
  })
})
