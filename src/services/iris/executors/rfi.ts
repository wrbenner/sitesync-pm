/**
 * Executor for action_type = "rfi.draft".
 *
 * Takes the AI-drafted RFI payload and creates a real RFI row, linked
 * back to the draft via the audit log so the trail reads:
 *   "RFI created from drafted_action <id>, approved by <user>, executed at <ts>"
 */

import { supabase } from '../../../lib/supabase'
import type { DraftedAction, DraftedRfiPayload } from '../../../types/draftedActions'

export async function executeDraftedRfi(draft: DraftedAction): Promise<{
  resource_type: string
  resource_id: string
  result: Record<string, unknown>
}> {
  if (draft.action_type !== 'rfi.draft') {
    throw new Error(`executeDraftedRfi called with wrong action_type: ${draft.action_type}`)
  }
  const payload: DraftedRfiPayload = draft.payload

  const insertRow: Record<string, unknown> = {
    project_id: draft.project_id,
    title: payload.title,
    description: payload.description,
    priority: payload.priority ?? 'medium',
    status: 'open',
    discipline: payload.discipline ?? null,
    spec_section: payload.spec_section ?? null,
    due_date: payload.due_date ?? null,
    ball_in_court: payload.ball_in_court ?? null,
    assigned_to: payload.assigned_to ?? null,
    drawing_id: payload.drawing_id ?? null,
    // Provenance: every Iris-executed mutation tags the source draft so
    // the audit trail can resolve "which AI suggestion produced this?"
    created_via: 'iris.draft',
    source_drafted_action_id: draft.id,
  }

  const { data, error } = await supabase
    .from('rfis')
    .insert(insertRow as never)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'RFI insert failed')
  }

  const rfiId = (data as { id: string }).id

  return {
    resource_type: 'rfi',
    resource_id: rfiId,
    result: { rfi_id: rfiId, title: payload.title },
  }
}
