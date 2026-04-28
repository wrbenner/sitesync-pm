/**
 * Executor for action_type = "pay_app.draft".
 *
 * Iris drafts an AIA G702 + G703 pay application from the schedule of
 * values, approved change orders, and per-line completion percentages.
 * The executor inserts the pay-app header row plus per-line G703 rows
 * in a single transaction-flavored sequence, with automatic rollback
 * if the line items fail.
 *
 * This is the demo step that ends Procore's lock on the GC: the AI
 * fills the AIA paper-form math correctly the first time, the human
 * reviews and signs.
 */

import { supabase } from '../../../lib/supabase'
import type { DraftedAction, DraftedPayAppPayload } from '../../../types/draftedActions'

export async function executeDraftedPayApp(draft: DraftedAction): Promise<{
  resource_type: string
  resource_id: string
  result: Record<string, unknown>
}> {
  if (draft.action_type !== 'pay_app.draft') {
    throw new Error(`executeDraftedPayApp called with wrong action_type: ${draft.action_type}`)
  }
  const payload: DraftedPayAppPayload = draft.payload

  // Step 1: insert the G702 header row (status=draft so the user must
  // sign before the pay app is "submitted").
  const headerRow = {
    project_id: draft.project_id,
    application_number: payload.application_number,
    period_to: payload.period_to,
    period_from: payload.period_from,
    total_completed_and_stored: payload.total_completed_and_stored,
    retainage: payload.retainage,
    amount_due: payload.amount_due,
    status: 'draft',
    created_via: 'iris.draft',
    source_drafted_action_id: draft.id,
  }

  const { data: headerData, error: headerError } = await supabase
    .from('payment_applications')
    .insert(headerRow as never)
    .select('id, application_number')
    .single()

  if (headerError || !headerData) {
    throw new Error(headerError?.message ?? 'Pay app header insert failed')
  }
  const payAppId = (headerData as { id: string }).id

  // Step 2: insert the G703 line items. If any fail, attempt to
  // delete the header so we don't leave a half-built pay app behind.
  const lineRows = payload.line_items.map((li, idx) => ({
    project_id: draft.project_id,
    payment_application_id: payAppId,
    item_no: li.item_no || String(idx + 1),
    description: li.description,
    scheduled_value: li.scheduled_value,
    work_completed_this_period: li.work_completed_this_period,
    materials_stored: li.materials_stored,
    percent_complete: li.percent_complete,
    sort_order: idx,
  }))

  if (lineRows.length > 0) {
    const { error: linesError } = await supabase
      .from('payment_application_line_items')
      .insert(lineRows as never)

    if (linesError) {
      // Rollback: delete the header. Best-effort; if rollback also
      // fails, the user sees the partial state in the UI and can
      // delete it manually. Never silently swallow the original error.
      try {
        await supabase.from('payment_applications').delete().eq('id', payAppId)
      } catch { /* fall through */ }
      throw new Error(`Pay app line insert failed: ${linesError.message}`)
    }
  }

  return {
    resource_type: 'payment_application',
    resource_id: payAppId,
    result: {
      pay_app_id: payAppId,
      application_number: payload.application_number,
      line_items_inserted: lineRows.length,
      amount_due: payload.amount_due,
    },
  }
}
