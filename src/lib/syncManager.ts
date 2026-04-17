import {
  
  queueMutation,
  processSyncQueue,
  processUploadQueue,
  cacheProjectData,
  getPendingCount,
  getConflictCount,
  getLastSyncTimestamp,
  resolveMutationConflict,
  type SyncProgressCallback,
  type CacheProgressCallback,
  type CacheResult,
} from './offlineDb'

export { resolveMutationConflict }

export type ConnectionStatus = 'online' | 'offline'
export type SyncState = 'idle' | 'syncing' | 'caching' | 'error'

export interface SyncManagerState {
  connection: ConnectionStatus
  syncState: SyncState
  pendingCount: number
  conflictCount: number
  lastSynced: Date | null
  syncProgress: { total: number; completed: number; current: string } | null
  cacheProgress: { total: number; completed: number; currentTable: string } | null
}

type SyncListener = (state: SyncManagerState) => void

class SyncManager {
  private listeners = new Set<SyncListener>()
  private state: SyncManagerState = {
    connection: navigator.onLine ? 'online' : 'offline',
    syncState: 'idle',
    pendingCount: 0,
    conflictCount: 0,
    lastSynced: null,
    syncProgress: null,
    cacheProgress: null,
  }
  private syncInProgress = false
  private pollInterval: ReturnType<typeof setInterval> | null = null

  // BUG #5 FIX: Store bound handler references so removeEventListener can match them
  private readonly boundHandleOnline: () => void
  private readonly boundHandleOffline: () => void

  constructor() {
    this.boundHandleOnline = this.handleOnline.bind(this)
    this.boundHandleOffline = this.handleOffline.bind(this)
    window.addEventListener('online', this.boundHandleOnline)
    window.addEventListener('offline', this.boundHandleOffline)
    this.refreshCounts()
    this.startPolling()
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  private update(partial: Partial<SyncManagerState>) {
    this.state = { ...this.state, ...partial }
    this.emit()
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): SyncManagerState {
    return this.state
  }

  private handleOnline() {
    this.update({ connection: 'online' })
    // Duplicate sync prevention: check flag before calling sync
    if (!this.syncInProgress) {
      this.sync()
    }
  }

  private handleOffline() {
    this.update({ connection: 'offline' })
  }

  private startPolling() {
    this.pollInterval = setInterval(() => {
      // Skip polling when the tab is backgrounded — the user isn't looking at
      // the sync indicator, and the next visibility change will refresh it.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      this.refreshCounts().catch((err) => {
        if (import.meta.env.DEV) console.warn('SyncManager: Failed to refresh counts:', err)
      })
    }, 3000)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.refreshCounts().catch((err) => {
        if (import.meta.env.DEV) console.warn('SyncManager: Failed to refresh counts:', err)
      })
    }
  }

  async refreshCounts() {
    try {
      const [pendingCount, conflictCount, lastSynced] = await Promise.all([
        getPendingCount(),
        getConflictCount(),
        getLastSyncTimestamp(),
      ])
      this.update({ pendingCount, conflictCount, lastSynced })
    } catch (err) {
      // Dexie may throw if DB is closing or tab is being unloaded
      if (import.meta.env.DEV) console.warn('SyncManager: refreshCounts error:', err)
    }
  }

  async queueOfflineMutation(
    table: string,
    operation: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
  ) {
    await queueMutation(table, operation, data)
    await this.refreshCounts()
  }

  async sync(): Promise<{ synced: number; failed: number; conflicts: number }> {
    // Duplicate sync prevention
    if (this.syncInProgress || !navigator.onLine) {
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    this.syncInProgress = true
    this.update({ syncState: 'syncing', syncProgress: null })

    const onProgress: SyncProgressCallback = (progress) => {
      this.update({
        syncProgress: {
          total: progress.total,
          completed: progress.completed,
          current: progress.current,
        },
      })
    }

    try {
      const result = await processSyncQueue(onProgress)
      await processUploadQueue()
      await this.refreshCounts()
      this.update({ syncState: 'idle', syncProgress: null })
      return result
    } catch (err) {
      if (import.meta.env.DEV) console.error('SyncManager: sync error:', err)
      this.update({ syncState: 'error', syncProgress: null })
      return { synced: 0, failed: 0, conflicts: 0 }
    } finally {
      this.syncInProgress = false
    }
  }

  async cacheProject(projectId: string): Promise<CacheResult | null> {
    if (!navigator.onLine) return null

    this.update({ syncState: 'caching', cacheProgress: null })

    const onProgress: CacheProgressCallback = (progress) => {
      this.update({
        cacheProgress: {
          total: progress.total,
          completed: progress.completed,
          currentTable: progress.currentTable,
        },
      })
    }

    try {
      const result = await cacheProjectData(projectId, onProgress)
      await this.refreshCounts()
      this.update({ syncState: 'idle', cacheProgress: null })

      // Warn about failures
      if (import.meta.env.DEV) {
        if (result.errors.length > 0) {
          console.warn(`SyncManager: Cache completed with ${result.errors.length} table errors:`, result.errors)
        }
        if (result.truncatedTables.length > 0) {
          console.warn(`SyncManager: Data truncated for tables:`, result.truncatedTables)
        }
      }

      return result
    } catch (err) {
      if (import.meta.env.DEV) console.error('SyncManager: cacheProject error:', err)
      this.update({ syncState: 'error', cacheProgress: null })
      return null
    }
  }

  destroy() {
    // BUG #5 FIX: Use bound references that match the ones passed to addEventListener
    window.removeEventListener('online', this.boundHandleOnline)
    window.removeEventListener('offline', this.boundHandleOffline)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    }
    if (this.pollInterval) clearInterval(this.pollInterval)
    this.listeners.clear()
  }
}

// Singleton instance
export const syncManager = new SyncManager()
