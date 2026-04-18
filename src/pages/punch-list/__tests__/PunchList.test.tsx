import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────
const permissionsState = { hasPermission: (p?: string): boolean => { void p; return true } }
const punchItemsState = {
  data: { data: [] as unknown[] } as { data: unknown[] } | undefined,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
}

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
  isSupabaseConfigured: true,
}))

vi.mock('../../../hooks/queries', () => ({
  usePunchItems: () => punchItemsState,
  useProject: () => ({ data: { id: 'test-project-id', name: 'Test Project' } }),
}))

vi.mock('../../../components/shared/ExportButton', () => ({
  ExportButton: () => null,
}))

vi.mock('../../../lib/exportXlsx', () => ({
  exportPunchListXlsx: vi.fn(),
}))

vi.mock('../../../hooks/mutations', () => ({
  useCreatePunchItem: () => ({ mutateAsync: vi.fn() }),
  useUpdatePunchItem: () => ({ mutateAsync: vi.fn() }),
  useDeletePunchItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../../../hooks/useProjectId', () => ({
  useProjectId: () => 'test-project-id',
}))

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissionsState,
}))

vi.mock('../../../stores/copilotStore', () => ({
  useCopilotStore: () => ({ setPageContext: vi.fn() }),
}))

vi.mock('../../../data/aiAnnotations', () => ({
  getPredictiveAlertsForPage: () => [],
  getAnnotationsForEntity: () => [],
}))

vi.mock('../../../components/forms/CreatePunchItemModal', () => ({
  default: () => null,
}))

vi.mock('../PunchListTable', () => ({
  PunchListTable: () => <div data-testid="punch-list-table" />,
}))

vi.mock('../PunchListDetail', () => ({
  PunchListDetail: () => null,
}))

vi.mock('../PunchListBulk', () => ({
  PunchListBulk: () => null,
}))

vi.mock('../PunchListFilters', () => ({
  PunchListFilters: () => <div data-testid="punch-list-filters" />,
}))

// PermissionGate — real behavior: renders children only if permitted.
// Respect the permissions mock.
vi.mock('../../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ permission, children }: { permission: string; children: React.ReactNode }) =>
    permissionsState.hasPermission(permission) ? <>{children}</> : null,
}))

import { PunchList } from '../index'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PunchList', () => {
  beforeEach(() => {
    permissionsState.hasPermission = () => true
    punchItemsState.data = { data: [] }
    punchItemsState.isLoading = false
    punchItemsState.error = null
  })

  it('renders without crashing', () => {
    const { container } = render(wrap(<PunchList />))
    expect(container).toBeTruthy()
  })

  it('shows loading state', () => {
    punchItemsState.isLoading = true
    const { container } = render(wrap(<PunchList />))
    // Loading subtitle appears in PageContainer
    expect(container.textContent).toMatch(/loading/i)
  })

  it('shows empty state when no items', () => {
    punchItemsState.data = { data: [] }
    render(wrap(<PunchList />))
    expect(
      screen.getByText(/no punch list items/i)
    ).toBeDefined()
  })

  it('hides create button for viewers without permission', () => {
    permissionsState.hasPermission = () => false
    punchItemsState.data = { data: [] }
    render(wrap(<PunchList />))
    expect(screen.queryByRole('button', { name: /new item/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /add punch item/i })).not.toBeNull()
  })

  it('shows create button when user has permission', () => {
    permissionsState.hasPermission = () => true
    punchItemsState.data = { data: [] }
    render(wrap(<PunchList />))
    // New Item button appears in the header
    const buttons = screen.queryAllByRole('button', { name: /new item/i })
    expect(buttons.length).toBeGreaterThan(0)
  })
})
