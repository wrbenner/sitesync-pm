import { create } from 'zustand';
import { sovService, type SovItem, type CreateSovItemInput, type UpdateSovItemInput } from '../services/sovService';
import type { ServiceError } from '../services/errors';

interface SovState {
  items: SovItem[];
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;

  loadItems: (contractId: string) => Promise<void>;
  createItem: (input: CreateSovItemInput) => Promise<{ item: SovItem | null; error: string | null }>;
  updateItem: (itemId: string, updates: UpdateSovItemInput) => Promise<{ error: string | null }>;
  deleteItem: (itemId: string) => Promise<{ error: string | null }>;
  bulkReplace: (
    contractId: string,
    items: Array<Omit<SovItem, 'id' | 'contract_id' | 'created_at' | 'updated_at'>>,
  ) => Promise<{ items: SovItem[] | null; error: string | null }>;
  clearError: () => void;
}

export const useSovStore = create<SovState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,
  errorDetails: null,

  loadItems: async (contractId) => {
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await sovService.loadItems(contractId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
    } else {
      set({ items: data ?? [], loading: false });
    }
  },

  createItem: async (input) => {
    const { data, error } = await sovService.createItem(input);
    if (error) return { item: null, error: error.userMessage };
    if (data) {
      set((s) => ({ items: [...s.items, data] }));
    }
    return { item: data, error: null };
  },

  updateItem: async (itemId, updates) => {
    const previous = get().items;
    // Optimistic update
    set((s) => ({
      items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
    }));
    const { error } = await sovService.updateItem(itemId, updates);
    if (error) {
      // Rollback on failure
      set({ items: previous, error: error.userMessage, errorDetails: error });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  deleteItem: async (itemId) => {
    const previous = get().items;
    // Optimistic removal
    set((s) => ({ items: s.items.filter((i) => i.id !== itemId) }));
    const { error } = await sovService.deleteItem(itemId);
    if (error) {
      // Rollback on failure
      set({ items: previous, error: error.userMessage, errorDetails: error });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  bulkReplace: async (contractId, items) => {
    set({ loading: true, error: null });
    const { data, error } = await sovService.bulkReplace(contractId, items);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
      return { items: null, error: error.userMessage };
    }
    set({ items: data ?? [], loading: false });
    return { items: data, error: null };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
