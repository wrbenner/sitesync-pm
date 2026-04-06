import { create } from 'zustand';
import { syncManager, type ConnectionStatus, type SyncState } from '../lib/syncManager';

// Compatibility shim: this store now wraps the SyncManager singleton.
// Components that imported from here continue to work.

export type SyncStatus = 'online' | 'offline' | 'syncing';

export interface QueuedMutation {
  id: string;
  type: string;
  entityType: string;
  entityId?: string;
  data: unknown;
  timestamp: Date;
  retryCount: number;
}

function mapStatus(connection: ConnectionStatus, syncState: SyncState): SyncStatus {
  if (connection === 'offline') return 'offline';
  if (syncState === 'syncing' || syncState === 'caching') return 'syncing';
  return 'online';
}

interface OfflineState {
  status: SyncStatus;
  queue: QueuedMutation[];
  lastSyncTime: Date | null;
  pendingCount: number;
  conflictCount: number;

  setStatus: (status: SyncStatus) => void;
  addToQueue: (mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  simulateSync: () => Promise<void>;
  simulateOffline: () => void;
  simulateOnline: () => void;
}

export const useOfflineStore = create<OfflineState>((set, get) => {
  // Subscribe to SyncManager state changes
  syncManager.subscribe((state) => {
    set({
      status: mapStatus(state.connection, state.syncState),
      lastSyncTime: state.lastSynced,
      pendingCount: state.pendingCount,
      conflictCount: state.conflictCount,
    });
  });

  return {
    status: 'online',
    queue: [],
    lastSyncTime: new Date(),
    pendingCount: 0,
    conflictCount: 0,

    setStatus: (status) => set({ status }),

    addToQueue: (mutation) =>
      set((s) => ({
        queue: [
          ...s.queue,
          {
            ...mutation,
            id: `q-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
            timestamp: new Date(),
            retryCount: 0,
          },
        ],
      })),

    removeFromQueue: (id) =>
      set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),

    clearQueue: () => set({ queue: [] }),

    simulateSync: async () => {
      await syncManager.sync();
    },

    simulateOffline: () => {
      set({ status: 'offline' });
      const sampleMutations: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>[] = [
        { type: 'create', entityType: 'field_capture', data: { title: 'Floor 7 progress photo' } },
        { type: 'update', entityType: 'punch_item', entityId: 'PL-003', data: { status: 'in_progress' } },
        { type: 'create', entityType: 'daily_log_note', data: { text: 'Concrete pour completed on Level 9' } },
      ];
      sampleMutations.forEach((m) => get().addToQueue(m));
    },

    simulateOnline: () => {
      syncManager.sync();
    },
  };
});
