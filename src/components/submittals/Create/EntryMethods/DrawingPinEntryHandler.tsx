// Phase 5 — Drawing-pin entry handler.
//
// When a user drops a pin on a sheet in the drawings viewer (or selects an
// existing pin), this handler creates a `submittal_drawing_pins` row and
// builds a draft seeded with the pin reference. The drawings viewer wiring
// is owned by the existing RFI pin engine; this handler only surfaces the
// hook a caller needs.
//
// Phase 5 ships the handler shape + the service path. The actual click
// target on a drawing sheet lives in `src/pages/drawings/*` and gets a
// "Create submittal here" context-menu item in Phase 5b (post-merge).

import { supabase } from '../../../../lib/supabase'
import { fromTable } from '../../../../lib/db/queries'
import { buildDraftFromPin, type SubmittalDraft } from '../../../../services/iris/submittalDraft'
import { type Result, ok, fail, dbError } from '../../../../services/errors'

export interface CreatePinInput {
  submittal_id?: string | null
  sheet_id?: string | null
  sheet_number?: string | null
  sheet_title?: string | null
  page_no: number
  x_pct: number
  y_pct: number
  bbox_pct?: { x: number; y: number; w: number; h: number } | null
  note?: string | null
}

/** Inserts a row into `submittal_drawing_pins`. When `submittal_id` is
 *  null, the pin is created in a "pre-submittal" state (orphaned) and the
 *  unified create modal attaches it once the submittal lands. */
export async function createDrawingPin(input: CreatePinInput): Promise<Result<{ id: string }>> {
  const { data, error } = await fromTable('submittal_drawing_pins' as never)
    .insert({
      submittal_id: input.submittal_id ?? null,
      sheet_id: input.sheet_id ?? null,
      sheet_number: input.sheet_number ?? null,
      sheet_title: input.sheet_title ?? null,
      page_no: input.page_no,
      x_pct: input.x_pct,
      y_pct: input.y_pct,
      bbox_pct: input.bbox_pct ?? null,
      note: input.note ?? null,
    } as never)
    .select('id')
    .single()

  if (error) return fail(dbError(error.message, {}))
  return ok({ id: (data as unknown as { id: string }).id })
}

/** Seeds a unified-create draft from a fresh drawing pin. The caller is
 *  responsible for passing the pin's metadata (sheet number / title /
 *  inferred CSI section if the sheet is mapped to one). */
export function seedDraftFromPin(input: {
  drawing_pin_id: string
  sheet_number: string | null
  sheet_title: string | null
  csi_section?: string | null
}): SubmittalDraft {
  return buildDraftFromPin(input)
}

/** Stand-alone helper — when the caller has a draft + a freshly-created
 *  submittal id, this attaches the pin (sets `submittal_id`). */
export async function attachPinToSubmittal(pinId: string, submittalId: string): Promise<Result<void>> {
  const { error } = await supabase
    .from('submittal_drawing_pins' as never)
    .update({ submittal_id: submittalId } as never)
    .eq('id', pinId as never)

  if (error) return fail(dbError(error.message, { pinId, submittalId }))
  return ok(undefined)
}
