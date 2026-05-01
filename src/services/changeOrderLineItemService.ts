import { supabase } from '../lib/supabase'

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
  const { data, error } = await supabase
    .from('change_order_line_items')
    .select('*')
    .eq('change_order_id', changeOrderId)
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
  const { data, error } = await supabase
    .from('change_order_line_items')
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
  const { data, error } = await supabase
    .from('change_order_line_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', lineItemId)
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
  const { error } = await supabase
    .from('change_order_line_items')
    .delete()
    .eq('id', lineItemId)

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
  const { data: items, error } = await supabase
    .from('change_order_line_items')
    .select('amount')
    .eq('change_order_id', changeOrderId)

  if (error || !items) return

  // Sum line items in integer cents to avoid float drift across many rows
  // (matches the convention in src/services/reportService.ts and
  // src/services/pdf/paymentAppPdf.ts). DB stores dollars; convert at write.
  const totalCents = items.reduce<number>(
    (acc, row) => acc + Math.round(((row.amount as number) ?? 0) * 100),
    0,
  )
  const total = totalCents / 100

  await supabase
    .from('change_orders')
    .update({ amount: total, updated_at: new Date().toISOString() })
    .eq('id', changeOrderId)
}
