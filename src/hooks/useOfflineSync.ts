/**
 * useOfflineSync — React hook for offline annotation queue management.
 *
 * Provides:
 *  - isOnline: current connectivity state
 *  - pendingCount: number of annotations waiting to sync
 *  - enqueue(ann): add an annotation to the offline queue
 *  - sync(): manually trigger a drain of the queue
 *  - Auto-sync: drains the queue when connectivity returns
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  enqueueAnnotation,
  getPendingCount,
  drainAnnotationQueue,
  onConnectivityChange,
  type PendingAnnotation,
} from '../lib/offlineQueue';

import { fromTable } from '../lib/db/queries'

interface UseOfflineSyncReturn {
  /** Whether the device currently has network connectivity */
  isOnline: boolean;
  /** Number of annotations waiting to be synced */
  pendingCount: number;
  /** Add an annotation to the offline queue */
  enqueue: (ann: Omit<PendingAnnotation, 'id' | 'created_at'>) => Promise<void>;
  /** Manually trigger a sync attempt */
  sync: () => Promise<number>;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available in some contexts
    }
  }, []);

  // Sync function: drain queue to Supabase
  const syncFn = useCallback(async (ann: PendingAnnotation) => {
    const { error } = await fromTable('drawing_markups')
      .insert({
        project_id: ann.project_id,
        drawing_id: ann.drawing_id,
        page_number: ann.page_number,
        annotation_type: ann.annotation_type,
        geometry_type: ann.geometry_type,
        normalized_coords: ann.normalized_coords,
        color: ann.color,
        content: ann.content || null,
        layer: ann.layer,
        visibility: ann.visibility,
        markup_status: 'active',
      } as never);

    if (error) throw error;
  }, []);

  const sync = useCallback(async (): Promise<number> => {
    if (syncInProgress.current || !navigator.onLine) return 0;
    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const synced = await drainAnnotationQueue(syncFn);
      await refreshCount();
      return synced;
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);
    }
  }, [syncFn, refreshCount]);

  // Enqueue and update count
  const enqueue = useCallback(
    async (ann: Omit<PendingAnnotation, 'id' | 'created_at'>) => {
      await enqueueAnnotation({
        ...ann,
        created_at: new Date().toISOString(),
      });
      await refreshCount();
    },
    [refreshCount],
  );

  // Listen for connectivity changes
  useEffect(() => {
    const unsub = onConnectivityChange((online) => {
      setIsOnline(online);
      if (online) {
        // Auto-sync when we come back online
        sync();
      }
    });
    return unsub;
  }, [sync]);

  // Initial count load
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Periodic sync attempt when online (every 30s if there are pending items)
  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    const interval = setInterval(() => {
      if (pendingCount > 0) sync();
    }, 30_000);
    return () => clearInterval(interval);
  }, [isOnline, pendingCount, sync]);

  return { isOnline, pendingCount, enqueue, sync, isSyncing };
}
