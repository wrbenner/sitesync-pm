import Dexie, { type Table } from 'dexie'
import { supabase } from './supabase'
import { detectConflicts } from './conflictResolver'
import type { Database } from '../types/database'

// ── Configuration ────────────────────────────────────────

const MAX_PENDING_MUTATIONS = 500
const MAX_RETRY_COUNT = 5
const MAX_CACHE_RECORDS_PER_TABLE = 5000
const CACHE_RECORDS_DEFAULT = 1000
const STORAGE_QUOTA_WARNING_THRESHOLD = 0.85 // warn at 85% usage

// HTTP status codes that should never be retried
const PERMANENT_UPLOAD_ERRORS = new Set([401, 403, 413, 415, 422])

// ── Types ────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'failed'

export interface PendingMutation {
  id?: number
  table: string
  operation: 'insert' | 'update' | 'delete'
  data: Record<string, unknown>
  status: 'pending' | 'syncing' | 'failed' | 'conflict'
  retryCount: number
  created_at: string
  entity_id?: string
  conflict_server_data?: Record<string, unknown>
  conflict_base_data?: Record<string, unknown>
  conflict_conflicting_fields?: string[]
  nextRetryAt?: string
  priority: number // lower = higher priority. 0 = critical, 10 = normal
}

export interface BaseVersion {
  id: string // `${table}:${recordId}`
  table: string
  record_id: string
  data: Record<string, unknown>
  stored_at: string
}

export interface PendingUpload {
  id?: number
  fileName: string
  bucket: string
  path: string
  blob: Blob
  status: 'pending' | 'syncing' | 'failed' | 'permanent_failure'
  retryCount: number
  created_at: string
  lastError?: string
  nextRetryAt?: string
}

export interface SyncMetadata {
  key: string
  value: string
}

// ── Database ─────────────────────────────────────────────

export class SiteSyncOfflineDB extends Dexie {
  projects!: Table
  projectMembers!: Table
  rfis!: Table
  submittals!: Table
  punchItems!: Table
  tasks!: Table
  drawings!: Table
  dailyLogs!: Table
  crews!: Table
  budgetItems!: Table
  changeOrders!: Table
  meetings!: Table
  directoryContacts!: Table
  files!: Table
  fieldCaptures!: Table
  schedulePhases!: Table
  notifications!: Table
  activityFeed!: Table
  aiInsights!: Table
  pendingMutations!: Table<PendingMutation, number>
  pendingUploads!: Table<PendingUpload, number>
  syncMetadata!: Table<SyncMetadata, string>
  baseVersions!: Table<BaseVersion, string>

  constructor() {
    super('sitesync-offline')
    this.version(4).stores({
      projects: 'id, name, status',
      projectMembers: 'id, project_id, user_id',
      rfis: 'id, project_id, rfi_number, status',
      submittals: 'id, project_id, submittal_number, status',
      punchItems: 'id, project_id, number, status',
      tasks: 'id, project_id, status',
      drawings: 'id, project_id, discipline',
      dailyLogs: 'id, project_id, log_date',
      crews: 'id, project_id, status',
      budgetItems: 'id, project_id, division',
      changeOrders: 'id, project_id, status',
      meetings: 'id, project_id, date',
      directoryContacts: 'id, project_id, name',
      files: 'id, project_id, folder',
      fieldCaptures: 'id, project_id, created_at',
      schedulePhases: 'id, project_id, start_date',
      notifications: 'id, user_id, read',
      activityFeed: 'id, project_id, created_at',
      aiInsights: 'id, project_id, page, dismissed',
      pendingMutations: '++id, table, operation, status, created_at, entity_id, priority, nextRetryAt',
      pendingUploads: '++id, fileName, status, created_at, nextRetryAt',
      syncMetadata: 'key',
    })
    this.version(5).stores({
      projects: 'id, name, status',
      projectMembers: 'id, project_id, user_id',
      rfis: 'id, project_id, rfi_number, status',
      submittals: 'id, project_id, submittal_number, status',
      punchItems: 'id, project_id, number, status',
      tasks: 'id, project_id, status',
      drawings: 'id, project_id, discipline',
      dailyLogs: 'id, project_id, log_date',
      crews: 'id, project_id, status',
      budgetItems: 'id, project_id, division',
      changeOrders: 'id, project_id, status',
      meetings: 'id, project_id, date',
      directoryContacts: 'id, project_id, name',
      files: 'id, project_id, folder',
      fieldCaptures: 'id, project_id, created_at',
      schedulePhases: 'id, project_id, start_date',
      notifications: 'id, user_id, read',
      activityFeed: 'id, project_id, created_at',
      aiInsights: 'id, project_id, page, dismissed',
      pendingMutations: '++id, table, operation, status, created_at, entity_id, priority, nextRetryAt',
      pendingUploads: '++id, fileName, status, created_at, nextRetryAt',
      syncMetadata: 'key',
      baseVersions: 'id, table, record_id, stored_at',
    })
  }
}

