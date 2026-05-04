/**
 * entityStore — Generic keyed entity store
 *
 * This store replaces the repetitive pattern found in rfiStore, submittalStore,
 * taskStore, changeOrderStore, crewStore, meetingStore, directoryStore, etc.
 * Each of those stores maintains items[], loading, error, selectedId, and a
 * set of CRUD actions — all of which are identical modulo the type parameter.
 *
 * MIGRATION PLAN (Horizon 2-3):
 * 1. This store provides the foundation — a single Zustand slice keyed by
 *    entity type (e.g. 'rfis', 'submittals', 'tasks').
 * 2. Old stores are left in place with a "// TODO: Migrate to entityStore" comment.
 * 3. New code should use useEntityStore('rfis') instead of useRfiStore(), etc.
 * 4. Once all pages are migrated, the old stores can be deleted.
 *
 * USAGE:
 *   const { items, loading, error, selectedId, filters } = useEntityStore('rfis');
 *   const { loadItems, createItem, updateItem, deleteItem } = useEntityActions('rfis');
 *
 * EXTENDING:
 *   Entity-specific logic (e.g. status transitions, sub-resource loading) should
 *   live in a thin service layer (src/services/) and call the generic actions.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Any database record with at minimum an `id` field */
export interface BaseEntity {
  id: string;
  [key: string]: unknown;
}

/** Filter state for an entity slice */
export interface EntityFilters {
  /** Free-text search string */
  search: string;
  /** Status filter — undefined means all */
  status: string | undefined;
  /** Arbitrary additional key-value filters */
  extra: Record<string, unknown>;
}

/** State for a single entity type */
export interface EntitySlice<T extends BaseEntity = BaseEntity> {
  /** All loaded items for the current project */
  items: T[];
  /** True while a load or mutation is in flight */
  loading: boolean;
  /** User-facing error message, or null when clear */
  error: string | null;
  /** ID of the currently selected/focused item */
  selectedId: string | null;
  /** Active filter values for this entity type */
  filters: EntityFilters;
}

/** Actions available on a single entity slice */
export interface EntityActions<T extends BaseEntity = BaseEntity> {
  /**
   * Load all items for the given project from Supabase.
   * Replaces the current items array on success.
   */
  loadItems: (projectId: string) => Promise<void>;
  /**
   * Insert a new item. On success, prepends it to the items array.
   * @returns The created item, or null + an error message on failure.
   */
  createItem: (payload: Omit<T, 'id'>) => Promise<{ item: T | null; error: string | null }>;
  /**
   * Apply a partial update to an existing item. On success, merges the
   * updates into the matching item in the items array.
   */
  updateItem: (id: string, updates: Partial<T>) => Promise<{ error: string | null }>;
  /**
   * Delete an item by ID and remove it from the items array.
   */
  deleteItem: (id: string) => Promise<{ error: string | null }>;
  /** Set the currently selected item ID */
  setSelectedId: (id: string | null) => void;
  /** Update one or more filter fields */
  setFilters: (patch: Partial<EntityFilters>) => void;
  /** Reset filters to defaults */
  resetFilters: () => void;
  /** Clear the current error */
  clearError: () => void;
}

/** Combined slice + actions type */
export type EntityEntry<T extends BaseEntity = BaseEntity> = EntitySlice<T> & EntityActions<T>;

const DEFAULT_FILTERS: EntityFilters = {
  search: '',
  status: undefined,
  extra: {},
};

// ── Store ──────────────────────────────────────────────────────────────────────

/**
 * The top-level store state: a map from entity type key to its slice.
 * Keys correspond to Supabase table names (e.g. 'rfis', 'submittals').
 */
interface EntityStoreState {
  /** All entity slices, keyed by table/entity type */
  slices: Record<string, EntitySlice>;

  /**
   * Initialise a slice for the given entity key if it does not already exist.
   * Safe to call multiple times — idempotent.
   */
  initSlice: (key: string) => void;

  /** Internal setter — use the action helpers (loadItems, etc.) via hooks instead */
  _setSlice: (key: string, patch: Partial<EntitySlice>) => void;
}

export const useEntityStoreRoot = create<EntityStoreState>()((set, get) => ({
  slices: {},

  initSlice: (key) => {
    if (get().slices[key]) return;
    set((s) => ({
      slices: {
        ...s.slices,
        [key]: {
          items: [],
          loading: false,
          error: null,
          selectedId: null,
          filters: { ...DEFAULT_FILTERS, extra: {} },
        },
      },
    }));
  },

  _setSlice: (key, patch) => {
    set((s) => ({
      slices: {
        ...s.slices,
        [key]: { ...s.slices[key], ...patch },
      },
    }));
  },
}));

