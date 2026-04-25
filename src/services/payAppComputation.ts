// 7-step pay application computation pipeline
// Adapted from MicroRealEstate's rent computation for construction pay applications (AIA G702/G703)

export interface PayAppLineItem {
  id: string
  description: string
  scheduled_value: number
  previous_completed: number
  this_period: number
  materials_stored: number
}

export interface PayAppComputation {
  // Step 1: Base - sum of scheduled values
  contract_sum: number
  // Step 2: Work completed
  total_completed_to_date: number
  total_materials_stored: number
  // Step 3: Retainage
  retainage_rate: number
  retainage_amount: number
  // Step 4: Previous payments
  total_previous_payments: number
  // Step 5: Change orders
  approved_change_orders: number
  // Step 6: Current amount due
  current_payment_due: number
  // Step 7: Balance to finish
  balance_to_finish: number
  percent_complete: number
}

export function computePayApp(
  lineItems: PayAppLineItem[],
  retainageRate: number,
  previousPayments: number,
  changeOrdersTotal: number
): PayAppComputation {
  // Step 1: Contract sum
  const contract_sum = lineItems.reduce((s, li) => s + li.scheduled_value, 0)

  // Step 2: Work completed
  const total_completed_to_date = lineItems.reduce(
    (s, li) => s + li.previous_completed + li.this_period,
    0
  )
  const total_materials_stored = lineItems.reduce((s, li) => s + li.materials_stored, 0)
  const gross_completed = total_completed_to_date + total_materials_stored

  // Step 3: Retainage
  const retainage_amount = gross_completed * (retainageRate / 100)
  const net_completed = gross_completed - retainage_amount

  // Step 4: Previous payments
  const total_previous_payments = previousPayments

  // Step 5: Change orders
  const approved_change_orders = changeOrdersTotal
  const adjusted_contract = contract_sum + approved_change_orders

  // Step 6: Current amount due
  const current_payment_due = net_completed - total_previous_payments

  // Step 7: Balance
  const balance_to_finish = adjusted_contract - gross_completed
  const percent_complete = adjusted_contract > 0 ? (gross_completed / adjusted_contract) * 100 : 0

  return {
    contract_sum,
    total_completed_to_date,
    total_materials_stored,
    retainage_rate: retainageRate,
    retainage_amount,
    total_previous_payments,
    approved_change_orders,
    current_payment_due,
    balance_to_finish,
    percent_complete,
  }
}

/** Compute a single line item's completion percentage */
export function lineItemPercentComplete(item: PayAppLineItem): number {
  if (item.scheduled_value <= 0) return 0
  const completed = item.previous_completed + item.this_period + item.materials_stored
  return Math.min((completed / item.scheduled_value) * 100, 100)
}

/** Validate that line item values don't exceed scheduled values */
export function validatePayAppLineItems(
  lineItems: PayAppLineItem[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  for (const li of lineItems) {
    const total = li.previous_completed + li.this_period + li.materials_stored
    if (total > li.scheduled_value) {
      errors.push(
        `Line "${li.description}": total completed ($${total.toLocaleString()}) exceeds scheduled value ($${li.scheduled_value.toLocaleString()})`
      )
    }
    if (li.this_period < 0) {
      errors.push(`Line "${li.description}": this period amount cannot be negative`)
    }
  }
  return { valid: errors.length === 0, errors }
}