export const offlineDb = new SiteSyncOfflineDB()

/** Type-safe dynamic table access for Dexie. Returns the Table or null if the name is unknown. */
function getDexieTable(name: string): Table | null {
  const db = offlineDb as Record<string, unknown>
  const table = db[name]
  if (table && typeof table === 'object' && 'toArray' in table) {
    return table as Table
  }
  return null
}

// ── Table name mapping (private) ─────────────────────────

const supabaseToDexie: Record<string, string> = {
  projects: 'projects',
  project_members: 'projectMembers',
  rfis: 'rfis',
  submittals: 'submittals',
  tasks: 'tasks',
  punch_items: 'punchItems',
  daily_logs: 'dailyLogs',
  drawings: 'drawings',
  crews: 'crews',
  budget_items: 'budgetItems',
  change_orders: 'changeOrders',
  meetings: 'meetings',
  directory_contacts: 'directoryContacts',
  files: 'files',
  field_captures: 'fieldCaptures',
  schedule_phases: 'schedulePhases',
}

const validTableNames = new Set(Object.keys(supabaseToDexie))

function getDexieTableName(supabaseTable: string): string | null {
  return supabaseToDexie[supabaseTable] ?? null
}

// ── Storage Quota ────────────────────────────────────────

export async function checkStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number; ok: boolean }> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0, percentUsed: 0, ok: true }
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  const percentUsed = quota > 0 ? usage / quota : 0
  return { usage, quota, percentUsed, ok: percentUsed < STORAGE_QUOTA_WARNING_THRESHOLD }
}

// ── Sync Metadata ────────────────────────────────────────

export async function getLastSyncTimestamp(): Promise<Date | null> {
  const meta = await offlineDb.syncMetadata.get('lastSync')
  return meta ? new Date(meta.value) : null
}

export async function setLastSyncTimestamp(date: Date) {
  await offlineDb.syncMetadata.put({ key: 'lastSync', value: date.toISOString() })
}

export async function getSyncMetadata(key: string): Promise<string | null> {
  const meta = await offlineDb.syncMetadata.get(key)
  return meta?.value ?? null
}

export async function setSyncMetadata(key: string, value: string) {
  await offlineDb.syncMetadata.put({ key, value })
}

// ── Base Version Cache ───────────────────────────────────
// Stores the last-known server state of a record so three-way merge is possible.

export async function storeBaseVersion(
  table: string,
  recordId: string,
  data: Record<string, unknown>
): Promise<void> {
  await offlineDb.baseVersions.put({
    id: `${table}:${recordId}`,
    table,
    record_id: recordId,
    data,
    stored_at: new Date().toISOString(),
  })
}

export async function getBaseVersion(
  table: string,
  recordId: string
): Promise<Record<string, unknown> | null> {
  const entry = await offlineDb.baseVersions.get(`${table}:${recordId}`)
  return entry?.data ?? null
}

export async function deleteBaseVersion(table: string, recordId: string): Promise<void> {
  await offlineDb.baseVersions.delete(`${table}:${recordId}`)
}

// ── Exponential Backoff ──────────────────────────────────

function computeNextRetryAt(retryCount: number): string {
  // 2^retry * 1000ms base: 1s, 2s, 4s, 8s, 16s
  const delayMs = Math.min(Math.pow(2, retryCount) * 1000, 60_000)
  // Add jitter: ±25%
  const jitter = delayMs * (0.75 + (crypto.getRandomValues(new Uint16Array(1))[0] / 65535) * 0.5)
  return new Date(Date.now() + jitter).toISOString()
}

function isReadyForRetry(nextRetryAt: string | undefined): boolean {
  if (!nextRetryAt) return true
  return new Date(nextRetryAt).getTime() <= Date.now()
}

// ── Mutation Queue ───────────────────────────────────────

