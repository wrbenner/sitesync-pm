import { toast } from 'sonner'
import { syncManager, type ConnectionStatus } from '../lib/syncManager'
import {
  getFromCache,
  getOneFromCache,
  writeToCache,
  storeBaseVersion,
  queueMutation,
} from '../lib/offlineDb'
import { ok, fail, dbError } from './errors'
import type { Result } from './errors'

// ── Network Error Detection ───────────────────────────────────────────────────

const NETWORK_ERROR_PATTERNS = [
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'fetch failed',
  'connection refused',
  'connection reset',
  'econnrefused',
  'etimedout',
  'enotfound',
  'unable to connect',
  'no internet',
]

/**
 * Returns true if the error looks like a transient network failure
 * (not a permission or validation error).
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return NETWORK_ERROR_PATTERNS.some((p) => msg.includes(p))
}

// ── Exponential Backoff ───────────────────────────────────────────────────────

function backoffDelayMs(attempt: number, baseMs = 1000, maxMs = 30_000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs)
  // ±25% jitter to avoid thundering herd
  const jitterFactor = 0.75 + (crypto.getRandomValues(new Uint16Array(1))[0] / 65535) * 0.5
  return Math.round(exponential * jitterFactor)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Retry Options ─────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number
  /** Maximum delay cap in ms (default: 30 000) */
  maxDelayMs?: number
  /** When true, only retries on network errors; permission/validation errors fail fast */
  networkErrorsOnly?: boolean
}

// ── withRetry ─────────────────────────────────────────────────────────────────

/**
 * Wraps any service call returning `Result<T>` with exponential-backoff retry.
 *
 * - Permission and validation errors are never retried (fail-fast).
 * - Database / network errors retry up to `maxRetries` times.
 * - Underlying thrown exceptions are caught and surfaced as `dbError`.
 */
export async function withRetry<T>(
  fn: () => Promise<Result<T>>,
  options: RetryOptions = {},
): Promise<Result<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    networkErrorsOnly = true,
  } = options

  let lastResult: Result<T> = fail(dbError('No attempts made'))

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      lastResult = await fn()

      if (!lastResult.error) return lastResult

      const { category } = lastResult.error
      // Fail-fast for non-retriable error categories
      if (category === 'PermissionError' || category === 'ValidationError' || category === 'NotFoundError') {
        return lastResult
      }
      // When networkErrorsOnly, only retry if the message looks like a network issue
      if (networkErrorsOnly && !isNetworkError(new Error(lastResult.error.message))) {
        return lastResult
      }

      if (attempt < maxRetries) {
        await sleep(backoffDelayMs(attempt, baseDelayMs, maxDelayMs))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      lastResult = fail(dbError(message))
      if (attempt < maxRetries) {
        await sleep(backoffDelayMs(attempt, baseDelayMs, maxDelayMs))
      }
    }
  }

  return lastResult
}

// ── withOfflineFallback ───────────────────────────────────────────────────────

/**
 * Wraps a read service call to fall back to cached data when offline or on
 * network failure.  On a successful online fetch the results are written to
 * the Dexie cache so future offline loads have up-to-date data.
 *
 * @param fn        - The online fetch function returning `Result<T[]>`
 * @param tableName - Supabase / Dexie table name (e.g. 'rfis')
 * @param projectId - Optional project filter for scoped cache reads
 */
export async function withOfflineFallback<T extends Record<string, unknown>>(
  fn: () => Promise<Result<T[]>>,
  tableName: string,
  projectId?: string,
): Promise<Result<T[]>> {
  if (!navigator.onLine) {
    const cached = await getFromCache<T>(tableName, projectId)
    return ok(cached)
  }

  const result = await fn()

  if (result.error) {
    if (isNetworkError(new Error(result.error.message))) {
      const cached = await getFromCache<T>(tableName, projectId)
      return ok(cached)
    }
    return result
  }

  // Populate cache for future offline use
  if (result.data) {
    await Promise.all(
      result.data.map((item) =>
        writeToCache(tableName, item as Record<string, unknown>).catch(() => {
          // Cache writes are best-effort — never surface as an error
        }),
      ),
    )
  }

  return result
}

// ── withOfflineQueue ──────────────────────────────────────────────────────────

