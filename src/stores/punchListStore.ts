import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { PunchListItem, PunchItemStatus } from '../types/database';

export interface PunchComment {
  id: string;
  punch_item_id: string;
  author: string;
  initials: string;
  text: string;
  created_at: string;
}

interface PunchListState {
  items: PunchListItem[];
  comments: Record<string, PunchComment[]>;
  loading: boolean;
  error: string | null;

  loadItems: (projectId: string) => Promise<void>;
  createItem: (item: Omit<PunchListItem, 'id' | 'item_number' | 'created_at' | 'updated_at'>) => Promise<{ error: string | null }>;
  updateItemStatus: (id: string, status: PunchItemStatus) => Promise<{ error: string | null }>;
  updateItem: (id: string, updates: Partial<PunchListItem>) => Promise<{ error: string | null }>;
  deleteItem: (id: string) => Promise<{ error: string | null }>;
  addComment: (itemId: string, author: string, initials: string, text: string) => void;
  getComments: (itemId: string) => PunchComment[];
  getSummary: () => { total: number; open: number; inProgress: number; complete: number; verified: number; critical: number; high: number };
}

export const usePunchListStore = create<PunchListState>()((set, get) => ({
  items: [],
  comments: {},
  loading: false,
  error: null,

  loadItems: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('punch_list_items')
        .select('*')
        .eq('project_id', projectId)
        .order('item_number');

      if (error) throw error;
      set({ items: (data ?? []) as PunchListItem[], loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createItem: async (item) => {
    const { error } = await (supabase.from('punch_list_items') as any).insert(item);
    if (error) return { error: error.message };
    await get().loadItems(item.project_id);
    return { error: null };
  },

  updateItemStatus: async (id, status) => {
    const updates: Partial<PunchListItem> = { status, updated_at: new Date().toISOString() };

    const { error } = await (supabase.from('punch_list_items') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    }
    return { error: error?.message ?? null };
  },

  updateItem: async (id, updates) => {
    const { error } = await (supabase.from('punch_list_items') as any).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteItem: async (id) => {
    const { error } = await (supabase.from('punch_list_items') as any).delete().eq('id', id);
    if (!error) {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  addComment: (itemId, author, initials, text) => {
    // Comments are stored locally for now; punch_item_comments table can be added later
    const comment: PunchComment = {
      id: `pc-${Date.now()}`,
      punch_item_id: itemId,
      author,
      initials,
      text,
      created_at: new Date().toISOString(),
    };
    set((s) => ({
      comments: {
        ...s.comments,
        [itemId]: [...(s.comments[itemId] ?? []), comment],
      },
    }));
  },

  getComments: (itemId) => {
    return get().comments[itemId] ?? [];
  },

  getSummary: () => {
    const items = get().items;
    return {
      total: items.length,
      open: items.filter((i) => i.status === 'open').length,
      inProgress: items.filter((i) => i.status === 'in_progress').length,
      complete: items.filter((i) => i.status === 'complete').length,
      verified: items.filter((i) => i.status === 'verified').length,
      critical: items.filter((i) => i.priority === 'critical').length,
      high: items.filter((i) => i.priority === 'high').length,
    };
  },
}));
