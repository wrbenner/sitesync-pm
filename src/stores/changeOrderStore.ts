import { create } from 'zustand';
import { changeOrderService } from '../services/changeOrderService';
import type { ChangeOrder } from '../types/database';
import type { ChangeOrderState } from '../machines/changeOrderMachine';
import type { CreateChangeOrderInput } from '../services/changeOrderService';

interface ChangeOrderStoreState {
  changeOrders: ChangeOrder[];
  loading: boolean;
  error: string | null;

  loadChangeOrders: (projectId: string) => Promise<void>;
  createChangeOrder: (input: CreateChangeOrderInput) => Promise<{ error: string | null; changeOrder: ChangeOrder | null }>;
  updateChangeOrder: (coId: string, updates: Partial<ChangeOrder>) => Promise<{ error: string | null }>;
  transitionStatus: (coId: string, status: ChangeOrderState, comments?: string) => Promise<{ error: string | null }>;
  deleteChangeOrder: (coId: string) => Promise<{ error: string | null }>;
  promoteType: (coId: string) => Promise<{ error: string | null; changeOrder: ChangeOrder | null }>;
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

  updateChangeOrder: async (coId, updates) => {
    const { error } = await changeOrderService.updateChangeOrder(coId, updates);
    if (!error) {
      set((s) => ({
        changeOrders: s.changeOrders.map((co) =>
          co.id === coId ? { ...co, ...updates } : co
        ),
      }));
    }
    return { error };
  },

  transitionStatus: async (coId, status, comments) => {
    const { error } = await changeOrderService.transitionStatus(coId, status, comments);
    if (!error) {
      set((s) => ({
        changeOrders: s.changeOrders.map((co) =>
          co.id === coId ? { ...co, status } : co
        ),
      }));
    }
    return { error };
  },

  deleteChangeOrder: async (coId) => {
    const { error } = await changeOrderService.deleteChangeOrder(coId);
    if (!error) {
      set((s) => ({ changeOrders: s.changeOrders.filter((co) => co.id !== coId) }));
    }
    return { error };
  },

  promoteType: async (coId) => {
    const { data, error } = await changeOrderService.promoteType(coId);
    if (!error && data) {
      set((s) => ({ changeOrders: [data, ...s.changeOrders] }));
    }
    return { error, changeOrder: data };
  },
}));
