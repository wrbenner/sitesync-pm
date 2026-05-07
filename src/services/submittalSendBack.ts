// Phase 7c-1 — Send-back service.
//
// Calls submittal_send_back RPC: re-opens target step + intermediates,
// flips ball-in-court back to the target's reviewer, and writes an
// auto-comment capturing the reason.

import { supabase } from '../lib/supabase'
import { type Result, ok, fail, dbError } from './errors'

export interface SendBackInput {
  /** The reviewer step row id to re-open (target.sequence < current.sequence). */
  target_step_id: string
  /** One of the SendBackDialog reason chips (or a free-form string). */
  reason_code: string
  /** Body of the auto-comment posted on the target step. */
  comment_body: string
}

export const submittalSendBackService = {
  async sendBack(input: SendBackInput): Promise<Result<string>> {
    const { data, error } = await supabase.rpc('submittal_send_back' as never, {
      p_target_step_id: input.target_step_id,
      p_reason_code: input.reason_code,
      p_comment_body: input.comment_body,
    } as never)
    if (error) return fail(dbError(error.message, { input }))
    return ok((data as unknown as string) ?? '')
  },
}

// ── Reason chips (canonical list — synced with SendBackDialog) ─────────────

export const SEND_BACK_REASONS = [
  { code: 'missing_aama_cert',     label: 'Missing AAMA cert' },
  { code: 'wrong_manufacturer',    label: 'Wrong manufacturer' },
  { code: 'spec_ambiguous',        label: 'Spec ambiguous' },
  { code: 'pm_judgment',           label: 'Need PM judgment call' },
  { code: 'rfi_required',          label: 'RFI required' },
  { code: 'sub_did_not_answer',    label: 'Sub didn\'t answer' },
  { code: 'wrong_revision',        label: 'Wrong revision' },
  { code: 'other',                 label: 'Other' },
] as const

export type SendBackReasonCode = typeof SEND_BACK_REASONS[number]['code']
