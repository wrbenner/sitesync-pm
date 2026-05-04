// =============================================================================
// Durable offline capture queue
// =============================================================================
// IndexedDB-backed write-then-sync queue for field captures (photos, voice
// memos, observations, RFI drafts, punch items).
//
// Guarantees:
//   1. Write to IndexedDB BEFORE any network call. The capture is durable
//      from the moment the super taps "save" — survives force-quit, battery
//      death, app crash, OS reboot.
//   2. Idempotent replays. Each row carries a content-derived hash; a
//      retry never double-creates server-side because the sync handler
//      uses upsert keyed on (project_id, content_hash).
//   3. Exponential backoff up to 14 days. A job ends in 14 days; longer
//      retries are pointless and waste battery.
//   4. Multi-device safe. Items are user+device keyed for inspection but
//      synced rows are dedup'd by content_hash, not by device.
//   5. Background sync via service worker — when the SW is registered, the
//      queue continues draining even when the app tab is closed.
//
// This file is the *engine*. The service worker (public/sw-field-capture.js)
// imports the same drainOnce() entrypoint via a thin Deno-friendly wrapper.
// The component (QueueDepthIndicator.tsx) reads queueDepth() to render
// the topbar pill.
// =============================================================================

const DB_NAME = 'sitesync-field-capture'
const DB_VERSION = 1
const STORE = 'queue'

const MAX_RETRY_AGE_MS = 14 * 24 * 60 * 60 * 1000  // 14 days
const BASE_DELAY_MS = 2 * 1000                      // 2 seconds
const MAX_DELAY_MS = 30 * 60 * 1000                 // 30 min cap on individual backoff

export interface QueueItem<T = unknown> {
  /** UUID — generated on enqueue. */
  id: string
  /** Server-side bucket: 'photo' | 'voice' | 'observation' | 'rfi_draft' | 'punch_item'. */
  kind: string
  /** Content-addressed hash. Used both as the IndexedDB unique constraint
   *  and as the upsert key on the server. SHA-256(JSON.stringify(payload)). */
  content_hash: string
  /** The actual payload to send to the server. */
  payload: T
  /** Caller-supplied — usually the auth user id. Lets the queue UI scope
   *  itself per user when multiple users share a tablet. */
  user_id: string
  /** Caller-supplied — a stable per-device key (random UUID stored in
   *  localStorage). Useful for debugging "which device queued this?" */
  device_id: string
  /** When the user actually captured the data, NOT when it was queued. */
  client_recorded_at: string
  /** When this row was first inserted into the queue. */
  created_at: string
  /** Number of failed sync attempts so far. */
  attempts: number
  /** When the next attempt should run. Set by scheduleNext() after a failure. */
  next_attempt_at: string
  /** Last error message (if any). For UI inspection. */
  last_error?: string
  /** 'queued' | 'syncing' | 'failed_permanent'. */
  status: 'queued' | 'syncing' | 'failed_permanent'
}

let _dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('content_hash', 'content_hash', { unique: true })
        store.createIndex('status_next_attempt', ['status', 'next_attempt_at'])
        store.createIndex('user_id', 'user_id')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'))
  })
  return _dbPromise
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle
  if (!subtle) throw new Error('crypto.subtle unavailable')
  const buf = new TextEncoder().encode(input)
  const hash = await subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Random UUID, falls back to a manual implementation in older runtimes. */
function makeUuid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Enqueue a new capture. Returns the persisted item (with id + content_hash).
 *
 * If an item with the same content_hash already exists, returns the existing
 * one without creating a duplicate. This is the offline equivalent of the
 * server's idempotent upsert — and it means double-tap on "save" doesn't
 * produce two photos.
 */
