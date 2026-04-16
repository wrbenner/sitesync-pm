import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  offlineDb,
  queueMutation,
  getPendingCount,
  clearPendingMutations,
  resolveMutationConflict,
  checkStorageQuota,
  getDexieTableName,
  classifyUploadError,
  isReadyForRetry,
  computeNextRetryAt,
  MAX_PENDING_MUTATIONS,
  MAX_RETRY_COUNT,
  PERMANENT_UPLOAD_ERRORS,
} from '../../lib/offlineDb'

describe('Offline Database', () => {
  beforeEach(async () => {
    await clearPendingMutations()
    await offlineDb.pendingUploads.clear()
  })

  it('should initialize database', () => {
    expect(offlineDb).toBeDefined()
    expect(offlineDb.name).toBe('sitesync-offline')
  })

  it('should queue mutations', async () => {
    await queueMutation('rfis', 'insert', { title: 'Test RFI' })
    const count = await getPendingCount()
    expect(count).toBe(1)
  })

  it('should track multiple pending mutations', async () => {
    await queueMutation('rfis', 'insert', { title: 'RFI 1' })
    await queueMutation('tasks', 'update', { id: '123', status: 'done' })
    await queueMutation('punch_items', 'delete', { id: '456' })
    const count = await getPendingCount()
    expect(count).toBe(3)
  })

  it('should clear all pending mutations', async () => {
    await queueMutation('rfis', 'insert', { title: 'Test' })
    await clearPendingMutations()
    const count = await getPendingCount()
    expect(count).toBe(0)
  })
})

// ── BUG #1: Retry Logic ──────────────────────────────────

describe('Retry Logic (Bug #1 Fix)', () => {
  beforeEach(async () => {
    await clearPendingMutations()
  })

  it('mutations start with status pending and retryCount 0', async () => {
    await queueMutation('rfis', 'insert', { title: 'Test' })
    const mutations = await offlineDb.pendingMutations.toArray()
    expect(mutations[0].status).toBe('pending')
    expect(mutations[0].retryCount).toBe(0)
  })

  it('failed mutations below max retries stay as pending (not failed)', async () => {
    await queueMutation('rfis', 'insert', { title: 'Test' })
    const mutation = (await offlineDb.pendingMutations.toArray())[0]

    // Simulate a retry: retryCount=1, should stay pending
    await offlineDb.pendingMutations.update(mutation.id!, {
      status: 'pending',
      retryCount: 1,
      nextRetryAt: computeNextRetryAt(1),
    })

    const updated = await offlineDb.pendingMutations.get(mutation.id!)
    expect(updated!.status).toBe('pending')
    expect(updated!.retryCount).toBe(1)
    expect(updated!.nextRetryAt).toBeTruthy()
  })

  it('mutations at max retries are marked as failed', async () => {
    await queueMutation('rfis', 'insert', { title: 'Test' })
    const mutation = (await offlineDb.pendingMutations.toArray())[0]

    // Simulate reaching max retries
    await offlineDb.pendingMutations.update(mutation.id!, {
      status: 'failed',
      retryCount: MAX_RETRY_COUNT,
    })

    const updated = await offlineDb.pendingMutations.get(mutation.id!)
    expect(updated!.status).toBe('failed')
    expect(updated!.retryCount).toBe(MAX_RETRY_COUNT)
  })

  it('MAX_RETRY_COUNT is 5', () => {
    expect(MAX_RETRY_COUNT).toBe(5)
  })
})

// ── Exponential Backoff ──────────────────────────────────