export async function queueMutation(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: Record<string, unknown>,
  priority: number = 10
): Promise<void> {
  // Validate table name
  if (!validTableNames.has(table)) {
    throw new Error(`Invalid table name for offline queue: "${table}". Must be one of: ${Array.from(validTableNames).join(', ')}`)
  }

  // Check queue size limit
  const currentCount = await offlineDb.pendingMutations.count()
  if (currentCount >= MAX_PENDING_MUTATIONS) {
    throw new Error(`Offline mutation queue is full (${MAX_PENDING_MUTATIONS} items). Please sync before making more changes.`)
  }

  // Check storage quota
  const quota = await checkStorageQuota()
  if (!quota.ok) {
    console.warn(`Storage quota at ${Math.round(quota.percentUsed * 100)}%. Offline cache may be unreliable.`)
  }

  const entityId = (data.id as string) || undefined
  await offlineDb.pendingMutations.add({
    table,
    operation,
    data,
    status: 'pending',
    retryCount: 0,
    created_at: new Date().toISOString(),
    entity_id: entityId,
    priority,
  })
}

export async function getPendingCount(): Promise<number> {
  return offlineDb.pendingMutations.where('status').anyOf('pending', 'failed').count()
}

export async function getConflictCount(): Promise<number> {
  return offlineDb.pendingMutations.where('status').equals('conflict').count()
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  return offlineDb.pendingMutations.orderBy('created_at').toArray()
}

export async function getConflicts(): Promise<PendingMutation[]> {
  return offlineDb.pendingMutations.where('status').equals('conflict').toArray()
}

export async function clearPendingMutations() {
  await offlineDb.pendingMutations.clear()
}

export async function retryMutation(id: number): Promise<void> {
  await offlineDb.pendingMutations.update(id, {
    status: 'pending' as const,
    retryCount: 0,
    nextRetryAt: undefined,
  })
}

// ── Conflict Resolution (BUG #2 FIX: atomic transaction) ─

export async function resolveMutationConflict(
  mutationId: number,
  resolution: 'keep_local' | 'keep_server' | 'use_merged',
  mergedData?: Record<string, unknown>
): Promise<void> {
  const mutation = await offlineDb.pendingMutations.get(mutationId)
  if (!mutation) return

  const dexieTableName = getDexieTableName(mutation.table)

  if (resolution === 'keep_server') {
    // Atomic: apply server data to cache AND delete mutation in one transaction
    const tablesToTouch: Table[] = [offlineDb.pendingMutations]
    const resolvedTable = dexieTableName ? getDexieTable(dexieTableName) : null
    if (resolvedTable) {
      tablesToTouch.push(resolvedTable)
    }
    await offlineDb.transaction('rw', tablesToTouch, async () => {
      if (mutation.conflict_server_data && mutation.entity_id && resolvedTable) {
        await resolvedTable.put(mutation.conflict_server_data)
      }
      await offlineDb.pendingMutations.delete(mutationId)
    })
    if (mutation.entity_id) {
      await deleteBaseVersion(mutation.table, mutation.entity_id)
    }
  } else if (resolution === 'use_merged' && mergedData) {
    // Apply merged data to cache and re-queue with merged payload
    const tablesToTouch: Table[] = [offlineDb.pendingMutations]
    const mergeTable = dexieTableName ? getDexieTable(dexieTableName) : null
    if (mergeTable) {
      tablesToTouch.push(mergeTable)
    }
    await offlineDb.transaction('rw', tablesToTouch, async () => {
      if (mergeTable && mutation.entity_id) {
        await mergeTable.put(mergedData)
      }
      await offlineDb.pendingMutations.update(mutationId, {
        status: 'pending',
        data: mergedData,
        retryCount: 0,
        conflict_server_data: undefined,
        conflict_base_data: undefined,
        conflict_conflicting_fields: undefined,
      })
    })
  } else {
    // keep_local: re-queue original local data for sync
    await offlineDb.pendingMutations.update(mutationId, {
      status: 'pending',
      retryCount: 0,
      conflict_server_data: undefined,
      conflict_base_data: undefined,
      conflict_conflicting_fields: undefined,
    })
  }
}

// Status field names that use last-write-wins conflict resolution
const STATUS_FIELDS = ['status', 'priority', 'is_read', 'read', 'dismissed']

