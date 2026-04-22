// MIGRATED to entityStore — see src/stores/entityStore.ts
// This file is kept for backward-compatibility; all imports continue to work.
// Generic CRUD is delegated to entityStore key "punchItems".
// Custom logic (comments, summary, updateItemStatus) remains here.
import { create } from 'zustand';
import { supabase, fromTable } from '../lib/supabase';
import type { PunchListItem, PunchItemStatus } from '../types/database';
import { useEntityStore, useEntityActions, useEntityStoreRoot } from './entityStore';

// ── Re-exports of generic entity hooks ────────────────────────────────────────
// New code should prefer useEntityStore("punchItems") and useEntityActions("punchItems").

export { useEntityStore as usePunchItemEntityStore, useEntityActions as usePunchItemEntityActions };

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
  addComment: (itemId: string, author: string, initials: string, text: string) => Promise<{ error: string | null }>;
  loadComments: (itemId: string) => Promise<void>;
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
    useEntityStoreRoot.getState()._setSlice('punchItems', { loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('punch_items')
        .select('*')
        .eq('project_id', projectId)
        .order('number');

      if (error) throw error;
      const items = (data ?? []) as PunchListItem[];
      set({ items, loading: false });
      useEntityStoreRoot.getState()._setSlice('punchItems', { items, loading: false, error: null });
    } catch (e) {
      const msg = (e as Error).message;
      set({ error: msg, loading: false });
      useEntityStoreRoot.getState()._setSlice('punchItems', { error: msg, loading: false });
    }
  },

  createItem: async (item) => {
    const { error } = await fromTable('punch_items').insert(item);
    if (error) return { error: error.message };
    await get().loadItems(item.project_id);
    return { error: null };
  },

  updateItemStatus: async (id, status) => {
    const updates: Partial<PunchListItem> = { status, updated_at: new Date().toISOString() };

    const { error } = await fromTable('punch_items').update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          punchItems: {
            ...s.slices['punchItems'],
            items: (s.slices['punchItems']?.items ?? []).map((i) =>
              i.id === id ? { ...i, ...updates } : i,
            ),
          },
        },
      }));
    }
    return { error: error?.message ?? null };
  },

  updateItem: async (id, updates) => {
    const { error } = await fromTable('punch_items').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          punchItems: {
            ...s.slices['punchItems'],
            items: (s.slices['punchItems']?.items ?? []).map((i) =>
              i.id === id ? { ...i, ...updates } : i,
            ),
          },
        },
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteItem: async (id) => {
    const { error } = await fromTable('punch_items').delete().eq('id', id);
    if (!error) {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          punchItems: {
            ...s.slices['punchItems'],
            items: (s.slices['punchItems']?.items ?? []).filter((i) => i.id !== id),
          },
        },
      }));
    }
    return { error: error?.message ?? null };
  },

  addComment: async (itemId, author, initials, text) => {
    const optimistic: PunchComment = {
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
        [itemId]: [...(s.comments[itemId] ?? []), optimistic],
      },
    }));
    const { data, error } = await fromTable('punch_item_comments')
      .insert({
        punch_item_id: itemId,
        author,
        initials,
        text,
        content: text, // keep legacy `content` column populated
      })
      .select()
      .single();
    if (error) {
      set((s) => ({
        comments: {
          ...s.comments,
          [itemId]: (s.comments[itemId] ?? []).filter((c) => c.id !== optimistic.id),
        },
      }));
      return { error: error.message };
    }
    if (data) {
      set((s) => ({
        comments: {
          ...s.comments,
          [itemId]: (s.comments[itemId] ?? []).map((c) => (c.id === optimistic.id ? (data as PunchComment) : c)),
        },
      }));
    }
    return { error: null };
  },

  loadComments: async (itemId) => {
    const { data, error } = await supabase
      .from('punch_item_comments')
      .select('*')
      .eq('punch_item_id', itemId)
      .order('created_at', { ascending: true });
    if (error) return;
    // Normalize across the two shapes (legacy `content`/`user_id` vs. added
    // `text`/`author`/`initials`) so the UI never renders an empty bubble.
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const normalized: PunchComment[] = rows.map((r) => ({
      id: String(r.id),
      punch_item_id: String(r.punch_item_id),
      author: (r.author as string) || (r.user_id as string) || 'User',
      initials: (r.initials as string) || ((r.author as string) ? (r.author as string).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'),
      text: (r.text as string) || (r.content as string) || '',
      created_at: (r.created_at as string) || new Date().toISOString(),
    }));
    set((s) => ({ comments: { ...s.comments, [itemId]: normalized } }));
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
