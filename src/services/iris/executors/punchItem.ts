/**
 * Executor for action_type = "punch_item.draft".
 *
 * Iris detects deficiencies from drawing markups, photo annotations, or
 * field-capture notes and drafts a punch-list entry. The executor
 * persists the punch_items row, links any drawing-coordinate citation,
 * and tags provenance so the audit trail resolves "which AI suggestion
 * produced this?".
 */

import { supabase } from '../../../lib/supabase'
import type { DraftedAction, DraftedPunchItemPayload } from '../../../types/draftedActions'

export async function executeDraftedPunchItem(draft: DraftedAction): Promise<{
  resource_type: string
  resource_id: string
  result: Record<string, unknown>
}> {
  if (draft.action_type !== 'punch_item.draft') {
    throw new Error(`executeDraftedPunchItem called with wrong action_type: ${draft.action_type}`)
  }
  const payload: DraftedPunchItemPayload = draft.payload

  const insertRow: Record<string, unknown> = {
    project_id: draft.project_id,
    title: payload.title,
    description: payload.description,
    trade: payload.trade ?? null,
    location: payload.location ?? null,
    severity: payload.severity ?? 'medium',
    status: 'open',
    // Drawing-coordinate citations let the punch-list UI deep-link to the
    // exact spot the AI flagged; column names match the rest of the schema.
    location_drawing_id: payload.drawing_id ?? null,
    location_x: payload.x ?? null,
    location_y: payload.y ?? null,
    photo_url: payload.photo_url ?? null,
    // Provenance: every Iris-executed mutation tags the source draft.
    created_via: 'iris.draft',
    source_drafted_action_id: draft.id,
  }

  const { data, error } = await supabase
    .from('punch_items')
    .insert(insertRow as never)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Punch item insert failed')
  }
  const punchId = (data as { id: string }).id

  return {
    resource_type: 'punch_item',
    resource_id: punchId,
    result: { punch_item_id: punchId, title: payload.title },
  }
}