function isStatusOnlyChange(data: Record<string, unknown>): boolean {
  const keys = Object.keys(data).filter((k) => k !== 'id' && k !== 'updated_at')
  return keys.length > 0 && keys.every((k) => STATUS_FIELDS.includes(k))
}

// ── Sync Queue Processing (BUG #1 FIX: retry logic) ─────

export type SyncProgressCallback = (progress: {
  total: number
  completed: number
  current: string
  synced: number
  failed: number
  conflicts: number
}) => void

export async function processSyncQueue(
  onProgress?: SyncProgressCallback
): Promise<{ synced: number; failed: number; conflicts: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0, conflicts: 0 }

  // const now = new Date().toISOString()
  const pending = await offlineDb.pendingMutations
    .where('status')
    .anyOf('pending', 'failed')
    .toArray()

  // Filter to only items ready for retry (respecting backoff) and sort by priority
  const ready = pending
    .filter((m) => isReadyForRetry(m.nextRetryAt))
    .sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10))

  let synced = 0
  let failed = 0
  let conflicts = 0
  const total = ready.length

  for (const m of ready) {
    onProgress?.({
      total,
      completed: synced + failed + conflicts,
      current: `${m.operation} ${m.table}`,
      synced, failed, conflicts,
    })

    try {
      await offlineDb.pendingMutations.update(m.id!, { status: 'syncing' })
      // Dynamic table name requires casting; the table name is validated against validTableNames on enqueue
      const from = supabase.from(m.table as keyof Database['public']['Tables'])

      if (m.operation === 'insert') {
        const { error } = await from.insert(m.data)
        if (error) throw error
      } else if (m.operation === 'update' && m.data.id) {
        // Fetch current server version to check for conflicts
        const { data: serverRow } = await from
          .select('*')
          .eq('id', m.data.id)
          .single()

        if (serverRow && serverRow.updated_at) {
          const serverUpdated = new Date(serverRow.updated_at).getTime()
          const localTimestamp = new Date(m.created_at).getTime()

          if (serverUpdated > localTimestamp) {
            if (isStatusOnlyChange(m.data)) {
              // Status-only fields use last-write-wins: always apply local
              const { id, ...updates } = m.data
              const { error } = await from.update(updates).eq('id', id)
              if (error) throw error
            } else {
              // Attempt three-way merge using the cached base version
              const base = m.conflict_base_data ?? await getBaseVersion(m.table, String(m.data.id))
              if (base) {
                const { canAutoMerge, conflictingFields, merged } = detectConflicts(
                  base,
                  m.data,
                  serverRow
                )
                if (canAutoMerge) {
                  // Non-conflicting changes on both sides: apply merged result silently
                  const mergedRecord = merged as Record<string, unknown>
                  const mergedId = mergedRecord.id
                  const mergedUpdates = Object.fromEntries(
                    Object.entries(mergedRecord).filter(([k]) => k !== 'id' && k !== 'updated_at')
                  )
                  const { error } = await from.update(mergedUpdates).eq('id', mergedId as string)
                  if (error) throw error
                  // Keep local cache in sync with the merged record
                  const dexieTableName = getDexieTableName(m.table)
                  if (dexieTableName) {
                    const cacheTable = getDexieTable(dexieTableName)
                    if (cacheTable) await cacheTable.put(merged)
                  }
                  if (m.entity_id) await deleteBaseVersion(m.table, m.entity_id)
                } else {
                  // Real conflict on one or more fields: surface to user
                  await offlineDb.pendingMutations.update(m.id!, {
                    status: 'conflict',
                    conflict_server_data: serverRow,
                    conflict_base_data: base,
                    conflict_conflicting_fields: conflictingFields,
                  })
                  conflicts++
                  continue
                }
              } else {
                // No base version available: cannot three-way merge, surface as conflict
                await offlineDb.pendingMutations.update(m.id!, {
                  status: 'conflict',
                  conflict_server_data: serverRow,
                  conflict_conflicting_fields: [],
                })
                conflicts++
                continue
              }
            }
          } else {
            const { id, ...updates } = m.data
            const { error } = await from.update(updates).eq('id', id)
            if (error) throw error
          }
        } else {
          const { id, ...updates } = m.data
          const { error } = await from.update(updates).eq('id', id)
          if (error) throw error
        }
      } else if (m.operation === 'delete' && m.data.id) {
        const { error } = await from.delete().eq('id', m.data.id)
        if (error) throw error
      }

      await offlineDb.pendingMutations.delete(m.id!)
      synced++
    } catch {
      // BUG #1 FIX: Retry with exponential backoff, not immediate failure
      const retryCount = (m.retryCount || 0) + 1
      if (retryCount >= MAX_RETRY_COUNT) {
        // Max retries reached: mark as permanently failed
        await offlineDb.pendingMutations.update(m.id!, {
          status: 'failed',
          retryCount,
        })
      } else {
        // Still has retries left: keep as pending with backoff timestamp
        await offlineDb.pendingMutations.update(m.id!, {
          status: 'pending',
          retryCount,
          nextRetryAt: computeNextRetryAt(retryCount),
        })
      }
      failed++
    }
  }

  if (synced > 0) {
    await setLastSyncTimestamp(new Date())
  }

  onProgress?.({ total, completed: total, current: 'done', synced, failed, conflicts })
  return { synced, failed, conflicts }
}

