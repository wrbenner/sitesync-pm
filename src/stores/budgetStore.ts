import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

const MOCK_DIVISIONS: BudgetDivision[] = [
  { id: 'div-1', project_id: 'project-1', name: 'Structural', code: '03-05', budgeted_amount: 12500000, spent: 9800000, committed: 2100000, created_at: '2025-01-15T00:00:00Z' },
  { id: 'div-2', project_id: 'project-1', name: 'Mechanical', code: '23', budgeted_amount: 8500000, spent: 4200000, committed: 2800000, created_at: '2025-01-15T00:00:00Z' },
  { id: 'div-3', project_id: 'project-1', name: 'Electrical', code: '26', budgeted_amount: 6200000, spent: 3100000, committed: 1900000, created_at: '2025-01-15T00:00:00Z' },
  { id: 'div-4', project_id: 'project-1', name: 'Interior', code: '09-12', budgeted_amount: 9800000, spent: 3500000, committed: 2200000, created_at: '2025-01-15T00:00:00Z' },
  { id: 'div-5', project_id: 'project-1', name: 'Site Work', code: '31-33', budgeted_amount: 4500000, spent: 3800000, committed: 500000, created_at: '2025-01-15T00:00:00Z' },
  { id: 'div-6', project_id: 'project-1', name: 'General Conditions', code: '01', budgeted_amount: 6000000, spent: 3600000, committed: 1200000, created_at: '2025-01-15T00:00:00Z' },
];

const MOCK_CHANGE_ORDERS: ChangeOrder[] = [
  { id: 'co-1', project_id: 'project-1', co_number: 1, title: 'Foundation redesign for soil conditions', description: 'Unexpected soil conditions required deeper pilings and additional reinforcement.', amount: 125000, status: 'approved', submitted_by: 'user-1', approved_by: 'user-2', created_at: '2025-02-15T10:00:00Z', updated_at: '2025-02-20T14:00:00Z' },
  { id: 'co-2', project_id: 'project-1', co_number: 2, title: 'Additional fire suppression on parking level', description: 'Code review required additional fire suppression coverage in parking levels P1 and P2.', amount: 89000, status: 'approved', submitted_by: 'user-2', approved_by: 'user-1', created_at: '2025-03-01T09:00:00Z', updated_at: '2025-03-05T16:00:00Z' },
  { id: 'co-3', project_id: 'project-1', co_number: 3, title: 'Upgraded lobby finishes per owner directive', description: 'Owner requested premium stone finishes in main lobby and elevator lobbies.', amount: 215000, status: 'approved', submitted_by: 'user-1', approved_by: 'user-2', created_at: '2025-03-10T11:00:00Z', updated_at: '2025-03-15T10:00:00Z' },
  { id: 'co-4', project_id: 'project-1', co_number: 4, title: 'Lobby marble upgrade per owner request', description: 'Additional marble cladding in elevator lobbies on floors 2 through 12.', amount: 78000, status: 'pending', submitted_by: 'user-1', approved_by: null, created_at: '2025-03-18T14:00:00Z', updated_at: '2025-03-18T14:00:00Z' },
  { id: 'co-5', project_id: 'project-1', co_number: 5, title: 'Fire suppression system modifications', description: 'Modifications to fire suppression routing due to HVAC conflicts on floors 5 through 8.', amount: 42000, status: 'approved', submitted_by: 'user-2', approved_by: 'user-1', created_at: '2025-03-20T09:00:00Z', updated_at: '2025-03-22T15:00:00Z' },
];

const MOCK_LINE_ITEMS: Record<string, BudgetLineItem[]> = {
  'div-1': [
    { id: 'li-1', division_id: 'div-1', description: 'Structural steel framing', cost_code: '05 12 00', quantity: 1, unit: 'LS', unit_cost: 6800000, total: 6800000 },
    { id: 'li-2', division_id: 'div-1', description: 'Concrete (elevated slabs)', cost_code: '03 30 00', quantity: 12000, unit: 'CY', unit_cost: 285, total: 3420000 },
    { id: 'li-3', division_id: 'div-1', description: 'Reinforcing steel', cost_code: '03 20 00', quantity: 850, unit: 'TON', unit_cost: 2682, total: 2280000 },
  ],
  'div-2': [
    { id: 'li-4', division_id: 'div-2', description: 'HVAC systems', cost_code: '23 05 00', quantity: 1, unit: 'LS', unit_cost: 5200000, total: 5200000 },
    { id: 'li-5', division_id: 'div-2', description: 'Plumbing systems', cost_code: '22 00 00', quantity: 1, unit: 'LS', unit_cost: 2100000, total: 2100000 },
    { id: 'li-6', division_id: 'div-2', description: 'Fire protection', cost_code: '21 00 00', quantity: 1, unit: 'LS', unit_cost: 1200000, total: 1200000 },
  ],
};

