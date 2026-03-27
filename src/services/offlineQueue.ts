import { create } from 'zustand';
import { captureException } from '../lib/errorTracking';

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

const STORAGE_KEY = 'sitesync_offline_queue';
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

/** Load persisted queue from localStorage */
function loadPersistedQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) }));
  } catch {
    return [];
  }
}

/** Persist queue to localStorage */
function persistQueue(queue: QueuedMutation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

interface OfflineState {
  status: SyncStatus;
  queue: QueuedMutation[];
  lastSyncTime: Date | null;

  setStatus: (status: SyncStatus) => void;
  addToQueue: (mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  processQueue: () => Promise<void>;
  simulateOffline: () => void;
  simulateOnline: () => void;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  status: navigator.onLine ? 'online' : 'offline',
  queue: loadPersistedQueue(),
  lastSyncTime: new Date(),

  setStatus: (status) => set({ status }),

  addToQueue: (mutation) => {
    set((s) => {
      const newQueue = [
        ...s.queue,
        {
          ...mutation,
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date(),
          retryCount: 0,
        },
      ];
      persistQueue(newQueue);
      return { queue: newQueue };
    });
  },

  removeFromQueue: (id) => {
    set((s) => {
      const newQueue = s.queue.filter((q) => q.id !== id);
      persistQueue(newQueue);
      return { queue: newQueue };
    });
  },

  clearQueue: () => {
    persistQueue([]);
    set({ queue: [] });
  },

  processQueue: async () => {
    const { queue } = get();
    if (queue.length === 0) return;
    if (!navigator.onLine) return;

    set({ status: 'syncing' });

    const remaining: QueuedMutation[] = [];

    for (const item of queue) {
      try {
        // Attempt to process the mutation
        // In production this would call the appropriate store method
        // For now, simulate processing with a brief delay
        await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 200));

        // Success: item is removed (not added to remaining)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (item.retryCount < MAX_RETRIES) {
          // Exponential backoff delay before next retry
          const delay = BASE_DELAY * Math.pow(2, item.retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
          remaining.push({ ...item, retryCount: item.retryCount + 1 });
        } else {
          // Max retries exceeded, log and discard
          captureException(error, {
            action: 'offline_sync_failed',
            extra: { entityType: item.entityType, type: item.type, retryCount: item.retryCount },
          });
        }
      }
    }

    persistQueue(remaining);
    set({ queue: remaining, status: 'online', lastSyncTime: new Date() });
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
    get().processQueue();
  },
}));

// Listen for online/offline browser events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const store = useOfflineStore.getState();
    store.setStatus('online');
    if (store.queue.length > 0) {
      store.processQueue();
    }
  });

  window.addEventListener('offline', () => {
    useOfflineStore.getState().setStatus('offline');
  });
}
