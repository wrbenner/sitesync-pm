import { useOfflineStatus } from './useOfflineStatus'

export function useSyncStatus() {
  const { pendingChanges, syncState, lastSynced } = useOfflineStatus()
  return {
    pendingCount: pendingChanges,
    isSyncing: syncState === 'syncing',
    lastSyncedAt: lastSynced,
  }
}