let coCounter = 5;

export const useBudgetStore = create<BudgetState>()((set, get) => ({
  divisions: [],
  lineItems: {},
  changeOrders: [],
  loading: false,
  error: null,

  loadBudget: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({
        divisions: MOCK_DIVISIONS.filter((d) => d.project_id === projectId),
        changeOrders: MOCK_CHANGE_ORDERS.filter((co) => co.project_id === projectId),
        loading: false,
      });
      return;
    }

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
    if (!isSupabaseConfigured) {
      const newDivisions = divisions.map((d, i) => ({
        ...d,
        id: `div-import-${Date.now()}-${i}`,
        project_id: projectId,
        created_at: new Date().toISOString(),
      }));
      set((s) => ({ divisions: [...s.divisions, ...newDivisions] }));
      return { error: null };
    }

    const { error } = await (supabase.from('budget_divisions') as any).insert(
      divisions.map((d) => ({ ...d, project_id: projectId }))
    );

    if (error) return { error: error.message };
    await get().loadBudget(projectId);
    return { error: null };
  },

  addDivision: async (division) => {
    if (!isSupabaseConfigured) {
      const newDiv = {
        ...division,
        id: `div-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      set((s) => ({ divisions: [...s.divisions, newDiv] }));
      return { error: null };
    }

    const { error } = await (supabase.from('budget_divisions') as any).insert(division);
    if (error) return { error: error.message };
    await get().loadBudget(division.project_id);
    return { error: null };
  },

  updateDivision: async (id, updates) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        divisions: s.divisions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      }));
      return { error: null };
    }

    const { error } = await (supabase.from('budget_divisions') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        divisions: s.divisions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      }));
    }
    return { error: error?.message ?? null };
  },

  loadLineItems: async (divisionId) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        lineItems: { ...s.lineItems, [divisionId]: MOCK_LINE_ITEMS[divisionId] ?? [] },
      }));
      return;
    }

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
    if (!isSupabaseConfigured) {
      const newItem = { ...item, id: `li-${Date.now()}` };
      set((s) => ({
        lineItems: {
          ...s.lineItems,
          [item.division_id]: [...(s.lineItems[item.division_id] ?? []), newItem],
        },
      }));
      return { error: null };
    }

    const { error } = await (supabase.from('budget_line_items') as any).insert(item);
    if (!error) {
      await get().loadLineItems(item.division_id);
    }
    return { error: error?.message ?? null };
  },

  loadChangeOrders: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ changeOrders: MOCK_CHANGE_ORDERS.filter((co) => co.project_id === projectId) });
      return;
    }

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
    if (!isSupabaseConfigured) {
      coCounter++;
      const newCO: ChangeOrder = {
        ...co,
        id: `co-${Date.now()}`,
        co_number: coCounter,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((s) => ({ changeOrders: [...s.changeOrders, newCO] }));
      return { error: null };
    }

    const { error } = await (supabase.from('change_orders') as any).insert(co);
    if (!error) await get().loadChangeOrders(co.project_id);
    return { error: error?.message ?? null };
  },

  updateChangeOrderStatus: async (id, status, approvedBy) => {
    const updates: Partial<ChangeOrder> = { status, updated_at: new Date().toISOString() };
    if (approvedBy) updates.approved_by = approvedBy;

    if (!isSupabaseConfigured) {
      set((s) => ({
        changeOrders: s.changeOrders.map((co) => (co.id === id ? { ...co, ...updates } : co)),
      }));
      return { error: null };
    }

    const { error } = await (supabase.from('change_orders') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        changeOrders: s.changeOrders.map((co) => (co.id === id ? { ...co, ...updates } : co)),
      }));
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
