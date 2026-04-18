import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ok, fail, dbError, permissionError, validationError } from './errors'
import type { Result } from './errors'

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('../lib/offlineDb', () => ({
  getFromCache: vi.fn().mockResolvedValue([]),
  getOneFromCache: vi.fn().mockResolvedValue(null),
  writeToCache: vi.fn().mockResolvedValue(undefined),
  storeBaseVersion: vi.fn().mockResolvedValue(undefined),
  queueMutation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/syncManager', () => ({
  syncManager: {
    getState: vi.fn(() => ({ connection: 'online' })),
    subscribe: vi.fn(() => () => {}),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

import {
  isNetworkError,
  withRetry,
  withOfflineFallback,
  withOfflineQueue,
  showSyncResultToast,
  initConnectionToasts,
} from './connectionService'
import * as offlineDb from '../lib/offlineDb'
import { syncManager } from '../lib/syncManager'
import { toast } from 'sonner'

// ── isNetworkError ────────────────────────────────────────────────────────────

describe('isNetworkError', () => {
  it('returns true for "Failed to fetch" errors', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
  })

  it('returns true for network-related error messages', () => {
    expect(isNetworkError(new Error('NetworkError: connection reset'))).toBe(true)
    expect(isNetworkError(new Error('fetch failed'))).toBe(true)
    expect(isNetworkError(new Error('ECONNREFUSED 127.0.0.1:3000'))).toBe(true)
  })

  it('returns false for non-network errors', () => {
    expect(isNetworkError(new Error('Permission denied'))).toBe(false)
    expect(isNetworkError(new Error('Validation failed'))).toBe(false)
    expect(isNetworkError(new Error('Record not found'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isNetworkError('string error')).toBe(false)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(42)).toBe(false)
  })
})

// ── withRetry ─────────────────────────────────────────────────────────────────

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns success immediately without retrying', async () => {
    const fn = vi.fn().mockResolvedValue(ok('value'))
    const result = await withRetry(fn, { maxRetries: 3 })
    expect(result.data).toBe('value')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on db error up to maxRetries times', async () => {
    const networkResult = fail(dbError('Failed to fetch'))
    const successResult = ok('recovered')
    const fn = vi.fn()
      .mockResolvedValueOnce(networkResult)
      .mockResolvedValueOnce(networkResult)
      .mockResolvedValueOnce(successResult)

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 })
    // Fast-forward through backoff delays
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.data).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not retry permission errors', async () => {
    const fn = vi.fn().mockResolvedValue(fail(permissionError('Forbidden')))
    const promise = withRetry(fn, { maxRetries: 3 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.error?.category).toBe('PermissionError')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry validation errors', async () => {
    const fn = vi.fn().mockResolvedValue(fail(validationError('Bad input')))
    const promise = withRetry(fn, { maxRetries: 3 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.error?.category).toBe('ValidationError')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('returns last error after exhausting all retries', async () => {
    const networkErr = fail(dbError('Failed to fetch'))
    const fn = vi.fn().mockResolvedValue(networkErr)

    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 50 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.error).toBeTruthy()
    // Called once + 2 retries = 3 total
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('catches thrown exceptions and wraps them as dbError', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Unexpected crash'))

    const promise = withRetry(fn, { maxRetries: 0 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.message).toBe('Unexpected crash')
  })

  it('only retries network errors when networkErrorsOnly is true', async () => {
    // Non-network DB error should not be retried when networkErrorsOnly=true
    const dbErr = fail(dbError('duplicate key constraint'))
    const fn = vi.fn().mockResolvedValue(dbErr)

    const promise = withRetry(fn, { maxRetries: 3, networkErrorsOnly: true })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.error?.category).toBe('DatabaseError')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries db errors when networkErrorsOnly is false', async () => {
    const dbErr = fail(dbError('temporary db error'))
    const successResult = ok('ok')
    const fn = vi.fn()
      .mockResolvedValueOnce(dbErr)
      .mockResolvedValueOnce(successResult)

    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 10, networkErrorsOnly: false })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.data).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

// ── withOfflineFallback ───────────────────────────────────────────────────────

describe('withOfflineFallback', () => {
  const mockGetFromCache = vi.mocked(offlineDb.getFromCache)
  const mockWriteToCache = vi.mocked(offlineDb.writeToCache)

  beforeEach(() => {
    mockGetFromCache.mockResolvedValue([])
    mockWriteToCache.mockResolvedValue(undefined)
    // Default: online
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('calls online fn and returns data when online', async () => {
    const items = [{ id: '1', title: 'RFI-1' }]
    const fn = vi.fn().mockResolvedValue(ok(items))

    const result = await withOfflineFallback(fn, 'rfis', 'proj-1')

    expect(result.data).toEqual(items)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('writes results to cache on successful online fetch', async () => {
    const items = [{ id: '1', title: 'RFI-1' }]
    const fn = vi.fn().mockResolvedValue(ok(items))

    await withOfflineFallback(fn, 'rfis', 'proj-1')

    expect(mockWriteToCache).toHaveBeenCalledWith('rfis', items[0])
  })

  it('returns cached data when offline without calling online fn', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const cached = [{ id: 'cached-1', title: 'Cached RFI' }]
    mockGetFromCache.mockResolvedValue(cached)

    const fn = vi.fn()
    const result = await withOfflineFallback(fn, 'rfis', 'proj-1')

    expect(result.data).toEqual(cached)
    expect(fn).not.toHaveBeenCalled()
    expect(mockGetFromCache).toHaveBeenCalledWith('rfis', 'proj-1')
  })

  it('falls back to cache on network error from online fn', async () => {
    const cached = [{ id: 'cached-2', title: 'Cached RFI' }]
    mockGetFromCache.mockResolvedValue(cached)
    const fn = vi.fn().mockResolvedValue(fail(dbError('Failed to fetch')))

    const result = await withOfflineFallback(fn, 'rfis', 'proj-1')

    expect(result.data).toEqual(cached)
    expect(mockGetFromCache).toHaveBeenCalledWith('rfis', 'proj-1')
  })

  it('returns error directly for non-network errors (no cache fallback)', async () => {
    const fn = vi.fn().mockResolvedValue(fail(permissionError('No access')))

    const result = await withOfflineFallback(fn, 'rfis', 'proj-1')

    expect(result.error?.category).toBe('PermissionError')
    expect(mockGetFromCache).not.toHaveBeenCalled()
  })
})

// ── withOfflineQueue ──────────────────────────────────────────────────────────

describe('withOfflineQueue', () => {
  const mockQueueMutation = vi.mocked(offlineDb.queueMutation)
  const mockWriteToCache = vi.mocked(offlineDb.writeToCache)
  const mockGetOneFromCache = vi.mocked(offlineDb.getOneFromCache)
  const mockStoreBaseVersion = vi.mocked(offlineDb.storeBaseVersion)

  beforeEach(() => {
    mockQueueMutation.mockResolvedValue(undefined)
    mockWriteToCache.mockResolvedValue(undefined)
    mockGetOneFromCache.mockResolvedValue(null)
    mockStoreBaseVersion.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('calls onlineFn when online', async () => {
    const data = { id: 'rfi-1', title: 'Test' }
    const onlineFn = vi.fn().mockResolvedValue(ok(undefined))

    const result = await withOfflineQueue('rfis', 'insert', data, onlineFn)

    expect(onlineFn).toHaveBeenCalledTimes(1)
    expect(mockQueueMutation).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('queues mutation and returns ok when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const data = { id: 'rfi-2', title: 'Offline RFI' }
    const onlineFn = vi.fn()

    const result = await withOfflineQueue('rfis', 'insert', data, onlineFn)

    expect(onlineFn).not.toHaveBeenCalled()
    expect(mockQueueMutation).toHaveBeenCalledWith('rfis', 'insert', data)
    expect(result.error).toBeNull()
  })

  it('writes to cache optimistically on offline insert', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const data = { id: 'rfi-3', title: 'New RFI' }

    await withOfflineQueue('rfis', 'insert', data, vi.fn())

    expect(mockWriteToCache).toHaveBeenCalledWith('rfis', data)
  })

  it('does not write to cache on offline delete', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const data = { id: 'rfi-4' }

    await withOfflineQueue('rfis', 'delete', data, vi.fn())

    expect(mockWriteToCache).not.toHaveBeenCalled()
    expect(mockQueueMutation).toHaveBeenCalledWith('rfis', 'delete', data)
  })

  it('stores base version before offline update for conflict resolution', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const existing = { id: 'rfi-5', title: 'Old Title' }
    mockGetOneFromCache.mockResolvedValue(existing)
    const data = { id: 'rfi-5', title: 'New Title' }

    await withOfflineQueue('rfis', 'update', data, vi.fn())

    expect(mockStoreBaseVersion).toHaveBeenCalledWith('rfis', 'rfi-5', existing)
  })

  it('returns error when queueMutation throws', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    mockQueueMutation.mockRejectedValue(new Error('Queue is full'))
    const data = { id: 'rfi-6', title: 'Test' }

    const result = await withOfflineQueue('rfis', 'insert', data, vi.fn())

    expect(result.error?.category).toBe('DatabaseError')
    expect(result.error?.message).toContain('Queue is full')
  })

  it('returns error from onlineFn when online', async () => {
    const data = { id: 'rfi-7', title: 'Test' }
    const onlineFn = vi.fn().mockResolvedValue(fail(dbError('DB constraint violated')))

    const result = await withOfflineQueue('rfis', 'update', data, onlineFn)

    expect(result.error?.category).toBe('DatabaseError')
    expect(mockQueueMutation).not.toHaveBeenCalled()
  })
})

// ── showSyncResultToast ───────────────────────────────────────────────────────

describe('showSyncResultToast', () => {
  afterEach(() => vi.clearAllMocks())

  it('shows success toast when all changes synced cleanly', () => {
    showSyncResultToast({ synced: 5, failed: 0, conflicts: 0 })
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('5 changes'),
      expect.any(Object),
    )
  })

  it('shows singular success toast for exactly 1 change', () => {
    showSyncResultToast({ synced: 1, failed: 0, conflicts: 0 })
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('1 change'),
      expect.any(Object),
    )
  })

  it('shows warning toast when conflicts exist', () => {
    showSyncResultToast({ synced: 3, failed: 0, conflicts: 2 })
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('2 conflicts'),
      expect.any(Object),
    )
  })

  it('shows error toast when changes failed', () => {
    showSyncResultToast({ synced: 0, failed: 3, conflicts: 0 })
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('3 changes'),
      expect.any(Object),
    )
  })

  it('does not show any toast when nothing happened', () => {
    showSyncResultToast({ synced: 0, failed: 0, conflicts: 0 })
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})

// ── initConnectionToasts ──────────────────────────────────────────────────────

describe('initConnectionToasts', () => {
  type SyncListener = (state: { connection: string }) => void
  let capturedListener: SyncListener | null = null

  beforeEach(() => {
    capturedListener = null
    vi.mocked(syncManager.getState).mockReturnValue({ connection: 'online' } as ReturnType<typeof syncManager.getState>)
    vi.mocked(syncManager.subscribe).mockImplementation((cb: SyncListener) => {
      capturedListener = cb
      return () => {}
    })
  })

  afterEach(() => vi.clearAllMocks())

  it('returns a cleanup function', () => {
    const cleanup = initConnectionToasts()
    expect(typeof cleanup).toBe('function')
    cleanup()
  })

  it('shows warning toast when connection transitions to offline', () => {
    initConnectionToasts()
    capturedListener?.({ connection: 'offline' })
    expect(toast.warning).toHaveBeenCalledWith(
      'You are offline',
      expect.objectContaining({ duration: Infinity }),
    )
  })

  it('shows success toast when reconnecting after being offline', () => {
    // Start offline so we have previous state
    vi.mocked(syncManager.getState).mockReturnValue({ connection: 'offline' } as ReturnType<typeof syncManager.getState>)
    initConnectionToasts()
    capturedListener?.({ connection: 'online' })
    expect(toast.success).toHaveBeenCalledWith(
      'Back online',
      expect.any(Object),
    )
  })

  it('does not show toast when connection stays online', () => {
    initConnectionToasts()
    // Emit same state (online -> online)
    capturedListener?.({ connection: 'online' })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })
})

// ── Result type guard helpers (integration) ──────────────────────────────────

describe('Result type helpers used by connectionService', () => {
  it('ok() produces a success Result', () => {
    const r: Result<string> = ok('hello')
    expect(r.data).toBe('hello')
    expect(r.error).toBeNull()
  })

  it('fail() produces an error Result', () => {
    const r: Result<string> = fail(dbError('Boom'))
    expect(r.data).toBeNull()
    expect(r.error?.category).toBe('DatabaseError')
  })
})
