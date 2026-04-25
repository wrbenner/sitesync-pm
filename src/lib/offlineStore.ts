// Core offline store using raw IndexedDB API (no Dexie dependency)
// Provides: get, put, delete, getAll, query for each table
// Tables: punch_items, rfis, submittals, daily_logs, change_orders

// ── Types ────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete'

export interface OfflineRecord {
  id: string
  table: string
  data: Record<string, unknown>
  syncStatus: SyncStatus
  lastModified: number // timestamp
  conflictData?: Record<string, unknown> // server version if conflict detected
}

export const TABLES = [
  'punch_items',
  'rfis',
  'submittals',
  'daily_logs',
  'change_orders',
] as const

export type TableName = (typeof TABLES)[number]

// ── Constants ────────────────────────────────────────────

const DB_NAME = 'sitesync-offline-store'
const DB_VERSION = 1
const OBJECT_STORE_NAME = 'records'

// ── Database singleton ───────────────────────────────────

let dbInstance: IDBDatabase | null = null
let openPromise: Promise<IDBDatabase> | null = null

/**
 * Open (or upgrade) the IndexedDB database.
 * Returns a cached connection on subsequent calls.
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)
  if (openPromise) return openPromise

  openPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        const store = db.createObjectStore(OBJECT_STORE_NAME, {
          keyPath: ['table', 'id'],
        })
        // Index for querying all records in a table
        store.createIndex('by_table', 'table', { unique: false })
        // Index for fetching records that need syncing
        store.createIndex('by_syncStatus', 'syncStatus', { unique: false })
        // Compound index: table + syncStatus
        store.createIndex('by_table_syncStatus', ['table', 'syncStatus'], {
          unique: false,
        })
      }
    }

    request.onsuccess = () => {
      dbInstance = request.result

      // Reset singleton on unexpected close so we re-open next time
      dbInstance.onclose = () => {
        dbInstance = null
        openPromise = null
      }

      resolve(dbInstance)
    }

    request.onerror = () => {
      openPromise = null
      reject(request.error)
    }
  })

  return openPromise
}

// ── Helper: run a transaction ────────────────────────────

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(OBJECT_STORE_NAME, mode)
        const store = tx.objectStore(OBJECT_STORE_NAME)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

function withStoreIndex<T>(
  indexName: string,
  fn: (index: IDBIndex) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(OBJECT_STORE_NAME, 'readonly')
        const store = tx.objectStore(OBJECT_STORE_NAME)
        const index = store.index(indexName)
        const req = fn(index)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

// ── Public API ───────────────────────────────────────────

/**
 * Upsert a record with automatic sync-status tracking.
 * - If the record doesn't exist yet, sets syncStatus to `pending_create`.
 * - If it already exists, sets syncStatus to `pending_update`.
 * - If it already exists and is synced, marks it `pending_update`.
 */
export async function putRecord(
  table: TableName,
  data: Record<string, unknown>,
): Promise<OfflineRecord> {
  const id = (data['id'] as string | undefined) ?? crypto.randomUUID()
  const existing = await getRecord(table, id)

  const syncStatus: SyncStatus =
    existing == null
      ? 'pending_create'
      : existing.syncStatus === 'pending_create'
        ? 'pending_create' // keep original intent
        : 'pending_update'

  const record: OfflineRecord = {
    id,
    table,
    data: { ...data, id },
    syncStatus,
    lastModified: Date.now(),
    conflictData: existing?.conflictData,
  }

  await withStore('readwrite', (store) => store.put(record))
  return record
}

/**
 * Get a single record by table + id.
 */
export async function getRecord(
  table: TableName,
  id: string,
): Promise<OfflineRecord | undefined> {
  const result = await withStore<OfflineRecord | undefined>(
    'readonly',
    (store) => store.get([table, id]),
  )
  return result ?? undefined
}

/**
 * Get all records for a given table (excludes pending_delete by default).
 */
export async function getAllRecords(
  table: TableName,
  includeDeleted = false,
): Promise<OfflineRecord[]> {
  const all = await withStoreIndex<OfflineRecord[]>('by_table', (index) =>
    index.getAll(table),
  )
  if (includeDeleted) return all ?? []
  return (all ?? []).filter((r) => r.syncStatus !== 'pending_delete')
}

/**
 * Soft-delete a record. The record remains in IndexedDB with
 * syncStatus = 'pending_delete' until the sync engine confirms
 * deletion on the server.
 */
