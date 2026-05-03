/**
 * punchListStore — Focused comment slice for the Punch List feature.
 *
 * SCOPE (post-Day-9 slim):
 *   - Per-punch-item comment threads (loadComments, addComment, getComments)
 *   - Optimistic insert + rollback on error
 *   - Legacy-shape normalization (handles old `content`/`user_id` records)
 *
 * NOT IN SCOPE:
 *   - Punch item CRUD — use entityStore('punchItems') + the React Query
 *     mutation hooks in src/hooks/mutations/punchItems
 *
 * MIGRATION HISTORY:
 *   - Day 9 (2026-05-01): Stripped CRUD methods (loadItems, createItem,
 *     updateItem, updateItemStatus, deleteItem, getSummary) — all had zero
 *     consumers. Comment slice retained because (a) only consumer uses it
 *     and (b) the optimistic-insert + legacy-shape normalization are
 *     non-trivial and don't fit the entityStore CRUD pattern.
 */
import { create } from 'zustand';
import { supabase, fromTable } from '../lib/supabase';

export interface PunchComment {
  id: string;
  punch_item_id: string;
  author: string;
  initials: string;
  text: string;
  created_at: string;
}

interface PunchListState {
  /** Comment threads keyed by punch_item_id */
  comments: Record<string, PunchComment[]>;

  /**
   * Add a comment with optimistic UI. On server error, the optimistic
   * record is rolled back from the slice and an error string is returned.
   */
  addComment: (
    itemId: string,
    author: string,
    initials: string,
    text: string,
  ) => Promise<{ error: string | null }>;

  /**
   * Load all comments for one punch item from the server.
   * Normalises legacy `content`/`user_id` columns into the unified
   * `text`/`author` shape so the UI never renders an empty bubble.
   */
  loadComments: (itemId: string) => Promise<void>;

  /** Read-only accessor for comments on one item */
  getComments: (itemId: string) => PunchComment[];
}

export const usePunchListStore = create<PunchListState>()((set, get) => ({
  comments: {},

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
          [itemId]: (s.comments[itemId] ?? []).map((c) =>
            c.id === optimistic.id ? (data as PunchComment) : c,
          ),
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
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const normalized: PunchComment[] = rows.map((r) => ({
      id: String(r.id),
      punch_item_id: String(r.punch_item_id),
      author: (r.author as string) || (r.user_id as string) || 'User',
      initials:
        (r.initials as string) ||
        ((r.author as string)
          ? (r.author as string).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
          : 'U'),
      text: (r.text as string) || (r.content as string) || '',
      created_at: (r.created_at as string) || new Date().toISOString(),
    }));
    set((s) => ({ comments: { ...s.comments, [itemId]: normalized } }));
  },

  getComments: (itemId) => {
    return get().comments[itemId] ?? [];
  },
}));
