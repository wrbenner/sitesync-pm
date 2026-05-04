import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import {
  type Cents,
  addCents,
  dollarsToCents,
  fromCents,
} from '../types/money'

// ── Change Order Line Items Service ───────────────────────────────────────────
// Breaks a CO into individual line items by cost code, each with an amount.
// The sum of line items should equal the parent CO amount.

export interface COLineItem {
  id: string
  change_order_id: string
  project_id: string
  cost_code: string | null
  description: string
  amount: number
  quantity: number
  unit: string
  unit_cost: number | null
  budget_item_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateCOLineItemPayload {
  change_order_id: string
  project_id: string
  cost_code?: string | null
  description: string
  amount: number
  quantity?: number
  unit?: string
  unit_cost?: number | null
  budget_item_id?: string | null
  sort_order?: number
}

export interface UpdateCOLineItemPayload {
  cost_code?: string | null
  description?: string
  amount?: number
  quantity?: number
  unit?: string
  unit_cost?: number | null
  budget_item_id?: string | null
  sort_order?: number
}

/**
 * Fetch all line items for a change order.
 */
export async function getCOLineItems(changeOrderId: string): Promise<COLineItem[]> {
  const { data, error } = await fromTable('change_order_line_items')
    .select('*')
    .eq('change_order_id' as never, changeOrderId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[COLineItems] Failed to fetch:', error.message)
    return []
  }
  return (data ?? []) as unknown as COLineItem[]
}

/**
 * Create a new line item for a change order.
 * Also updates the parent CO's amount to equal the sum of all line items.
 */
export async function createCOLineItem(payload: CreateCOLineItemPayload): Promise<COLineItem | null> {
  const { data, error } = await fromTable('change_order_line_items')
    .insert({
      change_order_id: payload.change_order_id,
      project_id: payload.project_id,
      cost_code: payload.cost_code ?? null,
      description: payload.description,
      amount: payload.amount,
      quantity: payload.quantity ?? 1,
      unit: payload.unit ?? 'LS',
      unit_cost: payload.unit_cost ?? null,
      budget_item_id: payload.budget_item_id ?? null,
      sort_order: payload.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[COLineItems] Failed to create:', error.message)
    return null
  }

  // Recalculate parent CO amount
  await syncCOAmountFromLineItems(payload.change_order_id)

  return data as unknown as COLineItem
}

/**
 * Update an existing line item.
 */
export async function updateCOLineItem(
  lineItemId: string,
  updates: UpdateCOLineItemPayload,
): Promise<COLineItem | null> {
  const { data, error } = await fromTable('change_order_line_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id' as never, lineItemId)
    .select()
    .single()

  if (error) {
    console.error('[COLineItems] Failed to update:', error.message)
    return null
  }

  const item = data as unknown as COLineItem
  await syncCOAmountFromLineItems(item.change_order_id)

  return item
}

/**
 * Delete a line item.
 */
export async function deleteCOLineItem(lineItemId: string, changeOrderId: string): Promise<boolean> {
  const { error } = await fromTable('change_order_line_items')
    .delete()
    .eq('id' as never, lineItemId)

  if (error) {
    console.error('[COLineItems] Failed to delete:', error.message)
    return false
  }

  await syncCOAmountFromLineItems(changeOrderId)
  return true
}

/**
 * Recalculate the parent change order's amount from the sum of its line items.
 * This ensures the CO total always equals the sum of its breakdown.
 */
async function syncCOAmountFromLineItems(changeOrderId: string): Promise<void> {
  const { data: items, error } = await fromTable('change_order_line_items')
    .select('amount')
    .eq('change_order_id' as never, changeOrderId)

  if (error || !items) return

  // Sum line items on integer cents via the canonical helpers from
  // src/types/money.ts so this code uses the same primitives as the rest
  // of the cents-discipline boundary. DB stores dollars; convert at write.
  const totalC: Cents = items.reduce<Cents>(
    (acc, row) => addCents(acc, dollarsToCents((row.amount as number) ?? 0)),
    0 as Cents,
  )
  const total = fromCents(totalC) / 100

  await fromTable('change_orders')
    .update({ amount: total, updated_at: new Date().toISOString() })
    .eq('id' as never, changeOrderId)
}
