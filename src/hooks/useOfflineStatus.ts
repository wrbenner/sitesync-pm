import { useCallback, useSyncExternalStore } from 'react'
import { syncManager} from '../lib/syncManager'

// useIsOnline lives in its own file (./useIsOnline) so routes that only need
// the bare connection state don't transitively pull the syncManager + Dexie
// chunk onto the cold-open path. Day 30 — Lap 1 acceptance gate.
export { useIsOnline } from './useIsOnline'

// Subscribe to the SyncManager singleton for real-time offline/sync status
export function useOfflineStatus() {
  const state = useSyncExternalStore(
    (cb) => syncManager.subscribe(cb),
    () => syncManager.getState(),
    () => syncManager.getState()
  )

  const sync = useCallback(() => syncManager.sync(), [])
  const cacheProject = useCallback((projectId: string) => syncManager.cacheProject(projectId), [])

  return {
    isOnline: state.connection === 'online',
    syncState: state.syncState,
    pendingChanges: state.pendingCount,
    conflictCount: state.conflictCount,
    lastSynced: state.lastSynced,
    syncProgress: state.syncProgress,
    cacheProgress: state.cacheProgress,
    sync,
    cacheProject,
    refreshCounts: () => syncManager.refreshCounts(),
  }
}