// ── File Upload Queue (BUG #4 FIX: error classification) ─

export async function queueFileUpload(fileName: string, bucket: string, path: string, blob: Blob) {
  // Check queue size
  const count = await offlineDb.pendingUploads.count()
  if (count >= MAX_PENDING_MUTATIONS) {
    throw new Error('Upload queue is full. Please sync before uploading more files.')
  }

  await offlineDb.pendingUploads.add({
    fileName,
    bucket,
    path,
    blob,
    status: 'pending',
    retryCount: 0,
    created_at: new Date().toISOString(),
  })
}

function classifyUploadError(error: unknown): { permanent: boolean; statusCode: number } {
  // Extract HTTP status from Supabase storage error
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    const statusCode = (e.statusCode ?? e.status ?? e.httpStatus ?? 0) as number

    if (typeof statusCode === 'number' && PERMANENT_UPLOAD_ERRORS.has(statusCode)) {
      return { permanent: true, statusCode }
    }

    // Check error message for known permanent failures
    const msg = String((e as Record<string, unknown>).message ?? '').toLowerCase()
    if (msg.includes('payload too large') || msg.includes('entity too large')) {
      return { permanent: true, statusCode: 413 }
    }
    if (msg.includes('unauthorized') || msg.includes('forbidden')) {
      return { permanent: true, statusCode: 403 }
    }

    return { permanent: false, statusCode }
  }
  return { permanent: false, statusCode: 0 }
}

export async function processUploadQueue(): Promise<{ uploaded: number; failed: number; permanentFailures: number }> {
  if (!navigator.onLine) return { uploaded: 0, failed: 0, permanentFailures: 0 }

  const pending = await offlineDb.pendingUploads
    .where('status')
    .anyOf('pending', 'failed')
    .toArray()

  const ready = pending.filter((u) => isReadyForRetry(u.nextRetryAt))

  let uploaded = 0
  let failed = 0
  let permanentFailures = 0

  for (const u of ready) {
    try {
      await offlineDb.pendingUploads.update(u.id!, { status: 'syncing' })
      const file = new File([u.blob], u.fileName)
      const { error } = await supabase.storage.from(u.bucket).upload(u.path, file, { upsert: true })
      if (error) throw error
      await offlineDb.pendingUploads.delete(u.id!)
      uploaded++
    } catch (err) {
      const { permanent, statusCode } = classifyUploadError(err)
      const retryCount = (u.retryCount || 0) + 1

      if (permanent) {
        // Permanent error: never retry (auth, permissions, file too large, wrong type)
        await offlineDb.pendingUploads.update(u.id!, {
          status: 'permanent_failure' as PendingUpload['status'],
          retryCount,
          lastError: `HTTP ${statusCode}: ${(err as Error).message}`,
        })
        permanentFailures++
      } else if (retryCount >= MAX_RETRY_COUNT) {
        // Max retries exhausted
        await offlineDb.pendingUploads.update(u.id!, {
          status: 'failed',
          retryCount,
          lastError: (err as Error).message,
        })
        failed++
      } else {
        // Transient error: retry with backoff
        await offlineDb.pendingUploads.update(u.id!, {
          status: 'pending',
          retryCount,
          nextRetryAt: computeNextRetryAt(retryCount),
          lastError: (err as Error).message,
        })
        failed++
      }
    }
  }
  return { uploaded, failed, permanentFailures }
}

// ── Project Data Caching (BUG #3 FIX: no silent errors) ──