export async function deleteRecord(
  table: TableName,
  id: string,
): Promise<void> {
  const existing = await getRecord(table, id)
  if (!existing) return

  // If it was never synced to the server, just hard-delete locally.
  if (existing.syncStatus === 'pending_create') {
    await withStore('readwrite', (store) => store.delete([table, id]))
    return
  }

  const updated: OfflineRecord = {
    ...existing,
    syncStatus: 'pending_delete',
    lastModified: Date.now(),
  }
  await withStore('readwrite', (store) => store.put(updated))
}

/**
 * Get all records that need to be synced to the server.
 */
export async function getPendingSync(): Promise<OfflineRecord[]> {
  const db = await openDB()
  return new Promise<OfflineRecord[]>((resolve, reject) => {
    const tx = db.transaction(OBJECT_STORE_NAME, 'readonly')
    const store = tx.objectStore(OBJECT_STORE_NAME)
    const index = store.index('by_syncStatus')

    const results: OfflineRecord[] = []
    const statuses: SyncStatus[] = [
      'pending_create',
      'pending_update',
      'pending_delete',
    ]

    let completed = 0

    for (const status of statuses) {
      const req = index.getAll(status)
      req.onsuccess = () => {
        results.push(...(req.result as OfflineRecord[]))
        completed++
        if (completed === statuses.length) {
          // Sort by lastModified so we sync in order
          results.sort((a, b) => a.lastModified - b.lastModified)
          resolve(results)
        }
      }
      req.onerror = () => reject(req.error)
    }
  })
}

/**
 * Mark a record as synced after a successful server sync.
 * For pending_delete records, performs a hard delete.
 */
export async function markSynced(table: TableName, id: string): Promise<void> {
  const existing = await getRecord(table, id)
  if (!existing) return

  if (existing.syncStatus === 'pending_delete') {
    // Remove entirely — the server has confirmed deletion
    await withStore('readwrite', (store) => store.delete([table, id]))
    return
  }

  const updated: OfflineRecord = {
    ...existing,
    syncStatus: 'synced',
    lastModified: Date.now(),
    conflictData: undefined,
  }
  await withStore('readwrite', (store) => store.put(updated))
}

/**
 * Store a conflict: keep the server version alongside local data.
 */
export async function markConflict(
  table: TableName,
  id: string,
  serverData: Record<string, unknown>,
): Promise<void> {
  const existing = await getRecord(table, id)
  if (!existing) return

  const updated: OfflineRecord = {
    ...existing,
    conflictData: serverData,
    lastModified: Date.now(),
  }
  await withStore('readwrite', (store) => store.put(updated))
}

/**
 * Resolve a conflict by choosing local or server version.
 */
export async function resolveConflict(
  table: TableName,
  id: string,
  pick: 'local' | 'server',
): Promise<void> {
  const existing = await getRecord(table, id)
  if (!existing) return

  const data =
    pick === 'server' && existing.conflictData
      ? existing.conflictData
      : existing.data

  const updated: OfflineRecord = {
    ...existing,
    data,
    syncStatus: pick === 'server' ? 'synced' : 'pending_update',
    conflictData: undefined,
    lastModified: Date.now(),
  }
  await withStore('readwrite', (store) => store.put(updated))
}

/**
 * Clear all records in a specific table.
 */
export async function clearTable(table: TableName): Promise<void> {
  const records = await getAllRecords(table, true)
  const db = await openDB()

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite')
    const store = tx.objectStore(OBJECT_STORE_NAME)

    for (const record of records) {
      store.delete([record.table, record.id])
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Get all records that have conflict data.
 */
export async function getConflicts(): Promise<OfflineRecord[]> {
  // No index for conflicts, so we scan all records
  const db = await openDB()
  return new Promise<OfflineRecord[]>((resolve, reject) => {
    const tx = db.transaction(OBJECT_STORE_NAME, 'readonly')
    const store = tx.objectStore(OBJECT_STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => {
      const all = req.result as OfflineRecord[]
      resolve(all.filter((r) => r.conflictData != null))
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get the count of pending (unsynced) records.
 */
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingSync()
  return pending.length
}

/**
 * Destroy the database entirely. Useful for logout / cache-clear.
 */
export function destroyDB(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (dbInstance) {
      dbInstance.close()
      dbInstance = null
      openPromise = null
    }
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
