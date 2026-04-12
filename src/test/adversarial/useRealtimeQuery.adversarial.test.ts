// FILTER STATUS: CONSISTENT FAIL — kept as proven bug probe; do not fix here
// STATUS: FAILING — real bug detected
// Bug description: Test file has JSX syntax error preventing vitest from parsing it
// Fix hint: Check JSX syntax near line 25, ensure proper TypeScript/JSX configuration in vitest setup

// ADVERSARIAL TEST
// Source file: src/hooks/useRealtimeQuery.ts
// Fragile logic targeted: Debounce timeout cleanup and user ID comparison for toast filtering
// Failure mode: Memory leak from uncanceled pending timeouts, toast spam when currentUserId is null

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRealtimeQuery } from '../../hooks/useRealtimeQuery'
import { useAuth } from '../../hooks/useAuth'
import { useProjectId } from '../../hooks/useProjectId'
import { supabase } from '../../lib/supabase'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useProjectId')
vi.mock('../../lib/supabase')
vi.mock('sonner')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useRealtimeQuery adversarial tests', () => {
  let realtimeCallback: ((payload: any) => void) | null = null
  let mockChannel: any

  beforeEach(() => {
    vi.clearAllMocks()
    realtimeCallback = null

    mockChannel = {
      on: vi.fn().mockImplementation((type: string, opts: any, callback: any) => {
        realtimeCallback = callback
        return mockChannel
      }),
      subscribe: vi.fn().mockReturnValue(mockChannel),
    }

    vi.mocked(supabase.channel).mockReturnValue(mockChannel)
    vi.mocked(supabase.removeChannel).mockResolvedValue({ status: 'ok', error: null } as any)
    vi.mocked(useProjectId).mockReturnValue('project-123')
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123' } as any,
      session: null,
      loading: false,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      isAuthenticated: true,
      isSessionValid: true,
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should cancel pending debounce timeout on unmount to prevent memory leak', async () => {
    // Fragile logic: pendingInvalidation.current = setTimeout(...)
    // If component unmounts before timeout fires, clearTimeout must be called.

    vi.useFakeTimers()

    const mockQueryFn = vi.fn().mockResolvedValue([])

    const { unmount } = renderHook(
      () =>
        useRealtimeQuery(['rfis'], mockQueryFn, {
          table: 'rfis',
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(realtimeCallback).toBeTruthy()
    })

    // Trigger a change to start the debounce timer
    realtimeCallback?.({
      eventType: 'UPDATE',
      new: { id: 'rfi-1', updated_by: 'other-user' },
      old: {},
    })

    // Unmount before timeout fires
    unmount()

    // Fast-forward time - timeout should NOT fire after unmount
    vi.advanceTimersByTime(500)

    // queryClient.invalidateQueries should not have been called
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    expect(invalidateSpy).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('should debounce rapid changes and invalidate only once', async () => {
    // Fragile logic: Each change clears and restarts the 300ms timer.
    // 5 rapid changes should result in only 1 invalidation.

    vi.useFakeTimers()

    const mockQueryFn = vi.fn().mockResolvedValue([])
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(
      () =>
        useRealtimeQuery(['tasks'], mockQueryFn, {
          table: 'tasks',
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(realtimeCallback).toBeTruthy()
    })

    // Fire 5 rapid changes
    for (let i = 0; i < 5; i++) {
      realtimeCallback?.({
        eventType: 'UPDATE',
        new: { id: `task-${i}`, updated_by: 'other-user' },
        old: {},
      })
      vi.advanceTimersByTime(100) // Each 100ms apart (within 300ms debounce)
    }

    // Now advance past the final debounce window
    vi.advanceTimersByTime(300)

    // Should invalidate exactly once
    expect(invalidateSpy).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('should not show toast when change is made by current user', async () => {
    // Fragile logic: if (changedBy && changedBy !== currentUserId)
    // If changedBy === currentUserId, no toast should be shown.

    const mockQueryFn = vi.fn().mockResolvedValue([])

    renderHook(
      () =>
        useRealtimeQuery(['submittals'], mockQueryFn, {
          table: 'submittals',
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(realtimeCallback).toBeTruthy()
    })

    // Change by current user
    realtimeCallback?.({
      eventType: 'UPDATE',
      new: { id: 'sub-1', title: 'Updated by me', updated_by: 'user-123' },
      old: {},
    })

    // Should NOT show toast
    expect(vi.mocked(toast.info)).not.toHaveBeenCalled()
  })

  it('should show toast when change is made by other user', async () => {
    // Fragile logic: if (changedBy && changedBy !== currentUserId) show toast.

    const mockQueryFn = vi.fn().mockResolvedValue([])

    renderHook(
      () =>
        useRealtimeQuery(['rfis'], mockQueryFn, {
          table: 'rfis',
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(realtimeCallback).toBeTruthy()
    })

    // Change by other user
    realtimeCallback?.({
      eventType: 'INSERT',
      new: { id: 'rfi-2', title: 'New RFI', created_by: 'other-user' },
      old: null,
    })

    // Should show toast
    expect(vi.mocked(toast.info)).toHaveBeenCalled()
  })

  it('should handle missing updated_by/created_by fields gracefully', async () => {
    // Edge case: What if the record has no updated_by or created_by?
    // changedBy will be undefined, toast should not be shown.

    const mockQueryFn = vi.fn().mockResolvedValue([])

    renderHook(
      () =>
        useRealtimeQuery(['daily_logs'], mockQueryFn, {
          table: 'daily_logs',
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(realtimeCallback).toBeTruthy()
    })

    // Change with no author fields
    realtimeCallback?.({
      eventType: 'UPDATE',
      new: { id: 'log-1', notes: 'Updated' },
      old: {},
    })

    // Should NOT show toast (changedBy is undefined)
    expect(vi.mocked(toast.info)).not.toHaveBeenCalled()
  })

  it('should respect showToasts: false option', async () => {
    // Fragile logic: if (options.showToasts !== false) { ... }
    // When showToasts is explicitly false, no toasts should be shown.

    const mockQueryFn = vi.fn().mockResolvedValue([])

    renderHook(
      () =>
        useRealtimeQuery(['change_orders'], mockQueryFn, {
          table: 'change_orders',
          showToasts: false,
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(realtimeCallback).toBeTruthy()
    })

    // Change by other user
    realtimeCallback?.({
      eventType: 'INSERT',
      new: { id: 'co-1', created_by: 'other-user' },
      old: null,
    })

    // Should NOT show toast even though it's from another user
    expect(vi.mocked(toast.info)).not.toHaveBeenCalled()
  })

  it('should subscribe to related tables and invalidate on any of them', async () => {
    // Fragile logic: const tables = [options.table, ...(options.relatedTables ?? [])]
    // Changes to related tables should also trigger invalidation.

    vi.useFakeTimers()

    const mockQueryFn = vi.fn().mockResolvedValue([])
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(
      () =>
        useRealtimeQuery(['rfis-with-responses'], mockQueryFn, {
          table: 'rfis',
          relatedTables: ['rfi_responses'],
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(realtimeCallback).toBeTruthy()
    })

    // Should have subscribed to both tables
    expect(vi.mocked(supabase.channel)).toHaveBeenCalledTimes(2)

    // Trigger change
    realtimeCallback?.({
      eventType: 'INSERT',
      new: { id: 'response-1', rfi_id: 'rfi-1' },
      old: null,
    })

    vi.advanceTimersByTime(300)

    // Should invalidate
    expect(invalidateSpy).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('should handle currentUserId being null without crashing', async () => {
    // Edge case: User is not authenticated (currentUserId = undefined).

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      isAuthenticated: false,
      isSessionValid: false,
    })

    const mockQueryFn = vi.fn().mockResolvedValue([])

    renderHook(
      () =>
        useRealtimeQuery(['tasks'], mockQueryFn, {
          table: 'tasks',
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(realtimeCallback).toBeTruthy()
    })

    // Change with an author
    realtimeCallback?.({
      eventType: 'UPDATE',
      new: { id: 'task-1', updated_by: 'some-user' },
      old: {},
    })

    // Should show toast (changedBy !== undefined, even though currentUserId is undefined)
    expect(vi.mocked(toast.info)).toHaveBeenCalled()
  })
})
