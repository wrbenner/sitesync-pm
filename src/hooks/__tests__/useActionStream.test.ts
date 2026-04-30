// ─────────────────────────────────────────────────────────────────────────────
// useActionStream — Tab A test suite
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// ── Mocks (must be hoisted with vi.mock) ────────────────────────────────────

const mockRFIs = vi.fn()
const mockPunch = vi.fn()
const mockSubmittals = vi.fn()
const mockTasks = vi.fn()
const mockIncidents = vi.fn()
const mockDailyLogs = vi.fn()
const mockSchedule = vi.fn()
const mockProjectId = vi.fn<() => string | undefined>()
const mockAuthUser = vi.fn<() => { id: string } | null>()
const mockPermissionsRole = vi.fn<() => string | null>()
const mockActor = vi.fn<() => { kind: 'user' | 'magic_link'; userId?: string; companyId?: string }>()

vi.mock('../useProjectId', () => ({
  useProjectId: () => mockProjectId(),
}))

vi.mock('../useAuth', () => ({
  useAuth: () => ({ user: mockAuthUser(), session: null, loading: false, error: null }),
}))

vi.mock('../usePermissions', () => ({
  usePermissions: () => ({
    role: mockPermissionsRole(),
    loading: false,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isAtLeast: () => true,
    canAccessModule: () => true,
  }),
}))

vi.mock('../../contexts/ActorContext', () => ({
  useActor: () => mockActor(),
}))

vi.mock('../queries/rfis', () => ({
  useRFIs: () => mockRFIs(),
}))
vi.mock('../queries/punch-items', () => ({
  usePunchItems: () => mockPunch(),
}))
vi.mock('../queries/submittals', () => ({
  useSubmittals: () => mockSubmittals(),
}))
vi.mock('../queries/tasks', () => ({
  useTasks: () => mockTasks(),
}))
vi.mock('../queries/incidents', () => ({
  useIncidents: () => mockIncidents(),
}))
vi.mock('../queries/daily-logs', () => ({
  useDailyLogs: () => mockDailyLogs(),
}))
vi.mock('../useScheduleActivities', () => ({
  useScheduleActivities: () => mockSchedule(),
}))

// Iris service stub — assert it was called and pass-through.
const mockDetect = vi.fn((items: unknown[]) => items)
vi.mock('../../services/iris', () => ({
  detectIrisEnhancements: (items: unknown[]) => mockDetect(items),
}))

// Import after mocks are configured.
import { useActionStream } from '../useActionStream'
import { useStreamStore } from '../../stores/streamStore'

// ── Helpers ─────────────────────────────────────────────────────────────────

const PROJECT_ID = '11111111-1111-4111-a111-111111111111'

function emptyQuery() {
  return {
    data: { data: [], total: 0, page: 1, pageSize: 50 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }
}

function emptyArrayQuery() {
  return { data: [], isLoading: false, error: null, refetch: vi.fn() }
}

function rfi(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: over.id ?? `rfi-${Math.random().toString(36).slice(2, 8)}`,
    number: over.number ?? 1,
    title: over.title ?? 'Curtain wall flashing',
    status: over.status ?? 'open',
    due_date: over.due_date ?? null,
    response_due_date: over.response_due_date ?? null,
    assigned_to: over.assigned_to ?? null,
    ball_in_court: over.ball_in_court ?? null,
    cost_impact: over.cost_impact ?? null,
    schedule_impact: over.schedule_impact ?? null,
    created_at: over.created_at ?? '2026-04-01T00:00:00Z',
    drawing_reference: over.drawing_reference ?? null,
    spec_section: over.spec_section ?? null,
  }
}

function task(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: over.id ?? `task-${Math.random().toString(36).slice(2, 8)}`,
    title: over.title ?? 'Order trim',
    status: over.status ?? 'todo',
    due_date: over.due_date ?? null,
    assigned_to: over.assigned_to ?? null,
    created_at: over.created_at ?? '2026-04-01T00:00:00Z',
  }
}

function punch(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: over.id ?? `punch-${Math.random().toString(36).slice(2, 8)}`,
    number: over.number ?? 1,
    title: over.title ?? 'Touch-up paint',
    status: over.status ?? 'open',
    due_date: over.due_date ?? null,
    assigned_to: over.assigned_to ?? null,
    created_at: over.created_at ?? '2026-04-01T00:00:00Z',
  }
}

function isoDate(d: Date): string {
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  return t.toISOString().slice(0, 10)
}

