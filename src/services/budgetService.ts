import { supabase } from '../lib/supabase';
import type { BudgetItem, ChangeOrder } from '../types/database';
import { type Result, ok, fail, dbError } from './errors';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type BudgetItemInsert = {
  project_id: string;
  division: string;
  csi_division?: string | null;
  cost_code?: string | null;
  description?: string | null;
  original_amount?: number | null;
  actual_amount?: number | null;
  committed_amount?: number | null;
  forecast_amount?: number | null;
};

export type BudgetItemUpdate = Partial<Omit<BudgetItemInsert, 'project_id'>>;

// ── Service ──────────────────────────────────────────────────────────────────

export const budgetService = {
  async loadBudgetItems(projectId: string): Promise<Result<BudgetItem[]>> {
    const { data, error } = await supabase
      .from('budget_items')
      .select('*')
      .eq('project_id', projectId)
      .order('csi_division');

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as BudgetItem[]);
  },

  async importItems(projectId: string, items: BudgetItemInsert[]): Promise<Result<BudgetItem[]>> {
    const rows = items.map((i) => ({ ...i, project_id: projectId }));
    const { data, error } = await supabase
      .from('budget_items')
      .insert(rows)
      .select();

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as BudgetItem[]);
  },

  async addItem(item: BudgetItemInsert): Promise<Result<BudgetItem>> {
    const { data, error } = await supabase
      .from('budget_items')
      .insert(item)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: item.project_id }));
    return ok(data as BudgetItem);
  },

  async updateItem(id: string, updates: BudgetItemUpdate): Promise<Result> {
    const { error } = await supabase
      .from('budget_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return fail(dbError(error.message, { id }));
    return { data: null, error: null };
  },

  async loadChangeOrders(projectId: string): Promise<Result<ChangeOrder[]>> {
    const { data, error } = await supabase
      .from('change_orders')
      .select('*')
      .eq('project_id', projectId)
      .order('number');

    if (error) return fail(dbError(error.message, { projectId }));
    return ok((data ?? []) as ChangeOrder[]);
  },

  async addChangeOrder(co: {
    project_id: string;
    description: string;
    title?: string | null;
    amount?: number | null;
    status?: string | null;
    type?: string | null;
    cost_code?: string | null;
  }): Promise<Result<ChangeOrder>> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('change_orders')
      .insert({ ...co, requested_by: userId })
      .select()
      .single();

    if (error) return fail(dbError(error.message, { project_id: co.project_id }));
    return ok(data as ChangeOrder);
  },

  async updateChangeOrderStatus(id: string, status: string, approvedBy?: string): Promise<Result> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (approvedBy) {
      updates.approved_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('change_orders')
      .update(updates)
      .eq('id', id);

    if (error) return fail(dbError(error.message, { id, status }));
    return { data: null, error: null };
  },
};
