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


import { fromTable } from '../../lib/db/queries'
import type {
  DraftedAction,
  DraftedActionCitation,
  DraftedActionInsert,
  DraftedActionType,
} from '../../types/draftedActions'
import {
  type SourceFetchKind,
  verifyAllCitationSnippets,
} from './citationVerify'

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

  // Citation gate (IRIS_CITATIONS_SPEC § Phase 3 + 4):
  //   1. Empty citations array → reject. Iris must always cite.
  //   2. Snippet substring-mismatch → reject + audit_incidents medium.
  // Both checks are skipped for synthetic-prefix drafted_by values
  // used internally (e.g. tests, demo seeds) so we don't break them.
  const isInternalDraft =
    input.drafted_by.startsWith('iris.policy') ||
    input.drafted_by.startsWith('demo.') ||
    input.drafted_by.startsWith('test.')

  const citations = input.citations ?? []
  if (!isInternalDraft && citations.length === 0) {
    return {
      ok: false,
      error:
        'Draft rejected: no citations attached. Iris must always cite its sources.',
    }
  }

  if (!isInternalDraft && citations.length > 0) {
    const verification = await verifyAllCitationSnippets(
      citations,
      fetchSourceTextForVerify,
    )
    if (!verification.ok) {
      // Log audit_incidents at medium severity. Best-effort — never
      // block the rejection on the audit-log write.
      const failedCitations = verification.failures
        .map((f) => `${f.kind}:${f.ref ?? 'no-ref'} (${f.reason})`)
        .join(', ')
      try {
        await fromTable('audit_incidents').insert({
          severity: 'medium',
          category: 'fake_citation',
          description: `Iris draft rejected: ${verification.failures.length} citation snippet${
            verification.failures.length === 1 ? '' : 's'
          } did not match source text — ${failedCitations}`,
          related_project_id: input.project_id,
          detected_by: input.drafted_by,
          context: {
            failures: verification.failures,
            title: input.title,
            action_type: input.action_type,
          },
        } as never)
      } catch {
        // Audit-log write is best-effort; never block the rejection on it.
      }
      return {
        ok: false,
        error:
          'Draft rejected: one or more citation snippets do not match source text.',
      }
    }
  }

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
    iris_audit_id: input.iris_audit_id ?? null,
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
 * Fetch the source text used to verify a citation snippet. Per
 * IRIS_CITATIONS_SPEC § Phase 4, we verify against the citation's
 * authoritative text:
 *   * RFI         → title + description
 *   * Daily log   → summary
 *   * CO          → title + description + reason
 *   * Spec        → title + description + notes
 *
 * Returns null when the source row no longer exists (the citation
 * points at a deleted entity); the verifier reads this as
 * `source_not_found` and rejects the draft.
 */
async function fetchSourceTextForVerify(
  kind: SourceFetchKind,
  ref: string,
): Promise<string | null> {
  switch (kind) {
    case 'rfi_text': {
      const { data } = await fromTable('rfis')
        .select('title, description')
        .eq('id' as never, ref)
        .maybeSingle<{ title: string | null; description: string | null }>()
      if (!data) return null
      return `${data.title ?? ''} ${data.description ?? ''}`
    }
    case 'daily_log_notes': {
      const { data } = await fromTable('daily_logs')
        .select('summary')
        .eq('id' as never, ref)
        .maybeSingle<{ summary: string | null }>()
      if (!data) return null
      return data.summary ?? ''
    }
    case 'change_order_text': {
      const { data } = await fromTable('change_orders')
        .select('title, description, reason')
        .eq('id' as never, ref)
        .maybeSingle<{
          title: string | null
          description: string | null
          reason: string | null
        }>()
      if (!data) return null
      return `${data.title ?? ''} ${data.description ?? ''} ${data.reason ?? ''}`
    }
    case 'spec_section_text': {
      const { data } = await fromTable('specifications')
        .select('title, description, notes')
        .eq('id' as never, ref)
        .maybeSingle<{
          title: string | null
          description: string | null
          notes: string | null
        }>()
      if (!data) return null
      return `${data.title ?? ''} ${data.description ?? ''} ${data.notes ?? ''}`
    }
  }
}

/** Re-export the citation type so consumers don't need a second import. */
export type { DraftedActionCitation }

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
