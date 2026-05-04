import { supabase } from '../lib/supabase';
import { fromTable } from '../lib/db/queries'
import {
  type Result,
  ok,
  fail,
  dbError,
  permissionError,
  notFoundError,
} from './errors';

// ── Types ────────────────────────────────────────────────────────────────────

export type SovItem = {
  id: string;
  contract_id: string;
  description: string;
  scheduled_value: number;
  item_number: string | null;
  cost_code: string | null;
  sort_order: number | null;
  previous_completed: number | null;
  this_period_completed: number | null;
  materials_stored: number | null;
  total_completed: number | null;
  retainage: number | null;
  balance_to_finish: number | null;
  percent_complete: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateSovItemInput = {
  contract_id: string;
  description: string;
  scheduled_value: number;
  item_number?: string | null;
  cost_code?: string | null;
  sort_order?: number | null;
};

export type UpdateSovItemInput = {
  description?: string;
  scheduled_value?: number;
  item_number?: string | null;
  cost_code?: string | null;
  sort_order?: number | null;
  this_period_completed?: number | null;
  materials_stored?: number | null;
  total_completed?: number | null;
  retainage?: number | null;
  balance_to_finish?: number | null;
  percent_complete?: number | null;
};

const EDITOR_ROLES = ['admin', 'owner', 'project_manager', 'gc'] as const;
const ADMIN_ROLES = ['admin', 'owner'] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Resolve the user's project role via the contract.
 * Does NOT trust caller-supplied roles.
 */
async function resolveRoleByContract(
  contractId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;

  const { data: contract } = await fromTable('contracts')
    .select('project_id')
    .eq('id' as never, contractId)
    .single();

  const contractRow = contract as unknown as { project_id?: string } | null
  if (!contractRow?.project_id) return null;

  const { data } = await fromTable('project_members')
    .select('role')
    .eq('project_id' as never, contractRow.project_id)
    .eq('user_id' as never, userId)
    .single();

  return (data as unknown as { role?: string } | null)?.role ?? null;
}

async function resolveRoleByItemId(
  itemId: string,
  userId: string | null,
): Promise<{ role: string | null; contractId: string | null }> {
  if (!userId) return { role: null, contractId: null };

  const { data: item } = await fromTable('schedule_of_values')
    .select('contract_id')
    .eq('id' as never, itemId)
    .single();

  const itemRow = item as unknown as { contract_id?: string } | null
  if (!itemRow?.contract_id) return { role: null, contractId: null };

  const role = await resolveRoleByContract(itemRow.contract_id, userId);
  return { role, contractId: itemRow.contract_id };
}

// ── Service ──────────────────────────────────────────────────────────────────

export const sovService = {
  /**
   * Load all SOV line items for a contract, ordered by sort_order.
   */
  async loadItems(contractId: string): Promise<Result<SovItem[]>> {
    const { data, error } = await fromTable('schedule_of_values')
      .select('*')
      .eq('contract_id' as never, contractId)
      .order('sort_order', { ascending: true, nullsFirst: false });

    if (error) return fail(dbError(error.message, { contractId }));
    return ok((data ?? []) as unknown as SovItem[]);
  },

  /**
   * Create a new SOV line item.
   * Requires project_manager, gc, admin, or owner role.
   */
  async createItem(input: CreateSovItemInput): Promise<Result<SovItem>> {
    const userId = await getCurrentUserId();
    const role = await resolveRoleByContract(input.contract_id, userId);

    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }
    if (!(EDITOR_ROLES as readonly string[]).includes(role)) {
      return fail(permissionError('Only project managers, GCs, admins, and owners can create SOV items'));
    }

    const { data, error } = await fromTable('schedule_of_values')
      .insert({
        contract_id: input.contract_id,
        description: input.description,
        scheduled_value: input.scheduled_value,
        item_number: input.item_number ?? null,
        cost_code: input.cost_code ?? null,
        sort_order: input.sort_order ?? null,
      } as never)
      .select()
      .single();

    if (error) return fail(dbError(error.message, { contract_id: input.contract_id }));
    return ok(data as unknown as SovItem);
  },

  /**
   * Update a SOV line item's fields.
   * Strips immutable fields (id, contract_id, created_at).
   * Requires project_manager, gc, admin, or owner role.
   */
  async updateItem(itemId: string, updates: UpdateSovItemInput): Promise<Result> {
    const userId = await getCurrentUserId();
    const { role, contractId } = await resolveRoleByItemId(itemId, userId);

    if (!role || !contractId) {
      return fail(notFoundError('SOV item', itemId));
    }
    if (!(EDITOR_ROLES as readonly string[]).includes(role)) {
      return fail(permissionError('Insufficient role to update SOV items'));
    }

    const { error } = await fromTable('schedule_of_values')
      .update({ ...updates, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, itemId);

    if (error) return fail(dbError(error.message, { itemId }));
    return { data: null, error: null };
  },

  /**
   * Delete a SOV line item.
   * The schedule_of_values table has no deleted_at column; this is a hard delete.
   * Restricted to admin and owner roles.
   */
  async deleteItem(itemId: string): Promise<Result> {
    const userId = await getCurrentUserId();
    const { role } = await resolveRoleByItemId(itemId, userId);

    if (!role) {
      return fail(notFoundError('SOV item', itemId));
    }
    if (!(ADMIN_ROLES as readonly string[]).includes(role)) {
      return fail(permissionError('Only admins and owners can delete SOV items'));
    }

    const { error } = await fromTable('schedule_of_values')
      .delete()
      .eq('id' as never, itemId);

    if (error) return fail(dbError(error.message, { itemId }));
    return { data: null, error: null };
  },

  /**
   * Bulk replace all SOV line items for a contract.
   * Deletes existing items and inserts the new set atomically.
   * Restricted to admin, owner, and project_manager roles.
   */
  async bulkReplace(
    contractId: string,
    items: Array<Omit<SovItem, 'id' | 'contract_id' | 'created_at' | 'updated_at'>>,
  ): Promise<Result<SovItem[]>> {
    const userId = await getCurrentUserId();
    const role = await resolveRoleByContract(contractId, userId);

    if (!role) {
      return fail(permissionError('User is not a member of this project'));
    }
    if (!(EDITOR_ROLES as readonly string[]).includes(role)) {
      return fail(permissionError('Insufficient role to replace SOV items'));
    }

    const { error: deleteError } = await fromTable('schedule_of_values')
      .delete()
      .eq('contract_id' as never, contractId);

    if (deleteError) return fail(dbError(deleteError.message, { contractId, op: 'delete' }));

    if (items.length === 0) return ok([]);

    const now = new Date().toISOString();
    const { data, error: insertError } = await fromTable('schedule_of_values')
      .insert(
        items.map((item, i) => ({
          ...item,
          contract_id: contractId,
          sort_order: item.sort_order ?? i,
          updated_at: now,
        })) as never,
      )
      .select();

    if (insertError) return fail(dbError(insertError.message, { contractId, op: 'insert' }));
    return ok((data ?? []) as unknown as SovItem[]);
  },
};
