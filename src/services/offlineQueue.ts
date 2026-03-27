import { create } from 'zustand';

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

interface OfflineState {
  status: SyncStatus;
  queue: QueuedMutation[];
  lastSyncTime: Date | null;

  setStatus: (status: SyncStatus) => void;
  addToQueue: (mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  simulateSync: () => Promise<void>;
  simulateOffline: () => void;
  simulateOnline: () => void;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  status: 'online',
  queue: [],
  lastSyncTime: new Date(),

  setStatus: (status) => set({ status }),

  addToQueue: (mutation) =>
    set((s) => ({
      queue: [
        ...s.queue,
        {
          ...mutation,
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date(),
          retryCount: 0,
        },
      ],
    })),

  removeFromQueue: (id) =>
    set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),

  clearQueue: () => set({ queue: [] }),

  simulateSync: async () => {
    const { queue } = get();
    if (queue.length === 0) return;

    set({ status: 'syncing' });

    // Simulate syncing each item with a delay
    for (const item of queue) {
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
      set((s) => ({ queue: s.queue.filter((q) => q.id !== item.id) }));
    }

    set({ status: 'online', lastSyncTime: new Date() });
  },

  simulateOffline: () => {
    set({ status: 'offline' });
    // Add some sample queued items
    const sampleMutations: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>[] = [
      { type: 'create', entityType: 'field_capture', data: { title: 'Floor 7 progress photo' } },
      { type: 'update', entityType: 'punch_item', entityId: 'PL-003', data: { status: 'in_progress' } },
      { type: 'create', entityType: 'daily_log_note', data: { text: 'Concrete pour completed on Level 9' } },
    ];
    sampleMutations.forEach((m) => get().addToQueue(m));
  },

  simulateOnline: () => {
    get().simulateSync();
  },
}));
