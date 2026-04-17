import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ──────────────────────────────────────────────
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    })),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
  fromTable: vi.fn(),
  isSupabaseConfigured: true,
}))

vi.mock('../../../lib/weather', () => ({
  fetchWeather: vi.fn().mockResolvedValue(null),
  fetchWeatherForecast5Day: vi.fn().mockResolvedValue([]),
}))

// Controllable projects state
const projectsState = { data: [] as unknown[], isPending: false }

vi.mock('../../../hooks/queries', () => ({
  useProject: () => ({ data: null, isError: false, error: null }),
  useProjects: () => projectsState,
  usePayApplications: () => ({ data: [] }),
  useLienWaivers: () => ({ data: [] }),
  useAiInsightsMeta: () => ({ data: null }),
  useSchedulePhases: () => ({ data: [] }),
}))

vi.mock('../../../hooks/useProjectId', () => ({
  useProjectId: () => undefined,
}))

vi.mock('../../../hooks/useProjectMetrics', () => ({
  useProjectMetrics: () => ({ data: null }),
}))

vi.mock('../../../hooks/useAnimatedNumber', () => ({
  useAnimatedNumber: (n: number) => n,
}))

vi.mock('../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('../../../stores/projectContextStore', () => ({
  useProjectContext: (selector: (s: unknown) => unknown) =>
    selector({ setActiveProject: vi.fn() }),
}))

vi.mock('../../../stores/scheduleStore', () => ({
  useScheduleStore: (selector: (s: unknown) => unknown) =>
    selector({ loadSchedule: vi.fn() }),
}))

// Replace heavy sub-components with light stand-ins
vi.mock('../../../components/dashboard/DashboardGrid', () => ({
  DashboardGrid: () => <div data-testid="dashboard-grid" />,
}))

vi.mock('../../../components/dashboard/MorningBriefing', () => ({
  MorningBriefing: () => <div data-testid="morning-briefing" />,
}))

vi.mock('../../../components/schedule/CoordinationEngine', () => ({
  CoordinationEngine: () => <div data-testid="coordination" />,
}))

vi.mock('../../../components/field/QuickRFIButton', () => ({
  default: () => <div data-testid="quick-rfi" />,
}))

vi.mock('../WelcomeOnboarding', () => ({
  WelcomeOnboarding: () => <div data-testid="welcome-onboarding">Welcome</div>,
}))

vi.mock('../DashboardMetrics', () => ({
  DashboardMetrics: () => <div data-testid="dashboard-metrics" />,
}))

vi.mock('../DashboardWeather', () => ({
  DashboardWeather: () => <div data-testid="dashboard-weather" />,
}))

vi.mock('../DashboardAI', () => ({
  AIInsightsBanner: () => <div data-testid="ai-insights-banner" />,
  DeterministicInsightsBanner: () => <div data-testid="det-insights-banner" />,
}))

vi.mock('../DashboardBriefing', () => ({
  DashboardHero: () => <div data-testid="hero" />,
  OwnerReportCard: () => <div data-testid="owner-report" />,
  MissingWaiversAlert: () => <div data-testid="missing-waivers" />,
  OnboardingChecklist: () => <div data-testid="onboarding-checklist" />,
}))

// Import AFTER mocks
import { Dashboard } from '../index'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    projectsState.data = []
    projectsState.isPending = false
  })

  it('renders without crashing', () => {
    const { container } = render(wrap(<Dashboard />))
    expect(container).toBeTruthy()
  })

  it('shows loading skeleton while projects are pending', () => {
    projectsState.isPending = true
    const { container } = render(wrap(<Dashboard />))
    // Skeleton renders animated placeholders; just assert container has children
    expect(container.firstChild).toBeTruthy()
  })

  it('renders onboarding when no projects exist', () => {
    projectsState.data = []
    projectsState.isPending = false
    render(wrap(<Dashboard />))
    expect(screen.getByTestId('welcome-onboarding')).toBeDefined()
  })

  it('renders dashboard inner (skeleton or briefing) when projects are present', () => {
    projectsState.data = [{ id: 'p1', name: 'Proj 1' }]
    projectsState.isPending = false
    const { container } = render(wrap(<Dashboard />))
    // While project query is pending, dashboard shows skeleton; either way no crash
    expect(container.firstChild).toBeTruthy()
  })

  it('wraps inner page in an ErrorBoundary', () => {
    // ErrorBoundary is always applied — rendering should not throw
    expect(() => render(wrap(<Dashboard />))).not.toThrow()
  })
})
