import { create } from 'zustand';
import { punchItemService } from '../services/punchItemService';
import type { PunchItem } from '../types/database';
import type { PunchItemState } from '../machines/punchItemMachine';
import type { CreatePunchItemInput } from '../services/punchItemService';

interface PunchItemStoreState {
  items: PunchItem[];
  loading: boolean;
  error: string | null;

  loadItems: (projectId: string) => Promise<void>;
  createItem: (input: CreatePunchItemInput) => Promise<{ error: string | null; item: PunchItem | null }>;
  updateItem: (id: string, updates: Partial<PunchItem>) => Promise<{ error: string | null }>;
  transitionStatus: (id: string, action: string) => Promise<{ error: string | null }>;
  deleteItem: (id: string) => Promise<{ error: string | null }>;
  getSummary: () => {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    verified: number;
  };
}

export const usePunchItemStore = create<PunchItemStoreState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  loadItems: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await punchItemService.loadPunchItems(projectId);
    if (error) {
      set({ error, loading: false });
    } else {
      set({ items: data ?? [], loading: false });
    }
  },

  createItem: async (input) => {
    const { data, error } = await punchItemService.createPunchItem(input);
    if (error) return { error, item: null };
    if (data) {
      set((s) => ({ items: [data, ...s.items] }));
    }
    return { error: null, item: data };
  },

  updateItem: async (id, updates) => {
    const { error } = await punchItemService.updatePunchItem(id, updates);
    if (!error) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    }
    return { error };
  },

  transitionStatus: async (id, action) => {
    const { error } = await punchItemService.transitionStatus(id, action);
    if (!error) {
      // Derive the new status from the action label using the service's validation
      // The store optimistically updates; a full reload would be authoritative
      set((s) => {
        const item = s.items.find((i) => i.id === id);
        if (!item) return s;

        // Derive the next status from action using status label map
        const actionToStatus: Record<string, PunchItemState> = {
          'Start Work': 'in_progress',
          'Verify (Complete at Creation)': 'verified',
          'Mark Resolved': 'resolved',
          'Reopen': 'open',
          'Verify': 'verified',
          'Reject Verification': 'in_progress',
        };
        const newStatus = actionToStatus[action];
        if (!newStatus) return s;

        return {
          items: s.items.map((i) =>
            i.id === id ? { ...i, status: newStatus } : i,
          ),
        };
      });
    }
    return { error };
  },

  deleteItem: async (id) => {
    const { error } = await punchItemService.deletePunchItem(id);
    if (!error) {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    }
    return { error };
  },

  getSummary: () => {
    const items = get().items;
    return {
      total: items.length,
      open: items.filter((i) => i.status === 'open').length,
      inProgress: items.filter((i) => i.status === 'in_progress').length,
      resolved: items.filter((i) => i.status === 'resolved').length,
      verified: items.filter((i) => i.status === 'verified').length,
    };
  },
}));
