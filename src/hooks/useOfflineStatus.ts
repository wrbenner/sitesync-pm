import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { syncManager} from '../lib/syncManager'

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

// Hook for components that just need to know if we're online
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
