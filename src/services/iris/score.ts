/**
 * src/services/iris/score.ts — emit a Langfuse score event for a draft.
 *
 * Browser-safe: the secret-bearing call to Langfuse runs server-side in
 * the `iris-score` edge function. From the browser we send a minimal
 * payload; the edge fn looks up the trace id from drafted_actions and
 * forwards to Langfuse.
 *
 * Best-effort: never blocks the caller and never throws on a network
 * failure. The accept/reject mutation has already succeeded by the time
 * we get here; observability lag is acceptable.
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export type IrisScoreKind = 'accept' | 'reject' | 'reword' | 'rating'

export interface SubmitIrisScoreInput {
  draftedActionId: string
  kind: IrisScoreKind
  /** 0..1 in the canonical accept/reject mapping. Free-form for 'rating'. */
  value: number
  comment?: string
}

export async function submitIrisScore(input: SubmitIrisScoreInput): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await supabase.functions.invoke('iris-score', {
      body: {
        drafted_action_id: input.draftedActionId,
        kind: input.kind,
        value: input.value,
        comment: input.comment,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch (err) {
    // Score writes are non-critical telemetry — never bubble up to UI.
    console.warn('[iris-score] submit failed (non-fatal):', err)
  }
}

/** Canonical value mapping for the four score kinds. */
export const SCORE_VALUES: Record<IrisScoreKind, number> = {
  accept: 1,
  reject: 0,
  reword: 0.5,
  rating: 0,
}