export async function enqueue<T>(
  input: {
    kind: string
    payload: T
    user_id: string
    device_id: string
    client_recorded_at?: string
  },
): Promise<QueueItem<T>> {
  const db = await openDb()
  const content_hash = await sha256Hex(JSON.stringify({ kind: input.kind, payload: input.payload }))
  const now = new Date().toISOString()

  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite')
    const idx = store.index('content_hash')
    const dupReq = idx.get(content_hash)
    dupReq.onsuccess = () => {
      if (dupReq.result) {
        resolve(dupReq.result as QueueItem<T>)
        return
      }
      const item: QueueItem<T> = {
        id: makeUuid(),
        kind: input.kind,
        content_hash,
        payload: input.payload,
        user_id: input.user_id,
        device_id: input.device_id,
        client_recorded_at: input.client_recorded_at ?? now,
        created_at: now,
        attempts: 0,
        next_attempt_at: now,
        status: 'queued',
      }
      const put = store.put(item)
      put.onsuccess = () => resolve(item)
      put.onerror = () => reject(put.error)
    }
    dupReq.onerror = () => reject(dupReq.error)
  })
}

/** Read all items for inspection or UI. */
export async function listAll(): Promise<QueueItem[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly')
    const req = store.getAll()
    req.onsuccess = () => resolve((req.result ?? []) as unknown as QueueItem[])
    req.onerror = () => reject(req.error)
  })
}

/** Number of items currently queued (status='queued', regardless of next_attempt). */
export async function queueDepth(): Promise<number> {
  const all = await listAll()
  return all.filter(i => i.status === 'queued').length
}

/** Items ready to sync now (status='queued' AND next_attempt_at <= now). */
export async function readyItems(): Promise<QueueItem[]> {
  const all = await listAll()
  const now = Date.now()
  return all.filter(i =>
    i.status === 'queued' && new Date(i.next_attempt_at).getTime() <= now,
  )
}

/** Compute the next backoff delay. Exponential, capped, jittered. */
export function nextDelayMs(attempts: number): number {
  const exp = BASE_DELAY_MS * Math.pow(2, attempts)
  const capped = Math.min(MAX_DELAY_MS, exp)
  const jitter = Math.random() * capped * 0.2  // ±20%
  return Math.round(capped - jitter / 2 + jitter)
}

/** Mark an item as syncing (so a concurrent worker doesn't pick it up). */
async function markSyncing(item: QueueItem): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite')
    const req = store.put({ ...item, status: 'syncing' })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Successful sync — remove from queue. */
export async function dequeue(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Failed sync — schedule a retry, or mark permanent if past 14 days. */
export async function recordFailure(item: QueueItem, errorMessage: string): Promise<void> {
  const db = await openDb()
  const ageMs = Date.now() - new Date(item.created_at).getTime()
  const next: QueueItem = {
    ...item,
    attempts: item.attempts + 1,
    last_error: errorMessage,
    status: ageMs > MAX_RETRY_AGE_MS ? 'failed_permanent' : 'queued',
    next_attempt_at: new Date(Date.now() + nextDelayMs(item.attempts)).toISOString(),
  }
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite')
    const req = store.put(next)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export type SyncHandler = (item: QueueItem) => Promise<void>

/**
 * Drain ready items once. Caller passes a sync handler that posts to the
 * server. Successes are dequeued; failures get a backoff + retry slot.
 *
 * Returns counts so a caller (component or service worker) can log progress.
 */
export async function drainOnce(handler: SyncHandler): Promise<{ ok: number; failed: number }> {
  const items = await readyItems()
  let ok = 0
  let failed = 0
  for (const item of items) {
    try {
      await markSyncing(item)
      await handler(item)
      await dequeue(item.id)
      ok += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await recordFailure(item, msg)
      failed += 1
    }
  }
  return { ok, failed }
}

/** Test-only helper to clear the database between runs. */
export async function _resetForTests(): Promise<void> {
  // Close any open connection so deleteDatabase can proceed (otherwise the
  // request blocks and the test runner times out).
  if (_dbPromise) {
    try {
      const db = await _dbPromise
      db.close()
    } catch { /* ignore */ }
  }
  _dbPromise = null
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    // Resolve on error/blocked too — fake-indexeddb sometimes fires neither
    // when the store didn't exist; we just want a clean slate.
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}
