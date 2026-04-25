// Background sync engine
// Watches navigator.onLine, queues mutations, syncs when connectivity returns

import {
  getPendingSync,
  markSynced,
  markConflict,
  getConflicts,
  getPendingCount,
  type OfflineRecord,
  type TableName,
} from './offlineStore'
import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────

export interface SyncResult {
  synced: number
  conflicts: number
  errors: number
}

export type SyncEngineStatus =
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error'

export interface SyncEngineState {
  status: SyncEngineStatus
  isOnline: boolean
  pendingCount: number
  conflictCount: number
  lastSyncAt: Date | null
  lastResult: SyncResult | null
}

type StatusListener = (state: SyncEngineState) => void

// ── Constants ────────────────────────────────────────────

const BASE_INTERVAL_MS = 30_000 // 30s between sync attempts
const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 300_000 // 5 minutes max backoff
const BATCH_SIZE = 20

// ── Sync Engine ──────────────────────────────────────────

class SyncEngine {
  private state: SyncEngineState = {
    status: 'idle',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    conflictCount: 0,
    lastSyncAt: null,
    lastResult: null,
  }

  private listeners = new Set<StatusListener>()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private consecutiveErrors = 0
  private running = false

  // ── Lifecycle ──────────────────────────────────────────

  /**
   * Begin background sync loop. Attaches online/offline listeners
   * and starts a periodic sync interval.
   */
  startSync(): void {
    if (this.running) return
    this.running = true

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }

    this.setState({ isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true })
    this.refreshCounts()

    this.intervalId = setInterval(() => {
      if (this.state.isOnline && this.state.status !== 'syncing') {
        void this.syncNow()
      }
    }, BASE_INTERVAL_MS)
  }

  /**
   * Stop background syncing and remove event listeners.
   */
  stopSync(): void {
    this.running = false

    if (this.intervalId != null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
  }

  /**
   * Force an immediate sync attempt.
   */
  async syncNow(): Promise<SyncResult> {
    if (!this.state.isOnline) {
      return { synced: 0, conflicts: 0, errors: 0 }
    }

    this.setState({ status: 'syncing' })

    try {
      const result = await this.executeBatchSync()

      this.consecutiveErrors = 0
      this.setState({
        status: 'idle',
        lastSyncAt: new Date(),
        lastResult: result,
      })
      await this.refreshCounts()

      return result
    } catch {
      this.consecutiveErrors++
      this.setState({ status: 'error' })

      // Schedule a retry with exponential backoff
      const backoff = Math.min(
        MIN_BACKOFF_MS * Math.pow(2, this.consecutiveErrors),
        MAX_BACKOFF_MS,
      )
      setTimeout(() => {
        if (this.running && this.state.isOnline) {
          void this.syncNow()
        }
      }, backoff)

      return { synced: 0, conflicts: 0, errors: 1 }
    }
  }

  /**
   * Subscribe to sync state changes. Returns an unsubscribe function.
   */
  onSyncStatusChange(callback: StatusListener): () => void {
    this.listeners.add(callback)
    // Immediately emit current state
    callback(this.state)
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Get a snapshot of the current state (for useSyncExternalStore).
   */
  getState(): SyncEngineState {
    return this.state
  }

  /**
   * Subscribe function compatible with useSyncExternalStore.
   */
  subscribe = (callback: () => void): (() => void) => {
    const wrapped: StatusListener = () => callback()
    this.listeners.add(wrapped)
    return () => {
      this.listeners.delete(wrapped)
    }
  }

  // ── Internal ───────────────────────────────────────────

  private handleOnline = (): void => {
    this.setState({ isOnline: true, status: 'idle' })
    // Immediately try to sync when coming back online
    void this.syncNow()
  }

  private handleOffline = (): void => {
    this.setState({ isOnline: false, status: 'offline' })
  }

  private setState(partial: Partial<SyncEngineState>): void {
    this.state = { ...this.state, ...partial }
    for (const listener of this.listeners) {
      try {
        listener(this.state)
      } catch {
        // Ignore listener errors
      }
    }
  }

  async refreshCounts(): Promise<void> {
    try {
      const pendingCount = await getPendingCount()
      const conflicts = await getConflicts()
      this.setState({ pendingCount, conflictCount: conflicts.length })
    } catch {
      // Counts are best-effort
    }
  }

  /**
   * Execute a batch sync: get all pending records, group by table,
   * and send them to the server in order.
   */
  private async executeBatchSync(): Promise<SyncResult> {
    const pending = await getPendingSync()
    if (pending.length === 0) return { synced: 0, conflicts: 0, errors: 0 }

    let synced = 0
    let conflicts = 0
    let errors = 0

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map((record) => this.syncRecord(record)),
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          switch (result.value) {
            case 'synced':
              synced++
              break
            case 'conflict':
              conflicts++
              break
            case 'error':
              errors++
              break
          }
        } else {
          errors++
        }
      }
    }

    return { synced, conflicts, errors }
  }

  /**
   * Sync a single record to the server.
   * Returns 'synced', 'conflict', or 'error'.
   */
  private async syncRecord(
    record: OfflineRecord,
  ): Promise<'synced' | 'conflict' | 'error'> {
    const table = record.table as TableName

    try {
      switch (record.syncStatus) {
        case 'pending_create': {
          const { error } = await supabase
            .from(table)
            .insert(record.data)
          if (error) {
            // Check if it already exists (conflict)
            if (error.code === '23505') {
              return await this.handleConflict(record)
            }
            throw error
          }
          await markSynced(table, record.id)
          return 'synced'
        }

        case 'pending_update': {
          // Check for conflict: fetch server version first
          const conflict = await this.detectConflict(record)
          if (conflict) {
            return await this.handleConflict(record)
          }

          const { error } = await supabase
            .from(table)
            .update(record.data)
            .eq('id', record.id)
          if (error) throw error
          await markSynced(table, record.id)
          return 'synced'
        }

        case 'pending_delete': {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', record.id)
          // Ignore "not found" errors — server already deleted
          if (error && error.code !== 'PGRST116') throw error
          await markSynced(table, record.id)
          return 'synced'
        }

        default:
          return 'synced'
      }
    } catch {
      return 'error'
    }
  }

  /**
   * Detect if the server has a newer version of this record.
   */
  private async detectConflict(record: OfflineRecord): Promise<boolean> {
    try {
      const { data } = await supabase
        .from(record.table)
        .select('updated_at')
        .eq('id', record.id)
        .single()

      if (!data) return false

      const serverUpdatedAt = new Date(data.updated_at as string).getTime()
      // If the server was updated after our local modification, that's a conflict
      return serverUpdatedAt > record.lastModified
    } catch {
      // If we can't check, assume no conflict and proceed
      return false
    }
  }

  /**
   * Handle a conflict by fetching the server version and storing both.
   */
  private async handleConflict(
    record: OfflineRecord,
  ): Promise<'conflict'> {
    try {
      const { data } = await supabase
        .from(record.table)
        .select('*')
        .eq('id', record.id)
        .single()

      if (data) {
        await markConflict(
          record.table as TableName,
          record.id,
          data as Record<string, unknown>,
        )
      }
    } catch {
      // If we can't fetch server data, still flag as conflict
      await markConflict(record.table as TableName, record.id, {})
    }
    return 'conflict'
  }
}

// ── Singleton ────────────────────────────────────────────

export const syncEngine = new SyncEngine()
