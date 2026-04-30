import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────
const permissionsState = {
  hasPermission: (p?: string): boolean => { void p; return true },
  role: 'project_manager' as string,
}
const punchItemsState = {
  data: { data: [] as unknown[] } as { data: unknown[] } | undefined,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
  fetchStatus: 'idle' as 'idle' | 'fetching' | 'paused',
}

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'mock://url' } })),
      })),
    },
  },
  isSupabaseConfigured: true,
}))

vi.mock('../../../hooks/queries', () => ({
  usePunchItems: () => punchItemsState,
  useProject: () => ({ data: { id: 'test-project-id', name: 'Test Project' } }),
}))

vi.mock('../../../hooks/mutations', () => ({
  useCreatePunchItem: () => ({ mutateAsync: vi.fn() }),
  useUpdatePunchItem: () => ({ mutateAsync: vi.fn() }),
  useDeletePunchItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../../../hooks/useProjectId', () => ({
  useProjectId: () => 'test-project-id',
}))

vi.mock('../../../hooks/useRealtimeInvalidation', () => ({
  useRealtimeInvalidation: () => undefined,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'pm@example.com', user_metadata: { full_name: 'PM User' } } }),
}))

vi.mock('../../../hooks/usePhotoAnalysis', () => ({
  usePhotoAnalysis: () => ({ analyzePhoto: vi.fn(), state: 'idle', result: null, error: null }),
}))

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissionsState,
}))

vi.mock('../../../stores/copilotStore', () => ({
  useCopilotStore: () => ({ setPageContext: vi.fn() }),
}))

vi.mock('../../../stores/punchListStore', () => ({
  usePunchListStore: (selector?: (s: unknown) => unknown) => {
    const state = { comments: {}, loadComments: vi.fn(), addComment: vi.fn() }
    return selector ? selector(state) : state
  },
}))

// Heavy children — replaced with stubs so the page mounts without their deps.
vi.mock('../PunchListDetail', () => ({
  PunchListDetail: () => null,
}))
vi.mock('../PunchListPlanView', () => ({
  PunchListPlanView: () => <div data-testid="plan-view" />,
}))
vi.mock('../../../components/punch-list/PunchItemCreateWizard', () => ({
  default: () => null,
}))

// PermissionGate — respect the mock so we can test the disabled fallback path.
vi.mock('../../../components/auth/PermissionGate', () => ({
  PermissionGate: ({
    permission,
    fallback,
    children,
  }: {
    permission: string
    fallback?: React.ReactNode
    children: React.ReactNode
  }) =>
    permissionsState.hasPermission(permission)
      ? <>{children}</>
      : <>{fallback ?? null}</>,
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
    permissionsState.role = 'project_manager'
    punchItemsState.data = { data: [] }
    punchItemsState.isLoading = false
    punchItemsState.error = null
    punchItemsState.fetchStatus = 'idle'
  })

  it('renders without crashing', () => {
    const { container } = render(wrap(<PunchList />))
    expect(container).toBeTruthy()
  })

  it('shows loading state', () => {
    punchItemsState.isLoading = true
    punchItemsState.fetchStatus = 'fetching'
    const { container } = render(wrap(<PunchList />))
    expect(container.textContent).toMatch(/loading/i)
  })

  it('shows empty state when no items', () => {
    punchItemsState.data = { data: [] }
    render(wrap(<PunchList />))
    expect(screen.getByText(/no punch items yet/i)).toBeDefined()
  })

  it('hides create button for viewers without permission', () => {
    permissionsState.hasPermission = () => false
    punchItemsState.data = { data: [] }
    render(wrap(<PunchList />))
    // The fallback is a disabled "New Punch" placeholder — no enabled
    // create-action button should be reachable for viewers.
    const newPunchBtns = screen.queryAllByRole('button', { name: /new punch/i })
    expect(newPunchBtns.every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('shows create button when user has permission', () => {
    permissionsState.hasPermission = () => true
    punchItemsState.data = { data: [] }
    render(wrap(<PunchList />))
    const newPunchBtns = screen.queryAllByRole('button', { name: /new punch/i })
    expect(newPunchBtns.length).toBeGreaterThan(0)
    expect(newPunchBtns.some((b) => !(b as HTMLButtonElement).disabled)).toBe(true)
  })
})