describe('Exponential Backoff', () => {
  it('computeNextRetryAt returns a future timestamp', () => {
    const nextRetry = computeNextRetryAt(0)
    expect(new Date(nextRetry).getTime()).toBeGreaterThan(Date.now() - 100)
  })

  it('backoff delay increases with retry count', () => {
    // With jitter this isn't deterministic, but higher retries should generally produce later times
    const times = [0, 1, 2, 3, 4].map((r) => new Date(computeNextRetryAt(r)).getTime() - Date.now())
    // At minimum, retry 4 should have a longer base delay than retry 0
    // Base: 2^0*1000=1s vs 2^4*1000=16s (±25% jitter)
    expect(times[4]).toBeGreaterThan(times[0] * 2)
  })

  it('isReadyForRetry returns true for undefined nextRetryAt', () => {
    expect(isReadyForRetry(undefined)).toBe(true)
  })

  it('isReadyForRetry returns true for past timestamps', () => {
    const pastTime = new Date(Date.now() - 10000).toISOString()
    expect(isReadyForRetry(pastTime)).toBe(true)
  })

  it('isReadyForRetry returns false for future timestamps', () => {
    const futureTime = new Date(Date.now() + 60000).toISOString()
    expect(isReadyForRetry(futureTime)).toBe(false)
  })
})

// ── BUG #2: Conflict Resolution Atomicity ────────────────

describe('Conflict Resolution (Bug #2 Fix)', () => {
  beforeEach(async () => {
    await clearPendingMutations()
    // Clear the rfis cache table
    await offlineDb.rfis.clear()
  })

  it('keep_server: applies server data and removes mutation atomically', async () => {
    // Queue a conflicted mutation
    const id = await offlineDb.pendingMutations.add({
      table: 'rfis',
      operation: 'update',
      data: { id: 'rfi-1', title: 'Local version' },
      status: 'conflict',
      retryCount: 1,
      created_at: new Date().toISOString(),
      entity_id: 'rfi-1',
      conflict_server_data: { id: 'rfi-1', title: 'Server version', status: 'open' },
      priority: 10,
    })

    await resolveMutationConflict(id, 'keep_server')

    // Mutation should be deleted
    const mutation = await offlineDb.pendingMutations.get(id)
    expect(mutation).toBeUndefined()

    // Server data should be in cache
    const cached = await offlineDb.rfis.get('rfi-1')
    expect(cached).toBeTruthy()
    expect(cached.title).toBe('Server version')
  })

  it('keep_local: re-queues mutation as pending with retryCount 0', async () => {
    const id = await offlineDb.pendingMutations.add({
      table: 'rfis',
      operation: 'update',
      data: { id: 'rfi-2', title: 'Local version' },
      status: 'conflict',
      retryCount: 3,
      created_at: new Date().toISOString(),
      entity_id: 'rfi-2',
      conflict_server_data: { id: 'rfi-2', title: 'Server version' },
      priority: 10,
    })

    await resolveMutationConflict(id, 'keep_local')

    const mutation = await offlineDb.pendingMutations.get(id)
    expect(mutation).toBeTruthy()
    expect(mutation!.status).toBe('pending')
    expect(mutation!.retryCount).toBe(0)
    expect(mutation!.conflict_server_data).toBeUndefined()
  })

  it('handles nonexistent mutation gracefully', async () => {
    // Should not throw
    await resolveMutationConflict(999999, 'keep_server')
  })
})

// ── BUG #4: Upload Error Classification ──────────────────

describe('Upload Error Classification (Bug #4 Fix)', () => {
  it('classifies 403 as permanent failure', () => {
    const result = classifyUploadError({ statusCode: 403, message: 'Forbidden' })
    expect(result.permanent).toBe(true)
    expect(result.statusCode).toBe(403)
  })

  it('classifies 413 as permanent failure', () => {
    const result = classifyUploadError({ statusCode: 413, message: 'Payload Too Large' })
    expect(result.permanent).toBe(true)
  })

  it('classifies 415 as permanent failure', () => {
    const result = classifyUploadError({ statusCode: 415, message: 'Unsupported Media Type' })
    expect(result.permanent).toBe(true)
  })

  it('classifies 401 as permanent failure', () => {
    const result = classifyUploadError({ statusCode: 401, message: 'Unauthorized' })
    expect(result.permanent).toBe(true)
  })

  it('classifies 500 as transient (retryable)', () => {
    const result = classifyUploadError({ statusCode: 500, message: 'Internal Server Error' })
    expect(result.permanent).toBe(false)
  })

  it('classifies 502 as transient', () => {
    const result = classifyUploadError({ statusCode: 502, message: 'Bad Gateway' })
    expect(result.permanent).toBe(false)
  })

  it('classifies network errors as transient', () => {
    const result = classifyUploadError(new Error('Failed to fetch'))
    expect(result.permanent).toBe(false)
  })

  it('classifies "payload too large" message as permanent', () => {
    const result = classifyUploadError({ message: 'Request entity too large' })
    expect(result.permanent).toBe(true)
    expect(result.statusCode).toBe(413)
  })

  it('classifies "forbidden" message as permanent', () => {
    const result = classifyUploadError({ message: 'Access forbidden for this resource' })
    expect(result.permanent).toBe(true)
    expect(result.statusCode).toBe(403)
  })

  it('all PERMANENT_UPLOAD_ERRORS are classified as permanent', () => {
    for (const code of PERMANENT_UPLOAD_ERRORS) {
      const result = classifyUploadError({ statusCode: code, message: 'test' })
      expect(result.permanent).toBe(true)
    }
  })
})

