import { useEffect, useCallback, useSyncExternalStore } from 'react'
import { syncEngine, type SyncEngineState, type SyncResult } from '../lib/syncEngine'

// ── useOfflineStatus ─────────────────────────────────────
// Primary hook for offline-first UI. Wraps the sync engine singleton
// in React lifecycle: auto-starts on mount, stops on unmount.

export interface OfflineStatus {
  /** Whether the browser reports network connectivity */
  isOnline: boolean
  /** Number of local records waiting to be synced */
  pendingCount: number
  /** When the last successful sync completed */
  lastSyncAt: Date | null
  /** Trigger an immediate sync attempt */
  syncNow: () => Promise<SyncResult>
  /** Number of records with server conflicts */
  conflicts: number
  /** Current sync engine status: idle | syncing | offline | error */
  status: SyncEngineState['status']
  /** Result of the most recent sync */
  lastResult: SyncResult | null
}

export function useOfflineStatus(): OfflineStatus {
  // Start/stop sync engine with component lifecycle
  useEffect(() => {
    syncEngine.startSync()
    return () => {
      syncEngine.stopSync()
    }
  }, [])

  // Subscribe to state changes using useSyncExternalStore for
  // tear-safe concurrent mode compatibility.
  const state = useSyncExternalStore(
    syncEngine.subscribe,
    () => syncEngine.getState(),
    () => syncEngine.getState(),
  )

  const syncNow = useCallback(() => syncEngine.syncNow(), [])

  return {
    isOnline: state.isOnline,
    pendingCount: state.pendingCount,
    lastSyncAt: state.lastSyncAt,
    syncNow,
    conflicts: state.conflictCount,
    status: state.status,
    lastResult: state.lastResult,
  }
}

// ── useIsOnline ──────────────────────────────────────────
// Lightweight hook for components that only need connectivity status.

export function useIsOnline(): boolean {
  const { isOnline } = useOfflineStatus()
  return isOnline
}