const CACHEABLE_TABLES = [
  'rfis', 'submittals', 'tasks', 'punch_items', 'daily_logs', 'drawings',
  'crews', 'budget_items', 'change_orders', 'meetings', 'directory_contacts',
  'files', 'field_captures', 'schedule_phases', 'project_members',
]

export type CacheProgressCallback = (progress: {
  total: number
  completed: number
  currentTable: string
}) => void

export interface CacheResult {
  cached: number
  tables: number
  failed: number
  errors: string[]
  truncatedTables: string[]
}

export async function cacheProjectData(
  projectId: string,
  onProgress?: CacheProgressCallback,
  recordLimit: number = CACHE_RECORDS_DEFAULT
): Promise<CacheResult> {
  if (!navigator.onLine) return { cached: 0, tables: 0, failed: 0, errors: [], truncatedTables: [] }

  // Check quota before starting
  const quota = await checkStorageQuota()
  if (!quota.ok) {
    console.warn(`Storage quota at ${Math.round(quota.percentUsed * 100)}% before caching. Some data may not be cached.`)
  }

  const clampedLimit = Math.min(Math.max(recordLimit, 100), MAX_CACHE_RECORDS_PER_TABLE)

  let totalCached = 0
  let tablesCompleted = 0
  let tablesFailed = 0
  const errors: string[] = []
  const truncatedTables: string[] = []
  const total = CACHEABLE_TABLES.length + 1

  // Cache the project record
  onProgress?.({ total, completed: 0, currentTable: 'projects' })
  try {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single()
    if (error) throw error
    if (data) {
      await offlineDb.projects.put(data)
      totalCached++
    }
  } catch (err) {
    errors.push(`projects: ${(err as Error).message}`)
    tablesFailed++
  }
  tablesCompleted++

  // Cache all project-scoped tables
  for (const supaTable of CACHEABLE_TABLES) {
    const dexieTable = getDexieTableName(supaTable)
    if (!dexieTable) continue

    onProgress?.({ total, completed: tablesCompleted, currentTable: supaTable })

    try {
      const { data, error } = await supabase
        .from(supaTable as keyof Database['public']['Tables'])
        .select('*')
        .eq('project_id', projectId)
        .limit(clampedLimit)
      if (error) throw error

      if (data?.length) {
        // Check if results were truncated
        if (data.length >= clampedLimit) {
          truncatedTables.push(supaTable)
          console.warn(`Cache truncated for ${supaTable}: ${data.length} records (limit: ${clampedLimit}). Increase recordLimit to cache all data.`)
        }
        const cacheTable = getDexieTable(dexieTable)
        if (cacheTable) await cacheTable.bulkPut(data)
        totalCached += data.length
      }
    } catch (err) {
      errors.push(`${supaTable}: ${(err as Error).message}`)
      tablesFailed++
    }
    tablesCompleted++
  }

  await setLastSyncTimestamp(new Date())
  await setSyncMetadata(`lastSync:${projectId}`, new Date().toISOString())

  onProgress?.({ total, completed: tablesCompleted, currentTable: 'done' })
  return { cached: totalCached, tables: tablesCompleted - tablesFailed, failed: tablesFailed, errors, truncatedTables }
}

// ── Cache Read/Write ─────────────────────────────────────

export async function getFromCache<T>(tableName: string, projectId?: string): Promise<T[]> {
  const dexieTableName = getDexieTableName(tableName)
  if (!dexieTableName) return []
  const table = getDexieTable(dexieTableName)
  if (!table) return []
  if (projectId) {
    return table.where('project_id').equals(projectId).toArray()
  }
  return table.toArray()
}

export async function getOneFromCache<T>(tableName: string, id: string): Promise<T | undefined> {
  const dexieTableName = getDexieTableName(tableName)
  if (!dexieTableName) return undefined
  const table = getDexieTable(dexieTableName)
  if (!table) return undefined
  return table.get(id)
}

export async function writeToCache(tableName: string, data: Record<string, unknown>) {
  const dexieTableName = getDexieTableName(tableName)
  if (!dexieTableName) return
  const table = getDexieTable(dexieTableName)
  if (!table) return
  await table.put(data)
}

// ── Exports for tests ────────────────────────────────────

export {
  MAX_PENDING_MUTATIONS,
  MAX_RETRY_COUNT,
  PERMANENT_UPLOAD_ERRORS,
  computeNextRetryAt,
  classifyUploadError,
  getDexieTableName,
  isReadyForRetry,
}
