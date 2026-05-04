/**
 * Iris draft-action writer.
 *
 * The single place Iris (and any AI tool that wants to draft an action)
 * should write to `drafted_actions`. Centralizing the write means:
 *   • we can run a Zod-validated payload check before insert
 *   • we can attach a default model identifier without sprinkling it
 *   • we get one place to instrument / log / rate-limit drafts
 *   • we never accidentally mutate production data outside the gate
 *
 * Importantly: this function NEVER executes the underlying action.
 * It only writes to the inbox table. Execution is gated through
 * `executeAction.ts` after a human decision.
 */

import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import type {
  DraftedAction,
  DraftedActionInsert,
  DraftedActionType,
} from '../../types/draftedActions'

export interface DraftActionResult {
  ok: boolean
  draft?: DraftedAction
  error?: string
}

/**
 * Persist a new drafted action. Returns the inserted row (with all
 * defaulted columns filled in) so the caller can immediately render
 * an inbox card without a follow-up query.
 *
 * Confidence defaults to 0.6 — reasonable AI confidence, but below the
 * 0.9 threshold that allows opt-in auto-execute. The caller should pass
 * a real confidence whenever the model returns one.
 */
export async function draftAction<T extends DraftedActionType>(
  input: DraftedActionInsert<T>,
): Promise<DraftActionResult> {
  if (!input.project_id) return { ok: false, error: 'project_id required' }
  if (!input.title?.trim()) return { ok: false, error: 'title required' }
  if (!input.drafted_by?.trim()) return { ok: false, error: 'drafted_by required' }

  const row = {
    project_id: input.project_id,
    action_type: input.action_type,
    title: input.title.trim(),
    summary: input.summary ?? null,
    payload: input.payload as unknown as Record<string, unknown>,
    citations: input.citations ?? [],
    confidence: typeof input.confidence === 'number'
      ? Math.max(0, Math.min(1, input.confidence))
      : 0.6,
    drafted_by: input.drafted_by,
    draft_reason: input.draft_reason ?? null,
    related_resource_type: input.related_resource_type ?? null,
    related_resource_id: input.related_resource_id ?? null,
    status: 'pending' as const,
  }

  const { data, error } = await fromTable('drafted_actions')
    .insert(row as never)
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Insert failed' }
  }

  return { ok: true, draft: data as unknown as DraftedAction }
}

/**
 * Withdraw a pending draft (e.g. underlying state changed and the draft
 * is no longer relevant). Marks status='rejected' with a system note;
 * preserves the row for the audit trail.
 */
export async function withdrawDraft(
  draftId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await fromTable('drafted_actions')
    .update({
      status: 'rejected',
      decision_note: `[withdrawn by system] ${reason}`,
      decided_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, draftId)
    .eq('status' as never, 'pending')

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