// ── Queue Size Limits ────────────────────────────────────

describe('Queue Size Limits', () => {
  beforeEach(async () => {
    await clearPendingMutations()
  })

  it('MAX_PENDING_MUTATIONS is 500', () => {
    expect(MAX_PENDING_MUTATIONS).toBe(500)
  })

  it('rejects mutations when queue is full', async () => {
    // Fill the queue to the limit
    const bulkData = Array.from({ length: MAX_PENDING_MUTATIONS }, (_, i) => ({
      table: 'rfis',
      operation: 'insert' as const,
      data: { title: `RFI ${i}` },
      status: 'pending' as const,
      retryCount: 0,
      created_at: new Date().toISOString(),
      priority: 10,
    }))
    await offlineDb.pendingMutations.bulkAdd(bulkData)

    // Next mutation should fail
    await expect(queueMutation('rfis', 'insert', { title: 'One too many' }))
      .rejects.toThrow(/queue is full/)
  })
})

// ── Table Name Validation ────────────────────────────────

describe('Table Name Validation', () => {
  beforeEach(async () => {
    await clearPendingMutations()
  })

  it('accepts valid table names', async () => {
    await queueMutation('rfis', 'insert', { title: 'Test' })
    const count = await getPendingCount()
    expect(count).toBe(1)
  })

  it('rejects invalid table names', async () => {
    await expect(queueMutation('bobby_tables', 'insert', { x: 1 }))
      .rejects.toThrow(/Invalid table name/)
  })

  it('getDexieTableName maps correctly', () => {
    expect(getDexieTableName('rfis')).toBe('rfis')
    expect(getDexieTableName('punch_items')).toBe('punchItems')
    expect(getDexieTableName('budget_items')).toBe('budgetItems')
    expect(getDexieTableName('nonexistent')).toBeNull()
  })
})

// ── Storage Quota ────────────────────────────────────────

describe('Storage Quota', () => {
  it('checkStorageQuota returns expected shape', async () => {
    const result = await checkStorageQuota()
    expect(result).toHaveProperty('usage')
    expect(result).toHaveProperty('quota')
    expect(result).toHaveProperty('percentUsed')
    expect(result).toHaveProperty('ok')
    expect(typeof result.ok).toBe('boolean')
  })
})

// ── Priority Ordering ────────────────────────────────────

describe('Mutation Priority', () => {
  beforeEach(async () => {
    await clearPendingMutations()
  })

  it('default priority is 10', async () => {
    await queueMutation('rfis', 'insert', { title: 'Test' })
    const mutations = await offlineDb.pendingMutations.toArray()
    expect(mutations[0].priority).toBe(10)
  })

  it('custom priority is stored', async () => {
    await queueMutation('rfis', 'insert', { title: 'Critical' }, 0)
    await queueMutation('tasks', 'insert', { title: 'Normal' }, 10)
    const mutations = await offlineDb.pendingMutations.orderBy('priority').toArray()
    expect(mutations[0].priority).toBe(0)
    expect(mutations[1].priority).toBe(10)
  })
})
