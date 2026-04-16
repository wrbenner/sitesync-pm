// TODO: Migrate to entityStore — see src/stores/entityStore.ts
import { create } from 'zustand';
import { supabase, fromTable } from '../lib/supabase';
import type { BudgetDivision, BudgetLineItem, ChangeOrder, ChangeOrderStatus } from '../types/database';

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalCommitted: number;
  remaining: number;
  contingency: number;
  contingencyUsed: number;
}

interface BudgetState {
  divisions: BudgetDivision[];
  lineItems: Record<string, BudgetLineItem[]>;
  changeOrders: ChangeOrder[];
  loading: boolean;
  error: string | null;

  loadBudget: (projectId: string) => Promise<void>;
  importDivisions: (projectId: string, divisions: Omit<BudgetDivision, 'id' | 'created_at'>[]) => Promise<{ error: string | null }>;
  addDivision: (division: Omit<BudgetDivision, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateDivision: (id: string, updates: Partial<BudgetDivision>) => Promise<{ error: string | null }>;
  loadLineItems: (divisionId: string) => Promise<void>;
  addLineItem: (item: Omit<BudgetLineItem, 'id'>) => Promise<{ error: string | null }>;
  loadChangeOrders: (projectId: string) => Promise<void>;
  addChangeOrder: (co: Omit<ChangeOrder, 'id' | 'co_number' | 'created_at' | 'updated_at'>) => Promise<{ error: string | null }>;
  updateChangeOrderStatus: (id: string, status: ChangeOrderStatus, approvedBy?: string) => Promise<{ error: string | null }>;
  getSummary: () => BudgetSummary;
}

export const useBudgetStore = create<BudgetState>()((set, get) => ({
  divisions: [],
  lineItems: {},
  changeOrders: [],
  loading: false,
  error: null,

  loadBudget: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const [divResult, coResult] = await Promise.all([
        supabase.from('budget_divisions').select('*').eq('project_id', projectId).order('code'),
        supabase.from('change_orders').select('*').eq('project_id', projectId).order('co_number'),
      ]);

      if (divResult.error) throw divResult.error;
      if (coResult.error) throw coResult.error;

      set({
        divisions: (divResult.data ?? []) as BudgetDivision[],
        changeOrders: (coResult.data ?? []) as ChangeOrder[],
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  importDivisions: async (projectId, divisions) => {
    const { error } = await fromTable('budget_divisions').insert(
      divisions.map((d) => ({ ...d, project_id: projectId }))
    );

    if (error) return { error: error.message };
    await get().loadBudget(projectId);
    return { error: null };
  },

  addDivision: async (division) => {
    const { error } = await fromTable('budget_divisions').insert(division);
    if (error) return { error: error.message };
    await get().loadBudget(division.project_id);
    return { error: null };
  },

  updateDivision: async (id, updates) => {
    const { error } = await fromTable('budget_divisions').update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        divisions: s.divisions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      }));
    }
    return { error: error?.message ?? null };
  },

  loadLineItems: async (divisionId) => {
    const { data, error } = await supabase
      .from('budget_line_items')
      .select('*')
      .eq('division_id', divisionId)
      .order('cost_code');

    if (!error && data) {
      set((s) => ({
        lineItems: { ...s.lineItems, [divisionId]: data as BudgetLineItem[] },
      }));
    }
  },

  addLineItem: async (item) => {
    const { error } = await supabase.from('budget_line_items').insert(item);
    if (!error) {
      await get().loadLineItems(item.division_id);
    }
    return { error: error?.message ?? null };
  },

  loadChangeOrders: async (projectId) => {
    const { data, error } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .order('co_number');

    if (!error && data) {
      set({ changeOrders: data as ChangeOrder[] });
    }
  },

  addChangeOrder: async (co) => {
    const { error } = await supabase.from('change_orders').insert(co);
    if (!error) await get().loadChangeOrders(co.project_id);
    return { error: error?.message ?? null };
  },

  updateChangeOrderStatus: async (id, status, approvedBy) => {
    const updates: Partial<ChangeOrder> = { status, updated_at: new Date().toISOString() };
    if (approvedBy) updates.approved_by = approvedBy;

    // Optimistically apply before the DB write so the UI reflects the change immediately.
    // Capture previous state for rollback on error.
    const previous = get().changeOrders;
    set((s) => ({
      changeOrders: s.changeOrders.map((co) => (co.id === id ? { ...co, ...updates } : co)),
    }));

    const { error } = await supabase.from('change_orders').update(updates).eq('id', id);
    if (error) {
      // Roll back the optimistic update so the UI stays consistent with the DB.
      set({ changeOrders: previous });
    }
    return { error: error?.message ?? null };
  },

  getSummary: () => {
    const { divisions, changeOrders } = get();
    const totalBudget = divisions.reduce((s, d) => s + d.budgeted_amount, 0);
    const totalSpent = divisions.reduce((s, d) => s + d.spent, 0);
    const totalCommitted = divisions.reduce((s, d) => s + d.committed, 0);
    const approvedCOs = changeOrders.filter((co) => co.status === 'approved').reduce((s, co) => s + co.amount, 0);
    return {
      totalBudget,
      totalSpent,
      totalCommitted,
      remaining: totalBudget - totalSpent - totalCommitted,
      contingency: 3800000,
      contingencyUsed: approvedCOs,
    };
  },
}));
