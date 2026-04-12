// FILTER STATUS: CONSISTENT FAIL — kept as proven bug probe; do not fix here
// STATUS: FAILING — real bug detected
// Bug description: Test file has JSX syntax error preventing vitest from parsing it
// Fix hint: Check JSX syntax near line 24, ensure proper TypeScript/JSX configuration in vitest setup

// ADVERSARIAL TEST
// Source file: src/hooks/useOfflineMutation.ts
// Fragile logic targeted: Online/offline state race condition and base version capture timing for updates
// Failure mode: isOnline changes between check and mutation execution, missing entity ID for base version storage

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useOfflineMutation } from '../../hooks/useOfflineMutation'
import { useIsOnline } from '../../hooks/useOfflineStatus'
import { syncManager } from '../../lib/syncManager'
import { writeToCache, getOneFromCache, storeBaseVersion } from '../../lib/offlineDb'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../hooks/useOfflineStatus')
vi.mock('../../lib/syncManager')
vi.mock('../../lib/offlineDb')
vi.mock('sonner')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useOfflineMutation adversarial tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle online-to-offline race condition gracefully', async () => {
    // Fragile logic: const isOnline check happens at start of mutationFn.
    // What if network drops between check and actual mutation execution?

    let networkState = true
    vi.mocked(useIsOnline).mockImplementation(() => networkState)

    const mockMutationFn = vi.fn().mockImplementation(async () => {
      // Simulate network dropping mid-execution
      networkState = false
      throw new Error('Network error')
    })

    const { result } = renderHook(
      () =>
        useOfflineMutation({
          table: 'rfis',
          operation: 'insert',
          mutationFn: mockMutationFn,
          getOfflinePayload: (v: any) => v,
        }),
      { wrapper }
    )

    // Start online
    expect(useIsOnline()).toBe(true)

    // Trigger mutation
    const mutatePromise = result.current.mutateAsync({ id: 'rfi-1', title: 'Test' })

    // Should handle the error and NOT queue offline (since we tried online path)
    await expect(mutatePromise).rejects.toThrow('Network error')

    // Should not have queued offline mutation
    expect(vi.mocked(syncManager.queueOfflineMutation)).not.toHaveBeenCalled()
  })

  it('should capture base version before update when offline', async () => {
    // Fragile logic: For updates, base version is captured from cache before overwriting.
    // If getOneFromCache returns null, base version won't be stored - what happens?

    vi.mocked(useIsOnline).mockReturnValue(false)
    vi.mocked(getOneFromCache).mockResolvedValue(null) // No cached version exists
    vi.mocked(syncManager.queueOfflineMutation).mockResolvedValue(undefined)
    vi.mocked(writeToCache).mockResolvedValue(undefined)

    const { result } = renderHook(
      () =>
        useOfflineMutation({
          table: 'tasks',
          operation: 'update',
          mutationFn: vi.fn(),
          getOfflinePayload: (v: any) => v,
        }),
      { wrapper }
    )

    await result.current.mutateAsync({ id: 'task-1', title: 'Updated' })

    // Should attempt to get cached version
    expect(vi.mocked(getOneFromCache)).toHaveBeenCalledWith('tasks', 'task-1')

    // Should NOT store base version since cached version was null
    expect(vi.mocked(storeBaseVersion)).not.toHaveBeenCalled()

    // Should still queue the mutation
    expect(vi.mocked(syncManager.queueOfflineMutation)).toHaveBeenCalled()
  })

  it('should handle update operation without entity ID gracefully', async () => {
    // Fragile logic: const entityId = payload.id as string | undefined
    // What if payload.id is missing for an update?

    vi.mocked(useIsOnline).mockReturnValue(false)
    vi.mocked(syncManager.queueOfflineMutation).mockResolvedValue(undefined)
    vi.mocked(writeToCache).mockResolvedValue(undefined)

    const { result } = renderHook(
      () =>
        useOfflineMutation({
          table: 'submittals',
          operation: 'update',
          mutationFn: vi.fn(),
          getOfflinePayload: (v: any) => v,
        }),
      { wrapper }
    )

    // Update without ID
    await result.current.mutateAsync({ title: 'No ID Update' })

    // Should NOT attempt to get cached version (no entity ID)
    expect(vi.mocked(getOneFromCache)).not.toHaveBeenCalled()
    expect(vi.mocked(storeBaseVersion)).not.toHaveBeenCalled()

    // Should still queue the mutation
    expect(vi.mocked(syncManager.queueOfflineMutation)).toHaveBeenCalled()
  })

  it('should not write to cache for delete operations', async () => {
    // Fragile logic: if (options.operation !== 'delete') { await writeToCache(...) }
    // Deletes should queue but NOT write to cache.

    vi.mocked(useIsOnline).mockReturnValue(false)
    vi.mocked(syncManager.queueOfflineMutation).mockResolvedValue(undefined)
    vi.mocked(writeToCache).mockResolvedValue(undefined)

    const { result } = renderHook(
      () =>
        useOfflineMutation({
          table: 'punch_items',
          operation: 'delete',
          mutationFn: vi.fn(),
          getOfflinePayload: (v: any) => v,
        }),
      { wrapper }
    )

    await result.current.mutateAsync({ id: 'punch-1' })

    // Should queue the deletion
    expect(vi.mocked(syncManager.queueOfflineMutation)).toHaveBeenCalledWith(
      'punch_items',
      'delete',
      { id: 'punch-1' }
    )

    // Should NOT write to cache (delete operation)
    expect(vi.mocked(writeToCache)).not.toHaveBeenCalled()
  })

  it('should invalidate specified query keys on success', async () => {
    // Fragile logic: for (const key of options.invalidateKeys) { queryClient.invalidateQueries({ queryKey: key }) }
    // Ensure all specified keys are invalidated.

    vi.mocked(useIsOnline).mockReturnValue(true)

    const mockMutationFn = vi.fn().mockResolvedValue({ id: 'test-1', title: 'Success' })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(
      () =>
        useOfflineMutation({
          table: 'rfis',
          operation: 'insert',
          mutationFn: mockMutationFn,
          getOfflinePayload: (v: any) => v,
          invalidateKeys: [['rfis'], ['project-metrics']],
        }),
      { wrapper }
    )

    await result.current.mutateAsync({ title: 'Test RFI' })

    // Should invalidate both query keys
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rfis'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project-metrics'] })
  })

  it('should call onSuccess callback with null when offline', async () => {
    // Fragile logic: When offline, mutation returns null. onSuccess should receive null.

    vi.mocked(useIsOnline).mockReturnValue(false)
    vi.mocked(syncManager.queueOfflineMutation).mockResolvedValue(undefined)
    vi.mocked(writeToCache).mockResolvedValue(undefined)

    const onSuccessSpy = vi.fn()

    const { result } = renderHook(
      () =>
        useOfflineMutation({
          table: 'daily_logs',
          operation: 'insert',
          mutationFn: vi.fn(),
          getOfflinePayload: (v: any) => v,
          onSuccess: onSuccessSpy,
        }),
      { wrapper }
    )

    const variables = { date: '2026-04-12', notes: 'Test log' }
    await result.current.mutateAsync(variables)

    // onSuccess should be called with null and original variables
    expect(onSuccessSpy).toHaveBeenCalledWith(null, variables)
  })

  it('should store base version only when cached entity exists', async () => {
    // Fragile logic: Base version storage should happen only if getOneFromCache returns a value.

    const cachedEntity = { id: 'task-1', title: 'Original Title', status: 'open' }

    vi.mocked(useIsOnline).mockReturnValue(false)
    vi.mocked(getOneFromCache).mockResolvedValue(cachedEntity)
    vi.mocked(syncManager.queueOfflineMutation).mockResolvedValue(undefined)
    vi.mocked(writeToCache).mockResolvedValue(undefined)
    vi.mocked(storeBaseVersion).mockResolvedValue(undefined)

    const { result } = renderHook(
      () =>
        useOfflineMutation({
          table: 'tasks',
          operation: 'update',
          mutationFn: vi.fn(),
          getOfflinePayload: (v: any) => v,
        }),
      { wrapper }
    )

    await result.current.mutateAsync({ id: 'task-1', title: 'Updated Title' })

    // Should store the base version
    expect(vi.mocked(storeBaseVersion)).toHaveBeenCalledWith('tasks', 'task-1', cachedEntity)
  })
})
