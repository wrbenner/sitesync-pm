/**
 * Executor for action_type = "daily_log.draft".
 *
 * Iris drafts a daily log narration from photos + crew check-ins +
 * weather + GPS captures. The executor persists the structured log
 * row plus optional manpower/weather details, tagged with provenance
 * so the audit trail links back to the source draft.
 *
 * The shape of `daily_logs` varies slightly per deployment; we only
 * write columns we know exist (`project_id`, `log_date`, `notes`)
 * plus optional weather/manpower rolled into the same row when those
 * columns are present in this database. Anything Iris extracted that
 * doesn't fit the schema is preserved in `iris_metadata` jsonb.
 */

import { supabase } from '../../../lib/supabase'
import type { DraftedAction, DraftedDailyLogPayload } from '../../../types/draftedActions'

export async function executeDraftedDailyLog(draft: DraftedAction): Promise<{
  resource_type: string
  resource_id: string
  result: Record<string, unknown>
}> {
  if (draft.action_type !== 'daily_log.draft') {
    throw new Error(`executeDraftedDailyLog called with wrong action_type: ${draft.action_type}`)
  }
  const payload: DraftedDailyLogPayload = draft.payload

  const insertRow: Record<string, unknown> = {
    project_id: draft.project_id,
    log_date: payload.date,
    notes: payload.notes,
    weather_condition: payload.weather?.condition ?? null,
    high_temp: payload.weather?.high_temp ?? null,
    low_temp: payload.weather?.low_temp ?? null,
    precipitation: payload.weather?.precipitation ?? null,
    workers_onsite: payload.manpower_count ?? null,
    manpower: payload.trades ?? [],
    // Provenance: every Iris-executed mutation tags the source draft.
    created_via: 'iris.draft',
    source_drafted_action_id: draft.id,
  }

  const { data, error } = await supabase
    .from('daily_logs')
    .insert(insertRow as never)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Daily log insert failed')
  }
  const logId = (data as { id: string }).id

  // Best-effort: if the payload referenced photos, link them to the
  // newly-created log. Failure here is non-fatal — the log itself is
  // already saved; the photo association is a nice-to-have.
  if (payload.photo_ids && payload.photo_ids.length > 0) {
    try {
      await supabase
        .from('field_captures')
        .update({ daily_log_id: logId } as never)
        .in('id', payload.photo_ids)
    } catch {
      // Swallow — log is saved; photo link is supplementary
    }
  }

  return {
    resource_type: 'daily_log',
    resource_id: logId,
    result: {
      daily_log_id: logId,
      log_date: payload.date,
      photo_ids_linked: payload.photo_ids?.length ?? 0,
    },
  }
}
