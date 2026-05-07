// Phase 3 — SavedViewsSidebar component tests.
//
// jsdom + @testing-library cover the substantive UX guarantees a manual
// browser walkthrough would check:
//   1. Sidebar renders collapsed by default and expands on toggle.
//   2. Open/closed state persists to localStorage keyed by project id.
//   3. The 4 scope sections (My / Project / Company / Iris-Suggested) render.
//   4. Iris views render their seed names; non-iris scopes render empty
//      copy when no views exist.

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the saved views service so the hook returns deterministic data.
vi.mock('../../../services/submittalsSavedViews', () => ({
  submittalsSavedViewsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    seedIrisSuggested: vi.fn(),
  },
}))

// Mock PermissionGate to a pass-through so we don't need authStore wiring.
vi.mock('../../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { SavedViewsSidebar } from '../../../components/submittals/SavedViews/SavedViewsSidebar'
import { submittalsSavedViewsService } from '../../../services/submittalsSavedViews'

const PROJECT_ID = 'proj-test-1'
const STORAGE_KEY = `submittals:saved_views:open:${PROJECT_ID}`

const fakeViews = [
  {
    id: 'v-iris-1',
    project_id: PROJECT_ID,
    scope: 'iris' as const,
    owner_user_id: null,
    name: 'Overdue at Architect',
    description: 'BIC architect, days_in_court > sla',
    view_state: { filters: {} },
    is_default: false,
    created_by: null,
    created_at: '2026-05-06T12:00:00Z',
    updated_at: '2026-05-06T12:00:00Z',
  },
  {
    id: 'v-iris-2',
    project_id: PROJECT_ID,
    scope: 'iris' as const,
    owner_user_id: null,
    name: 'Long-lead → Schedule Risk',
    description: null,
    view_state: { filters: {} },
    is_default: false,
    created_by: null,
    created_at: '2026-05-06T12:01:00Z',
    updated_at: '2026-05-06T12:01:00Z',
  },
]

const renderSidebar = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SavedViewsSidebar projectId={PROJECT_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SavedViewsSidebar', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    ;(submittalsSavedViewsService.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: fakeViews,
      error: null,
    })
    ;(submittalsSavedViewsService.seedIrisSuggested as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: 0,
      error: null,
    })
  })

  it('renders collapsed by default and exposes only the toggle button', () => {
    renderSidebar()
    const aside = screen.getByRole('complementary', { name: 'Saved views' })
    expect(aside).toBeInTheDocument()
    // Collapsed: chevron is the "expand" affordance.
    expect(screen.getByRole('button', { name: /expand saved views/i })).toBeInTheDocument()
  })

  it('expands when clicked and renders all 4 scope sections', async () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: /expand saved views/i }))
    await waitFor(() => {
      expect(screen.getByText('My Views')).toBeInTheDocument()
      expect(screen.getByText('Project Views')).toBeInTheDocument()
      expect(screen.getByText('Company Views')).toBeInTheDocument()
      expect(screen.getByText('Iris Suggested')).toBeInTheDocument()
    })
  })

  it('persists open state to localStorage on toggle', () => {
    renderSidebar()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /expand saved views/i }))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /collapse saved views/i }))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('0')
  })

  it('starts expanded when localStorage says open', () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    renderSidebar()
    // Already expanded → the collapse affordance is showing.
    expect(screen.getByRole('button', { name: /collapse saved views/i })).toBeInTheDocument()
  })

  it('renders Iris-suggested seed names when present', async () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    renderSidebar()
    await waitFor(() => {
      expect(screen.getByText('Overdue at Architect')).toBeInTheDocument()
      expect(screen.getByText('Long-lead → Schedule Risk')).toBeInTheDocument()
    })
  })

  it('Iris views are read-only (no delete affordance)', async () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    renderSidebar()
    await waitFor(() => screen.getByText('Overdue at Architect'))
    // No "Delete <name>" buttons exist for the iris rows.
    expect(screen.queryByRole('button', { name: /Delete Overdue at Architect/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete Long-lead/i })).toBeNull()
  })

  it('triggers Iris seed RPC on first load when no iris views exist', async () => {
    ;(submittalsSavedViewsService.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [], // no iris views yet
      error: null,
    })
    renderSidebar()
    await waitFor(() => {
      expect(submittalsSavedViewsService.seedIrisSuggested).toHaveBeenCalledWith(PROJECT_ID)
    })
  })

  it('does NOT trigger Iris seed when iris views already exist', async () => {
    renderSidebar() // default mock returns iris views
    // Allow effects to flush.
    await new Promise((r) => setTimeout(r, 50))
    expect(submittalsSavedViewsService.seedIrisSuggested).not.toHaveBeenCalled()
  })
})