// ── Per-entity hooks ───────────────────────────────────────────────────────────

/**
 * Read-only selector for an entity slice.
 *
 * @example
 *   const { items, loading, error } = useEntityStore('rfis');
 */
const EMPTY_SLICE: EntitySlice = {
  items: [],
  loading: false,
  error: null,
  selectedId: null,
  filters: { ...DEFAULT_FILTERS, extra: {} },
};

export function useEntityStore<T extends BaseEntity = BaseEntity>(key: string): EntitySlice<T> {
  // Use a stable selector that doesn't create a new object each render
  const slice = useEntityStoreRoot((s) => s.slices[key]);

  // Lazily init the slice outside the render path (synchronous but only once)
  if (!slice) {
    // Direct state check + mutation avoids calling setState during render
    const state = useEntityStoreRoot.getState();
    if (!state.slices[key]) {
      state.initSlice(key);
    }
  }

  return (slice ?? EMPTY_SLICE) as EntitySlice<T>;
}

/**
 * Action creator for a specific entity type.
 *
 * The actions use Supabase directly against the table named `key`. For entities
 * that require a custom API layer or service functions, call those functions
 * yourself and then dispatch updates via the returned `setSlice` helper.
 *
 * @example
 *   const { loadItems, createItem } = useEntityActions('rfis');
 *   await loadItems(projectId);
 */
export function useEntityActions<T extends BaseEntity = BaseEntity>(
  key: string,
): EntityActions<T> & { setSlice: (patch: Partial<EntitySlice<T>>) => void } {
  const _setSlice = useEntityStoreRoot((s) => s._setSlice);
  const initSlice = useEntityStoreRoot((s) => s.initSlice);

  // Ensure the slice exists
  initSlice(key);

  const setSlice = (patch: Partial<EntitySlice<T>>) =>
    _setSlice(key, patch as Partial<EntitySlice>);

  return {
    setSlice,

    loadItems: async (projectId: string) => {
      setSlice({ loading: true, error: null });
      const { data, error } = await supabase
        .from(key)
        .select('*')
        .eq('project_id' as never, projectId)
        .order('created_at', { ascending: false });

      if (error) {
        setSlice({ error: error.message, loading: false });
      } else {
        setSlice({ items: (data ?? []) as unknown as T[], loading: false });
      }
    },

    createItem: async (payload: Omit<T, 'id'>) => {
      const { data, error } = await supabase
        .from(key)
        .insert(payload as never)
        .select()
        .single();

      if (error) {
        return { item: null, error: error.message };
      }

      const item = data as unknown as T;
      _setSlice(key, {}); // trigger re-render
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          [key]: {
            ...s.slices[key],
            items: [item, ...(s.slices[key]?.items ?? [])],
          },
        },
      }));

      return { item, error: null };
    },

    updateItem: async (id: string, updates: Partial<T>) => {
      const { error } = await supabase
        .from(key)
        .update(updates as never)
        .eq('id' as never, id);

      if (error) return { error: error.message };

      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          [key]: {
            ...s.slices[key],
            items: (s.slices[key]?.items ?? []).map((item) =>
              item.id === id ? { ...item, ...updates } : item,
            ),
          },
        },
      }));

      return { error: null };
    },

    deleteItem: async (id: string) => {
      const { error } = await supabase.from(key).delete().eq('id' as never, id);

      if (error) return { error: error.message };

      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          [key]: {
            ...s.slices[key],
            items: (s.slices[key]?.items ?? []).filter((item) => item.id !== id),
          },
        },
      }));

      return { error: null };
    },

    setSelectedId: (id: string | null) => {
      setSlice({ selectedId: id });
    },

    setFilters: (patch: Partial<EntityFilters>) => {
      const current =
        (useEntityStoreRoot.getState().slices[key]?.filters ?? { ...DEFAULT_FILTERS, extra: {} });
      setSlice({ filters: { ...current, ...patch } });
    },

    resetFilters: () => {
      setSlice({ filters: { ...DEFAULT_FILTERS, extra: {} } });
    },

    clearError: () => {
      setSlice({ error: null });
    },
  };
}