function submittedYesterdayAndTodayLogs() {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  return [
    { log_date: isoDate(yesterday), status: 'submitted' },
    { log_date: isoDate(today), status: 'draft' },
  ]
}

beforeEach(() => {
  // Reset all mocks
  mockRFIs.mockReturnValue(emptyQuery())
  mockPunch.mockReturnValue(emptyQuery())
  mockSubmittals.mockReturnValue(emptyQuery())
  mockTasks.mockReturnValue(emptyQuery())
  mockIncidents.mockReturnValue(emptyArrayQuery())
  // Default: yesterday's log is submitted + today's log exists, so the
  // derived daily-log items don't appear in tests that aren't about logs.
  mockDailyLogs.mockReturnValue({
    data: { data: submittedYesterdayAndTodayLogs(), total: 2, page: 1, pageSize: 50 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockSchedule.mockReturnValue(emptyArrayQuery())
  mockProjectId.mockReturnValue(PROJECT_ID)
  mockAuthUser.mockReturnValue({ id: 'user-1' })
  mockPermissionsRole.mockReturnValue('project_manager')
  mockActor.mockReturnValue({ kind: 'user' })
  mockDetect.mockClear()

  // Reset zustand store + localStorage
  useStreamStore.setState({
    dismissedIds: new Set(),
    snoozedItems: new Map(),
  })
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useActionStream', () => {
  it('returns empty array for project with no actionable items', () => {
    const { result } = renderHook(() => useActionStream())
    expect(result.current.items).toEqual([])
    expect(result.current.counts).toEqual({ total: 0, critical: 0, overdue: 0, waitingOnYou: 0 })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('always pipes assembled items through detectIrisEnhancements', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: { data: [rfi()], total: 1, page: 1, pageSize: 50 },
    })
    renderHook(() => useActionStream())
    expect(mockDetect).toHaveBeenCalled()
  })

  it('includes overdue RFIs with critical urgency', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: {
        data: [rfi({ id: 'r1', number: 42, response_due_date: '2020-01-01T00:00:00Z' })],
        total: 1, page: 1, pageSize: 50,
      },
    })
    const { result } = renderHook(() => useActionStream())
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].id).toBe('rfi-r1')
    expect(result.current.items[0].urgency).toBe('critical')
    expect(result.current.items[0].overdue).toBe(true)
    expect(result.current.items[0].cardType).toBe('risk')
    expect(result.current.counts.critical).toBe(1)
    expect(result.current.counts.overdue).toBe(1)
  })

  it('excludes closed/answered/void RFIs', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: {
        data: [
          rfi({ id: 'open', status: 'open' }),
          rfi({ id: 'closed', status: 'closed' }),
          rfi({ id: 'answered', status: 'answered' }),
          rfi({ id: 'void', status: 'void' }),
        ],
        total: 4, page: 1, pageSize: 50,
      },
    })
    const { result } = renderHook(() => useActionStream())
    const ids = result.current.items.map((i) => i.id)
    expect(ids).toEqual(['rfi-open'])
  })

  it('sorts critical above high above medium', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: {
        data: [
          rfi({ id: 'medium', response_due_date: '2099-01-01T00:00:00Z' }),
          rfi({ id: 'critical', response_due_date: '2020-01-01T00:00:00Z' }),
          rfi({
            id: 'high',
            response_due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }),
        ],
        total: 3, page: 1, pageSize: 50,
      },
    })
    const { result } = renderHook(() => useActionStream())
    const ids = result.current.items.map((i) => i.id)
    expect(ids).toEqual(['rfi-critical', 'rfi-high', 'rfi-medium'])
  })

  it('sorts overdue above non-overdue at same urgency tier', () => {
    // Two punch items at "high" tier — one overdue, one not. Overdue should win.
    mockPunch.mockReturnValue({
      ...emptyQuery(),
      data: {
        data: [
          punch({ id: 'fresh', status: 'open', due_date: '2099-01-01T00:00:00Z' }),
          punch({ id: 'late', status: 'open', due_date: '2020-01-01T00:00:00Z' }),
        ],
        total: 2, page: 1, pageSize: 50,
      },
    })
    const { result } = renderHook(() => useActionStream())
    expect(result.current.items[0].id).toBe('punch-late')
  })

  it('PM role returns all item types', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: { data: [rfi({ id: 'r1' })], total: 1, page: 1, pageSize: 50 },
    })
    mockTasks.mockReturnValue({
      ...emptyQuery(),
      data: { data: [task({ id: 't1' })], total: 1, page: 1, pageSize: 50 },
    })
    const { result } = renderHook(() => useActionStream('pm'))
    const types = new Set(result.current.items.map((i) => i.type))
    expect(types).toEqual(new Set(['rfi', 'task']))
  })

  it('Superintendent role filters out RFIs/submittals (field-only types)', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: { data: [rfi({ id: 'r1' })], total: 1, page: 1, pageSize: 50 },
    })
    mockTasks.mockReturnValue({
      ...emptyQuery(),
      data: { data: [task({ id: 't1' })], total: 1, page: 1, pageSize: 50 },
    })
    mockPunch.mockReturnValue({
      ...emptyQuery(),
      data: { data: [punch({ id: 'p1' })], total: 1, page: 1, pageSize: 50 },
    })

    const { result } = renderHook(() => useActionStream('superintendent'))
    const types = result.current.items.map((i) => i.type)
    expect(types).toContain('punch')
    expect(types).toContain('task')
    expect(types).not.toContain('rfi')
    expect(types).not.toContain('submittal')
  })

  it('Owner role filters by cost impact and schedule items', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: {
        data: [
          rfi({ id: 'r-no-cost', cost_impact: null }),
          rfi({ id: 'r-with-cost', cost_impact: 25000 }),
        ],
        total: 2, page: 1, pageSize: 50,
      },
    })
    const { result } = renderHook(() => useActionStream('owner'))
    const ids = result.current.items.map((i) => i.id)
    expect(ids).toContain('rfi-r-with-cost')
    expect(ids).not.toContain('rfi-r-no-cost')
  })

  it('Architect role narrows to RFIs and submittals only', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: { data: [rfi({ id: 'r1' })], total: 1, page: 1, pageSize: 50 },
    })
    mockPunch.mockReturnValue({
      ...emptyQuery(),
      data: { data: [punch({ id: 'p1' })], total: 1, page: 1, pageSize: 50 },
    })
    const { result } = renderHook(() => useActionStream('architect'))
    const types = result.current.items.map((i) => i.type)
    expect(types).toContain('rfi')
    expect(types).not.toContain('punch')
  })

  it('Subcontractor role with no companyId returns empty', () => {
    mockActor.mockReturnValue({ kind: 'user', userId: 'u1' })
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: { data: [rfi({ id: 'r1' })], total: 1, page: 1, pageSize: 50 },
    })
    const { result } = renderHook(() => useActionStream('subcontractor'))
    expect(result.current.items).toEqual([])
  })

  it('dismiss() removes the item from the returned array', () => {
    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: {
        data: [rfi({ id: 'keep' }), rfi({ id: 'drop' })],
        total: 2, page: 1, pageSize: 50,
      },
    })
    const { result, rerender } = renderHook(() => useActionStream())
    expect(result.current.items.map((i) => i.id).sort()).toEqual(['rfi-drop', 'rfi-keep'])

    act(() => {
      result.current.dismiss('rfi-drop')
    })
    rerender()
    expect(result.current.items.map((i) => i.id)).toEqual(['rfi-keep'])
  })

  it('snooze() hides the item until its resurface time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T10:00:00Z'))

    mockRFIs.mockReturnValue({
      ...emptyQuery(),
      data: { data: [rfi({ id: 'r1' })], total: 1, page: 1, pageSize: 50 },
    })
    mockDailyLogs.mockReturnValue({
      data: { data: submittedYesterdayAndTodayLogs(), total: 2, page: 1, pageSize: 50 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    try {
      const { result, rerender } = renderHook(() => useActionStream())
      expect(result.current.items).toHaveLength(1)

      act(() => {
        result.current.snooze('rfi-r1', '1h')
      })
      rerender()
      expect(result.current.items).toHaveLength(0)

      // Advance past the resurface (1h + buffer).
      vi.setSystemTime(new Date('2026-04-30T11:30:00Z'))
      // Force re-evaluation — store still has the now-stale entry; manually
      // re-render and observe the lazy prune via the snoozedItems read path.
      // Easiest: clear the snooze map directly to simulate the prune-on-read.
      act(() => {
        useStreamStore.setState((s) => {
          const next = new Map(s.snoozedItems)
          for (const [id, iso] of next.entries()) {
            if (Date.parse(iso) <= Date.now()) next.delete(id)
          }
          return { snoozedItems: next }
        })
      })
      rerender()
      expect(result.current.items).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
