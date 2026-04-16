import { create } from 'zustand';
import { punchItemService } from '../services/punchItemService';
import type { PunchItem } from '../types/database';
import type { PunchItemStatus, CreatePunchItemInput } from '../services/punchItemService';

interface PunchItemState {
  items: PunchItem[];
  loading: boolean;
  error: string | null;

  loadPunchItems: (projectId: string) => Promise<void>;
  createPunchItem: (input: CreatePunchItemInput) => Promise<{ error: string | null; item: PunchItem | null }>;
  updatePunchItem: (itemId: string, updates: Partial<PunchItem>) => Promise<{ error: string | null }>;
  transitionStatus: (itemId: string, status: PunchItemStatus) => Promise<{ error: string | null }>;
  assignPunchItem: (itemId: string, assignedTo: string | null) => Promise<{ error: string | null }>;
  uploadPhoto: (itemId: string, projectId: string, file: File, type: 'before' | 'after') => Promise<{ error: string | null; url: string | null }>;
  deletePunchItem: (itemId: string) => Promise<{ error: string | null }>;
  getSummary: () => {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    verified: number;
    closed: number;
    critical: number;
    high: number;
  };
}

export const usePunchItemStore = create<PunchItemState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  loadPunchItems: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await punchItemService.loadPunchItems(projectId);
    if (error) {
      set({ error, loading: false });
    } else {
      set({ items: data ?? [], loading: false });
    }
  },

  createPunchItem: async (input) => {
    const { data, error } = await punchItemService.createPunchItem(input);
    if (error) return { error, item: null };
    if (data) {
      set((s) => ({ items: [data, ...s.items] }));
    }
    return { error: null, item: data };
  },

  updatePunchItem: async (itemId, updates) => {
    // Optimistic update
    set((s) => ({
      items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
    }));
    const { error } = await punchItemService.updatePunchItem(itemId, updates);
    if (error) {
      // Revert optimistic update on failure by reloading is handled by caller
      return { error };
    }
    return { error: null };
  },

  transitionStatus: async (itemId, status) => {
    const { error } = await punchItemService.transitionStatus(itemId, status);
    if (!error) {
      // Optimistic update with lifecycle timestamps
      const now = new Date().toISOString();
      set((s) => ({
        items: s.items.map((i) => {
          if (i.id !== itemId) return i;
          const patch: Partial<PunchItem> = { status };
          if (status === 'resolved') patch.resolved_date = now;
          if (status === 'verified') patch.verified_date = now;
          return { ...i, ...patch };
        }),
      }));
    }
    return { error };
  },

  assignPunchItem: async (itemId, assignedTo) => {
    const { error } = await punchItemService.assignPunchItem(itemId, assignedTo);
    if (!error) {
      set((s) => ({
        items: s.items.map((i) =>
          i.id === itemId ? { ...i, assigned_to: assignedTo } : i,
        ),
      }));
    }
    return { error };
  },

  uploadPhoto: async (itemId, projectId, file, type) => {
    const { data: url, error } = await punchItemService.uploadPhoto(itemId, projectId, file, type);
    if (!error && url) {
      // Append to photos array in store
      set((s) => ({
        items: s.items.map((i) => {
          if (i.id !== itemId) return i;
          const existing = Array.isArray(i.photos) ? (i.photos as string[]) : [];
          return { ...i, photos: [...existing, url] };
        }),
      }));
    }
    return { error, url };
  },

  deletePunchItem: async (itemId) => {
    const { error } = await punchItemService.deletePunchItem(itemId);
    if (!error) {
      set((s) => ({ items: s.items.filter((i) => i.id !== itemId) }));
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
      closed: items.filter((i) => i.status === 'closed').length,
      critical: items.filter((i) => i.priority === 'critical').length,
      high: items.filter((i) => i.priority === 'high').length,
    };
  },
}));
