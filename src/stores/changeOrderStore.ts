// MIGRATED to entityStore — see src/stores/entityStore.ts
// This file is kept for backward-compatibility; all imports continue to work.
import { create } from 'zustand';
import { changeOrderService } from '../services/changeOrderService';
import type { ServiceError } from '../services/errors';
import type { ChangeOrder } from '../types/database';
import type { ChangeOrderState } from '../machines/changeOrderMachine';
import type { CreateChangeOrderInput } from '../services/changeOrderService';
import { useEntityStore, useEntityActions, useEntityStoreRoot } from './entityStore';

// ── Re-exports of generic entity hooks ────────────────────────────────────────
// New code should prefer useEntityStore("change_orders") and useEntityActions("change_orders").

export { useEntityStore as useChangeOrderEntityStore, useEntityActions as useChangeOrderEntityActions };

// ── Legacy store (backward-compat shim) ───────────────────────────────────────
// Keeps the exact same shape so every existing import continues to compile
// and behave correctly. Generic CRUD is delegated to entityStore where possible;
// change-order-specific logic (service calls, transitionStatus, promoteType) stays here.

interface ChangeOrderStoreState {
  changeOrders: ChangeOrder[];
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;

  loadChangeOrders: (projectId: string) => Promise<void>;
  createChangeOrder: (input: CreateChangeOrderInput) => Promise<{ error: string | null; changeOrder: ChangeOrder | null }>;
  updateChangeOrder: (coId: string, updates: Partial<ChangeOrder>) => Promise<{ error: string | null }>;
  transitionStatus: (coId: string, status: ChangeOrderState, comments?: string) => Promise<{ error: string | null }>;
  deleteChangeOrder: (coId: string) => Promise<{ error: string | null }>;
  promoteType: (coId: string) => Promise<{ error: string | null; changeOrder: ChangeOrder | null }>;
  clearError: () => void;
}

export const useChangeOrderStore = create<ChangeOrderStoreState>()((set) => ({
  changeOrders: [],
  loading: false,
  error: null,
  errorDetails: null,

  loadChangeOrders: async (projectId) => {
    // Mirror into entityStore so new code reading useEntityStore("change_orders") stays in sync
    useEntityStoreRoot.getState().initSlice('change_orders');
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await changeOrderService.loadChangeOrders(projectId);
    if (error) {
      // Preserve existing changeOrders so UI stays populated on transient errors
      set({ error: error.userMessage, errorDetails: error, loading: false });
      useEntityStoreRoot.getState()._setSlice('change_orders', { error: error.userMessage, loading: false });
    } else {
      const items = data ?? [];
      set({ changeOrders: items, loading: false });
      useEntityStoreRoot.getState()._setSlice('change_orders', { items, loading: false, error: null });
    }
  },

  createChangeOrder: async (input) => {
    const { data, error } = await changeOrderService.createChangeOrder(input);
    if (error) return { error: error.userMessage, changeOrder: null };
    if (data) {
      set((s) => ({ changeOrders: [data, ...s.changeOrders] }));
      // Mirror into entityStore
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          change_orders: {
            ...s.slices['change_orders'],
            items: [data, ...(s.slices['change_orders']?.items ?? [])],
          },
        },
      }));
    }
    return { error: null, changeOrder: data };
  },

  updateChangeOrder: async (coId, updates) => {
    const { error } = await changeOrderService.updateChangeOrder(coId, updates);
    if (error) return { error: error.userMessage };
    set((s) => ({
      changeOrders: s.changeOrders.map((co) =>
        co.id === coId ? { ...co, ...updates } : co
      ),
    }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        change_orders: {
          ...s.slices['change_orders'],
          items: (s.slices['change_orders']?.items ?? []).map((co) =>
            co.id === coId ? { ...co, ...updates } : co,
          ),
        },
      },
    }));
    return { error: null };
  },

  transitionStatus: async (coId, status, comments) => {
    const { error } = await changeOrderService.transitionStatus(coId, status, comments);
    if (error) return { error: error.userMessage };
    set((s) => ({
      changeOrders: s.changeOrders.map((co) =>
        co.id === coId ? { ...co, status } : co
      ),
    }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        change_orders: {
          ...s.slices['change_orders'],
          items: (s.slices['change_orders']?.items ?? []).map((co) =>
            co.id === coId ? { ...co, status } : co,
          ),
        },
      },
    }));
    return { error: null };
  },

  deleteChangeOrder: async (coId) => {
    const { error } = await changeOrderService.deleteChangeOrder(coId);
    if (error) return { error: error.userMessage };
    set((s) => ({ changeOrders: s.changeOrders.filter((co) => co.id !== coId) }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        change_orders: {
          ...s.slices['change_orders'],
          items: (s.slices['change_orders']?.items ?? []).filter((co) => co.id !== coId),
        },
      },
    }));
    return { error: null };
  },

  promoteType: async (coId) => {
    const { data, error } = await changeOrderService.promoteType(coId);
    if (error) return { error: error.userMessage, changeOrder: null };
    if (data) {
      set((s) => ({ changeOrders: [data, ...s.changeOrders] }));
      // Mirror into entityStore
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          change_orders: {
            ...s.slices['change_orders'],
            items: [data, ...(s.slices['change_orders']?.items ?? [])],
          },
        },
      }));
    }
    return { error: null, changeOrder: data };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