/**
 * Offline-aware mutation wrapper:
 * - **Online**: delegates to `onlineFn` and returns its result.
 * - **Offline**: queues the mutation in Dexie, writes an optimistic cache
 *   update, and returns `ok(undefined)` so callers treat it as success.
 *
 * For `update` operations the current cached record is captured as the
 * three-way merge base before the optimistic write.
 *
 * @param table      - Supabase table name (must be in validTableNames)
 * @param operation  - 'insert' | 'update' | 'delete'
 * @param data       - Mutation payload (must include `id` for update/delete)
 * @param onlineFn   - Function to call when online; required for online path
 */
export async function withOfflineQueue(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: Record<string, unknown>,
  onlineFn: () => Promise<Result>,
): Promise<Result> {
  if (!navigator.onLine) {
    try {
      // Capture base version for three-way merge conflict resolution
      if (operation === 'update' && data.id) {
        const existing = await getOneFromCache<Record<string, unknown>>(table, String(data.id))
        if (existing) {
          await storeBaseVersion(table, String(data.id), existing)
        }
      }

      await queueMutation(table, operation, data)

      // Optimistic local cache update
      if (operation !== 'delete') {
        await writeToCache(table, data)
      }

      return ok(undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return fail(dbError(`Failed to queue offline mutation: ${message}`, { table, operation }))
    }
  }

  return onlineFn()
}

// ── Connection Toast Monitor ──────────────────────────────────────────────────

type ToastId = string | number

let connectionToastId: ToastId | null = null
let previousConnection: ConnectionStatus | null = null
let monitorUnsubscribe: (() => void) | null = null

/**
 * Initialise one-time connection toast notifications.
 *
 * Call this once from the app root (e.g. in App.tsx).
 * Returns a cleanup function that unsubscribes the monitor.
 *
 * Toast behaviour:
 * - Offline transition → persistent warning toast (stays until online)
 * - Online  transition → dismisses the offline toast, shows brief success
 * - Sync complete      → brief confirmation (handled by SyncManager)
 */
export function initConnectionToasts(): () => void {
  if (monitorUnsubscribe) {
    monitorUnsubscribe()
  }

  previousConnection = syncManager.getState().connection

  monitorUnsubscribe = syncManager.subscribe((state) => {
    if (previousConnection === state.connection) return

    const prev = previousConnection
    previousConnection = state.connection

    if (state.connection === 'offline') {
      connectionToastId = toast.warning('You are offline', {
        description: 'Changes will sync automatically when you reconnect.',
        duration: Infinity,
      })
    } else if (prev === 'offline' && state.connection === 'online') {
      // Dismiss the persistent offline toast
      if (connectionToastId !== null) {
        toast.dismiss(connectionToastId)
        connectionToastId = null
      }
      toast.success('Back online', {
        description: 'Syncing pending changes...',
        duration: 3000,
      })
    }
  })

  return () => {
    monitorUnsubscribe?.()
    monitorUnsubscribe = null
    previousConnection = null
    if (connectionToastId !== null) {
      toast.dismiss(connectionToastId)
      connectionToastId = null
    }
  }
}

// ── Sync-result Toast ─────────────────────────────────────────────────────────

/**
 * Show a toast summarising the result of a sync operation.
 * Call this after `syncManager.sync()` returns.
 */
export function showSyncResultToast(result: { synced: number; failed: number; conflicts: number }): void {
  const { synced, failed, conflicts } = result

  if (synced > 0 && failed === 0 && conflicts === 0) {
    toast.success(`Synced ${synced} change${synced !== 1 ? 's' : ''}`, { duration: 3000 })
    return
  }

  if (conflicts > 0) {
    toast.warning(`Sync complete — ${conflicts} conflict${conflicts !== 1 ? 's' : ''} need resolution`, {
      duration: 5000,
    })
    return
  }

  if (failed > 0) {
    toast.error(`Sync incomplete — ${failed} change${failed !== 1 ? 's' : ''} failed`, {
      description: 'These will be retried automatically.',
      duration: 5000,
    })
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * Convenience facade so consumers can import a single object.
 */
export const connectionService = {
  withRetry,
  withOfflineFallback,
  withOfflineQueue,
  initConnectionToasts,
  showSyncResultToast,
  isNetworkError,
}
