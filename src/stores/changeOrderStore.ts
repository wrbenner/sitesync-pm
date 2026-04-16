import { create } from 'zustand';
import { changeOrderService } from '../services/changeOrderService';
import type { ChangeOrderRecord, CreateChangeOrderInput } from '../services/changeOrderService';

// ── Store Interface ───────────────────────────────────────────────────────────

interface ChangeOrderStore {
  changeOrders: ChangeOrderRecord[];
  loading: boolean;
  error: string | null;

  loadChangeOrders: (projectId: string) => Promise<void>;
  createChangeOrder: (input: CreateChangeOrderInput) => Promise<{
    error: string | null;
    changeOrder: ChangeOrderRecord | null;
  }>;
  updateChangeOrder: (coId: string, updates: Partial<ChangeOrderRecord>) => Promise<{
    error: string | null;
  }>;
  transitionStatus: (coId: string, action: string) => Promise<{ error: string | null }>;
  approveChangeOrder: (
    coId: string,
    approvedCost?: number,
    comments?: string,
  ) => Promise<{ error: string | null }>;
  rejectChangeOrder: (coId: string, comments: string) => Promise<{ error: string | null }>;
  promoteChangeOrder: (coId: string) => Promise<{
    error: string | null;
    changeOrder: ChangeOrderRecord | null;
  }>;
  deleteChangeOrder: (coId: string) => Promise<{ error: string | null }>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChangeOrderStore = create<ChangeOrderStore>()((set, get) => ({
  changeOrders: [],
  loading: false,
  error: null,

  loadChangeOrders: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await changeOrderService.loadChangeOrders(projectId);
    if (error) {
      set({ error, loading: false });
    } else {
      set({ changeOrders: data ?? [], loading: false });
    }
  },

  createChangeOrder: async (input) => {
    const { data, error } = await changeOrderService.createChangeOrder(input);
    if (error) return { error, changeOrder: null };
    if (data) {
      // Prepend so newest appears first (consistent with loadChangeOrders order)
      set((s) => ({ changeOrders: [data, ...s.changeOrders] }));
    }
    return { error: null, changeOrder: data };
  },

  updateChangeOrder: async (coId, updates) => {
    // Optimistic: apply locally before the server round-trip
    set((s) => ({
      changeOrders: s.changeOrders.map((co) =>
        co.id === coId ? { ...co, ...updates } : co,
      ),
    }));

    const { error } = await changeOrderService.updateChangeOrder(coId, updates);

    if (error) {
      // Revert optimistic update on failure — reload authoritative state
      const projectId = get().changeOrders.find((co) => co.id === coId)?.project_id;
      if (projectId) {
        await get().loadChangeOrders(projectId);
      }
    }

    return { error };
  },

  transitionStatus: async (coId, action) => {
    const { error } = await changeOrderService.transitionStatus(coId, action);
    if (!error) {
      // Reload to get the authoritative status from the server — the state
      // machine may have set additional fields (submitted_at, etc.) via the
      // service. An optimistic update here risks diverging from server state.
      const projectId = get().changeOrders.find((co) => co.id === coId)?.project_id;
      if (projectId) {
        await get().loadChangeOrders(projectId);
      }
    }
    return { error };
  },

  approveChangeOrder: async (coId, approvedCost, comments) => {
    const { error } = await changeOrderService.approveChangeOrder(coId, approvedCost, comments);
    if (!error) {
      // Reload to reflect approved_cost, approved_by, approved_at from server
      const projectId = get().changeOrders.find((co) => co.id === coId)?.project_id;
      if (projectId) {
        await get().loadChangeOrders(projectId);
      }
    }
    return { error };
  },

  rejectChangeOrder: async (coId, comments) => {
    const { error } = await changeOrderService.rejectChangeOrder(coId, comments);
    if (!error) {
      const projectId = get().changeOrders.find((co) => co.id === coId)?.project_id;
      if (projectId) {
        await get().loadChangeOrders(projectId);
      }
    }
    return { error };
  },

  promoteChangeOrder: async (coId) => {
    const { data, error } = await changeOrderService.promoteChangeOrder(coId);
    if (!error && data) {
      // Append the new promoted CO and refresh the source's promoted_at timestamp
      const projectId = get().changeOrders.find((co) => co.id === coId)?.project_id;
      if (projectId) {
        // Full reload ensures both the source (now marked promoted_at) and
        // the new CO appear correctly ordered in the store.
        await get().loadChangeOrders(projectId);
      }
    }
    return { error, changeOrder: data };
  },

  deleteChangeOrder: async (coId) => {
    // Optimistic removal
    set((s) => ({
      changeOrders: s.changeOrders.filter((co) => co.id !== coId),
    }));

    const { error } = await changeOrderService.deleteChangeOrder(coId);

    if (error) {
      // Revert optimistic removal on failure
      const projectId = get().changeOrders.find((co) => co.id === coId)?.project_id;
      if (projectId) {
        await get().loadChangeOrders(projectId);
      }
    }

    return { error };
  },
}));
