// Phase 8 — Distribute v2 service.
//
// Backed by `submittal_distribute_v2` RPC in 20260511*. Richer than v1:
// accepts emails + message + auto_pin_drawings + magic_link flags.
// Returns the new distribution row id so the caller can render a confirm
// toast or open the magic-link viewer.

import { supabase } from '../lib/supabase'
import { type Result, ok, fail, dbError } from './errors'

export interface DistributeInput {
  submittal_id: string
  to_user_ids?: string[]
  to_emails?: string[]
  message?: string | null
  /** When true, the linked drawing pins get a "distributed YYYY-MM-DD"
   *  marker added to their `note` field (visible in the drawings viewer). */
  auto_pin_drawings?: boolean
  /** When true, generates 14-day magic-link tokens for each recipient
   *  email — Phase 9 wires the sub.sitesync.com viewer. */
  send_magic_link?: boolean
  /** Optional pre-uploaded distribution PDF (e.g. the stamped binder). */
  pdf_url?: string | null
}

export const submittalDistributeService = {
  async distribute(input: DistributeInput): Promise<Result<string>> {
    const { data, error } = await supabase.rpc('submittal_distribute_v2' as never, {
      p_id: input.submittal_id,
      p_to_user_ids: input.to_user_ids ?? [],
      p_to_emails: input.to_emails ?? [],
      p_message: input.message ?? null,
      p_auto_pin_drawings: input.auto_pin_drawings ?? false,
      p_send_magic_link: input.send_magic_link ?? false,
      p_pdf_url: input.pdf_url ?? null,
    } as never)

    if (error) return fail(dbError(error.message, { submittalId: input.submittal_id }))
    return ok((data as unknown as string) ?? '')
  },
}
