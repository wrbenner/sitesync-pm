import { create } from 'zustand';
import { changeOrderService } from '../services/changeOrderService';
import type { ChangeOrder } from '../types/database';
import type { CreateChangeOrderInput } from '../services/changeOrderService';
import type { ChangeOrderState } from '../machines/changeOrderMachine';

interface ChangeOrderStoreState {
  changeOrders: ChangeOrder[];
  loading: boolean;
  error: string | null;

  loadChangeOrders: (projectId: string) => Promise<void>;
  createChangeOrder: (input: CreateChangeOrderInput) => Promise<{ error: string | null; changeOrder: ChangeOrder | null }>;
  updateChangeOrder: (changeOrderId: string, updates: Partial<ChangeOrder>) => Promise<{ error: string | null }>;
  transitionStatus: (changeOrderId: string, status: ChangeOrderState) => Promise<{ error: string | null }>;
  deleteChangeOrder: (changeOrderId: string) => Promise<{ error: string | null }>;
}

export const useChangeOrderStore = create<ChangeOrderStoreState>()((set) => ({
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
      set((s) => ({ changeOrders: [data, ...s.changeOrders] }));
    }
    return { error: null, changeOrder: data };
  },

  updateChangeOrder: async (changeOrderId, updates) => {
    const { error } = await changeOrderService.updateChangeOrder(changeOrderId, updates);
    if (!error) {
      set((s) => ({
        changeOrders: s.changeOrders.map((co) =>
          co.id === changeOrderId ? { ...co, ...updates } : co,
        ),
      }));
    }
    return { error };
  },

  transitionStatus: async (changeOrderId, status) => {
    const { error } = await changeOrderService.transitionStatus(changeOrderId, status);
    if (!error) {
      set((s) => ({
        changeOrders: s.changeOrders.map((co) =>
          co.id === changeOrderId ? { ...co, status } : co,
        ),
      }));
    }
    return { error };
  },

  deleteChangeOrder: async (changeOrderId) => {
    const { error } = await changeOrderService.deleteChangeOrder(changeOrderId);
    if (!error) {
      set((s) => ({
        changeOrders: s.changeOrders.filter((co) => co.id !== changeOrderId),
      }));
    }
    return { error };
  },
}));
